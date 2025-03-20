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
import { fileURLToPath } from "url";
import WebSocket from "ws";
import { CommandLineConfig } from "../index.js";
import { execAsync } from "../rpc/flutter_rpc_methods.js";
import {
  FlutterPort,
  IsolateResponse,
  LogLevel,
  VMInfo,
  WebSocketRequest,
  WebSocketResponse,
} from "../types/types.js";
import { createRpcHandlerMap } from "./create_rpc_handler_map.generated.js";
import { FlutterRpcHandlers } from "./flutter_rpc_handlers.generated.js";

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  public async verifyFlutterDebugMode(port: number): Promise<void> {
    const vmInfo = await this.invokeFlutterMethod(port, "getVM");
    if (!vmInfo) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get VM info from Flutter app on port ${port}`
      );
    }
  }

  public async invokeFlutterExtension(
    port: number,
    method: string,
    params: any = {}
  ): Promise<any> {
    const fullMethod = method.startsWith("ext.")
      ? method
      : `ext.flutter.${method}`;

    return this.invokeFlutterMethod(port, "ext:$" + fullMethod, params);
  }

  public wrapResponse(promise: Promise<unknown>) {
    return promise
      .then((result) => ({
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      }))
      .catch((error: Error) => ({
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      }));
  }

  private setupToolHandlers() {
    // Default port for Flutter/Dart processes
    const DEFAULT_FLUTTER_PORT = 8181;
    const serverToolsPath = path.join(__dirname, "server_tools.yaml");

    try {
      if (!fs.existsSync(serverToolsPath)) {
        throw new Error(`Cannot find server_tools.yaml at ${serverToolsPath}`);
      }

      const serverToolsContent = fs.readFileSync(serverToolsPath, "utf8");
      const serverTools = yaml.load(serverToolsContent) as { tools: any[] };

      this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: serverTools.tools,
      }));

      const rpcHandlers = new FlutterRpcHandlers(this); // Instantiate FlutterRpcHandlers

      // Use the generated function to create the handler map
      const handlerMap = createRpcHandlerMap(rpcHandlers, (request) =>
        this.handlePortParam(request)
      );

      this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const handlePortParam = () => {
          const port = request.params.arguments?.port as number | undefined;
          return port || DEFAULT_FLUTTER_PORT;
        };

        const wrapResponse = (promise: Promise<unknown>) => {
          return this.wrapResponse(promise);
        };

        const toolName = request.params.name;
        const handler = handlerMap[toolName];
        if (handler) {
          return handler(request);
        }

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
    } catch (error) {
      this.log("error", "Error setting up tool handlers:", error);
      throw error;
    }
  }

  private handlePortParam(request: any): number {
    const DEFAULT_FLUTTER_PORT = 8181;
    const port = request.params.arguments?.port as number | undefined;
    return port || DEFAULT_FLUTTER_PORT;
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
