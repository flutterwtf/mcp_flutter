import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import WebSocket from "ws";
import { BaseDartServer } from "./base_dart_server.js";

export interface ProxyRequest {
  command: string;
  port: number;
  args?: Record<string, any>;
}

export interface ProxyResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}
// Dart Proxy Client required to forward requests
// to Dart Service Extension, which in turn forwards
// them to the Dart VM.
export class DartProxyClient extends BaseDartServer {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pendingRequests = new Map<
    string,
    { resolve: Function; reject: Function; command: string }
  >();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000; // 1 second

  constructor(
    private proxyPort: number = 8888,
    private logLevel: string = "info"
  ) {
    super();
  }

  private generateId(): string {
    return `proxy_${++this.messageId}`;
  }

  private log(level: string, ...args: any[]) {
    if (
      level === "error" ||
      (level === "warn" && this.logLevel !== "error") ||
      (level === "info" && ["error", "warn"].indexOf(this.logLevel) === -1) ||
      (level === "debug" && this.logLevel === "debug")
    ) {
      console[level](...args);
    }
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`ws://127.0.0.1:${this.proxyPort}`);

        this.ws.on("open", () => {
          this.log("info", `Connected to Dart proxy on port ${this.proxyPort}`);
          this.reconnectAttempts = 0;
          resolve();
        });

        this.ws.on("message", (data: WebSocket.Data) => {
          try {
            const response = JSON.parse(data.toString()) as ProxyResponse;
            const pending = this.pendingRequests.get(response.id);

            if (pending) {
              this.pendingRequests.delete(response.id);
              if (response.error) {
                pending.reject(new Error(response.error.message));
              } else {
                pending.resolve(response.result);
              }
            }
          } catch (error) {
            this.log("error", "Error processing proxy response:", error);
          }
        });

        this.ws.on("close", () => {
          this.log("warn", "Dart proxy connection closed");
          this.handleReconnect();
        });

        this.ws.on("error", (error: Error) => {
          this.log("error", "Dart proxy connection error:", error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log("error", "Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    this.log(
      "info",
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        this.log("error", "Reconnection failed:", error);
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  async sendRequest(request: ProxyRequest): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      try {
        await this.connect();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Failed to connect to Dart proxy: ${message}`
        );
      }
    }

    return new Promise((resolve, reject) => {
      const id = this.generateId();
      const message = {
        id,
        ...request,
      };

      this.pendingRequests.set(id, {
        resolve,
        reject,
        command: request.command,
      });

      this.ws!.send(JSON.stringify(message), (error) => {
        if (error) {
          this.pendingRequests.delete(id);
          reject(
            new McpError(
              ErrorCode.InvalidRequest,
              `Failed to send request to Dart proxy: ${error.message}`
            )
          );
        }
      });

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(
            new McpError(
              ErrorCode.InvalidRequest,
              `Request timed out: ${request.command}`
            )
          );
        }
      }, 30000); // 30 second timeout
    });
  }

  async close(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
