import { z } from "zod";
export declare const ARTIFACT_TYPE: "character_briefs";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "1ad-base";
export declare const URI_PATTERN: "agent://1ad/character-briefs/{project_id}";
export declare const MIME_TYPE: "application/json";
/**
 * CharacterBriefs — the collection artifact 1AD writes as
 * character_briefs.json after extract_characters. Downstream CastingDirector
 * reads this file. Individual entries conform to CharacterBriefSchema
 * (inputs/character-brief.ts).
 */
export declare const CharacterBriefsSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"character-briefs-v1">;
    project_id: z.ZodString;
    total_characters: z.ZodNumber;
    characters: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    project_id: string;
    $schema: "character-briefs-v1";
    characters: {
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
    }[];
    total_characters: number;
}, {
    project_id: string;
    $schema: "character-briefs-v1";
    characters: {
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
    }[];
    total_characters: number;
}>;
export type CharacterBriefs = z.infer<typeof CharacterBriefsSchema>;
export declare const CharacterBriefsJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
