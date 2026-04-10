import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "location_bible" as const;
export const ARTIFACT_VERSION = "v2" as const;
export const PRODUCED_BY = "location-scout-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://location-scout/bible/{id}" as const;

export const PassportSchema = z.object({
  type: z.enum(["INT", "EXT", "INT/EXT"]).describe("Interior, exterior, or both"),
  time_of_day: z.array(z.string()).describe("When scenes take place: DAY, NIGHT, DAWN, DUSK, CONTINUOUS"),
  era: z.string().describe("Historical period, e.g. '2004 Albuquerque'"),
  recurring: z.boolean().default(false).describe("true if location appears in 3+ scenes"),
  scenes: z.array(z.string()).describe("Scene IDs"),
  cluster_id: z.string().nullable().optional().describe("Cluster ID for grouped locations"),
});

export const LightBaseStateSchema = z.object({
  primary_source: z.string().describe("e.g. 'window', 'overhead fluorescent'"),
  direction: z.string().describe("Cardinal: N/S/E/W/NE/NW/SE/SW/OVERHEAD/MULTIPLE"),
  color_temp_kelvin: z.number().int().describe("2700=warm, 4000=neutral, 5500=daylight, 6500=overcast"),
  shadow_hardness: z.enum(["hard", "soft", "mixed"]).describe("Shadow edge quality"),
  fill_to_key_ratio: z.string().describe("e.g. '1:2' or '1:8'"),
  practical_sources: z.array(z.string()).default([]).describe("Practical light sources in the scene"),
});

export const LocationBibleSchema = z.object({
  $schema: z.literal("location-bible-v2"),
  bible_id: z.string().describe("Unique bible ID, e.g. loc_001"),
  brief_id: z.string().describe("Reference to source AdLocationBrief"),
  vision_id: z.string().describe("Reference to DirectorVision"),
  research_id: z.string().describe("Reference to ResearchPack"),
  passport: PassportSchema,
  space_description: z.string().min(1).describe("Canonical text description of the space (min 400 words recommended)"),
  atmosphere: z.string().describe("Emotional and sensory quality of the space"),
  light_base_state: LightBaseStateSchema,
  key_details: z.array(z.string()).min(1).describe("5-8 specific visual details that define the space"),
  negative_list: z.array(z.string()).min(1).describe("Items that must NEVER appear (3+ items, goes to negative_prompt)"),
  approval_status: z.enum(["draft", "pending_review", "approved", "rejected"]).default("draft"),
});

export type LocationBible = z.infer<typeof LocationBibleSchema>;
export type Passport = z.infer<typeof PassportSchema>;
export type LightBaseState = z.infer<typeof LightBaseStateSchema>;
export const LocationBibleJsonSchema = zodToJsonSchema(LocationBibleSchema);
