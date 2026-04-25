import { z } from "zod";
export declare const ARTIFACT_TYPE: "location_briefs";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "1ad-base";
export declare const URI_PATTERN: "agent://1ad/location-briefs/{project_id}";
export declare const MIME_TYPE: "application/json";
/**
 * LocationBriefs — the collection artifact 1AD writes as
 * location_briefs.json after extract_locations. Downstream LocationScout
 * reads this file. Individual entries conform to LocationBriefSchema
 * (inputs/location-brief.ts).
 */
export declare const LocationBriefsSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"location-briefs-v1">;
    project_id: z.ZodString;
    total_locations: z.ZodNumber;
    locations: z.ZodArray<z.ZodObject<{
        location_id: z.ZodString;
        location_name: z.ZodString;
        location_type: z.ZodEnum<["INT", "EXT", "INT/EXT"]>;
        time_of_day: z.ZodArray<z.ZodString, "many">;
        era: z.ZodString;
        scenes: z.ZodArray<z.ZodString, "many">;
        recurring: z.ZodBoolean;
        character_actions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        required_practicals: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        props_mentioned: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        explicit_details: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        location_id: string;
        location_name: string;
        era: string;
        scenes: string[];
        time_of_day: string[];
        recurring: boolean;
        location_type: "INT" | "EXT" | "INT/EXT";
        character_actions?: string[] | undefined;
        required_practicals?: string[] | undefined;
        props_mentioned?: string[] | undefined;
        explicit_details?: string[] | undefined;
    }, {
        location_id: string;
        location_name: string;
        era: string;
        scenes: string[];
        time_of_day: string[];
        recurring: boolean;
        location_type: "INT" | "EXT" | "INT/EXT";
        character_actions?: string[] | undefined;
        required_practicals?: string[] | undefined;
        props_mentioned?: string[] | undefined;
        explicit_details?: string[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    project_id: string;
    $schema: "location-briefs-v1";
    locations: {
        location_id: string;
        location_name: string;
        era: string;
        scenes: string[];
        time_of_day: string[];
        recurring: boolean;
        location_type: "INT" | "EXT" | "INT/EXT";
        character_actions?: string[] | undefined;
        required_practicals?: string[] | undefined;
        props_mentioned?: string[] | undefined;
        explicit_details?: string[] | undefined;
    }[];
    total_locations: number;
}, {
    project_id: string;
    $schema: "location-briefs-v1";
    locations: {
        location_id: string;
        location_name: string;
        era: string;
        scenes: string[];
        time_of_day: string[];
        recurring: boolean;
        location_type: "INT" | "EXT" | "INT/EXT";
        character_actions?: string[] | undefined;
        required_practicals?: string[] | undefined;
        props_mentioned?: string[] | undefined;
        explicit_details?: string[] | undefined;
    }[];
    total_locations: number;
}>;
export type LocationBriefs = z.infer<typeof LocationBriefsSchema>;
export declare const LocationBriefsJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
