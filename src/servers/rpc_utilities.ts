import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import fs from "fs";
import yaml from "js-yaml";
import { promisify } from "util";
import WebSocket from "ws";
import {
  IsolateResponse,
  LogLevel,
  VMInfo,
  WebSocketRequest,
  WebSocketResponse,
} from "../types/types.js";

export const execAsync = promisify(exec);

/**
 * Utilities for handling RPC communication with Flutter applications
 */
export class RpcUtilities {
  private wsConnections: Map<number, WebSocket> = new Map();
  private pendingRequests: Map<
    string,
    { resolve: Function; reject: Function; method: string }
  > = new Map();
  private messageId = 0;
  private logLevel: LogLevel;

  // Dart proxy properties
  private dartProxyWs: WebSocket | null = null;
  private proxyPort = 8888;
  private pendingProxyRequests = new Map<
    string,
    { resolve: Function; reject: Function }
  >();

  constructor(logLevel: LogLevel = "info") {
    this.logLevel = logLevel;
  }

  /**
   * Generate a unique ID for requests
   */
  private generateId(): string {
    return `${Date.now()}_${this.messageId++}`;
  }

  /**
   * Connect to a WebSocket for the given port
   */
  async connectWebSocket(port: number): Promise<WebSocket> {
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

  /**
   * Send a WebSocket request to the specified port
   */
  async sendWebSocketRequest(
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

  /**
   * Close all WebSocket connections
   */
  async closeAllConnections(): Promise<void> {
    for (const ws of this.wsConnections.values()) {
      ws.close();
    }
    if (this.dartProxyWs) {
      this.dartProxyWs.close();
    }
  }

  /**
   * Log a message with the specified level
   */
  log(level: LogLevel, ...args: unknown[]) {
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

  /**
   * Invoke a Flutter method on the specified port
   */
  async invokeFlutterMethod(
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

  /**
   * Get the Flutter isolate ID from the VM
   */
  async getFlutterIsolate(port: number): Promise<string> {
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

  /**
   * Verify that the Flutter app is running in debug mode
   */
  async verifyFlutterDebugMode(port: number): Promise<void> {
    const vmInfo = await this.invokeFlutterMethod(port, "getVM");
    if (!vmInfo) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get VM info from Flutter app on port ${port}`
      );
    }
  }

  /**
   * Invoke a Flutter extension method
   */
  async invokeFlutterExtension(
    port: number,
    method: string,
    params: any = {}
  ): Promise<any> {
    const fullMethod = method.startsWith("ext.")
      ? method
      : `ext.flutter.${method}`;

    return this.invokeFlutterMethod(port, fullMethod, params);
  }

  /**
   * Wrap a promise response for MCP
   */
  wrapResponse(promise: Promise<unknown>) {
    return promise
      .then((result) => ({
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      }))
      .catch((error: Error) => ({
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      }));
  }

  /**
   * Connect to the Dart proxy server
   */
  async connectToDartProxy(): Promise<WebSocket> {
    if (this.dartProxyWs && this.dartProxyWs.readyState === WebSocket.OPEN) {
      return this.dartProxyWs;
    }

    return new Promise((resolve, reject) => {
      const wsUrl = `ws://localhost:${this.proxyPort}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        this.log("debug", `WebSocket connected to Dart proxy at ${wsUrl}`);
        this.dartProxyWs = ws;
        resolve(ws);
      };

      ws.onerror = (error) => {
        this.log("error", `WebSocket error for Dart proxy:`, error);
        reject(error);
        this.dartProxyWs = null; // Clear on error
      };

      ws.onclose = () => {
        this.log("debug", `WebSocket closed for Dart proxy`);
        this.dartProxyWs = null;
      };

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data.toString());
          if (response.id) {
            const request = this.pendingProxyRequests.get(response.id);
            if (request) {
              if (response.error) {
                request.reject(new Error(response.error));
              } else {
                request.resolve(response.result);
              }
              this.pendingProxyRequests.delete(response.id);
            }
          }
        } catch (error) {
          this.log("error", "Error parsing Dart proxy message:", error);
        }
      };
    });
  }

  /**
   * Send a request to the Dart proxy
   */
  async sendDartProxyRequest(
    command: string,
    port: number,
    args: Record<string, any> = {}
  ): Promise<any> {
    const ws = await this.connectToDartProxy();
    const id = this.generateId();

    // Extract auth token from the VM service URL
    const vmServiceUrl = await this.invokeFlutterMethod(port, "getVM");
    const authToken = (vmServiceUrl as any)?.uri?.split("/")?.at(-2);

    const request = {
      id,
      command,
      port,
      authToken,
      ...args,
    };

    return new Promise((resolve, reject) => {
      this.pendingProxyRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify(request));
    });
  }

  /**
   * Load YAML tool configuration from a file path
   */
  loadYamlConfig(filePath: string): any {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Cannot find YAML configuration at ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf8");
    return yaml.load(content);
  }

  /**
   * Helper to extract port parameter from a request
   */
  handlePortParam(request: any, defaultPort: number = 8181): number {
    const port = request.params.arguments?.port as number | undefined;
    return port || defaultPort;
  }
}
