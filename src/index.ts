#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import * as dotenv from "dotenv";
import { promisify } from "util";
import WebSocket from "ws";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

// Load environment variables
dotenv.config();

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .options({
    port: {
      alias: "p",
      description: "Port to run the server on",
      type: "number",
      default: parseInt(process.env.PORT || "3334", 10),
    },
    stdio: {
      description: "Run in stdio mode instead of HTTP mode",
      type: "boolean",
      default: true,
    },
    "log-level": {
      description: "Logging level",
      choices: ["error", "warn", "info", "debug"] as const,
      default: process.env.LOG_LEVEL || "info",
    },
  })
  .help()
  .parseSync();

const execAsync = promisify(exec);

interface FlutterPort {
  port: number;
  pid: string;
  command: string;
}

interface IsolatesResponse {
  isolates: Array<{
    id: string;
    [key: string]: unknown;
  }>;
}

interface FlutterMethodResponse {
  type?: string;
  result: unknown;
}

interface WebSocketRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface WebSocketResponse {
  jsonrpc: "2.0";
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

type LogLevel = "error" | "warn" | "info" | "debug";

class FlutterInspectorServer {
  private server: Server;
  private port: number;
  private logLevel: LogLevel;
  private wsConnections: Map<number, WebSocket> = new Map();
  private pendingRequests: Map<
    string,
    { resolve: Function; reject: Function; method: string }
  > = new Map();
  private messageId = 0;

  constructor() {
    this.port = argv.port;
    this.logLevel = argv["log-level"] as LogLevel;

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

  private generateId(): string {
    return `${Date.now()}_${this.messageId++}`;
  }

  private async connectWebSocket(port: number): Promise<WebSocket> {
    if (this.wsConnections.has(port)) {
      const ws = this.wsConnections.get(port)!;
      if (ws.readyState === WebSocket.OPEN) {
        return ws;
      }
      this.wsConnections.delete(port);
    }

    return new Promise((resolve, reject) => {
      const wsUrl = `ws://localhost:${port}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        this.log("debug", `WebSocket connected to ${wsUrl}`);
        this.wsConnections.set(port, ws);
        resolve(ws);
      };

      ws.onerror = (error) => {
        this.log("error", `WebSocket error for ${wsUrl}:`, error);
        reject(error);
      };

      ws.onclose = () => {
        this.log("debug", `WebSocket closed for ${wsUrl}`);
        this.wsConnections.delete(port);
      };

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(
            event.data.toString()
          ) as WebSocketResponse;

          if (response.id) {
            const request = this.pendingRequests.get(response.id);
            if (request) {
              if (response.error) {
                request.reject(new Error(response.error.message));
              } else {
                request.resolve(response.result);
              }
              this.pendingRequests.delete(response.id);
            }
          }
        } catch (error) {
          this.log("error", "Error parsing WebSocket message:", error);
        }
      };
    });
  }

  private async sendWebSocketRequest(
    port: number,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    const ws = await this.connectWebSocket(port);
    const id = this.generateId();

    const request: WebSocketRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, method });
      ws.send(JSON.stringify(request));
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => this.log("error", "[MCP Error]", error);

    process.on("SIGINT", async () => {
      // Close all WebSocket connections
      for (const ws of this.wsConnections.values()) {
        ws.close();
      }
      await this.server.close();
      process.exit(0);
    });
  }

  private log(level: LogLevel, ...args: unknown[]) {
    const levels: LogLevel[] = ["error", "warn", "info", "debug"];
    if (levels.indexOf(level) <= levels.indexOf(this.logLevel)) {
      switch (level) {
        case "error":
          console.error(...args);
          break;
        case "warn":
          console.warn(...args);
          break;
        case "info":
          console.info(...args);
          break;
        case "debug":
          console.debug(...args);
          break;
      }
    }
  }

  private async getActivePorts(): Promise<FlutterPort[]> {
    try {
      const { stdout } = await execAsync("lsof -i -P -n | grep LISTEN");
      const ports: FlutterPort[] = [];
      const lines = stdout.split("\n");

      for (const line of lines) {
        if (
          line.toLowerCase().includes("dart") ||
          line.toLowerCase().includes("flutter")
        ) {
          const parts = line.split(/\s+/);
          const pid = parts[1];
          const command = parts[0];
          const addressPart = parts[8];
          const portMatch = addressPart.match(/:(\d+)$/);

          if (portMatch) {
            ports.push({
              port: parseInt(portMatch[1], 10),
              pid,
              command,
            });
          }
        }
      }

      return ports;
    } catch (error) {
      this.log("error", "Error getting active ports:", error);
      return [];
    }
  }

  private async invokeFlutterMethod(
    port: number,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    try {
      const result = await this.sendWebSocketRequest(port, method, params);
      return result;
    } catch (error) {
      this.log("error", `Error invoking Flutter method ${method}:`, error);
      throw error;
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "get_active_ports",
          description:
            "Get list of ports where Flutter/Dart processes are listening",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "get_supported_protocols",
          description: "Get supported protocols from a Flutter app",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description: "Port number where the Flutter app is running",
              },
            },
            required: ["port"],
          },
        },
        {
          name: "get_vm_info",
          description: "Get VM information from a Flutter app",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description: "Port number where the Flutter app is running",
              },
            },
            required: ["port"],
          },
        },
        {
          name: "stream_listen",
          description: "Subscribe to a Flutter event stream",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description: "Port number where the Flutter app is running",
              },
              streamId: {
                type: "string",
                description: "Stream ID to subscribe to",
                enum: [
                  "Debug",
                  "Isolate",
                  "VM",
                  "GC",
                  "Timeline",
                  "Logging",
                  "Service",
                  "HeapSnapshot",
                ],
              },
            },
            required: ["port", "streamId"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const handlePortParam = () => {
        const { port } = request.params.arguments as { port: number };
        if (!port || typeof port !== "number") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Port number is required and must be a number"
          );
        }
        return port;
      };

      const wrapResponse = (promise: Promise<unknown>) => {
        return promise
          .then((result) => ({
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          }))
          .catch((error: Error) => ({
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
          }));
      };

      switch (request.params.name) {
        case "get_active_ports": {
          const ports = await this.getActivePorts();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(ports, null, 2),
              },
            ],
          };
        }

        case "get_supported_protocols": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterMethod(port, "getSupportedProtocols")
          );
        }

        case "get_vm_info": {
          const port = handlePortParam();
          return wrapResponse(this.invokeFlutterMethod(port, "getVM"));
        }

        case "stream_listen": {
          const { port, streamId } = request.params.arguments as {
            port: number;
            streamId: string;
          };
          return wrapResponse(
            this.invokeFlutterMethod(port, "streamListen", { streamId })
          );
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
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

const server = new FlutterInspectorServer();
server.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
