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
    PROFILE_PLATFORM_CHANNELS: createRPCMethod(
      RPCPrefix.FLUTTER,
      "profilePlatformChannels"
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
    DISABLE_PHYSICAL_SHAPE_LAYERS: createRPCMethod(
      RPCPrefix.FLUTTER,
      "debugDisablePhysicalShapeLayers"
    ),
  },
  Inspector: {
    IS_WIDGET_CREATION_TRACKED: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "isWidgetCreationTracked"
    ),
    GET_SELECTED_SUMMARY_WIDGET: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "getSelectedSummaryWidget"
    ),
    GET_SELECTED_WIDGET: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "getSelectedWidget"
    ),
    GET_DETAILS_SUBTREE: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "getDetailsSubtree"
    ),
    SCREENSHOT: createRPCMethod(RPCPrefix.INSPECTOR, "screenshot"),
    GET_ROOT_WIDGET: createRPCMethod(RPCPrefix.INSPECTOR, "getRootWidget"),
    GET_WIDGET_TREE: createRPCMethod(RPCPrefix.INSPECTOR, "getRootWidgetTree"),
    GET_PROPERTIES: createRPCMethod(RPCPrefix.INSPECTOR, "getProperties"),
    GET_CHILDREN: createRPCMethod(RPCPrefix.INSPECTOR, "getChildren"),
    SET_SELECTION_BY_ID: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "setSelectionById"
    ),
    GET_PARENT_CHAIN: createRPCMethod(RPCPrefix.INSPECTOR, "getParentChain"),
    GET_CHILDREN_SUMMARY_TREE: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "getChildrenSummaryTree"
    ),
    GET_CHILDREN_DETAILS_SUBTREE: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "getChildrenDetailsSubtree"
    ),
    GET_ROOT_WIDGET_SUMMARY_TREE: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "getRootWidgetSummaryTree"
    ),
    GET_ROOT_WIDGET_SUMMARY_TREE_WITH_PREVIEWS: createRPCMethod(
      RPCPrefix.INSPECTOR,
      "getRootWidgetSummaryTreeWithPreviews"
    ),
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
          name: "debug_dump_semantics_tree_inverse",
          description:
            "RPC: Dump the semantics tree in inverse hit test order (ext.flutter.debugDumpSemanticsTreeInInverseHitTestOrder)",
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
        {
          name: "debug_disable_physical_shape_layers",
          description:
            "RPC: Toggle physical shape layers debugging (ext.flutter.debugDisablePhysicalShapeLayers)",
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
                  "Whether to enable or disable physical shape layers",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "debug_disable_opacity_layers",
          description:
            "RPC: Toggle opacity layers debugging (ext.flutter.debugDisableOpacityLayers)",
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
                description: "Whether to enable or disable opacity layers",
              },
            },
            required: ["enabled"],
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
        {
          name: "inspector_track_rebuild_dirty_widgets",
          description:
            "RPC: Track widget rebuilds to identify performance issues (ext.flutter.inspector.trackRebuildDirtyWidgets)",
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
                description: "Whether to enable or disable rebuild tracking",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "inspector_set_selection_by_id",
          description:
            "RPC: Set the selected widget by ID (ext.flutter.inspector.setSelectionById)",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              selectionId: {
                type: "string",
                description: "ID of the widget to select",
              },
            },
            required: ["selectionId"],
          },
        },
        {
          name: "inspector_get_parent_chain",
          description:
            "RPC: Get the parent chain for a widget (ext.flutter.inspector.getParentChain)",
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
                description: "ID of the widget to get parent chain for",
              },
            },
            required: ["objectId"],
          },
        },
        {
          name: "inspector_get_children_summary_tree",
          description:
            "RPC: Get the children summary tree for a widget (ext.flutter.inspector.getChildrenSummaryTree)",
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
                description:
                  "ID of the widget to get children summary tree for",
              },
            },
            required: ["objectId"],
          },
        },
        {
          name: "inspector_get_children_details_subtree",
          description:
            "RPC: Get the children details subtree for a widget (ext.flutter.inspector.getChildrenDetailsSubtree)",
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
                description:
                  "ID of the widget to get children details subtree for",
              },
            },
            required: ["objectId"],
          },
        },
        {
          name: "inspector_get_root_widget_summary_tree",
          description:
            "RPC: Get the root widget summary tree (ext.flutter.inspector.getRootWidgetSummaryTree)",
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
          name: "inspector_get_root_widget_summary_tree_with_previews",
          description:
            "RPC: Get the root widget summary tree with previews from the Flutter app. This provides a hierarchical view of the widget tree with preview information.",
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
          name: "inspector_get_details_subtree",
          description:
            "RPC: Get the details subtree for a widget. This provides detailed information about the widget and its descendants.",
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
                description: "ID of the widget to get details for",
              },
            },
            required: ["objectId"],
          },
        },
        {
          name: "inspector_get_selected_widget",
          description:
            "RPC: Get information about the currently selected widget in the Flutter app.",
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
          name: "inspector_get_selected_summary_widget",
          description:
            "RPC: Get summary information about the currently selected widget in the Flutter app.",
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
          name: "inspector_is_widget_creation_tracked",
          description:
            "RPC: Check if widget creation tracking is enabled in the Flutter app.",
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
        {
          name: "flutter_core_platform_override",
          description: "RPC: Override the platform for the Flutter app",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              platform: {
                type: "string",
                description:
                  "Platform to override to (android, ios, fuchsia, linux, macOS, windows, or null to reset)",
                enum: [
                  "android",
                  "ios",
                  "fuchsia",
                  "linux",
                  "macOS",
                  "windows",
                  null,
                ],
              },
            },
            required: ["platform"],
          },
        },
        {
          name: "flutter_core_brightness_override",
          description: "RPC: Override the brightness for the Flutter app",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              brightness: {
                type: "string",
                description:
                  "Brightness to override to (light, dark, or null to reset)",
                enum: ["light", "dark", null],
              },
            },
            required: ["brightness"],
          },
        },
        {
          name: "flutter_core_time_dilation",
          description:
            "RPC: Set the time dilation factor for animations in the Flutter app",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              dilation: {
                type: "number",
                description:
                  "Time dilation factor (1.0 is normal speed, >1.0 is slower, <1.0 is faster)",
                minimum: 0,
              },
            },
            required: ["dilation"],
          },
        },
        {
          name: "flutter_core_evict",
          description: "RPC: Evict an asset from the Flutter app's cache",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              asset: {
                type: "string",
                description: "Asset path to evict from the cache",
              },
            },
            required: ["asset"],
          },
        },
        {
          name: "flutter_core_profile_platform_channels",
          description: "RPC: Enable or disable profiling of platform channels",
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
                  "Whether to enable or disable platform channel profiling",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "debug_disable_clip_layers",
          description:
            "RPC: Toggle disabling of clip layers in the Flutter app",
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
                description: "Whether to enable or disable clip layers",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "debug_disable_physical_shape_layers",
          description:
            "RPC: Toggle physical shape layers debugging (ext.flutter.debugDisablePhysicalShapeLayers)",
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
                  "Whether to enable or disable physical shape layers",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "debug_disable_opacity_layers",
          description:
            "RPC: Toggle opacity layers debugging (ext.flutter.debugDisableOpacityLayers)",
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
                description: "Whether to enable or disable opacity layers",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "repaint_rainbow",
          description:
            "RPC: Toggle repaint rainbow debugging (ext.flutter.repaintRainbow)",
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
                  "Whether to enable or disable repaint rainbow debugging",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "inspector_structured_errors",
          description:
            "RPC: Enable or disable structured error reporting in the Flutter app.",
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
                  "Whether to enable or disable structured error reporting",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "inspector_show",
          description:
            "RPC: Show specific widget details in the Flutter app inspector.",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              options: {
                type: "object",
                description: "Options for showing widget details",
                properties: {
                  objectId: {
                    type: "string",
                    description: "ID of the widget to show",
                  },
                  groupName: {
                    type: "string",
                    description: "Optional group name for the widget",
                  },
                  subtreeDepth: {
                    type: "number",
                    description: "Optional depth to show the widget subtree",
                  },
                },
                required: ["objectId"],
              },
            },
            required: ["options"],
          },
        },
        {
          name: "inspector_widget_location_id_map",
          description:
            "RPC: Get a mapping of widget IDs to their source code locations (ext.flutter.inspector.widgetLocationIdMap)",
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
          name: "inspector_track_repaint_widgets",
          description:
            "RPC: Track widget repaints to identify rendering performance issues (ext.flutter.inspector.trackRepaintWidgets)",
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
                description: "Whether to enable or disable repaint tracking",
              },
            },
            required: ["enabled"],
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
