import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactMetaSchema } from "../common/artifact-meta.js";

export const ARTIFACT_TYPE = "dop_film_vision" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "cinematographer-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://cinematographer/dpfv/{id}" as const;

/**
 * Mirrors scene_splitter dpfv.DoPFilmVision dataclass.
 * Film-level cinematographic approach produced ONCE per project, before DPSV.
 */
export const DoPFilmVisionSchema = z.object({
  $schema: z.literal("dop-film-vision-v1"),
  project_id: z.string(),
  camera_system: z.string().default(""),
  lenses: z.string().default(""),
  aspect_ratio: z.string().default(""),
  movement_vocabulary: z.string().default(""),
  lighting_philosophy: z.string().default(""),
  color_temperature: z.string().default(""),
  exposure_philosophy: z.string().default(""),
  depth_of_field_approach: z.string().default(""),
  grain_texture: z.string().default(""),
  key_visual_references: z.array(z.string()).default([]),
  special_requirements: z.string().default(""),
  _meta: ArtifactMetaSchema.optional().describe("Set by update_* tools when a user manually edits"),
});

export type DoPFilmVision = z.infer<typeof DoPFilmVisionSchema>;
export const DoPFilmVisionJsonSchema = zodToJsonSchema(DoPFilmVisionSchema);
