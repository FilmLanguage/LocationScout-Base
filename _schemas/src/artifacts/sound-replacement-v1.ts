import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactMetaSchema } from "../common/artifact-meta.js";

export const ARTIFACT_TYPE = "sound_replacement" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "sound-designer-base" as const;
export const URI_PATTERN = "agent://sound-designer/replacement/{id}" as const;
export const MIME_TYPE = "application/json" as const;

const GenerationParamsSchema = z.object({
  duration_sec: z.number(),
  prompt_influence: z.number().min(0).max(1).optional().describe("How closely to follow the prompt (0-1)"),
});

/**
 * Sound Replacement — a single generated-sound replacement for a segment.
 *
 * Created by `generate_sound` tool via ElevenLabs SFX API.
 * Applied to a segment via `replace_segment` tool.
 */
export const SoundReplacementSchema = z.object({
  $schema: z.literal("sound-replacement-v1"),
  replacement_id: z.string(),
  project_id: z.string(),
  scene_id: z.string(),
  segment_id: z.string(),
  prompt: z.string(),
  generated_audio_url: z.string(),
  elevenlabs_request_id: z.string().optional(),
  duration_sec: z.number(),
  created_at: z.string().describe("ISO8601"),
  status: z.enum(["generated", "applied", "rejected"]),
  generation_params: GenerationParamsSchema,
  _meta: ArtifactMetaSchema.optional(),
});

export type SoundReplacement = z.infer<typeof SoundReplacementSchema>;
export const SoundReplacementJsonSchema = zodToJsonSchema(SoundReplacementSchema);
