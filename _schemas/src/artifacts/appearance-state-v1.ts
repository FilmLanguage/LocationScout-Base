import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "appearance_states" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "casting-director-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://casting-director/appearance/{id}" as const;

export const AppearanceEntrySchema = z.object({
  scene_ids: z.array(z.string()).min(1).describe("Scenes where this appearance state applies"),
  act: z.number().int().min(1).max(5).describe("Act number"),
  hair_delta: z.string().nullable().optional().describe("Change from base hairstyle. null = use bible base"),
  facial_hair: z.string().nullable().optional().describe("Facial hair state. null = use bible base"),
  wardrobe_ref: z.string().nullable().optional().describe("outfit_id from WardrobeBible. null = use base_wardrobe"),
  physical_change: z.string().nullable().optional().describe("Weight gain/loss, injury, aging. null = no change"),
  condition: z.enum(["fresh", "tired", "exhausted", "injured", "disheveled", "pristine"]).nullable().optional().describe("Physical condition. null = neutral"),
  accessories: z.string().nullable().optional().describe("Added/removed accessories for this state"),
});

export const AppearanceStatesSchema = z.object({
  $schema: z.literal("appearance-state-v1"),
  state_id: z.string().describe("Unique ID, format: appear_{bible_id}_{number}"),
  bible_id: z.string().describe("Reference to parent Character Bible"),
  entries: z.array(AppearanceEntrySchema).min(1).describe("Per-scene appearance variations"),
});

export type AppearanceStates = z.infer<typeof AppearanceStatesSchema>;
export type AppearanceEntry = z.infer<typeof AppearanceEntrySchema>;
export const AppearanceStatesJsonSchema = zodToJsonSchema(AppearanceStatesSchema);
