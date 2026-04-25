import { z } from "zod";
export declare const ARTIFACT_TYPE: "scene_style";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "art-director-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://art-director/scene-style/{id}";
export declare const StyleReferenceSchema: z.ZodObject<{
    reference_id: z.ZodString;
    image_uri: z.ZodString;
    prompt_used: z.ZodString;
    negative_prompt: z.ZodOptional<z.ZodString>;
    seed: z.ZodOptional<z.ZodNumber>;
    created_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reference_id: string;
    image_uri: string;
    prompt_used: string;
    negative_prompt?: string | undefined;
    seed?: number | undefined;
    created_at?: string | undefined;
}, {
    reference_id: string;
    image_uri: string;
    prompt_used: string;
    negative_prompt?: string | undefined;
    seed?: number | undefined;
    created_at?: string | undefined;
}>;
export type StyleReference = z.infer<typeof StyleReferenceSchema>;
export declare const SceneStyleSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"scene-style-v1">;
    style_id: z.ZodString;
    scene_id: z.ZodString;
    project_id: z.ZodString;
    mood: z.ZodString;
    color_palette: z.ZodString;
    lighting: z.ZodString;
    film_grain: z.ZodString;
    context_summary: z.ZodOptional<z.ZodString>;
    reference_images: z.ZodDefault<z.ZodArray<z.ZodObject<{
        reference_id: z.ZodString;
        image_uri: z.ZodString;
        prompt_used: z.ZodString;
        negative_prompt: z.ZodOptional<z.ZodString>;
        seed: z.ZodOptional<z.ZodNumber>;
        created_at: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        reference_id: string;
        image_uri: string;
        prompt_used: string;
        negative_prompt?: string | undefined;
        seed?: number | undefined;
        created_at?: string | undefined;
    }, {
        reference_id: string;
        image_uri: string;
        prompt_used: string;
        negative_prompt?: string | undefined;
        seed?: number | undefined;
        created_at?: string | undefined;
    }>, "many">>;
    location_bible_uri: z.ZodOptional<z.ZodString>;
    director_vision_uri: z.ZodOptional<z.ZodString>;
    approval_status: z.ZodDefault<z.ZodEnum<["draft", "approved", "rejected", "revision"]>>;
}, "strip", z.ZodTypeAny, {
    mood: string;
    project_id: string;
    scene_id: string;
    $schema: "scene-style-v1";
    approval_status: "approved" | "rejected" | "revision" | "draft";
    reference_images: {
        reference_id: string;
        image_uri: string;
        prompt_used: string;
        negative_prompt?: string | undefined;
        seed?: number | undefined;
        created_at?: string | undefined;
    }[];
    color_palette: string;
    style_id: string;
    lighting: string;
    film_grain: string;
    context_summary?: string | undefined;
    location_bible_uri?: string | undefined;
    director_vision_uri?: string | undefined;
}, {
    mood: string;
    project_id: string;
    scene_id: string;
    $schema: "scene-style-v1";
    color_palette: string;
    style_id: string;
    lighting: string;
    film_grain: string;
    approval_status?: "approved" | "rejected" | "revision" | "draft" | undefined;
    reference_images?: {
        reference_id: string;
        image_uri: string;
        prompt_used: string;
        negative_prompt?: string | undefined;
        seed?: number | undefined;
        created_at?: string | undefined;
    }[] | undefined;
    context_summary?: string | undefined;
    location_bible_uri?: string | undefined;
    director_vision_uri?: string | undefined;
}>;
export type SceneStyle = z.infer<typeof SceneStyleSchema>;
export declare const SceneStyleJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
