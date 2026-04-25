import { z } from "zod";
export declare const ARTIFACT_TYPE: "dop_film_vision";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "cinematographer-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://cinematographer/dpfv/{id}";
/**
 * Mirrors scene_splitter dpfv.DoPFilmVision dataclass.
 * Film-level cinematographic approach produced ONCE per project, before DPSV.
 */
export declare const DoPFilmVisionSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"dop-film-vision-v1">;
    project_id: z.ZodString;
    camera_system: z.ZodDefault<z.ZodString>;
    lenses: z.ZodDefault<z.ZodString>;
    aspect_ratio: z.ZodDefault<z.ZodString>;
    movement_vocabulary: z.ZodDefault<z.ZodString>;
    lighting_philosophy: z.ZodDefault<z.ZodString>;
    color_temperature: z.ZodDefault<z.ZodString>;
    exposure_philosophy: z.ZodDefault<z.ZodString>;
    depth_of_field_approach: z.ZodDefault<z.ZodString>;
    grain_texture: z.ZodDefault<z.ZodString>;
    key_visual_references: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    special_requirements: z.ZodDefault<z.ZodString>;
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
    $schema: "dop-film-vision-v1";
    camera_system: string;
    lenses: string;
    aspect_ratio: string;
    movement_vocabulary: string;
    lighting_philosophy: string;
    color_temperature: string;
    exposure_philosophy: string;
    depth_of_field_approach: string;
    grain_texture: string;
    key_visual_references: string[];
    special_requirements: string;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
}, {
    project_id: string;
    $schema: "dop-film-vision-v1";
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
    camera_system?: string | undefined;
    lenses?: string | undefined;
    aspect_ratio?: string | undefined;
    movement_vocabulary?: string | undefined;
    lighting_philosophy?: string | undefined;
    color_temperature?: string | undefined;
    exposure_philosophy?: string | undefined;
    depth_of_field_approach?: string | undefined;
    grain_texture?: string | undefined;
    key_visual_references?: string[] | undefined;
    special_requirements?: string | undefined;
}>;
export type DoPFilmVision = z.infer<typeof DoPFilmVisionSchema>;
export declare const DoPFilmVisionJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
