import { EventEmitter } from "events";
import WebSocket from "ws";
import { ClientType } from "./forwarding-server.js";

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
  private clientType: ClientType;

  /**
   * Creates a new forwarding client.
   *
   * @param clientType The type of client ('inspector' or 'flutter')
   * @param clientId Optional client ID (will be generated if not provided)
   */
  constructor(clientType: ClientType, clientId?: string) {
    super();
    this.clientType = clientType;
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
      console.log(`Already connected to forwarding server`);
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
        console.log(`Connecting to forwarding server at ${wsUrl}`);

        this.ws.onopen = () => {
          console.log(`Connected to forwarding server at ${wsUrl}`);
          // Start auto-reconnect if connection drops
          this.setupReconnect(host, port, path);
          this.emit("connected");
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error(`WebSocket error:`, error);
          this.emit("error", error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log(`Disconnected from forwarding server`);
          this.ws = null;
          this.emit("disconnected");

          // Setup reconnect if not already set
          if (!this.reconnectInterval) {
            this.setupReconnect(host, port, path);
          }
        };

        this.ws.onmessage = (event) => {
          try {
            console.log(
              `[CLIENT] Raw message received: ${event.data
                .toString()
                .substring(0, 200)}...`
            );

            const message = JSON.parse(event.data.toString());
            console.log(
              `[CLIENT] Parsed message:`,
              JSON.stringify(message, null, 2).substring(0, 500)
            );

            // Emit the message as an event
            console.log(`[CLIENT] Emitting 'message' event`);
            this.emit("message", message);

            // Handle method calls
            if (message.method && message.id) {
              console.log(
                `[CLIENT] Handling method call: ${message.method}, ID: ${message.id}`
              );
              this.emit(
                "method",
                message.method,
                message.params,
                (result: any) => {
                  console.log(
                    `[CLIENT] Sending response for method ${message.method}, ID: ${message.id}`
                  );
                  this.sendResponse(message.id, result);
                }
              );
              // Also emit a method-specific event
              console.log(
                `[CLIENT] Emitting method-specific event: method:${message.method}`
              );
              this.emit(
                `method:${message.method}`,
                message.params,
                (result: any) => {
                  console.log(
                    `[CLIENT] Sending response for specific method ${message.method}, ID: ${message.id}`
                  );
                  this.sendResponse(message.id, result);
                }
              );
            }
            // Handle JSON-RPC responses
            else if (message.id) {
              console.log(`[CLIENT] Processing response for ID: ${message.id}`);
              const request = this.pendingRequests.get(message.id);
              if (request) {
                console.log(
                  `[CLIENT] Found pending request for ID ${message.id}, method: ${request.method}`
                );
                if (message.error) {
                  console.error(
                    `[CLIENT] Request failed with error:`,
                    message.error
                  );
                  request.reject(
                    new Error(message.error.message || "Unknown error")
                  );
                } else {
                  console.log(
                    `[CLIENT] Request succeeded with result:`,
                    JSON.stringify(message.result).substring(0, 200)
                  );
                  request.resolve(message.result);
                }
                this.pendingRequests.delete(message.id);
                console.log(
                  `[CLIENT] Deleted pending request for ID: ${message.id}`
                );
              } else {
                console.log(
                  `[CLIENT] No pending request found for ID: ${message.id}`
                );
              }
            } else {
              console.log(
                `[CLIENT] Message doesn't match known patterns:`,
                message
              );
            }
          } catch (error) {
            console.error("[CLIENT] Error parsing WebSocket message:", error);
            console.error(
              "[CLIENT] Raw message that caused error:",
              event.data.toString()
            );
          }
        };
      } catch (error) {
        console.error(`[CLIENT] Failed to create WebSocket:`, error);
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
      console.error("[CLIENT] Cannot send response: not connected");
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

    console.log(
      `[CLIENT] Sending response for ID ${id}:`,
      JSON.stringify(response).substring(0, 200)
    );
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
        console.log("[CLIENT] Attempting to reconnect to forwarding server...");
        this.connect(host, port, path).catch((err) => {
          console.error("[CLIENT] Reconnect failed:", err);
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
      console.error(`[CLIENT] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const id = this.generateId();
    console.log(
      `[CLIENT] Generated new request ID: ${id} for method: ${method}`
    );

    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    console.log(
      `[CLIENT] Sending method call: ${method}, ID: ${id}`,
      JSON.stringify(params).substring(0, 200)
    );

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        method,
      });
      console.log(
        `[CLIENT] Added pending request for ID: ${id}, method: ${method}`
      );

      this.ws!.send(JSON.stringify(request));
      console.log(`[CLIENT] Sent request to server`);
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
      console.error(`[CLIENT] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(
      `[CLIENT] Sending raw message:`,
      JSON.stringify(message).substring(0, 200)
    );
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
    console.log(`[CLIENT] Registering handler for method: ${method}`);

    this.on(
      `method:${method}`,
      async (params: any, respond: (result: any) => void) => {
        console.log(
          `[CLIENT] Method-specific handler called for ${method} with params:`,
          JSON.stringify(params).substring(0, 200)
        );
        try {
          const result = await handler(params);
          console.log(
            `[CLIENT] Method ${method} handler succeeded with result:`,
            JSON.stringify(result).substring(0, 200)
          );
          respond(result);
        } catch (error: any) {
          console.error(`[CLIENT] Error handling method ${method}:`, error);
          respond({ error: { message: error?.message || "Unknown error" } });
        }
      }
    );

    // Also handle through the generic 'method' event
    this.on(
      "method",
      (methodName: string, params: any, respond: (result: any) => void) => {
        if (methodName === method) {
          console.log(
            `[CLIENT] Generic method handler called for ${method} with params:`,
            JSON.stringify(params).substring(0, 200)
          );
          try {
            Promise.resolve(handler(params))
              .then((result) => {
                console.log(
                  `[CLIENT] Generic handler for ${method} succeeded with result:`,
                  JSON.stringify(result).substring(0, 200)
                );
                respond(result);
              })
              .catch((error: any) => {
                console.error(
                  `[CLIENT] Error in generic handler for method ${method}:`,
                  error
                );
                respond({
                  error: { message: error?.message || "Unknown error" },
                });
              });
          } catch (error: any) {
            console.error(
              `[CLIENT] Error in synchronous part of generic handler for method ${method}:`,
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
