import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger, LogLevel } from "forwarding-server";
import path from "path";
import { fileURLToPath } from "url";
import { CommandLineArgs } from "../index.js";
import { createCustomRpcHandlerMap } from "./create_custom_rpc_handler_map.js";
import { createRpcHandlerMap } from "./create_rpc_handler_map.generated.js";
import { FlutterRpcHandlers } from "./flutter_rpc_handlers.generated.js";
import { RpcUtilities } from "./rpc_utilities.js";

export const defaultDartVMPort = 8181;
export const defaultMCPServerPort = 3535;
export const defaultForwardingServerPort = 8143;

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FlutterInspectorServer {
  // Declare server with any type to work around type issues
  private server: any; // Server<Request, Notification, Result>;
  private port: number;
  private logLevel: LogLevel;
  private rpcUtils: RpcUtilities;
  private logger: Logger;

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
    this.server.onerror = (error: Error) =>
      this.logger.error("[MCP Error]", error);

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

      this.server.setRequestHandler(
        CallToolRequestSchema,
        async (request: any) => {
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
        }
      );
    } catch (error) {
      this.logger.error("Error setting up tool handlers:", error);
      throw error;
    }
  }

  async run() {
    // 1. First initialize async resources
    const transport = new StdioServerTransport();

    // 2. Start servers in parallel with proper cleanup
    try {
      // Setup the transport first
      await this.server.connect(transport);

      // Now try to connect to the services - these connections are now resilient to failure
      await this.rpcUtils.connect(defaultDartVMPort, "dart-vm");
      await this.rpcUtils.connect(
        defaultForwardingServerPort,
        "flutter-extension"
      );

      // 3. Add coordinated shutdown
      const cleanup = async () => {
        await this.rpcUtils.closeAllConnections();
        await transport.close();
      };

      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      this.logger.info(`
        MCP Server: Ready on stdio (port ${this.port})
        RPC Server: Attempting to connect to ws://localhost:${defaultDartVMPort}/ws
        Forwarding Client: Attempting to connect to ws://localhost:${defaultForwardingServerPort}/forward
      `);
    } catch (error) {
      this.logger.error("Failed to start server:", error);
      process.exit(1);
    }
  }
}
