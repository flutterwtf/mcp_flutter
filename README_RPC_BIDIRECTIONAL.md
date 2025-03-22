# Flutter Inspector RPC Communication

This documentation covers the bidirectional RPC communication system between the Flutter Inspector server and Flutter/Dart web clients.

## Overview

The Flutter Inspector now supports bidirectional JSON-RPC 2.0 communication with Dart/Flutter clients, allowing:

1. **Server-to-Client Communication**: Send commands or notifications to connected Flutter clients
2. **Client-to-Server Communication**: Receive requests and messages from Flutter clients
3. **Multiple Client Support**: Manage connections to multiple clients at once

## Architecture

The system consists of:

- **RpcServer**: Manages WebSocket connections and handles JSON-RPC protocol
- **RpcUtilities**: Integrates the RPC server with the existing codebase
- **FlutterInspectorServer**: Higher-level API that uses RpcUtilities

## Using the RPC System

### Starting the Server

The RPC server is automatically started when you run the Flutter Inspector server:

```typescript
// The server will start automatically
const server = new FlutterInspectorServer(args);
await server.run();
```

By default, it will start on port 8142 (defined in `defaultWebClientPort`).

### Connecting Dart/Flutter Clients

In your Dart/Flutter client, connect using a WebSocket with the JSON-RPC 2.0 protocol:

```dart
import 'package:web_socket_channel/web_socket_channel.dart';
import 'dart:convert';

// Connect to the server
final wsUrl = Uri.parse('ws://localhost:8142/ws');
final channel = WebSocketChannel.connect(wsUrl);

// Send a JSON-RPC 2.0 request
channel.sink.add(jsonEncode({
  'jsonrpc': '2.0',
  'id': '1',
  'method': 'hello',
  'params': {'message': 'Hello from Dart client!'}
}));

// Listen for responses
channel.stream.listen((message) {
  final response = jsonDecode(message);
  print('Received: $response');
});
```

### Server-to-Client Communication

You can send messages to connected clients in several ways:

#### Send to a Specific Client

```typescript
// Get the list of connected clients
const clients = server.getConnectedDartClients();
if (clients.length > 0) {
  // Send a message to the first client
  const result = await server.sendToDartClient(clients[0], "updateState", {
    newState: "active",
  });
  console.log("Client response:", result);
}
```

#### Broadcast to All Clients

```typescript
// Send to all connected clients
const results = await server.broadcastToDartClients("notification", {
  type: "info",
  message: "Server event occurred",
});

// Check results for each client
for (const [clientId, result] of results.entries()) {
  console.log(`Client ${clientId} response:`, result);
}
```

### Client-to-Server Communication

The RPC server automatically handles incoming client requests and emits events that you can listen to. By default, it responds with a simple acknowledgment, but you can extend this behavior:

#### Custom Request Handler

```typescript
const rpcServer = await rpcUtils.startRpcServer();

// Listen for client requests
rpcServer.on("messageReceived", (clientId, method, params, id) => {
  console.log(`Client ${clientId} called method: ${method}`);
  console.log("Parameters:", params);

  // You could implement custom handling here
  // then use sendResponse() to reply
});
```

## Events

The `RpcServer` class emits the following events:

- `clientConnected` - When a new client connects (parameter: clientId)
- `clientDisconnected` - When a client disconnects (parameter: clientId)
- `clientError` - When a client connection has an error (parameters: clientId, error)
- `serverError` - When the server encounters an error (parameter: error)
- `messageReceived` - When a client sends a message (parameters: clientId, method, params, id)

## Example Usage

```typescript
import { FlutterInspectorServer } from "../servers/flutter_inspector_server.js";
import { LogLevel } from "../types/types.js";
import { CommandLineArgs } from "../index.js";

async function main() {
  // Start the server
  const args = CommandLineArgs.fromCommandLine();
  const server = new FlutterInspectorServer(args);
  await server.run();

  console.log("Server started, waiting for clients...");

  // Monitor client connections
  const rpcServer = server.getRpcServer();
  rpcServer.on("clientConnected", (clientId) => {
    console.log(`New client connected: ${clientId}`);

    // Send a welcome message
    server.sendToDartClient(clientId, "welcome", {
      message: "Welcome to the Flutter Inspector!",
    });
  });

  // Send periodic updates to all clients
  setInterval(async () => {
    const clients = server.getConnectedDartClients();
    if (clients.length > 0) {
      console.log(`Sending updates to ${clients.length} clients`);
      await server.broadcastToDartClients("heartbeat", {
        timestamp: Date.now(),
      });
    }
  }, 5000);
}

main().catch(console.error);
```

## Troubleshooting

- **No clients connected**: Ensure your Dart client is using the correct WebSocket URL and path
- **Client not receiving messages**: Verify the client is properly parsing JSON-RPC 2.0 messages
- **Server not receiving client messages**: Check that client messages follow the JSON-RPC 2.0 format

## Security Considerations

- The RPC server accepts connections from any client that can reach it
- For production use, consider adding authentication and TLS/SSL
