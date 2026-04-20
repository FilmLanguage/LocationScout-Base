import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactMetaSchema } from "../common/artifact-meta.js";

export const ARTIFACT_TYPE = "sound_breakdown" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "sound-designer-base" as const;
export const URI_PATTERN = "agent://sound-designer/breakdown/{id}" as const;
export const MIME_TYPE = "application/json" as const;

/**
 * Sound layer types — the 6 standard post-production sound design layers.
 * Dialogue is readonly (extraction only, no regeneration).
 */
export const SoundLayerEnum = z.enum([
  "dialogue",
  "sfx",
  "foley",
  "ambience",
  "hard_effects",
  "walla",
]);

/**
 * Source provenance for a segment's audio.
 * - "extracted": audio came from Demucs stem separation
 * - "needs_generation": no usable audio, must be generated
 * - "generated": replacement audio was generated via ElevenLabs SFX
 * - "silent": intentionally silent (no audio needed)
 */
export const SegmentSourceEnum = z.enum([
  "extracted",
  "needs_generation",
  "generated",
  "silent",
]);

const SoundReplacementRefSchema = z.object({
  replacement_id: z.string(),
  prompt: z.string(),
  generated_audio_url: z.string(),
  status: z.enum(["generated", "applied", "rejected"]),
});

/**
 * A single sound segment within a layer.
 * Represents one discrete sound event (footstep, door slam, ambience bed, etc.)
 */
export const SoundSegmentSchema = z.object({
  segment_id: z.string(),
  layer: SoundLayerEnum,
  shot_number: z.number().optional().describe("Which shot within the scene (null for scene-wide like ambience)"),
  timecode_in: z.number().describe("Start time in seconds, relative to scene start"),
  timecode_out: z.number().describe("End time in seconds, relative to scene start"),
  description: z.string().default("").describe("Human-readable description: 'Male footsteps on gravel, slow pace'"),
  suggested_prompt: z.string().default("").describe("ElevenLabs SFX prompt suggestion (empty for dialogue)"),
  original_prompt: z.string().optional().describe("Immutable original prompt from analyze_scene — used for Revert"),
  original_audio_url: z.string().optional().describe("Immutable original generated audio — used for Revert"),
  source: SegmentSourceEnum,
  readonly: z.boolean().default(false).describe("True for dialogue — UI disables Generate button"),
  quality_score: z.number().min(0).max(10).optional().describe("Quality of extracted audio (0-10)"),
  sync_frame: z.number().optional().describe("For hard_effects: specific video frame to sync with"),
  audio_url: z.string().optional().describe("Filled after extraction or generation"),
  replacement: SoundReplacementRefSchema.optional().describe("Active replacement, if any"),
  user_edited: z.boolean().default(false).describe("True if user has modified prompt or generated replacement"),
});

const ShotTimecodeSchema = z.object({
  shot_number: z.number(),
  timecode_in: z.number(),
  timecode_out: z.number(),
});

/**
 * Sound Breakdown — per-scene post-production audio analysis.
 *
 * Created by the `analyze_scene` tool: Demucs separates audio into
 * vocals/rest, VLM analyzes video frames, Claude classifies segments
 * into 6 layers with timecodes and generation prompts.
 */
export const SoundBreakdownSchema = z.object({
  $schema: z.literal("sound-breakdown-v1"),
  project_id: z.string(),
  scene_id: z.string(),
  scene_number: z.number(),
  source_video_url: z.string(),
  created_at: z.string().describe("ISO8601"),
  demucs_model: z.enum(["htdemucs", "htdemucs_ft"]).default("htdemucs_ft"),
  total_duration_sec: z.number(),
  shots: z.array(ShotTimecodeSchema).default([]),
  layers: z.object({
    dialogue: z.array(SoundSegmentSchema).default([]),
    sfx: z.array(SoundSegmentSchema).default([]),
    foley: z.array(SoundSegmentSchema).default([]),
    ambience: z.array(SoundSegmentSchema).default([]),
    hard_effects: z.array(SoundSegmentSchema).default([]),
    walla: z.array(SoundSegmentSchema).default([]),
  }),
  _meta: ArtifactMetaSchema.optional(),
});

export type SoundBreakdown = z.infer<typeof SoundBreakdownSchema>;
export type SoundSegment = z.infer<typeof SoundSegmentSchema>;
export type SoundLayer = z.infer<typeof SoundLayerEnum>;
export type SegmentSource = z.infer<typeof SegmentSourceEnum>;
export const SoundBreakdownJsonSchema = zodToJsonSchema(SoundBreakdownSchema);
