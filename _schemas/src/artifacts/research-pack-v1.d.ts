import { z } from "zod";
export declare const ARTIFACT_TYPE: "research_pack";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "location-scout-base";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://location-scout/research/{id}";
export declare const ResearchPackSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"research-pack-v1">;
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
    typical_elements: z.ZodArray<z.ZodString, "many">;
    anachronism_list: z.ZodArray<z.ZodString, "many">;
    visual_references: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    research_status: z.ZodDefault<z.ZodEnum<["draft", "validated", "approved"]>>;
}, "strip", z.ZodTypeAny, {
    $schema: "research-pack-v1";
    brief_id: string;
    vision_id: string;
    research_id: string;
    period_facts: {
        fact: string;
        source?: string | undefined;
        relevance?: string | undefined;
    }[];
    typical_elements: string[];
    anachronism_list: string[];
    research_status: "approved" | "draft" | "validated";
    visual_references?: string[] | undefined;
}, {
    $schema: "research-pack-v1";
    brief_id: string;
    vision_id: string;
    research_id: string;
    period_facts: {
        fact: string;
        source?: string | undefined;
        relevance?: string | undefined;
    }[];
    typical_elements: string[];
    anachronism_list: string[];
    visual_references?: string[] | undefined;
    research_status?: "approved" | "draft" | "validated" | undefined;
}>;
export type ResearchPack = z.infer<typeof ResearchPackSchema>;
export declare const ResearchPackJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
