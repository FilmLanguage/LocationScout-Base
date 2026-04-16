import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactMetaSchema } from "../common/artifact-meta.js";

export const ARTIFACT_TYPE = "director_scene_vision" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "director-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://director/dsv/{id}/{scene_id}" as const;

/**
 * Diegetic (source) music structurally signaled by the Director.
 * Consumed by Composer's diegetic-cues generator without re-reading scene body.
 *
 * present: false  → Composer emits no diegetic_cues for this scene.
 * present: true   → Composer renders source music using source_type + description + epoch_hint.
 *
 * source_type covers ~95% of common cinema sources; "other" fallback for rare cases.
 */
const DiegeticMusicSchema = z.object({
  present: z.boolean().default(false),
  source_type: z.enum([
    "jukebox",
    "radio",
    "live_performance",
    "club_pa",
    "cafe_ambient",
    "bar_ambient",
    "phone",
    "tv",
    "car_stereo",
    "street_busker",
    "headphones",
    "pa_announcement",
    "other",
  ]).nullable().default(null),
  description: z.string().default(""),         // free text: what the source is and what plays
  epoch_hint: z.string().default(""),          // free text: era marker, e.g. "1990s", "1940s noir", "modern"
}).default({ present: false, source_type: null, description: "", epoch_hint: "" });

/**
 * Mirrors scene_splitter dsv.DirectorSceneVision dataclass exactly.
 * Generated per scene using DFV + scene body + next scene heading.
 */
export const DirectorSceneVisionSchema = z.object({
  $schema: z.literal("director-scene-vision-v1"),
  project_id: z.string(),
  scene_id: z.string(),
  location: z.string().default(""),
  scene_summary: z.string().default(""),
  scene_purpose: z.string().default(""),
  narrative_position: z.string().default(""),
  emotional_beat: z.string().default(""),
  tonal_mix: z.string().default(""),
  character_moment: z.string().default(""),
  key_image: z.string().default(""),
  spatial_relationship: z.string().default(""),
  key_visual_detail: z.string().default(""),
  most_important_moment: z.string().default(""),
  location_feeling: z.string().default(""),
  sound_atmosphere: z.string().default(""),
  key_sounds: z.array(z.string()).default([]),
  diegetic_music: DiegeticMusicSchema,
  action_description: z.string().default(""),
  _meta: ArtifactMetaSchema.optional().describe("Set by update_* tools when a user manually edits"),
});

export type DiegeticMusic = z.infer<typeof DiegeticMusicSchema>;
export type DirectorSceneVision = z.infer<typeof DirectorSceneVisionSchema>;
export const DirectorSceneVisionJsonSchema = zodToJsonSchema(DirectorSceneVisionSchema);
