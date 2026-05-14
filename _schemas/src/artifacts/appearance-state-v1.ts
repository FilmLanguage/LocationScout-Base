import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "appearance_states" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "casting-director-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://casting-director/appearance/{id}" as const;

export const AppearanceEntrySchema = z.object({
  scene_ids: z.array(z.string()).min(0).describe("Scenes where this appearance applies. Empty for generic per-outfit appearance."),
  act: z.number().int().min(1).max(5).optional().describe("Act number (optional when scene_ids empty)"),
  outfit_id: z.string().optional().describe("outfit_id from WardrobeBible. Set when this appearance was generated per-outfit."),
  appearance_image_url: z.string().optional().describe("Generated reference image URL for this appearance (character in outfit, scene, or state)."),
  prompt_used: z.string().optional().describe("Prompt that produced the image. UI re-editable."),
  reference_image_uris: z.array(z.string()).optional().describe("MCP URIs of reference images passed at generation (face anchor, body anchor, outfit model sheet, user uploads)."),
  approval_status: z.enum(["draft", "pending_review", "approved", "rejected"]).optional(),
  hair_delta: z.string().nullable().optional().describe("Change from base hairstyle. null = use bible base"),
  facial_hair: z.string().nullable().optional().describe("Facial hair state. null = use bible base"),
  wardrobe_ref: z.string().nullable().optional().describe("DEPRECATED alias for outfit_id"),
  physical_change: z.string().nullable().optional().describe("Weight gain/loss, injury, aging. null = no change"),
  condition: z.enum(["fresh", "tired", "exhausted", "injured", "disheveled", "pristine"]).nullable().optional().describe("Physical condition. null = neutral"),
  accessories: z.string().nullable().optional().describe("Added/removed accessories for this state"),
});

export const AppearanceStatesSchema = z.object({
  $schema: z.literal("appearance-state-v1"),
  state_id: z.string().describe("Unique ID, format: appear_{bible_id}_{number}"),
  bible_id: z.string().describe("Reference to parent Character Bible"),
  entries: z.array(AppearanceEntrySchema).min(0).describe("Per-outfit / per-scene appearance entries. Empty when no appearances generated yet."),
});

export type AppearanceStates = z.infer<typeof AppearanceStatesSchema>;
export type AppearanceEntry = z.infer<typeof AppearanceEntrySchema>;
export const AppearanceStatesJsonSchema = zodToJsonSchema(AppearanceStatesSchema);
