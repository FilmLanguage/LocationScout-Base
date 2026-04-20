import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactMetaSchema } from "../common/artifact-meta.js";

export const ARTIFACT_TYPE = "composer_film_vision" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "composer-base" as const;
export const URI_PATTERN = "agent://composer/cfv/{id}" as const;
export const MIME_TYPE = "application/json" as const;

/**
 * Composer's Film Vision (CFV) — musical blueprint for the entire film.
 * Generated ONCE per project (two-pass: Haiku inventory → Opus synthesis)
 * after reading DFV + Film IR + all DSV summaries.
 *
 * Architecture (this is v1's rewrite — supersedes the earlier "cues+motifs"
 * shape that had no genre awareness or motif-discipline rules):
 *
 *   1. Genre is a free-text descriptor + an LLM-chosen palette of instruments
 *      derived from DFV.tone_reference_films and a knowledge-base of palette
 *      directions. NO hard-coded genre→palette enum lookup; the KB is
 *      inspiration, not a dictionary, so hybrid genres (e.g. "indie dramedy
 *      with noir undertones") map to a film-specific palette.
 *
 *   2. Motifs are RARE — only main characters (Film IR importance LEAD or
 *      SUPPORTING + LLM judgement on narrative_weight), significant locations
 *      (≥3 scenes AND emotional weight in DSV.location_feeling), and key
 *      cross-scene emotions. binding references the canonical entity_id from
 *      Film IR (1AD), not a free-text name — this avoids "Алексей"/"Лёша"
 *      string-matching breakage.
 *
 *   3. Scene intensities are split into score_intensity and diegetic_intensity
 *      so the orchestrator can decide which track(s) to render per scene.
 */

const PaletteEntrySchema = z.string().describe(
  "Specific instrument or sonic element (e.g. '12-string acoustic guitar', " +
  "'modular synth pulse', 'Roland TR-808'). Not a genre tag.",
);

const MotifTypeEnum = z.enum(["character", "location", "emotion"]);

const MotifSchema = z.object({
  id: z.string(),                                          // "m_yana", "m_bar", "m_grief"
  name: z.string(),
  type: MotifTypeEnum,
  /**
   * For character motifs: character_id from Film IR (1AD).
   * For location motifs: location_id from Film IR.
   * For emotion motifs: short slug ("grief", "first_love").
   * NEVER a free-text display name — Director's DFV.character_energies and
   * 1AD's Film IR are the canonical registries.
   */
  binding: z.string(),
  description: z.string().default(""),                     // emotional core
  instrumentation_hint: z.array(z.string()).default([]),   // which palette instruments carry it
  scenes_present: z.array(z.number()).default([]),         // scene_numbers where motif is active
});

const CombinationRuleSchema = z.object({
  condition: z.string(),                                   // "m_yana + m_gio"
  result: z.string(),                                      // "low harmonised duet, motifs interlock"
});

/**
 * Per-scene musical intensity — score and diegetic measured INDEPENDENTLY.
 * 0 means "no track of that type for this scene". 0-10 scale otherwise.
 *
 * Mood/style are NOT here — they are derived per-scene from DSV by csv-score
 * and csv-diegetic generators. Intensity is volume/density only, orthogonal
 * to mood (a quiet sad scene is intensity 2 + minor melodic mood, NOT
 * "ambient" by default — ambient is a style choice, not an intensity tier).
 */
const SceneIntensitySchema = z.object({
  scene_number: z.number(),
  score_intensity: z.number().min(0).max(10),
  diegetic_intensity: z.number().min(0).max(10),
  note: z.string().default(""),
});

const ReferenceSchema = z.object({
  title: z.string(),
  why: z.string().default(""),
  what_to_take: z.string().default(""),
});

export const ComposerFilmVisionSchema = z.object({
  $schema: z.literal("composer-film-vision-v1"),
  project_id: z.string(),

  // ─── Genre & Palette (LLM-chosen, KB-informed) ─────────────────────────
  /**
   * Free-text descriptor reflecting the film's actual genre mix.
   * Examples: "indie dramedy with noir undertones", "synth-driven neo-thriller",
   * "lo-fi acoustic mumblecore", "atmospheric folk horror".
   * Not an enum — hybrid genres are the norm in real cinema.
   */
  genre_descriptor: z.string().default(""),
  primary_palette: z.array(PaletteEntrySchema).default([]),     // dominant instruments for this film
  secondary_palette: z.array(PaletteEntrySchema).default([]),   // permitted accents
  excluded_palette: z.array(PaletteEntrySchema).default([]),    // explicit no-go (auto-feeds negative_global_styles)
  palette_rationale: z.string().default(""),                    // why this palette fits the film

  // ─── Arc & World ───────────────────────────────────────────────────────
  emotional_arc: z.string().default(""),                        // 1-2 sentences on the musical journey
  world_sound_feeling: z.string().default(""),                  // how the film's world sounds
  silence_strategy: z.string().default(""),                     // when to play nothing, and why

  /**
   * Mood-priority instruction inherited from DFV.tonal_guidance, normalized
   * here so per-scene CSV generators read it once per film instead of doing
   * an extra DFV fetch. cfv-system.md tells the Pass-2 LLM to copy the
   * value verbatim from DFV.tonal_guidance.
   */
  tonal_guidance: z.string().default(""),

  // ─── Motifs (rare, earned only) ────────────────────────────────────────
  motifs: z.array(MotifSchema).default([]),
  combination_rules: z.array(CombinationRuleSchema).default([]),

  // ─── Per-scene intensities (split track) ───────────────────────────────
  scene_intensities: z.array(SceneIntensitySchema).default([]),

  // ─── External references ───────────────────────────────────────────────
  references: z.array(ReferenceSchema).default([]),

  // ─── Approval gate metadata ────────────────────────────────────────────
  /**
   * approve_artifact tool sets approved=true; orchestrator blocks CSV
   * generation until then. Single source of truth for the gate.
   */
  approved: z.boolean().default(false),
  approved_at: z.string().default(""),                          // ISO 8601 timestamp

  _meta: ArtifactMetaSchema.optional().describe("Set by update_* tools when a user manually edits"),
});

export type Motif = z.infer<typeof MotifSchema>;
export type MotifType = z.infer<typeof MotifTypeEnum>;
export type CombinationRule = z.infer<typeof CombinationRuleSchema>;
export type SceneIntensity = z.infer<typeof SceneIntensitySchema>;
export type Reference = z.infer<typeof ReferenceSchema>;
export type ComposerFilmVision = z.infer<typeof ComposerFilmVisionSchema>;
export { MotifTypeEnum };
export const ComposerFilmVisionJsonSchema = zodToJsonSchema(ComposerFilmVisionSchema);
