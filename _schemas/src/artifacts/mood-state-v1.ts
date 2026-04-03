import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "mood_states" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "location-scout-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://location-scout/mood/{id}" as const;

export const MoodStateSchema = z.object({
  $schema: z.literal("mood-state-v1"),
  state_id: z.string().describe("Unique ID, format: mood_{bible_id}_{number}, e.g. mood_loc_001_01"),
  bible_id: z.string().describe("References parent Location Bible"),
  scene_ids: z.array(z.string()).min(1).describe("Which scenes use this state"),
  act: z.number().int().min(1).max(5).describe("Which act (1, 2, 3...)"),
  time_of_day: z.enum(["DAY", "NIGHT", "DAWN", "DUSK", "LATE_NIGHT"]).describe("Time of day for this state"),
  light_direction: z.string().nullable().optional().describe("Override base state. null = use base. Cardinal: N/S/E/W/OVERHEAD"),
  weather: z.string().nullable().optional().describe("Only for EXT. null for INT. Values: clear, overcast, rain, snow, fog"),
  color_temp_kelvin: z.number().int().nullable().optional().describe("Override. null = use base. Integer in Kelvin"),
  shadow_hardness: z.enum(["hard", "soft", "mixed"]).nullable().optional().describe("Override. null = use base"),
  light_change: z.string().optional().describe("Human-readable description of how light differs from base"),
  props_change: z.string().optional().describe("What appeared or disappeared since base state"),
  atmosphere_shift: z.string().optional().describe("How the feeling of the space changed"),
  clutter_level: z.enum(["clean", "slight", "messy", "destroyed"]).optional().describe("Current clutter state"),
  window_state: z.enum(["open", "closed", "curtains_drawn", "boarded_up"]).nullable().optional().describe("Window state override"),
});

export type MoodState = z.infer<typeof MoodStateSchema>;
export const MoodStateJsonSchema = zodToJsonSchema(MoodStateSchema);
