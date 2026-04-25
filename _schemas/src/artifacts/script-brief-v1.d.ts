import { z } from "zod";
export declare const ARTIFACT_TYPE: "script_brief";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "1ad-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://1ad/script-brief/{id}";
/**
 * Mirrors scene_splitter brief.ScriptBrief dataclass exactly.
 * All fields default to "unknown" in the Python source — string defaults here
 * preserve that behaviour so a missing field never crashes validation.
 */
export declare const ScriptBriefSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"script-brief-v1">;
    project_id: z.ZodString;
    film_title: z.ZodDefault<z.ZodString>;
    genre: z.ZodDefault<z.ZodString>;
    subgenre: z.ZodDefault<z.ZodString>;
    logline: z.ZodDefault<z.ZodString>;
    runtime_minutes: z.ZodDefault<z.ZodString>;
    synopsis: z.ZodDefault<z.ZodString>;
    central_conflict: z.ZodDefault<z.ZodString>;
    screenplay_version: z.ZodDefault<z.ZodString>;
    writer: z.ZodDefault<z.ZodString>;
    total_scenes: z.ZodDefault<z.ZodNumber>;
    act_structure: z.ZodDefault<z.ZodString>;
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
    genre: string;
    total_scenes: number;
    logline: string;
    central_conflict: string;
    $schema: "script-brief-v1";
    film_title: string;
    subgenre: string;
    runtime_minutes: string;
    synopsis: string;
    screenplay_version: string;
    writer: string;
    act_structure: string;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
}, {
    project_id: string;
    $schema: "script-brief-v1";
    genre?: string | undefined;
    total_scenes?: number | undefined;
    logline?: string | undefined;
    central_conflict?: string | undefined;
    film_title?: string | undefined;
    subgenre?: string | undefined;
    runtime_minutes?: string | undefined;
    synopsis?: string | undefined;
    screenplay_version?: string | undefined;
    writer?: string | undefined;
    act_structure?: string | undefined;
    _meta?: {
        user_edited: boolean;
        edited_at: string;
        edited_by?: string | undefined;
    } | undefined;
}>;
export type ScriptBrief = z.infer<typeof ScriptBriefSchema>;
export declare const ScriptBriefJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
