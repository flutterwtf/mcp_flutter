**Overall Goal:**
Enable Flutter applications, via the `mcp_toolkit`, to dynamically register their custom Dart VM Service extensions as "tools" or "resources" with the MCP Server. These registered items will be persistently stored, discoverable by AI Assistants, and invocable through the standard MCP Server interface, with clear namespacing by the Flutter application's (server-known) DDS port.

---

**Phase 1: Foundational Definitions & MCP Server Preparation**

- **Objective:** Establish the core data structures and API contracts.
- **Scope:** Defining schemas, API endpoint contracts.

  - **Step 1.1: Define `ToolDefinition` and `ResourceDefinition` Schemas**

    - **Objective:** Create precise JSON Schemas for registration payloads.
    - **Scope:**
      - `ToolDefinition` schema: `id` (string, for AI invocation), `displayName` (string), `description` (string), `vmServicePath` (string, e.g., `ext.mcp.toolkit.actual_method`), `parametersSchema` (JSON Schema object), `returnSchema` (JSON Schema object), `type` (enum: "tool").
      - `ResourceDefinition` schema: Similar, with `type` (enum: "resource").
      - Store in `mcp_server/src/schemas/dynamic_service_definitions.json`.
    - **Files likely affected:** New schema files in `mcp_server/src/schemas/`.
    - **Progress Update:** Schema definitions complete and validated.

  - **Step 1.2: Define `/mcp/admin/install` API Contract on MCP Server**

    - **Objective:** Specify the HTTP API endpoint for receiving registrations.
    - **Scope:**
      - Endpoint: `POST /mcp/admin/install`
      - Request Body: Must conform to `ToolDefinition` or `ResourceDefinition`.
      - No explicit `X-MCP-Registrar-DDS` header needed from client if server manages a single DDS connection; server will use its active DDS `host:port` for namespacing.
      - Success Response (200 OK): e.g., `{ "status": "success", "id": "<registered_tool_id>" }`.
      - Error Responses: Standard MCP JSON-RPC error formats.
      - Document in `mcp_server/docs/`.
    - **Files likely affected:** New API documentation file in `mcp_server/docs/`.
    - **Progress Update:** API contract defined and documented.

  - **Step 1.3: MCP Server Project Scaffolding**
    - **Objective:** Prepare MCP Server for new dynamic service logic.
    - **Scope:** Create directories/placeholders for handling `/mcp/admin/install`, dynamic registry management, and payload validation.
    - **Files likely affected:** New files/directories in `mcp_server/src/services/dynamic_registry/` or similar.
    - **Progress Update:** Project structure updated.

---

**Phase 2: MCP Server - Registration Logic & Persistence**

- **Objective:** Implement server-side logic to accept, validate, store, and manage dynamic registrations.
- **Scope:** HTTP handling, validation, persistence.

  - **Step 2.1: Implement `/mcp/admin/install` Endpoint Handler in MCP Server**

    - **Objective:** Process incoming registration requests.
    - **Scope:**
      - Receive POST requests.
      - Deserialize and validate JSON body against `ToolDefinition`/`ResourceDefinition`.
      - (Authentication/Authorization stub).
    - **Files likely affected:** HTTP routing, new handler module in `mcp_server/src/services/dynamic_registry/`.
    - **Progress Update:** Endpoint accepts, validates, returns success/error.

  - **Step 2.2: Implement Dynamic Service Registry (In-Memory) in MCP Server**

    - **Objective:** Store registrations, namespaced by the server's active DDS `host:port`.
    - **Scope:**
      - Registry structure: `Map<String_DDS_Port, Map<String_Tool_ID, Union<ToolDefinition, ResourceDefinition>>>`. The key `String_DDS_Port` will be derived from the MCP server's current connection (e.g., `args.dartVMHost:args.dartVMPort`).
      - Functions: Add/Update, Retrieve by ID, Retrieve all for DDS port, Retrieve all.
      - Integrate with Step 2.1.
    - **Files likely affected:** New registry module in `mcp_server/src/services/dynamic_registry/`.
    - **Progress Update:** In-memory registry implemented.

  - **Step 2.3: Implement Persistence for Dynamic Service Registry in MCP Server**
    - **Objective:** Ensure registrations survive server restarts.
    - **Scope:**
      - Method: JSON or YAML file (e.g., `mcp_server_dynamic_services.yaml`).
      - Logic: Load on startup, save on any change to the registry via `/mcp/admin/install`.
    - **Files likely affected:** Registry module, server startup. New persistent file.
    - **Progress Update:** Registry persistence implemented.

---

**Phase 3: Flutter `mcp_toolkit` - Registration Client**

- **Objective:** Enable Flutter app (via `mcp_toolkit`) to define and register its service extensions.
- **Scope:** Modifying `mcp_toolkit`'s `MCPCallEntry` and registration logic.

  - **Step 3.1: Augment `MCPCallEntry` in `mcp_toolkit` for Rich Metadata**

    - **Objective:** Allow developers to provide all necessary data for `ToolDefinition`/`ResourceDefinition`.
    - **Scope:**
      - Modify `mcp_toolkit/lib/src/mcp_models.dart` -> `MCPCallEntry`.
      - Add new optional named parameters to its factory constructor:
        - `registrationId` (String): The ID AI will use (e.g., "myAppGetDetails").
        - `displayName` (String).
        - `description` (String).
        - `parametersSchema` (Map<String, dynamic>): JSON schema for inputs.
        - `returnSchema` (Map<String, dynamic>): JSON schema for outputs.
      - The existing `MCPMethodName` will form the basis of `vmServicePath`.
      - Update existing `MCPCallEntry` instantiations (e.g., in `flutter_mcp_toolkit.dart`) to include this new metadata for tools intended for dynamic registration.
    - **Files likely affected:** `mcp_toolkit/lib/src/mcp_models.dart`, `mcp_toolkit/lib/src/toolkits/flutter_mcp_toolkit.dart`.
    - **Progress Update:** `MCPCallEntry` augmented. Examples updated.

  - **Step 3.2: Implement Registration Logic in `MCPToolkitBinding`**

    - **Objective:** Collect augmented `MCPCallEntry` data, format it as `ToolDefinition`/`ResourceDefinition` JSON, and POST to MCP Server.
    - **Scope:**
      - In `mcp_toolkit/lib/src/mcp_toolkit_binding.dart`:
        - Modify or add a method (e.g., triggered during `initialize` or `addEntries`).
        - This method iterates through the provided `Set<MCPCallEntry>`.
        - For each entry, it constructs a `ToolDefinition` (or `ResourceDefinition`) map using:
          - `id`: from `entry.registrationId`.
          - `displayName`: from `entry.displayName`.
          - `description`: from `entry.description`.
          - `vmServicePath`: derived from `entry.key` (the `MCPMethodName`, prefixed like `ext.your_domain.${entry.key}`). The domain might need to be configurable or based on `_mcpServiceExtensionName`.
          - `parametersSchema`: from `entry.parametersSchema`.
          - `returnSchema`: from `entry.returnSchema`.
          - `type`: "tool" (default, or make it configurable in `MCPCallEntry`).
        - Use `package:http` to make a POST request to the configured MCP Server's `/mcp/admin/install` endpoint with the JSON payload.
        - Handle HTTP responses/errors.
        - The MCP Server URL needs to be configurable for the Flutter app (e.g., environment variable).
    - **Files likely affected:** `mcp_toolkit/lib/src/mcp_toolkit_binding.dart`, `mcp_toolkit/pubspec.yaml` (to add `http` package).
    - **Progress Update:** `mcp_toolkit` can collect, format, and send registration requests.

  - **Step 3.3: Trigger Registration on App Startup/Hot Reload in `mcp_toolkit`**
    - **Objective:** Automate the registration.
    - **Scope:**
      - Ensure the new registration logic (Step 3.2) is called within `MCPToolkitBinding.instance.initialize()` or appropriately after `addEntries`.
      - Consider re-registration on hot reload if service extensions might change.
    - **Files likely affected:** `mcp_toolkit/lib/src/mcp_toolkit_binding.dart`.
    - **Progress Update:** `mcp_toolkit` automatically attempts registration on startup/hot reload.

---

**Phase 4: MCP Server - Dynamic Tool Invocation & Discovery**

- **Objective:** Allow AI Assistants to discover and invoke dynamically registered items.
- **Scope:** Modifying MCP Server's service listing and request dispatching.

  - **Step 4.1: Extend MCP Server's Service Discovery (`mcp.listServices`)**

    - **Objective:** Include dynamically registered tools/resources in the list provided to AIs.
    - **Scope:**
      - Modify the `ListToolsRequestSchema` handler in `mcp_server/src/tools/tools_handlers.ts`.
      - When an AI requests `mcp.listServices` (or similar):
        - Fetch statically defined tools (from YAML, as current).
        - Fetch all _active_ dynamically registered services from the registry (Step 2.2), keyed by the server's active DDS connection.
        - Merge these lists (ensuring no ID collisions, or defining precedence) and return them.
    - **Files likely affected:** `mcp_server/src/tools/tools_handlers.ts`, dynamic service registry module.
    - **Progress Update:** Dynamically registered items appear in service discovery.

  - **Step 4.2: Implement Proxying for Dynamic Tool Invocation in MCP Server**
    - **Objective:** Forward AI calls for dynamic tools to the Flutter app's VM Service.
    - **Scope:**
      - In `mcp_server/src/tools/tools_handlers.ts` (CallToolRequestSchema handler):
        - If an incoming request targets a tool ID found in the dynamic registry:
          - Retrieve its `ToolDefinition`.
          - Validate incoming parameters against `parametersSchema`.
          - Use `rpcUtils.callDartVm` with the `vmServicePath` from the definition and the request parameters. The target DDS port is already known to `rpcUtils` for its primary connection.
          - Validate the response against `returnSchema`.
          - Return the result.
        - This largely mirrors how existing YAML-defined tools call `rpcUtils.callDartVm`.
    - **Files likely affected:** `mcp_server/src/tools/tools_handlers.ts`.
    - **Progress Update:** AI can invoke dynamically registered tools.

---

**Phase 5: Enhancements & Robustness**

- **Objective:** Improve reliability and maintainability.
- **Scope:** Stale entry management.

  - **Step 5.1: Implement Stale Entry Management in MCP Server**
    - **Objective:** Handle cases where the Flutter app disconnects.
    - **Scope:**
      - Since the MCP server manages one primary DDS connection, if this connection is lost or changes (e.g., server restarts and connects to a new DDS port for the app), the dynamic registry associated with the _old_ DDS `host:port` should be considered stale.
      - On (re)connection to a DDS, the server could clear any previous dynamic registrations associated with its _new_ target DDS `host:port` before the app sends new ones. Or, rely on the app's re-registration to overwrite.
      - If the connection to the current DDS is lost, dynamically registered tools for that DDS should become unavailable/unlisted until a connection is re-established and tools are re-registered.
    - **Files likely affected:** Dynamic service registry, `RpcUtilities` connection logic.
    - **Progress Update:** Strategy for handling stale registrations is in place.

---

**Phase 6: Documentation & Testing**

- **Objective:** Ensure the system is well-documented and thoroughly tested.
- **Scope:** End-to-end testing and developer documentation.

  - **Step 6.1: Comprehensive End-to-End Testing**

    - **Objective:** Verify the entire flow.
    - **Scope:** Test Flutter apps registering tools; AI discovering and invoking them; persistence; behavior on app/server restarts; error scenarios.
    - **Progress Update:** End-to-end tests passing.

  - **Step 6.2: Update Developer Documentation**
    - **Objective:** Guide developers.
    - **Scope:**
      - `mcp_toolkit`: How to define `MCPCallEntry` with full metadata for dynamic registration.
      - MCP Server: Architecture of dynamic registration, persistence, new admin endpoint.
      - Update `ARCHITECTURE.MD`, `MCP_RPC_DESCRIPTION.MD`.
    - **Files likely affected:** `ARCHITECTURE.MD`, `MCP_RPC_DESCRIPTION.MD`, `mcp_toolkit/README.md`.
    - **Progress Update:** Documentation updated.
