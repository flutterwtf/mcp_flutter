import { IsolateInfo, IsolateResponse, VMInfo } from "../types/types.js";
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
  rpcUtils: RpcUtilities,
  handlePortParam: (request: any) => number
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
    get_extension_rpcs: async (request: any) => {
      const port = handlePortParam(request);
      const { isolateId, isRawResponse = false } =
        (request.params.arguments as {
          isolateId?: string;
          isRawResponse?: boolean;
        }) || {};

      const vmInfo = (await rpcUtils.invokeFlutterMethod(
        port,
        "getVM"
      )) as VMInfo;
      const isolates = vmInfo.isolates;

      if (isolateId) {
        const isolate = (await rpcUtils.invokeFlutterMethod(
          port,
          "getIsolate",
          {
            isolateId,
          }
        )) as IsolateResponse;

        if (isRawResponse) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(isolate, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(isolate.extensionRPCs || [], null, 2),
            },
          ],
        };
      }

      if (isRawResponse) {
        const allIsolates = await Promise.all(
          isolates.map((isolateRef: IsolateInfo) =>
            rpcUtils.invokeFlutterMethod(port, "getIsolate", {
              isolateId: isolateRef.id,
            })
          )
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(allIsolates, null, 2),
            },
          ],
        };
      }

      const allExtensions: string[] = [];
      for (const isolateRef of isolates) {
        const isolate = (await rpcUtils.invokeFlutterMethod(
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
    },
  };
}
