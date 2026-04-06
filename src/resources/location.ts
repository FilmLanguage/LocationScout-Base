import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * MCP Resource handlers for Location Scout.
 * Resources provide read access to artifacts via MCP resource URIs.
 */
export function registerResources(server: McpServer) {

  // Location Bible resource
  server.resource(
    "bible",
    "agent://location-scout/bible/{bible_id}",
    {
      description: "Location Bible artifact. Returns location-bible-v2 JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      // STUB: When GCS storage is wired, resolve bible_id from URI path,
      // fetch JSON from gs://fl-bibles/{bible_id}.json, return parsed content.
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ error: "not_implemented" }),
        }],
      };
    },
  );

  // Anchor image resource
  server.resource(
    "anchor",
    "agent://location-scout/anchor/{anchor_id}",
    {
      description: "Location anchor image. Returns PNG binary.",
      mimeType: "image/png",
    },
    async (uri) => {
      // STUB: When GCS storage is wired, resolve anchor_id from URI path,
      // fetch PNG from gs://fl-anchors/{anchor_id}.png, return as blob.
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ error: "not_implemented" }),
        }],
      };
    },
  );

  // Mood state resource
  server.resource(
    "mood",
    "agent://location-scout/mood/{state_id}",
    {
      description: "Mood state delta. Returns mood-state-v1 JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      // STUB: When GCS storage is wired, resolve state_id from URI path,
      // fetch JSON from gs://fl-moods/{state_id}.json.
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ error: "not_implemented" }),
        }],
      };
    },
  );

  // Floorplan resource
  server.resource(
    "floorplan",
    "agent://location-scout/floorplan/{floorplan_id}",
    {
      description: "Location floorplan image. Returns PNG binary.",
      mimeType: "image/png",
    },
    async (uri) => {
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ error: "not_implemented" }),
        }],
      };
    },
  );

  // Setup extraction resource
  server.resource(
    "setup",
    "agent://location-scout/setup/{setup_id}",
    {
      description: "Per-scene camera setup extraction. Returns JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ error: "not_implemented" }),
        }],
      };
    },
  );

  // Task resource (required by all agents)
  server.resource(
    "task",
    "agent://location-scout/task/{task_id}",
    {
      description: "Async task status. Subscribe for real-time updates.",
      mimeType: "application/json",
    },
    async (uri) => {
      // STUB: When task store is wired, look up task_id in in-memory
      // task map or Redis, return {status, progress, current_step}.
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ status: "unknown" }),
        }],
      };
    },
  );

  // Research pack resource
  server.resource(
    "research",
    "agent://location-scout/research/{research_id}",
    {
      description: "Research pack with period facts and anachronisms. Returns research-pack-v1 JSON.",
      mimeType: "application/json",
    },
    async (uri) => {
      // STUB: When GCS storage is wired, resolve research_id from URI path,
      // fetch JSON from gs://fl-research/{research_id}.json.
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ error: "not_implemented" }),
        }],
      };
    },
  );

  // Schema resource (required by all agents)
  server.resource(
    "schema",
    "agent://location-scout/schema/{type}",
    {
      description: "JSON Schema for agent's artifact types.",
      mimeType: "application/json",
    },
    async (uri) => {
      // STUB: Parse {type} from URI, look up matching JsonSchema export
      // from @filmlanguage/schemas (e.g. LocationBibleJsonSchema).
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ error: "not_implemented" }),
        }],
      };
    },
  );
}
