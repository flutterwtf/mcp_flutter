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

interface IsolateInfo {
  id: string;
  name?: string;
  number?: string;
  isSystemIsolate?: boolean;
  isolateGroupId?: string;
  extensionRPCs?: string[];
}

interface VMInfo {
  isolates: IsolateInfo[];
  version?: string;
  pid?: number;
  // Add other VM info fields as needed
}

interface IsolateResponse extends IsolateInfo {
  extensionRPCs?: string[];
  // Add other isolate response fields as needed
}

const INSPECTOR_METHODS = {
  WIDGET_TREE: "ext.flutter.inspector.getWidgetTree",
  WIDGET_DETAILS: "ext.flutter.inspector.getProperties",
  SET_PUB_ROOT: "ext.flutter.inspector.setPubRootDirectories",
  GET_PUB_ROOT: "ext.flutter.inspector.getPubRootDirectories",
  IS_WIDGET_TREE_READY: "ext.flutter.inspector.isWidgetTreeReady",
};

const PERFORMANCE_METHODS = {
  GET_STATS: "ext.flutter.getStats",
  CLEAR_STATS: "ext.flutter.clearStats",
  ENABLE_STATS: "ext.flutter.enableStats",
};

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

  private async getFlutterIsolate(port: number): Promise<string> {
    const vmInfo = (await this.invokeFlutterMethod(port, "getVM")) as VMInfo;
    const isolates = vmInfo.isolates;

    // Find Flutter isolate by checking for Flutter extension RPCs
    for (const isolateRef of isolates) {
      const isolate = (await this.invokeFlutterMethod(port, "getIsolate", {
        isolateId: isolateRef.id,
      })) as IsolateResponse;

      // Check if this isolate has Flutter extensions
      const extensionRPCs = isolate.extensionRPCs || [];
      if (extensionRPCs.some((ext: string) => ext.startsWith("ext.flutter"))) {
        return isolateRef.id;
      }
    }

    throw new McpError(
      ErrorCode.InternalError,
      "No Flutter isolate found in the application"
    );
  }

  private async invokeFlutterExtension(
    port: number,
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    const isolateId = await this.getFlutterIsolate(port);
    return this.invokeFlutterMethod(port, method, {
      ...params,
      isolateId,
    });
  }

  private async verifyFlutterDebugMode(port: number): Promise<void> {
    const vmInfo = (await this.invokeFlutterMethod(port, "getVM")) as VMInfo;
    const isolateId = await this.getFlutterIsolate(port);
    const isolateInfo = (await this.invokeFlutterMethod(port, "getIsolate", {
      isolateId,
    })) as IsolateResponse;

    if (
      !isolateInfo.extensionRPCs?.includes("ext.flutter.debugDumpRenderTree")
    ) {
      throw new McpError(
        ErrorCode.InternalError,
        "Flutter app must be running in debug mode to inspect the render tree"
      );
    }
  }

  private setupToolHandlers() {
    // Default port for Flutter/Dart processes
    const DEFAULT_FLUTTER_PORT = 8181;

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
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
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
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "get_render_tree",
          description: "Get render tree from a Flutter app",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "get_layer_tree",
          description: "Get layer tree from a Flutter app",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "get_semantics_tree",
          description: "Get semantics tree from a Flutter app",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "toggle_debug_paint",
          description: "Toggle debug paint in Flutter app",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              enabled: {
                type: "boolean",
                description: "Whether to enable or disable debug paint",
              },
            },
            required: ["enabled"],
          },
        },
        {
          name: "get_flutter_version",
          description: "Get Flutter version information",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
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
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
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
            required: ["streamId"],
          },
        },
        {
          name: "get_widget_tree",
          description: "Get widget tree from a Flutter app",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
        {
          name: "get_widget_details",
          description: "Get details for a specific widget",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
              objectId: {
                type: "string",
                description: "ID of the widget to inspect",
              },
            },
            required: ["objectId"],
          },
        },
        {
          name: "get_performance_stats",
          description: "Get Flutter performance statistics",
          inputSchema: {
            type: "object",
            properties: {
              port: {
                type: "number",
                description:
                  "Port number where the Flutter app is running (defaults to 8181)",
              },
            },
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const handlePortParam = () => {
        const { port } = (request.params.arguments as { port?: number }) || {};
        if (port && typeof port !== "number") {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Port number must be a number when provided"
          );
        }
        return port || DEFAULT_FLUTTER_PORT;
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

        case "get_render_tree": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, "ext.flutter.debugDumpRenderTree")
          );
        }

        case "get_layer_tree": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, "ext.flutter.debugDumpLayerTree")
          );
        }

        case "get_semantics_tree": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              "ext.flutter.debugDumpSemanticsTreeInTraversalOrder"
            )
          );
        }

        case "toggle_debug_paint": {
          const port = handlePortParam();
          const { enabled } = request.params.arguments as {
            enabled: boolean;
          };
          if (typeof enabled !== "boolean") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "enabled parameter must be a boolean"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, "ext.flutter.debugPaint", {
              enabled,
            })
          );
        }

        case "get_flutter_version": {
          const port = handlePortParam();
          return wrapResponse(
            this.invokeFlutterExtension(port, "ext.flutter.version")
          );
        }

        case "stream_listen": {
          const port = handlePortParam();
          const { streamId } = request.params.arguments as {
            streamId: string;
          };
          return wrapResponse(
            this.invokeFlutterMethod(port, "streamListen", { streamId })
          );
        }

        case "get_widget_tree": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(port, "ext.flutter.debugDumpApp")
          );
        }

        case "get_widget_details": {
          const port = handlePortParam();
          const { objectId } = request.params.arguments as { objectId: string };
          if (!objectId) {
            throw new McpError(
              ErrorCode.InvalidParams,
              "objectId parameter is required"
            );
          }
          await this.verifyFlutterDebugMode(port);
          return wrapResponse(
            this.invokeFlutterExtension(
              port,
              "ext.flutter.inspector.getProperties",
              {
                arg: { objectId },
              }
            )
          );
        }

        case "get_performance_stats": {
          const port = handlePortParam();
          await this.verifyFlutterDebugMode(port);

          // First enable stats collection
          await this.invokeFlutterExtension(port, "ext.flutter.enableStats", {
            enabled: true,
          });

          // Then get the stats
          return wrapResponse(
            this.invokeFlutterExtension(port, "ext.flutter.getStats")
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
