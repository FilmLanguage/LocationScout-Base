import { z } from "zod";
/**
 * Optional metadata attached to any artifact when a user manually edits it.
 *
 * The downstream cascade inspects `_meta.user_edited` and **skips**
 * regenerating artifacts that carry this flag — the user's manual edit
 * is treated as authoritative. Cleared when the artifact is regenerated
 * from scratch by an agent's `create_*` tool.
 */
export declare const ArtifactMetaSchema: z.ZodObject<{
    user_edited: z.ZodBoolean;
    edited_at: z.ZodString;
    edited_by: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    user_edited: boolean;
    edited_at: string;
    edited_by?: string | undefined;
}, {
    user_edited: boolean;
    edited_at: string;
    edited_by?: string | undefined;
}>;
export type ArtifactMeta = z.infer<typeof ArtifactMetaSchema>;
