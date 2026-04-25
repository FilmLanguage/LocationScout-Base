import { z } from "zod";

export const REF_KIND = [
  "face_anchor",
  "body_anchor",
  "model_sheet",
  "anchor",
  "isometric",
  "setup",
  "style_reference",
  "shot",
  "end_frame",
  "edit_base",
  "user_upload",
  "external",
] as const;

export const REF_SOURCE_AGENT = [
  "location-scout",
  "casting-director",
  "shot-generation",
  "art-director",
  "user",
] as const;

/** Named enum schema — for backward compat with LocationScout imports. */
export const ReferenceKindSchema = z.enum(REF_KIND).describe("Asset kind — drives prompt hints and model behavior");

/** Named enum schema — for backward compat with LocationScout imports. */
export const ReferenceSourceAgentSchema = z.enum(REF_SOURCE_AGENT).describe("Which agent produced this ref, or 'user' if uploaded");

export const ReferenceRefSchema = z.object({
  image_id: z.string().describe("uuid8 shared with sidecar filename"),
  uri: z.string().describe("Where the file lives: agent://..., gs://..., http(s)://..., or data: URL for a fresh base64 upload"),
  kind: ReferenceKindSchema,
  source_agent: ReferenceSourceAgentSchema,
  prompt: z.string().optional().describe("Prompt that generated this ref, if any (EDIT-mode context)"),
  entity_id: z.string().optional().describe("Owning entity (scene_id, character_id, location_id, shot_id)"),
  role: z.string().optional().describe("Field role this ref plays in the target generation (e.g. 'face_identity', 'wardrobe_inspiration')"),
});

export type ReferenceRef = z.infer<typeof ReferenceRefSchema>;

/**
 * Merge auto-resolved refs with user-supplied refs.
 * User refs win on image_id collision — they reflect explicit user intent.
 */
export function mergeRefs(autoRefs: ReferenceRef[], userRefs: ReferenceRef[]): ReferenceRef[] {
  const userIds = new Set(userRefs.map((u) => u.image_id));
  return [...autoRefs.filter((a) => !userIds.has(a.image_id)), ...userRefs];
}
