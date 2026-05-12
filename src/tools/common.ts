import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getTask, updateTask, deleteTask, loadArtifact, saveArtifact, listVersions, listAllVersions, attributedLocationId, type SidecarEntry } from "../lib/storage.js";
import { GalleryKindSchema, type GalleryItem, type GalleryKind } from "@filmlanguage/schemas";
import { VERSION } from "../lib/version.js";

/**
 * Parse an artifact URI like `agent://location-scout/bible/loc_001` into
 * `{ type, id }` so the artifact can be loaded/mutated by the storage layer.
 * Falls back gracefully on shapes that don't match the expected pattern.
 */
function parseArtifactUri(uri: string): { type: string; id: string } | null {
  // agent://<agent>/<type>/<id>
  const match = uri.match(/^agent:\/\/[^/]+\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { type: match[1], id: match[2] };
}

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
          version: VERSION,
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
            "list_gallery",
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
    { task_id: z.string().describe("GUID of the task to check") },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ task_id }) => {
      const task = await getTask(task_id);
      if (!task) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: "not_found", task_id }),
          }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            task_id: task.task_id,
            status: task.status,
            progress: task.progress,
            current_step: task.current_step,
            error: task.error ?? null,
          }),
        }],
      };
    },
  );

  // 4. get_task_result
  server.tool(
    "get_task_result",
    "Get the result of a completed async task, including artifact references.",
    { task_id: z.string().describe("GUID of the completed task") },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ task_id }) => {
      const task = await getTask(task_id);
      if (!task) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "not_found", task_id }) }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            task_id: task.task_id,
            status: task.status,
            artifacts: task.artifacts,
            error: task.error,
            // Tool-specific result fields (only present for the producing tool):
            ...(task.mood_state_ids ? { mood_state_ids: task.mood_state_ids } : {}),
            ...(task.scene_to_state_map ? { scene_to_state_map: task.scene_to_state_map } : {}),
            ...(task.setup_map ? { setup_map: task.setup_map } : {}),
          }),
        }],
      };
    },
  );

  // 5. cancel_task
  server.tool(
    "cancel_task",
    "Cancel a running or queued task. Idempotent — cancelling an already-cancelled task is a no-op.",
    { task_id: z.string().describe("GUID of the task to cancel") },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    async ({ task_id }) => {
      const task = await getTask(task_id);
      if (task && (task.status === "accepted" || task.status === "processing")) {
        updateTask(task_id, { status: "failed", error: "cancelled" });
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ task_id, cancelled: true }) }],
      };
    },
  );

  // 6. approve_artifact
  server.tool(
    "approve_artifact",
    "Mark an artifact as approved at its gate. Mutates the artifact's `approval_status` field to 'approved' so downstream Bible First gates unblock.",
    {
      artifact_uri: z.string().describe("MCP resource URI of the artifact, e.g. agent://location-scout/bible/loc_001"),
      notes: z.string().optional().describe("Reviewer notes"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ artifact_uri, notes }) => {
      const parsed = parseArtifactUri(artifact_uri);
      if (parsed) {
        const artifact = await loadArtifact<Record<string, unknown>>(parsed.type, parsed.id);
        if (artifact) {
          artifact.approval_status = "approved";
          if (notes) artifact.approval_notes = notes;
          artifact.approved_at = new Date().toISOString();
          await saveArtifact(parsed.type, parsed.id, artifact);
        }
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ artifact_uri, verdict: "approved", notes }) }],
      };
    },
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
    async ({ artifact_uri, issues, recommendation }) => {
      const parsed = parseArtifactUri(artifact_uri);
      if (parsed) {
        const artifact = await loadArtifact<Record<string, unknown>>(parsed.type, parsed.id);
        if (artifact) {
          artifact.approval_status = "rejected";
          artifact.rejection_issues = issues;
          artifact.rejected_at = new Date().toISOString();
          await saveArtifact(parsed.type, parsed.id, artifact);
        }
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ artifact_uri, verdict: "rejected", issues_count: issues.length, recommendation }) }],
      };
    },
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

  // 10a. list_gallery — location-level gallery aggregator
  //
  // Surfaces every saved image across every kind for a single location, so
  // the UI can render one unified gallery (generated artifacts + user
  // uploads) without enumerating entity ids in advance. Backs the
  // location-level GalleryPage and the "Uploaded" section pattern
  // mirrored from ShotGeneration's GalleryTab.
  server.tool(
    "list_gallery",
    "List every saved image for a location, newest first, across all kinds (anchor/floorplan/isometric/setup/mood_variation/user-ref). Each item carries http_path so the UI can drop it straight into <img src>; clients must not reconstruct URLs. latest_only collapses versionable kinds to the newest per entity_id; user-ref is always returned in full.",
    {
      location_id: z.string().describe("Filter to one location (required)"),
      kinds: z.array(GalleryKindSchema).optional().describe("Restrict to a subset of kinds"),
      latest_only: z.boolean().default(true).describe("When true, versionable kinds collapse to newest per entity_id; user-ref is always returned in full."),
      limit: z.number().int().min(1).max(200).default(48),
      cursor: z.string().optional().describe("Opaque pagination cursor from the previous call. Do NOT mix cursors across different latest_only values."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ location_id, kinds, latest_only, limit, cursor }) => {
      const ALL_KINDS: GalleryKind[] = [
        "anchor", "floorplan", "isometric", "setup", "mood_variation", "user-ref",
      ];
      const targetKinds: GalleryKind[] = kinds && kinds.length > 0 ? kinds : ALL_KINDS;

      // Gather sidecars for every requested kind, then filter by attributed
      // location_id. attributedLocationId() handles the legacy backfill —
      // unattributed sidecars (setup/mood/user-ref pre-migration) return
      // null and are dropped here rather than mis-attributed.
      const collected: SidecarEntry[] = [];
      for (const kind of targetKinds) {
        const entries = await listAllVersions(kind);
        for (const s of entries) {
          if (attributedLocationId(s) === location_id) collected.push(s);
        }
      }

      // Newest-first overall; stable tiebreaker on image_id so pagination
      // cursors stay deterministic when two sidecars share created_at.
      collected.sort((a, b) => {
        if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
        return a.image_id < b.image_id ? 1 : -1;
      });

      // Optional collapse to latest per (kind, entity_id) for versionable
      // kinds; user-ref always passes through because every upload is a
      // standalone asset, not a version.
      let filtered: SidecarEntry[];
      if (latest_only) {
        const seen = new Set<string>();
        filtered = [];
        for (const s of collected) {
          if (s.kind === "user-ref") { filtered.push(s); continue; }
          const key = `${s.kind}:${s.entity_id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          filtered.push(s);
        }
      } else {
        filtered = collected;
      }

      // Cursor is the image_id of the last item from the previous page;
      // we drop everything up to and including that id. Clients must keep
      // latest_only stable across calls (documented in the schema).
      let startIdx = 0;
      if (cursor) {
        const i = filtered.findIndex((s) => s.image_id === cursor);
        if (i >= 0) startIdx = i + 1;
      }
      const page = filtered.slice(startIdx, startIdx + limit);
      const next_cursor = startIdx + limit < filtered.length ? page[page.length - 1].image_id : undefined;

      // Project SidecarEntry → GalleryItem. http_path follows the existing
      // /artifacts routes in src/index.ts:
      //   - latest_only=true & versionable kind → /artifacts/<kind>/<entity_id>.png
      //   - else (user-ref or full history)     → /artifacts/<kind>/v/<image_id>.png
      const items: GalleryItem[] = page.map((s) => {
        const ext = "png"; // sidecars are always PNG in current pipeline
        const useLatestAlias = latest_only && s.kind !== "user-ref";
        const http_path = useLatestAlias
          ? `/artifacts/${encodeURIComponent(s.kind)}/${encodeURIComponent(s.entity_id)}.${ext}`
          : `/artifacts/${encodeURIComponent(s.kind)}/v/${encodeURIComponent(s.image_id)}.${ext}`;
        return {
          image_id: s.image_id,
          kind: s.kind as GalleryKind,
          entity_id: s.entity_id,
          location_id,
          prompt: s.prompt ?? "",
          model: s.model ?? "unknown",
          created_at: s.created_at,
          uri: s.uri,
          http_path,
          ...(s.source_tool ? { source_tool: s.source_tool } : {}),
          ...(s.source_task_id ? { source_task_id: s.source_task_id } : {}),
          ...(s.negative_prompt ? { negative_prompt: s.negative_prompt } : {}),
          ...(s.seed !== undefined ? { seed: s.seed } : {}),
          ...(s.parent_version_id ? { parent_version_id: s.parent_version_id } : {}),
        };
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify({
          location_id,
          items,
          ...(next_cursor ? { next_cursor } : {}),
        }) }],
      };
    },
  );

  // 10. list_versions — gallery read
  server.tool(
    "list_versions",
    "List every saved version of a generated image for a given kind + entity_id, newest first. Reads sidecar JSON files (per prompt-gallery-contract.md §1) and returns the full metadata array so the UI can render a version dropdown, show the prompt used for each generation, and let the user jump between versions.",
    {
      kind: z.string().describe("Artifact kind, e.g. 'anchor', 'isometric', 'setup', 'floorplan', 'mood_variation'"),
      entity_id: z.string().describe("Parent entity id (bible_id, setup_id, variation_id …)"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    async ({ kind, entity_id }) => {
      const versions = await listVersions(kind, entity_id);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ kind, entity_id, versions }) }],
      };
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
    async ({ artifact_uri, feedback: { category } }) => ({
      content: [{ type: "text" as const, text: JSON.stringify({
        error: "capability_not_available",
        tool: "submit_feedback",
        agent: "location-scout-base",
        reason: "Feedback persistence is not yet implemented. Submitted feedback is not stored.",
        alternatives: ["reject_artifact", "request_revision"],
        received_category: category,
        artifact_uri,
      }) }],
      isError: true,
    }),
  );
}
