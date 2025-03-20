import { RpcUtilities } from "./rpc_utilities.js";

// Define a type for the handler function
type RpcHandler = (request: any) => Promise<any>;

// Define a type for the handler map with an index signature
interface CustomRpcHandlerMap {
  [key: string]: RpcHandler;
}

/**
 * Creates a map of custom RPC handlers that aren't part of the generated handlers
 */
export function createCustomRpcHandlerMap(
  rpcUtils: RpcUtilities
): CustomRpcHandlerMap {
  return {
    get_active_ports: async () => {
      const ports = await rpcUtils.getActivePorts();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(ports, null, 2),
          },
        ],
      };
    },
  };
}
