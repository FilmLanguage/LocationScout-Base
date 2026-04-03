import { Express } from "express";
import swaggerUi from "swagger-ui-express";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Location Scout — MCP Agent",
    version: "1.0.0",
    description:
      "Film Language Location Scout agent. Provides location research, Bible writing, anchor image generation, mood states, floorplans, and camera setup extraction.\n\n" +
      "**Transport**: MCP Streamable HTTP (JSON-RPC 2.0 over POST).\n\n" +
      "All domain tools are called via `POST /mcp` using the JSON-RPC `tools/call` method. " +
      "Resources are read via `resources/read`.",
  },
  servers: [
    {
      url: "https://fl-location-scout-base-832023632178.us-central1.run.app",
      description: "Cloud Run (production)",
    },
    { url: "http://localhost:8080", description: "Local dev" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check (HTTP)",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    version: { type: "string", example: "1.0.0" },
                    uptime_seconds: { type: "integer", example: 42 },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/mcp": {
      post: {
        tags: ["MCP"],
        summary: "MCP Streamable HTTP endpoint",
        description:
          "Single endpoint for all MCP operations: initialize, tools/list, tools/call, resources/list, resources/read.\n\n" +
          "Client must send `Accept: application/json, text/event-stream`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/JsonRpcRequest" },
              examples: {
                initialize: {
                  summary: "Initialize session",
                  value: {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "initialize",
                    params: {
                      protocolVersion: "2025-03-26",
                      capabilities: {},
                      clientInfo: { name: "my-client", version: "1.0" },
                    },
                  },
                },
                list_tools: {
                  summary: "List available tools",
                  value: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
                },
                call_ping: {
                  summary: "Call ping tool",
                  value: {
                    jsonrpc: "2.0",
                    id: 3,
                    method: "tools/call",
                    params: { name: "ping", arguments: {} },
                  },
                },
                call_scout_location: {
                  summary: "Call scout_location",
                  value: {
                    jsonrpc: "2.0",
                    id: 4,
                    method: "tools/call",
                    params: {
                      name: "scout_location",
                      arguments: {
                        project_id: "my-project-uuid",
                        location_brief: {
                          location_id: "loc_001",
                          location_name: "Jesse Apartment - Living Room",
                          location_type: "INT",
                          time_of_day: ["DAY", "NIGHT"],
                          era: "2004 Albuquerque",
                          scenes: ["sc_001", "sc_005"],
                          recurring: true,
                          character_actions: ["cooking", "pacing"],
                          required_practicals: ["TV glow", "kitchen fluorescent"],
                          props_mentioned: ["pizza box", "cell phone"],
                          explicit_details: ["stained carpet", "blinds half-open"],
                        },
                        director_vision: {
                          era_style: "Early 2000s suburban decay",
                          palette: "Desaturated yellows and greens",
                          spatial_philosophy: "Claustrophobic, walls closing in",
                          reference_films: ["Traffic (2000)", "Requiem for a Dream (2000)"],
                          atmosphere: "Oppressive mundanity",
                        },
                        priority: "high",
                      },
                    },
                  },
                },
                list_resources: {
                  summary: "List available resources",
                  value: { jsonrpc: "2.0", id: 5, method: "resources/list", params: {} },
                },
                read_resource: {
                  summary: "Read a resource",
                  value: {
                    jsonrpc: "2.0",
                    id: 6,
                    method: "resources/read",
                    params: { uri: "agent://location-scout/bible/loc_001" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "JSON-RPC response or SSE stream",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JsonRpcResponse" },
              },
              "text/event-stream": {
                schema: { type: "string", description: "Server-Sent Events stream" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      JsonRpcRequest: {
        type: "object",
        required: ["jsonrpc", "id", "method"],
        properties: {
          jsonrpc: { type: "string", enum: ["2.0"] },
          id: { type: "integer" },
          method: {
            type: "string",
            enum: [
              "initialize",
              "tools/list",
              "tools/call",
              "resources/list",
              "resources/read",
            ],
          },
          params: { type: "object" },
        },
      },
      JsonRpcResponse: {
        type: "object",
        properties: {
          jsonrpc: { type: "string", enum: ["2.0"] },
          id: { type: "integer" },
          result: { type: "object" },
          error: {
            type: "object",
            properties: {
              code: { type: "integer" },
              message: { type: "string" },
            },
          },
        },
      },
      LocationBrief: {
        type: "object",
        required: ["location_id", "location_name", "location_type", "time_of_day", "era", "scenes", "recurring"],
        properties: {
          location_id: { type: "string", example: "loc_001" },
          location_name: { type: "string", example: "Jesse Apartment - Living Room" },
          location_type: { type: "string", enum: ["INT", "EXT", "INT/EXT"] },
          time_of_day: { type: "array", items: { type: "string" }, example: ["DAY", "NIGHT"] },
          era: { type: "string", example: "2004 Albuquerque" },
          scenes: { type: "array", items: { type: "string" }, example: ["sc_001", "sc_005"] },
          recurring: { type: "boolean" },
          character_actions: { type: "array", items: { type: "string" } },
          required_practicals: { type: "array", items: { type: "string" } },
          props_mentioned: { type: "array", items: { type: "string" } },
          explicit_details: { type: "array", items: { type: "string" } },
        },
      },
      DirectorVision: {
        type: "object",
        required: ["era_style"],
        properties: {
          era_style: { type: "string", example: "Early 2000s suburban decay" },
          palette: { type: "string" },
          spatial_philosophy: { type: "string" },
          reference_films: { type: "array", items: { type: "string" } },
          atmosphere: { type: "string" },
          light_vision: { type: "string" },
        },
      },
      ToolsReference: {
        type: "object",
        description:
          "Reference of all MCP tools. Call via POST /mcp with method: tools/call, params: {name, arguments}",
        properties: {
          domain_tools: {
            type: "object",
            description: "Location Scout domain tools",
            properties: {
              scout_location: {
                type: "string",
                description:
                  "Full pipeline: research → Bible → anchor → floorplan. Args: project_id, location_brief, director_vision, priority",
              },
              research_era: {
                type: "string",
                description:
                  "Historical research for a location. Args: location_brief, director_vision",
              },
              write_bible: {
                type: "string",
                description:
                  "Generate Location Bible v2. Args: location_brief, research_pack_uri, director_vision",
              },
              generate_anchor: {
                type: "string",
                description:
                  "Generate anchor image for approved Bible. Args: bible_uri, generation_params?",
              },
              create_mood_states: {
                type: "string",
                description:
                  "Mood state deltas per scene group. Args: bible_uri, scene_groups[]",
              },
              create_floorplan: {
                type: "string",
                description: "Spatial layout from Bible. Args: bible_uri",
              },
              extract_setups: {
                type: "string",
                description:
                  "Camera setups from floorplan + mood states. Args: floorplan_uri, mood_state_uris[]",
              },
              get_bible: {
                type: "string",
                description: "Read Location Bible. Args: bible_id",
              },
              get_mood_state: {
                type: "string",
                description: "Read mood state. Args: state_id",
              },
              check_era_accuracy: {
                type: "string",
                description:
                  "Validate Bible vs research for anachronisms. Args: bible_uri, research_pack_uri",
              },
              check_consistency: {
                type: "string",
                description:
                  "Cross-check Bible, anchor, mood states. Args: bible_uri, anchor_uri?, mood_state_uris?[]",
              },
              add_fact: {
                type: "string",
                description:
                  "Add period fact to research pack (W2). Args: research_pack_uri, fact, detail?",
              },
              add_anachronism: {
                type: "string",
                description:
                  "Add anachronism to negative list (W2). Args: target_uri, item, severity?",
              },
              manual_setup_input: {
                type: "string",
                description:
                  "Manually add/edit camera setup (W4). Args: location_id, setup{camera_x, camera_y, angle, lens_mm, characters[], composition, scene_id}",
              },
              compare_with_anchor: {
                type: "string",
                description:
                  "Compare setup image vs anchor (W5). Async. Args: setup_uri, anchor_uri",
              },
              get_setup_prompt: {
                type: "string",
                description:
                  "Get generation prompt for a setup (W5). Args: setup_id",
              },
              get_outputs: {
                type: "string",
                description:
                  "Get all output artifacts grouped by consumer (W7). Args: location_id?, project_id?",
              },
              apply_mood_suggestion: {
                type: "string",
                description:
                  "Apply AI mood suggestion (W6). Args: setup_id, suggestion_id",
              },
              dismiss_mood_suggestion: {
                type: "string",
                description:
                  "Dismiss AI mood suggestion (W6). Args: setup_id, suggestion_id",
              },
              add_mood_variation: {
                type: "string",
                description:
                  "Add mood variation + trigger generation (W6). Async. Args: setup_id, mood_config{direction?, time_of_day?, color_temp_k?, ...}",
              },
            },
          },
          common_tools: {
            type: "object",
            description: "Common agent tools (all agents share these)",
            properties: {
              ping: { type: "string", description: "Health check. Args: none" },
              get_info: { type: "string", description: "Agent metadata. Args: none" },
              get_task_status: { type: "string", description: "Async task status. Args: task_id" },
              get_task_result: { type: "string", description: "Completed task result. Args: task_id" },
              cancel_task: { type: "string", description: "Cancel running task. Args: task_id" },
              approve_artifact: {
                type: "string",
                description: "Approve artifact at gate. Args: artifact_uri, notes?",
              },
              reject_artifact: {
                type: "string",
                description:
                  "Reject artifact with issues. Args: artifact_uri, issues[], recommendation",
              },
              request_revision: {
                type: "string",
                description:
                  "Request artifact revision. Args: artifact_uri, changes[]",
              },
              submit_feedback: {
                type: "string",
                description:
                  "Advisory feedback. Args: artifact_uri, feedback{category, message, priority, references?}",
              },
            },
          },
        },
      },
      ResourcesReference: {
        type: "object",
        description:
          "MCP resources. Read via POST /mcp with method: resources/read, params: {uri}",
        properties: {
          "agent://location-scout/bible/{id}": {
            type: "string",
            description: "Location Bible v2 JSON",
          },
          "agent://location-scout/anchor/{id}": {
            type: "string",
            description: "Anchor image PNG",
          },
          "agent://location-scout/mood/{id}": {
            type: "string",
            description: "Mood state v1 JSON",
          },
          "agent://location-scout/floorplan/{id}": {
            type: "string",
            description: "Floorplan PNG",
          },
          "agent://location-scout/setup/{id}": {
            type: "string",
            description: "Camera setup extraction JSON",
          },
          "agent://location-scout/research/{id}": {
            type: "string",
            description: "Research pack v1 JSON (period facts + anachronisms)",
          },
          "agent://location-scout/task/{id}": {
            type: "string",
            description: "Async task status JSON",
          },
          "agent://location-scout/schema/{type}": {
            type: "string",
            description: "JSON Schema for artifact types",
          },
        },
      },
    },
  },
  tags: [
    { name: "System", description: "HTTP health check" },
    { name: "MCP", description: "MCP Streamable HTTP transport (JSON-RPC 2.0)" },
  ],
};

export function mountSwagger(app: Express) {
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec, {
    customSiteTitle: "Location Scout API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
  }));
  app.get("/openapi.json", (_req, res) => res.json(spec));
}
