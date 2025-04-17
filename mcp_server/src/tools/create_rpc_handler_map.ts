import { Request, Result } from "@modelcontextprotocol/sdk/types.js";
import {
  FlutterRpcHandlers,
  rpcToolConfigs,
  RpcToolName,
} from "./flutter_rpc_handlers.generated.js";

/**
 * Generated createRpcHandlerMap method for the FlutterInspectorServer class.
 */
export function createRpcHandlerMap(
  rpcHandlers: FlutterRpcHandlers
): Record<RpcToolName, ((request: Request) => Promise<Result>) | undefined> {
  return Object.fromEntries(
    Object.keys(rpcToolConfigs).map((toolName) => [
      toolName,
      (request: Request) =>
        rpcHandlers.handleToolRequest(toolName as RpcToolName, request),
    ])
  ) as unknown as Record<RpcToolName, (request: Request) => Promise<Result>>;
}
