import { ErrorCode, McpError, Tool } from "@modelcontextprotocol/sdk/types.js";
import { BaseToolHandler, ToolRequest, ToolResponse } from "./tool_handlers.js";

export class UtilityToolHandler extends BaseToolHandler {
  async handleListTools(): Promise<{ tools: Tool[] }> {
    // Return list of utility tools
    return {
      tools: [
        {
          name: "get_active_ports",
          description: "Get list of active Flutter debug ports",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "get_supported_protocols",
          description: "Get supported protocols from Flutter app",
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
        {
          name: "get_vm_info",
          description: "Get VM information from Flutter app",
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
        // Add more utility tools
      ],
    };
  }

  async handleCallTool(request: ToolRequest): Promise<ToolResponse> {
    const { name, parameters } = request;
    const port = (parameters.port as number) || 8181;

    switch (name) {
      case "get_active_ports":
        return this.wrapResponse(this.utilitiesRPC.getActivePorts());

      case "get_supported_protocols":
        return this.wrapResponse(this.utilitiesRPC.getSupportedProtocols(port));

      case "get_vm_info":
        return this.wrapResponse(this.utilitiesRPC.getVMInfo(port));

      default:
        throw new McpError(ErrorCode.InvalidRequest, `Unknown tool: ${name}`);
    }
  }
  wrapResponse(arg0: any): any {
    throw new Error("Method not implemented.");
  }
}
