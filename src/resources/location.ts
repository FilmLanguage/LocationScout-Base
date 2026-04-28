import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadArtifact, loadImage, getTask } from "../lib/storage.js";
import { S3_BUCKET } from "../lib/api-client.js";
import {
  LocationBibleJsonSchema,
  MoodStateJsonSchema,
  ResearchPackJsonSchema,
} from "@filmlanguage/schemas";

/**
 * MCP Resource handlers for Location Scout.
 * Resources provide read access to artifacts via MCP resource URIs.
 */
export function registerResources(server: McpServer) {

  // ─── Extract ID from URI path ───────────────────────────────────

  function extractId(uri: URL): string {
    const parts = uri.pathname.split("/");
    return parts[parts.length - 1] || "";
  }

  // ─── Location Bible ─────────────────────────────────────────────

  server.resource(
    "bible",
    new ResourceTemplate("agent://location-scout/bible/{location_id}", { list: undefined }),
    {
      description: "Location Bible artifact. Returns location-bible-v2 JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const bible = await loadArtifact("bible", id);

      if (!bible) {
        return { contents: [] };
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(bible),
        }],
      };
    },
  );

  // ─── Anchor Image ───────────────────────────────────────────────

  server.resource(
    "anchor",
    new ResourceTemplate("agent://location-scout/anchor/{location_id}", { list: undefined }),
    {
      description: "Location anchor image metadata. Returns JSON with GCS/S3 URL (not raw bytes).",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const image = await loadImage("anchor", id);

      if (!image) {
        return { contents: [] };
      }

      const url = S3_BUCKET ? `s3://${S3_BUCKET}/anchor/${id}.png` : null;
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ location_id: id, url, mime_type: "image/png" }),
        }],
      };
    },
  );

  // ─── Mood State ─────────────────────────────────────────────────

  server.resource(
    "mood",
    new ResourceTemplate("agent://location-scout/mood/{state_id}", { list: undefined }),
    {
      description: "Mood state delta. Returns mood-state-v1 JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const mood = await loadArtifact("mood", id);

      if (!mood) {
        return { contents: [] };
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(mood),
        }],
      };
    },
  );

  // ─── Floorplan ──────────────────────────────────────────────────

  server.resource(
    "floorplan",
    new ResourceTemplate("agent://location-scout/floorplan/{location_id}", { list: undefined }),
    {
      description: "Location floorplan metadata. Returns JSON with GCS/S3 URL (not raw bytes).",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const image = await loadImage("floorplan", id);

      if (!image) {
        return { contents: [] };
      }

      const url = S3_BUCKET ? `s3://${S3_BUCKET}/floorplan/${id}.png` : null;
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ location_id: id, url, mime_type: "image/png" }),
        }],
      };
    },
  );

  // ─── Isometric Reference ────────────────────────────────────────

  server.resource(
    "isometric",
    new ResourceTemplate("agent://location-scout/isometric/{iso_id}", { list: undefined }),
    {
      description: "Isometric 3D reference image for a location. Returns PNG binary as base64.",
      mimeType: "image/png",
    },
    async (uri) => {
      const id = extractId(uri);
      const image = await loadImage("isometric", id);

      if (!image) {
        return { contents: [] };
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: image.contentType,
          blob: image.data.toString("base64"),
        }],
      };
    },
  );

  // ─── Comparison Report ──────────────────────────────────────────

  server.resource(
    "comparison",
    new ResourceTemplate("agent://location-scout/comparison/{report_id}", { list: undefined }),
    {
      description: "Setup vs anchor comparison report produced by compare_with_anchor. Returns JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const report = await loadArtifact("comparison", id);
      if (!report) return { contents: [] };
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(report),
        }],
      };
    },
  );

  // ─── Setup Extraction ───────────────────────────────────────────

  server.resource(
    "setup",
    new ResourceTemplate("agent://location-scout/setup/{setup_id}", { list: undefined }),
    {
      description: "Per-scene camera setup extraction. Returns JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const setup = await loadArtifact("setup", id);

      if (!setup) {
        return { contents: [] };
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(setup),
        }],
      };
    },
  );

  // ─── Task Status ────────────────────────────────────────────────

  server.resource(
    "task",
    new ResourceTemplate("agent://location-scout/task/{task_id}", { list: undefined }),
    {
      description: "Async task status. Returns task state, progress, and artifacts.",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const task = await getTask(id);

      if (!task) {
        return { contents: [] };
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(task),
        }],
      };
    },
  );

  // ─── Research Pack ──────────────────────────────────────────────

  server.resource(
    "research",
    new ResourceTemplate("agent://location-scout/research/{location_id}", { list: undefined }),
    {
      description: "Research pack with period facts and anachronisms. Returns research-pack-v1 JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const research = await loadArtifact("research", id);

      if (!research) {
        return { contents: [] };
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(research),
        }],
      };
    },
  );

  // ─── Schema (JSON Schema export) ────────────────────────────────

  const schemaMap: Record<string, unknown> = {
    "location-bible": LocationBibleJsonSchema,
    "mood-state": MoodStateJsonSchema,
    "research-pack": ResearchPackJsonSchema,
  };

  server.resource(
    "schema",
    new ResourceTemplate("agent://location-scout/schema/{type}", { list: undefined }),
    {
      description: "JSON Schema for agent's artifact types. Supported: location-bible, mood-state, research-pack.",
      mimeType: "application/json",
    },
    async (uri) => {
      const type = extractId(uri);
      const schema = schemaMap[type];

      if (!schema) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              error: "unknown_schema_type",
              type,
              available: Object.keys(schemaMap),
            }),
          }],
        };
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(schema),
        }],
      };
    },
  );
}
