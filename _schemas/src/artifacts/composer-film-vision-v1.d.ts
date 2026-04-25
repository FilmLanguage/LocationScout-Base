import { z } from "zod";
export declare const ARTIFACT_TYPE: "composer_film_vision";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "composer-base";
export declare const URI_PATTERN: "agent://composer/cfv/{id}";
export declare const MIME_TYPE: "application/json";
declare const MotifTypeEnum: z.ZodEnum<["character", "location", "emotion"]>;
declare const MotifSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["character", "location", "emotion"]>;
    /**
     * For character motifs: character_id from Film IR (1AD).
     * For location motifs: location_id from Film IR.
     * For emotion motifs: short slug ("grief", "first_love").
     * NEVER a free-text display name — Director's DFV.character_energies and
     * 1AD's Film IR are the canonical registries.
     */
    binding: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    instrumentation_hint: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    scenes_present: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "location" | "character" | "emotion";
    description: string;
    id: string;
    binding: string;
    instrumentation_hint: string[];
    scenes_present: number[];
}, {
    name: string;
    type: "location" | "character" | "emotion";
    id: string;
    binding: string;
    description?: string | undefined;
    instrumentation_hint?: string[] | undefined;
    scenes_present?: number[] | undefined;
}>;
declare const CombinationRuleSchema: z.ZodObject<{
    condition: z.ZodString;
    result: z.ZodString;
}, "strip", z.ZodTypeAny, {
    condition: string;
    result: string;
}, {
    condition: string;
    result: string;
}>;
/**
 * Per-scene musical intensity — score and diegetic measured INDEPENDENTLY.
 * 0 means "no track of that type for this scene". 0-10 scale otherwise.
 *
 * Mood/style are NOT here — they are derived per-scene from DSV by csv-score
 * and csv-diegetic generators. Intensity is volume/density only, orthogonal
 * to mood (a quiet sad scene is intensity 2 + minor melodic mood, NOT
 * "ambient" by default — ambient is a style choice, not an intensity tier).
 */
declare const SceneIntensitySchema: z.ZodObject<{
    scene_number: z.ZodNumber;
    score_intensity: z.ZodNumber;
    diegetic_intensity: z.ZodNumber;
    note: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    scene_number: number;
    score_intensity: number;
    diegetic_intensity: number;
    note: string;
}, {
    scene_number: number;
    score_intensity: number;
    diegetic_intensity: number;
    note?: string | undefined;
}>;
declare const ReferenceSchema: z.ZodObject<{
    title: z.ZodString;
    why: z.ZodDefault<z.ZodString>;
    what_to_take: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    why: string;
    what_to_take: string;
}, {
    title: string;
    why?: string | undefined;
    what_to_take?: string | undefined;
}>;
export declare const ComposerFilmVisionSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"composer-film-vision-v1">;
    project_id: z.ZodString;
    /**
     * Free-text descriptor reflecting the film's actual genre mix.
     * Examples: "indie dramedy with noir undertones", "synth-driven neo-thriller",
     * "lo-fi acoustic mumblecore", "atmospheric folk horror".
     * Not an enum — hybrid genres are the norm in real cinema.
     */
    genre_descriptor: z.ZodDefault<z.ZodString>;
    primary_palette: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    secondary_palette: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    excluded_palette: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    palette_rationale: z.ZodDefault<z.ZodString>;
    emotional_arc: z.ZodDefault<z.ZodString>;
    world_sound_feeling: z.ZodDefault<z.ZodString>;
    silence_strategy: z.ZodDefault<z.ZodString>;
    /**
     * Mood-priority instruction inherited from DFV.tonal_guidance, normalized
     * here so per-scene CSV generators read it once per film instead of doing
     * an extra DFV fetch. cfv-system.md tells the Pass-2 LLM to copy the
     * value verbatim from DFV.tonal_guidance.
     */
    tonal_guidance: z.ZodDefault<z.ZodString>;
    motifs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<["character", "location", "emotion"]>;
        /**
         * For character motifs: character_id from Film IR (1AD).
         * For location motifs: location_id from Film IR.
         * For emotion motifs: short slug ("grief", "first_love").
         * NEVER a free-text display name — Director's DFV.character_energies and
         * 1AD's Film IR are the canonical registries.
         */
        binding: z.ZodString;
        description: z.ZodDefault<z.ZodString>;
        instrumentation_hint: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        scenes_present: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: "location" | "character" | "emotion";
        description: string;
        id: string;
        binding: string;
        instrumentation_hint: string[];
        scenes_present: number[];
    }, {
        name: string;
        type: "location" | "character" | "emotion";
        id: string;
        binding: string;
        description?: string | undefined;
        instrumentation_hint?: string[] | undefined;
        scenes_present?: number[] | undefined;
    }>, "many">>;
    combination_rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        condition: z.ZodString;
        result: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        condition: string;
        result: string;
    }, {
        condition: string;
        result: string;
    }>, "many">>;
    scene_intensities: z.ZodDefault<z.ZodArray<z.ZodObject<{
        scene_number: z.ZodNumber;
        score_intensity: z.ZodNumber;
        diegetic_intensity: z.ZodNumber;
        note: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        scene_number: number;
        score_intensity: number;
        diegetic_intensity: number;
        note: string;
    }, {
        scene_number: number;
        score_intensity: number;
        diegetic_intensity: number;
        note?: string | undefined;
    }>, "many">>;
    references: z.ZodDefault<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        why: z.ZodDefault<z.ZodString>;
        what_to_take: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        why: string;
        what_to_take: string;
    }, {
        title: string;
        why?: string | undefined;
        what_to_take?: string | undefined;
    }>, "many">>;
    /**
     * approve_artifact tool sets approved=true; orchestrator blocks CSV
     * generation until then. Single source of truth for the gate.
     */
    approved: z.ZodDefault<z.ZodBoolean>;
    approved_at: z.ZodDefault<z.ZodString>;
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
    references: {
        title: string;
        why: string;
        what_to_take: string;
    }[];
    approved: boolean;
    $schema: "composer-film-vision-v1";
    tonal_guidance: string;
    genre_descriptor: string;
    primary_palette: string[];
    secondary_palette: string[];
    excluded_palette: string[];
    palette_rationale: string;
    emotional_arc: string;
    world_sound_feeling: string;
    silence_strategy: string;
    motifs: {
        name: string;
        type: "location" | "character" | "emotion";
        description: string;
        id: string;
        binding: string;
        instrumentation_hint: string[];
        scenes_present: number[];
    }[];
    combination_rules: {
        condition: string;
        result: string;
    }[];
    scene_intensities: {
        scene_number: number;
        score_intensity: number;
        diegetic_intensity: number;
        note: string;
    }[];
    approved_at: string;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
}, {
    project_id: string;
    $schema: "composer-film-vision-v1";
    references?: {
        title: string;
        why?: string | undefined;
        what_to_take?: string | undefined;
    }[] | undefined;
    approved?: boolean | undefined;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
    tonal_guidance?: string | undefined;
    genre_descriptor?: string | undefined;
    primary_palette?: string[] | undefined;
    secondary_palette?: string[] | undefined;
    excluded_palette?: string[] | undefined;
    palette_rationale?: string | undefined;
    emotional_arc?: string | undefined;
    world_sound_feeling?: string | undefined;
    silence_strategy?: string | undefined;
    motifs?: {
        name: string;
        type: "location" | "character" | "emotion";
        id: string;
        binding: string;
        description?: string | undefined;
        instrumentation_hint?: string[] | undefined;
        scenes_present?: number[] | undefined;
    }[] | undefined;
    combination_rules?: {
        condition: string;
        result: string;
    }[] | undefined;
    scene_intensities?: {
        scene_number: number;
        score_intensity: number;
        diegetic_intensity: number;
        note?: string | undefined;
    }[] | undefined;
    approved_at?: string | undefined;
}>;
export type Motif = z.infer<typeof MotifSchema>;
export type MotifType = z.infer<typeof MotifTypeEnum>;
export type CombinationRule = z.infer<typeof CombinationRuleSchema>;
export type SceneIntensity = z.infer<typeof SceneIntensitySchema>;
export type Reference = z.infer<typeof ReferenceSchema>;
export type ComposerFilmVision = z.infer<typeof ComposerFilmVisionSchema>;
export { MotifTypeEnum };
export declare const ComposerFilmVisionJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
