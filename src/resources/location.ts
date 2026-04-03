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
      // TODO: resolve URI → GCS/store → return content
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
      // TODO: resolve URI → GCS → return image
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
      // TODO: resolve URI → store → return content
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
      // TODO: look up task status
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
      // TODO: resolve URI → GCS/store → return content
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
      // TODO: return JSON schema based on type
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
