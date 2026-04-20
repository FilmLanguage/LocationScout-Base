import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactMetaSchema } from "../common/artifact-meta.js";

export const ARTIFACT_TYPE = "composer_scene_vision" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "composer-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://composer/csv/{project_id}/{scene_id}" as const;

/**
 * Composer's Scene Vision (CSV) — per-scene musical realization.
 *
 * Architecture (rewrite from earlier "single-cues+diegetic-flag" shape):
 *
 *   1. Score and Diegetic are FULLY SEPARATED tracks. Different generators,
 *      different prompts, different cues, different ElevenLabs payloads.
 *      The composer decides per scene whether to render score, diegetic,
 *      both, or silence — and explicitly states mix_intent if both are
 *      present.
 *
 *   2. score_cues are mood/motif-driven, derived from CFV + DSV. Each cue
 *      carries tempo_feel and an optional key_centre — without these the
 *      "leitmotif" reduces to timbral repetition only.
 *
 *   3. diegetic_cues are source-driven (DSV.diegetic_music + DSV.location +
 *      DFV.world_feeling for epoch). Carry processing_tags (low-pass,
 *      small-speaker, AM-narrowband) so the source feels physically real.
 *      Composer NEVER names copyrighted songs/artists in style_tags.
 *
 *   4. score_payload and diegetic_payload are ready-to-send to fal.ai's
 *      ElevenLabs Music API — composition_plan with sections, global +
 *      local style tags, music_length_ms, force_instrumental. The mapper
 *      builds these from cues; downstream just hands them off.
 *
 *   5. Intensity is volume/density only. Mood/style live in the cue's
 *      style_tags. A quiet scene CAN be sparse-anxious-modular; it does
 *      NOT default to "ambient drone".
 */

// ─── Score cues (underscore) ──────────────────────────────────────────────

const ScoreCueSchema = z.object({
  cue_id: z.string(),                                       // "1M1", "1M2" — reel+cue notation
  timecode_in: z.string().default(""),                      // HH:MM:SS or seconds (from EDL or estimated)
  timecode_out: z.string().default(""),
  duration_sec: z.number().default(0),
  motifs_active: z.array(z.string()).default([]),           // CFV motif ids: ["m_yana", "m_grief"]
  intensity: z.number().min(0).max(10).default(5),          // volume/density only — orthogonal to mood
  mood: z.string().default(""),                             // human-readable emotion ("aching tenderness")
  instruments: z.array(z.string()).default([]),             // concrete picks from CFV.primary/secondary palette
  tempo_feel: z.string().default(""),                       // "rubato", "80 steady", "180 driving" — free text
  key_centre: z.string().default(""),                       // "D minor modal", "F# major", "" if not committed
  description: z.string().default(""),                      // narrative for human reviewer
  style_tags: z.array(z.string()).default([]),              // tag list for ElevenLabs section, NOT prose
});

// ─── Diegetic cues (source music) ─────────────────────────────────────────

const DiegeticVisibilityEnum = z.enum([
  "on_screen_source",      // source object visible (jukebox, radio, band)
  "implied_visible",       // source plausibly off-screen but in the same space
  "unseen_ambient",        // mood-establishing, source not seen or implied
]);

const DiegeticNarrativeRoleEnum = z.enum([
  "atmosphere",            // pure world-building
  "emotional_subtext",     // commentary on character state
  "plot_device",           // music drives action (someone changes the song, etc)
  "character_choice",      // a character actively chose this
]);

const DiegeticCueSchema = z.object({
  cue_id: z.string(),                                       // "1D1", "1D2"
  timecode_in: z.string().default(""),
  timecode_out: z.string().default(""),
  duration_sec: z.number().default(0),
  source_description: z.string().default(""),               // free text: "dusty bar jukebox playing 90s alt-rock"
  visibility: DiegeticVisibilityEnum.default("unseen_ambient"),
  narrative_role: DiegeticNarrativeRoleEnum.default("atmosphere"),
  instruments: z.array(z.string()).default([]),             // what's audibly playing in the source
  intensity: z.number().min(0).max(10).default(5),
  style_tags: z.array(z.string()).default([]),              // ["90s alt rock", "lo-fi", ...] — NEVER song/artist names
  processing_tags: z.array(z.string()).default([]),         // ["low-pass-filter", "AM-narrowband", "small-speaker"]
  description: z.string().default(""),                      // narrative for human reviewer
});

// ─── ElevenLabs payload (fal.ai/elevenlabs/music format) ──────────────────

const ElevenLabsSectionSchema = z.object({
  section_name: z.string(),                                 // "1M1 anticipation"
  duration_ms: z.number().min(3000).max(120000),            // fal.ai bounds per section
  positive_local_styles: z.array(z.string()).default([]),
  negative_local_styles: z.array(z.string()).default([]),
});

const ElevenLabsPayloadSchema = z.object({
  prompt: z.string().default(""),                           // top-level styling tags
  composition_plan: z.object({
    positive_global_styles: z.array(z.string()).default([]),
    negative_global_styles: z.array(z.string()).default([]),
    sections: z.array(ElevenLabsSectionSchema).default([]),
  }),
  /**
   * Total duration in ms — equal to sum of sections.duration_ms.
   * Defaults to 0; the elevenlabs-mapper computes it deterministically from
   * sections after LLM output, so prompts no longer ask the LLM to set it.
   * Math is computer territory, not LLM territory.
   */
  music_length_ms: z.number().default(0),
  /**
   * Default true for score (vocals are the diegetic generator's territory).
   * Default false for diegetic (most source music has vocals — see
   * csv-diegetic-system.md guidance). The mapper applies the right default
   * based on the track type.
   */
  force_instrumental: z.boolean().default(true),
});

// ─── Mix intent (when both tracks present) ────────────────────────────────

const DuckTriggerSchema = z.object({
  who_ducks: z.enum(["score", "diegetic"]),
  trigger: z.string(),                                      // "during dialogue", "at 00:01:30 character notices"
  amount_db: z.number(),                                    // -6, -12, -18 (negative = duck down)
});

// ─── CSV root ─────────────────────────────────────────────────────────────

export const ComposerSceneVisionSchema = z.object({
  $schema: z.literal("composer-scene-vision-v1"),
  project_id: z.string(),
  scene_id: z.string(),
  scene_number: z.number().default(0),

  // Two independent tracks — either, both, or neither
  score_cues: z.array(ScoreCueSchema).default([]),
  diegetic_cues: z.array(DiegeticCueSchema).default([]),

  // Ready-to-send payloads (built by elevenlabs-mapper from cues above)
  // Null if the corresponding cues array is empty.
  score_payload: ElevenLabsPayloadSchema.nullable().default(null),
  diegetic_payload: ElevenLabsPayloadSchema.nullable().default(null),

  // When BOTH tracks are present — composer's stated mix decision.
  // Free text ("score primary, diegetic ducks under dialogue") with
  // optional structured ducking_hints for the mix engine.
  // Empty string when only one track is present.
  mix_intent: z.string().default(""),
  ducking_hints: z.array(DuckTriggerSchema).default([]),

  // When BOTH score_cues AND diegetic_cues are empty — explain why
  // (DSV may legitimately call for production-sound-only).
  silence_note: z.string().default(""),

  _meta: ArtifactMetaSchema.optional().describe("Set by update_* tools when a user manually edits"),
});

export type ScoreCue = z.infer<typeof ScoreCueSchema>;
export type DiegeticCue = z.infer<typeof DiegeticCueSchema>;
export type DiegeticVisibility = z.infer<typeof DiegeticVisibilityEnum>;
export type DiegeticNarrativeRole = z.infer<typeof DiegeticNarrativeRoleEnum>;
export type ElevenLabsPayload = z.infer<typeof ElevenLabsPayloadSchema>;
export type ElevenLabsSection = z.infer<typeof ElevenLabsSectionSchema>;
export type DuckTrigger = z.infer<typeof DuckTriggerSchema>;
export type ComposerSceneVision = z.infer<typeof ComposerSceneVisionSchema>;
export { DiegeticVisibilityEnum, DiegeticNarrativeRoleEnum };
export const ComposerSceneVisionJsonSchema = zodToJsonSchema(ComposerSceneVisionSchema);
