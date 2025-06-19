import {
  CallToolRequest,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "../logger.js";
import { execAsync, RpcUtilities } from "../servers/rpc_utilities.js";
import { FlutterPort, IsolateInfo } from "../types/types.js";

interface FlutterExtensionResponse {
  data: {
    message: string;
    [key: string]: unknown;
  };
}

// Define a type for the handler function
export type RpcHandler = (request: any) => Promise<CallToolResult>;

// Define a type for the handler map with an index signature
export interface CustomRpcHandlerMap {
  [key: string]: RpcHandler;
}

/**
 * Creates a map of custom RPC handlers that aren't part of the generated handlers
 * All handlers route through Dart VM backend
 */
export function createCustomRpcHandlerMap(
  rpcUtils: RpcUtilities,
  logger: Logger,
  handlePortParam: (request: CallToolRequest) => number
): CustomRpcHandlerMap {
  return {
    test_custom_ext: async (request: CallToolRequest) => {
      const port = handlePortParam(request);
      const result = await rpcUtils.callDartVm({
        method: "ext.mcp.toolkit.app_errors",
        dartVmPort: port,
        params: {
          count: 10,
        },
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },

    tap_by_text: async (request: CallToolRequest) => {
      const port = handlePortParam(request);
      const searchText = request.params.arguments?.text || "Text";

      const result = await rpcUtils.callFlutterExtension("ext.mcp.call", {
        dartVmPort: port,
        params: {
          method: "tap_by_text",
          arguments: {
            text: searchText,
          },
        },
      });

      return {
          content: [
              {
                  type: "text",
                  text: `The click was performed by Text('${searchText}').\n\nResult:\n${JSON.stringify(
                      result,
                      null,
                      2
                  )}`,
              },
          ],
      };
    },

    enter_text_by_hint: async (request: CallToolRequest) => {
      const port = handlePortParam(request);
      const searchHint = request.params.arguments?.hint || "Email";
      const inputText = request.params.arguments?.text || "example@example.com";

      const result = await rpcUtils.callFlutterExtension("ext.mcp.call", {
        dartVmPort: port,
        params: {
          method: "enter_text_by_hint",
          arguments: {
            hint: request.params.arguments?.hint || "Email",
            text: request.params.arguments?.text || "example@example.com",
          },
        },
      });

      return {
          content: [
              {
                  type: "text",
                  text: `TextField with hint '${searchHint}' updated.\nText inserted: '${inputText}'.\n\nResult:\n${JSON.stringify(
                      result,
                      null,
                      2
                  )}`,
              },
          ],
      };
    },

    tap_by_semantic_label: async (request: CallToolRequest) => {
      const port = handlePortParam(request);
      const label = request.params.arguments?.label || "Increment";

      const result = await rpcUtils.callFlutterExtension("ext.mcp.call", {
        dartVmPort: port,
        params: {
          method: "tap_by_semantic_label",
          arguments: {
            label: label,
          },
        },
      });

      return {
        content: [
          {
            type: "text",
            text: `The click was performed by SemanticLabel('${label}').\n\nResult:\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    },

    tap_by_coordinate: async (request: CallToolRequest) => {
      const port = handlePortParam(request);
      const x = request.params.arguments?.x || 0;
      const y = request.params.arguments?.y || 0;

      const result = await rpcUtils.callFlutterExtension("ext.mcp.call", {
        dartVmPort: port,
        params: {
          method: "tap_by_coordinate",
          arguments: {
            x: x,
            y: y,
          },
        },
      });

      return {
        content: [
          {
            type: "text",
            text: `The click was performed at coordinate (${x}, ${y}).\n\nResult:\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    },

    get_vm: async (request: CallToolRequest) => {
      const port = handlePortParam(request);
      const vm = await rpcUtils.getVmInfo(port);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(vm, null, 2),
          },
        ],
      };
    },

    hot_reload_flutter: async (request: CallToolRequest) => {
      // Route through Dart VM (callFlutterExtension now uses Dart VM)
      const result = await rpcUtils.callFlutterExtension(
        "ext.mcpdevtools.hotReload",
        {
          force: request.params.arguments?.force ?? false,
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },

    get_active_ports: async () => {
      const ports = await _getActivePorts(logger);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(ports, null, 2),
          },
        ],
      };
    },

    get_extension_rpcs: async (request: CallToolRequest) => {
      const port = handlePortParam(request);
      const { isolateId, isRawResponse = false } =
        (request.params.arguments as {
          isolateId?: string;
          isRawResponse?: boolean;
        }) || {};

      const vmInfo = await rpcUtils.getVmInfo(port);
      const isolates = vmInfo.isolates;

      if (isolateId) {
        const isolate = await rpcUtils.getIsolate(port, isolateId);

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
            rpcUtils.getIsolate(port, isolateRef.id)
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
        const isolate = await rpcUtils.getIsolate(port, isolateRef.id);

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

    view_widget_tree: async (request: CallToolRequest) => {
      const port = handlePortParam(request);
      const includeRenderParams = request.params.arguments?.includeRenderParams || false;

      const result = await rpcUtils.callFlutterExtension("ext.mcp.call", {
        dartVmPort: port,
        params: {
          method: "view_widget_tree",
          arguments: {
            includeRenderParams: includeRenderParams
          },
        },
      });

      return {
        content: [
          {
            type: "text",
            text: `Widget tree structure retrieved successfully.\n\nResult:\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    },

    scroll_by_offset: async (request: CallToolRequest) => {
      const port = handlePortParam(request);
      const dx = request.params.arguments?.dx || 0;
      const dy = request.params.arguments?.dy || 0;
      const key = request.params.arguments?.key;
      const semanticLabel = request.params.arguments?.semanticLabel;
      const text = request.params.arguments?.text;

      const scrollArgs: any = {
        dx: dx,
        dy: dy,
      };
      
      if (key) scrollArgs.key = key;
      if (semanticLabel) scrollArgs.semanticLabel = semanticLabel;
      if (text) scrollArgs.text = text;

      const result = await rpcUtils.callFlutterExtension("ext.mcp.call", {
        dartVmPort: port,
        params: {
          method: "scroll_by_offset",
          arguments: scrollArgs,
        },
      });

      return {
        content: [
          {
            type: "text",
            text: `Scrolled by offset dx=${dx}, dy=${dy}.\n\nResult:\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    },

    get_navigation_stack: async (request: CallToolRequest) => {
      const port = handlePortParam(request);
      const result = await rpcUtils.callFlutterExtension("ext.mcp.call", {
        dartVmPort: port,
        params: {
          method: "get_navigation_stack",
          arguments: {},
        },
      });
      return {
        content: [
          {
            type: "text",
            text: `Navigation stack retrieved successfully.\n\nResult:\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    },

    get_navigation_tree: async (request: CallToolRequest) => {
      const port = handlePortParam(request);
      const result = await rpcUtils.callFlutterExtension("ext.mcp.call", {
        dartVmPort: port,
        params: {
          method: "get_navigation_tree",
          arguments: {},
        },
      });
      return {
        content: [
          {
            type: "text",
            text: `Navigation tree retrieved successfully.\n\nResult:\n${JSON.stringify(result, null, 2)}`,
          },
        ],
      };
    },
  };
}

/**
 * Get active ports for Flutter/Dart processes via system commands
 * This is a utility function that doesn't depend on backend type
 */
async function _getActivePorts(logger: Logger): Promise<FlutterPort[]> {
  try {
    const { stdout } = await execAsync("lsof -i -P -n | grep LISTEN");
    const ports: FlutterPort[] = [];
    const lines = stdout.split("\n");

    for (const line of lines) {
      if (
        line.toLowerCase().includes("dart") ||
        line.toLowerCase().includes("flutter")
      ) {
        const parts = line.split(/\s+/);
        const pid = parts[1];
        const command = parts[0];
        const addressPart = parts[8];
        const portMatch = addressPart.match(/:(\d+)$/);

        if (portMatch) {
          ports.push({
            port: parseInt(portMatch[1], 10),
            pid,
            command,
          });
        }
      }
    }

    return ports;
  } catch (error) {
    logger.error("Error getting active ports:", { error });
    return [];
  }
}
