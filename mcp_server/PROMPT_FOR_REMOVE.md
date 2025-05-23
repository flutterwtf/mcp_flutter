**Objective:**  
Begin the process of removing the forwarding server from the `mcp_server/src` package, ensuring all tools and resources are preserved and redirected to use only the Dart VM backend. Maintain modularity for future backend extension.

**Instructions:**

1. **Read** the plan in `mcp_server/REMOVE_FORWARDING_SERVER_PLAN.md` for a detailed, file-by-file breakdown.
2. **Start with `index.ts`:**
   - Remove all forwarding server config, environment variables, and CLI options.
   - Ensure only Dart VM and MCP server configuration remains.
   - Eliminate all references to the forwarding server.
3. **Proceed file-by-file** as outlined in the plan, making sure:
   - All backend communication is routed through Dart VM (`RpcClient`).
   - No code, config, or logic related to the forwarding server remains.
   - All tools and resources are still available and functional.
   - The codebase remains modular and ready for future backend plugins.
   - **After each file**, summarize the changes and next steps before proceeding.
4. **Document** any tool/resource that cannot be mapped to Dart VM, and provide a stub/error handler if needed.
5. **Update documentation** and comments to clarify extension points for future backends.
6. **Test** after each major step to ensure no regressions.

**Deliverables:**

- Clean, modular codebase with all tools/resources working via Dart VM.
- No forwarding server code or config.
- Updated documentation and comments for future extensibility.

---

**Tip:**  
Work in small, testable increments. After each file or logical unit, run tests and commit with a clear message. If you encounter a tool/resource that cannot be mapped to Dart VM, document it and notify the team.

---

**Example Start:**  
“Begin with `index.ts`. Remove all forwarding server config and references. Refactor CLI and environment handling to only support Dart VM and MCP server. Test to ensure the server starts and basic functionality is intact.”

---

**Prompt improvement tip:**  
If you want the agent to work in a specific order or to provide a progress report after each file, specify that in your prompt.  
Example:
