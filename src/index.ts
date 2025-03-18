#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { exec } from "child_process";
import * as dotenv from "dotenv";
import { promisify } from "util";
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

interface WidgetTreeResponse {
  result: {
    [key: string]: unknown;
  };
}

interface RouteResponse {
  result: {
    route?: string;
    [key: string]: unknown;
  };
}

type LogLevel = "error" | "warn" | "info" | "debug";

class FlutterInspectorServer {
  private server: Server;
  private port: number;
  private logLevel: LogLevel;

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

  private setupErrorHandling() {
    this.server.onerror = (error) => this.log("error", "[MCP Error]", error);

    process.on("SIGINT", async () => {
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
      // Use lsof to find processes listening on ports
      const { stdout } = await execAsync("lsof -i -P -n | grep LISTEN");

      const ports: FlutterPort[] = [];
      const lines = stdout.split("\n");

      for (const line of lines) {
        // Look for Flutter/Dart processes
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
      console.error("Error getting active ports:", error);
      return [];
    }
  }

  private async getWidgetTree(port: number): Promise<string> {
    try {
      const baseUrl = `http://127.0.0.1:${port}`;
      this.log("debug", `Connecting to VM service at ${baseUrl}`);

      const vmResponse = await axios.get(`${baseUrl}/json`);
      this.log("debug", "VM response:", vmResponse.data);

      const isolatesResponse = await axios.get<IsolatesResponse>(
        `${baseUrl}/json/list`
      );
      this.log("debug", "Isolates response:", isolatesResponse.data);

      if (!isolatesResponse.data.isolates?.length) {
        throw new Error("No isolates found in response");
      }

      const isolateId = isolatesResponse.data.isolates[0].id;
      this.log("debug", `Using isolate ID: ${isolateId}`);

      const groupName = "my-widget-tree-group";
      const widgetTreeResponse = await axios.post<WidgetTreeResponse>(
        `${baseUrl}/json/invoke`,
        {
          isolateId,
          target: "ext.flutter.inspector.getRootWidgetSummaryTree",
          args: {
            objectGroup: groupName,
          },
        },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      await axios.post(
        `${baseUrl}/json/invoke`,
        {
          isolateId,
          target: "ext.flutter.inspector.disposeGroup",
          args: {
            objectGroup: groupName,
          },
        },
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      return JSON.stringify(widgetTreeResponse.data.result, null, 2);
    } catch (error: unknown) {
      this.log("error", "Error getting widget tree:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to get widget tree: ${errorMessage}`);
    }
  }

  private async getCurrentRoute(port: number): Promise<string> {
    try {
      const baseUrl = `http://127.0.0.1:${port}`;
      this.log("debug", `Getting current route from ${baseUrl}`);

      const isolatesResponse = await axios.get<IsolatesResponse>(
        `${baseUrl}/json/list`
      );

      if (!isolatesResponse.data.isolates?.length) {
        throw new Error("No isolates found");
      }

      const isolateId = isolatesResponse.data.isolates[0].id;

      const routeResponse = await axios.post<RouteResponse>(
        `${baseUrl}/json/invoke`,
        {
          isolateId,
          target: "ext.flutter.navigator.currentRoute",
          args: {},
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return JSON.stringify(routeResponse.data.result, null, 2);
    } catch (error: unknown) {
      this.log("error", "Error getting current route:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to get current route: ${errorMessage}`);
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
          name: "get_widget_tree",
          description:
            "Get widget tree from a Flutter app running on specified port",
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
          name: "get_current_route",
          description: "Get the current route/page of the Flutter app",
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
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

        case "get_widget_tree": {
          const { port } = request.params.arguments as { port: number };
          if (!port || typeof port !== "number") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Port number is required and must be a number"
            );
          }

          try {
            const widgetTree = await this.getWidgetTree(port);
            return {
              content: [
                {
                  type: "text",
                  text: widgetTree,
                },
              ],
            };
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            return {
              content: [
                {
                  type: "text",
                  text: `Error: ${errorMessage}`,
                },
              ],
              isError: true,
            };
          }
        }

        case "get_current_route": {
          const { port } = request.params.arguments as { port: number };
          if (!port || typeof port !== "number") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Port number is required and must be a number"
            );
          }

          try {
            const currentRoute = await this.getCurrentRoute(port);
            return {
              content: [
                {
                  type: "text",
                  text: currentRoute,
                },
              ],
            };
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            return {
              content: [
                {
                  type: "text",
                  text: `Error: ${errorMessage}`,
                },
              ],
              isError: true,
            };
          }
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
