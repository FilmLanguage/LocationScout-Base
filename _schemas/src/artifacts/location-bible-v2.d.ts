import { z } from "zod";
export declare const ARTIFACT_TYPE: "location_bible";
export declare const ARTIFACT_VERSION: "v2";
export declare const PRODUCED_BY: "location-scout-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://location-scout/bible/{id}";
export declare const PassportSchema: z.ZodObject<{
    type: z.ZodEnum<["INT", "EXT", "INT/EXT"]>;
    time_of_day: z.ZodArray<z.ZodString, "many">;
    era: z.ZodString;
    recurring: z.ZodDefault<z.ZodBoolean>;
    scenes: z.ZodArray<z.ZodString, "many">;
    cluster_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "INT" | "EXT" | "INT/EXT";
    era: string;
    scenes: string[];
    time_of_day: string[];
    recurring: boolean;
    cluster_id?: string | null | undefined;
}, {
    type: "INT" | "EXT" | "INT/EXT";
    era: string;
    scenes: string[];
    time_of_day: string[];
    recurring?: boolean | undefined;
    cluster_id?: string | null | undefined;
}>;
export declare const LightBaseStateSchema: z.ZodObject<{
    primary_source: z.ZodString;
    direction: z.ZodString;
    color_temp_kelvin: z.ZodNumber;
    shadow_hardness: z.ZodEnum<["hard", "soft", "mixed"]>;
    fill_to_key_ratio: z.ZodString;
    practical_sources: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    primary_source: string;
    direction: string;
    color_temp_kelvin: number;
    shadow_hardness: "hard" | "soft" | "mixed";
    fill_to_key_ratio: string;
    practical_sources: string[];
}, {
    primary_source: string;
    direction: string;
    color_temp_kelvin: number;
    shadow_hardness: "hard" | "soft" | "mixed";
    fill_to_key_ratio: string;
    practical_sources?: string[] | undefined;
}>;
export declare const LocationBibleSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"location-bible-v2">;
    bible_id: z.ZodString;
    brief_id: z.ZodString;
    vision_id: z.ZodString;
    research_id: z.ZodString;
    passport: z.ZodObject<{
        type: z.ZodEnum<["INT", "EXT", "INT/EXT"]>;
        time_of_day: z.ZodArray<z.ZodString, "many">;
        era: z.ZodString;
        recurring: z.ZodDefault<z.ZodBoolean>;
        scenes: z.ZodArray<z.ZodString, "many">;
        cluster_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        type: "INT" | "EXT" | "INT/EXT";
        era: string;
        scenes: string[];
        time_of_day: string[];
        recurring: boolean;
        cluster_id?: string | null | undefined;
    }, {
        type: "INT" | "EXT" | "INT/EXT";
        era: string;
        scenes: string[];
        time_of_day: string[];
        recurring?: boolean | undefined;
        cluster_id?: string | null | undefined;
    }>;
    space_description: z.ZodString;
    atmosphere: z.ZodString;
    light_base_state: z.ZodObject<{
        primary_source: z.ZodString;
        direction: z.ZodString;
        color_temp_kelvin: z.ZodNumber;
        shadow_hardness: z.ZodEnum<["hard", "soft", "mixed"]>;
        fill_to_key_ratio: z.ZodString;
        practical_sources: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        primary_source: string;
        direction: string;
        color_temp_kelvin: number;
        shadow_hardness: "hard" | "soft" | "mixed";
        fill_to_key_ratio: string;
        practical_sources: string[];
    }, {
        primary_source: string;
        direction: string;
        color_temp_kelvin: number;
        shadow_hardness: "hard" | "soft" | "mixed";
        fill_to_key_ratio: string;
        practical_sources?: string[] | undefined;
    }>;
    key_details: z.ZodArray<z.ZodString, "many">;
    negative_list: z.ZodArray<z.ZodString, "many">;
    approval_status: z.ZodDefault<z.ZodEnum<["draft", "pending_review", "approved", "rejected"]>>;
}, "strip", z.ZodTypeAny, {
    bible_id: string;
    $schema: "location-bible-v2";
    brief_id: string;
    vision_id: string;
    research_id: string;
    passport: {
        type: "INT" | "EXT" | "INT/EXT";
        era: string;
        scenes: string[];
        time_of_day: string[];
        recurring: boolean;
        cluster_id?: string | null | undefined;
    };
    space_description: string;
    atmosphere: string;
    light_base_state: {
        primary_source: string;
        direction: string;
        color_temp_kelvin: number;
        shadow_hardness: "hard" | "soft" | "mixed";
        fill_to_key_ratio: string;
        practical_sources: string[];
    };
    key_details: string[];
    negative_list: string[];
    approval_status: "approved" | "rejected" | "draft" | "pending_review";
}, {
    bible_id: string;
    $schema: "location-bible-v2";
    brief_id: string;
    vision_id: string;
    research_id: string;
    passport: {
        type: "INT" | "EXT" | "INT/EXT";
        era: string;
        scenes: string[];
        time_of_day: string[];
        recurring?: boolean | undefined;
        cluster_id?: string | null | undefined;
    };
    space_description: string;
    atmosphere: string;
    light_base_state: {
        primary_source: string;
        direction: string;
        color_temp_kelvin: number;
        shadow_hardness: "hard" | "soft" | "mixed";
        fill_to_key_ratio: string;
        practical_sources?: string[] | undefined;
    };
    key_details: string[];
    negative_list: string[];
    approval_status?: "approved" | "rejected" | "draft" | "pending_review" | undefined;
}>;
export type LocationBible = z.infer<typeof LocationBibleSchema>;
export type Passport = z.infer<typeof PassportSchema>;
export type LightBaseState = z.infer<typeof LightBaseStateSchema>;
export declare const LocationBibleJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
