// GENERATED CODE - DO NOT MODIFY BY HAND
// This file is generated from server_tools_handler.yaml
// Run "npm run generate-rpc-handlers" to update

import { FlutterRpcHandlers } from "./flutter_rpc_handlers.generated.js";

/**
 * Generated createRpcHandlerMap method for the FlutterInspectorServer class.
 * 
 * @param rpcHandlers The FlutterRpcHandlers instance
 * @param handlePortParam A function to extract the port parameter from a request
 * @returns A mapping of tool names to handler functions
 */
export function createRpcHandlerMap(
  rpcHandlers: FlutterRpcHandlers,
  handlePortParam: (request: any) => number
): Record<string, any> {
  return {
    "get_widget_tree": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleGetWidgetTree(port);
    },
    "get_widget_details": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleGetWidgetDetails(port, params);
    },
    "toggle_debug_paint": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleToggleDebugPaint(port, params);
    },
    "get_extension_rpcs": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleGetExtensionRpcs(port, params);
    },
    "debug_dump_layer_tree": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleDebugDumpLayerTree(port);
    },
    "debug_dump_semantics_tree": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleDebugDumpSemanticsTree(port);
    },
    "debug_dump_semantics_tree_inverse": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleDebugDumpSemanticsTreeInverse(port);
    },
    "debug_paint_baselines_enabled": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleDebugPaintBaselinesEnabled(port, params);
    },
    "debug_dump_focus_tree": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleDebugDumpFocusTree(port);
    },
    "debug_disable_physical_shape_layers": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleDebugDisablePhysicalShapeLayers(port, params);
    },
    "debug_disable_opacity_layers": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleDebugDisableOpacityLayers(port, params);
    },
    "inspector_screenshot": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleInspectorScreenshot(port);
    },
    "inspector_get_layout_explorer_node": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleInspectorGetLayoutExplorerNode(port, params);
    },
    "inspector_track_rebuild_dirty_widgets": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleInspectorTrackRebuildDirtyWidgets(port, params);
    },
    "inspector_set_selection_by_id": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleInspectorSetSelectionById(port, params);
    },
    "inspector_get_parent_chain": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleInspectorGetParentChain(port, params);
    },
    "inspector_get_children_summary_tree": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleInspectorGetChildrenSummaryTree(port, params);
    },
    "inspector_get_details_subtree": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleInspectorGetDetailsSubtree(port, params);
    },
    "inspector_get_selected_widget": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleInspectorGetSelectedWidget(port);
    },
    "inspector_get_selected_summary_widget": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleInspectorGetSelectedSummaryWidget(port);
    },
    "inspector_is_widget_creation_tracked": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleInspectorIsWidgetCreationTracked(port);
    },
    "dart_io_socket_profiling_enabled": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleDartIoSocketProfilingEnabled(port, params);
    },
    "dart_io_http_enable_timeline_logging": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleDartIoHttpEnableTimelineLogging(port, params);
    },
    "dart_io_get_version": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleDartIoGetVersion(port);
    },
    "dart_io_get_open_files": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleDartIoGetOpenFiles(port);
    },
    "inspector_structured_errors": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleInspectorStructuredErrors(port, params);
    },
    "inspector_show": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleInspectorShow(port, params);
    },
  };
}
