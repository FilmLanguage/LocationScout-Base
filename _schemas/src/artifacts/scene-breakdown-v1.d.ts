import { z } from "zod";
export declare const ARTIFACT_TYPE: "scene_breakdown";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "1ad-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://1ad/scene-breakdown/{id}";
/**
 * One scene as produced by scene_splitter's merger.Scene dataclass.
 * The body is the verbatim slice of the source text — never paraphrased.
 */
export declare const SceneSchema: z.ZodObject<{
    scene_id: z.ZodString;
    number: z.ZodNumber;
    heading: z.ZodString;
    body: z.ZodString;
    characters: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    location: z.ZodDefault<z.ZodString>;
    time: z.ZodDefault<z.ZodString>;
    int_ext: z.ZodDefault<z.ZodString>;
    emotional_beat: z.ZodDefault<z.ZodString>;
    word_count: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    number: number;
    body: string;
    scene_id: string;
    characters: string[];
    heading: string;
    location: string;
    time: string;
    int_ext: string;
    emotional_beat: string;
    word_count?: number | undefined;
}, {
    number: number;
    body: string;
    scene_id: string;
    heading: string;
    characters?: string[] | undefined;
    location?: string | undefined;
    time?: string | undefined;
    int_ext?: string | undefined;
    emotional_beat?: string | undefined;
    word_count?: number | undefined;
}>;
export type Scene = z.infer<typeof SceneSchema>;
export declare const SceneBreakdownSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"scene-breakdown-v1">;
    project_id: z.ZodString;
    total_scenes: z.ZodNumber;
    scenes: z.ZodArray<z.ZodObject<{
        scene_id: z.ZodString;
        number: z.ZodNumber;
        heading: z.ZodString;
        body: z.ZodString;
        characters: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        location: z.ZodDefault<z.ZodString>;
        time: z.ZodDefault<z.ZodString>;
        int_ext: z.ZodDefault<z.ZodString>;
        emotional_beat: z.ZodDefault<z.ZodString>;
        word_count: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        number: number;
        body: string;
        scene_id: string;
        characters: string[];
        heading: string;
        location: string;
        time: string;
        int_ext: string;
        emotional_beat: string;
        word_count?: number | undefined;
    }, {
        number: number;
        body: string;
        scene_id: string;
        heading: string;
        characters?: string[] | undefined;
        location?: string | undefined;
        time?: string | undefined;
        int_ext?: string | undefined;
        emotional_beat?: string | undefined;
        word_count?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    project_id: string;
    total_scenes: number;
    scenes: {
        number: number;
        body: string;
        scene_id: string;
        characters: string[];
        heading: string;
        location: string;
        time: string;
        int_ext: string;
        emotional_beat: string;
        word_count?: number | undefined;
    }[];
    $schema: "scene-breakdown-v1";
}, {
    project_id: string;
    total_scenes: number;
    scenes: {
        number: number;
        body: string;
        scene_id: string;
        heading: string;
        characters?: string[] | undefined;
        location?: string | undefined;
        time?: string | undefined;
        int_ext?: string | undefined;
        emotional_beat?: string | undefined;
        word_count?: number | undefined;
    }[];
    $schema: "scene-breakdown-v1";
}>;
export type SceneBreakdown = z.infer<typeof SceneBreakdownSchema>;
export declare const SceneBreakdownJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
