import { ErrorCode, McpError, Tool } from "@modelcontextprotocol/sdk/types.js";
import { FlutterRPC } from "../rpc/flutter_rpc.js";
import { BaseToolHandler, ToolRequest, ToolResponse } from "./tool_handlers.js";

export class FlutterToolHandler extends BaseToolHandler {
  async handleListTools(): Promise<{ tools: Tool[] }> {
    // Return list of Flutter-specific tools
    return {
      tools: [
        {
          name: "debug_dump_render_tree",
          description: "Dump the render tree",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description: "Port number where Flutter app is running",
              },
            },
          },
        },
        // Add more Flutter tools here
      ],
    };
  }

  async handleCallTool(request: ToolRequest): Promise<ToolResponse> {
    const { name, parameters } = request;
    const port = (parameters.port as number) || 8181;

    switch (name) {
      case "debug_dump_render_tree":
        await this.utilitiesRPC.verifyFlutterDebugMode(port);
        return this.wrapResponse(
          this.flutterRPC.invokeFlutterExtension(
            port,
            FlutterRPC.Debug.DUMP_RENDER_TREE
          )
        );

      case "debug_dump_layer_tree":
        await this.utilitiesRPC.verifyFlutterDebugMode(port);
        return this.wrapResponse(
          this.flutterRPC.invokeFlutterExtension(
            port,
            FlutterRPC.Debug.DUMP_LAYER_TREE
          )
        );

      case "debug_dump_semantics_tree":
        await this.utilitiesRPC.verifyFlutterDebugMode(port);
        return this.wrapResponse(
          this.flutterRPC.invokeFlutterExtension(
            port,
            FlutterRPC.Debug.DUMP_SEMANTICS
          )
        );

      case "debug_dump_semantics_tree_inverse":
        await this.utilitiesRPC.verifyFlutterDebugMode(port);
        return this.wrapResponse(
          this.flutterRPC.invokeFlutterExtension(
            port,
            FlutterRPC.Debug.DUMP_SEMANTICS_INVERSE
          )
        );

      case "debug_paint_baselines_enabled":
        await this.utilitiesRPC.verifyFlutterDebugMode(port);
        return this.wrapResponse(
          this.flutterRPC.invokeFlutterExtension(
            port,
            FlutterRPC.Debug.DEBUG_PAINT_BASELINES,
            {
              enabled: parameters.enabled as boolean,
            }
          )
        );

      case "debug_dump_focus_tree":
        await this.utilitiesRPC.verifyFlutterDebugMode(port);
        return this.wrapResponse(
          this.flutterRPC.invokeFlutterExtension(
            port,
            FlutterRPC.Debug.DUMP_FOCUS_TREE
          )
        );

      // Add more Flutter tool handlers

      default:
        throw new McpError(ErrorCode.InvalidRequest, `Unknown tool: ${name}`);
    }
  }
}
