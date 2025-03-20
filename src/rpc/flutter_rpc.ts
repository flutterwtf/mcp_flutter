import { WebSocket } from "ws";

// RPC method prefix definitions
export enum RPCPrefix {
  UI = "ext.ui.window",
  DART_IO = "ext.dart.io",
  FLUTTER = "ext.flutter",
  INSPECTOR = "ext.flutter.inspector",
  ISAR = "ext.isar",
}

// Type definitions for RPC responses
export interface FlutterMethodResponse {
  type?: string;
  result: unknown;
}

export interface WebSocketRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface WebSocketResponse {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface IsolateRef {
  id: string;
  name?: string;
  number?: string;
}

export interface VMInfo {
  isolates: IsolateRef[];
  uri?: string;
  version?: string;
  pid?: number;
}

export interface IsolateResponse {
  id: string;
  name?: string;
  number?: string;
  extensionRPCs?: string[];
  libraries?: Array<{
    uri: string;
    name?: string;
  }>;
}

// Helper function to create RPC method strings
export function createRPCMethod(prefix: RPCPrefix, method: string): string {
  return `${prefix}.${method}`;
}

// Group RPC methods by functionality
export const FlutterRPC = {
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
};

// Flutter RPC class to handle all Flutter-specific RPC methods
export class FlutterRPCClient {
  private wsConnections: Map<number, WebSocket> = new Map();
  private messageId = 0;
  private pendingRequests: Map<
    string,
    { resolve: Function; reject: Function; method: string }
  > = new Map();

  constructor(private logLevel: string = "info") {}

  private generateId(): string {
    return `${++this.messageId}`;
  }

  private log(level: string, ...args: any[]) {
    if (
      level === "error" ||
      (level === "warn" && this.logLevel !== "error") ||
      (level === "info" && ["error", "warn"].indexOf(this.logLevel) === -1) ||
      (level === "debug" && this.logLevel === "debug")
    ) {
      console[level](...args);
    }
  }

  async connectWebSocket(port: number): Promise<WebSocket> {
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

  async sendWebSocketRequest(
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

  async invokeFlutterMethod(
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

  async getFlutterIsolate(port: number): Promise<string> {
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

    throw new Error("No Flutter isolate found in the application");
  }

  async invokeFlutterExtension(
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
}
