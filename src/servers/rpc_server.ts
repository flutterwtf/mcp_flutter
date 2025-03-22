import http, { IncomingMessage } from "http";
import WebSocket, * as ws from "ws";

export class RpcServer {
  private server: http.Server | null = null;
  private wss: ws.Server | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private pendingRequests = new Map<
    string,
    { resolve: Function; reject: Function; method: string }
  >();
  private messageId = 0;

  /**
   * Generate a unique ID for requests
   */
  private generateId(): string {
    return `${Date.now()}_${this.messageId++}`;
  }

  /**
   * Start the RPC server
   */
  async start(port: number, path: string = "/ws"): Promise<void> {
    if (this.wss) {
      console.log("Server is already running");
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.server = http.createServer();

        // Create WebSocket server instance
        this.wss = new ws.WebSocketServer({
          server: this.server,
          path,
        });

        // Handle new client connections
        this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
          const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
          console.log(`Client connected: ${clientId}`);

          // Store client connection
          this.clients.set(clientId, ws);

          // Handle client messages
          ws.on("message", (message: WebSocket.Data) => {
            this.handleMessage(clientId, message);
          });

          // Handle client disconnection
          ws.on("close", () => {
            console.log(`Client disconnected: ${clientId}`);
            this.clients.delete(clientId);
          });

          // Handle errors
          ws.on("error", (error: Error) => {
            console.error(`WebSocket error for client ${clientId}:`, error);
          });
        });

        // Start HTTP server
        this.server.listen(port, () => {
          console.log(`RPC Server running at ws://localhost:${port}${path}`);
          resolve();
        });

        // Handle server errors
        this.server.on("error", (error) => {
          console.error("Server error:", error);
          reject(error);
        });
      } catch (error) {
        console.error("Failed to start RPC server:", error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(clientId: string, data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      // Handle RPC response (has id and result/error)
      if (message.id && (message.result !== undefined || message.error)) {
        const request = this.pendingRequests.get(message.id);
        if (request) {
          if (message.error) {
            request.reject(new Error(message.error.message));
          } else {
            request.resolve(message.result);
          }
          this.pendingRequests.delete(message.id);
        }
      }
      // Handle RPC request (has id and method)
      else if (message.id && message.method) {
        // Here you would implement handling of client methods
        // For now, we'll just echo back a success response
        this.sendResponse(clientId, message.id, {
          success: true,
          method: message.method,
        });
      }
    } catch (error) {
      console.error(`Error parsing message from ${clientId}:`, error);
    }
  }

  /**
   * Send a response to a client request
   */
  private sendResponse(clientId: string, requestId: string, result: any): void {
    const client = this.clients.get(clientId);
    if (!client || client.readyState !== WebSocket.OPEN) {
      console.error(
        `Cannot send response to client ${clientId}: client not found or not connected`
      );
      return;
    }

    const response = {
      jsonrpc: "2.0",
      id: requestId,
      result,
    };

    client.send(JSON.stringify(response));
  }

  /**
   * Call a method on a specific client
   */
  async callClientMethod(
    clientId: string,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    const client = this.clients.get(clientId);
    if (!client || client.readyState !== WebSocket.OPEN) {
      throw new Error(`Client ${clientId} not found or not connected`);
    }

    const id = this.generateId();
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, method });
      client.send(JSON.stringify(request));
    });
  }

  /**
   * Broadcast a method call to all connected clients
   */
  async broadcastMethod(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();
    const promises: Promise<void>[] = [];

    for (const [clientId, client] of this.clients.entries()) {
      if (client.readyState === WebSocket.OPEN) {
        promises.push(
          this.callClientMethod(clientId, method, params)
            .then((result) => {
              results.set(clientId, result);
            })
            .catch((error) => {
              results.set(clientId, { error: error.message });
            })
        );
      }
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * Get all connected clients
   */
  getConnectedClients(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Stop the RPC server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }

      // Close all client connections
      for (const client of this.clients.values()) {
        client.close();
      }
      this.clients.clear();

      // Close WebSocket server
      this.wss.close(() => {
        // Close HTTP server
        if (this.server) {
          this.server.close(() => {
            this.wss = null;
            this.server = null;
            console.log("RPC Server stopped");
            resolve();
          });
        } else {
          this.wss = null;
          console.log("RPC Server stopped");
          resolve();
        }
      });
    });
  }
}
