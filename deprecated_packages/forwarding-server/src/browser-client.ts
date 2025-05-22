/**
 * Browser-compatible client for connecting to the forwarding server.
 */
export class BrowserForwardingClient {
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
  private reconnectInterval: number | null = null;
  private reconnectDelay = 2000; // 2 seconds
  private clientId: string;
  private clientType: "inspector" | "flutter";
  private eventHandlers: Map<string, Set<Function>> = new Map();

  /**
   * Creates a new forwarding client.
   *
   * @param clientType The type of client ('inspector' or 'flutter')
   * @param clientId Optional client ID (will be generated if not provided)
   */
  constructor(clientType: "inspector" | "flutter", clientId?: string) {
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
   * Add an event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(callback);
  }

  /**
   * Remove an event listener
   */
  off(event: string, callback: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(callback);
    }
  }

  /**
   * Emit an event
   */
  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(...args);
      }
    }

    // Special handling for 'method' event to also trigger method:${methodName} events
    if (event === "method" && args.length >= 1) {
      const methodName = args[0];
      const methodHandlers = this.eventHandlers.get(`method:${methodName}`);
      if (methodHandlers) {
        // Skip the method name in args for specific method handlers
        const methodArgs = args.slice(1);
        for (const handler of methodHandlers) {
          handler(...methodArgs);
        }
      }
    }
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
    if (this.reconnectInterval !== null) {
      window.clearInterval(this.reconnectInterval);
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
          if (this.reconnectInterval === null) {
            this.setupReconnect(host, port, path);
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data.toString());

            // Emit the message as an event
            this.emit("message", message);

            // Handle method calls
            if (message.method && message.id) {
              this.emit(
                "method",
                message.method,
                message.params,
                (result: any) => {
                  this.sendResponse(message.id, result);
                }
              );
            }
            // Handle JSON-RPC responses
            else if (message.id) {
              const request = this.pendingRequests.get(message.id);
              if (request) {
                if (message.error) {
                  request.reject(
                    new Error(message.error.message || "Unknown error")
                  );
                } else {
                  request.resolve(message.result);
                }
                this.pendingRequests.delete(message.id);
              }
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };
      } catch (error) {
        console.error(`Failed to create WebSocket:`, error);
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
      console.error("Cannot send response: not connected");
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

    this.ws.send(JSON.stringify(response));
  }

  /**
   * Setup automatic reconnection
   */
  private setupReconnect(host: string, port: number, path: string): void {
    if (this.reconnectInterval !== null) {
      window.clearInterval(this.reconnectInterval);
    }

    this.reconnectInterval = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.log("Attempting to reconnect to forwarding server...");
        this.connect(host, port, path).catch((err) => {
          console.error("Reconnect failed:", err);
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
      throw new Error(
        `Not connected to forwarding server ${this.ws?.readyState}`
      );
    }

    const id = this.generateId();

    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        method,
      });

      this.ws!.send(JSON.stringify(request));
    });
  }

  /**
   * Send a raw message through the forwarding server
   *
   * @param message Message to send
   */
  sendMessage(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Not connected to forwarding server`);
    }

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
    this.on(
      `method:${method}`,
      async (params: any, respond: (result: any) => void) => {
        try {
          const result = await handler(params);
          respond(result);
        } catch (error: any) {
          console.error(`Error handling method ${method}:`, error);
          respond({ error: { message: error?.message || "Unknown error" } });
        }
      }
    );
  }

  /**
   * Disconnect from the forwarding server
   */
  disconnect(): void {
    if (this.reconnectInterval !== null) {
      window.clearInterval(this.reconnectInterval);
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
  getClientType(): "inspector" | "flutter" {
    return this.clientType;
  }
}
