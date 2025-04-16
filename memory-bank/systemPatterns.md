# System Patterns

**Architecture:** Layered architecture with:

1. Flutter Application Layer (debug target)
2. VM Service Layer (error diagnostics and state access)
3. DevTools MCP Extension Layer (bridge between Flutter and MCP)
4. Forwarding Server Layer (message routing and client management)
5. MCP Server Layer (protocol translation and request handling)
6. AI Assistant Integration Layer (developer interaction)

**Communication Flow:**

- Request Flow: AI Assistant -> MCP Server -> Forwarding Server -> DevTools Extension -> VM Service -> Flutter App
- Response Flow: Flutter App -> VM Service -> DevTools Extension -> Forwarding Server -> MCP Server -> AI Assistant

**Key Components:**

- DevTools MCP Extension: Bridge component for VM service access
- Forwarding Server: Message routing and client management
- MCP Server: Protocol translation and request orchestration
- VM Service: Error diagnostics and state inspection

## Error Handling Architecture

**Components:**

1. Diagnostic Node: Flutter widget tree node with error state
2. VM Service: Access point for error information
3. Error Info: Structured error data with context

**Flow Diagram:**

```
+----------------+     +--------------+     +-------------+
|                |     |              |     |             |
| VM Service     +---->+ Diagnostic   +---->+ Error Info  |
|                |     | Node         |     |             |
+----------------+     +--------------+     +-------------+
```

**Implementation Patterns:**

1. Error Access:

```dart
class DevtoolsService {
  Future<String?> getErrorForNode(String nodeId) async {
    // Access error through VM service
  }
}
```

2. Node Management:

```dart
class ObjectGroup {
  Future<List<String>> getErrorsInSubtree(String rootId) async {
    // Check errors in node subtree
  }
}
```

3. Error Monitoring:

```dart
class ErrorMonitor {
  void checkNode(String nodeId) {
    // Monitor specific nodes for errors
  }
}
```

## Forwarding Server

**Purpose:** Enables bi-directional communication between Flutter applications and TypeScript clients.

**Mechanism:** WebSocket server that forwards messages between different client types (`flutter` and `inspector`).

**Features:**

- Prevents message loops
- Emits connection events
- Handles client type routing
- Supports error propagation

**Diagram:**

```
+----------------+                  +-------------------+
|                |                  |                   |
| Flutter Client +<---------------->+ Forwarding Server |
|                |                  |                   |
+----------------+                  |                   |
                                   |                   |
+----------------+                  |                   |
|                |                  |                   |
| Inspector Client +<--------------->+                   |
|                |                  |                   |
+----------------+                  +-------------------+
```
