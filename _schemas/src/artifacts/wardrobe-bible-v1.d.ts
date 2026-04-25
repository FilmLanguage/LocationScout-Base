import { z } from "zod";
export declare const ARTIFACT_TYPE: "wardrobe_bible";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "casting-director-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://casting-director/wardrobe/{id}";
export declare const WardrobeEntrySchema: z.ZodObject<{
    outfit_id: z.ZodString;
    scenes: z.ZodArray<z.ZodString, "many">;
    description: z.ZodString;
    color_palette: z.ZodArray<z.ZodString, "many">;
    outfit_type: z.ZodString;
    trigger_context: z.ZodOptional<z.ZodString>;
    character_note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    scenes: string[];
    outfit_id: string;
    description: string;
    color_palette: string[];
    outfit_type: string;
    trigger_context?: string | undefined;
    character_note?: string | undefined;
}, {
    scenes: string[];
    outfit_id: string;
    description: string;
    color_palette: string[];
    outfit_type: string;
    trigger_context?: string | undefined;
    character_note?: string | undefined;
}>;
export declare const WardrobeBibleSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"wardrobe-bible-v1">;
    wardrobe_id: z.ZodString;
    bible_id: z.ZodString;
    research_id: z.ZodString;
    entries: z.ZodArray<z.ZodObject<{
        outfit_id: z.ZodString;
        scenes: z.ZodArray<z.ZodString, "many">;
        description: z.ZodString;
        color_palette: z.ZodArray<z.ZodString, "many">;
        outfit_type: z.ZodString;
        trigger_context: z.ZodOptional<z.ZodString>;
        character_note: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        scenes: string[];
        outfit_id: string;
        description: string;
        color_palette: string[];
        outfit_type: string;
        trigger_context?: string | undefined;
        character_note?: string | undefined;
    }, {
        scenes: string[];
        outfit_id: string;
        description: string;
        color_palette: string[];
        outfit_type: string;
        trigger_context?: string | undefined;
        character_note?: string | undefined;
    }>, "many">;
    approval_status: z.ZodDefault<z.ZodEnum<["draft", "pending_review", "approved", "rejected"]>>;
}, "strip", z.ZodTypeAny, {
    bible_id: string;
    entries: {
        scenes: string[];
        outfit_id: string;
        description: string;
        color_palette: string[];
        outfit_type: string;
        trigger_context?: string | undefined;
        character_note?: string | undefined;
    }[];
    $schema: "wardrobe-bible-v1";
    research_id: string;
    approval_status: "approved" | "rejected" | "draft" | "pending_review";
    wardrobe_id: string;
}, {
    bible_id: string;
    entries: {
        scenes: string[];
        outfit_id: string;
        description: string;
        color_palette: string[];
        outfit_type: string;
        trigger_context?: string | undefined;
        character_note?: string | undefined;
    }[];
    $schema: "wardrobe-bible-v1";
    research_id: string;
    wardrobe_id: string;
    approval_status?: "approved" | "rejected" | "draft" | "pending_review" | undefined;
}>;
export type WardrobeBible = z.infer<typeof WardrobeBibleSchema>;
export type WardrobeEntry = z.infer<typeof WardrobeEntrySchema>;
export declare const WardrobeBibleJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
