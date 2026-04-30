import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "multishot_generation" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "shot-generation" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN =
  "agent://shot-generation/multishot-generation/{id}" as const;

/**
 * Lifecycle of a single Kling multishot generation.
 *
 * Transitions:
 *   pending → generating → detecting_cuts → slicing → sliced
 *   (any non-terminal stage may move to failed_generation or failed_slice)
 */
export const MultishotStatusEnum = z.enum([
  "pending",
  "generating",
  "detecting_cuts",
  "slicing",
  "sliced",
  "failed_generation",
  "failed_slice",
]);

/**
 * One shot inside the multi_prompt array — mirrors FAL's per-shot shape.
 * `duration` stored as integer seconds; converted to string at the FAL boundary.
 */
export const MultiPromptItemSchema = z.object({
  prompt: z.string().min(1).describe("Per-shot prompt text"),
  duration: z.number().int().min(1).describe("Per-shot duration in seconds"),
});

/**
 * Character/object reference passed to Kling as one entry of `elements`.
 * Mirrors FAL's input shape exactly so the api-client can serialise without
 * remapping.
 */
export const MultishotElementSchema = z.object({
  reference_image_urls: z
    .array(z.string().url())
    .min(1)
    .describe("Reference views of the entity (multiple angles / poses)"),
  frontal_image_url: z
    .string()
    .url()
    .optional()
    .describe("Canonical frontal view, when applicable (e.g. a character's face)"),

  // ── Identity metadata (stripped before sending to FAL) ───────
  entity_id: z
    .string()
    .optional()
    .describe("Owning entity — character_id or location_id"),
  entity_type: z
    .enum(["character", "location"])
    .optional()
    .describe("Type of entity this element represents"),

  // ── FAL / Kling voice binding ─────────────────────────────────
  voice_id: z
    .string()
    .optional()
    .describe("Kling voice ID for this element. Video only. Get from fal-ai/kling-video/create-voice"),
});

/**
 * One physical segment of a sliced multishot — one EdlRow's actual asset.
 * Index aligns with `MultishotGeneration.shot_ids[i]` — segment[i] is the take
 * for shot_ids[i]. Produced by splitter-service /slice_video.
 */
export const MultishotSegmentSchema = z.object({
  index: z.number().int().min(0).describe("Position in the sliced output. Must equal shot_ids[].index."),
  start: z.number().describe("Start time in the source multishot video (seconds, fractional)."),
  end: z.number().describe("End time in the source multishot video (seconds, fractional)."),
  duration: z.number().describe("Actual segment duration (end - start). Kling rarely hits the requested duration exactly."),
  video_url: z.string().url().describe("Direct playable URL of the sliced segment."),
  thumbnail_url: z.string().url().describe("First-frame JPEG of the segment, for UI preview."),
});

/**
 * One Kling multishot call: what was requested, what came back, where it was sliced.
 * Produced by Shot Generation. One MultishotGroup may have many of these (one per
 * "Take" — every Regenerate creates a new MultishotGeneration sharing the same
 * multishot_group_id).
 */
export const MultishotGenerationSchema = z.object({
  // ── Identity (required) ─────────────────────────────────────
  id: z.string().describe("e.g. 'msg_b91c_gen_001'"),
  project_id: z.string(),
  scene_id: z.string(),
  multishot_group_id: z
    .string()
    .describe(
      "Stable group identity across regenerations. Multiple MultishotGenerations " +
        "(Take 1, Take 2…) of the same multishot share this id.",
    ),
  shot_ids: z
    .array(z.string())
    .min(2)
    .max(6)
    .describe(
      "Ordered EdlRow.shot_id list. After slicing, segment[i] becomes a take for shot_ids[i].",
    ),

  // ── Request to Kling — required core ────────────────────────
  model: z.literal("kling-o3-pro"),
  multi_prompt: z
    .array(MultiPromptItemSchema)
    .min(2)
    .max(6)
    .describe("Per-shot prompts. Kling O3 Pro supports 2–6 shots per generation."),
  total_duration: z
    .number()
    .max(15)
    .describe("Sum of multi_prompt durations. Must be ≤15s (Kling cap)."),
  start_image_url: z
    .string()
    .url()
    .describe("Reference start frame. Required for reference-to-video endpoint."),
  aspect_ratio: z.string().default("16:9"),

  // ── Request to Kling — optional ─────────────────────────────
  prompt: z
    .string()
    .optional()
    .describe(
      "Top-level prompt. Usage with multi_prompt unclear in FAL docs — kept optional " +
        "so we can populate it if a use case appears.",
    ),
  end_image_url: z
    .string()
    .url()
    .optional()
    .describe("Optional reference end frame (user-provided)."),
  negative_prompt: z.string().optional(),
  generate_audio: z
    .boolean()
    .default(false)
    .describe("Audio is produced separately by SoundDesigner; default off."),
  elements: z
    .array(MultishotElementSchema)
    .optional()
    .describe(
      "Character/object references sent to Kling. Resolved from existing " +
        "ReferenceRef[] via the reference-resolver in shot-generation.",
    ),

  // ── Result — populated progressively ────────────────────────
  status: MultishotStatusEnum,
  output_video_url: z
    .string()
    .url()
    .optional()
    .describe("Stitched MP4 returned by Kling; populated when generation succeeds."),
  cut_points: z
    .array(z.number())
    .optional()
    .describe("Cut timestamps detected by splitter-service /detect_cuts."),
  cut_confidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Confidence reported by the cut detector."),
  segments: z
    .array(MultishotSegmentSchema)
    .optional()
    .describe(
      "Per-shot sliced segments produced by splitter-service /slice_video. " +
        "Length matches shot_ids[] — segments[i] is the take for shot_ids[i]. " +
        "Populated when status reaches 'sliced'.",
    ),
  fallback_used: z
    .boolean()
    .optional()
    .describe(
      "True when cut detection couldn't match the requested shot count exactly. " +
        "UI shows a warning and the multishot is stored as a single take spanning the whole video.",
    ),

  // ── Metadata ────────────────────────────────────────────────
  fal_request_id: z.string().optional().describe("FAL job id, for billing & debugging."),
  cost_usd: z.number().optional(),
  created_at: z.string().describe("ISO timestamp when this generation was queued."),
  generated_at: z.string().optional().describe("ISO timestamp when Kling returned the video."),
  sliced_at: z.string().optional().describe("ISO timestamp when slicing finished."),
  error: z.string().optional().describe("Set when status is failed_*."),
});

export type MultishotGeneration = z.infer<typeof MultishotGenerationSchema>;
export type MultishotSegment = z.infer<typeof MultishotSegmentSchema>;
export type MultiPromptItem = z.infer<typeof MultiPromptItemSchema>;
export type MultishotElement = z.infer<typeof MultishotElementSchema>;
export type MultishotStatus = z.infer<typeof MultishotStatusEnum>;
export const MultishotGenerationJsonSchema = zodToJsonSchema(
  MultishotGenerationSchema,
);
