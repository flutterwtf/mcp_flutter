import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Logger } from "flutter_mcp_forwarding_server";
import { CommandLineConfig } from "../index.js";
import { ResourcesHandlers } from "../resources/resource_handlers.js";
import { FlutterRpcHandlers } from "../tools/index.js";
import { ToolsHandlers } from "../tools/tools_handlers.js";
import { RpcUtilities } from "./rpc_utilities.js";

export class FlutterInspectorServer {
  // Declare server with any type to work around type issues
  private server: McpServer;
  private port: number;
  private rpcUtils: RpcUtilities;
  private logger: Logger;
  private resources = new ResourcesHandlers();
  private tools = new ToolsHandlers();
  constructor(private readonly args: CommandLineConfig) {
    this.port = args.port;
    this.server = new McpServer(
      {
        name: "flutter-inspector",
        version: "0.1.0",
      },
      {
        capabilities: {
          logging: {},
          tools: {},
          prompts: {},
          resources: {},
        },
      }
    );
    this.logger = new Logger(
      "flutter-inspector",
      args.logLevel,
      this.server.server
    );
    this.rpcUtils = new RpcUtilities(this.logger, this.args);

    this.setHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling() {
    this.server.server.onerror = (error: Error) =>
      this.logger.error("[MCP Error]", { error });

    process.on("SIGINT", async () => {
      await this.rpcUtils.closeAllConnections();
      await this.server.close();
      process.exit(0);
    });
  }

  private setHandlers() {
    try {
      const server = this.server.server;

      const rpcHandlers = new FlutterRpcHandlers(
        this.rpcUtils,
        (request, connectionDestination) =>
          this.rpcUtils.handlePortParam(request, connectionDestination)
      );
      this.resources.setHandlers(server);
      this.tools.setHandlers(server, this.rpcUtils, this.logger, rpcHandlers);
    } catch (error) {
      this.logger.error("Error setting up tool handlers:", { error });
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
      await this.rpcUtils.connect(this.args.dartVMPort, "dart-vm");
      await this.rpcUtils.connect(
        this.args.forwardingServerPort,
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
        RPC Server: Attempting to connect to ws://${this.args.dartVMHost}:${this.args.dartVMPort}/ws
        Forwarding Client: Attempting to connect to ws://${this.args.forwardingServerHost}:${this.args.forwardingServerPort}/forward
      `);
    } catch (error) {
      this.logger.error("Failed to start server:", { error });
      process.exit(1);
    }
  }
}
