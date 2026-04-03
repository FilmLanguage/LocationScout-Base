import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "director_vision_dfv" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "director-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://director/vision/dfv/{id}" as const;

export const DirectorVisionSchema = z.object({
  $schema: z.literal("director-vision-v1"),
  vision_id: z.string().describe("Unique vision ID"),
  project_id: z.string().describe("Parent project ID"),
  era_and_style: z.string().describe("Period and visual style direction, e.g. 'Deliberately low-rent 2004 Albuquerque'"),
  color_palette_mood: z.string().optional().describe("Color palette and mood description"),
  spatial_philosophy: z.string().optional().describe("How spaces should feel and be used"),
  reference_films: z.array(z.string()).optional().describe("Films referenced for style/tone"),
  reference_images: z.array(z.string()).optional().describe("URIs to reference images"),
  emotional_function: z.string().optional().describe("Emotional purpose of visual choices"),
  atmosphere: z.string().optional().describe("Overall atmospheric direction"),
  key_visual_metaphors: z.array(z.string()).optional().describe("Recurring visual metaphors"),
  light_vision: z.string().optional().describe("Lighting philosophy and approach"),
});

export type DirectorVision = z.infer<typeof DirectorVisionSchema>;
export const DirectorVisionJsonSchema = zodToJsonSchema(DirectorVisionSchema);
