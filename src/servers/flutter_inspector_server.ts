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
import { CommandLineArgs } from "../index.js";
import { LogLevel } from "../types/types.js";
import { createCustomRpcHandlerMap } from "./create_custom_rpc_handler_map.js";
import { createRpcHandlerMap } from "./create_rpc_handler_map.generated.js";
import { FlutterRpcHandlers } from "./flutter_rpc_handlers.generated.js";
import { Logger } from "./logger.js";
import { RpcServer } from "./rpc_server.js";
import { RpcUtilities } from "./rpc_utilities.js";

export const defaultDartVMPort = 8181;
export const defaultWebClientPort = 3334;

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FlutterInspectorServer {
  private server: Server;
  private port: number;
  private logLevel: LogLevel;
  private rpcUtils: RpcUtilities;
  private logger: Logger;
  private rpcServer: RpcServer | null = null;

  constructor(args: CommandLineArgs) {
    this.port = args.port;
    this.logLevel = args.logLevel;
    this.logger = new Logger(this.logLevel);
    this.rpcUtils = new RpcUtilities(args.host, this.logger);

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
    this.server.onerror = (error) => this.logger.error("[MCP Error]", error);

    process.on("SIGINT", async () => {
      await this.rpcUtils.closeAllConnections();
      await this.server.close();
      process.exit(0);
    });
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
        this.logger,
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
      this.logger.error("Error setting up tool handlers:", error);
      throw error;
    }
  }

  /**
   * Initialize the RPC server to accept connections from Dart clients
   */
  async initializeRpcServer(
    port: number = defaultWebClientPort
  ): Promise<void> {
    try {
      this.rpcServer = await this.rpcUtils.startRpcServer(port);
      this.logger.info(
        `RPC server for web clients initialized on port ${port}`
      );
    } catch (error) {
      this.logger.error("Failed to initialize RPC server:", error);
      throw error;
    }
  }

  /**
   * Get the list of connected Dart client IDs
   */
  getConnectedDartClients(): string[] {
    return this.rpcServer?.getConnectedClients() || [];
  }

  /**
   * Send a notification to all connected Dart clients
   */
  async broadcastToDartClients(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<Map<string, unknown>> {
    return await this.rpcUtils.broadcastToDartClients(method, params);
  }

  /**
   * Send a message to a specific Dart client
   */
  async sendToDartClient(
    clientId: string,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    return await this.rpcUtils.sendToDartClient(clientId, method, params);
  }

  async run() {
    // Start the RPC server for web clients
    await this.initializeRpcServer();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info(
      `Flutter Inspector MCP server running on stdio, port ${this.port}`
    );
  }
}
