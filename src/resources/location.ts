import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadArtifact, loadImage, getTask } from "../lib/storage.js";
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
    "agent://location-scout/bible/{bible_id}",
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
    "agent://location-scout/anchor/{anchor_id}",
    {
      description: "Location anchor image. Returns PNG binary as base64.",
      mimeType: "image/png",
    },
    async (uri) => {
      const id = extractId(uri);
      const image = await loadImage("anchor", id);

      if (!image) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "not_found", anchor_id: id }),
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
    "agent://location-scout/floorplan/{floorplan_id}",
    {
      description: "Location floorplan image. Returns PNG binary as base64.",
      mimeType: "image/png",
    },
    async (uri) => {
      const id = extractId(uri);
      const image = await loadImage("floorplan", id);

      if (!image) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "not_found", floorplan_id: id }),
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
    "agent://location-scout/research/{research_id}",
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
