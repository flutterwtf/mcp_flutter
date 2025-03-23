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
            `Forwarding Server running at ws://localhost:${port}${path}.`
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
      console.log(
        `Processing message from ${sourceClient.type} client ${sourceClient.id}`
      );

      // Create a compound key that includes message type (request or response)
      const isRequest = !!message.method;
      const isResponse = !!message.result || !!message.error;
      const messageKey = message.id
        ? `${message.id}:${isRequest ? "req" : "resp"}`
        : undefined;

      // Skip if we've already processed this exact message type with this ID
      if (messageKey && this.processedMessageIds.has(messageKey)) {
        console.log(
          `Skipping already processed message ID: ${message.id} (${
            isRequest ? "request" : "response"
          })`
        );
        return;
      }

      // Mark this specific message type with this ID as processed
      if (messageKey) {
        console.log(
          `Marking message ID ${message.id} as ${
            isRequest ? "request" : "response"
          }`
        );
        this.processedMessageIds.add(messageKey);

        // Clean up processed IDs after a delay
        setTimeout(() => {
          this.processedMessageIds.delete(messageKey);
        }, 60000); // 1 minute timeout
      }

      console.log(
        `Received message from ${sourceClient.type} client ${sourceClient.id}:`,
        message.method ? `Method: ${message.method}` : "Response"
      );

      // For debugging, log more message details
      if (message.method) {
        console.log(
          `Method: ${message.method}, Params: ${JSON.stringify(
            message.params
          ).substring(0, 200)}...`
        );
      } else if (message.result) {
        console.log(
          `Result for ID ${message.id}: ${JSON.stringify(
            message.result
          ).substring(0, 200)}...`
        );
      } else if (message.error) {
        console.log(
          `Error for ID ${message.id}: ${JSON.stringify(message.error)}`
        );
      }

      // Determine target clients based on source client type
      const targetMap =
        sourceClient.type === ClientType.FLUTTER
          ? this.inspectorClients
          : this.flutterClients;

      console.log(
        `Forwarding to ${
          sourceClient.type === ClientType.FLUTTER ? "Inspector" : "Flutter"
        } clients. Count: ${targetMap.size}`
      );

      if (targetMap.size === 0) {
        console.log(
          `No ${
            sourceClient.type === ClientType.FLUTTER ? "Inspector" : "Flutter"
          } clients connected to forward message to`
        );
      }

      // Forward message to all clients of the other type
      let forwardedCount = 0;
      for (const [clientId, client] of targetMap.entries()) {
        if (client.socket.readyState === WebSocket.OPEN) {
          console.log(`Forwarding message to client ${clientId}`);
          client.socket.send(JSON.stringify(message));
          forwardedCount++;
        } else {
          console.log(
            `Client ${clientId} socket not open, state: ${client.socket.readyState}`
          );
        }
      }

      console.log(`Forwarded message to ${forwardedCount} clients`);

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
    console.log(
      `New connection request from ${request.headers.host}, URL: ${request.url}`
    );
    console.log(`Headers: ${JSON.stringify(request.headers, null, 2)}`);

    let clientType: ClientType | null = null;
    let clientId: string | null = null;

    try {
      // Parse the URL with proper error handling
      const url = new URL(request.url || "", `http://${request.headers.host}`);

      // Try to get clientType and clientId from query parameters
      clientType = url.searchParams.get("clientType") as ClientType;
      clientId = url.searchParams.get("clientId") || crypto.randomUUID();

      console.log(
        `Connection parameters from URL - clientType: ${clientType}, clientId: ${clientId}`
      );
      console.log(`Search params: ${url.searchParams.toString()}`);
    } catch (error) {
      console.error(`Error parsing URL: ${error}`);

      // Fallback: Try to extract clientType and clientId directly from the URL string
      // This handles cases where the URL might not be in standard format
      try {
        const urlString = request.url || "";
        const queryMatch = urlString.match(/[?&]clientType=([^&]+)/);
        if (queryMatch && queryMatch[1]) {
          clientType = queryMatch[1] as ClientType;
          console.log(`Extracted clientType from raw URL: ${clientType}`);
        }

        const clientIdMatch = urlString.match(/[?&]clientId=([^&]+)/);
        if (clientIdMatch && clientIdMatch[1]) {
          clientId = clientIdMatch[1];
          console.log(`Extracted clientId from raw URL: ${clientId}`);
        } else {
          clientId = crypto.randomUUID();
          console.log(`Generated new clientId: ${clientId}`);
        }
      } catch (fallbackError) {
        console.error(`Error in fallback URL parsing: ${fallbackError}`);
      }
    }

    // Additional fallback: Check request headers for clientType and clientId
    if (!clientType) {
      const headerClientType = request.headers["x-client-type"];
      if (headerClientType && typeof headerClientType === "string") {
        clientType = headerClientType as ClientType;
        console.log(`Using clientType from header: ${clientType}`);
      }
    }

    if (!clientId) {
      const headerClientId = request.headers["x-client-id"];
      if (headerClientId && typeof headerClientId === "string") {
        clientId = headerClientId;
        console.log(`Using clientId from header: ${clientId}`);
      } else {
        clientId = crypto.randomUUID();
        console.log(`Generated new clientId: ${clientId}`);
      }
    }

    // Special case check: If we still don't have clientType, try to infer from URL path or User-Agent
    if (!clientType) {
      const userAgent = request.headers["user-agent"] || "";
      const urlPath = request.url || "";

      if (
        userAgent.toLowerCase().includes("flutter") ||
        urlPath.includes("/flutter")
      ) {
        clientType = ClientType.FLUTTER;
        console.log(`Inferred Flutter client type from User-Agent or URL path`);
      } else if (
        userAgent.toLowerCase().includes("inspector") ||
        urlPath.includes("/inspector")
      ) {
        clientType = ClientType.INSPECTOR;
        console.log(
          `Inferred Inspector client type from User-Agent or URL path`
        );
      }
    }

    // Validate client type
    if (!clientType || !Object.values(ClientType).includes(clientType)) {
      console.log(`Invalid client type: ${clientType}, closing connection`);
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
      console.log(`Registering Flutter client: ${clientId}`);
      this.flutterClients.set(clientId, client);
    } else {
      console.log(`Registering Inspector client: ${clientId}`);
      this.inspectorClients.set(clientId, client);
    }

    // Log connected clients after adding new one
    console.log(`Connected clients after new connection:`);
    console.log(
      `- Flutter clients: ${
        Array.from(this.flutterClients.keys()).join(", ") || "none"
      }`
    );
    console.log(
      `- Inspector clients: ${
        Array.from(this.inspectorClients.keys()).join(", ") || "none"
      }`
    );

    // Emit client connected event
    this.emit("clientConnected", clientId, clientType);

    // Handle messages from this client
    socket.on("message", (data: WebSocket.Data) => {
      try {
        console.log(
          `Raw message from ${clientType} client ${clientId}: ${data
            .toString()
            .substring(0, 200)}...`
        );
        const message = JSON.parse(data.toString()) as ForwardingMessage;
        this.handleMessage(message, client);
      } catch (error) {
        console.error("Error processing message:", error);
      }
    });

    // Handle client disconnection
    socket.on("close", (code: number, reason: string) => {
      console.log(
        `Client ${clientId} (${clientType}) disconnected. Code: ${code}, Reason: ${
          reason || "none"
        }`
      );

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
