import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
    "agent://location-scout/bible/{location_id}",
    {
      description: "Location Bible artifact. Returns location-bible-v2 JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const bible = await loadArtifact("bible", id);

      if (!bible) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "not_found", bible_id: id }),
          }],
        };
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
    "agent://location-scout/anchor/{location_id}",
    {
      description: "Location anchor image metadata. Returns JSON with GCS/S3 URL (not raw bytes).",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const image = await loadImage("anchor", id);

      if (!image) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "not_found", location_id: id }),
          }],
        };
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
    "agent://location-scout/mood/{state_id}",
    {
      description: "Mood state delta. Returns mood-state-v1 JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const mood = await loadArtifact("mood", id);

      if (!mood) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "not_found", state_id: id }),
          }],
        };
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
    "agent://location-scout/floorplan/{location_id}",
    {
      description: "Location floorplan metadata. Returns JSON with GCS/S3 URL (not raw bytes).",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const image = await loadImage("floorplan", id);

      if (!image) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "not_found", location_id: id }),
          }],
        };
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
    "agent://location-scout/isometric/{iso_id}",
    {
      description: "Isometric 3D reference image for a location. Returns PNG binary as base64.",
      mimeType: "image/png",
    },
    async (uri) => {
      const id = extractId(uri);
      const image = await loadImage("isometric", id);

      if (!image) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "not_found", iso_id: id }),
          }],
        };
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
    "agent://location-scout/comparison/{report_id}",
    {
      description: "Setup vs anchor comparison report produced by compare_with_anchor. Returns JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const report = await loadArtifact("comparison", id);
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: report ? JSON.stringify(report) : JSON.stringify({ error: "not_found", report_id: id }),
        }],
      };
    },
  );

  // ─── Setup Extraction ───────────────────────────────────────────

  server.resource(
    "setup",
    "agent://location-scout/setup/{setup_id}",
    {
      description: "Per-scene camera setup extraction. Returns JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const setup = await loadArtifact("setup", id);

      if (!setup) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "not_found", setup_id: id }),
          }],
        };
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
    "agent://location-scout/task/{task_id}",
    {
      description: "Async task status. Returns task state, progress, and artifacts.",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const task = getTask(id);

      if (!task) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "not_found", task_id: id }),
          }],
        };
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
    "agent://location-scout/research/{location_id}",
    {
      description: "Research pack with period facts and anachronisms. Returns research-pack-v1 JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      const id = extractId(uri);
      const research = await loadArtifact("research", id);

      if (!research) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "not_found", research_id: id }),
          }],
        };
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
    "agent://location-scout/schema/{type}",
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
