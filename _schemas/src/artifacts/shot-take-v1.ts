import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { MultishotStatusEnum } from "./multishot-generation-v1.js";

export const ARTIFACT_TYPE = "shot_take" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "shot-generation" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN =
  "agent://shot-generation/shot-take/{multishot_group_id}" as const;

/**
 * Lightweight index of takes for one multishot group.
 * Stored as takes/{multishot_group_id}.json — one document per group.
 *
 * Each ShotTake entry maps to one MultishotGeneration (take_id = MultishotGeneration.id).
 * The full Kling request/response lives in MultishotGenerationSchema;
 * ShotTake is the lightweight record the Editor UI reads to populate the
 * "Take 1 / Take 2 …" dropdown.
 */
export const ShotTakeSchema = z.object({
  take_id: z.string().describe("MultishotGeneration.id for this take"),
  multishot_group_id: z.string(),
  shot_ids: z.array(z.string()).min(2).max(6),
  take_number: z.number().int().min(1),
  status: MultishotStatusEnum,
  video_url: z
    .string()
    .url()
    .optional()
    .describe("MultishotGeneration.output_video_url — populated when status = sliced"),
  created_at: z.string().describe("ISO timestamp"),
});

export const ShotTakeListSchema = z.object({
  $schema: z.literal("shot-take-v1"),
  multishot_group_id: z.string(),
  takes: z.array(ShotTakeSchema),
});

export type ShotTake = z.infer<typeof ShotTakeSchema>;
export type ShotTakeList = z.infer<typeof ShotTakeListSchema>;
export const ShotTakeListJsonSchema = zodToJsonSchema(ShotTakeListSchema);
