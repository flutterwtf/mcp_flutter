# Plan: Remove Forwarding Server from `mcp_server` (src) and Redirect All Tools/Resources to Dart VM

## Objective

Remove all dependencies, logic, and code paths related to the "forwarding server" from the `mcp_server/src` package. All tools and resources must remain available and be refactored to use only the Dart VM backend. The server must remain modular for future extension.

---

## Key Principles

- **No functionality loss:** All tools/resources must be preserved and routed to Dart VM.
- **No forwarding server:** Remove all code, config, and logic related to the forwarding server.
- **Modularity:** The system must remain easy to extend with new backends in the future (e.g., via dependency injection, plugin, or config).

---

## File-by-File Action List

### 1. `index.ts`

- Remove all forwarding server config/env/CLI options.
- Only Dart VM and MCP server config remain.
- No references to forwarding server.

### 2. `servers/rpc_utilities.ts`

- Remove all `ForwardingClient` and `"flutter-extension"` logic.
- All backend communication (including what was previously routed to forwarding server) must now use `RpcClient` (Dart VM).
- If any method previously routed to forwarding server, refactor to call Dart VM instead.
- If a method is not available on Dart VM, add a stub or error, and document.
- All `sendWebSocketRequest`, `callFlutterExtension`, etc., use Dart VM only.

### 3. `servers/flutter_inspector_server.ts`

- Remove all forwarding server connection logic.
- All connections and handlers use only Dart VM.
- Add extension point for future backends (e.g., via dependency injection).
- No forwarding server logic remains.

### 4. `resources/resource_handlers.ts`

- Remove all conditional logic for forwarding server.
- All resource handlers route to Dart VM (using `RpcUtilities`/`RpcClient`).
- If a resource previously used forwarding server, refactor to use Dart VM.
- All resources are available and functional via Dart VM.

### 5. `resources/widget_tree_resources.ts`

- All resources are defined for Dart VM only.
- No forwarding server logic.

### 6. `tools/create_custom_rpc_handler_map.ts`

- Remove any custom handlers that use forwarding server.
- All custom handlers use Dart VM.
- All tools are available and functional via Dart VM.

### 7. `tools/tools_handlers.ts`

- Remove any logic that references forwarding server or its tools.
- All tool registration and handler logic use Dart VM.
- All tools are available and functional via Dart VM.

### 8. `tools/flutter_rpc_handlers.generated.ts`

- All tool configs use Dart VM.
- Remove any forwarding server-specific logic.
- All tool configs are Dart VM only.

### 9. `types/types.ts`

- Remove any types/interfaces that reference forwarding server.
- Types are backend-agnostic.

### 10. YAML Tool Configs (`server_tools_custom.yaml`, `server_tools_flutter.yaml`)

- Remove any tool definitions that are forwarding server-specific.
- All tools should be routed to Dart VM.
- All tools are available and functional via Dart VM.

### 11. Documentation

- Add comments or a section in README/inline on how to add new backends in the future (e.g., via a `BackendClient` interface or plugin).
- Clear extension points for future backend support.

### 12. General

- Remove any dead code, unused imports, or references to forwarding server.
- Ensure all tools and resources are available and functional via Dart VM.

---

## Special Notes

- If any tool/resource previously required forwarding server and cannot be mapped to Dart VM, document this and provide a stub/error handler.
- All handler logic should be modular, so adding a new backend in the future is straightforward (e.g., via a `BackendClient` interface).

---

## Summary Table

| File/Dir                                  | Remove Forwarding Server | Redirect to Dart VM | Refactor for Modularity | Add Extension Point | Test/Doc |
| ----------------------------------------- | :----------------------: | :-----------------: | :---------------------: | :-----------------: | :------: |
| `index.ts`                                |            ✔️            |         ✔️          |           ✔️            |         ✔️          |    ✔️    |
| `servers/rpc_utilities.ts`                |            ✔️            |         ✔️          |           ✔️            |         ✔️          |    ✔️    |
| `servers/flutter_inspector_server.ts`     |            ✔️            |         ✔️          |           ✔️            |         ✔️          |    ✔️    |
| `resources/resource_handlers.ts`          |            ✔️            |         ✔️          |           ✔️            |         ✔️          |    ✔️    |
| `resources/widget_tree_resources.ts`      |            ✔️            |         ✔️          |           ✔️            |         ✔️          |    ✔️    |
| `tools/create_custom_rpc_handler_map.ts`  |            ✔️            |         ✔️          |           ✔️            |         ✔️          |    ✔️    |
| `tools/tools_handlers.ts`                 |            ✔️            |         ✔️          |           ✔️            |         ✔️          |    ✔️    |
| `tools/flutter_rpc_handlers.generated.ts` |            ✔️            |         ✔️          |           ✔️            |         ✔️          |    ✔️    |
| `types/types.ts`                          |            ✔️            |         ✔️          |           ✔️            |         ✔️          |    ✔️    |
| YAML tool configs                         |            ✔️            |         ✔️          |           ✔️            |         ✔️          |    ✔️    |
| Documentation                             |            ✔️            |         ✔️          |           ✔️            |         ✔️          |    ✔️    |
