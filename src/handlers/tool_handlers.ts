import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { FlutterRPCClient } from "../rpc/flutter_rpc.js";
import { UtilitiesRPC } from "../rpc/utilities_rpc.js";

export interface ToolRequest {
  name: string;
  parameters: Record<string, unknown>;
}

export interface ToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

export abstract class BaseToolHandler {
  constructor(
    protected flutterRPC: FlutterRPCClient,
    protected utilitiesRPC: UtilitiesRPC
  ) {}

  abstract handleListTools(): Promise<{ tools: Tool[] }>;
  abstract handleCallTool(request: ToolRequest): Promise<ToolResponse>;

  protected wrapResponse(promise: Promise<unknown>): Promise<ToolResponse> {
    return promise
      .then((result) => ({
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      }))
      .catch((error: Error) => ({
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      }));
  }
}
