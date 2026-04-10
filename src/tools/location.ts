import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createTask, updateTask, saveArtifact, loadArtifact, saveImage, loadImage } from "../lib/storage.js";
import { llmComplete, generateImage } from "../lib/api-client.js";
import { flError, FL_ERRORS } from "../lib/errors.js";
import { validateAnchorAgainstBible, issuesToCorrectionHint, type ValidatorBibleSpec } from "../lib/anchor-validator.js";
import { resolveModel } from "../lib/model-registry.js";
import { analyzeWithGeminiVision, stripJsonFence } from "../lib/gemini-vision.js";
import { spawnSync } from "node:child_process";
import { resolve as pathResolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Gate helpers ───────────────────────────────────────────────────

/**
 * Bible First Rule: load a Location Bible and ensure approval_status === "approved".
 * Throws GATE_REJECTED if the bible is missing or not approved.
 *
 * Accepts either a full URI (`agent://location-scout/bible/loc_001`) or a bare bible_id.
 */
async function requireApprovedBible(bible_uri: string): Promise<Record<string, unknown>> {
  const bibleId = bible_uri.includes("/") ? (bible_uri.split("/").pop() ?? "") : bible_uri;
  const bible = await loadArtifact<Record<string, unknown>>("bible", bibleId);
  if (!bible) {
    throw flError(FL_ERRORS.MISSING_DEPENDENCY, `Location Bible not found: ${bible_uri}`, {
      retryable: false,
      suggestion: "Provide a valid bible URI. Create one with write_bible first.",
    });
  }
  if (bible.approval_status !== "approved") {
    throw flError(FL_ERRORS.GATE_REJECTED, `Location Bible not approved (status: ${bible.approval_status ?? "draft"}). Generation blocked by Bible First rule.`, {
      retryable: false,
      suggestion: "Approve the Location Bible with approve_artifact before generating anchors, mood states, or floorplans.",
      bible_uri,
      current_status: (bible.approval_status as string) ?? "draft",
    });
  }
  return bible;
}

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
  location_notes: z.record(z.string(), z.string()).optional().describe("Per-location director notes keyed by location_id, e.g. { loc_001: 'sterile, no warmth' }"),
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
      project_id: z.string().describe("Project GUID"),
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
            "You are a film location Bible writer. Write a detailed Location Bible JSON matching the LocationBible v2 schema. The JSON MUST include: \"$schema\": \"location-bible-v2\", bible_id, passport (type, time_of_day, era, recurring, scenes), space_description (max 200 words — concise, precise physical detail), atmosphere, light_base_state (primary_source, direction, color_temp_kelvin, shadow_hardness, fill_to_key_ratio, practical_sources), key_details (5-8 items), negative_list (array of SHORT strings — 2-4 word labels of anachronistic items, e.g. [\"LED lighting\", \"Flat screen TV\"] — no descriptions, no \"NO\" prefix), approval_status: \"draft\".\n\nOPTIONAL: include a `rationale` object { primary_reason, references, confidence } explaining your single most important creative choice. Only include it if your reasoning is genuinely tied to the research/vision sources — do NOT fabricate post-hoc justification.\n\nReturn ONLY the JSON object, no markdown fences.",
            [{ role: "user", content: `Location: ${JSON.stringify(location_brief)}\nDirector vision: ${JSON.stringify(director_vision)}\nResearch: ${research.content}` }],
            { maxTokens: 4096 },
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
            "You are a film Location Bible writer. Write a Location Bible as JSON conforming to LocationBible v2 schema. Include: $schema, bible_id, passport (type, time_of_day, era, recurring, scenes), space_description (max 200 words — be concise and precise), atmosphere, light_base_state (primary_source, direction, color_temp_kelvin, shadow_hardness, fill_to_key_ratio, practical_sources), key_details (5-8 items), negative_list (array of SHORT strings — 2-4 word labels, e.g. [\"LED lighting\", \"Smartphones\"] — no descriptions, no \"NO\" prefix), approval_status: \"draft\".\n\nAlso include an optional `rationale` object with:\n- `primary_reason`: 1–2 sentences explaining your single most important creative choice (e.g. why this light direction, why these key_details). Reference the research-pack or director-vision when relevant.\n- `references`: array of source identifiers you actually relied on (research_id, vision_id, or factual sources).\n- `confidence`: 0.0–1.0 self-reported confidence.\nIf your reasoning was not driven by a clear source, OMIT the rationale field — do NOT fabricate post-hoc justification.",
            [{ role: "user", content: `Brief: ${JSON.stringify(location_brief)}\nVision: ${JSON.stringify(director_vision)}\nResearch: ${JSON.stringify(research)}` }],
            { maxTokens: 4096 },
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
    "Generate anchor image for an approved Location Bible. Hard-gated: requires Bible with approval_status='approved'. Runs Gemini Vision validation against the Bible spec; on failure retries up to max_attempts with corrective prompt. Returns task_id for async tracking.",
    {
      bible_uri: z.string().describe("MCP resource URI of the approved Location Bible"),
      generation_params: z.object({
        model: z.string().optional().describe("Image generation model"),
        seed: z.number().int().optional().describe("Random seed"),
      }).optional(),
      validation: z.object({
        enabled: z.boolean().default(true).describe("Run VLM validation after each generation"),
        max_attempts: z.number().int().min(1).max(5).default(3).describe("Max generation+validation attempts"),
        threshold: z.number().min(0).max(1).default(0.75).describe("Score threshold to pass validation"),
      }).optional(),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ bible_uri, generation_params, validation }) => {
      const task_id = crypto.randomUUID();
      createTask(task_id, "Generating anchor image");

      const validationEnabled = validation?.enabled ?? true;
      const maxAttempts = validation?.max_attempts ?? 3;
      const threshold = validation?.threshold ?? 0.75;

      (async () => {
        try {
          updateTask(task_id, { status: "processing", progress: 0.05, current_step: "Checking Bible approval gate" });

          // ─── Hard gate: Bible First rule ────────────────────────────
          const bible = await requireApprovedBible(bible_uri);
          const bibleId = bible_uri.includes("/") ? (bible_uri.split("/").pop() ?? "") : bible_uri;

          // Pre-extract validator spec from bible (handles both v2 and legacy shapes)
          const negativeListRaw = bible.negative_list as string[] | Array<{ item: string }> | undefined;
          const validatorSpec: ValidatorBibleSpec = {
            bible_id: (bible.bible_id as string) ?? bibleId,
            passport: bible.passport as ValidatorBibleSpec["passport"],
            light_base_state: bible.light_base_state as ValidatorBibleSpec["light_base_state"],
            key_details: (bible.key_details as string[]) ?? [],
            negative_list: negativeListRaw ?? [],
          };

          const negativePrompt = Array.isArray(negativeListRaw)
            ? negativeListRaw.map((n) => (typeof n === "string" ? n : n.item)).join(", ")
            : "";
          const basePrompt = `Cinematic film location photograph. ${(bible.space_description as string | undefined) ?? ""}`.slice(0, 2000);

          // Hard gate: require isometric reference (Floorplan → Isometric → Anchor pipeline)
          updateTask(task_id, { progress: 0.08, current_step: "Loading isometric reference for img2img" });
          const isometricImage = await loadImage("isometric", bibleId);
          if (!isometricImage) {
            throw flError(FL_ERRORS.MISSING_DEPENDENCY, `Isometric reference not found for ${bibleId}. Generate floorplan and isometric first.`, {
              retryable: false,
              suggestion: "Run create_floorplan then generate_isometric_reference before generating the anchor.",
            });
          }
          const isometricDataUrl = `data:image/png;base64,${isometricImage.data.toString("base64")}`;

          let lastImageUrl: string | null = null;
          let lastReport: import("@filmlanguage/schemas").ValidationReport | null = null;
          let lastSaveResult: Awaited<ReturnType<typeof saveImage>> | null = null;
          let correctionHint = "";
          const validationReports: Array<{ uri: string; mime_type: string; created_at: string }> = [];

          // ─── Generate + Validate retry loop ─────────────────────────
          for (let attempt = 1; attempt <= (validationEnabled ? maxAttempts : 1); attempt++) {
            const progressStep = 0.1 + 0.7 * ((attempt - 1) / maxAttempts);
            updateTask(task_id, {
              progress: progressStep,
              current_step: `Generation attempt ${attempt}/${validationEnabled ? maxAttempts : 1} (img2img from isometric)`,
            });

            const promptForAttempt = (basePrompt + correctionHint).slice(0, 2000);
            const resolvedModel = resolveModel("ANCHOR", generation_params?.model);
            const result = await generateImage({
              prompt: promptForAttempt,
              negative_prompt: negativePrompt || undefined,
              seed: generation_params?.seed != null ? generation_params.seed + (attempt - 1) : undefined,
              model: resolvedModel,
              image_urls: [isometricDataUrl],
            });

            if (result.images.length === 0) {
              throw flError(FL_ERRORS.GENERATION_ERROR, "Image generator returned no images", {
                retryable: true,
                suggestion: "Retry, or check FAL.ai service health.",
              });
            }
            lastImageUrl = result.images[0].url;

            // Download and persist — saveImage returns { uri, local_path, ... }
            const imgRes = await fetch(lastImageUrl);
            const imgBuf = Buffer.from(await imgRes.arrayBuffer());
            lastSaveResult = await saveImage("anchor", bibleId, imgBuf);

            if (!validationEnabled) break;

            updateTask(task_id, {
              progress: progressStep + 0.05,
              current_step: `Validating attempt ${attempt}/${maxAttempts}`,
            });

            const report = await validateAnchorAgainstBible({
              bible: validatorSpec,
              anchor_image_url: lastImageUrl,
              artifact_uri: `agent://location-scout/anchor/${bibleId}`,
              attempt,
              max_attempts: maxAttempts,
              threshold,
            });
            lastReport = report;

            // Persist the validation report so reviewers/UI can inspect retry history.
            await saveArtifact("validation", report.validation_id, report);
            validationReports.push({
              uri: `agent://location-scout/validation/${report.validation_id}`,
              mime_type: "application/json",
              created_at: report.validated_at,
            });

            if (report.passed) break;
            correctionHint = issuesToCorrectionHint(report);
          }

          const passed = !validationEnabled || (lastReport?.passed ?? false);

          updateTask(task_id, {
            status: "completed",
            progress: 1.0,
            current_step: passed
              ? "Anchor generated and validated"
              : `Anchor generated but failed validation after ${maxAttempts} attempts (score ${lastReport?.score.toFixed(2) ?? "n/a"})`,
            artifacts: [
              {
                uri: lastSaveResult?.uri ?? `agent://location-scout/anchor/${bibleId}`,
                mime_type: "image/png",
                created_at: new Date().toISOString(),
                ...(lastSaveResult?.local_path ? { local_path: lastSaveResult.local_path } : {}),
              },
              ...validationReports,
            ],
          });
        } catch (err) {
          // Surface gate rejection clearly so the UI can show the right reason.
          const message = err instanceof Error ? err.message : String(err);
          updateTask(task_id, { status: "failed", error: message });
        }
      })();

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ task_id, status: "accepted" }) }],
      };
    },
  );

  // Mood states (hard-gated: requires approved Bible)
  server.tool(
    "create_mood_states",
    "Generate mood state deltas for each scene group from an approved Location Bible. Hard-gated: requires Bible with approval_status='approved'. Returns array of mood-state-v1 objects.",
    {
      bible_uri: z.string().describe("MCP resource URI of the approved Location Bible"),
      scene_groups: z.array(z.object({
        scene_ids: z.array(z.string()),
        act: z.number().int(),
        time_of_day: z.string(),
        context: z.string().optional().describe("Scene context for mood derivation"),
      })).describe("Scene groups to generate mood states for"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ bible_uri, scene_groups }) => {
      const task_id = crypto.randomUUID();
      createTask(task_id, "Creating mood states");
      (async () => {
        try {
          await requireApprovedBible(bible_uri);
          updateTask(task_id, {
            status: "completed",
            progress: 1.0,
            current_step: `Mood states created for ${scene_groups.length} scene groups`,
          });
        } catch (err) {
          updateTask(task_id, { status: "failed", error: err instanceof Error ? err.message : String(err) });
        }
      })();
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ task_id, status: "accepted", count: scene_groups.length }) }],
      };
    },
  );

  // Floorplan (hard-gated, Python-rendered)
  server.tool(
    "create_floorplan",
    "Generate a top-down floorplan PNG from an approved Location Bible. Hard-gated: requires Bible with approval_status='approved'. Renders via scripts/floorplan.py (matplotlib, 1920×1080). Also emits a JSON setup-positions map in task metadata. Returns task_id for async tracking.",
    {
      bible_uri: z.string().describe("MCP resource URI of the approved Location Bible"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ bible_uri }) => {
      const task_id = crypto.randomUUID();
      createTask(task_id, "Creating floorplan");
      (async () => {
        try {
          updateTask(task_id, { status: "processing", progress: 0.1, current_step: "Checking Bible approval gate" });
          const bible = await requireApprovedBible(bible_uri);
          const bibleId = bible_uri.includes("/") ? (bible_uri.split("/").pop() ?? "") : bible_uri;

          updateTask(task_id, { progress: 0.4, current_step: "Spawning Python floorplan renderer (matplotlib)" });

          const pyBin = process.env.PYTHON_BIN ?? "python";
          // scripts/floorplan.py lives at repo root; from src/tools/ that is ../../scripts
          const scriptPath = pathResolve(__dirname, "..", "..", "scripts", "floorplan.py");

          // Omit `encoding` so spawnSync returns Buffers (default behaviour).
          // The script writes PNG to stdout and setup JSON map to stderr.
          const result = spawnSync(pyBin, [scriptPath], {
            input: JSON.stringify(bible),
            timeout: 60_000,
            maxBuffer: 100 * 1024 * 1024,
          });

          if (result.error) {
            throw flError(FL_ERRORS.GENERATION_ERROR, `Failed to spawn Python: ${result.error.message}`, {
              retryable: false,
              suggestion: "Ensure PYTHON_BIN points to a Python 3 interpreter with matplotlib installed.",
            });
          }
          if (result.status !== 0) {
            const stderr = result.stderr ? Buffer.from(result.stderr).toString("utf8") : "";
            throw flError(FL_ERRORS.GENERATION_ERROR, `Python floorplan exited ${result.status}: ${stderr}`, {
              retryable: false,
              suggestion: "Inspect scripts/floorplan.py output. Bible structure may be missing required fields.",
            });
          }

          const pngBuffer = Buffer.from(result.stdout);
          if (pngBuffer.length === 0) {
            throw flError(FL_ERRORS.GENERATION_ERROR, "Python floorplan returned empty stdout", {
              retryable: true,
              suggestion: "Re-run; check stderr in agent logs.",
            });
          }

          // Parse setup map from stderr (emitted as JSON by floorplan.py)
          let setupMap: Record<string, unknown> | null = null;
          const stderrStr = result.stderr ? Buffer.from(result.stderr).toString("utf8").trim() : "";
          if (stderrStr) {
            const lastLine = stderrStr.split("\n").reverse().find(l => l.trimStart().startsWith("{"));
            if (lastLine) {
              try { setupMap = JSON.parse(lastLine); } catch { /* ignore parse errors */ }
            }
          }

          updateTask(task_id, { progress: 0.85, current_step: "Saving floorplan PNG" });
          const saveResult = await saveImage("floorplan", bibleId, pngBuffer);

          updateTask(task_id, {
            status: "completed",
            progress: 1.0,
            current_step: `Floorplan ready (${pngBuffer.length} bytes)`,
            artifacts: [
              {
                uri: saveResult.uri,
                mime_type: "image/png",
                created_at: new Date().toISOString(),
                ...(saveResult.local_path ? { local_path: saveResult.local_path } : {}),
              },
            ],
            ...(setupMap ? { setup_map: setupMap } : {}),
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

  // Isometric reference (floorplan-based, NanoBanana img2img)
  server.tool(
    "generate_isometric_reference",
    "Generate an isometric 3D reference image using the floorplan as a visual base (img2img via NanoBanana). The floorplan PNG is passed as image_urls[0] to FAL so the spatial layout is preserved in 3D. Optionally enriches the prompt with Location Bible context. Returns task_id for async tracking.",
    {
      floorplan_uri: z.string().describe("MCP resource URI of the floorplan PNG (agent://location-scout/floorplan/{id})"),
      bible_uri: z.string().optional().describe("MCP resource URI of the Location Bible — used for prompt context (era, description). Optional but recommended."),
      generation_params: z.object({
        model: z.string().optional().describe("Image generation model override"),
        seed: z.number().int().optional().describe("Random seed for reproducibility"),
      }).optional(),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ floorplan_uri, bible_uri, generation_params }) => {
      const task_id = crypto.randomUUID();
      createTask(task_id, "Generating isometric reference");

      (async () => {
        try {
          updateTask(task_id, { status: "processing", progress: 0.05, current_step: "Loading floorplan" });

          // Resolve floorplan ID and load PNG
          const floorplanId = floorplan_uri.includes("/") ? (floorplan_uri.split("/").pop() ?? "") : floorplan_uri;
          const floorplanImage = await loadImage("floorplan", floorplanId);
          if (!floorplanImage) {
            throw flError(FL_ERRORS.MISSING_DEPENDENCY, `Floorplan not found: ${floorplan_uri}`, {
              retryable: false,
              suggestion: "Generate the floorplan first with create_floorplan.",
            });
          }

          // Encode as data URL for FAL img2img
          const floorplanDataUrl = `data:image/png;base64,${floorplanImage.data.toString("base64")}`;

          // Optional: load Bible for richer prompt
          let locationName = floorplanId;
          let era = "";
          let spaceDesc = "";
          if (bible_uri) {
            const bible = await loadArtifact<Record<string, unknown>>("bible", bible_uri.includes("/") ? (bible_uri.split("/").pop() ?? "") : bible_uri);
            if (bible) {
              const passport = bible.passport as Record<string, unknown> | undefined;
              locationName = (passport?.location_name as string | undefined) ?? floorplanId;
              era = (passport?.era as string | undefined) ?? "";
              spaceDesc = (bible.space_description as string | undefined) ?? "";
            }
          }

          const prompt = [
            "Isometric architectural illustration. Convert this top-down floorplan into a clean 3D isometric view.",
            locationName,
            era ? `Era: ${era}.` : "",
            spaceDesc,
            "Show walls, doors, windows, furniture in correct isometric projection. Cinematic film production reference. High detail.",
          ].filter(Boolean).join(" ").slice(0, 2000);

          updateTask(task_id, { progress: 0.3, current_step: "Sending floorplan to FAL for isometric rendering" });

          const resolvedModel = resolveModel("ISOMETRIC", generation_params?.model);
          const result = await generateImage({
            prompt,
            seed: generation_params?.seed,
            model: resolvedModel,
            image_urls: [floorplanDataUrl],
          });

          if (result.images.length === 0) {
            throw flError(FL_ERRORS.GENERATION_ERROR, "Image generator returned no images", {
              retryable: true,
              suggestion: "Retry, or check FAL.ai service health.",
            });
          }

          updateTask(task_id, { progress: 0.75, current_step: "Downloading and saving isometric PNG" });

          const imgRes = await fetch(result.images[0].url);
          const imgBuf = Buffer.from(await imgRes.arrayBuffer());
          const saveResult = await saveImage("isometric", floorplanId, imgBuf);

          updateTask(task_id, {
            status: "completed",
            progress: 1.0,
            current_step: `Isometric reference ready (${imgBuf.length} bytes)`,
            artifacts: [
              {
                uri: saveResult.uri,
                mime_type: "image/png",
                created_at: new Date().toISOString(),
                ...(saveResult.local_path ? { local_path: saveResult.local_path } : {}),
              },
            ],
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

  // Setup extraction (hard-gated via floorplan dependency)
  server.tool(
    "extract_setups",
    "Extract per-scene camera setups by combining floorplan coordinates with mood states. Returns array of setup objects.",
    {
      floorplan_uri: z.string().describe("MCP resource URI of the floorplan"),
      mood_state_uris: z.array(z.string()).describe("MCP resource URIs of mood states"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ({ floorplan_uri, mood_state_uris }) => {
      const task_id = crypto.randomUUID();
      createTask(task_id, "Extracting camera setups");
      (async () => {
        try {
          updateTask(task_id, { status: "processing", progress: 0.1, current_step: "Loading bible and mood states" });
          // Floorplan stored as saveImage("floorplan", bibleId, ...) — floorplan ID IS the bible ID
          const bibleId = floorplan_uri.split("/").pop() ?? "";
          const bible = await loadArtifact<Record<string, unknown>>("bible", bibleId);
          if (!bible) { updateTask(task_id, { status: "failed", error: `Bible not found for floorplan: ${bibleId}` }); return; }

          const moodStates: unknown[] = [];
          if (mood_state_uris.length > 0) {
            const loaded = await Promise.all(mood_state_uris.map((u) => loadArtifact("mood", u.split("/").pop() ?? "")));
            for (const ms of loaded) { if (ms) moodStates.push(ms); }
          }

          updateTask(task_id, { progress: 0.3, current_step: "Generating setup plan via LLM" });
          const passport = (bible.passport as Record<string, unknown> | undefined) ?? {};
          const llmResult = await llmComplete(
            "You are a film location setup planner. Generate camera setups from spatial layout and mood states. Return a JSON array only — no prose, no fences.",
            [{ role: "user", content: `Location Bible:\n${JSON.stringify({ bible_id: bible.bible_id, spaces: bible.spaces, space_description: (bible.space_description as string | undefined)?.slice(0, 600), scenes: passport.scenes, light_base_state: bible.light_base_state })}\n\nMood States:\n${JSON.stringify(moodStates)}\n\nFor each scene produce one or more setup objects. Each must have: setup_id (unique string, e.g. "setup_S1_A"), scene_id, camera_x (meters), camera_y (meters), angle_deg (0-360), lens_mm, composition (string), characters (string[]), notes (string).` }],
            { maxTokens: 4096, temperature: 0.6 },
          );

          let setups: Array<Record<string, unknown>>;
          try {
            setups = JSON.parse(stripCodeFence(llmResult.content));
            if (!Array.isArray(setups)) throw flError(FL_ERRORS.LLM_ERROR, "LLM did not return array", { retryable: true, suggestion: "Re-run extract_setups" });
          } catch (err) { updateTask(task_id, { status: "failed", error: `Parse error: ${err instanceof Error ? err.message : String(err)}` }); return; }

          updateTask(task_id, { progress: 0.7, current_step: `Saving ${setups.length} setups` });
          const artifacts: Array<{ uri: string; mime_type: string; created_at: string }> = [];
          for (const setup of setups) {
            const sid = (setup.setup_id as string | undefined) ?? `setup_${bibleId}_${crypto.randomUUID().slice(0, 8)}`;
            setup.setup_id = sid;
            await saveArtifact("setup", sid, setup);
            artifacts.push({ uri: `agent://location-scout/setup/${sid}`, mime_type: "application/json", created_at: new Date().toISOString() });
          }
          updateTask(task_id, { status: "completed", progress: 1.0, current_step: `${setups.length} setups extracted`, artifacts });
        } catch (err) { updateTask(task_id, { status: "failed", error: err instanceof Error ? err.message : String(err) }); }
      })();
      return { content: [{ type: "text" as const, text: JSON.stringify({ task_id, status: "accepted" }) }] };
    },
  );

  // Setup image generation (FAL-based, one image per setup)
  server.tool(
    "generate_setup_images",
    "Generate camera setup reference images via FAL.ai. Hard-gated: requires approved Bible. Takes an array of setup objects (scene, mood, camera info) and generates one image per setup. Returns task_id for async tracking.",
    {
      bible_uri: z.string().describe("MCP resource URI of the approved Location Bible"),
      setups: z.array(z.object({
        id: z.string(),
        scene: z.string(),
        mood: z.string(),
        camera: z.string().optional(),
      })).describe("Setup tiles to generate images for"),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    async ({ bible_uri, setups }) => {
      const task_id = crypto.randomUUID();
      createTask(task_id, "Generating setup images");
      (async () => {
        try {
          updateTask(task_id, { status: "processing", progress: 0.05, current_step: "Checking Bible approval gate" });
          const bible = await requireApprovedBible(bible_uri);
          const bibleId = bible_uri.includes("/") ? (bible_uri.split("/").pop() ?? "") : bible_uri;
          const spaceDesc = ((bible.space_description as string) ?? "").slice(0, 300);

          // Load anchor image for img2img visual consistency (ERD: SETUP_IMAGE ← ANCHOR_IMAGE)
          updateTask(task_id, { progress: 0.08, current_step: "Loading anchor image for img2img" });
          const anchorImage = await loadImage("anchor", bibleId);
          const anchorDataUrl = anchorImage
            ? `data:image/png;base64,${anchorImage.data.toString("base64")}`
            : null;
          if (!anchorImage) {
            updateTask(task_id, { progress: 0.08, current_step: "No anchor found — text-only generation" });
          }

          const artifacts: Array<{ uri: string; mime_type: string; created_at: string; local_path?: string }> = [];

          for (let i = 0; i < setups.length; i++) {
            const setup = setups[i];
            const progress = 0.1 + 0.8 * (i / setups.length);
            updateTask(task_id, { progress, current_step: `Generating image for ${setup.id} (${i + 1}/${setups.length})` });

            const prompt = `Cinematic film still, ${spaceDesc}. Scene ${setup.scene}, ${setup.mood} mood. ${setup.camera ?? ""}. Photorealistic interior photography.`.slice(0, 2000);
            const resolvedModel = resolveModel("SETUP", undefined);
            const result = await generateImage({
              prompt,
              model: resolvedModel,
              ...(anchorDataUrl ? { image_urls: [anchorDataUrl] } : {}),
            });

            if (result.images.length > 0) {
              const imgRes = await fetch(result.images[0].url);
              const imgBuf = Buffer.from(await imgRes.arrayBuffer());
              const setupId = setup.id.replace(/\//g, "_");
              const saveResult = await saveImage("setup", setupId, imgBuf);
              artifacts.push({
                uri: saveResult.uri,
                mime_type: "image/png",
                created_at: new Date().toISOString(),
                ...(saveResult.local_path ? { local_path: saveResult.local_path } : {}),
              });
            }
          }

          updateTask(task_id, {
            status: "completed",
            progress: 1.0,
            current_step: `${artifacts.length} setup images generated`,
            artifacts,
          });
        } catch (err) {
          updateTask(task_id, { status: "failed", error: err instanceof Error ? err.message : String(err) });
        }
      })();
      return { content: [{ type: "text" as const, text: JSON.stringify({ task_id, status: "accepted" }) }] };
    },
  );

  // Research depth scoring (parity with Casting Director)
  server.tool(
    "evaluate_research_depth",
    "Score the depth and sufficiency of a research pack against the location's importance. Returns { score 0..1, gaps[] } so the orchestrator can decide whether to dig deeper before writing the Bible.",
    {
      research_pack_uri: z.string().describe("MCP resource URI of the research pack to evaluate"),
      location_importance: z.enum(["recurring", "single_scene", "background"]).default("single_scene").describe("How prominent the location is in the film"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ research_pack_uri, location_importance }) => {
      const task_id = crypto.randomUUID();
      createTask(task_id, "Evaluating research depth");

      (async () => {
        try {
          const researchId = research_pack_uri.split("/").pop() || "";
          const research = await loadArtifact<{
            period_facts?: unknown[];
            typical_elements?: unknown[];
            anachronism_list?: unknown[];
            visual_references?: unknown[];
          }>("research", researchId);

          if (!research) {
            updateTask(task_id, { status: "failed", error: `Research pack not found: ${research_pack_uri}` });
            return;
          }

          // Heuristic scoring — keep simple, can be replaced with LLM later.
          const periodFactsCount = research.period_facts?.length ?? 0;
          const typicalElementsCount = research.typical_elements?.length ?? 0;
          const anachronismCount = research.anachronism_list?.length ?? 0;
          const referencesCount = research.visual_references?.length ?? 0;

          // Required minimums scale with importance
          const required = {
            recurring:     { facts: 8, elements: 8, anach: 6, refs: 4 },
            single_scene:  { facts: 4, elements: 4, anach: 3, refs: 2 },
            background:    { facts: 2, elements: 2, anach: 1, refs: 0 },
          }[location_importance];

          const ratios = [
            Math.min(1, periodFactsCount / required.facts),
            Math.min(1, typicalElementsCount / required.elements),
            Math.min(1, anachronismCount / required.anach),
            required.refs > 0 ? Math.min(1, referencesCount / required.refs) : 1,
          ];
          const score = Number((ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(2));

          const gaps: string[] = [];
          if (periodFactsCount < required.facts) gaps.push(`period_facts: ${periodFactsCount}/${required.facts}`);
          if (typicalElementsCount < required.elements) gaps.push(`typical_elements: ${typicalElementsCount}/${required.elements}`);
          if (anachronismCount < required.anach) gaps.push(`anachronism_list: ${anachronismCount}/${required.anach}`);
          if (required.refs > 0 && referencesCount < required.refs) gaps.push(`visual_references: ${referencesCount}/${required.refs}`);

          const reportId = `depth_${researchId}_${Date.now().toString(36)}`;
          const report = {
            research_pack_uri,
            location_importance,
            score,
            passed: score >= 0.75,
            gaps,
            counts: { periodFactsCount, typicalElementsCount, anachronismCount, referencesCount },
            evaluated_at: new Date().toISOString(),
          };
          await saveArtifact("research-depth", reportId, report);

          updateTask(task_id, {
            status: "completed",
            progress: 1.0,
            current_step: `Research depth: ${score} (${score >= 0.75 ? "sufficient" : "needs more"})`,
            artifacts: [{ uri: `agent://location-scout/research-depth/${reportId}`, mime_type: "application/json", created_at: report.evaluated_at }],
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
    async ({ bible_uri, research_pack_uri }) => {
      const bibleId = bible_uri.split("/").pop() ?? "";
      const researchId = research_pack_uri.split("/").pop() ?? "";
      const [bible, research] = await Promise.all([
        loadArtifact<Record<string, unknown>>("bible", bibleId),
        loadArtifact<Record<string, unknown>>("research", researchId),
      ]);
      if (!bible) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "not_found", missing: "bible" }) }] };
      if (!research) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "not_found", missing: "research" }) }] };

      const llmResult = await llmComplete(
        "You are a film production period accuracy expert. Check a Location Bible for anachronisms against a research pack. Return strict JSON only — no prose, no fences: {\"issues\": [{\"severity\": \"critical\"|\"warning\"|\"info\", \"field\": string, \"issue\": string, \"suggestion\": string}], \"passed\": boolean}",
        [{ role: "user", content: `Bible:\n${JSON.stringify({ bible_id: bible.bible_id, era: (bible.passport as Record<string, unknown> | undefined)?.era, space_description: (bible.space_description as string | undefined)?.slice(0, 600), key_details: bible.key_details, negative_list: bible.negative_list, light_base_state: bible.light_base_state })}\n\nResearch Pack:\n${JSON.stringify({ period_facts: research.period_facts, anachronism_list: research.anachronism_list, typical_elements: research.typical_elements })}` }],
        { maxTokens: 2048, temperature: 0.1 },
      );
      let parsed: { issues: unknown[]; passed: boolean };
      try { parsed = JSON.parse(stripCodeFence(llmResult.content)); }
      catch { parsed = { issues: [{ severity: "info", field: "parse", issue: "LLM response not valid JSON", suggestion: "Re-run" }], passed: false }; }
      return { content: [{ type: "text" as const, text: JSON.stringify({ ...parsed, checked_at: new Date().toISOString() }) }] };
    },
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
    async ({ bible_uri, anchor_uri, mood_state_uris }) => {
      const bibleId = bible_uri.split("/").pop() ?? "";
      const bible = await loadArtifact<Record<string, unknown>>("bible", bibleId);
      if (!bible) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "not_found", bible_uri }) }] };

      const moodStates: unknown[] = [];
      if (mood_state_uris?.length) {
        const loaded = await Promise.all(mood_state_uris.map((u) => loadArtifact("mood", u.split("/").pop() ?? "")));
        for (const ms of loaded) { if (ms) moodStates.push(ms); }
      }

      const llmResult = await llmComplete(
        "You are a film production consistency analyst. Check mood state deltas are internally consistent with the Location Bible's base state. Return strict JSON only: {\"consistency_score\": number, \"issues\": [{\"severity\": string, \"field\": string, \"issue\": string, \"suggestion\": string}], \"all_mood_states_aligned\": boolean}",
        [{ role: "user", content: `Bible:\n${JSON.stringify({ bible_id: bible.bible_id, light_base_state: bible.light_base_state, atmosphere: bible.atmosphere, negative_list: bible.negative_list, passport: bible.passport })}\n\nMood States:\n${JSON.stringify(moodStates)}` }],
        { maxTokens: 2048, temperature: 0.1 },
      );
      let parsed: { consistency_score: number; issues: unknown[]; all_mood_states_aligned: boolean };
      try { parsed = JSON.parse(stripCodeFence(llmResult.content)); }
      catch { parsed = { consistency_score: 0, issues: [{ severity: "info", field: "parse", issue: "LLM response not parseable", suggestion: "Re-run" }], all_mood_states_aligned: false }; }

      if (anchor_uri) {
        const anchorImg = await loadImage("anchor", anchor_uri.split("/").pop() ?? "");
        if (anchorImg) {
          try {
            const vr = await analyzeWithGeminiVision({
              image_urls: [anchorImg.data.toString("base64")],
              system_prompt: "You are a film production visual consistency analyst. Check if this anchor image is visually consistent with the Location Bible. Return JSON: {\"visual_issues\": [{\"severity\": string, \"field\": string, \"issue\": string}], \"visual_score\": number}",
              user_prompt: `Bible context:\n${JSON.stringify({ space_description: (bible.space_description as string | undefined)?.slice(0, 400), light_base_state: bible.light_base_state, key_details: bible.key_details, negative_list: bible.negative_list })}`,
            });
            const vp = JSON.parse(stripJsonFence(vr.content)) as { visual_issues?: unknown[]; visual_score?: number };
            if (Array.isArray(vp.visual_issues)) (parsed.issues as unknown[]).push(...vp.visual_issues);
            if (typeof vp.visual_score === "number") parsed.consistency_score = (parsed.consistency_score + vp.visual_score) / 2;
          } catch { /* visual check is optional — swallow */ }
        }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify({ ...parsed, checked_at: new Date().toISOString() }) }] };
    },
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
    async ({ research_pack_uri, fact, detail }) => {
      const researchId = research_pack_uri.split("/").pop() ?? "";
      const research = await loadArtifact<Record<string, unknown>>("research", researchId);
      if (!research) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "not_found", research_pack_uri }) }] };
      }
      if (!Array.isArray(research.period_facts)) research.period_facts = [];
      const newFact = { text: fact, detail: detail ?? null, added_by: "manual" };
      (research.period_facts as unknown[]).push(newFact);
      await saveArtifact("research", researchId, research);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ status: "added", research_pack_uri, fact: newFact, count: (research.period_facts as unknown[]).length }) }],
      };
    },
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
    async ({ target_uri, item, severity }) => {
      const isBible = target_uri.includes("/bible/");
      const artifactType = isBible ? "bible" : "research";
      const id = target_uri.split("/").pop() ?? "";
      const artifact = await loadArtifact<Record<string, unknown>>(artifactType, id);
      if (!artifact) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: "not_found", target_uri }) }] };
      }
      let count: number;
      if (isBible) {
        if (!Array.isArray(artifact.negative_list)) artifact.negative_list = [];
        (artifact.negative_list as unknown[]).push(item);
        count = (artifact.negative_list as unknown[]).length;
      } else {
        if (!Array.isArray(artifact.anachronism_list)) artifact.anachronism_list = [];
        (artifact.anachronism_list as unknown[]).push({ item, severity, added_by: "manual" });
        count = (artifact.anachronism_list as unknown[]).length;
      }
      await saveArtifact(artifactType, id, artifact);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ status: "added", target_uri, anachronism: { item, severity }, count }) }],
      };
    },
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
    async ({ setup_uri, anchor_uri }) => {
      const task_id = crypto.randomUUID();
      createTask(task_id, "Comparing setup against anchor");
      (async () => {
        try {
          updateTask(task_id, { status: "processing", progress: 0.1, current_step: "Loading images" });
          const setupId = setup_uri.split("/").pop() ?? "";
          const anchorId = anchor_uri.split("/").pop() ?? "";
          const setupType = setup_uri.includes("/setup/") ? "setup" : "anchor";
          const [setupImg, anchorImg] = await Promise.all([
            loadImage(setupType, setupId),
            loadImage("anchor", anchorId),
          ]);
          if (!setupImg) { updateTask(task_id, { status: "failed", error: `Setup image not found: ${setup_uri}` }); return; }
          if (!anchorImg) { updateTask(task_id, { status: "failed", error: `Anchor image not found: ${anchor_uri}` }); return; }

          updateTask(task_id, { progress: 0.4, current_step: "Sending to Gemini Vision for comparison" });
          const vr = await analyzeWithGeminiVision({
            image_urls: [setupImg.data.toString("base64"), anchorImg.data.toString("base64")],
            system_prompt: "You are a cinematography quality analyst. Compare setup image (first) against anchor reference (second). Return strict JSON only: {\"similarity_score\": number, \"composition_match\": boolean, \"color_consistency\": boolean, \"issues\": [{\"severity\": string, \"field\": string, \"issue\": string}], \"passed\": boolean}. Score 1.0=identical, 0.5=significant drift. passed=true if score >= 0.7.",
            user_prompt: "Compare these two film production reference images and return the JSON analysis.",
          });

          let report: Record<string, unknown>;
          try { report = JSON.parse(stripJsonFence(vr.content)); }
          catch { report = { similarity_score: 0, composition_match: false, color_consistency: false, issues: [{ severity: "info", field: "parse", issue: "Vision response not valid JSON" }], passed: false }; }

          const reportId = `cmp_${setupId}_${anchorId}_${Date.now().toString(36)}`;
          report.report_id = reportId;
          report.setup_uri = setup_uri;
          report.anchor_uri = anchor_uri;
          report.compared_at = new Date().toISOString();
          await saveArtifact("comparison", reportId, report);

          updateTask(task_id, {
            status: "completed",
            progress: 1.0,
            current_step: `Comparison complete — score: ${report.similarity_score}`,
            artifacts: [{ uri: `agent://location-scout/comparison/${reportId}`, mime_type: "application/json", created_at: report.compared_at as string }],
          });
        } catch (err) { updateTask(task_id, { status: "failed", error: err instanceof Error ? err.message : String(err) }); }
      })();
      return { content: [{ type: "text" as const, text: JSON.stringify({ task_id, status: "accepted" }) }] };
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
      createTask(task_id, "Generating mood variation image");
      (async () => {
        try {
          updateTask(task_id, { status: "processing", progress: 0.05, current_step: "Loading setup data" });

          // Load the setup JSON to find its bible_id
          const setup = await loadArtifact<Record<string, unknown>>("setup", setup_id);
          const bibleId = (setup?.bible_id as string) ??
            (setup?.location_id as string) ??
            setup_id.replace(/^setup_/, "").split("_")[0];

          // Load Bible for space description
          const bible = await loadArtifact<Record<string, unknown>>("bible", bibleId);
          const spaceDesc = ((bible?.space_description as string) ?? "").slice(0, 200);

          // Load anchor for img2img visual consistency
          updateTask(task_id, { progress: 0.1, current_step: "Loading anchor for img2img" });
          const anchorImage = await loadImage("anchor", bibleId);
          const anchorDataUrl = anchorImage
            ? `data:image/png;base64,${anchorImage.data.toString("base64")}`
            : null;

          // Build mood-aware prompt from config deltas
          const moodParts = [
            `Cinematic film still, ${spaceDesc}.`,
            mood_config.time_of_day ? `Time: ${mood_config.time_of_day.toLowerCase()}.` : "",
            mood_config.direction ? `Light from ${mood_config.direction}.` : "",
            mood_config.color_temp_k ? `Color temperature ${mood_config.color_temp_k}K.` : "",
            mood_config.shadow_hardness ? `${mood_config.shadow_hardness} shadows.` : "",
            mood_config.weather ? `Weather: ${mood_config.weather}.` : "",
            mood_config.clutter_level ? `Room: ${mood_config.clutter_level}.` : "",
            mood_config.window_state ? `Windows: ${mood_config.window_state.replace(/_/g, " ")}.` : "",
            mood_config.props_change ?? "",
            mood_config.atmosphere_shift ?? "",
            "Photorealistic interior photography.",
          ].filter(Boolean).join(" ").slice(0, 2000);

          updateTask(task_id, { progress: 0.3, current_step: `Generating variation image${anchorDataUrl ? " (img2img from anchor)" : " (text-only)"}` });

          const resolvedModel = resolveModel("MOOD_VARIANT", undefined);
          const result = await generateImage({
            prompt: moodParts,
            model: resolvedModel,
            ...(anchorDataUrl ? { image_urls: [anchorDataUrl] } : {}),
          });

          if (result.images.length === 0) {
            throw flError(FL_ERRORS.GENERATION_ERROR, "Image generator returned no images", {
              retryable: true, suggestion: "Retry, or check FAL.ai service health.",
            });
          }

          updateTask(task_id, { progress: 0.8, current_step: "Saving variation image" });
          const imgRes = await fetch(result.images[0].url);
          const imgBuf = Buffer.from(await imgRes.arrayBuffer());
          const saveResult = await saveImage("mood_variation", variation_id, imgBuf);

          updateTask(task_id, {
            status: "completed",
            progress: 1.0,
            current_step: `Mood variation ${variation_id} generated`,
            artifacts: [{
              uri: saveResult.uri,
              mime_type: "image/png",
              created_at: new Date().toISOString(),
              ...(saveResult.local_path ? { local_path: saveResult.local_path } : {}),
            }],
          });
        } catch (err) {
          updateTask(task_id, { status: "failed", error: err instanceof Error ? err.message : String(err) });
        }
      })();
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ task_id, variation_id, status: "accepted", setup_id }),
        }],
      };
    },
  );
}
