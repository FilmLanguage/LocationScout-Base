import { z } from "zod";
export declare const ARTIFACT_TYPE: "sound_replacement";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "sound-designer-base";
export declare const URI_PATTERN: "agent://sound-designer/replacement/{id}";
export declare const MIME_TYPE: "application/json";
/**
 * Sound Replacement — a single generated-sound replacement for a segment.
 *
 * Created by `generate_sound` tool via ElevenLabs SFX API.
 * Applied to a segment via `replace_segment` tool.
 */
export declare const SoundReplacementSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"sound-replacement-v1">;
    replacement_id: z.ZodString;
    project_id: z.ZodString;
    scene_id: z.ZodString;
    segment_id: z.ZodString;
    prompt: z.ZodString;
    generated_audio_url: z.ZodString;
    elevenlabs_request_id: z.ZodOptional<z.ZodString>;
    duration_sec: z.ZodNumber;
    created_at: z.ZodString;
    status: z.ZodEnum<["generated", "applied", "rejected"]>;
    generation_params: z.ZodObject<{
        duration_sec: z.ZodNumber;
        prompt_influence: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        duration_sec: number;
        prompt_influence?: number | undefined;
    }, {
        duration_sec: number;
        prompt_influence?: number | undefined;
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
    status: "rejected" | "generated" | "applied";
    prompt: string;
    scene_id: string;
    $schema: "sound-replacement-v1";
    generation_params: {
        duration_sec: number;
        prompt_influence?: number | undefined;
    };
    created_at: string;
    duration_sec: number;
    replacement_id: string;
    generated_audio_url: string;
    segment_id: string;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
    elevenlabs_request_id?: string | undefined;
}, {
    project_id: string;
    status: "rejected" | "generated" | "applied";
    prompt: string;
    scene_id: string;
    $schema: "sound-replacement-v1";
    generation_params: {
        duration_sec: number;
        prompt_influence?: number | undefined;
    };
    created_at: string;
    duration_sec: number;
    replacement_id: string;
    generated_audio_url: string;
    segment_id: string;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
    elevenlabs_request_id?: string | undefined;
}>;
export type SoundReplacement = z.infer<typeof SoundReplacementSchema>;
export declare const SoundReplacementJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
