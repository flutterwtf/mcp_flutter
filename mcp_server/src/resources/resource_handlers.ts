import { type Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ResourceContents,
} from "@modelcontextprotocol/sdk/types.js";
import {
  TREE_RESOURCES,
  TREE_RESOURCES_TEMPLATES,
} from "./widget_tree_resources.js";

export class ResourcesHandlers {
  public setHandlers(server: Server): void {
    // List available resources when clients request them
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resourceTemplates: [...TREE_RESOURCES_TEMPLATES],
        resources: [...TREE_RESOURCES],
      };
    });
    // Return resource content when clients request it
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return this.handleRead(request.params.uri);
    });
  }

  async handleRead(uri: string): Promise<ResourceContents> {
    const parsedUri = this.parseUri(uri);
    return {
      contents: [
        {
          uri: uri,
          text:
            "Hello, World! This is my first MCP resource. Parsed URI: " +
            JSON.stringify(parsedUri),
        },
      ],
    };
    // switch (parsedUri.type) {
    //   case "root":
    //     // return this.handleRootNode();
    //   case "node":
    //     // return this.handleNode(parsedUri.nodeId);
    //   case "children":
    //     // return this.handleChildren(parsedUri.nodeId);
    //   case "errors":
    //     // return this.handleErrors();
    //   case "view":
    //     // return this.handleview();
    //   default:
    //     throw new McpError(ErrorCode.MethodNotFound, `Unsupported resource URI: ${uri}`);
    // }
  }

  private parseUri(uri: string): {
    type: "root" | "node" | "children" | "errors" | "view" | "info" | "unknown";
    appId?: string;
    nodeId?: string;
  } {
    // Parse visual://{app_id}/tree/root format
    const match = uri.match(/^visual:\/\/([^\/]+)\/(?:tree|visual)\/(.+)$/);
    if (!match) {
      return { type: "unknown", appId: "unknown" };
      // throw new McpError(
      //   ErrorCode.MethodNotFound,
      //   `Invalid resource URI format: ${uri}`
      // );
    }

    const [_, appId, path] = match;

    if (path === "root") {
      return { type: "root", appId };
    } else if (path.startsWith("node/")) {
      return { type: "node", appId, nodeId: path.split("/")[1] };
    } else if (path.startsWith("children/")) {
      return { type: "children", appId, nodeId: path.split("/")[1] };
    } else if (path === "errors") {
      return { type: "errors", appId };
    } else if (path === "view") {
      return { type: "view", appId };
    } else if (path === "info") {
      return { type: "info", appId };
    }
    return { type: "unknown", appId };

    // throw new McpError(
    //   ErrorCode.MethodNotFound,
    //   `Unsupported resource path: ${path}`
    // );
  }
}
