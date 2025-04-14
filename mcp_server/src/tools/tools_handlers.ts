import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "flutter_mcp_forwarding_server";
import path from "path";
import { fileURLToPath } from "url";
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
    const serverToolsFlutter = rpcUtils.loadYamlConfig(serverToolsFlutterPath);
    const serverToolsCustom = rpcUtils.loadYamlConfig(serverToolsCustomPath);
    const toolSchemes = [
      ...serverToolsFlutter.tools,
      ...serverToolsCustom.tools,
    ];
    if (rpcUtils.args.areResourcesSupported) {
      toolSchemes.push(...resourcesHandlers.getToolSchemes(rpcUtils));
    }

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: toolSchemes,
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
    const customResourceHandlerMap = resourcesHandlers.getTools(rpcUtils);

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
