import { type Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  ResourceContents,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { RpcUtilities } from "../servers/rpc_utilities.js";
import {
  FlutterRpcHandlers,
  RpcToolName,
} from "../tools/flutter_rpc_handlers.generated.js";
import { CustomRpcHandlerMap } from "../tools/index.js";
import {
  createTreeResources,
  TREE_RESOURCES_TEMPLATES,
} from "./widget_tree_resources.js";
const ToolNames = {
  getAppErrors: "ext.mcpdevtools.getAppErrors",
  getScreenshot: "ext.flutter.inspector.screenshot",
} as const;
type AppErrorsResponse = {
  message: string;
  errors: unknown[];
};
type ResourceType =
  | "root"
  | "node"
  | "parent"
  | "children"
  | "screenshot"
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
        resources: [...createTreeResources(rpcUtils)],
      };
    });
    // List available resource templates when clients request them
    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      return { resourceTemplates: [...TREE_RESOURCES_TEMPLATES] };
    });
    // Return resource content when clients request it
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return this.#handleRead(request.params.uri, rpcUtils, rpcToolHandlers);
    });
  }
  /**
   * Get the flutter application errors list.
   * @param count - The count of errors to get.
   * @param rpcUtils - The RPC utilities.
   * @returns The errors list.
   */
  async #getErrorsList(
    count: number | undefined,
    rpcUtils: RpcUtilities
  ): Promise<{
    errorsListJson: AppErrorsResponse;
    errorsList: unknown[];
  }> {
    const appErrorsResult = await rpcUtils.callFlutterExtension(
      ToolNames.getAppErrors as RpcToolName,
      {
        count: count ?? 4,
      }
    );
    const errorsListJson = appErrorsResult?.data as AppErrorsResponse;

    const errorsList = errorsListJson?.errors ?? [];

    return {
      errorsListJson,
      errorsList,
    };
  }

  async #handleRead(
    uri: string,
    rpcUtils: RpcUtilities,
    rpcToolHandlers: FlutterRpcHandlers
  ): Promise<ResourceContents> {
    const parsedUri = this.#parseUri(uri);
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
            uri: uri,
            contents: rootResult.content.map((content) => ({
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
            uri: uri,
            contents: [
              {
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
            uri: uri,
            contents: [
              {
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
            uri: uri,
            contents: [
              {
                json: childrenResult,
                mimeType: "application/json",
              },
            ],
          };

        case "app_errors":
          try {
            const { errorsListJson, errorsList } = await this.#getErrorsList(
              parsedUri.count,
              rpcUtils
            );
            return {
              uri: uri,
              contents:
                errorsList.length == 0
                  ? [
                      {
                        text: errorsListJson.message,
                        mimeType: "text/plain",
                      },
                    ]
                  : [
                      {
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
            uri: uri,
            contents: [
              {
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
            uri: uri,
            contents: [
              {
                json: infoResult,
                mimeType: "application/json",
              },
            ],
          };

        case "screenshot":
          const screenshotResult = await rpcToolHandlers.handleToolRequest(
            "inspector_screenshot",
            {}
          );
          const screenshotData = screenshotResult.content[0].text;
          return {
            uri: uri,
            contents: [
              {
                blob: screenshotData,
                mimeType: "image/png",
              },
            ],
          };
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to handle resource request for ${uri}`
      );
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
  /**
   * Parse the URI to get the resource type and parameters.
   * @param uri - The URI to parse.
   * @returns The resource type and parameters.
   */
  #parseUri(uri: string): {
    type: ResourceType;
    nodeId?: string;
    count?: number;
  } {
    try {
      const parsedUri = new URL(uri);

      if (parsedUri.protocol !== "visual:") {
        return { type: "unknown" };
      }

      const host = parsedUri.host;
      const pathParts = parsedUri.pathname.split("/").filter(Boolean);

      if (pathParts.length < 2) {
        return { type: "unknown" };
      }

      const [category, action, ...rest] = pathParts;

      switch (category) {
        case "tree":
          if (action === "root") {
            return { type: "root" };
          } else if (["node", "parent", "children"].includes(action)) {
            return {
              type: action as ResourceType,
              nodeId: rest[0],
            };
          }
          break;

        case "app":
          if (action === "errors") {
            let count: number;
            if (rest.includes("latest")) {
              count = 1;
            } else {
              const countParam = rest[rest.length - 1];
              count =
                countParam && !isNaN(parseInt(countParam))
                  ? parseInt(countParam)
                  : 10; // Default to 10 if not specified or invalid
            }
            return {
              type: "app_errors",
              count,
            };
          } else if (action === "screenshot") {
            return {
              type: "screenshot",
            };
          }
          break;

        case "view":
          if (action === "info") {
            return { type: "info" };
          }
          return { type: "view" };
      }

      return { type: "unknown" };
    } catch (e) {
      return { type: "unknown" };
    }
  }

  /**
   * Get the tools for the resources if resources are not supported.
   * @param rpcUtils - The RPC utilities.
   * @returns The tools.
   */
  getTools(
    rpcUtils: RpcUtilities,
    rpcToolHandlers: FlutterRpcHandlers
  ): CustomRpcHandlerMap {
    if (rpcUtils.args.areResourcesSupported) {
      return {};
    }
    const tools = <CustomRpcHandlerMap>{
      [ToolNames.getAppErrors]: async (request) => {
        const count = request.params.arguments.count;
        const { errorsListJson, errorsList } = await this.#getErrorsList(
          count,
          rpcUtils
        );
        return {
          content: [
            {
              type: "text",
              text: errorsListJson.message,
            },
            {
              type: "text",
              text: JSON.stringify(errorsList, null, 2),
            },
          ],
        };
      },
    };
    if (rpcUtils.args.areImagesSupported) {
      tools[ToolNames.getScreenshot] = async (request) => {
        const screenshotResult = await rpcToolHandlers.handleToolRequest(
          "inspector_screenshot",
          {}
        );
        return {
          content: [
            {
              type: "image",
              data: screenshotResult.content[0].text,
              mimeType: "image/png",
            },
          ],
        };
      };
    }
    return tools;
  }

  /**
   * Get the tool schemes for the resources if resources are not supported.
   * @param rpcUtils - The RPC utilities.
   * @returns The tool schemes.
   */
  getToolSchemes(rpcUtils: RpcUtilities): Tool[] {
    const screenshot = <Tool>{
      name: ToolNames.getScreenshot,
      description: "Get the screenshot of the app",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    };
    if (rpcUtils.args.areResourcesSupported) {
      return [];
    }
    const tools = <Tool[]>[
      {
        name: ToolNames.getAppErrors,
        description: "Get the errors of the app",
        inputSchema: {
          type: "object",
          properties: {
            count: {
              type: "number",
              description: "The count of errors to get. Ask no more then 4.",
            },
          },
          required: [],
        },
      },
    ];
    if (rpcUtils.args.areImagesSupported) {
      tools.push(screenshot);
    }
    return tools;
  }
}
