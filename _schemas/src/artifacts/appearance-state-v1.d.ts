import { z } from "zod";
export declare const ARTIFACT_TYPE: "appearance_states";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "casting-director-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://casting-director/appearance/{id}";
export declare const AppearanceEntrySchema: z.ZodObject<{
    scene_ids: z.ZodArray<z.ZodString, "many">;
    act: z.ZodNumber;
    hair_delta: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    facial_hair: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    wardrobe_ref: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    physical_change: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    condition: z.ZodOptional<z.ZodNullable<z.ZodEnum<["fresh", "tired", "exhausted", "injured", "disheveled", "pristine"]>>>;
    accessories: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    scene_ids: string[];
    act: number;
    hair_delta?: string | null | undefined;
    facial_hair?: string | null | undefined;
    wardrobe_ref?: string | null | undefined;
    physical_change?: string | null | undefined;
    condition?: "fresh" | "tired" | "exhausted" | "injured" | "disheveled" | "pristine" | null | undefined;
    accessories?: string | null | undefined;
}, {
    scene_ids: string[];
    act: number;
    hair_delta?: string | null | undefined;
    facial_hair?: string | null | undefined;
    wardrobe_ref?: string | null | undefined;
    physical_change?: string | null | undefined;
    condition?: "fresh" | "tired" | "exhausted" | "injured" | "disheveled" | "pristine" | null | undefined;
    accessories?: string | null | undefined;
}>;
export declare const AppearanceStatesSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"appearance-state-v1">;
    state_id: z.ZodString;
    bible_id: z.ZodString;
    entries: z.ZodArray<z.ZodObject<{
        scene_ids: z.ZodArray<z.ZodString, "many">;
        act: z.ZodNumber;
        hair_delta: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        facial_hair: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        wardrobe_ref: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        physical_change: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        condition: z.ZodOptional<z.ZodNullable<z.ZodEnum<["fresh", "tired", "exhausted", "injured", "disheveled", "pristine"]>>>;
        accessories: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        scene_ids: string[];
        act: number;
        hair_delta?: string | null | undefined;
        facial_hair?: string | null | undefined;
        wardrobe_ref?: string | null | undefined;
        physical_change?: string | null | undefined;
        condition?: "fresh" | "tired" | "exhausted" | "injured" | "disheveled" | "pristine" | null | undefined;
        accessories?: string | null | undefined;
    }, {
        scene_ids: string[];
        act: number;
        hair_delta?: string | null | undefined;
        facial_hair?: string | null | undefined;
        wardrobe_ref?: string | null | undefined;
        physical_change?: string | null | undefined;
        condition?: "fresh" | "tired" | "exhausted" | "injured" | "disheveled" | "pristine" | null | undefined;
        accessories?: string | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    bible_id: string;
    entries: {
        scene_ids: string[];
        act: number;
        hair_delta?: string | null | undefined;
        facial_hair?: string | null | undefined;
        wardrobe_ref?: string | null | undefined;
        physical_change?: string | null | undefined;
        condition?: "fresh" | "tired" | "exhausted" | "injured" | "disheveled" | "pristine" | null | undefined;
        accessories?: string | null | undefined;
    }[];
    $schema: "appearance-state-v1";
    state_id: string;
}, {
    bible_id: string;
    entries: {
        scene_ids: string[];
        act: number;
        hair_delta?: string | null | undefined;
        facial_hair?: string | null | undefined;
        wardrobe_ref?: string | null | undefined;
        physical_change?: string | null | undefined;
        condition?: "fresh" | "tired" | "exhausted" | "injured" | "disheveled" | "pristine" | null | undefined;
        accessories?: string | null | undefined;
    }[];
    $schema: "appearance-state-v1";
    state_id: string;
}>;
export type AppearanceStates = z.infer<typeof AppearanceStatesSchema>;
export type AppearanceEntry = z.infer<typeof AppearanceEntrySchema>;
export declare const AppearanceStatesJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
