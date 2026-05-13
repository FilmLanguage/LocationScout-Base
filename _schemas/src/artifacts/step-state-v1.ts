import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactRefSchema } from "../common/artifact-ref.js";
import { IssueSchema } from "../common/issue.js";

/**
 * Step state — reusable progress descriptor for any step inside a multi-step job.
 *
 * Used by SceneGenerator-Base to track each stage of its pipeline
 * (creative agents, style bundle, per-shot image and video).
 */
export const StepStatusEnum = z.enum([
  "pending",
  "running",
  "retrying",
  "ok",
  "failed",
  "skipped",
]);
export type StepStatus = z.infer<typeof StepStatusEnum>;

export const StepStateSchema = z.object({
  status: StepStatusEnum,
  started_at: z.string().datetime().optional(),
  finished_at: z.string().datetime().optional(),
  attempt: z.number().int().min(0).default(0),
  max_attempts: z.number().int().min(1).default(3),
  agent_tool: z.string().optional().describe("Origin tool, e.g. cinematographer.create_dpsv"),
  output_ref: ArtifactRefSchema.optional(),
  error: IssueSchema.optional(),
});
export type StepState = z.infer<typeof StepStateSchema>;
export const StepStateJsonSchema = zodToJsonSchema(StepStateSchema);

/**
 * Per-shot generation state — image + video sub-steps for a single shot.
 */
export const ShotGenStateSchema = StepStateSchema.extend({
  shot_id: z.string(),
  shot_index: z.number().int().min(0),
  requested_duration_s: z.number().describe("Duration from EDL/timeline before clamping"),
  actual_duration_s: z.number().int().min(3).max(15).describe("Duration sent to Kling (clamped to 3..15)"),
  dpshv: StepStateSchema.extend({
    dpshv_ref: ArtifactRefSchema.optional(),
  }),
  image: StepStateSchema.extend({
    image_url: z.string().url().optional(),
    fal_request_id: z.string().optional(),
    model: z.string().default("fal-ai/nano-banana-2/edit"),
  }),
  video: StepStateSchema.extend({
    video_url: z.string().url().optional(),
    fal_request_id: z.string().optional(),
    model: z.string().default("fal-ai/kling-video/v3/pro/image-to-video"),
    input_image_url: z.string().url().optional(),
  }),
});
export type ShotGenState = z.infer<typeof ShotGenStateSchema>;
export const ShotGenStateJsonSchema = zodToJsonSchema(ShotGenStateSchema);
