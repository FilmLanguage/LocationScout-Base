import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactMetaSchema } from "../common/artifact-meta.js";

export const ARTIFACT_TYPE = "director_film_vision" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "director-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://director/dfv/{id}" as const;

/**
 * Mirrors scene_splitter dfv.DirectorFilmVision dataclass.
 * Film-level creative direction produced ONCE per project, before DSV.
 */
export const CharacterEnergySchema = z.object({
  name: z.string(),
  energy: z.string(),
});

export const DirectorFilmVisionSchema = z.object({
  $schema: z.literal("director-film-vision-v1"),
  project_id: z.string(),
  central_themes: z.array(z.string()).default([]),
  emotional_journey: z.string().default(""),
  visual_style: z.string().default(""),
  key_visual_techniques: z.string().default(""),
  color_philosophy: z.string().default(""),
  tone_reference_films: z.array(z.string()).default([]),
  recurring_visual_motifs: z.array(z.string()).default([]),
  world_feeling: z.string().default(""),
  genre_approach: z.string().default(""),
  /**
   * Free-text guidance for downstream agents on whose emotional truth drives the scene's tone.
   * Consumed by Composer (mood priority for score), DP (lighting affect), Editor (cut rhythm).
   * Examples:
   *   "character emotion drives tone — trust the inner state over scene surface (postirony, dramedy)"
   *   "scene tone drives — characters serve the genre's emotional contract (thriller, horror)"
   *   "balance — score reflects scene first, characters as undertone (ensemble drama)"
   */
  tonal_guidance: z.string().default(""),
  character_energies: z.array(CharacterEnergySchema).default([]),
  _meta: ArtifactMetaSchema.optional().describe("Set by update_* tools when a user manually edits"),
});

export type DirectorFilmVision = z.infer<typeof DirectorFilmVisionSchema>;
export const DirectorFilmVisionJsonSchema = zodToJsonSchema(DirectorFilmVisionSchema);
