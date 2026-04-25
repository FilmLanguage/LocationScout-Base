import { z } from "zod";
export declare const ARTIFACT_TYPE: "director_vision_dfv";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "director-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://director/vision/dfv/{id}";
export declare const DirectorVisionSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"director-vision-v1">;
    vision_id: z.ZodString;
    project_id: z.ZodString;
    era_and_style: z.ZodString;
    color_palette_mood: z.ZodOptional<z.ZodString>;
    spatial_philosophy: z.ZodOptional<z.ZodString>;
    reference_films: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    reference_images: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    emotional_function: z.ZodOptional<z.ZodString>;
    atmosphere: z.ZodOptional<z.ZodString>;
    key_visual_metaphors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    light_vision: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    project_id: string;
    $schema: "director-vision-v1";
    vision_id: string;
    era_and_style: string;
    atmosphere?: string | undefined;
    color_palette_mood?: string | undefined;
    spatial_philosophy?: string | undefined;
    reference_films?: string[] | undefined;
    reference_images?: string[] | undefined;
    emotional_function?: string | undefined;
    key_visual_metaphors?: string[] | undefined;
    light_vision?: string | undefined;
}, {
    project_id: string;
    $schema: "director-vision-v1";
    vision_id: string;
    era_and_style: string;
    atmosphere?: string | undefined;
    color_palette_mood?: string | undefined;
    spatial_philosophy?: string | undefined;
    reference_films?: string[] | undefined;
    reference_images?: string[] | undefined;
    emotional_function?: string | undefined;
    key_visual_metaphors?: string[] | undefined;
    light_vision?: string | undefined;
}>;
export type DirectorVision = z.infer<typeof DirectorVisionSchema>;
export declare const DirectorVisionJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
