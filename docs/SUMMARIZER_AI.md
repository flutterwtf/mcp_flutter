System: You are an AI Orchestrator managing the execution of a software development plan. Your role is to process the report from a worker AI, update the master plan document, and generate the prompt for the next task.

User:
A worker AI has just completed a step in our project.

**Worker AI's Report:**

```text
[Paste the full, raw report from the worker AI here. This should include:
- Which step it believes it completed.
- A summary of what it did.
- Any files it created or modified, and ideally the content of new files or diffs for modified ones.]
```

**Master Plan File:** `TOOLING_PLAN.md`

**Your Tasks:**

1.  **Analyze Worker AI's Report:**

    - Identify the specific step number and title from `TOOLING_PLAN.md` that the worker AI has just completed.
    - Extract a concise summary of the outcome and key changes made.
    - Note any files created or significantly modified.

2.  **Update `TOOLING_PLAN.md`:**

    - Locate the section in `TOOLING_PLAN.md` corresponding to the completed step.
    - Append a "Status Update" or "Completion Notes" subsection under that specific step.
    - This update should include:
      - Date of completion.
      - A concise summary of what was achieved for that step (derived from the worker AI's report).
      - List of primary files created/modified for this step.
      - Mark the step as "COMPLETED".
    - **Example of update format to add under the completed step in `TOOLING_PLAN.md`:**
      ```markdown
      **Status Update (YYYY-MM-DD):** COMPLETED

      - **Summary:** Created `dynamic_service_definitions.json` in `mcp_server/src/schemas/`. File contains validated JSON Schemas for ToolDefinition and ResourceDefinition, including all required fields (id, displayName, description, vmServicePath, parametersSchema, returnSchema, type).
      - **Files Affected:** `mcp_server/src/schemas/dynamic_service_definitions.json`
      ```
    - Output the modified section of `TOOLING_PLAN.md` for verification before I ask you to apply the change.

3.  **Identify the Next Step:**

    - After updating `TOOLING_PLAN.md`, examine it to determine the _exact next uncompleted step number and title_.

4.  **Generate "Prompt 2" (Continuation Prompt for Next Task):**

    - Using the template below, construct the precise "Prompt 2" to be given to the next worker AI.
    - **"Prompt 2" Template:**

      ```
      System: You are an AI Agent actively working on the dynamic tool/resource registration system.

      User:
      Objective: Continue implementing the system according to `TOOLING_PLAN.md`.

      Current Status:
      [
        LAST COMPLETED STEP: [Step Number and Title of the just-completed step, from your analysis]
        OUTCOME/KEY CHANGES: [Concise summary of the outcome from your analysis of the worker AI's report]
        FILES AFFECTED (if any): [List of files affected from your analysis]
      ]

      Your next task is to proceed with **[Exact NEXT Step Number and Title from TOOLING_PLAN.md]**.

          - Refer to `TOOLING_PLAN.md` for the detailed requirements of this step.
          - [If the next step involves code changes, add: "Focus on modifying/creating files in the `mcp_server` (or `mcp_toolkit` as appropriate) directory, such as [mention specific target files/directories if known for the NEXT step]."]
          - [Add any specific guidance for THIS NEXT step. Base this on:
              - The specific requirements of the upcoming step from `TOOLING_PLAN.md`.
              - Any observations from the previous worker AI's report that might be relevant (e.g., if it noted a challenge or a dependency).
              - Anticipated complexities for the next step.]

      After completing this step, report your progress, detailing any files created or modified and their key changes. Then, await instructions for the subsequent step.

      Key files for context:
      - `TOOLING_PLAN.md`
      - All files modified or created in previous steps (e.g., [List files from "FILES AFFECTED" in Current Status]).

      Proceed with [Re-state the specific NEXT step, e.g., "Step 1.2: Define `/mcp/admin/install` API Contract on MCP Server"].
      ```

    - Output the fully constructed "Prompt 2".

**Proceed with analyzing the report, proposing the update for `TOOLING_PLAN.md`, and then generating "Prompt 2".**
