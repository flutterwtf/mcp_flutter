import { RPCPrefix } from "../types/types.js";
import { createRPCMethod } from "./flutter_rpc_methods.js";

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
