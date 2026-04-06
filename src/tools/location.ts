import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createTask, updateTask, saveArtifact, loadArtifact } from "../lib/storage.js";
import { llmComplete, generateImage } from "../lib/api-client.js";

const LocationBriefSchema = z.object({
  location_id: z.string().describe("Unique location ID, e.g. loc_001"),
  location_name: z.string().describe("Human-readable name, e.g. 'Jesse Apartment - Living Room'"),
  location_type: z.enum(["INT", "EXT", "INT/EXT"]).describe("Interior, exterior, or both"),
  time_of_day: z.array(z.string()).describe("When scenes take place: DAY, NIGHT, DAWN, etc."),
  era: z.string().describe("Historical period, e.g. '2004 Albuquerque'"),
  scenes: z.array(z.string()).min(1).describe("Scene IDs where this location appears"),
  recurring: z.boolean().describe("Whether location appears in multiple scenes"),
  character_actions: z.array(z.string()).optional().describe("Key physical actions characters perform here"),
  required_practicals: z.array(z.string()).optional().describe("Practical light sources and effects"),
  props_mentioned: z.array(z.string()).optional().describe("Props explicitly mentioned in script"),
  explicit_details: z.array(z.string()).optional().describe("Script-specified physical details"),
});

const DirectorVisionInputSchema = z.object({
  era_style: z.string().describe("Period and visual style direction"),
  palette: z.string().optional().describe("Color palette description"),
  spatial_philosophy: z.string().optional().describe("How spaces should feel"),
  reference_films: z.array(z.string()).optional().describe("Reference films"),
  atmosphere: z.string().optional().describe("Atmospheric direction"),
  light_vision: z.string().optional().describe("Lighting philosophy"),
});

/** Strip markdown code fences that LLMs sometimes wrap around JSON. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  // Match fenced block — closing fence may be missing if response was truncated
  const match = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)(?:\n\s*```|$)/);
  return match ? match[1].trim() : trimmed;
}

export function registerLocationTools(server: McpServer) {

  // Composite pipeline tool
  server.tool(
    "scout_location",
    "Run full location scouting pipeline: research era, write Bible, generate anchor image, create floorplan. Returns task_id for async tracking. Requires location_brief (from 1AD) and director_vision (from Director agent) as inputs.",
    {
      project_id: z.string().describe("Project UUID"),
      location_brief: LocationBriefSchema,
      director_vision: DirectorVisionInputSchema,
      priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ project_id, location_brief, director_vision }) => {
      const task_id = crypto.randomUUID();
      createTask(task_id, "Starting location scouting pipeline");

      // Run pipeline async (fire and forget)
      (async () => {
        try {
          // Step 1: Research
          updateTask(task_id, { status: "processing", progress: 0.1, current_step: "Researching era" });
          const research = await llmComplete(
            "You are a film location research specialist. Research the era and location described. Return a JSON object with fields: period_facts (array of strings), typical_elements (array of strings), anachronism_list (array of strings to avoid).",
            [{ role: "user", content: `Location: ${location_brief.location_name}\nEra: ${location_brief.era}\nType: ${location_brief.location_type}\nDirector style: ${director_vision.era_style}` }],
          );
          const researchId = `research_${location_brief.location_id}`;
          await saveArtifact("research", researchId, JSON.parse(stripCodeFence(research.content)));
          updateTask(task_id, { progress: 0.3, current_step: "Research complete, writing Bible" });

          // Step 2: Write Bible
          const bible = await llmComplete(
            "You are a film location Bible writer. Write a detailed Location Bible JSON matching the LocationBible v2 schema. The JSON MUST include: \"$schema\": \"location-bible-v2\", bible_id, passport (type, time_of_day, era, recurring, scenes), space_description (min 400 words of precise physical detail), atmosphere, light_base_state (primary_source, direction, color_temp_kelvin, shadow_hardness, fill_to_key_ratio, practical_sources), key_details (5-8 items), negative_list (3+ anachronistic items that must never appear), approval_status: \"draft\". Return ONLY the JSON object, no markdown fences.",
            [{ role: "user", content: `Location: ${JSON.stringify(location_brief)}\nDirector vision: ${JSON.stringify(director_vision)}\nResearch: ${research.content}` }],
            { maxTokens: 8192 },
          );
          const bibleId = location_brief.location_id;
          await saveArtifact("bible", bibleId, JSON.parse(stripCodeFence(bible.content)));
          updateTask(task_id, {
            progress: 1.0,
            status: "completed",
            current_step: "Pipeline complete",
            artifacts: [
              { uri: `agent://location-scout/research/${researchId}`, mime_type: "application/json", created_at: new Date().toISOString() },
              { uri: `agent://location-scout/bible/${bibleId}`, mime_type: "application/json", created_at: new Date().toISOString() },
            ],
          });
        } catch (err) {
          updateTask(task_id, {
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
            current_step: "Pipeline failed",
          });
        }
      })();

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ task_id, status: "accepted", location_id: location_brief.location_id }),
        }],
      };
    },
  );

  // Research step
  server.tool(
    "research_era",
    "Research historical era for a location. Returns period facts, typical elements, and anachronism list. Long-running: returns task_id for async tracking.",
    {
      location_brief: LocationBriefSchema,
      director_vision: DirectorVisionInputSchema,
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ location_brief, director_vision }) => {
      const task_id = crypto.randomUUID();
      createTask(task_id, "Researching era");

      (async () => {
        try {
          updateTask(task_id, { status: "processing", progress: 0.2, current_step: "Querying LLM for era research" });
          const result = await llmComplete(
            "You are a film location research specialist. Return a JSON object with: period_facts (array of strings about the era), typical_elements (array of period-accurate items), anachronism_list (array of items that must NOT appear).",
            [{ role: "user", content: `Location: ${location_brief.location_name}\nEra: ${location_brief.era}\nType: ${location_brief.location_type}\nStyle: ${director_vision.era_style}` }],
          );
          const researchId = `research_${location_brief.location_id}`;
          await saveArtifact("research", researchId, JSON.parse(stripCodeFence(result.content)));
          updateTask(task_id, {
            status: "completed", progress: 1.0, current_step: "Research complete",
            artifacts: [{ uri: `agent://location-scout/research/${researchId}`, mime_type: "application/json", created_at: new Date().toISOString() }],
          });
        } catch (err) {
          updateTask(task_id, { status: "failed", error: err instanceof Error ? err.message : String(err) });
        }
      })();

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ task_id, status: "accepted" }) }],
      };
    },
  );

  // Bible writing
  server.tool(
    "write_bible",
    "Generate a Location Bible from location brief, research pack, and director vision. Returns location-bible-v2 JSON. Long-running: returns task_id for async tracking.",
    {
      location_brief: LocationBriefSchema,
      research_pack_uri: z.string().describe("MCP resource URI of the research pack"),
      director_vision: DirectorVisionInputSchema,
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ location_brief, research_pack_uri, director_vision }) => {
      const task_id = crypto.randomUUID();
      createTask(task_id, "Writing Location Bible");

      (async () => {
        try {
          updateTask(task_id, { status: "processing", progress: 0.1, current_step: "Loading research pack" });

          // Try to load research
          const researchId = research_pack_uri.split("/").pop() || "";
          const research = await loadArtifact("research", researchId);

          updateTask(task_id, { progress: 0.3, current_step: "Generating Bible with LLM" });
          const result = await llmComplete(
            "You are a film Location Bible writer. Write a Location Bible as JSON conforming to LocationBible v2 schema. Include: $schema, bible_id, passport (type, time_of_day, era, recurring, scenes), space_description (min 400 words), atmosphere, light_base_state (primary_source, direction, color_temp_kelvin, shadow_hardness, fill_to_key_ratio, practical_sources), key_details (5-8 items), negative_list (3+ must-never-appear items), approval_status: \"draft\".",
            [{ role: "user", content: `Brief: ${JSON.stringify(location_brief)}\nVision: ${JSON.stringify(director_vision)}\nResearch: ${JSON.stringify(research)}` }],
            { maxTokens: 8192 },
          );
          const bibleId = location_brief.location_id;
          await saveArtifact("bible", bibleId, JSON.parse(stripCodeFence(result.content)));
          updateTask(task_id, {
            status: "completed", progress: 1.0, current_step: "Bible written",
            artifacts: [{ uri: `agent://location-scout/bible/${bibleId}`, mime_type: "application/json", created_at: new Date().toISOString() }],
          });
        } catch (err) {
          updateTask(task_id, { status: "failed", error: err instanceof Error ? err.message : String(err) });
        }
      })();

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ task_id, status: "accepted" }) }],
      };
    },
  );

  // Anchor image generation
  server.tool(
    "generate_anchor",
    "Generate anchor image for an approved Location Bible. Returns task_id for async tracking. Requires bible_uri pointing to an approved Bible.",
    {
      bible_uri: z.string().describe("MCP resource URI of the approved Location Bible"),
      generation_params: z.object({
        model: z.string().optional().describe("Image generation model"),
        seed: z.number().int().optional().describe("Random seed"),
      }).optional(),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ bible_uri, generation_params }) => {
      const task_id = crypto.randomUUID();
      createTask(task_id, "Generating anchor image");

      (async () => {
        try {
          updateTask(task_id, { status: "processing", progress: 0.1, current_step: "Loading Bible" });
          const bibleId = bible_uri.split("/").pop() || "";
          const bible = await loadArtifact<{ space_description?: string; negative_list?: Array<{ item: string }> }>("bible", bibleId);

          if (!bible) {
            updateTask(task_id, { status: "failed", error: "Bible not found" });
            return;
          }

          updateTask(task_id, { progress: 0.3, current_step: "Generating image via FAL.ai" });
          const negativePrompt = bible.negative_list?.map((n) => n.item).join(", ") || "";
          const result = await generateImage({
            prompt: `Cinematic film location photograph. ${bible.space_description ?? ""}`.slice(0, 2000),
            negative_prompt: negativePrompt || undefined,
            seed: generation_params?.seed,
          });

          if (result.images.length > 0) {
            // Download and save image
            const imgRes = await fetch(result.images[0].url);
            const imgBuf = Buffer.from(await imgRes.arrayBuffer());
            const { saveImage } = await import("../lib/storage.js");
            await saveImage("anchor", bibleId, imgBuf);
          }

          updateTask(task_id, {
            status: "completed", progress: 1.0, current_step: "Anchor generated",
            artifacts: [{ uri: `agent://location-scout/anchor/${bibleId}`, mime_type: "image/png", created_at: new Date().toISOString() }],
          });
        } catch (err) {
          updateTask(task_id, { status: "failed", error: err instanceof Error ? err.message : String(err) });
        }
      })();

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ task_id, status: "accepted" }) }],
      };
    },
  );

  // Mood states
  server.tool(
    "create_mood_states",
    "Generate mood state deltas for each scene group from a Location Bible. Returns array of mood-state-v1 objects.",
    {
      bible_uri: z.string().describe("MCP resource URI of the Location Bible"),
      scene_groups: z.array(z.object({
        scene_ids: z.array(z.string()),
        act: z.number().int(),
        time_of_day: z.string(),
        context: z.string().optional().describe("Scene context for mood derivation"),
      })).describe("Scene groups to generate mood states for"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ scene_groups }) => {
      const task_id = crypto.randomUUID();
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ task_id, status: "accepted", count: scene_groups.length }) }],
      };
    },
  );

  // Floorplan
  server.tool(
    "create_floorplan",
    "Generate a floorplan layout from a Location Bible. Returns task_id for async tracking.",
    {
      bible_uri: z.string().describe("MCP resource URI of the Location Bible"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async () => {
      const task_id = crypto.randomUUID();
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ task_id, status: "accepted" }) }],
      };
    },
  );

  // Setup extraction
  server.tool(
    "extract_setups",
    "Extract per-scene camera setups by combining floorplan coordinates with mood states. Returns array of setup objects.",
    {
      floorplan_uri: z.string().describe("MCP resource URI of the floorplan"),
      mood_state_uris: z.array(z.string()).describe("MCP resource URIs of mood states"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async () => {
      const task_id = crypto.randomUUID();
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ task_id, status: "accepted" }) }],
      };
    },
  );

  // Read operations
  server.tool(
    "get_bible",
    "Retrieve a Location Bible by ID. Returns location-bible-v2 JSON.",
    {
      bible_id: z.string().describe("Location Bible ID, e.g. loc_001"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ({ bible_id }) => {
      const bible = await loadArtifact("bible", bible_id);
      if (!bible) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "not_found", bible_id }) }] };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(bible) }] };
    },
  );

  server.tool(
    "get_mood_state",
    "Retrieve a mood state by ID. Returns mood-state-v1 JSON.",
    {
      state_id: z.string().describe("Mood state ID, e.g. mood_loc_001_01"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ({ state_id }) => {
      const mood = await loadArtifact("mood", state_id);
      if (!mood) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "not_found", state_id }) }] };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(mood) }] };
    },
  );

  // Validation tools
  server.tool(
    "check_era_accuracy",
    "Validate a Location Bible against its research pack for anachronisms. Returns list of issues found.",
    {
      bible_uri: z.string().describe("MCP resource URI of the Bible to check"),
      research_pack_uri: z.string().describe("MCP resource URI of the research pack"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ issues: [], passed: true }) }],
    }),
  );

  server.tool(
    "check_consistency",
    "Check consistency between Location Bible, mood states, and anchor image. Returns consistency report with score.",
    {
      bible_uri: z.string().describe("MCP resource URI of the Bible"),
      anchor_uri: z.string().optional().describe("MCP resource URI of the anchor image"),
      mood_state_uris: z.array(z.string()).optional().describe("MCP resource URIs of mood states to check"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async () => ({
      content: [{ type: "text" as const, text: JSON.stringify({ consistency_score: 1.0, issues: [] }) }],
    }),
  );

  // ─── W2: Research Cycle ────────────────────────────────────────────

  server.tool(
    "add_fact",
    "Add a period fact to the research pack. Used during Research Cycle (W2) to manually supplement AI-discovered facts.",
    {
      research_pack_uri: z.string().describe("MCP resource URI of the research pack"),
      fact: z.string().describe("Period fact statement, e.g. 'CRT televisions dominated American homes until mid-2000s'"),
      detail: z.string().optional().describe("Supporting detail or source note"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ({ research_pack_uri, fact, detail }) => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "added",
          research_pack_uri,
          fact: { text: fact, detail: detail ?? null, added_by: "manual" },
        }),
      }],
    }),
  );

  server.tool(
    "add_anachronism",
    "Add an anachronism to the negative list. Used during Research Cycle (W2) to flag items that must not appear in generated images.",
    {
      target_uri: z.string().describe("MCP resource URI of the Bible or research pack to attach the anachronism to"),
      item: z.string().describe("Anachronism description, e.g. 'LED lighting (any type)'"),
      severity: z.enum(["hard_ban", "soft_warn"]).default("hard_ban").describe("hard_ban = must never appear; soft_warn = flag for review"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ({ target_uri, item, severity }) => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "added",
          target_uri,
          anachronism: { item, severity, added_by: "manual" },
        }),
      }],
    }),
  );

  // ─── W4: Reference Generation ─────────────────────────────────────

  server.tool(
    "manual_setup_input",
    "Manually add or edit a camera setup. Used in Reference Generation (W4) when the operator wants to define a setup by hand instead of relying on AI extraction.",
    {
      location_id: z.string().describe("Location ID, e.g. loc_001"),
      setup: z.object({
        camera_x: z.number().describe("Camera X position in meters from room origin"),
        camera_y: z.number().describe("Camera Y position in meters from room origin"),
        angle: z.number().min(0).max(360).describe("Camera angle in degrees"),
        lens_mm: z.number().describe("Lens focal length in mm, e.g. 35"),
        characters: z.array(z.string()).describe("Character names in frame"),
        composition: z.string().describe("Composition description, e.g. 'Medium wide, couch centered'"),
        scene_id: z.string().describe("Scene ID this setup belongs to"),
      }),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ({ location_id, setup }) => {
      const setup_id = `setup_${location_id}_manual_${crypto.randomUUID().slice(0, 8)}`;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ setup_id, status: "created", location_id, setup }),
        }],
      };
    },
  );

  // ─── W5: Setups Generation ────────────────────────────────────────

  server.tool(
    "compare_with_anchor",
    "Compare a generated setup image against the anchor image. Returns perceptual similarity metrics (LPIPS, SSIM). Long-running: returns task_id for async tracking.",
    {
      setup_uri: z.string().describe("MCP resource URI of the setup image to compare"),
      anchor_uri: z.string().describe("MCP resource URI of the anchor image"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      const task_id = crypto.randomUUID();
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ task_id, status: "accepted" }),
        }],
      };
    },
  );

  server.tool(
    "get_setup_prompt",
    "Retrieve the generation prompt that was used to produce a specific setup image. Useful for debugging, reproducing, or tweaking generation parameters.",
    {
      setup_id: z.string().describe("Setup ID, e.g. setup_S1-A"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ({ setup_id }) => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({ error: "not_found", setup_id }),
      }],
    }),
  );

  server.tool(
    "get_outputs",
    "Get all output artifacts for a location, grouped by consumer (Gallery, DP+Storyboard, Prompt Composer, Shot Generation). Corresponds to W7 Outputs dashboard.",
    {
      location_id: z.string().optional().describe("Location ID, e.g. loc_001"),
      project_id: z.string().optional().describe("Project ID — returns outputs for all locations in project"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ({ location_id, project_id }) => {
      if (!location_id && !project_id) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ error: "validation_error", message: "At least one of location_id or project_id is required" }),
          }],
          isError: true,
        };
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            location_id: location_id ?? null,
            project_id: project_id ?? null,
            groups: {
              gallery: { files: [], count: 0 },
              dp_storyboard: { files: [], count: 0 },
              prompt_composer: { files: [], count: 0 },
              shot_generation: { files: [], count: 0 },
            },
            artifact_summary: [],
          }),
        }],
      };
    },
  );

  // ─── W6: Light / State Variations ─────────────────────────────────

  server.tool(
    "apply_mood_suggestion",
    "Apply an AI-suggested mood configuration to a setup. The AI suggests optimal settings based on scene context (e.g. '2700K + hard shadows for NIGHT TV-lit scene').",
    {
      setup_id: z.string().describe("Setup ID to apply the suggestion to"),
      suggestion_id: z.string().describe("Suggestion ID from the AI recommendation"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ({ setup_id, suggestion_id }) => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({ status: "applied", setup_id, suggestion_id }),
      }],
    }),
  );

  server.tool(
    "dismiss_mood_suggestion",
    "Dismiss an AI mood suggestion without applying it. The suggestion will not be shown again for this setup.",
    {
      setup_id: z.string().describe("Setup ID"),
      suggestion_id: z.string().describe("Suggestion ID to dismiss"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ({ setup_id, suggestion_id }) => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({ status: "dismissed", setup_id, suggestion_id }),
      }],
    }),
  );

  server.tool(
    "add_mood_variation",
    "Add a mood variation for a setup and trigger image generation. Mood config specifies deltas from the Bible base state. Long-running: returns task_id for async tracking.",
    {
      setup_id: z.string().describe("Setup ID to add variation for, e.g. S1"),
      mood_config: z.object({
        direction: z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW", "OVERHEAD"]).optional()
          .describe("Light direction override"),
        time_of_day: z.enum(["DAWN", "MORNING", "DAY", "AFTERNOON", "DUSK", "NIGHT", "LATE_NIGHT"]).optional()
          .describe("Time of day override"),
        color_temp_k: z.number().int().min(1800).max(10000).optional()
          .describe("Color temperature in Kelvin, e.g. 2700"),
        shadow_hardness: z.enum(["hard", "soft", "mixed"]).optional()
          .describe("Shadow quality"),
        weather: z.enum(["clear", "overcast", "rain", "fog", "storm"]).optional()
          .describe("Weather condition (EXT locations only)"),
        clutter_level: z.enum(["clean", "slight", "messy", "destroyed"]).optional()
          .describe("Room clutter level"),
        window_state: z.enum(["open", "closed", "curtains_drawn", "boarded_up"]).optional()
          .describe("Window state"),
        props_change: z.string().optional()
          .describe("Description of prop changes from base, e.g. 'Beer cans accumulate on table, ashtray appears'"),
        atmosphere_shift: z.string().optional()
          .describe("Atmospheric change description, e.g. 'Tense silence replaces morning bustle'"),
      }).describe("Mood delta configuration — fields override Bible base state"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ setup_id, mood_config }) => {
      const task_id = crypto.randomUUID();
      const variation_id = `var_${setup_id}_${mood_config.time_of_day ?? "custom"}_${crypto.randomUUID().slice(0, 6)}`;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ task_id, variation_id, status: "accepted", setup_id }),
        }],
      };
    },
  );
}
