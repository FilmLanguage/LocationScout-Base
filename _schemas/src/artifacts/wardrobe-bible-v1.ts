import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "wardrobe_bible" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "casting-director-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://casting-director/wardrobe/{id}" as const;

export const WardrobeEntrySchema = z.object({
  outfit_id: z.string().describe("Unique outfit identifier, e.g. outfit_char001_01"),
  scenes: z.array(z.string()).min(1).describe("Scene IDs where this outfit is worn"),
  description: z.string().describe("Full outfit description: garments, layers, condition"),
  color_palette: z.array(z.string()).min(1).describe("Hex or named colors, e.g. ['#2B3A42', 'faded denim']"),
  outfit_type: z.string().describe("Category: everyday, formal, work, sleepwear, disguise, etc."),
  trigger_context: z.string().optional().describe("What causes the wardrobe change (plot event, time skip)"),
  character_note: z.string().optional().describe("What this outfit reveals about the character's state"),
});

export const WardrobeBibleSchema = z.object({
  $schema: z.literal("wardrobe-bible-v1"),
  wardrobe_id: z.string().describe("Unique wardrobe bible ID"),
  bible_id: z.string().describe("Reference to parent Character Bible"),
  research_id: z.string().describe("Reference to CharacterResearchPack for era validation"),
  entries: z.array(WardrobeEntrySchema).min(1).describe("All outfits for this character"),
  approval_status: z.enum(["draft", "pending_review", "approved", "rejected"]).default("draft"),
});

export type WardrobeBible = z.infer<typeof WardrobeBibleSchema>;
export type WardrobeEntry = z.infer<typeof WardrobeEntrySchema>;
export const WardrobeBibleJsonSchema = zodToJsonSchema(WardrobeBibleSchema);
