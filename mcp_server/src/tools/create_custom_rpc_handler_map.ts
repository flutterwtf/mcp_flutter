import {
  CallToolRequest,
  CallToolResult,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "../logger.js";
import { execAsync, RpcUtilities } from "../servers/rpc_utilities.js";
import { DynamicToolRegistry } from "../services/dynamic_registry/dynamic_tool_registry.js";
import { FlutterPort, IsolateInfo } from "../types/types.js";

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
  handlePortParam: (request: CallToolRequest) => number,
  dynamicRegistry?: DynamicToolRegistry
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

    installTool: async (request: CallToolRequest): Promise<CallToolResult> => {
      if (!dynamicRegistry) {
        throw new McpError(
          ErrorCode.InternalError,
          "Dynamic registry not available"
        );
      }

      const {
        tool,
        sourceApp,
        dartVmPort = 8181,
      } = (request.params.arguments || {}) as {
        tool: any;
        sourceApp: string;
        dartVmPort?: number;
      };

      try {
        // Validate tool schema
        if (!tool.name || !tool.description) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Tool must have name and description"
          );
        }

        // Handle port changes
        dynamicRegistry.handlePortChange(sourceApp, dartVmPort);

        // Register the tool
        dynamicRegistry.registerTool(tool, sourceApp, dartVmPort);

        logger.info(
          `[InstallTool] Successfully registered tool: ${tool.name} from ${sourceApp}:${dartVmPort}`
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Tool '${tool.name}' installed successfully`,
                  toolName: tool.name,
                  sourceApp,
                  dartVmPort,
                  registeredAt: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error(`[InstallTool] Failed to install tool:`, { error });
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to install tool: ${error}`
        );
      }
    },

    installResource: async (
      request: CallToolRequest
    ): Promise<CallToolResult> => {
      if (!dynamicRegistry) {
        throw new McpError(
          ErrorCode.InternalError,
          "Dynamic registry not available"
        );
      }

      const {
        resource,
        sourceApp,
        dartVmPort = 8181,
      } = (request.params.arguments || {}) as {
        resource: any;
        sourceApp: string;
        dartVmPort?: number;
      };

      try {
        // Validate resource schema
        if (!resource.uri || !resource.name) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Resource must have uri and name"
          );
        }

        // Handle port changes
        dynamicRegistry.handlePortChange(sourceApp, dartVmPort);

        // Register the resource
        dynamicRegistry.registerResource(resource, sourceApp, dartVmPort);

        logger.info(
          `[InstallResource] Successfully registered resource: ${resource.uri} from ${sourceApp}:${dartVmPort}`
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Resource '${resource.name}' installed successfully`,
                  resourceUri: resource.uri,
                  sourceApp,
                  dartVmPort,
                  registeredAt: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error(`[InstallResource] Failed to install resource:`, {
          error,
        });
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to install resource: ${error}`
        );
      }
    },

    listDynamicRegistrations: async (
      request: CallToolRequest
    ): Promise<CallToolResult> => {
      if (!dynamicRegistry) {
        throw new McpError(
          ErrorCode.InternalError,
          "Dynamic registry not available"
        );
      }

      const { type = "all" } = (request.params.arguments || {}) as {
        type?: "tools" | "resources" | "all";
      };

      try {
        const stats = dynamicRegistry.getStats();
        const tools =
          type === "resources" ? [] : dynamicRegistry.getDynamicTools();
        const resources =
          type === "tools" ? [] : dynamicRegistry.getDynamicResources();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  statistics: stats,
                  tools: tools.map((tool) => ({
                    name: tool.name,
                    description: tool.description,
                    entry: dynamicRegistry.getToolEntry(tool.name),
                  })),
                  resources: resources.map((resource) => ({
                    uri: resource.uri,
                    name: resource.name,
                    description: resource.description,
                    entry: dynamicRegistry.getResourceEntry(resource.uri),
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        logger.error(
          `[ListDynamicRegistrations] Failed to list registrations:`,
          { error }
        );
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to list registrations: ${error}`
        );
      }
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
