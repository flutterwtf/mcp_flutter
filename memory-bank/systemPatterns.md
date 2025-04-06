# System Patterns

**Architecture:** Layered architecture with:

1.  Flutter Application Layer (debug target)
2.  DevTools MCP Extension Layer (bridge between Flutter and MCP)
3.  MCP Server Layer (protocol translation and request handling)
4.  AI Assistant Integration Layer (developer interaction)

**Communication Flow:** Request Initiation (AI Assistant -> MCP Server), Protocol Translation (MCP Server -> DevTools Extension), Flutter Interaction (DevTools Extension -> Flutter App), Response Flow (reverse).

**Key Components:** DevTools MCP Extension, Forwarding Server, MCP Server.

## Forwarding Server

**Purpose:** Enables bi-directional communication between Flutter applications and TypeScript clients (like the MCP server).

**Mechanism:** WebSocket server that forwards messages between different client types (`flutter` and `inspector`).

**Features:** Prevents message loops, emits events for client connections/disconnections.

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
