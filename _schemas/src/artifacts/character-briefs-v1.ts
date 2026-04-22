import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { CharacterBriefSchema } from "../inputs/character-brief.js";

export const ARTIFACT_TYPE = "character_briefs" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "1ad-base" as const;
export const URI_PATTERN = "agent://1ad/character-briefs/{project_id}" as const;
export const MIME_TYPE = "application/json" as const;

/**
 * CharacterBriefs — the collection artifact 1AD writes as
 * character_briefs.json after extract_characters. Downstream CastingDirector
 * reads this file. Individual entries conform to CharacterBriefSchema
 * (inputs/character-brief.ts).
 */
export const CharacterBriefsSchema = z.object({
  $schema: z.literal("character-briefs-v1"),
  project_id: z.string(),
  total_characters: z.number().int().nonnegative(),
  characters: z.array(CharacterBriefSchema),
});

export type CharacterBriefs = z.infer<typeof CharacterBriefsSchema>;
export const CharacterBriefsJsonSchema = zodToJsonSchema(CharacterBriefsSchema);
