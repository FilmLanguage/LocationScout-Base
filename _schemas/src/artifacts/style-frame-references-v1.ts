import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactRefSchema } from "../common/artifact-ref.js";

export const ARTIFACT_TYPE = "style_frame_references" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "scene-generator-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://scene-generator/style-refs/{project_id}/{scene_id}" as const;

/**
 * Style Frame References — consolidated bundle of upstream visual anchors
 * for a single scene, built after Cinematographer / LocationScout /
 * CastingDirector / ArtDirector all finish their per-scene work.
 *
 * Consumed by the per-shot Nano Banana 2 image prompt builder.
 * The bundle is constant across all shots in the scene — per-shot DPShV
 * is read separately and combined at prompt-build time.
 */
export const CharacterRefSchema = z.object({
  character_id: z.string(),
  face_anchor_url: z.string().url().optional(),
  model_sheet_urls: z.array(z.string().url()).default([]),
  appearance_state_url: z.string().url().optional(),
});
export type CharacterRef = z.infer<typeof CharacterRefSchema>;

export const StyleFrameReferencesSchema = z.object({
  $schema: z.literal("style-frame-references-v1"),
  project_id: z.string(),
  scene_id: z.string(),

  dpsv_ref: ArtifactRefSchema.describe("Cinematographer DoP Scene Vision"),
  location_anchor_urls: z.array(z.string().url()).default([]),
  location_bible_ref: ArtifactRefSchema.optional(),
  character_refs: z.array(CharacterRefSchema).default([]),
  scene_style_ref: ArtifactRefSchema.describe("ArtDirector SceneStyle"),
  style_reference_image_urls: z.array(z.string().url()).default([]),
  palette: z.array(z.string()).default([]).describe("Hex color codes from SceneStyle"),
  film_grain: z.string().optional(),
  mood_state_ref: ArtifactRefSchema.optional(),
});
export type StyleFrameReferences = z.infer<typeof StyleFrameReferencesSchema>;
export const StyleFrameReferencesJsonSchema = zodToJsonSchema(StyleFrameReferencesSchema);
