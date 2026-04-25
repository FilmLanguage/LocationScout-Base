import { z } from "zod";
export declare const ARTIFACT_TYPE: "composer_scene_vision";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "composer-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://composer/csv/{project_id}/{scene_id}";
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
declare const ScoreCueSchema: z.ZodObject<{
    cue_id: z.ZodString;
    timecode_in: z.ZodDefault<z.ZodString>;
    timecode_out: z.ZodDefault<z.ZodString>;
    duration_sec: z.ZodDefault<z.ZodNumber>;
    motifs_active: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    intensity: z.ZodDefault<z.ZodNumber>;
    mood: z.ZodDefault<z.ZodString>;
    instruments: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    tempo_feel: z.ZodDefault<z.ZodString>;
    key_centre: z.ZodDefault<z.ZodString>;
    description: z.ZodDefault<z.ZodString>;
    style_tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    mood: string;
    description: string;
    cue_id: string;
    timecode_in: string;
    timecode_out: string;
    duration_sec: number;
    motifs_active: string[];
    intensity: number;
    instruments: string[];
    tempo_feel: string;
    key_centre: string;
    style_tags: string[];
}, {
    cue_id: string;
    mood?: string | undefined;
    description?: string | undefined;
    timecode_in?: string | undefined;
    timecode_out?: string | undefined;
    duration_sec?: number | undefined;
    motifs_active?: string[] | undefined;
    intensity?: number | undefined;
    instruments?: string[] | undefined;
    tempo_feel?: string | undefined;
    key_centre?: string | undefined;
    style_tags?: string[] | undefined;
}>;
declare const DiegeticVisibilityEnum: z.ZodEnum<["on_screen_source", "implied_visible", "unseen_ambient"]>;
declare const DiegeticNarrativeRoleEnum: z.ZodEnum<["atmosphere", "emotional_subtext", "plot_device", "character_choice"]>;
declare const DiegeticCueSchema: z.ZodObject<{
    cue_id: z.ZodString;
    timecode_in: z.ZodDefault<z.ZodString>;
    timecode_out: z.ZodDefault<z.ZodString>;
    duration_sec: z.ZodDefault<z.ZodNumber>;
    source_description: z.ZodDefault<z.ZodString>;
    visibility: z.ZodDefault<z.ZodEnum<["on_screen_source", "implied_visible", "unseen_ambient"]>>;
    narrative_role: z.ZodDefault<z.ZodEnum<["atmosphere", "emotional_subtext", "plot_device", "character_choice"]>>;
    instruments: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    intensity: z.ZodDefault<z.ZodNumber>;
    style_tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    processing_tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    description: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    cue_id: string;
    timecode_in: string;
    timecode_out: string;
    duration_sec: number;
    intensity: number;
    instruments: string[];
    style_tags: string[];
    source_description: string;
    visibility: "on_screen_source" | "implied_visible" | "unseen_ambient";
    narrative_role: "atmosphere" | "emotional_subtext" | "plot_device" | "character_choice";
    processing_tags: string[];
}, {
    cue_id: string;
    description?: string | undefined;
    timecode_in?: string | undefined;
    timecode_out?: string | undefined;
    duration_sec?: number | undefined;
    intensity?: number | undefined;
    instruments?: string[] | undefined;
    style_tags?: string[] | undefined;
    source_description?: string | undefined;
    visibility?: "on_screen_source" | "implied_visible" | "unseen_ambient" | undefined;
    narrative_role?: "atmosphere" | "emotional_subtext" | "plot_device" | "character_choice" | undefined;
    processing_tags?: string[] | undefined;
}>;
declare const ElevenLabsSectionSchema: z.ZodObject<{
    section_name: z.ZodString;
    duration_ms: z.ZodNumber;
    positive_local_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    negative_local_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    section_name: string;
    duration_ms: number;
    positive_local_styles: string[];
    negative_local_styles: string[];
}, {
    section_name: string;
    duration_ms: number;
    positive_local_styles?: string[] | undefined;
    negative_local_styles?: string[] | undefined;
}>;
declare const ElevenLabsPayloadSchema: z.ZodObject<{
    prompt: z.ZodDefault<z.ZodString>;
    composition_plan: z.ZodObject<{
        positive_global_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        negative_global_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        sections: z.ZodDefault<z.ZodArray<z.ZodObject<{
            section_name: z.ZodString;
            duration_ms: z.ZodNumber;
            positive_local_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            negative_local_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            section_name: string;
            duration_ms: number;
            positive_local_styles: string[];
            negative_local_styles: string[];
        }, {
            section_name: string;
            duration_ms: number;
            positive_local_styles?: string[] | undefined;
            negative_local_styles?: string[] | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        positive_global_styles: string[];
        negative_global_styles: string[];
        sections: {
            section_name: string;
            duration_ms: number;
            positive_local_styles: string[];
            negative_local_styles: string[];
        }[];
    }, {
        positive_global_styles?: string[] | undefined;
        negative_global_styles?: string[] | undefined;
        sections?: {
            section_name: string;
            duration_ms: number;
            positive_local_styles?: string[] | undefined;
            negative_local_styles?: string[] | undefined;
        }[] | undefined;
    }>;
    /**
     * Total duration in ms — equal to sum of sections.duration_ms.
     * Defaults to 0; the elevenlabs-mapper computes it deterministically from
     * sections after LLM output, so prompts no longer ask the LLM to set it.
     * Math is computer territory, not LLM territory.
     */
    music_length_ms: z.ZodDefault<z.ZodNumber>;
    /**
     * Default true for score (vocals are the diegetic generator's territory).
     * Default false for diegetic (most source music has vocals — see
     * csv-diegetic-system.md guidance). The mapper applies the right default
     * based on the track type.
     */
    force_instrumental: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    composition_plan: {
        positive_global_styles: string[];
        negative_global_styles: string[];
        sections: {
            section_name: string;
            duration_ms: number;
            positive_local_styles: string[];
            negative_local_styles: string[];
        }[];
    };
    music_length_ms: number;
    force_instrumental: boolean;
}, {
    composition_plan: {
        positive_global_styles?: string[] | undefined;
        negative_global_styles?: string[] | undefined;
        sections?: {
            section_name: string;
            duration_ms: number;
            positive_local_styles?: string[] | undefined;
            negative_local_styles?: string[] | undefined;
        }[] | undefined;
    };
    prompt?: string | undefined;
    music_length_ms?: number | undefined;
    force_instrumental?: boolean | undefined;
}>;
declare const DuckTriggerSchema: z.ZodObject<{
    who_ducks: z.ZodEnum<["score", "diegetic"]>;
    trigger: z.ZodString;
    amount_db: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    who_ducks: "score" | "diegetic";
    trigger: string;
    amount_db: number;
}, {
    who_ducks: "score" | "diegetic";
    trigger: string;
    amount_db: number;
}>;
export declare const ComposerSceneVisionSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"composer-scene-vision-v1">;
    project_id: z.ZodString;
    scene_id: z.ZodString;
    scene_number: z.ZodDefault<z.ZodNumber>;
    score_cues: z.ZodDefault<z.ZodArray<z.ZodObject<{
        cue_id: z.ZodString;
        timecode_in: z.ZodDefault<z.ZodString>;
        timecode_out: z.ZodDefault<z.ZodString>;
        duration_sec: z.ZodDefault<z.ZodNumber>;
        motifs_active: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        intensity: z.ZodDefault<z.ZodNumber>;
        mood: z.ZodDefault<z.ZodString>;
        instruments: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        tempo_feel: z.ZodDefault<z.ZodString>;
        key_centre: z.ZodDefault<z.ZodString>;
        description: z.ZodDefault<z.ZodString>;
        style_tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        mood: string;
        description: string;
        cue_id: string;
        timecode_in: string;
        timecode_out: string;
        duration_sec: number;
        motifs_active: string[];
        intensity: number;
        instruments: string[];
        tempo_feel: string;
        key_centre: string;
        style_tags: string[];
    }, {
        cue_id: string;
        mood?: string | undefined;
        description?: string | undefined;
        timecode_in?: string | undefined;
        timecode_out?: string | undefined;
        duration_sec?: number | undefined;
        motifs_active?: string[] | undefined;
        intensity?: number | undefined;
        instruments?: string[] | undefined;
        tempo_feel?: string | undefined;
        key_centre?: string | undefined;
        style_tags?: string[] | undefined;
    }>, "many">>;
    diegetic_cues: z.ZodDefault<z.ZodArray<z.ZodObject<{
        cue_id: z.ZodString;
        timecode_in: z.ZodDefault<z.ZodString>;
        timecode_out: z.ZodDefault<z.ZodString>;
        duration_sec: z.ZodDefault<z.ZodNumber>;
        source_description: z.ZodDefault<z.ZodString>;
        visibility: z.ZodDefault<z.ZodEnum<["on_screen_source", "implied_visible", "unseen_ambient"]>>;
        narrative_role: z.ZodDefault<z.ZodEnum<["atmosphere", "emotional_subtext", "plot_device", "character_choice"]>>;
        instruments: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        intensity: z.ZodDefault<z.ZodNumber>;
        style_tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        processing_tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        description: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        cue_id: string;
        timecode_in: string;
        timecode_out: string;
        duration_sec: number;
        intensity: number;
        instruments: string[];
        style_tags: string[];
        source_description: string;
        visibility: "on_screen_source" | "implied_visible" | "unseen_ambient";
        narrative_role: "atmosphere" | "emotional_subtext" | "plot_device" | "character_choice";
        processing_tags: string[];
    }, {
        cue_id: string;
        description?: string | undefined;
        timecode_in?: string | undefined;
        timecode_out?: string | undefined;
        duration_sec?: number | undefined;
        intensity?: number | undefined;
        instruments?: string[] | undefined;
        style_tags?: string[] | undefined;
        source_description?: string | undefined;
        visibility?: "on_screen_source" | "implied_visible" | "unseen_ambient" | undefined;
        narrative_role?: "atmosphere" | "emotional_subtext" | "plot_device" | "character_choice" | undefined;
        processing_tags?: string[] | undefined;
    }>, "many">>;
    score_payload: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        prompt: z.ZodDefault<z.ZodString>;
        composition_plan: z.ZodObject<{
            positive_global_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            negative_global_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            sections: z.ZodDefault<z.ZodArray<z.ZodObject<{
                section_name: z.ZodString;
                duration_ms: z.ZodNumber;
                positive_local_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                negative_local_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                section_name: string;
                duration_ms: number;
                positive_local_styles: string[];
                negative_local_styles: string[];
            }, {
                section_name: string;
                duration_ms: number;
                positive_local_styles?: string[] | undefined;
                negative_local_styles?: string[] | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            positive_global_styles: string[];
            negative_global_styles: string[];
            sections: {
                section_name: string;
                duration_ms: number;
                positive_local_styles: string[];
                negative_local_styles: string[];
            }[];
        }, {
            positive_global_styles?: string[] | undefined;
            negative_global_styles?: string[] | undefined;
            sections?: {
                section_name: string;
                duration_ms: number;
                positive_local_styles?: string[] | undefined;
                negative_local_styles?: string[] | undefined;
            }[] | undefined;
        }>;
        /**
         * Total duration in ms — equal to sum of sections.duration_ms.
         * Defaults to 0; the elevenlabs-mapper computes it deterministically from
         * sections after LLM output, so prompts no longer ask the LLM to set it.
         * Math is computer territory, not LLM territory.
         */
        music_length_ms: z.ZodDefault<z.ZodNumber>;
        /**
         * Default true for score (vocals are the diegetic generator's territory).
         * Default false for diegetic (most source music has vocals — see
         * csv-diegetic-system.md guidance). The mapper applies the right default
         * based on the track type.
         */
        force_instrumental: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        prompt: string;
        composition_plan: {
            positive_global_styles: string[];
            negative_global_styles: string[];
            sections: {
                section_name: string;
                duration_ms: number;
                positive_local_styles: string[];
                negative_local_styles: string[];
            }[];
        };
        music_length_ms: number;
        force_instrumental: boolean;
    }, {
        composition_plan: {
            positive_global_styles?: string[] | undefined;
            negative_global_styles?: string[] | undefined;
            sections?: {
                section_name: string;
                duration_ms: number;
                positive_local_styles?: string[] | undefined;
                negative_local_styles?: string[] | undefined;
            }[] | undefined;
        };
        prompt?: string | undefined;
        music_length_ms?: number | undefined;
        force_instrumental?: boolean | undefined;
    }>>>;
    diegetic_payload: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        prompt: z.ZodDefault<z.ZodString>;
        composition_plan: z.ZodObject<{
            positive_global_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            negative_global_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            sections: z.ZodDefault<z.ZodArray<z.ZodObject<{
                section_name: z.ZodString;
                duration_ms: z.ZodNumber;
                positive_local_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                negative_local_styles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                section_name: string;
                duration_ms: number;
                positive_local_styles: string[];
                negative_local_styles: string[];
            }, {
                section_name: string;
                duration_ms: number;
                positive_local_styles?: string[] | undefined;
                negative_local_styles?: string[] | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            positive_global_styles: string[];
            negative_global_styles: string[];
            sections: {
                section_name: string;
                duration_ms: number;
                positive_local_styles: string[];
                negative_local_styles: string[];
            }[];
        }, {
            positive_global_styles?: string[] | undefined;
            negative_global_styles?: string[] | undefined;
            sections?: {
                section_name: string;
                duration_ms: number;
                positive_local_styles?: string[] | undefined;
                negative_local_styles?: string[] | undefined;
            }[] | undefined;
        }>;
        /**
         * Total duration in ms — equal to sum of sections.duration_ms.
         * Defaults to 0; the elevenlabs-mapper computes it deterministically from
         * sections after LLM output, so prompts no longer ask the LLM to set it.
         * Math is computer territory, not LLM territory.
         */
        music_length_ms: z.ZodDefault<z.ZodNumber>;
        /**
         * Default true for score (vocals are the diegetic generator's territory).
         * Default false for diegetic (most source music has vocals — see
         * csv-diegetic-system.md guidance). The mapper applies the right default
         * based on the track type.
         */
        force_instrumental: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        prompt: string;
        composition_plan: {
            positive_global_styles: string[];
            negative_global_styles: string[];
            sections: {
                section_name: string;
                duration_ms: number;
                positive_local_styles: string[];
                negative_local_styles: string[];
            }[];
        };
        music_length_ms: number;
        force_instrumental: boolean;
    }, {
        composition_plan: {
            positive_global_styles?: string[] | undefined;
            negative_global_styles?: string[] | undefined;
            sections?: {
                section_name: string;
                duration_ms: number;
                positive_local_styles?: string[] | undefined;
                negative_local_styles?: string[] | undefined;
            }[] | undefined;
        };
        prompt?: string | undefined;
        music_length_ms?: number | undefined;
        force_instrumental?: boolean | undefined;
    }>>>;
    mix_intent: z.ZodDefault<z.ZodString>;
    ducking_hints: z.ZodDefault<z.ZodArray<z.ZodObject<{
        who_ducks: z.ZodEnum<["score", "diegetic"]>;
        trigger: z.ZodString;
        amount_db: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        who_ducks: "score" | "diegetic";
        trigger: string;
        amount_db: number;
    }, {
        who_ducks: "score" | "diegetic";
        trigger: string;
        amount_db: number;
    }>, "many">>;
    silence_note: z.ZodDefault<z.ZodString>;
    _meta: z.ZodOptional<z.ZodObject<{
        user_edited: z.ZodBoolean;
        edited_at: z.ZodString;
        edited_by: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    }, {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    project_id: string;
    scene_id: string;
    $schema: "composer-scene-vision-v1";
    scene_number: number;
    score_cues: {
        mood: string;
        description: string;
        cue_id: string;
        timecode_in: string;
        timecode_out: string;
        duration_sec: number;
        motifs_active: string[];
        intensity: number;
        instruments: string[];
        tempo_feel: string;
        key_centre: string;
        style_tags: string[];
    }[];
    diegetic_cues: {
        description: string;
        cue_id: string;
        timecode_in: string;
        timecode_out: string;
        duration_sec: number;
        intensity: number;
        instruments: string[];
        style_tags: string[];
        source_description: string;
        visibility: "on_screen_source" | "implied_visible" | "unseen_ambient";
        narrative_role: "atmosphere" | "emotional_subtext" | "plot_device" | "character_choice";
        processing_tags: string[];
    }[];
    score_payload: {
        prompt: string;
        composition_plan: {
            positive_global_styles: string[];
            negative_global_styles: string[];
            sections: {
                section_name: string;
                duration_ms: number;
                positive_local_styles: string[];
                negative_local_styles: string[];
            }[];
        };
        music_length_ms: number;
        force_instrumental: boolean;
    } | null;
    diegetic_payload: {
        prompt: string;
        composition_plan: {
            positive_global_styles: string[];
            negative_global_styles: string[];
            sections: {
                section_name: string;
                duration_ms: number;
                positive_local_styles: string[];
                negative_local_styles: string[];
            }[];
        };
        music_length_ms: number;
        force_instrumental: boolean;
    } | null;
    mix_intent: string;
    ducking_hints: {
        who_ducks: "score" | "diegetic";
        trigger: string;
        amount_db: number;
    }[];
    silence_note: string;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
}, {
    project_id: string;
    scene_id: string;
    $schema: "composer-scene-vision-v1";
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
    scene_number?: number | undefined;
    score_cues?: {
        cue_id: string;
        mood?: string | undefined;
        description?: string | undefined;
        timecode_in?: string | undefined;
        timecode_out?: string | undefined;
        duration_sec?: number | undefined;
        motifs_active?: string[] | undefined;
        intensity?: number | undefined;
        instruments?: string[] | undefined;
        tempo_feel?: string | undefined;
        key_centre?: string | undefined;
        style_tags?: string[] | undefined;
    }[] | undefined;
    diegetic_cues?: {
        cue_id: string;
        description?: string | undefined;
        timecode_in?: string | undefined;
        timecode_out?: string | undefined;
        duration_sec?: number | undefined;
        intensity?: number | undefined;
        instruments?: string[] | undefined;
        style_tags?: string[] | undefined;
        source_description?: string | undefined;
        visibility?: "on_screen_source" | "implied_visible" | "unseen_ambient" | undefined;
        narrative_role?: "atmosphere" | "emotional_subtext" | "plot_device" | "character_choice" | undefined;
        processing_tags?: string[] | undefined;
    }[] | undefined;
    score_payload?: {
        composition_plan: {
            positive_global_styles?: string[] | undefined;
            negative_global_styles?: string[] | undefined;
            sections?: {
                section_name: string;
                duration_ms: number;
                positive_local_styles?: string[] | undefined;
                negative_local_styles?: string[] | undefined;
            }[] | undefined;
        };
        prompt?: string | undefined;
        music_length_ms?: number | undefined;
        force_instrumental?: boolean | undefined;
    } | null | undefined;
    diegetic_payload?: {
        composition_plan: {
            positive_global_styles?: string[] | undefined;
            negative_global_styles?: string[] | undefined;
            sections?: {
                section_name: string;
                duration_ms: number;
                positive_local_styles?: string[] | undefined;
                negative_local_styles?: string[] | undefined;
            }[] | undefined;
        };
        prompt?: string | undefined;
        music_length_ms?: number | undefined;
        force_instrumental?: boolean | undefined;
    } | null | undefined;
    mix_intent?: string | undefined;
    ducking_hints?: {
        who_ducks: "score" | "diegetic";
        trigger: string;
        amount_db: number;
    }[] | undefined;
    silence_note?: string | undefined;
}>;
export type ScoreCue = z.infer<typeof ScoreCueSchema>;
export type DiegeticCue = z.infer<typeof DiegeticCueSchema>;
export type DiegeticVisibility = z.infer<typeof DiegeticVisibilityEnum>;
export type DiegeticNarrativeRole = z.infer<typeof DiegeticNarrativeRoleEnum>;
export type ElevenLabsPayload = z.infer<typeof ElevenLabsPayloadSchema>;
export type ElevenLabsSection = z.infer<typeof ElevenLabsSectionSchema>;
export type DuckTrigger = z.infer<typeof DuckTriggerSchema>;
export type ComposerSceneVision = z.infer<typeof ComposerSceneVisionSchema>;
export { DiegeticVisibilityEnum, DiegeticNarrativeRoleEnum };
export declare const ComposerSceneVisionJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
