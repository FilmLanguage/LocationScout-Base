import { z } from "zod";
export declare const ARTIFACT_TYPE: "model_sheet";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "casting-director-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://casting-director/model-sheet/{id}";
export declare const ModelSheetSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"model-sheet-v1">;
    sheet_id: z.ZodString;
    face_id: z.ZodString;
    body_id: z.ZodString;
    wardrobe_id: z.ZodString;
    front_url: z.ZodString;
    three_quarter_url: z.ZodString;
    profile_url: z.ZodString;
    model_prompt: z.ZodString;
    generation_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    approval_status: z.ZodDefault<z.ZodEnum<["draft", "pending_review", "approved", "rejected"]>>;
    feedback_notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    $schema: "model-sheet-v1";
    approval_status: "approved" | "rejected" | "draft" | "pending_review";
    front_url: string;
    three_quarter_url: string;
    profile_url: string;
    wardrobe_id: string;
    sheet_id: string;
    face_id: string;
    body_id: string;
    model_prompt: string;
    generation_params?: Record<string, unknown> | undefined;
    feedback_notes?: string | undefined;
}, {
    $schema: "model-sheet-v1";
    front_url: string;
    three_quarter_url: string;
    profile_url: string;
    wardrobe_id: string;
    sheet_id: string;
    face_id: string;
    body_id: string;
    model_prompt: string;
    approval_status?: "approved" | "rejected" | "draft" | "pending_review" | undefined;
    generation_params?: Record<string, unknown> | undefined;
    feedback_notes?: string | undefined;
}>;
export type ModelSheet = z.infer<typeof ModelSheetSchema>;
export declare const ModelSheetJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
