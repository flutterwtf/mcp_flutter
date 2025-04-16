import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "flutter_mcp_forwarding_server";
import path from "path";
import { fileURLToPath } from "url";
import { Env } from "../index.js";
import { ResourcesHandlers } from "../resources/resource_handlers.js";
import { RpcUtilities } from "../servers/rpc_utilities.js";
import { createCustomRpcHandlerMap } from "./create_custom_rpc_handler_map.js";
import { createRpcHandlerMap } from "./create_rpc_handler_map.js";
import {
  FlutterRpcHandlers,
  RpcToolName,
} from "./flutter_rpc_handlers.generated.js";

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ToolsHandlers {
  public setHandlers(
    server: Server,
    rpcUtils: RpcUtilities,
    logger: Logger,
    rpcHandlers: FlutterRpcHandlers,
    resourcesHandlers: ResourcesHandlers
  ) {
    const serverToolsFlutterPath = path.join(
      __dirname,
      "server_tools_flutter.yaml"
    );
    const serverToolsCustomPath = path.join(
      __dirname,
      "server_tools_custom.yaml"
    );
    // Load tools configuration
    const serverToolsFlutter: { tools: Tool[] } = rpcUtils.loadYamlConfig(
      serverToolsFlutterPath
    );
    const serverToolsCustom: { tools: Tool[] } = rpcUtils.loadYamlConfig(
      serverToolsCustomPath
    );
    const toolSchemes: Tool[] = [
      ...serverToolsFlutter.tools,
      ...serverToolsCustom.tools,
      ...resourcesHandlers.getToolSchemes(rpcUtils),
    ];

    const filteredToolSchemes = toolSchemes.filter((tool) => {
      if (rpcUtils.args.env === Env.Production && !tool.name.includes("dump")) {
        return true;
      }
      if (rpcUtils.args.env === Env.Development) {
        return true;
      }
      return false;
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: filteredToolSchemes,
      };
    });

    // Use the generated function to create the handler map
    const handlerMap = createRpcHandlerMap(rpcHandlers);

    // Get custom handlers
    const customHandlerMap = createCustomRpcHandlerMap(
      rpcUtils,
      logger,
      (request, connectionDestination) =>
        rpcUtils.handlePortParam(request, connectionDestination)
    );
    const customResourceHandlerMap = resourcesHandlers.getTools(
      rpcUtils,
      rpcHandlers
    );

    server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const toolName = request.params.name;
      const generatedHandler: ((request: any) => Promise<unknown>) | undefined =
        handlerMap[toolName as RpcToolName];
      // Check generated handlers first
      if (generatedHandler) return generatedHandler(request);

      // Then check custom handlers
      if (customHandlerMap[toolName]) {
        return customHandlerMap[toolName](request);
      }

      if (customResourceHandlerMap[toolName]) {
        return customResourceHandlerMap[toolName](request);
      }

      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`
      );
    });
  }
}
