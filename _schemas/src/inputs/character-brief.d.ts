import { z } from "zod";
/**
 * CharacterBrief — produced by 1AD, consumed by CastingDirector.
 * Describes a single character extracted from the screenplay.
 */
export declare const CharacterBriefSchema: z.ZodObject<{
    character_name: z.ZodString;
    importance: z.ZodEnum<["LEAD", "SUPPORTING", "FEATURED", "BACKGROUND"]>;
    scenes: z.ZodArray<z.ZodString, "many">;
    explicit_appearance: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    age_indicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    physical_actions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    wardrobe_mentions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    props_on_person: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    relationships: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    wardrobe_changes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    physical_transformations: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    scenes: string[];
    importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
    character_name: string;
    explicit_appearance?: string[] | undefined;
    age_indicators?: string[] | undefined;
    physical_actions?: string[] | undefined;
    wardrobe_mentions?: string[] | undefined;
    props_on_person?: string[] | undefined;
    relationships?: string[] | undefined;
    wardrobe_changes?: string[] | undefined;
    physical_transformations?: string[] | undefined;
}, {
    scenes: string[];
    importance: "LEAD" | "SUPPORTING" | "FEATURED" | "BACKGROUND";
    character_name: string;
    explicit_appearance?: string[] | undefined;
    age_indicators?: string[] | undefined;
    physical_actions?: string[] | undefined;
    wardrobe_mentions?: string[] | undefined;
    props_on_person?: string[] | undefined;
    relationships?: string[] | undefined;
    wardrobe_changes?: string[] | undefined;
    physical_transformations?: string[] | undefined;
}>;
export type CharacterBrief = z.infer<typeof CharacterBriefSchema>;
