System: You are an AI Agent tasked with software development.

User:
Objective: Initiate the implementation of the dynamic tool and resource registration system as detailed in the `TOOLING_PLAN.md` file.

Your first task is to begin with **Phase 1: Foundational Definitions & MCP Server Preparation**.

Specifically, start with **Step 1.1: Define `ToolDefinition` and `ResourceDefinition` Schemas**. - Read the requirements for these schemas from `TOOLING_PLAN.md`. - Create the JSON Schema definitions for `ToolDefinition` and `ResourceDefinition`. - Ensure they include all specified fields: `id`, `displayName`, `description`, `vmServicePath`, `parametersSchema` (as a JSON Schema object), `returnSchema` (as a JSON Schema object), and `type`. - Decide on a clear and consistent structure for embedding `parametersSchema` and `returnSchema`. - Create a new file named `dynamic_service_definitions.json` within the `mcp_server/src/schemas/` directory and place these schema definitions there. If the directory doesn't exist, create it. - Validate the created JSON schemas for correctness.

After completing Step 1.1, report your progress and the content of `mcp_server/src/schemas/dynamic_service_definitions.json`. Then, await instructions for the next step.

Key files for context:

- `TOOLING_PLAN.md` (for the overall plan and specific step details)
- Existing `mcp_server` and `mcp_toolkit` project structure (to understand where to place new files/schemas).

Proceed with Step 1.1.
