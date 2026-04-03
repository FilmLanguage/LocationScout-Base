import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerCommonTools(server: McpServer) {

  // 1. ping
  server.tool(
    "ping",
    "Health check. Returns server status, version, and uptime in seconds.",
    {},
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async () => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "ok",
          version: "1.0.0",
          uptime_seconds: Math.floor(process.uptime()),
        }),
      }],
    }),
  );

  // 2. get_info
  server.tool(
    "get_info",
    "Agent metadata: name, role, capabilities, supported schema versions.",
    {},
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async () => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          name: "location-scout-base",
          role: "Location research, Bible writing, anchor generation, mood states, spatial planning",
          capabilities: [
            "research_era", "write_bible", "generate_anchor",
            "create_mood_states", "create_floorplan", "extract_setups", "scout_location",
            "add_fact", "add_anachronism", "manual_setup_input",
            "compare_with_anchor", "get_setup_prompt", "get_outputs",
            "apply_mood_suggestion", "dismiss_mood_suggestion", "add_mood_variation",
          ],
          schema_versions: {
            "location-bible": "v2",
            "mood-state": "v1",
            "research-pack": "v1",
          },
        }),
      }],
    }),
  );

  // 3. get_task_status
  server.tool(
    "get_task_status",
    "Get current status of an async task. Returns state (accepted/processing/completed/failed), progress (0.0-1.0), and current_step description.",
    { task_id: z.string().describe("UUID of the task to check") },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ task_id }) => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({ task_id, status: "processing", progress: 0.5, current_step: "..." }),
      }],
    }),
  );

  // 4. get_task_result
  server.tool(
    "get_task_result",
    "Get the result of a completed async task, including artifact references.",
    { task_id: z.string().describe("UUID of the completed task") },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ task_id }) => ({
      content: [{ type: "text" as const, text: JSON.stringify({ task_id, status: "completed", artifacts: [] }) }],
    }),
  );

  // 5. cancel_task
  server.tool(
    "cancel_task",
    "Cancel a running or queued task. Idempotent — cancelling an already-cancelled task is a no-op.",
    { task_id: z.string().describe("UUID of the task to cancel") },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    async ({ task_id }) => ({
      content: [{ type: "text" as const, text: JSON.stringify({ task_id, cancelled: true }) }],
    }),
  );

  // 6. approve_artifact
  server.tool(
    "approve_artifact",
    "Mark an artifact as approved at its gate. Called by orchestrator after reviewer approves.",
    {
      artifact_uri: z.string().describe("MCP resource URI of the artifact, e.g. agent://location-scout/bible/loc_001"),
      notes: z.string().optional().describe("Reviewer notes"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ artifact_uri, notes }) => ({
      content: [{ type: "text" as const, text: JSON.stringify({ artifact_uri, verdict: "approved", notes }) }],
    }),
  );

  // 7. reject_artifact
  server.tool(
    "reject_artifact",
    "Reject an artifact at its gate with a list of issues. Triggers revision workflow.",
    {
      artifact_uri: z.string().describe("MCP resource URI of the artifact"),
      issues: z.array(z.object({
        severity: z.enum(["critical", "warning", "info"]),
        field: z.string().optional().describe("JSON path to problematic field"),
        issue: z.string().describe("What is wrong"),
        suggestion: z.string().optional().describe("How to fix it"),
      })).describe("List of issues found"),
      recommendation: z.string().describe("Summary of what needs to change"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ artifact_uri, issues, recommendation }) => ({
      content: [{ type: "text" as const, text: JSON.stringify({ artifact_uri, verdict: "rejected", issues_count: issues.length, recommendation }) }],
    }),
  );

  // 8. request_revision
  server.tool(
    "request_revision",
    "Request that the agent revise a specific artifact. Returns a new task_id for the revision.",
    {
      artifact_uri: z.string().describe("MCP resource URI of the artifact to revise"),
      changes: z.array(z.object({
        field: z.string().describe("JSON path to change"),
        instruction: z.string().describe("What to change"),
      })).describe("Specific changes requested"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    async ({ artifact_uri, changes }) => {
      const task_id = crypto.randomUUID();
      return { content: [{ type: "text" as const, text: JSON.stringify({ task_id, artifact_uri, changes_count: changes.length }) }] };
    },
  );

  // 9. submit_feedback
  server.tool(
    "submit_feedback",
    "Send structured feedback on an artifact without triggering a formal gate. Used for advisory notes.",
    {
      artifact_uri: z.string().describe("MCP resource URI of the artifact"),
      feedback: z.object({
        category: z.enum(["creative", "technical", "accuracy", "consistency"]),
        message: z.string(),
        priority: z.enum(["low", "normal", "high"]).default("normal"),
        references: z.array(z.string()).optional().describe("URIs of related artifacts"),
      }),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ artifact_uri, feedback }) => ({
      content: [{ type: "text" as const, text: JSON.stringify({ artifact_uri, received: true, category: feedback.category }) }],
    }),
  );
}
