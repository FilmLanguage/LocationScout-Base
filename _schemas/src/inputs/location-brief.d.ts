import { z } from "zod";
/**
 * LocationBrief — produced by 1AD, consumed by LocationScout.
 * Describes a single physical location extracted from the screenplay.
 * One location can appear in multiple scenes.
 */
export declare const LocationBriefSchema: z.ZodObject<{
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
}>;
export type LocationBrief = z.infer<typeof LocationBriefSchema>;
