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
  }

  protected log(level: LogLevel, message: string, ...args: unknown[]) {
    if (
      this.config.logLevel === "debug" ||
      (this.config.logLevel === "info" && level !== "debug") ||
      (this.config.logLevel === "warn" &&
        (level === "warn" || level === "error")) ||
      (this.config.logLevel === "error" && level === "error")
    ) {
      console.log(`[${level.toUpperCase()}] ${message}`, ...args);
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
    } catch (error) {
      this.isConnecting = false;
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
              ErrorCode.InvalidRequest,
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
        reject(error);
      });

      this.ws.on("close", () => {
        this.log("warn", `Connection closed to ${wsUrl}`);
        this.handleReconnect();
      });
    });
  }

  protected setupMessageHandler(): void {
    if (!this.ws) return;

    this.ws.on("message", (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;

        if (message.id) {
          const request = this.pendingRequests.get(message.id);
          if (request) {
            this.pendingRequests.delete(message.id);
            if (message.error) {
              request.reject(new Error(message.error.message));
            } else {
              request.resolve(message.result);
            }
          }
        }

        this.emit("message", message);
      } catch (error) {
        this.log("error", "Failed to parse WebSocket message:", error);
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

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(
            new McpError(ErrorCode.InvalidRequest, `Request timeout: ${method}`)
          );
        }
      }, this.config.connectionTimeout);

      this.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeoutId);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        method,
      });

      this.ws!.send(JSON.stringify(message), (error) => {
        if (error) {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(id);
          reject(
            new McpError(
              ErrorCode.InvalidRequest,
              `Failed to send message: ${error.message}`
            )
          );
        }
      });
    });
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pendingRequests.clear();
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
