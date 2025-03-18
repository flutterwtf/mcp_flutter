#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import * as dotenv from "dotenv";
import { promisify } from "util";
import WebSocket from "ws";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// Load environment variables
dotenv.config();

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .options({
    port: {
      alias: "p",
      description: "Port to run the server on",
      type: "number",
      default: parseInt(process.env.PORT || "3334", 10),
    },
    stdio: {
      description: "Run in stdio mode instead of HTTP mode",
      type: "boolean",
      default: true,
    },
    "log-level": {
      description: "Logging level",
      choices: ["error", "warn", "info", "debug"] as const,
      default: process.env.LOG_LEVEL || "info",
    },
  })
  .help()
  .parseSync();

const execAsync = promisify(exec);

interface FlutterPort {
  port: number;
  pid: string;
  command: string;
}

interface IsolatesResponse {
  isolates: Array<{
    id: string;
    [key: string]: unknown;
  }>;
}

interface FlutterMethodResponse {
  type?: string;
  result: unknown;
}

interface WebSocketRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface WebSocketResponse {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type LogLevel = "error" | "warn" | "info" | "debug";

interface IsolateInfo {
  id: string;
  name?: string;
  number?: string;
  isSystemIsolate?: boolean;
  isolateGroupId?: string;
  extensionRPCs?: string[];
}

interface VMInfo {
  isolates: IsolateInfo[];
  version?: string;
  pid?: number;
  // Add other VM info fields as needed
}

interface IsolateResponse extends IsolateInfo {
  extensionRPCs?: string[];
  // Add other isolate response fields as needed
}

enum RPCPrefix {
  UI = "ext.ui.window",
  DART_IO = "ext.dart.io",
  FLUTTER = "ext.flutter",
  INSPECTOR = "ext.flutter.inspector",
  ISAR = "ext.isar",
}

function createRPCMethod(prefix: RPCPrefix, method: string): string {
  return `${prefix}.${method}`;
}

// Group RPC methods by functionality
const FlutterRPC = {
  UI: {
    SCHEDULE_FRAME: createRPCMethod(RPCPrefix.UI, "scheduleFrame"),
    REINITIALIZE_SHADER: createRPCMethod(RPCPrefix.UI, "reinitializeShader"),
    IMPELLER_ENABLED: createRPCMethod(RPCPrefix.UI, "impellerEnabled"),
  },
  DartIO: {
    HTTP_TIMELINE_LOGGING: createRPCMethod(
      RPCPrefix.DART_IO,
      "httpEnableTimelineLogging"
    ),
    GET_SOCKET_PROFILE: createRPCMethod(RPCPrefix.DART_IO, "getSocketProfile"),
    SOCKET_PROFILING_ENABLED: createRPCMethod(
      RPCPrefix.DART_IO,
      "socketProfilingEnabled"
    ),
    CLEAR_SOCKET_PROFILE: createRPCMethod(
      RPCPrefix.DART_IO,
      "clearSocketProfile"
    ),
    GET_VERSION: createRPCMethod(RPCPrefix.DART_IO, "getVersion"),
    GET_HTTP_PROFILE: createRPCMethod(RPCPrefix.DART_IO, "getHttpProfile"),
    GET_HTTP_PROFILE_REQUEST: createRPCMethod(
      RPCPrefix.DART_IO,
      "getHttpProfileRequest"
    ),
    CLEAR_HTTP_PROFILE: createRPCMethod(RPCPrefix.DART_IO, "clearHttpProfile"),
    GET_OPEN_FILES: createRPCMethod(RPCPrefix.DART_IO, "getOpenFiles"),
    GET_OPEN_FILE_BY_ID: createRPCMethod(RPCPrefix.DART_IO, "getOpenFileById"),
  },
  Core: {
    REASSEMBLE: createRPCMethod(RPCPrefix.FLUTTER, "reassemble"),
    EXIT: createRPCMethod(RPCPrefix.FLUTTER, "exit"),
    CONNECTED_VM_SERVICE_URI: createRPCMethod(
      RPCPrefix.FLUTTER,
      "connectedVmServiceUri"
    ),
    ACTIVE_DEVTOOLS_SERVER_ADDRESS: createRPCMethod(
      RPCPrefix.FLUTTER,
      "activeDevToolsServerAddress"
    ),
    PLATFORM_OVERRIDE: createRPCMethod(RPCPrefix.FLUTTER, "platformOverride"),
    BRIGHTNESS_OVERRIDE: createRPCMethod(
      RPCPrefix.FLUTTER,
      "brightnessOverride"
    ),
    TIME_DILATION: createRPCMethod(RPCPrefix.FLUTTER, "timeDilation"),
    EVICT: createRPCMethod(RPCPrefix.FLUTTER, "evict"),
    INVERT_OVERSIZED_IMAGES: createRPCMethod(
      RPCPrefix.FLUTTER,
      "invertOversizedImages"
    ),
    DID_SEND_FIRST_FRAME_EVENT: createRPCMethod(
      RPCPrefix.FLUTTER,
      "didSendFirstFrameEvent"
    ),
    DID_SEND_FIRST_FRAME_RASTERIZED_EVENT: createRPCMethod(
      RPCPrefix.FLUTTER,
      "didSendFirstFrameRasterizedEvent"
    ),
  },
  Debug: {
    DUMP_APP: createRPCMethod(RPCPrefix.FLUTTER, "debugDumpApp"),
    DUMP_RENDER_TREE: createRPCMethod(RPCPrefix.FLUTTER, "debugDumpRenderTree"),
    DUMP_LAYER_TREE: createRPCMethod(RPCPrefix.FLUTTER, "debugDumpLayerTree"),
    DUMP_SEMANTICS: createRPCMethod(
      RPCPrefix.FLUTTER,
      "debugDumpSemanticsTreeInTraversalOrder"
    ),
    DUMP_SEMANTICS_INVERSE: createRPCMethod(
      RPCPrefix.FLUTTER,
      "debugDumpSemanticsTreeInInverseHitTestOrder"
    ),
    DUMP_FOCUS_TREE: createRPCMethod(RPCPrefix.FLUTTER, "debugDumpFocusTree"),
    DEBUG_PAINT: createRPCMethod(RPCPrefix.FLUTTER, "debugPaint"),
    DEBUG_PAINT_BASELINES: createRPCMethod(
      RPCPrefix.FLUTTER,
      "debugPaintBaselinesEnabled"
    ),
    REPAINT_RAINBOW: createRPCMethod(RPCPrefix.FLUTTER, "repaintRainbow"),
    DEBUG_DISABLE_CLIP_LAYERS: createRPCMethod(
      RPCPrefix.FLUTTER,
      "debugDisableClipLayers"
    ),
    DEBUG_DISABLE_PHYSICAL_SHAPE_LAYERS: createRPCMethod(
      RPCPrefix.FLUTTER,
      "debugDisablePhysicalShapeLayers"
    ),
    DEBUG_DISABLE_OPACITY_LAYERS: createRPCMethod(
      RPCPrefix.FLUTTER,
      "debugDisableOpacityLayers"
    ),
    DEBUG_ALLOW_BANNER: createRPCMethod(RPCPrefix.FLUTTER, "debugAllowBanner"),
  },
  Inspector: {
    SCREENSHOT: createRPCMethod(RPCPrefix.INSPECTOR, "screenshot"),
    GET_ROOT_WIDGET: createRPCMethod(RPCPrefix.INSPECTOR, "getRootWidget"),
    GET_WIDGET_TREE: createRPCMethod(RPCPrefix.INSPECTOR, "getRootWidgetTree"),
    GET_PROPERTIES: createRPCMethod(RPCPrefix.INSPECTOR, "getProperties"),
    GET_CHILDREN: createRPCMethod(RPCPrefix.INSPECTOR, "getChildren"),
    TRACK_REBUILDS: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "trackRebuildDirtyWidgets"
    ),
    STRUCTURED_ERRORS: createRPCMethod(RPCPrefix.INSPECTOR, "structuredErrors"),
    SHOW: createRPCMethod(RPCPrefix.INSPECTOR, "show"),
    WIDGET_LOCATION_ID_MAP: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "widgetLocationIdMap"
    ),
    TRACK_REPAINT_WIDGETS: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "trackRepaintWidgets"
    ),
    DISPOSE_ALL_GROUPS: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "disposeAllGroups"
    ),
    DISPOSE_GROUP: createRPCMethod(RPCPrefix.INSPECTOR, "disposeGroup"),
    IS_WIDGET_TREE_READY: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "isWidgetTreeReady"
    ),
    DISPOSE_ID: createRPCMethod(RPCPrefix.INSPECTOR, "disposeId"),
    SET_PUB_ROOT_DIRECTORIES: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "setPubRootDirectories"
    ),
    ADD_PUB_ROOT_DIRECTORIES: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "addPubRootDirectories"
    ),
    REMOVE_PUB_ROOT_DIRECTORIES: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "removePubRootDirectories"
    ),
    GET_PUB_ROOT_DIRECTORIES: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "getPubRootDirectories"
    ),
  },
  Performance: {
    SHOW_OVERLAY: createRPCMethod(RPCPrefix.FLUTTER, "showPerformanceOverlay"),
    PROFILE_WIDGETS: createRPCMethod(RPCPrefix.FLUTTER, "profileWidgetBuilds"),
    PROFILE_USER_WIDGETS: createRPCMethod(
      RPCPrefix.FLUTTER,
      "profileUserWidgetBuilds"
    ),
    PROFILE_PLATFORM_CHANNELS: createRPCMethod(
      RPCPrefix.FLUTTER,
      "profilePlatformChannels"
    ),
    PROFILE_RENDER_OBJECT_PAINTS: createRPCMethod(
      RPCPrefix.FLUTTER,
      "profileRenderObjectPaints"
    ),
    PROFILE_RENDER_OBJECT_LAYOUTS: createRPCMethod(
      RPCPrefix.FLUTTER,
      "profileRenderObjectLayouts"
    ),
  },
  Layout: {
    GET_EXPLORER_NODE: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "getLayoutExplorerNode"
    ),
    SET_FLEX_FIT: createRPCMethod(RPCPrefix.INSPECTOR, "setFlexFit"),
    SET_FLEX_FACTOR: createRPCMethod(RPCPrefix.INSPECTOR, "setFlexFactor"),
    SET_FLEX_PROPERTIES: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "setFlexProperties"
    ),
  },
  Isar: {
    LIST_INSTANCES: createRPCMethod(RPCPrefix.ISAR, "listInstances"),
    GET_SCHEMAS: createRPCMethod(RPCPrefix.ISAR, "getSchemas"),
    WATCH_INSTANCE: createRPCMethod(RPCPrefix.ISAR, "watchInstance"),
    EXECUTE_QUERY: createRPCMethod(RPCPrefix.ISAR, "executeQuery"),
    DELETE_QUERY: createRPCMethod(RPCPrefix.ISAR, "deleteQuery"),
    IMPORT_JSON: createRPCMethod(RPCPrefix.ISAR, "importJson"),
    EDIT_PROPERTY: createRPCMethod(RPCPrefix.ISAR, "editProperty"),
  },
};

class FlutterInspectorServer {
  private server: Server;
  private port: number;
  private logLevel: LogLevel;
  private wsConnections: Map<number, WebSocket> = new Map();
  private pendingRequests: Map<
    string,
    { resolve: Function; reject: Function; method: string }
  > = new Map();
  private messageId = 0;

  constructor() {
    this.port = argv.port;
    this.logLevel = argv["log-level"] as LogLevel;

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

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Utility Methods (Not direct RPC calls)
        {
          name: "get_active_ports",
          description:
            "Utility: Get list of ports where Flutter/Dart processes are listening. This is a local utility, not a Flutter RPC method.",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "get_supported_protocols",
          description:
            "Utility: Get supported protocols from a Flutter app. This is a VM service method, not a Flutter RPC.",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "get_vm_info",
          description:
            "Utility: Get VM information from a Flutter app. This is a VM service method, not a Flutter RPC.",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "get_extension_rpcs",
          description:
            "Utility: List all available extension RPCs in the Flutter app. This is a helper tool for discovering available methods.",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              isolateId: {
                type: "string",
                description:
                  "Optional specific isolate ID to check. If not provided, checks all isolates",
              },
            },
            required: [],
          },
        },

        // Debug Methods (ext.flutter.debug*)
        {
          name: "debug_dump_render_tree",
          description:
            "RPC: Dump the render tree (ext.flutter.debugDumpRenderTree)",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "debug_dump_layer_tree",
          description:
            "RPC: Dump the layer tree (ext.flutter.debugDumpLayerTree)",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "debug_dump_semantics_tree",
          description:
            "RPC: Dump the semantics tree (ext.flutter.debugDumpSemanticsTreeInTraversalOrder)",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "debug_paint_baselines_enabled",
          description:
            "RPC: Toggle baseline paint debugging (ext.flutter.debugPaintBaselinesEnabled)",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              enabled: {
                type: "boolean",
                description:
                  "Whether to enable or disable baseline paint debugging",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "debug_dump_focus_tree",
          description:
            "RPC: Dump the focus tree (ext.flutter.debugDumpFocusTree)",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },

        // Inspector Methods (ext.flutter.inspector.*)
        {
          name: "inspector_screenshot",
          description:
            "RPC: Take a screenshot of the Flutter app (ext.flutter.inspector.screenshot)",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "inspector_get_layout_explorer_node",
          description:
            "RPC: Get layout explorer information for a widget (ext.flutter.inspector.getLayoutExplorerNode)",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              objectId: {
                type: "string",
                description: "ID of the widget to inspect",
              },
            },
            required: ["objectId"],
          },
        },

        // DartIO Methods (ext.dart.io.*)
        {
          name: "dart_io_socket_profiling_enabled",
          description: "RPC: Enable or disable socket profiling",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              enabled: {
                type: "boolean",
                description: "Whether to enable or disable socket profiling",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "dart_io_http_enable_timeline_logging",
          description: "RPC: Enable or disable HTTP timeline logging",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              enabled: {
                type: "boolean",
                description:
                  "Whether to enable or disable HTTP timeline logging",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "dart_io_get_version",
          description:
            "RPC: Get Flutter version information (ext.dart.io.getVersion)",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "dart_io_get_open_files",
          description:
            "RPC: Get list of currently open files in the Flutter app",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "dart_io_get_open_file_by_id",
          description: "RPC: Get details of a specific open file by its ID",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              fileId: {
                type: "string",
                description: "ID of the file to get details for",
              },
            },
            required: ["fileId"],
          },
        },

        // Stream Methods
        {
          name: "stream_listen",
          description:
            "RPC: Subscribe to a Flutter event stream. This is a VM service method for event monitoring.",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              streamId: {
                type: "string",
                description: "Stream ID to subscribe to",
                enum: [
                  "Debug",
                  "Isolate",
                  "VM",
                  "GC",
                  "Timeline",
                  "Logging",
                  "Service",
                  "HeapSnapshot",
                ],
              },
            },
            required: ["streamId"],
          },
        },
        {
          name: "dart_io_get_http_profile_request",
          description:
            "RPC: Get details of a specific HTTP request from the profile",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              requestId: {
                type: "string",
                description: "ID of the HTTP request to get details for",
              },
            },
            required: ["requestId"],
          },
        },
        {
          name: "flutter_core_invert_oversized_images",
          description:
            "RPC: Toggle inverting of oversized images for debugging",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              enabled: {
                type: "boolean",
                description:
                  "Whether to enable or disable inverting of oversized images",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "debug_allow_banner",
          description: "RPC: Toggle the debug banner in the Flutter app",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              enabled: {
                type: "boolean",
                description: "Whether to show or hide the debug banner",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "flutter_core_did_send_first_frame_event",
          description: "RPC: Check if the first frame event has been sent",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "flutter_core_did_send_first_frame_rasterized_event",
          description: "RPC: Check if the first frame has been rasterized",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const handlePortParam = () => {
        const { port } = (request.params.arguments as { port?: number }) || {};
        if (port && typeof port !== "number") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Port number must be a number when provided"
          );
        }
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

        case "get_render_tree": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Debug.DUMP_RENDER_TREE)
          );
        }

        case "get_layer_tree": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Debug.DUMP_LAYER_TREE)
          );
        }

        case "get_semantics_tree": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, FlutterRPC.Debug.DUMP_SEMANTICS)
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

        case "get_extension_rpcs": {
          const port = handlePortParam();
          const { isolateId } =
            (request.params.arguments as { isolateId?: string }) || {};

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
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(isolate.extensionRPCs || [], null, 2),
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

        // New handlers for UI methods
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

        // New handlers for DartIO methods
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

        // New handlers for Isar methods
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

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
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

const server = new FlutterInspectorServer();
server.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
