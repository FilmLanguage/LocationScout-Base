import { z } from "zod";

/**
 * Optional metadata attached to any artifact when a user manually edits it.
 *
 * The downstream cascade inspects `_meta.user_edited` and **skips**
 * regenerating artifacts that carry this flag — the user's manual edit
 * is treated as authoritative. Cleared when the artifact is regenerated
 * from scratch by an agent's `create_*` tool.
 */
export const ArtifactMetaSchema = z.object({
  user_edited: z.boolean().describe("True if the last write came from update_* (user), not create_* (LLM)"),
  edited_at: z.string().describe("ISO8601 timestamp of the manual edit"),
  edited_by: z.string().optional().describe("User identifier (optional)"),
});

export type ArtifactMeta = z.infer<typeof ArtifactMetaSchema>;
