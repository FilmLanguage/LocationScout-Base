import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const ARTIFACT_TYPE = "character_research_pack" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "casting-director-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://casting-director/research/{id}" as const;

const ResearchFactSchema = z.object({
  fact: z.string().describe("Historical or cultural fact"),
  source: z.string().optional().describe("Source or reference"),
  relevance: z.string().optional().describe("Why this matters for character appearance"),
});

export const CharacterResearchPackSchema = z.object({
  $schema: z.literal("character-research-pack-v1"),
  research_id: z.string().describe("Unique research pack ID"),
  brief_id: z.string().describe("Reference to AD Character Brief"),
  vision_id: z.string().describe("Reference to Director's casting vision"),
  period_facts: z.array(ResearchFactSchema).min(1).describe("General historical/cultural period facts"),
  typical_looks: z.array(z.string()).min(1).describe("Typical appearances for this character type in the era"),
  period_fashion: z.array(z.string()).min(1).describe("Era-appropriate clothing, fabrics, cuts, colors"),
  period_hairstyles: z.array(z.string()).min(1).describe("Era-appropriate hairstyles, hair accessories"),
  period_grooming: z.array(z.string()).describe("Grooming norms: facial hair, makeup, skincare of the era"),
  body_language_norms: z.array(z.string()).describe("Posture, gesture, physical behavior norms of the era/class"),
  social_markers: z.array(z.string()).describe("Visual class/status indicators: jewelry, shoes, accessories"),
  anachronism_list: z.array(z.string()).min(1).describe("Items that MUST NOT appear — feeds negative_list"),
  visual_references: z.array(z.string()).default([]).describe("URIs to reference images"),
  research_status: z.enum(["draft", "validated", "approved"]).default("draft"),
});

export type CharacterResearchPack = z.infer<typeof CharacterResearchPackSchema>;
export const CharacterResearchPackJsonSchema = zodToJsonSchema(CharacterResearchPackSchema);
