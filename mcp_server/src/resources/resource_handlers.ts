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

  async handleRead(
    uri: string,
    rpcUtils: RpcUtilities,
    rpcToolHandlers: FlutterRpcHandlers
  ): Promise<ResourceContents> {
    const parsedUri = this.parseUri(uri);

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
            return {
              contents: [
                {
                  uri: uri,
                  json: appErrorsResult,
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
    // Parse visual://[host]/tree/root format
    const match = uri.match(/^visual:\/\/([^\/]+)\/(?:tree|view|app)\/(.+)$/);
    if (!match) {
      return { type: "unknown", appId: "unknown" };
    }

    const [_, appId, path] = match;

    if (path === "root") {
      return { type: "root", appId };
    } else if (path.startsWith("node/")) {
      return { type: "node", appId, nodeId: path.split("/")[1] };
    } else if (path.startsWith("parent/")) {
      return { type: "parent", appId, nodeId: path.split("/")[1] };
    } else if (path.startsWith("children/")) {
      return { type: "children", appId, nodeId: path.split("/")[1] };
    } else if (path.startsWith("app/errors/")) {
      return {
        type: "app_errors",
        appId,
        count: (() => {
          switch (path) {
            case "app/errors/latest":
              return 1;
            case "app/errors/ten":
              return 10;
            default:
              return 10;
          }
        })(),
      };
    } else if (path === "info") {
      return { type: "info", appId };
    } else if (path.startsWith("view/")) {
      return { type: "view", appId };
    }

    return { type: "unknown", appId };
  }
}
