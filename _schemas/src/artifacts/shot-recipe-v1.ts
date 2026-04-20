import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "shot_recipe" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "unassigned" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://pipeline/shot-recipe/{id}" as const;

const LocationRefSchema = z.object({
  bible_id: z.string().describe("Location Bible ID"),
  anchor_uri: z.string().describe("MCP resource URI for anchor image"),
  mood_state_id: z.string().describe("Mood state ID for this scene"),
});

const CharacterRefSchema = z.object({
  bible_id: z.string().describe("Character Bible ID"),
  model_sheet_uri: z.string().describe("MCP resource URI for model sheet"),
  appearance_state_id: z.string().optional().describe("Appearance state ID for this scene"),
});

const CameraSchema = z.object({
  shot_type: z.enum([
    "ECU", "CU", "MCU", "MS", "MWS", "WS", "EWS", "OTS", "POV", "INSERT", "ESTABLISHING",
  ]).describe("Shot type"),
  angle: z.enum([
    "eye_level", "low", "high", "dutch", "overhead", "ground",
  ]).describe("Camera angle"),
  movement: z.enum([
    "static", "pan_left", "pan_right", "tilt_up", "tilt_down",
    "dolly_in", "dolly_out", "tracking", "crane",
  ]).describe("Camera movement"),
  lens_mm: z.number().int().min(12).max(300).describe("Lens focal length. 24=wide, 35=normal-wide, 50=normal, 85=portrait, 135=telephoto"),
  position_from_floorplan: z.record(z.unknown()).optional().describe("Camera position data from floorplan coords"),
});

const PromptComponentsSchema = z.object({
  scene_description: z.string().describe("What is happening in the scene"),
  location_context: z.string().describe("Derived from Location Bible"),
  character_context: z.string().describe("Derived from Character Bibles"),
  light_context: z.string().describe("Derived from mood state + light base state"),
  mood_context: z.string().describe("Emotional context from mood state"),
  style_context: z.string().describe("Visual style directives"),
  negative_prompt: z.string().describe("Combined negative list from all source bibles"),
});

const GenerationParamsSchema = z.object({
  model: z.string().describe("Image generation model name"),
  image_ref_strength: z.number().min(0).max(1).describe("How strongly to reference anchor images"),
  seed: z.number().int().nullable().optional().describe("Random seed for reproducibility"),
});

// Audio spec — used only when target model supports audio generation.
// Per Google DeepMind Veo prompt guide: ambient noise, SFX, and dialogue
// must be prompted as separate sentences, not mixed into visual description.
// https://deepmind.google/models/veo/prompt-guide/
export const AudioSpecSchema = z.object({
  ambient: z.string().optional().describe("Ambient sound bed, e.g. 'quiet hum of a lab, distant traffic'"),
  sfx: z.array(z.string()).optional().describe("Discrete sound effects, e.g. ['glass clinking', 'door slam']"),
  dialogue: z.array(z.object({
    speaker: z.string().describe("Character name or role"),
    line: z.string().describe("Spoken line (4-12 words works best per Veo docs)"),
  })).optional().describe("Spoken dialogue lines"),
});

export type AudioSpec = z.infer<typeof AudioSpecSchema>;

export const ShotRecipeSchema = z.object({
  $schema: z.literal("shot-recipe-v1"),
  shot_id: z.string().describe("Unique shot ID"),
  scene_id: z.string().describe("Parent scene ID"),
  shot_index: z.number().int().min(0).describe("Order within scene"),
  location_ref: LocationRefSchema,
  characters_ref: z.array(CharacterRefSchema).describe("Characters in this shot"),
  camera: CameraSchema,
  prompt_components: PromptComponentsSchema,
  generation_params: GenerationParamsSchema,
  audio: AudioSpecSchema.optional().describe("Audio spec for models that support audio (Veo 3)"),
});

export type ShotRecipe = z.infer<typeof ShotRecipeSchema>;
export const ShotRecipeJsonSchema = zodToJsonSchema(ShotRecipeSchema);
