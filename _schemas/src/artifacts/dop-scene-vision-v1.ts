import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactMetaSchema } from "../common/artifact-meta.js";

export const ARTIFACT_TYPE = "dop_scene_vision" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "cinematographer-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://cinematographer/dpsv/{id}/{scene_id}" as const;

/**
 * Mirrors scene_splitter dpsv.DoPSceneVision dataclass exactly.
 * Generated per scene using DPFV + DSV + scene body.
 */
export const DoPSceneVisionSchema = z.object({
  $schema: z.literal("dop-scene-vision-v1"),
  project_id: z.string(),
  scene_id: z.string(),
  camera_movement: z.string().default(""),
  lens: z.string().default(""),
  depth_of_field: z.string().default(""),
  lighting_setup: z.string().default(""),
  color_temperature: z.string().default(""),
  exposure_notes: z.string().default(""),
  special_techniques: z.string().default(""),
  location_challenges: z.string().default(""),
  mood_through_camera: z.string().default(""),
  key_images: z.array(z.string()).default([]),
  _meta: ArtifactMetaSchema.optional().describe("Set by update_* tools when a user manually edits"),
});

export type DoPSceneVision = z.infer<typeof DoPSceneVisionSchema>;
export const DoPSceneVisionJsonSchema = zodToJsonSchema(DoPSceneVisionSchema);
