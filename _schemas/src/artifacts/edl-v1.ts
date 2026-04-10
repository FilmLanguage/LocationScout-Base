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
 * Pacing map — the montage step's output, keyed by a `${scene_id}:${shot_number}`
 * composite so scenes processed independently don't collide.
 */
export const PacingMapSchema = z.object({
  $schema: z.literal("pacing-map-v1"),
  project_id: z.string(),
  durations: z.record(z.string(), z.number().int()),
  _meta: ArtifactMetaSchema.optional().describe("Set by update_* tools when a user manually edits"),
});

export type PacingMap = z.infer<typeof PacingMapSchema>;
export const PacingMapJsonSchema = zodToJsonSchema(PacingMapSchema);
