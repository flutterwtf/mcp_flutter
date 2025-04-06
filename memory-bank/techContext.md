# Tech Context

**Technologies:** Flutter, Dart, Node.js (for the MCP server and forwarding server), JSON-RPC, VM Service Protocol, WebSockets.

**Development Setup:** Requires Node.js, a Flutter app running in debug mode with the `devtools_mcp_extension` package, and an AI assistant (Cursor, Claude, or Cline).

**Dependencies:**

- Flutter/Dart: `devtools_mcp_extension`, `vm_service`, `websocket`
- Node.js: Various packages (listed in `package.json` files)

## VM Service Protocol

**Core Services:**

- VM Service Interface: Provides access to VM internals and debugging capabilities
- Error Handling: Diagnostic information about Flutter application and its error state
- Object Management: Reference tracking and memory management for Flutter application

**Flutter Application Error Structure:**

```dart
class NodeErrorInfo {
  final String nodeId;
  final String errorMessage;
  // Additional diagnostic properties
}
```

## Forwarding Server

**Technology:** Node.js, WebSockets

**Setup:** Configurable via environment variables (`FORWARDING_SERVER_PORT`, `FORWARDING_SERVER_PATH`) or CLI arguments

**Client Connection:**

- Flutter: `ws://localhost:8143/forward?clientType=flutter`
- Inspector: `ws://localhost:8143/forward?clientType=inspector`

## Flutter Application Error Handling

**Access Patterns:**

- VM Service queries for error states
- Diagnostic node property inspection
- Error monitoring and notification system
