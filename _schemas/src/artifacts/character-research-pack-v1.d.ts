import { z } from "zod";
export declare const ARTIFACT_TYPE: "character_research_pack";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "casting-director-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://casting-director/research/{id}";
export declare const CharacterResearchPackSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"character-research-pack-v1">;
    research_id: z.ZodString;
    brief_id: z.ZodString;
    vision_id: z.ZodString;
    period_facts: z.ZodArray<z.ZodObject<{
        fact: z.ZodString;
        source: z.ZodOptional<z.ZodString>;
        relevance: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        fact: string;
        source?: string | undefined;
        relevance?: string | undefined;
    }, {
        fact: string;
        source?: string | undefined;
        relevance?: string | undefined;
    }>, "many">;
    typical_looks: z.ZodArray<z.ZodString, "many">;
    period_fashion: z.ZodArray<z.ZodString, "many">;
    period_hairstyles: z.ZodArray<z.ZodString, "many">;
    period_grooming: z.ZodArray<z.ZodString, "many">;
    body_language_norms: z.ZodArray<z.ZodString, "many">;
    social_markers: z.ZodArray<z.ZodString, "many">;
    anachronism_list: z.ZodArray<z.ZodString, "many">;
    visual_references: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    research_status: z.ZodDefault<z.ZodEnum<["draft", "validated", "approved"]>>;
}, "strip", z.ZodTypeAny, {
    $schema: "character-research-pack-v1";
    brief_id: string;
    vision_id: string;
    research_id: string;
    period_facts: {
        fact: string;
        source?: string | undefined;
        relevance?: string | undefined;
    }[];
    anachronism_list: string[];
    visual_references: string[];
    research_status: "approved" | "draft" | "validated";
    typical_looks: string[];
    period_fashion: string[];
    period_hairstyles: string[];
    period_grooming: string[];
    body_language_norms: string[];
    social_markers: string[];
}, {
    $schema: "character-research-pack-v1";
    brief_id: string;
    vision_id: string;
    research_id: string;
    period_facts: {
        fact: string;
        source?: string | undefined;
        relevance?: string | undefined;
    }[];
    anachronism_list: string[];
    typical_looks: string[];
    period_fashion: string[];
    period_hairstyles: string[];
    period_grooming: string[];
    body_language_norms: string[];
    social_markers: string[];
    visual_references?: string[] | undefined;
    research_status?: "approved" | "draft" | "validated" | undefined;
}>;
export type CharacterResearchPack = z.infer<typeof CharacterResearchPackSchema>;
export declare const CharacterResearchPackJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
