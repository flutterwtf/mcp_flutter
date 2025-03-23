import { EventEmitter } from "events";
import * as http from "http";
import { WebSocket, WebSocketServer } from "ws";

// Client type enum
export enum ClientType {
  FLUTTER = "flutter",
  INSPECTOR = "inspector",
}

// Client connection interface
export interface Client {
  id: string;
  type: ClientType;
  socket: WebSocket;
}

// Message interface
export interface ForwardingMessage {
  id?: string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
  jsonrpc?: string;
  [key: string]: any;
}

/**
 * ForwardingServer class that handles WebSocket connections between Flutter and TypeScript clients
 *
 * @emits clientConnected - When a new client connects (parameter: clientId, clientType)
 * @emits clientDisconnected - When a client disconnects (parameter: clientId, clientType)
 * @emits messageForwarded - When a message is forwarded between clients
 */
export class ForwardingServer extends EventEmitter {
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private isRunning = false;

  // Store connected clients by their ID
  private flutterClients: Map<string, Client> = new Map();
  private inspectorClients: Map<string, Client> = new Map();

  // Keep track of processed message IDs to prevent circular forwarding
  private processedMessageIds: Set<string> = new Set();

  constructor() {
    super();
  }

  /**
   * Start the forwarding server
   *
   * @param port - The port to run the server on
   * @param path - The WebSocket path (default: "/forward")
   */
  async start(port: number, path: string = "/forward"): Promise<void> {
    if (this.isRunning) {
      console.log("Forwarding server is already running");
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.server = http.createServer();

        // Create WebSocket server
        this.wss = new WebSocketServer({
          server: this.server,
          path,
        });

        // Handle new client connections
        this.wss.on(
          "connection",
          (socket: WebSocket, request: http.IncomingMessage) => {
            this.handleConnection(socket, request);
          }
        );

        // Start HTTP server
        this.server.listen(port, () => {
          this.isRunning = true;
          console.log(
            `Forwarding Server running at ws://localhost:${port}${path}`
          );
          resolve();
        });

        // Handle server errors
        this.server.on("error", (error: Error) => {
          console.error("Server error:", error);
          reject(error);
        });
      } catch (error) {
        console.error("Failed to start forwarding server:", error);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages and forward them to the appropriate clients
   */
  private handleMessage(
    message: ForwardingMessage,
    sourceClient: Client
  ): void {
    try {
      // If the message has an ID, check if we've already processed it
      if (message.id && this.processedMessageIds.has(message.id)) {
        // Skip processing to avoid circular forwarding
        return;
      }

      // Mark the message as processed
      if (message.id) {
        this.processedMessageIds.add(message.id);

        // Clean up processed IDs after a short delay to prevent memory leaks
        setTimeout(() => {
          this.processedMessageIds.delete(message.id as string);
        }, 60000); // 1 minute timeout
      }

      console.log(
        `Received message from ${sourceClient.type} client ${sourceClient.id}:`,
        message.method ? `Method: ${message.method}` : "Response"
      );

      // Determine target clients based on source client type
      const targetMap =
        sourceClient.type === ClientType.FLUTTER
          ? this.inspectorClients
          : this.flutterClients;

      // Forward message to all clients of the other type
      for (const [clientId, client] of targetMap.entries()) {
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify(message));
        }
      }

      this.emit(
        "messageForwarded",
        sourceClient.id,
        sourceClient.type,
        message
      );
    } catch (error) {
      console.error(`Error processing message from ${sourceClient.id}:`, error);
    }
  }

  /**
   * Stop the forwarding server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Close all client connections
        if (this.wss) {
          this.wss.clients.forEach((client) => {
            client.close();
          });

          this.wss.close();
          this.wss = null;
        }

        // Close server
        if (this.server) {
          this.server.close((err) => {
            if (err) {
              reject(err);
            } else {
              this.isRunning = false;
              this.flutterClients.clear();
              this.inspectorClients.clear();
              this.processedMessageIds.clear();
              console.log("Forwarding server stopped");
              resolve();
            }
          });
        } else {
          console.log("Forwarding server stopped");
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get all connected clients
   */
  getConnectedClients(): { flutter: string[]; inspector: string[] } {
    return {
      flutter: Array.from(this.flutterClients.keys()),
      inspector: Array.from(this.inspectorClients.keys()),
    };
  }

  /**
   * Handle a new WebSocket connection.
   * @param socket The WebSocket connection
   * @param request The HTTP request
   */
  private handleConnection(
    socket: WebSocket,
    request: http.IncomingMessage
  ): void {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    const clientType = url.searchParams.get("clientType") as ClientType;
    const clientId = url.searchParams.get("clientId") || crypto.randomUUID();

    // Validate client type
    if (!clientType || !Object.values(ClientType).includes(clientType)) {
      socket.close(
        1008,
        'Invalid clientType parameter. Must be "flutter" or "inspector".'
      );
      return;
    }

    // Create client object
    const client: Client = {
      id: clientId,
      type: clientType,
      socket,
    };

    // Store client in appropriate map
    if (clientType === ClientType.FLUTTER) {
      this.flutterClients.set(clientId, client);
    } else {
      this.inspectorClients.set(clientId, client);
    }

    // Emit client connected event
    this.emit("clientConnected", clientId, clientType);

    // Handle messages from this client
    socket.on("message", (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as ForwardingMessage;
        this.handleMessage(message, client);
      } catch (error) {
        console.error("Error processing message:", error);
      }
    });

    // Handle client disconnection
    socket.on("close", () => {
      if (clientType === ClientType.FLUTTER) {
        this.flutterClients.delete(clientId);
      } else {
        this.inspectorClients.delete(clientId);
      }

      this.emit("clientDisconnected", clientId, clientType);
    });

    // Handle errors
    socket.on("error", (error: Error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
    });
  }
}
