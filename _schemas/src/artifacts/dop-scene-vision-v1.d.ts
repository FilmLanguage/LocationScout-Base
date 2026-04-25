import { z } from "zod";
export declare const ARTIFACT_TYPE: "dop_scene_vision";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "cinematographer-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://cinematographer/dpsv/{id}/{scene_id}";
/**
 * Mirrors scene_splitter dpsv.DoPSceneVision dataclass exactly.
 * Generated per scene using DPFV + DSV + scene body.
 */
export declare const DoPSceneVisionSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"dop-scene-vision-v1">;
    project_id: z.ZodString;
    scene_id: z.ZodString;
    camera_movement: z.ZodDefault<z.ZodString>;
    lens: z.ZodDefault<z.ZodString>;
    depth_of_field: z.ZodDefault<z.ZodString>;
    lighting_setup: z.ZodDefault<z.ZodString>;
    color_temperature: z.ZodDefault<z.ZodString>;
    exposure_notes: z.ZodDefault<z.ZodString>;
    special_techniques: z.ZodDefault<z.ZodString>;
    location_challenges: z.ZodDefault<z.ZodString>;
    mood_through_camera: z.ZodDefault<z.ZodString>;
    key_images: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
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
    $schema: "dop-scene-vision-v1";
    color_temperature: string;
    camera_movement: string;
    lens: string;
    depth_of_field: string;
    lighting_setup: string;
    exposure_notes: string;
    special_techniques: string;
    location_challenges: string;
    mood_through_camera: string;
    key_images: string[];
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
}, {
    project_id: string;
    scene_id: string;
    $schema: "dop-scene-vision-v1";
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
    color_temperature?: string | undefined;
    camera_movement?: string | undefined;
    lens?: string | undefined;
    depth_of_field?: string | undefined;
    lighting_setup?: string | undefined;
    exposure_notes?: string | undefined;
    special_techniques?: string | undefined;
    location_challenges?: string | undefined;
    mood_through_camera?: string | undefined;
    key_images?: string[] | undefined;
}>;
export type DoPSceneVision = z.infer<typeof DoPSceneVisionSchema>;
export declare const DoPSceneVisionJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
