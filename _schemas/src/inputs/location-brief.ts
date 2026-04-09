import { z } from "zod";

/**
 * LocationBrief — produced by 1AD, consumed by LocationScout.
 * Describes a single physical location extracted from the screenplay.
 * One location can appear in multiple scenes.
 */
export const LocationBriefSchema = z.object({
  location_id: z.string().describe("Unique location GUID, e.g. 'a1b2c3d4-...'"),
  location_name: z.string().describe("Human-readable canonical name, e.g. 'Jesse Apartment - Living Room'"),
  location_type: z.enum(["INT", "EXT", "INT/EXT"]).describe("Interior, exterior, or both"),
  time_of_day: z.array(z.string()).describe("When scenes take place: DAY, NIGHT, DAWN, etc."),
  era: z.string().describe("Historical period or setting, e.g. '2004 Albuquerque'"),
  scenes: z.array(z.string()).min(1).describe("Scene IDs (GUIDs) where this location appears"),
  recurring: z.boolean().describe("Whether location appears in multiple scenes"),
  character_actions: z.array(z.string()).optional().describe("Key physical actions characters perform here"),
  required_practicals: z.array(z.string()).optional().describe("Practical light sources and effects"),
  props_mentioned: z.array(z.string()).optional().describe("Props explicitly mentioned in script"),
  explicit_details: z.array(z.string()).optional().describe("Script-specified physical details"),
});

export type LocationBrief = z.infer<typeof LocationBriefSchema>;
