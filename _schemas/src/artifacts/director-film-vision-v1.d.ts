import { z } from "zod";
export declare const ARTIFACT_TYPE: "director_film_vision";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "director-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://director/dfv/{id}";
/**
 * Mirrors scene_splitter dfv.DirectorFilmVision dataclass.
 * Film-level creative direction produced ONCE per project, before DSV.
 */
export declare const CharacterEnergySchema: z.ZodObject<{
    name: z.ZodString;
    energy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    energy: string;
}, {
    name: string;
    energy: string;
}>;
export declare const DirectorFilmVisionSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"director-film-vision-v1">;
    project_id: z.ZodString;
    central_themes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    emotional_journey: z.ZodDefault<z.ZodString>;
    visual_style: z.ZodDefault<z.ZodString>;
    key_visual_techniques: z.ZodDefault<z.ZodString>;
    color_philosophy: z.ZodDefault<z.ZodString>;
    tone_reference_films: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    recurring_visual_motifs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    world_feeling: z.ZodDefault<z.ZodString>;
    genre_approach: z.ZodDefault<z.ZodString>;
    /**
     * Free-text guidance for downstream agents on whose emotional truth drives the scene's tone.
     * Consumed by Composer (mood priority for score), DP (lighting affect), Editor (cut rhythm).
     * Examples:
     *   "character emotion drives tone — trust the inner state over scene surface (postirony, dramedy)"
     *   "scene tone drives — characters serve the genre's emotional contract (thriller, horror)"
     *   "balance — score reflects scene first, characters as undertone (ensemble drama)"
     */
    tonal_guidance: z.ZodDefault<z.ZodString>;
    character_energies: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        energy: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        energy: string;
    }, {
        name: string;
        energy: string;
    }>, "many">>;
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
    $schema: "director-film-vision-v1";
    central_themes: string[];
    emotional_journey: string;
    visual_style: string;
    key_visual_techniques: string;
    color_philosophy: string;
    tone_reference_films: string[];
    recurring_visual_motifs: string[];
    world_feeling: string;
    genre_approach: string;
    tonal_guidance: string;
    character_energies: {
        name: string;
        energy: string;
    }[];
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
}, {
    project_id: string;
    $schema: "director-film-vision-v1";
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
    central_themes?: string[] | undefined;
    emotional_journey?: string | undefined;
    visual_style?: string | undefined;
    key_visual_techniques?: string | undefined;
    color_philosophy?: string | undefined;
    tone_reference_films?: string[] | undefined;
    recurring_visual_motifs?: string[] | undefined;
    world_feeling?: string | undefined;
    genre_approach?: string | undefined;
    tonal_guidance?: string | undefined;
    character_energies?: {
        name: string;
        energy: string;
    }[] | undefined;
}>;
export type DirectorFilmVision = z.infer<typeof DirectorFilmVisionSchema>;
export declare const DirectorFilmVisionJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
