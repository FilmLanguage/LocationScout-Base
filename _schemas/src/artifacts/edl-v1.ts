import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ShotSchema } from "./shot-v1.js";
import { ArtifactMetaSchema } from "../common/artifact-meta.js";

export const ARTIFACT_TYPE = "edl" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "editor-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://editor/edl/{id}" as const;

/**
 * Final flat shot table — one row per shot, denormalised with scene context.
 * Matches the row shape produced by scene_splitter vision_pipeline.run_vision_pipeline().
 */
export const EdlRowSchema = ShotSchema.extend({
  scene_id: z.string(),
  scene_number: z.number().int(),
  scene_heading: z.string().default(""),
  location: z.string().default(""),
  time: z.string().default(""),
  shot_id: z.string().describe("Derived: `${scene_id}_s${shot_number:03d}`"),

  // ── Video source ─────────────────────────────────────────────
  source_type: z.enum(["ungenerated", "single", "multishot"]).default("ungenerated"),
  multishot_group_id: z.string().nullable().default(null),
  /**
   * The actual playable asset for this row, materialised when a take is applied/selected.
   * `start`/`end` are coordinates inside the parent multishot video (for debug/trim);
   * `video_url`/`thumbnail_url`/`duration` describe the standalone sliced asset for UI playback.
   * Null until apply_multishot_takes runs (or for ungenerated rows).
   */
  source_segment: z
    .object({
      generation_id: z.string().describe("MultishotGeneration.id this segment came from."),
      segment_index: z.number().int().min(0).describe("Index inside MultishotGeneration.segments[]."),
      video_url: z.string().url().describe("Direct playable URL of the sliced segment."),
      thumbnail_url: z.string().url().describe("First-frame JPEG of the segment."),
      duration: z.number().describe("Actual segment duration (seconds, fractional)."),
      start: z.number().describe("Start time inside the parent multishot video."),
      end: z.number().describe("End time inside the parent multishot video."),
    })
    .nullable()
    .default(null)
    .describe("Materialised sliced segment for the active take. Null if no take is applied yet."),
  selected_take_id: z.string().nullable().default(null).describe("MultishotGeneration.id of the active take. Drives the Editor UI dropdown."),
  /**
   * True when auto-slicing failed to match the expected shot count (detect_cuts fallback).
   * The active take covers the whole multishot video unsplit. UI shows a warning + Regenerate.
   */
  slicing_failed: z.boolean().default(false),
  /**
   * Original duration assigned by the montage step (whole seconds). Frozen at apply time
   * so UI can show "planned 5s / actual 4.7s" when Kling generates off-target.
   */
  planned_duration: z
    .number()
    .int()
    .nullable()
    .default(null)
    .describe("Pacing-map duration captured at apply time. Survives take switches; `duration` follows the active take."),
});

export type EdlRow = z.infer<typeof EdlRowSchema>;

export const EdlSchema = z.object({
  $schema: z.literal("edl-v1"),
  project_id: z.string(),
  total_shots: z.number().int(),
  total_duration_sec: z.number().int().default(0),
  shots: z.array(EdlRowSchema),
  _meta: ArtifactMetaSchema.optional().describe("Set by update_* tools when a user manually edits"),
});

export type Edl = z.infer<typeof EdlSchema>;
export const EdlJsonSchema = zodToJsonSchema(EdlSchema);

/**
 * Pacing map — derived projection of `EdlRow.duration` keyed by `${scene_id}:${shot_number}`.
 * Auto-rebuilt by every tool that writes edl.json (create_pacing_map, apply_multishot_takes,
 * update_edl). Holds the *current* timeline: integer seconds for ungenerated/single-shot rows,
 * fractional for multishot rows. The frozen "plan" lives in `EdlRow.planned_duration`, not here.
 */
export const PacingMapSchema = z.object({
  $schema: z.literal("pacing-map-v1"),
  project_id: z.string(),
  durations: z.record(z.string(), z.number()),
  _meta: ArtifactMetaSchema.optional().describe("Set by update_* tools when a user manually edits"),
});

export type PacingMap = z.infer<typeof PacingMapSchema>;
export const PacingMapJsonSchema = zodToJsonSchema(PacingMapSchema);
