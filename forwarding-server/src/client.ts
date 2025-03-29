import { EventEmitter } from "events";
import WebSocket from "ws";
import { ClientType } from "./forwarding-server.js";
import { Logger } from "./index.js";

/**
 * Client for connecting to the forwarding server.
 * Can be used in Node.js environments.
 */
export class ForwardingClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      method: string;
    }
  >();
  private messageId = 0;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private reconnectDelay = 2000; // 2 seconds
  private clientId: string;

  /**
   * Creates a new forwarding client.
   *
   * @param clientType The type of client ('inspector' or 'flutter')
   * @param clientId Optional client ID (will be generated if not provided)
   */
  constructor(
    public clientType: ClientType,
    public logger: Logger,
    clientId?: string
  ) {
    super();
    this.clientId = clientId || this.generateUuid();
  }

  /**
   * Generate a UUID for the client ID
   */
  private generateUuid(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Generate a unique ID for requests
   */
  private generateId(): string {
    return `${Date.now()}_${this.messageId++}`;
  }

  /**
   * Connect to the forwarding server
   *
   * @param host Host address
   * @param port Port number
   * @param path WebSocket path
   */
  async connect(
    host: string,
    port: number,
    path: string = "/forward"
  ): Promise<void> {
    // Add a leading slash to path if not present
    if (path && !path.startsWith("/")) {
      path = `/${path}`;
    }

    const readyState = this.ws?.readyState;

    // Only return early if the WebSocket is in OPEN state
    if (readyState === WebSocket.OPEN) {
      this.logger.debug(`Already connected to forwarding server`);
      return Promise.resolve();
    }

    // If WebSocket exists but is not open, close and recreate it
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Clear any existing reconnect interval
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    // Create new WebSocket connection
    return new Promise((resolve, reject) => {
      // Include clientType and clientId as query parameters
      const wsUrl = `ws://${host}:${port}${path}?clientType=${this.clientType}&clientId=${this.clientId}`;

      try {
        this.ws = new WebSocket(wsUrl);
        this.logger.debug(`Connecting to forwarding server at ${wsUrl}`);

        this.ws.onopen = () => {
          this.logger.debug(`Connected to forwarding server at ${wsUrl}`);
          // Start auto-reconnect if connection drops
          this.setupReconnect(host, port, path);
          this.emit("connected");
          resolve();
        };

        this.ws.onerror = (error) => {
          this.logger.error(`WebSocket error ${error.message}:`, error.error);
          this.emit("error", error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.logger.debug(`Disconnected from forwarding server`);
          this.ws = null;
          this.emit("disconnected");

          // Setup reconnect if not already set
          if (!this.reconnectInterval) {
            this.setupReconnect(host, port, path);
          }
        };

        this.ws.onmessage = (event) => {
          try {
            this.logger.debug(
              `Raw message received: ${event.data
                .toString()
                .substring(0, 200)}...`
            );

            const message = JSON.parse(event.data.toString());
            this.logger.debug(`Parsed message:`, {
              message: JSON.stringify(message, null, 2).substring(0, 500),
            });

            // Emit the message as an event
            this.logger.debug(`Emitting 'message' event`);
            this.emit("message", message);

            // Handle method calls
            if (message.method && message.id) {
              this.logger.debug(
                `Handling method call: ${message.method}, ID: ${message.id}`
              );
              this.emit(
                "method",
                message.method,
                message.params,
                (result: any) => {
                  this.logger.debug(
                    `Sending response for method ${message.method}, ID: ${message.id}`
                  );
                  this.sendResponse(message.id, result);
                }
              );
              // Also emit a method-specific event
              this.logger.debug(
                `Emitting method-specific event: method:${message.method}`
              );
              this.emit(
                `method:${message.method}`,
                message.params,
                (result: any) => {
                  this.logger.debug(
                    `Sending response for specific method ${message.method}, ID: ${message.id}`
                  );
                  this.sendResponse(message.id, result);
                }
              );
            }
            // Handle JSON-RPC responses
            else if (message.id) {
              this.logger.debug(`Processing response for ID: ${message.id}`);
              const request = this.pendingRequests.get(message.id);
              if (request) {
                this.logger.debug(
                  `Found pending request for ID ${message.id}, method: ${request.method}`
                );
                if (message.error) {
                  this.logger.error(
                    `Request failed with error:`,
                    message.error
                  );
                  request.reject(
                    new Error(message.error.message || "Unknown error")
                  );
                } else {
                  this.logger.debug(`Request succeeded with result:`, {
                    result: JSON.stringify(message.result).substring(0, 200),
                  });
                  request.resolve(message.result);
                }
                this.pendingRequests.delete(message.id);
                this.logger.debug(
                  `Deleted pending request for ID: ${message.id}`
                );
              } else {
                this.logger.debug(
                  `No pending request found for ID: ${message.id}`
                );
              }
            } else {
              this.logger.debug(
                `Message doesn't match known patterns:`,
                message
              );
            }
          } catch (error) {
            this.logger.error("Error parsing WebSocket message:", { error });
            this.logger.error("Raw message that caused error:", {
              message: event.data.toString(),
            });
          }
        };
      } catch (error) {
        this.logger.error(`Failed to create WebSocket:`, { error });
        reject(error);
      }
    });
  }

  /**
   * Send a JSON-RPC response
   *
   * @param id Request ID
   * @param result Result value
   * @param error Error object
   */
  private sendResponse(id: string, result: any, error?: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.error("Cannot send response: not connected");
      return;
    }

    const response = {
      jsonrpc: "2.0",
      id,
      result,
      error,
    };

    // Remove undefined properties
    Object.keys(response).forEach((key) => {
      if (response[key as keyof typeof response] === undefined) {
        delete response[key as keyof typeof response];
      }
    });

    this.logger.debug(`Sending response for ID ${id}:`, {
      response: JSON.stringify(response).substring(0, 200),
    });
    this.ws.send(JSON.stringify(response));
  }

  /**
   * Setup automatic reconnection
   */
  private setupReconnect(host: string, port: number, path: string): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    this.reconnectInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.logger.debug("Attempting to reconnect to forwarding server...");
        this.connect(host, port, path).catch((err) => {
          this.logger.error("Reconnect failed:", err);
        });
      }
    }, this.reconnectDelay);
  }

  /**
   * Call a method via the forwarding server
   *
   * @param method Method name
   * @param params Method parameters
   * @returns Promise that resolves with the result
   */
  async callMethod<T = unknown>(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const errorMsg = `Not connected to forwarding server ${this.ws?.readyState}`;
      this.logger.error(`${errorMsg}`);
      throw new Error(errorMsg);
    }

    const id = this.generateId();
    this.logger.debug(`Generated new request ID: ${id} for method: ${method}`);

    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    this.logger.debug(`Sending method call: ${method}, ID: ${id}`, {
      params: JSON.stringify(params).substring(0, 200),
    });

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        method,
      });
      this.logger.debug(
        `Added pending request for ID: ${id}, method: ${method}`
      );

      this.ws!.send(JSON.stringify(request));
      this.logger.debug(`Sent request to server`);
    });
  }

  /**
   * Send a raw message through the forwarding server
   *
   * @param message Message to send
   */
  sendMessage(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      const errorMsg = `Not connected to forwarding server`;
      this.logger.error(`${errorMsg}`);
      throw new Error(errorMsg);
    }

    this.logger.debug(`Sending raw message:`, {
      message: JSON.stringify(message).substring(0, 200),
    });
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Register a method handler
   *
   * @param method Method name
   * @param handler Function to handle the method call
   */
  registerMethod(
    method: string,
    handler: (params: any) => Promise<any> | any
  ): void {
    this.logger.debug(`Registering handler for method: ${method}`);

    this.on(
      `method:${method}`,
      async (params: any, respond: (result: any) => void) => {
        this.logger.debug(
          `Method-specific handler called for ${method} with params:`,
          { params: JSON.stringify(params).substring(0, 200) }
        );
        try {
          const result = await handler(params);
          this.logger.debug(`Method ${method} handler succeeded with result:`, {
            result: JSON.stringify(result).substring(0, 200),
          });
          respond(result);
        } catch (error: any) {
          this.logger.error(`Error handling method ${method}:`, error);
          respond({ error: { message: error?.message || "Unknown error" } });
        }
      }
    );

    // Also handle through the generic 'method' event
    this.on(
      "method",
      (methodName: string, params: any, respond: (result: any) => void) => {
        if (methodName === method) {
          this.logger.debug(
            `Generic method handler called for ${method} with params:`,
            { params: JSON.stringify(params).substring(0, 200) }
          );
          try {
            Promise.resolve(handler(params))
              .then((result) => {
                this.logger.debug(
                  `Generic handler for ${method} succeeded with result:`,
                  { result: JSON.stringify(result).substring(0, 200) }
                );
                respond(result);
              })
              .catch((error: any) => {
                this.logger.error(
                  `Error in generic handler for method ${method}:`,
                  error
                );
                respond({
                  error: { message: error?.message || "Unknown error" },
                });
              });
          } catch (error: any) {
            this.logger.error(
              `Error in synchronous part of generic handler for method ${method}:`,
              error
            );
            respond({ error: { message: error?.message || "Unknown error" } });
          }
        }
      }
    );
  }

  /**
   * Disconnect from the forwarding server
   */
  disconnect(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected to the forwarding server
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get the client ID
   */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * Get the client type
   */
  getClientType(): ClientType {
    return this.clientType;
  }
}
