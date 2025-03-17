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
import { promisify } from "util";

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
  [key: string]: unknown;
}

class FlutterInspectorServer {
  private server: Server;

  constructor() {
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

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
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
      // Connect to the VM service and get the widget tree
      const response = await axios.get(`http://localhost:${port}/vm-service`);

      if (response.status !== 200) {
        throw new Error(`Failed to connect to VM service on port ${port}`);
      }

      // Get the isolates
      const isolatesResponse = await axios.get<IsolatesResponse>(
        `http://localhost:${port}/vm-service/isolates`
      );
      const isolateId = isolatesResponse.data.isolates[0]?.id;

      if (!isolateId) {
        throw new Error("No isolates found");
      }

      // Get the widget tree for the main isolate
      const widgetTreeResponse = await axios.get(
        `http://localhost:${port}/vm-service/ext/flutter/widgetTree?isolateId=${isolateId}`
      );

      return JSON.stringify(widgetTreeResponse.data, null, 2);
    } catch (error: unknown) {
      console.error("Error getting widget tree:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to get widget tree: ${errorMessage}`);
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
    console.error("Flutter Inspector MCP server running on stdio");
  }
}

const server = new FlutterInspectorServer();
server.run().catch(console.error);
