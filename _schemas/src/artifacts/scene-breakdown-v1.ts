import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "scene_breakdown" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "1ad-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://1ad/scene-breakdown/{id}" as const;

/**
 * One scene as produced by scene_splitter's merger.Scene dataclass.
 * The body is the verbatim slice of the source text — never paraphrased.
 */
export const SceneSchema = z.object({
  scene_id: z.string().describe("Stable SHA256-derived id (16 hex chars)"),
  number: z.number().int().describe("1-based sequential scene number"),
  heading: z.string().describe("Scene heading, e.g. 'INT. KITCHEN — MORNING'"),
  body: z.string().describe("Full verbatim scene text"),
  characters: z.array(z.string()).default([]),
  location: z.string().default(""),
  time: z.string().default(""),
  int_ext: z.string().default("").describe("INT / EXT / INT/EXT"),
  emotional_beat: z.string().default(""),
  word_count: z.number().int().optional(),
});

export type Scene = z.infer<typeof SceneSchema>;

export const SceneBreakdownSchema = z.object({
  $schema: z.literal("scene-breakdown-v1"),
  project_id: z.string(),
  total_scenes: z.number().int(),
  scenes: z.array(SceneSchema),
});

export type SceneBreakdown = z.infer<typeof SceneBreakdownSchema>;
export const SceneBreakdownJsonSchema = zodToJsonSchema(SceneBreakdownSchema);
