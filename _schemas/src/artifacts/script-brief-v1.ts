import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactMetaSchema } from "../common/artifact-meta.js";

export const ARTIFACT_TYPE = "script_brief" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "1ad-base" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://1ad/script-brief/{id}" as const;

/**
 * Mirrors scene_splitter brief.ScriptBrief dataclass exactly.
 * All fields default to "unknown" in the Python source — string defaults here
 * preserve that behaviour so a missing field never crashes validation.
 */
export const ScriptBriefSchema = z.object({
  $schema: z.literal("script-brief-v1"),
  project_id: z.string(),
  film_title: z.string().default("unknown"),
  genre: z.string().default("unknown"),
  subgenre: z.string().default("unknown"),
  logline: z.string().default("unknown"),
  runtime_minutes: z.string().default("unknown"),
  synopsis: z.string().default("unknown"),
  central_conflict: z.string().default("unknown"),
  screenplay_version: z.string().default("unknown"),
  writer: z.string().default("unknown"),
  total_scenes: z.number().int().default(0),
  act_structure: z.string().default("unknown"),
  _meta: ArtifactMetaSchema.optional().describe("Set by update_* tools when a user manually edits"),
});

export type ScriptBrief = z.infer<typeof ScriptBriefSchema>;
export const ScriptBriefJsonSchema = zodToJsonSchema(ScriptBriefSchema);
