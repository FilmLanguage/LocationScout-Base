import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "model_sheet" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "casting-director-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://casting-director/model-sheet/{id}" as const;

export const ModelSheetSchema = z.object({
  $schema: z.literal("model-sheet-v1"),
  sheet_id: z.string().describe("Unique model sheet ID"),
  face_id: z.string().describe("Reference to face anchor used"),
  body_id: z.string().describe("Reference to body anchor used"),
  wardrobe_id: z.string().describe("Reference to wardrobe entry used"),
  front_url: z.string().describe("URL to front view — full body with wardrobe"),
  three_quarter_url: z.string().describe("URL to 3/4 view — full body with wardrobe"),
  profile_url: z.string().describe("URL to profile view — full body with wardrobe"),
  model_prompt: z.string().describe("Generation prompt used to create model sheet"),
  generation_params: z.record(z.unknown()).optional().describe("Model-specific generation parameters"),
  approval_status: z.enum(["draft", "pending_review", "approved", "rejected"]).default("draft"),
  feedback_notes: z.string().optional().describe("Notes from approval/rejection review"),
});

export type ModelSheet = z.infer<typeof ModelSheetSchema>;
export const ModelSheetJsonSchema = zodToJsonSchema(ModelSheetSchema);
