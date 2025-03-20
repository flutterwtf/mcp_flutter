import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import { fileURLToPath } from "url";
import { CommandLineConfig } from "../index.js";
import { LogLevel } from "../types/types.js";
import { createCustomRpcHandlerMap } from "./create_custom_rpc_handler_map.js";
import { createRpcHandlerMap } from "./create_rpc_handler_map.generated.js";
import { FlutterRpcHandlers } from "./flutter_rpc_handlers.generated.js";
import { RpcUtilities } from "./rpc_utilities.js";

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FlutterInspectorServer {
  private server: Server;
  private port: number;
  private logLevel: LogLevel;
  private rpcUtils: RpcUtilities;

  constructor(args: CommandLineConfig) {
    this.port = args.port;
    this.logLevel = args.logLevel;
    this.rpcUtils = new RpcUtilities(this.logLevel);

    this.server = new Server(
      {
        name: "flutter-inspector",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => this.log("error", "[MCP Error]", error);

    process.on("SIGINT", async () => {
      await this.rpcUtils.closeAllConnections();
      await this.server.close();
      process.exit(0);
    });
  }

  private log(level: LogLevel, ...args: unknown[]) {
    this.rpcUtils.log(level, ...args);
  }

  private setupToolHandlers() {
    const serverToolsFlutterPath = path.join(
      __dirname,
      "server_tools_flutter.yaml"
    );
    const serverToolsCustomPath = path.join(
      __dirname,
      "server_tools_custom.yaml"
    );
    try {
      // Load tools configuration
      const serverToolsFlutter = this.rpcUtils.loadYamlConfig(
        serverToolsFlutterPath
      );
      const serverToolsCustom = this.rpcUtils.loadYamlConfig(
        serverToolsCustomPath
      );

      this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [...serverToolsFlutter.tools, ...serverToolsCustom.tools],
      }));

      const rpcHandlers = new FlutterRpcHandlers(this.rpcUtils);

      // Use the generated function to create the handler map
      const handlerMap = createRpcHandlerMap(rpcHandlers, (request) =>
        this.rpcUtils.handlePortParam(request)
      );

      // Get custom handlers
      const customHandlerMap = createCustomRpcHandlerMap(
        this.rpcUtils,
        (request) => this.rpcUtils.handlePortParam(request)
      );

      this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const toolName = request.params.name;

        // Check generated handlers first
        if (handlerMap[toolName]) {
          return handlerMap[toolName](request);
        }

        // Then check custom handlers
        if (customHandlerMap[toolName]) {
          return customHandlerMap[toolName](request);
        }

        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      });
    } catch (error) {
      this.log("error", "Error setting up tool handlers:", error);
      throw error;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.log(
      "info",
      `Flutter Inspector MCP server running on stdio, port ${this.port}`
    );
  }
}
