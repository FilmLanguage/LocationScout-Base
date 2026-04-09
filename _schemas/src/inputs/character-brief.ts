import { z } from "zod";

/**
 * CharacterBrief — produced by 1AD, consumed by CastingDirector.
 * Describes a single character extracted from the screenplay.
 */
export const CharacterBriefSchema = z.object({
  character_name: z.string().describe("Character name as in screenplay"),
  importance: z.enum(["LEAD", "SUPPORTING", "FEATURED", "BACKGROUND"]).describe("Dramatic weight"),
  scenes: z.array(z.string()).min(1).describe("Scene IDs (GUIDs) where character appears"),
  explicit_appearance: z.array(z.string()).optional().describe("Appearance details from script text"),
  age_indicators: z.array(z.string()).optional().describe("Age clues from script"),
  physical_actions: z.array(z.string()).optional().describe("Key physical actions performed"),
  wardrobe_mentions: z.array(z.string()).optional().describe("Clothing mentioned in script"),
  props_on_person: z.array(z.string()).optional().describe("Personal props"),
  relationships: z.array(z.string()).optional().describe("Key relationships affecting appearance"),
  wardrobe_changes: z.array(z.string()).optional().describe("Wardrobe changes described in script"),
  physical_transformations: z.array(z.string()).optional().describe("Physical changes across the story"),
});

export type CharacterBrief = z.infer<typeof CharacterBriefSchema>;
