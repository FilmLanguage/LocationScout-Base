import { z } from "zod";
export declare const ARTIFACT_TYPE: "director_scene_vision";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "director-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://director/dsv/{id}/{scene_id}";
/**
 * Diegetic (source) music structurally signaled by the Director.
 * Consumed by Composer's diegetic-cues generator without re-reading scene body.
 *
 * present: false  → Composer emits no diegetic_cues for this scene.
 * present: true   → Composer renders source music using source_type + description + epoch_hint.
 *
 * source_type covers ~95% of common cinema sources; "other" fallback for rare cases.
 */
declare const DiegeticMusicSchema: z.ZodDefault<z.ZodObject<{
    present: z.ZodDefault<z.ZodBoolean>;
    source_type: z.ZodDefault<z.ZodNullable<z.ZodEnum<["jukebox", "radio", "live_performance", "club_pa", "cafe_ambient", "bar_ambient", "phone", "tv", "car_stereo", "street_busker", "headphones", "pa_announcement", "other"]>>>;
    description: z.ZodDefault<z.ZodString>;
    epoch_hint: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    present: boolean;
    source_type: "other" | "jukebox" | "radio" | "live_performance" | "club_pa" | "cafe_ambient" | "bar_ambient" | "phone" | "tv" | "car_stereo" | "street_busker" | "headphones" | "pa_announcement" | null;
    epoch_hint: string;
}, {
    description?: string | undefined;
    present?: boolean | undefined;
    source_type?: "other" | "jukebox" | "radio" | "live_performance" | "club_pa" | "cafe_ambient" | "bar_ambient" | "phone" | "tv" | "car_stereo" | "street_busker" | "headphones" | "pa_announcement" | null | undefined;
    epoch_hint?: string | undefined;
}>>;
/**
 * Mirrors scene_splitter dsv.DirectorSceneVision dataclass exactly.
 * Generated per scene using DFV + scene body + next scene heading.
 */
export declare const DirectorSceneVisionSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"director-scene-vision-v1">;
    project_id: z.ZodString;
    scene_id: z.ZodString;
    location: z.ZodDefault<z.ZodString>;
    scene_summary: z.ZodDefault<z.ZodString>;
    scene_purpose: z.ZodDefault<z.ZodString>;
    narrative_position: z.ZodDefault<z.ZodString>;
    emotional_beat: z.ZodDefault<z.ZodString>;
    tonal_mix: z.ZodDefault<z.ZodString>;
    character_moment: z.ZodDefault<z.ZodString>;
    key_image: z.ZodDefault<z.ZodString>;
    spatial_relationship: z.ZodDefault<z.ZodString>;
    key_visual_detail: z.ZodDefault<z.ZodString>;
    most_important_moment: z.ZodDefault<z.ZodString>;
    location_feeling: z.ZodDefault<z.ZodString>;
    sound_atmosphere: z.ZodDefault<z.ZodString>;
    key_sounds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    diegetic_music: z.ZodDefault<z.ZodObject<{
        present: z.ZodDefault<z.ZodBoolean>;
        source_type: z.ZodDefault<z.ZodNullable<z.ZodEnum<["jukebox", "radio", "live_performance", "club_pa", "cafe_ambient", "bar_ambient", "phone", "tv", "car_stereo", "street_busker", "headphones", "pa_announcement", "other"]>>>;
        description: z.ZodDefault<z.ZodString>;
        epoch_hint: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        present: boolean;
        source_type: "other" | "jukebox" | "radio" | "live_performance" | "club_pa" | "cafe_ambient" | "bar_ambient" | "phone" | "tv" | "car_stereo" | "street_busker" | "headphones" | "pa_announcement" | null;
        epoch_hint: string;
    }, {
        description?: string | undefined;
        present?: boolean | undefined;
        source_type?: "other" | "jukebox" | "radio" | "live_performance" | "club_pa" | "cafe_ambient" | "bar_ambient" | "phone" | "tv" | "car_stereo" | "street_busker" | "headphones" | "pa_announcement" | null | undefined;
        epoch_hint?: string | undefined;
    }>>;
    action_description: z.ZodDefault<z.ZodString>;
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
    $schema: "director-scene-vision-v1";
    location: string;
    emotional_beat: string;
    scene_summary: string;
    scene_purpose: string;
    narrative_position: string;
    tonal_mix: string;
    character_moment: string;
    key_image: string;
    spatial_relationship: string;
    key_visual_detail: string;
    most_important_moment: string;
    location_feeling: string;
    sound_atmosphere: string;
    key_sounds: string[];
    diegetic_music: {
        description: string;
        present: boolean;
        source_type: "other" | "jukebox" | "radio" | "live_performance" | "club_pa" | "cafe_ambient" | "bar_ambient" | "phone" | "tv" | "car_stereo" | "street_busker" | "headphones" | "pa_announcement" | null;
        epoch_hint: string;
    };
    action_description: string;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
}, {
    project_id: string;
    scene_id: string;
    $schema: "director-scene-vision-v1";
    location?: string | undefined;
    emotional_beat?: string | undefined;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
    scene_summary?: string | undefined;
    scene_purpose?: string | undefined;
    narrative_position?: string | undefined;
    tonal_mix?: string | undefined;
    character_moment?: string | undefined;
    key_image?: string | undefined;
    spatial_relationship?: string | undefined;
    key_visual_detail?: string | undefined;
    most_important_moment?: string | undefined;
    location_feeling?: string | undefined;
    sound_atmosphere?: string | undefined;
    key_sounds?: string[] | undefined;
    diegetic_music?: {
        description?: string | undefined;
        present?: boolean | undefined;
        source_type?: "other" | "jukebox" | "radio" | "live_performance" | "club_pa" | "cafe_ambient" | "bar_ambient" | "phone" | "tv" | "car_stereo" | "street_busker" | "headphones" | "pa_announcement" | null | undefined;
        epoch_hint?: string | undefined;
    } | undefined;
    action_description?: string | undefined;
}>;
export type DiegeticMusic = z.infer<typeof DiegeticMusicSchema>;
export type DirectorSceneVision = z.infer<typeof DirectorSceneVisionSchema>;
export declare const DirectorSceneVisionJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
export {};
