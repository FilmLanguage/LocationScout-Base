import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "scene_style" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "art-director-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://art-director/scene-style/{id}" as const;

export const StyleReferenceSchema = z.object({
  reference_id: z.string().describe("Unique ID, format: ref_{scene_id}_{number}"),
  image_uri: z.string().describe("Storage URI for the reference image"),
  prompt_used: z.string().describe("Image generation prompt that produced this reference"),
  negative_prompt: z.string().optional().describe("Negative prompt used during generation"),
  seed: z.number().int().optional().describe("Random seed for reproducibility"),
  created_at: z.string().optional().describe("ISO 8601 timestamp"),
});

export type StyleReference = z.infer<typeof StyleReferenceSchema>;

export const SceneStyleSchema = z.object({
  $schema: z.literal("scene-style-v1"),
  style_id: z.string().describe("Unique ID, format: style_{scene_id}"),
  scene_id: z.string().describe("Scene identifier from Film IR"),
  project_id: z.string().describe("Project identifier"),
  mood: z.string().describe("Scene mood, e.g. tense, melancholic, euphoric, calm, chaotic, intimate, oppressive"),
  color_palette: z.string().describe("Color palette, e.g. warm_muted, cold_desaturated, high_contrast, monochromatic, earth_tones"),
  lighting: z.string().describe("Lighting style, e.g. natural_soft, harsh_overhead, low_key, high_key, practical_only, golden_hour"),
  film_grain: z.string().describe("Film grain/stock, e.g. none, fine_35mm, heavy_16mm, digital_clean, kodak_5218"),
  context_summary: z.string().optional().describe("AI reasoning for the style choices"),
  reference_images: z.array(StyleReferenceSchema).default([]).describe("Generated style reference images"),
  location_bible_uri: z.string().optional().describe("Source location bible URI"),
  director_vision_uri: z.string().optional().describe("Source director vision URI"),
  approval_status: z.enum(["draft", "approved", "rejected", "revision"]).default("draft"),
});

export type SceneStyle = z.infer<typeof SceneStyleSchema>;
export const SceneStyleJsonSchema = zodToJsonSchema(SceneStyleSchema);
