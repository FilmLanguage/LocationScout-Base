import { z } from "zod";
export declare const ARTIFACT_TYPE: "sound_breakdown";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "sound-designer-base";
export declare const URI_PATTERN: "agent://sound-designer/breakdown/{id}";
export declare const MIME_TYPE: "application/json";
/**
 * Sound layer types — the 6 standard post-production sound design layers.
 * Dialogue is readonly (extraction only, no regeneration).
 */
export declare const SoundLayerEnum: z.ZodEnum<["dialogue", "sfx", "foley", "ambience", "hard_effects", "walla"]>;
/**
 * Source provenance for a segment's audio.
 * - "extracted": audio came from Demucs stem separation
 * - "needs_generation": no usable audio, must be generated
 * - "generated": replacement audio was generated via ElevenLabs SFX
 * - "silent": intentionally silent (no audio needed)
 */
export declare const SegmentSourceEnum: z.ZodEnum<["extracted", "needs_generation", "generated", "silent"]>;
/**
 * A single sound segment within a layer.
 * Represents one discrete sound event (footstep, door slam, ambience bed, etc.)
 */
export declare const SoundSegmentSchema: z.ZodObject<{
    segment_id: z.ZodString;
    layer: z.ZodEnum<["dialogue", "sfx", "foley", "ambience", "hard_effects", "walla"]>;
    shot_number: z.ZodOptional<z.ZodNumber>;
    timecode_in: z.ZodNumber;
    timecode_out: z.ZodNumber;
    description: z.ZodDefault<z.ZodString>;
    suggested_prompt: z.ZodDefault<z.ZodString>;
    original_prompt: z.ZodOptional<z.ZodString>;
    original_audio_url: z.ZodOptional<z.ZodString>;
    source: z.ZodEnum<["extracted", "needs_generation", "generated", "silent"]>;
    readonly: z.ZodDefault<z.ZodBoolean>;
    quality_score: z.ZodOptional<z.ZodNumber>;
    sync_frame: z.ZodOptional<z.ZodNumber>;
    audio_url: z.ZodOptional<z.ZodString>;
    replacement: z.ZodOptional<z.ZodObject<{
        replacement_id: z.ZodString;
        prompt: z.ZodString;
        generated_audio_url: z.ZodString;
        status: z.ZodEnum<["generated", "applied", "rejected"]>;
    }, "strip", z.ZodTypeAny, {
        status: "rejected" | "generated" | "applied";
        prompt: string;
        replacement_id: string;
        generated_audio_url: string;
    }, {
        status: "rejected" | "generated" | "applied";
        prompt: string;
        replacement_id: string;
        generated_audio_url: string;
    }>>;
    user_edited: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    user_edited: boolean;
    source: "extracted" | "needs_generation" | "generated" | "silent";
    description: string;
    timecode_in: number;
    timecode_out: number;
    segment_id: string;
    layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
    suggested_prompt: string;
    readonly: boolean;
    shot_number?: number | undefined;
    original_prompt?: string | undefined;
    original_audio_url?: string | undefined;
    quality_score?: number | undefined;
    sync_frame?: number | undefined;
    audio_url?: string | undefined;
    replacement?: {
        status: "rejected" | "generated" | "applied";
        prompt: string;
        replacement_id: string;
        generated_audio_url: string;
    } | undefined;
}, {
    source: "extracted" | "needs_generation" | "generated" | "silent";
    timecode_in: number;
    timecode_out: number;
    segment_id: string;
    layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
    user_edited?: boolean | undefined;
    description?: string | undefined;
    shot_number?: number | undefined;
    suggested_prompt?: string | undefined;
    original_prompt?: string | undefined;
    original_audio_url?: string | undefined;
    readonly?: boolean | undefined;
    quality_score?: number | undefined;
    sync_frame?: number | undefined;
    audio_url?: string | undefined;
    replacement?: {
        status: "rejected" | "generated" | "applied";
        prompt: string;
        replacement_id: string;
        generated_audio_url: string;
    } | undefined;
}>;
/**
 * Sound Breakdown — per-scene post-production audio analysis.
 *
 * Created by the `analyze_scene` tool: Demucs separates audio into
 * vocals/rest, VLM analyzes video frames, Claude classifies segments
 * into 6 layers with timecodes and generation prompts.
 */
export declare const SoundBreakdownSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"sound-breakdown-v1">;
    project_id: z.ZodString;
    scene_id: z.ZodString;
    scene_number: z.ZodNumber;
    source_video_url: z.ZodString;
    created_at: z.ZodString;
    demucs_model: z.ZodDefault<z.ZodEnum<["htdemucs", "htdemucs_ft"]>>;
    total_duration_sec: z.ZodNumber;
    shots: z.ZodDefault<z.ZodArray<z.ZodObject<{
        shot_number: z.ZodNumber;
        timecode_in: z.ZodNumber;
        timecode_out: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        shot_number: number;
        timecode_in: number;
        timecode_out: number;
    }, {
        shot_number: number;
        timecode_in: number;
        timecode_out: number;
    }>, "many">>;
    layers: z.ZodObject<{
        dialogue: z.ZodDefault<z.ZodArray<z.ZodObject<{
            segment_id: z.ZodString;
            layer: z.ZodEnum<["dialogue", "sfx", "foley", "ambience", "hard_effects", "walla"]>;
            shot_number: z.ZodOptional<z.ZodNumber>;
            timecode_in: z.ZodNumber;
            timecode_out: z.ZodNumber;
            description: z.ZodDefault<z.ZodString>;
            suggested_prompt: z.ZodDefault<z.ZodString>;
            original_prompt: z.ZodOptional<z.ZodString>;
            original_audio_url: z.ZodOptional<z.ZodString>;
            source: z.ZodEnum<["extracted", "needs_generation", "generated", "silent"]>;
            readonly: z.ZodDefault<z.ZodBoolean>;
            quality_score: z.ZodOptional<z.ZodNumber>;
            sync_frame: z.ZodOptional<z.ZodNumber>;
            audio_url: z.ZodOptional<z.ZodString>;
            replacement: z.ZodOptional<z.ZodObject<{
                replacement_id: z.ZodString;
                prompt: z.ZodString;
                generated_audio_url: z.ZodString;
                status: z.ZodEnum<["generated", "applied", "rejected"]>;
            }, "strip", z.ZodTypeAny, {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            }, {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            }>>;
            user_edited: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }, {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }>, "many">>;
        sfx: z.ZodDefault<z.ZodArray<z.ZodObject<{
            segment_id: z.ZodString;
            layer: z.ZodEnum<["dialogue", "sfx", "foley", "ambience", "hard_effects", "walla"]>;
            shot_number: z.ZodOptional<z.ZodNumber>;
            timecode_in: z.ZodNumber;
            timecode_out: z.ZodNumber;
            description: z.ZodDefault<z.ZodString>;
            suggested_prompt: z.ZodDefault<z.ZodString>;
            original_prompt: z.ZodOptional<z.ZodString>;
            original_audio_url: z.ZodOptional<z.ZodString>;
            source: z.ZodEnum<["extracted", "needs_generation", "generated", "silent"]>;
            readonly: z.ZodDefault<z.ZodBoolean>;
            quality_score: z.ZodOptional<z.ZodNumber>;
            sync_frame: z.ZodOptional<z.ZodNumber>;
            audio_url: z.ZodOptional<z.ZodString>;
            replacement: z.ZodOptional<z.ZodObject<{
                replacement_id: z.ZodString;
                prompt: z.ZodString;
                generated_audio_url: z.ZodString;
                status: z.ZodEnum<["generated", "applied", "rejected"]>;
            }, "strip", z.ZodTypeAny, {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            }, {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            }>>;
            user_edited: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }, {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }>, "many">>;
        foley: z.ZodDefault<z.ZodArray<z.ZodObject<{
            segment_id: z.ZodString;
            layer: z.ZodEnum<["dialogue", "sfx", "foley", "ambience", "hard_effects", "walla"]>;
            shot_number: z.ZodOptional<z.ZodNumber>;
            timecode_in: z.ZodNumber;
            timecode_out: z.ZodNumber;
            description: z.ZodDefault<z.ZodString>;
            suggested_prompt: z.ZodDefault<z.ZodString>;
            original_prompt: z.ZodOptional<z.ZodString>;
            original_audio_url: z.ZodOptional<z.ZodString>;
            source: z.ZodEnum<["extracted", "needs_generation", "generated", "silent"]>;
            readonly: z.ZodDefault<z.ZodBoolean>;
            quality_score: z.ZodOptional<z.ZodNumber>;
            sync_frame: z.ZodOptional<z.ZodNumber>;
            audio_url: z.ZodOptional<z.ZodString>;
            replacement: z.ZodOptional<z.ZodObject<{
                replacement_id: z.ZodString;
                prompt: z.ZodString;
                generated_audio_url: z.ZodString;
                status: z.ZodEnum<["generated", "applied", "rejected"]>;
            }, "strip", z.ZodTypeAny, {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            }, {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            }>>;
            user_edited: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }, {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }>, "many">>;
        ambience: z.ZodDefault<z.ZodArray<z.ZodObject<{
            segment_id: z.ZodString;
            layer: z.ZodEnum<["dialogue", "sfx", "foley", "ambience", "hard_effects", "walla"]>;
            shot_number: z.ZodOptional<z.ZodNumber>;
            timecode_in: z.ZodNumber;
            timecode_out: z.ZodNumber;
            description: z.ZodDefault<z.ZodString>;
            suggested_prompt: z.ZodDefault<z.ZodString>;
            original_prompt: z.ZodOptional<z.ZodString>;
            original_audio_url: z.ZodOptional<z.ZodString>;
            source: z.ZodEnum<["extracted", "needs_generation", "generated", "silent"]>;
            readonly: z.ZodDefault<z.ZodBoolean>;
            quality_score: z.ZodOptional<z.ZodNumber>;
            sync_frame: z.ZodOptional<z.ZodNumber>;
            audio_url: z.ZodOptional<z.ZodString>;
            replacement: z.ZodOptional<z.ZodObject<{
                replacement_id: z.ZodString;
                prompt: z.ZodString;
                generated_audio_url: z.ZodString;
                status: z.ZodEnum<["generated", "applied", "rejected"]>;
            }, "strip", z.ZodTypeAny, {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            }, {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            }>>;
            user_edited: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }, {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }>, "many">>;
        hard_effects: z.ZodDefault<z.ZodArray<z.ZodObject<{
            segment_id: z.ZodString;
            layer: z.ZodEnum<["dialogue", "sfx", "foley", "ambience", "hard_effects", "walla"]>;
            shot_number: z.ZodOptional<z.ZodNumber>;
            timecode_in: z.ZodNumber;
            timecode_out: z.ZodNumber;
            description: z.ZodDefault<z.ZodString>;
            suggested_prompt: z.ZodDefault<z.ZodString>;
            original_prompt: z.ZodOptional<z.ZodString>;
            original_audio_url: z.ZodOptional<z.ZodString>;
            source: z.ZodEnum<["extracted", "needs_generation", "generated", "silent"]>;
            readonly: z.ZodDefault<z.ZodBoolean>;
            quality_score: z.ZodOptional<z.ZodNumber>;
            sync_frame: z.ZodOptional<z.ZodNumber>;
            audio_url: z.ZodOptional<z.ZodString>;
            replacement: z.ZodOptional<z.ZodObject<{
                replacement_id: z.ZodString;
                prompt: z.ZodString;
                generated_audio_url: z.ZodString;
                status: z.ZodEnum<["generated", "applied", "rejected"]>;
            }, "strip", z.ZodTypeAny, {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            }, {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            }>>;
            user_edited: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }, {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }>, "many">>;
        walla: z.ZodDefault<z.ZodArray<z.ZodObject<{
            segment_id: z.ZodString;
            layer: z.ZodEnum<["dialogue", "sfx", "foley", "ambience", "hard_effects", "walla"]>;
            shot_number: z.ZodOptional<z.ZodNumber>;
            timecode_in: z.ZodNumber;
            timecode_out: z.ZodNumber;
            description: z.ZodDefault<z.ZodString>;
            suggested_prompt: z.ZodDefault<z.ZodString>;
            original_prompt: z.ZodOptional<z.ZodString>;
            original_audio_url: z.ZodOptional<z.ZodString>;
            source: z.ZodEnum<["extracted", "needs_generation", "generated", "silent"]>;
            readonly: z.ZodDefault<z.ZodBoolean>;
            quality_score: z.ZodOptional<z.ZodNumber>;
            sync_frame: z.ZodOptional<z.ZodNumber>;
            audio_url: z.ZodOptional<z.ZodString>;
            replacement: z.ZodOptional<z.ZodObject<{
                replacement_id: z.ZodString;
                prompt: z.ZodString;
                generated_audio_url: z.ZodString;
                status: z.ZodEnum<["generated", "applied", "rejected"]>;
            }, "strip", z.ZodTypeAny, {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            }, {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            }>>;
            user_edited: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }, {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        sfx: {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[];
        dialogue: {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[];
        foley: {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[];
        ambience: {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[];
        hard_effects: {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[];
        walla: {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[];
    }, {
        sfx?: {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[] | undefined;
        dialogue?: {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[] | undefined;
        foley?: {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[] | undefined;
        ambience?: {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[] | undefined;
        hard_effects?: {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[] | undefined;
        walla?: {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[] | undefined;
    }>;
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
    $schema: "sound-breakdown-v1";
    created_at: string;
    scene_number: number;
    total_duration_sec: number;
    shots: {
        shot_number: number;
        timecode_in: number;
        timecode_out: number;
    }[];
    source_video_url: string;
    demucs_model: "htdemucs" | "htdemucs_ft";
    layers: {
        sfx: {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[];
        dialogue: {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[];
        foley: {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[];
        ambience: {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[];
        hard_effects: {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[];
        walla: {
            user_edited: boolean;
            source: "extracted" | "needs_generation" | "generated" | "silent";
            description: string;
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            suggested_prompt: string;
            readonly: boolean;
            shot_number?: number | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[];
    };
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
}, {
    project_id: string;
    scene_id: string;
    $schema: "sound-breakdown-v1";
    created_at: string;
    scene_number: number;
    total_duration_sec: number;
    source_video_url: string;
    layers: {
        sfx?: {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[] | undefined;
        dialogue?: {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[] | undefined;
        foley?: {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[] | undefined;
        ambience?: {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[] | undefined;
        hard_effects?: {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[] | undefined;
        walla?: {
            source: "extracted" | "needs_generation" | "generated" | "silent";
            timecode_in: number;
            timecode_out: number;
            segment_id: string;
            layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
            user_edited?: boolean | undefined;
            description?: string | undefined;
            shot_number?: number | undefined;
            suggested_prompt?: string | undefined;
            original_prompt?: string | undefined;
            original_audio_url?: string | undefined;
            readonly?: boolean | undefined;
            quality_score?: number | undefined;
            sync_frame?: number | undefined;
            audio_url?: string | undefined;
            replacement?: {
                status: "rejected" | "generated" | "applied";
                prompt: string;
                replacement_id: string;
                generated_audio_url: string;
            } | undefined;
        }[] | undefined;
    };
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
    shots?: {
        shot_number: number;
        timecode_in: number;
        timecode_out: number;
    }[] | undefined;
    demucs_model?: "htdemucs" | "htdemucs_ft" | undefined;
}>;
export type SoundBreakdown = z.infer<typeof SoundBreakdownSchema>;
export type SoundSegment = z.infer<typeof SoundSegmentSchema>;
export type SoundLayer = z.infer<typeof SoundLayerEnum>;
export type SegmentSource = z.infer<typeof SegmentSourceEnum>;
export declare const SoundBreakdownJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
