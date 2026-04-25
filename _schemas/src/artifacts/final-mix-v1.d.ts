import { z } from "zod";
export declare const ARTIFACT_TYPE: "final_mix";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "sound-designer-base";
export declare const URI_PATTERN: "agent://sound-designer/mix/{id}";
export declare const MIME_TYPE: "application/json";
export declare const LayerSummarySchema: z.ZodObject<{
    layer: z.ZodEnum<["dialogue", "sfx", "foley", "ambience", "hard_effects", "walla"]>;
    volume_db: z.ZodNumber;
    segments_count: z.ZodNumber;
    generated_count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
    volume_db: number;
    segments_count: number;
    generated_count: number;
}, {
    layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
    volume_db: number;
    segments_count: number;
    generated_count: number;
}>;
/**
 * Final Mix — exported audio mixdown for a scene.
 *
 * Created by `export_mix` tool: combines all 6 layers with
 * volume adjustments, normalizes to LUFS target, optionally
 * re-muxes with source video.
 */
export declare const FinalMixSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"final-mix-v1">;
    project_id: z.ZodString;
    scene_id: z.ZodString;
    layers: z.ZodArray<z.ZodObject<{
        layer: z.ZodEnum<["dialogue", "sfx", "foley", "ambience", "hard_effects", "walla"]>;
        volume_db: z.ZodNumber;
        segments_count: z.ZodNumber;
        generated_count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
        volume_db: number;
        segments_count: number;
        generated_count: number;
    }, {
        layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
        volume_db: number;
        segments_count: number;
        generated_count: number;
    }>, "many">;
    lufs_measured: z.ZodNumber;
    lufs_target: z.ZodDefault<z.ZodNumber>;
    audio_url: z.ZodString;
    video_url: z.ZodOptional<z.ZodString>;
    format: z.ZodDefault<z.ZodEnum<["wav", "mp3", "aac"]>>;
    exported_at: z.ZodString;
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
    $schema: "final-mix-v1";
    audio_url: string;
    layers: {
        layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
        volume_db: number;
        segments_count: number;
        generated_count: number;
    }[];
    lufs_measured: number;
    lufs_target: number;
    format: "wav" | "mp3" | "aac";
    exported_at: string;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
    video_url?: string | undefined;
}, {
    project_id: string;
    scene_id: string;
    $schema: "final-mix-v1";
    audio_url: string;
    layers: {
        layer: "sfx" | "dialogue" | "foley" | "ambience" | "hard_effects" | "walla";
        volume_db: number;
        segments_count: number;
        generated_count: number;
    }[];
    lufs_measured: number;
    exported_at: string;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
    lufs_target?: number | undefined;
    video_url?: string | undefined;
    format?: "wav" | "mp3" | "aac" | undefined;
}>;
export type FinalMix = z.infer<typeof FinalMixSchema>;
export type LayerSummary = z.infer<typeof LayerSummarySchema>;
export declare const FinalMixJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
