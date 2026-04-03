import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "research_pack" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "location-scout-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://location-scout/research/{id}" as const;

const PeriodFactSchema = z.object({
  fact: z.string().describe("Historical fact relevant to the location/era"),
  source: z.string().optional().describe("Source of the fact"),
  relevance: z.string().optional().describe("Why this fact matters for the production"),
});

export const ResearchPackSchema = z.object({
  $schema: z.literal("research-pack-v1"),
  research_id: z.string().describe("Unique research pack ID"),
  brief_id: z.string().describe("Reference to source AdLocationBrief"),
  vision_id: z.string().describe("Reference to DirectorVision"),
  period_facts: z.array(PeriodFactSchema).min(1).describe("Historical facts about the period/location"),
  typical_elements: z.array(z.string()).min(3).describe("Typical visual elements of the era (3+ items)"),
  anachronism_list: z.array(z.string()).min(1).describe("Items that would be anachronistic — feeds negative_list"),
  visual_references: z.array(z.string()).optional().describe("URIs to reference images"),
  research_status: z.enum(["draft", "validated", "approved"]).default("draft"),
});

export type ResearchPack = z.infer<typeof ResearchPackSchema>;
export const ResearchPackJsonSchema = zodToJsonSchema(ResearchPackSchema);
