import { type Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  ResourceContents,
} from "@modelcontextprotocol/sdk/types.js";
import { RpcUtilities } from "../servers/rpc_utilities.js";
import { FlutterRpcHandlers } from "../tools/flutter_rpc_handlers.generated.js";
import {
  TREE_RESOURCES,
  TREE_RESOURCES_TEMPLATES,
} from "./widget_tree_resources.js";

type AppErrorsResponse = {
  message: string;
  errors: unknown[];
};
type ResourceType =
  | "root"
  | "node"
  | "parent"
  | "children"
  | "app_errors"
  | "view"
  | "info"
  | "unknown";

export class ResourcesHandlers {
  public setHandlers(
    server: Server,
    rpcUtils: RpcUtilities,
    rpcToolHandlers: FlutterRpcHandlers
  ): void {
    // List available resources when clients request them
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [...TREE_RESOURCES],
      };
    });
    // List available resource templates when clients request them
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      return { resourceTemplates: [...TREE_RESOURCES_TEMPLATES] };
    });
    // Return resource content when clients request it
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return this.handleRead(request.params.uri, rpcUtils, rpcToolHandlers);
    });
  }
  _test = true;
  async handleRead(
    uri: string,
    rpcUtils: RpcUtilities,
    rpcToolHandlers: FlutterRpcHandlers
  ): Promise<ResourceContents> {
    const parsedUri = this.parseUri(uri);
    // if (this._test) {
    //   return {
    //     contents: [
    //       {
    //         uri: uri,
    //         text: "HOHOHO",
    //         json: {
    //           test: "test",
    //         },
    //       },
    //     ],
    //   };
    // }
    try {
      switch (parsedUri.type) {
        case "root":
          const rootResult = await rpcToolHandlers.handleToolRequest(
            "inspector_get_root_widget",
            {}
          );
          return {
            contents: rootResult.content.map((content) => ({
              uri: uri,
              json: JSON.parse(content.text)?.data?.result,
              mimeType: "application/json",
            })),
          };

        case "node":
          if (!parsedUri.nodeId) {
            throw new McpError(ErrorCode.InvalidParams, "Node ID is required");
          }
          const nodeResult = await rpcUtils.callFlutterExtension(
            "ext.flutter.inspector.getProperties",
            {
              objectId: parsedUri.nodeId,
            }
          );
          return {
            contents: [
              {
                uri: uri,
                json: nodeResult,
                mimeType: "application/json",
              },
            ],
          };

        case "parent":
          if (!parsedUri.nodeId) {
            throw new McpError(ErrorCode.InvalidParams, "Node ID is required");
          }
          const parentResult = await rpcUtils.callFlutterExtension(
            "ext.flutter.inspector.getParentChain",
            {
              objectId: parsedUri.nodeId,
            }
          );
          return {
            contents: [
              {
                uri: uri,
                json: parentResult,
                mimeType: "application/json",
              },
            ],
          };

        case "children":
          if (!parsedUri.nodeId) {
            throw new McpError(ErrorCode.InvalidParams, "Node ID is required");
          }
          const childrenResult = await rpcUtils.callFlutterExtension(
            "ext.flutter.inspector.getChildrenDetailsSubtree",
            {
              objectId: parsedUri.nodeId,
            }
          );
          return {
            contents: [
              {
                uri: uri,
                json: childrenResult,
                mimeType: "application/json",
              },
            ],
          };

        case "app_errors":
          try {
            const appErrorsResult = await rpcUtils.callFlutterExtension(
              "ext.mcpdevtools.getAppErrors",
              {
                count: parsedUri.count,
              }
            );
            const errorsListJson = appErrorsResult?.data as AppErrorsResponse;

            const errorsList = errorsListJson?.errors ?? [];
            return {
              contents:
                errorsList.length == 0
                  ? [
                      {
                        uri: uri,
                        text: errorsListJson.message,
                        mimeType: "text/plain",
                      },
                    ]
                  : [
                      {
                        uri: uri,
                        text: errorsListJson.message,
                        json: errorsList,
                        mimeType: "application/json",
                      },
                    ],
            };
          } catch (error) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to get app errors: ${error}`
            );
          }

        case "view":
          const viewResult = await rpcUtils.callFlutterExtension(
            "ext.flutter.inspector.getRootWidgetSummaryTreeWithPreviews",
            {
              includeProperties: true,
              subtreeDepth: -1,
            }
          );
          return {
            contents: [
              {
                uri: uri,
                json: viewResult,
                mimeType: "application/json",
              },
            ],
          };

        case "info":
          const infoResult = await rpcUtils.callFlutterExtension(
            "ext.flutter.inspector.isWidgetTreeReady",
            {}
          );
          return {
            contents: [
              {
                uri: uri,
                json: infoResult,
                mimeType: "application/json",
              },
            ],
          };

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unsupported resource URI: ${uri}`
          );
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to handle resource request: ${error}`
      );
    }
  }

  private parseUri(uri: string): {
    type: ResourceType;
    appId?: string;
    nodeId?: string;
    count?: number;
  } {
    try {
      const parsedUri = new URL(uri);

      if (parsedUri.protocol !== "visual:") {
        return { type: "unknown", appId: "unknown" };
      }

      const appId = parsedUri.host;
      const pathParts = parsedUri.pathname.split("/").filter(Boolean);

      if (pathParts.length < 2) {
        return { type: "unknown", appId };
      }

      const [category, action, ...rest] = pathParts;

      switch (category) {
        case "tree":
          if (action === "root") {
            return { type: "root", appId };
          } else if (["node", "parent", "children"].includes(action)) {
            return {
              type: action as ResourceType,
              appId,
              nodeId: rest[0],
            };
          }
          break;

        case "app":
          if (action === "errors") {
            return {
              type: "app_errors",
              appId,
              count: rest.includes("latest") ? 1 : 10,
            };
          }
          break;

        case "view":
          if (action === "info") {
            return { type: "info", appId };
          }
          return { type: "view", appId };
      }

      return { type: "unknown", appId };
    } catch (e) {
      return { type: "unknown", appId: "unknown" };
    }
  }
}
