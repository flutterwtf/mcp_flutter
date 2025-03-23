# Forwarding Server Architecture

## System Overview

The forwarding server provides a WebSocket-based bi-directional communication layer between Flutter applications and Inspector clients. It acts as a message broker, allowing seamless RPC communication between different client types.

## Core Components

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  Flutter App    │<------->│ Forwarding Server│<------->│ TypeScript      │
│  (clientType:   │         │                  │         │ Inspector       │
│   flutter)      │         │                  │         │ (clientType:    │
│                 │         │                  │         │  inspector)     │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

## TS Forwarding Server Architecture

located in `forwarding-server/src`

### 1. Forwarding Server (`forwarding-server.ts`)

- Core WebSocket server managing bidirectional connections
- Handles client registration and message routing
- Prevents circular message forwarding via message ID tracking
- Implements graceful shutdown and error handling

### 2. Node.js Client (`client.ts`)

- Client implementation for Node.js environments
- Supports automatic reconnection and request tracking
- Implements JSON-RPC protocol for method calls
- Event-based architecture for message handling

### 3. Browser Client (`browser-client.ts`)

- Browser-compatible client implementation using native WebSocket
- API parity with Node.js client but adapted for browser environments
- Supports JSON-RPC method calls and event-based messaging
- Manages automatic reconnection and request tracking

### 4. Entry Point (`index.ts`)

- Server bootstrapping and command-line interface
- Exports public API components
- Manages graceful shutdown

## Dart Forwarding Client Architecture

### Forwarding Client (`forwarding_client.dart`)

- Browser-compatible client implementation using WebSocket
- API parity with Typescript Browser Client
- Supports JSON-RPC method calls and event-based messaging
- Manages automatic reconnection and request tracking

## Communication Protocol

- JSON-RPC 2.0 for structured communication
- WebSocket transport layer
- Client identification via URL parameters
- Message forwarding based on client type

## Message Flow

1. Client connects with `clientType` parameter
2. Server registers client in appropriate collection
3. Client sends JSON-RPC request or notification
4. Server forwards message to all clients of the opposite type
5. Receiving clients process the message and may respond
6. Server tracks message IDs to prevent circular forwarding
