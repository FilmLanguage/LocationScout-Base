import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { IssueSchema } from "../common/issue.js";
import { StepStateSchema, ShotGenStateSchema } from "./step-state-v1.js";
import { StyleFrameReferencesSchema } from "./style-frame-references-v1.js";

export const ARTIFACT_TYPE = "scene_generation_job" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "scene-generator-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://scene-generator/job/{job_id}" as const;

/**
 * Scene Generation Job — orchestrator artifact tracking one end-to-end
 * scene generation run.
 *
 * Pipeline:
 *   1. Parallel: Cinematographer (DPSV + fan-out DPShV per shot),
 *      LocationScout, CastingDirector.
 *   2. ArtDirector (after the three above).
 *   3. Style frame bundle.
 *   4. Per shot in parallel: Nano Banana 2 image, then Kling v3 video.
 *
 * Retries on model failure only; no manual regeneration UI in MVP.
 */
export const JobStatusEnum = z.enum([
  "pending_confirm",
  "running",
  "pending_video_confirm",
  "completed",
  "failed",
  "cancelled",
]);
export type JobStatus = z.infer<typeof JobStatusEnum>;

export const SceneGenerationJobSchema = z.object({
  $schema: z.literal("scene-generation-job-v1"),
  job_id: z.string(),
  project_id: z.string(),
  scene_id: z.string(),
  status: JobStatusEnum,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),

  shot_count: z.number().int().min(0),

  steps: z.object({
    cinematographer:  StepStateSchema,
    location_scout:   StepStateSchema,
    casting_director: StepStateSchema,
    art_director:     StepStateSchema,
    style_bundle:     StepStateSchema,
    shots: z.array(ShotGenStateSchema).default([]),
  }),

  style_frame_refs: StyleFrameReferencesSchema.optional(),
  error: IssueSchema.optional(),
});
export type SceneGenerationJob = z.infer<typeof SceneGenerationJobSchema>;
export const SceneGenerationJobJsonSchema = zodToJsonSchema(SceneGenerationJobSchema);
