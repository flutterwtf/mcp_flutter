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
    "debug_dump_render_tree": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleDebugDumpRenderTree(port);
    },
    "inspector_get_properties": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleInspectorGetProperties(port, params);
    },
    "get_vm": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleGetVm(port);
    },
    "debug_set_debug_paint": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleDebugSetDebugPaint(port, params);
    },
    "inspector_get_root_widget_summary_tree": (request: any) => {
      const port = handlePortParam(request);
      const params = request.params.arguments;
      return rpcHandlers.handleInspectorGetRootWidgetSummaryTree(port, params);
    },
    "debug_dump_layer_tree": (request: any) => {
      const port = handlePortParam(request);
      
      return rpcHandlers.handleDebugDumpLayerTree(port);
    },
  };
}
