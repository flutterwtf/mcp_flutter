import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import WebSocket from "ws";
import { CommandLineConfig } from "../index.js";
import { FlutterRPC } from "../rpc/flutter_rpc.js";
import { execAsync } from "../rpc/flutter_rpc_methods.js";
import {
  FlutterPort,
  IsolateResponse,
  LogLevel,
  VMInfo,
  WebSocketRequest,
  WebSocketResponse,
} from "../types/types.js";

export class FlutterInspectorServer {
  private server: Server;
  private port: number;
  private logLevel: LogLevel;
  private wsConnections: Map<number, WebSocket> = new Map();
  private pendingRequests: Map<
    string,
    { resolve: Function; reject: Function; method: string }
  > = new Map();
  private messageId = 0;

  // New properties for Dart proxy
  private dartProxyWs: WebSocket | null = null;
  private proxyPort = 8888;
  private pendingProxyRequests = new Map<
    string,
    { resolve: Function; reject: Function }
  >();

  constructor(args: CommandLineConfig) {
    this.port = args.port;
    this.logLevel = args.logLevel;

    this.server = new Server(
      {
        name: "flutter-inspector",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private generateId(): string {
    return `${Date.now()}_${this.messageId++}`;
  }

  private async connectWebSocket(port: number): Promise<WebSocket> {
    if (this.wsConnections.has(port)) {
      const ws = this.wsConnections.get(port)!;
      if (ws.readyState === WebSocket.OPEN) {
        return ws;
      }
      this.wsConnections.delete(port);
    }

    return new Promise((resolve, reject) => {
      const wsUrl = `ws://localhost:${port}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        this.log("debug", `WebSocket connected to ${wsUrl}`);
        this.wsConnections.set(port, ws);
        resolve(ws);
      };

      ws.onerror = (error) => {
        this.log("error", `WebSocket error for ${wsUrl}:`, error);
        reject(error);
      };

      ws.onclose = () => {
        this.log("debug", `WebSocket closed for ${wsUrl}`);
        this.wsConnections.delete(port);
      };

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(
            event.data.toString()
          ) as WebSocketResponse;

          if (response.id) {
            const request = this.pendingRequests.get(response.id);
            if (request) {
              if (response.error) {
                request.reject(new Error(response.error.message));
              } else {
                request.resolve(response.result);
              }
              this.pendingRequests.delete(response.id);
            }
          }
        } catch (error) {
          this.log("error", "Error parsing WebSocket message:", error);
        }
      };
    });
  }

  private async sendWebSocketRequest(
    port: number,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    const ws = await this.connectWebSocket(port);
    const id = this.generateId();

    const request: WebSocketRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, method });
      ws.send(JSON.stringify(request));
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => this.log("error", "[MCP Error]", error);

    process.on("SIGINT", async () => {
      // Close all WebSocket connections
      for (const ws of this.wsConnections.values()) {
        ws.close();
      }
      await this.server.close();
      process.exit(0);
    });
  }

  private log(level: LogLevel, ...args: unknown[]) {
    const levels: LogLevel[] = ["error", "warn", "info", "debug"];
    if (levels.indexOf(level) <= levels.indexOf(this.logLevel)) {
      switch (level) {
        case "error":
          console.error(...args);
          break;
        case "warn":
          console.warn(...args);
          break;
        case "info":
          console.info(...args);
          break;
        case "debug":
          console.debug(...args);
          break;
      }
    }
  }

  private async getActivePorts(): Promise<FlutterPort[]> {
    try {
      const { stdout } = await execAsync("lsof -i -P -n | grep LISTEN");
      const ports: FlutterPort[] = [];
      const lines = stdout.split("\n");

      for (const line of lines) {
        if (
          line.toLowerCase().includes("dart") ||
          line.toLowerCase().includes("flutter")
        ) {
          const parts = line.split(/\s+/);
          const pid = parts[1];
          const command = parts[0];
          const addressPart = parts[8];
          const portMatch = addressPart.match(/:(\d+)$/);

          if (portMatch) {
            ports.push({
              port: parseInt(portMatch[1], 10),
              pid,
              command,
            });
          }
        }
      }

      return ports;
    } catch (error) {
      this.log("error", "Error getting active ports:", error);
      return [];
    }
  }

  private async invokeFlutterMethod(
    port: number,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    try {
      const result = await this.sendWebSocketRequest(port, method, params);
      return result;
    } catch (error) {
      this.log("error", `Error invoking Flutter method ${method}:`, error);
      throw error;
    }
  }

  private async getFlutterIsolate(port: number): Promise<string> {
    const vmInfo = (await this.invokeFlutterMethod(port, "getVM")) as VMInfo;
    const isolates = vmInfo.isolates;

    // Find Flutter isolate by checking for Flutter extension RPCs
    for (const isolateRef of isolates) {
      const isolate = (await this.invokeFlutterMethod(port, "getIsolate", {
        isolateId: isolateRef.id,
      })) as IsolateResponse;

      // Check if this isolate has Flutter extensions
      const extensionRPCs = isolate.extensionRPCs || [];
      if (extensionRPCs.some((ext: string) => ext.startsWith("ext.flutter"))) {
        return isolateRef.id;
      }
    }

    throw new McpError(
      ErrorCode.InternalError,
      "No Flutter isolate found in the application"
    );
  }

  private async invokeFlutterExtension(
    port: number,
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const isolateId = await this.getFlutterIsolate(port);
    return this.invokeFlutterMethod(port, method, {
      ...params,
      isolateId,
    });
  }

  private async verifyFlutterDebugMode(port: number): Promise<void> {
    const vmInfo = (await this.invokeFlutterMethod(port, "getVM")) as VMInfo;
    const isolateId = await this.getFlutterIsolate(port);
    const isolateInfo = (await this.invokeFlutterMethod(port, "getIsolate", {
      isolateId,
    })) as IsolateResponse;

    if (
      !isolateInfo.extensionRPCs?.includes("ext.flutter.debugDumpRenderTree")
    ) {
      throw new McpError(
        ErrorCode.InternalError,
        "Flutter app must be running in debug mode to inspect the render tree"
      );
    }
  }

  private setupToolHandlers() {
    // Default port for Flutter/Dart processes
    const DEFAULT_FLUTTER_PORT = 8181;
    const serverToolsPath = path.join(__dirname, "server_tools.yaml");
    const serverToolsContent = fs.readFileSync(serverToolsPath, "utf8");
    const serverTools = yaml.load(serverToolsContent) as { tools: any[] };

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: serverTools.tools,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const handlePortParam = () => {
        const port = request.params.arguments?.port as number | undefined;
        return port || DEFAULT_FLUTTER_PORT;
      };

      const wrapResponse = (promise: Promise<unknown>) => {
        return promise
          .then((result) => ({
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          }))
          .catch((error: Error) => ({
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
          }));
      };

      switch (request.params.name) {
        case "get_active_ports": {
          const ports = await this.getActivePorts();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(ports, null, 2),
              },
            ],
          };
        }

        case "get_supported_protocols": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterMethod(port, "getSupportedProtocols")
          );
        }

        case "get_vm_info": {
          const port = handlePortParam();
          return wrapResponse(this.invokeFlutterMethod(port, "getVM"));
        }

        case "debug_dump_render_tree": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Debug.DUMP_RENDER_TREE)
          );
        }

        case "debug_dump_layer_tree": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Debug.DUMP_LAYER_TREE)
          );
        }

        case "debug_dump_semantics_tree": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Debug.DUMP_SEMANTICS)
          );
        }

        case "debug_dump_semantics_tree_inverse": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Debug.DUMP_SEMANTICS_INVERSE
            )
          );
        }

        case "toggle_debug_paint": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as {
            enabled: boolean;
          };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Debug.DEBUG_PAINT, {
              enabled,
            })
          );
        }

        case "get_flutter_version": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Debug.DUMP_APP)
          );
        }

        case "stream_listen": {
          const port = handlePortParam();
          const { streamId } = request.params.arguments as {
            streamId: string;
          };
          return wrapResponse(
            this.invokeFlutterMethod(port, "streamListen", { streamId })
          );
        }

        case "get_widget_tree": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Debug.DUMP_APP)
          );
        }

        case "get_widget_details": {
          const port = handlePortParam();
          const { objectId } = request.params.arguments as { objectId: string };
          if (!objectId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "objectId parameter is required"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.GET_PROPERTIES,
              {
                arg: { objectId },
              }
            )
          );
        }

        case "get_performance_stats": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);

          // First enable stats collection
          await this.invokeFlutterExtension(
            port,
            FlutterRPC.Performance.PROFILE_WIDGETS,
            {
              enabled: true,
            }
          );

          // Then get the stats
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Performance.PROFILE_USER_WIDGETS,
              {
                enabled: true,
              }
            )
          );
        }

        case "debug_paint_size": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Debug.DEBUG_PAINT, {
              enabled,
            })
          );
        }

        case "debug_paint_baselines": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Debug.DEBUG_PAINT_BASELINES,
              {
                enabled,
              }
            )
          );
        }

        case "inspector_track_rebuild_dirty_widgets": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.TRACK_REBUILDS,
              {
                enabled,
              }
            )
          );
        }

        case "get_extension_rpcs": {
          const port = handlePortParam();
          const { isolateId, isRawResponse = false } =
            (request.params.arguments as {
              isolateId?: string;
              isRawResponse?: boolean;
            }) || {};

          const vmInfo = (await this.invokeFlutterMethod(
            port,
            "getVM"
          )) as VMInfo;
          const isolates = vmInfo.isolates;

          if (isolateId) {
            const isolate = (await this.invokeFlutterMethod(
              port,
              "getIsolate",
              {
                isolateId,
              }
            )) as IsolateResponse;

            if (isRawResponse) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(isolate, null, 2),
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(isolate.extensionRPCs || [], null, 2),
                },
              ],
            };
          }

          if (isRawResponse) {
            const allIsolates = await Promise.all(
              isolates.map((isolateRef) =>
                this.invokeFlutterMethod(port, "getIsolate", {
                  isolateId: isolateRef.id,
                })
              )
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(allIsolates, null, 2),
                },
              ],
            };
          }

          const allExtensions: string[] = [];
          for (const isolateRef of isolates) {
            const isolate = (await this.invokeFlutterMethod(
              port,
              "getIsolate",
              {
                isolateId: isolateRef.id,
              }
            )) as IsolateResponse;
            if (isolate.extensionRPCs) {
              allExtensions.push(...isolate.extensionRPCs);
            }
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify([...new Set(allExtensions)], null, 2),
              },
            ],
          };
        }

        case "take_screenshot": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Inspector.SCREENSHOT)
          );
        }

        case "get_focus_tree": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Debug.DUMP_FOCUS_TREE)
          );
        }

        case "profile_user_widgets": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Performance.PROFILE_USER_WIDGETS,
              {
                enabled,
              }
            )
          );
        }

        case "get_layout_explorer": {
          const port = handlePortParam();
          const { objectId } = request.params.arguments as { objectId: string };
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Layout.GET_EXPLORER_NODE,
              {
                arg: { objectId },
              }
            )
          );
        }

        case "schedule_frame": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.UI.SCHEDULE_FRAME)
          );
        }

        case "reinitialize_shader": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.UI.REINITIALIZE_SHADER)
          );
        }

        case "impeller_enabled": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.UI.IMPELLER_ENABLED)
          );
        }

        case "dart_io_socket_profiling_enabled": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.DartIO.SOCKET_PROFILING_ENABLED,
              {
                enabled,
              }
            )
          );
        }

        case "dart_io_http_enable_timeline_logging": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.DartIO.HTTP_TIMELINE_LOGGING,
              {
                enabled,
              }
            )
          );
        }

        case "dart_io_get_open_files": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.DartIO.GET_OPEN_FILES)
          );
        }

        case "get_socket_profile": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.DartIO.GET_SOCKET_PROFILE
            )
          );
        }

        case "clear_socket_profile": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.DartIO.CLEAR_SOCKET_PROFILE
            )
          );
        }

        case "get_http_profile": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.DartIO.GET_HTTP_PROFILE
            )
          );
        }

        case "clear_http_profile": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.DartIO.CLEAR_HTTP_PROFILE
            )
          );
        }

        case "list_isar_instances": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Isar.LIST_INSTANCES)
          );
        }

        case "get_isar_schemas": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Isar.GET_SCHEMAS)
          );
        }

        case "watch_isar_instance": {
          const port = handlePortParam();
          const { instanceId } = request.params.arguments as {
            instanceId: string;
          };
          if (!instanceId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "instanceId parameter is required"
            );
          }
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Isar.WATCH_INSTANCE, {
              instanceId,
            })
          );
        }

        case "execute_isar_query": {
          const port = handlePortParam();
          const { query } = request.params.arguments as { query: string };
          if (!query) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "query parameter is required"
            );
          }
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Isar.EXECUTE_QUERY, {
              query,
            })
          );
        }

        case "delete_isar_query": {
          const port = handlePortParam();
          const { queryId } = request.params.arguments as { queryId: string };
          if (!queryId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "queryId parameter is required"
            );
          }
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Isar.DELETE_QUERY, {
              queryId,
            })
          );
        }

        case "import_isar_json": {
          const port = handlePortParam();
          const { json } = request.params.arguments as { json: string };
          if (!json) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "json parameter is required"
            );
          }
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Isar.IMPORT_JSON, {
              json,
            })
          );
        }

        case "edit_isar_property": {
          const port = handlePortParam();
          const { property, value } = request.params.arguments as {
            property: string;
            value: unknown;
          };
          if (!property) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "property parameter is required"
            );
          }
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Isar.EDIT_PROPERTY, {
              property,
              value,
            })
          );
        }

        case "dart_io_get_open_file_by_id": {
          const port = handlePortParam();
          const { fileId } = request.params.arguments as { fileId: string };
          if (!fileId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "fileId parameter is required"
            );
          }
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.DartIO.GET_OPEN_FILE_BY_ID,
              {
                fileId,
              }
            )
          );
        }

        case "dart_io_get_http_profile_request": {
          const port = handlePortParam();
          const { requestId } = request.params.arguments as {
            requestId: string;
          };
          if (!requestId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "requestId parameter is required"
            );
          }
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.DartIO.GET_HTTP_PROFILE_REQUEST,
              {
                requestId,
              }
            )
          );
        }

        case "inspector_screenshot": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Inspector.SCREENSHOT)
          );
        }

        case "flutter_core_invert_oversized_images": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Core.INVERT_OVERSIZED_IMAGES,
              {
                enabled,
              }
            )
          );
        }

        case "debug_allow_banner": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Debug.DEBUG_ALLOW_BANNER,
              {
                enabled,
              }
            )
          );
        }

        case "flutter_core_did_send_first_frame_event": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Core.DID_SEND_FIRST_FRAME_EVENT
            )
          );
        }

        case "flutter_core_did_send_first_frame_rasterized_event": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Core.DID_SEND_FIRST_FRAME_RASTERIZED_EVENT
            )
          );
        }

        case "flutter_core_platform_override": {
          const port = handlePortParam();
          const { platform } = request.params.arguments as {
            platform: string | null;
          };
          if (
            platform !== null &&
            ![
              "android",
              "ios",
              "fuchsia",
              "linux",
              "macOS",
              "windows",
            ].includes(platform)
          ) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "platform must be one of: android, ios, fuchsia, linux, macOS, windows, or null to reset"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Core.PLATFORM_OVERRIDE,
              {
                platform,
              }
            )
          );
        }

        case "flutter_core_brightness_override": {
          const port = handlePortParam();
          const { brightness } = request.params.arguments as {
            brightness: string | null;
          };
          if (
            brightness !== null &&
            !["light", "dark", null].includes(brightness)
          ) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "brightness must be one of: light, dark, or null to reset"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Core.BRIGHTNESS_OVERRIDE,
              {
                brightness,
              }
            )
          );
        }

        case "flutter_core_time_dilation": {
          const port = handlePortParam();
          const { dilation } = request.params.arguments as { dilation: number };
          if (typeof dilation !== "number" || dilation < 0) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "dilation must be a non-negative number"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Core.TIME_DILATION, {
              timeDilation: dilation,
            })
          );
        }

        case "flutter_core_evict": {
          const port = handlePortParam();
          const { asset } = request.params.arguments as { asset: string };
          if (!asset) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "asset parameter is required"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Core.EVICT, {
              asset,
            })
          );
        }

        case "flutter_core_profile_platform_channels": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Core.PROFILE_PLATFORM_CHANNELS,
              {
                enabled,
              }
            )
          );
        }

        case "debug_disable_clip_layers": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Debug.DEBUG_DISABLE_CLIP_LAYERS,
              {
                enabled,
              }
            )
          );
        }

        case "debug_disable_physical_shape_layers": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Debug.DISABLE_PHYSICAL_SHAPE_LAYERS,
              {
                enabled,
              }
            )
          );
        }

        case "debug_disable_opacity_layers": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Debug.DEBUG_DISABLE_OPACITY_LAYERS,
              {
                enabled,
              }
            )
          );
        }

        case "repaint_rainbow": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Debug.REPAINT_RAINBOW,
              {
                enabled,
              }
            )
          );
        }

        case "inspector_get_layout_explorer_node": {
          const port = handlePortParam();
          const { objectId } = request.params.arguments as { objectId: string };
          if (!objectId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "objectId parameter is required"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Layout.GET_EXPLORER_NODE,
              {
                arg: { objectId },
              }
            )
          );
        }

        case "inspector_set_selection_by_id": {
          const port = handlePortParam();
          const { selectionId } = request.params.arguments as {
            selectionId: string;
          };
          if (!selectionId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "selectionId parameter is required"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.SET_SELECTION_BY_ID,
              {
                arg: { selectionId },
              }
            )
          );
        }

        case "inspector_get_parent_chain": {
          const port = handlePortParam();
          const { objectId } = request.params.arguments as { objectId: string };
          if (!objectId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "objectId parameter is required"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.GET_PARENT_CHAIN,
              {
                arg: { objectId },
              }
            )
          );
        }

        case "inspector_get_children_summary_tree": {
          const port = handlePortParam();
          const { objectId } = request.params.arguments as { objectId: string };
          if (!objectId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "objectId parameter is required"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.GET_CHILDREN_SUMMARY_TREE,
              {
                arg: { objectId },
              }
            )
          );
        }

        case "inspector_get_children_details_subtree": {
          const port = handlePortParam();
          const { objectId } = request.params.arguments as { objectId: string };
          if (!objectId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "objectId parameter is required"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.GET_CHILDREN_DETAILS_SUBTREE,
              {
                arg: { objectId },
              }
            )
          );
        }

        case "inspector_get_root_widget_summary_tree": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.GET_ROOT_WIDGET_SUMMARY_TREE
            )
          );
        }

        case "inspector_get_root_widget_summary_tree_with_previews": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.GET_ROOT_WIDGET_SUMMARY_TREE_WITH_PREVIEWS
            )
          );
        }

        case "inspector_get_details_subtree": {
          const port = handlePortParam();
          const { objectId } = request.params.arguments as { objectId: string };
          if (!objectId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "objectId parameter is required"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.GET_DETAILS_SUBTREE,
              {
                arg: { objectId },
              }
            )
          );
        }

        case "inspector_get_selected_widget": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.GET_SELECTED_WIDGET
            )
          );
        }

        case "inspector_get_selected_summary_widget": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.GET_SELECTED_SUMMARY_WIDGET
            )
          );
        }

        case "inspector_is_widget_creation_tracked": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.IS_WIDGET_CREATION_TRACKED
            )
          );
        }

        case "inspector_structured_errors": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.STRUCTURED_ERRORS,
              {
                enabled,
              }
            )
          );
        }

        case "inspector_show": {
          const port = handlePortParam();
          const { options } = request.params.arguments as {
            options: {
              objectId: string;
              groupName?: string;
              subtreeDepth?: number;
            };
          };

          if (!options || !options.objectId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "options.objectId parameter is required"
            );
          }

          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Inspector.SHOW, {
              arg: options,
            })
          );
        }

        case "inspector_widget_location_id_map": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.WIDGET_LOCATION_ID_MAP
            )
          );
        }

        case "inspector_track_repaint_widgets": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.TRACK_REPAINT_WIDGETS,
              {
                enabled,
              }
            )
          );
        }

        case "inspector_dispose_all_groups": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.DISPOSE_ALL_GROUPS
            )
          );
        }

        case "inspector_dispose_group": {
          const port = handlePortParam();
          const { groupId } = request.params.arguments as { groupId: string };
          if (!groupId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "groupId parameter is required"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.DISPOSE_GROUP,
              {
                arg: { groupId },
              }
            )
          );
        }

        case "inspector_is_widget_tree_ready": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          const result = await this.invokeFlutterExtension(
            port,
            FlutterRPC.Inspector.IS_WIDGET_TREE_READY
          );
          return wrapResponse(Promise.resolve(result));
        }

        case "inspector_dispose_id": {
          const port = handlePortParam();
          const { id } = request.params.arguments as { id: string };
          if (!id) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "id parameter is required"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Inspector.DISPOSE_ID, {
              arg: { id },
            })
          );
        }

        case "inspector_set_pub_root_directories": {
          const port = handlePortParam();
          const { directories } = request.params.arguments as {
            directories: string[];
          };
          if (!directories || !Array.isArray(directories)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "directories parameter must be an array"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.SET_PUB_ROOT_DIRECTORIES,
              {
                directories,
              }
            )
          );
        }

        case "inspector_add_pub_root_directories": {
          const port = handlePortParam();
          const { directories } = request.params.arguments as {
            directories: string[];
          };
          if (!directories || !Array.isArray(directories)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "directories parameter must be an array"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.ADD_PUB_ROOT_DIRECTORIES,
              {
                directories,
              }
            )
          );
        }

        case "inspector_remove_pub_root_directories": {
          const port = handlePortParam();
          const { directories } = request.params.arguments as {
            directories: string[];
          };
          if (!directories || !Array.isArray(directories)) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "directories parameter must be an array"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.REMOVE_PUB_ROOT_DIRECTORIES,
              {
                directories,
              }
            )
          );
        }

        case "inspector_get_pub_root_directories": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Inspector.GET_PUB_ROOT_DIRECTORIES
            )
          );
        }

        case "layout_set_flex_fit": {
          const port = handlePortParam();
          const { objectId, fit } = request.params.arguments as {
            objectId: string;
            fit: string;
          };
          if (!objectId || !fit) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "objectId and fit parameters are required"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Layout.SET_FLEX_FIT, {
              objectId,
              fit,
            })
          );
        }

        case "layout_set_flex_factor": {
          const port = handlePortParam();
          const { objectId, factor } = request.params.arguments as {
            objectId: string;
            factor: number;
          };
          if (!objectId || typeof factor !== "number" || factor < 0) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "objectId and factor parameters are required and factor must be non-negative"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Layout.SET_FLEX_FACTOR,
              {
                objectId,
                factor,
              }
            )
          );
        }

        case "layout_set_flex_properties": {
          const port = handlePortParam();
          const { objectId, properties } = request.params.arguments as {
            objectId: string;
            properties: {
              fit: string;
              factor: number;
            };
          };
          if (
            !objectId ||
            !properties ||
            !properties.fit ||
            !properties.factor
          ) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "objectId and properties parameters are required"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              FlutterRPC.Layout.SET_FLEX_PROPERTIES,
              {
                objectId,
                properties,
              }
            )
          );
        }

        case "performance_profile_render_object_paints": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          const response = await this.invokeFlutterExtension(
            port,
            FlutterRPC.Performance.PROFILE_RENDER_OBJECT_PAINTS,
            {
              enabled,
            }
          );
          return {
            content: [
              {
                type: "text",
                text: `Render object paint profiling ${
                  enabled ? "enabled" : "disabled"
                }`,
              },
            ],
          };
        }

        case "performance_profile_render_object_layouts": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as { enabled: boolean };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          const response = await this.invokeFlutterExtension(
            port,
            FlutterRPC.Performance.PROFILE_RENDER_OBJECT_LAYOUTS,
            {
              enabled,
            }
          );
          return {
            content: [
              {
                type: "text",
                text: `Render object layout profiling ${
                  enabled ? "enabled" : "disabled"
                }`,
              },
            ],
          };
        }

        case "get_widget_tree_proxy": {
          const port = handlePortParam();
          const { includeProperties, subtreeDepth } = request.params
            .arguments as {
            includeProperties?: boolean;
            subtreeDepth?: number;
          };
          return wrapResponse(
            this.sendDartProxyRequest("getWidgetTree", port, {
              includeProperties,
              subtreeDepth,
            })
          );
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  // New method for connecting to Dart proxy
  private async connectToDartProxy(): Promise<WebSocket> {
    if (this.dartProxyWs && this.dartProxyWs.readyState === WebSocket.OPEN) {
      return this.dartProxyWs;
    }

    return new Promise((resolve, reject) => {
      const wsUrl = `ws://localhost:${this.proxyPort}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        this.log("debug", `WebSocket connected to Dart proxy at ${wsUrl}`);
        this.dartProxyWs = ws;
        resolve(ws);
      };

      ws.onerror = (error) => {
        this.log("error", `WebSocket error for Dart proxy:`, error);
        reject(error);
        this.dartProxyWs = null; // Clear on error
      };

      ws.onclose = () => {
        this.log("debug", `WebSocket closed for Dart proxy`);
        this.dartProxyWs = null;
      };

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data.toString());
          if (response.id) {
            const request = this.pendingProxyRequests.get(response.id);
            if (request) {
              if (response.error) {
                request.reject(new Error(response.error));
              } else {
                request.resolve(response.result);
              }
              this.pendingProxyRequests.delete(response.id);
            }
          }
        } catch (error) {
          this.log("error", "Error parsing Dart proxy message:", error);
        }
      };
    });
  }

  // New method for sending requests to Dart proxy
  private async sendDartProxyRequest(
    command: string,
    port: number,
    args: Record<string, any> = {}
  ): Promise<any> {
    const ws = await this.connectToDartProxy();
    const id = this.generateId();

    // Extract auth token from the VM service URL
    const vmServiceUrl = await this.invokeFlutterMethod(port, "getVM");
    const authToken = (vmServiceUrl as any)?.uri?.split("/")?.at(-2);

    const request = {
      id,
      command,
      port,
      authToken,
      ...args,
    };

    return new Promise((resolve, reject) => {
      this.pendingProxyRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify(request));
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.log(
      "info",
      `Flutter Inspector MCP server running on stdio, port ${this.port}`
    );
  }
}
