import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "shot" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "editor-base" as const;
export const MIME_TYPE = "application/json" as const;
// Shots always live inside an EDL — no standalone URI.
export const URI_PATTERN = "agent://editor/edl/{id}#shot/{shot_id}" as const;

export const ShotSizeEnum = z.enum(["ECU", "CU", "MCU", "MS", "MWS", "WS", "EWS"]);
export const AudioTransitionEnum = z.enum(["cut", "l-cut", "j-cut"]);

/**
 * Mirrors scene_splitter shot_breakdown.Shot dataclass — one row in the
 * Editor's final shot list. `duration` is appended by montage.assign_durations.
 */
export const ShotSchema = z.object({
  shot_number: z.number().int(),

  // Editorial
  shot_size: ShotSizeEnum,
  action: z.string().default(""),
  dialogue: z.string().default(""),
  audio_transition: AudioTransitionEnum.default("cut"),
  characters_in_frame: z.array(z.string()).default([]),

  // Director layer (sourced from DSV)
  director_note: z.string().default(""),
  emotional_intent: z.string().default(""),

  // DoP layer (sourced from DPSV)
  lens: z.string().default(""),
  shutter_speed: z.string().default(""),
  depth_of_field: z.string().default(""),
  lighting_style: z.string().default(""),

  // Added by montage step
  duration: z.number().int().optional().describe("Duration in whole seconds"),
});

export type Shot = z.infer<typeof ShotSchema>;
export const ShotJsonSchema = zodToJsonSchema(ShotSchema);
