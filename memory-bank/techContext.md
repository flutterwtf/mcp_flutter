# Tech Context

**Technologies:** Flutter, Dart, Node.js (for the MCP server and forwarding server), JSON-RPC, VM Service Protocol, WebSockets.

**Development Setup:** Requires Node.js, a Flutter app running in debug mode with the `devtools_mcp_extension` package, and an AI assistant (Cursor, Claude, or Cline).

**Dependencies:** `devtools_mcp_extension` (Flutter package), various Node.js packages (listed in `package.json` files - I'll need to inspect these later).

## Forwarding Server

**Technology:** Node.js, WebSockets.

**Setup:** Can be configured with environment variables (`FORWARDING_SERVER_PORT`, `FORWARDING_SERVER_PATH`) or command-line arguments.

**Client Connection:** Clients connect using specific URLs: `ws://localhost:8143/forward?clientType=flutter` (for Flutter) and `ws://localhost:8143/forward?clientType=inspector` (for TypeScript/Inspector).
