import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { EventEmitter } from "events";
import WebSocket from "ws";
import { LogLevel } from "../rpc/utilities_rpc.js";

export interface DartServerConfig {
  port: number;
  logLevel?: LogLevel;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  connectionTimeout?: number;
}

export interface WebSocketMessage {
  jsonrpc: "2.0";
  id: string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export abstract class BaseDartServer extends EventEmitter {
  protected ws: WebSocket | null = null;
  protected messageId = 0;
  protected pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: any) => void;
      method: string;
      timeoutId?: NodeJS.Timeout;
    }
  >();
  protected reconnectAttempts = 0;
  protected isConnecting = false;

  constructor(protected readonly config: DartServerConfig) {
    super();
    this.config.logLevel = config.logLevel || "info";
    this.config.reconnectAttempts = config.reconnectAttempts || 5;
    this.config.reconnectDelay = config.reconnectDelay || 1000;
    this.config.connectionTimeout = config.connectionTimeout || 30000;

    // Handle process termination
    process.on("SIGINT", async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  protected log(level: LogLevel, ...args: unknown[]) {
    const levels: LogLevel[] = ["error", "warn", "info", "debug"];
    if (
      levels.indexOf(level) <= levels.indexOf(this.config.logLevel || "info")
    ) {
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

  protected generateId(): string {
    return `${Date.now()}_${++this.messageId}`;
  }

  protected abstract getWebSocketUrl(): string;

  public async connect(): Promise<void> {
    if (this.isConnecting) {
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    try {
      await this.establishConnection();
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.emit("connected");
    } catch (error) {
      this.isConnecting = false;
      this.emit("error", error);
      throw error;
    }
  }

  protected async establishConnection(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const wsUrl = this.getWebSocketUrl();
      this.ws = new WebSocket(wsUrl);

      const connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          this.ws?.close();
          reject(
            new McpError(
              ErrorCode.InternalError,
              `Connection timeout to ${wsUrl}`
            )
          );
        }
      }, this.config.connectionTimeout);

      this.ws.on("open", () => {
        clearTimeout(connectionTimeout);
        this.log("info", `Connected to ${wsUrl}`);
        this.setupMessageHandler();
        resolve();
      });

      this.ws.on("error", (error: Error) => {
        clearTimeout(connectionTimeout);
        this.log("error", `WebSocket error for ${wsUrl}:`, error);
        reject(new McpError(ErrorCode.InternalError, error.message));
      });

      this.ws.on("close", () => {
        this.log("warn", `Connection closed to ${wsUrl}`);
        this.emit("disconnected");
        this.handleReconnect();
      });
    });
  }

  protected setupMessageHandler(): void {
    if (!this.ws) return;

    this.ws.on("message", (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        this.log("debug", "Received message:", message);

        if (message.id) {
          const request = this.pendingRequests.get(message.id);
          if (request) {
            if (request.timeoutId) {
              clearTimeout(request.timeoutId);
            }
            this.pendingRequests.delete(message.id);

            if (message.error) {
              request.reject(
                new McpError(
                  message.error.code as ErrorCode,
                  message.error.message,
                  message.error.data
                )
              );
            } else {
              request.resolve(message.result);
            }
          }
        }

        this.emit("message", message);
      } catch (error) {
        this.log("error", "Failed to parse WebSocket message:", error);
        this.emit(
          "error",
          new McpError(
            ErrorCode.ParseError,
            "Failed to parse WebSocket message"
          )
        );
      }
    });
  }

  protected async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= (this.config.reconnectAttempts || 5)) {
      this.log("error", "Max reconnection attempts reached");
      this.emit("maxReconnectAttemptsReached");
      return;
    }

    this.reconnectAttempts++;
    this.log(
      "info",
      `Attempting to reconnect (${this.reconnectAttempts}/${this.config.reconnectAttempts})`
    );

    await new Promise((resolve) =>
      setTimeout(resolve, this.config.reconnectDelay! * this.reconnectAttempts)
    );

    try {
      await this.connect();
    } catch (error) {
      this.log("error", "Reconnection failed:", error);
      this.emit("error", error);
    }
  }

  public async sendMessage(
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    const id = this.generateId();
    const message: WebSocketMessage = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    this.log("debug", "Sending message:", message);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(
            new McpError(ErrorCode.InternalError, `Request timeout: ${method}`)
          );
        }
      }, this.config.connectionTimeout);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        method,
        timeoutId,
      });

      this.ws!.send(JSON.stringify(message), (error) => {
        if (error) {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(id);
          reject(
            new McpError(
              ErrorCode.InternalError,
              `Failed to send message: ${error.message}`
            )
          );
        }
      });
    });
  }

  public async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Clear all pending requests with timeout error
    for (const [id, request] of this.pendingRequests) {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      request.reject(
        new McpError(ErrorCode.InternalError, "Server disconnected")
      );
    }
    this.pendingRequests.clear();

    this.emit("disconnected");
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
