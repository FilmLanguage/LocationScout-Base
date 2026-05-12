import { z } from "zod";

/**
 * Gallery contract — shared shape for items returned by `list_gallery` and
 * surfaced in the location-level GalleryPage. A `GalleryItem` is a subset of
 * the on-disk SidecarEntry that the agent writes per saved image (see
 * `prompt-gallery-contract.md §1`), enriched with `http_path` so the UI can
 * render previews without reconstructing URLs.
 *
 * Backwards compatibility: sidecars written before `location_id` was
 * introduced may not have the field. The backend resolves it via
 * `attributedLocationId()`:
 *   - if sidecar.location_id present  → use it
 *   - else if kind ∈ {anchor,floorplan,isometric} → entity_id is the location id
 *   - else → unattributed (excluded from gallery results)
 */
export const GalleryKindSchema = z.enum([
  "anchor",
  "floorplan",
  "isometric",
  "setup",
  "mood_variation",
  "user-ref",
]);
export type GalleryKind = z.infer<typeof GalleryKindSchema>;

export const GalleryItemSchema = z.object({
  image_id: z.string().describe("uuid8 — stable per version, embedded in filename"),
  kind: GalleryKindSchema,
  entity_id: z.string().describe("Parent entity (bible_id, setup_id, variation_id, …)"),
  location_id: z.string().describe("Owning location — required for new writes, backfilled on read for legacy sidecars"),
  prompt: z.string().describe("Prompt used to generate (empty string for user-ref / floorplan)"),
  model: z.string(),
  created_at: z.string().describe("ISO-8601 timestamp"),
  uri: z.string().describe("MCP resource URI for the entity (latest)"),
  /**
   * HTTP path the UI can drop into `<img src>` without parsing.
   * Latest-only requests get `/artifacts/<kind>/<entity_id>.<ext>`;
   * version-specific requests get `/artifacts/<kind>/v/<image_id>.<ext>`.
   * Backend always sets this — clients never reconstruct it.
   */
  http_path: z.string().describe("HTTP path for <img> — latest alias or version-pinned"),
  source_tool: z.string().optional(),
  source_task_id: z.string().optional(),
  negative_prompt: z.string().optional(),
  seed: z.number().int().optional(),
  parent_version_id: z.string().optional().describe("image_id of the predecessor in an edit chain"),
});
export type GalleryItem = z.infer<typeof GalleryItemSchema>;

export const ListGalleryInputSchema = z.object({
  location_id: z.string().describe("Filter to one location (required)"),
  kinds: z.array(GalleryKindSchema).optional().describe("Restrict to a subset of kinds"),
  /**
   * When true (default), versionable kinds (anchor/floorplan/isometric/setup/
   * mood_variation) collapse to the newest image per entity_id; user-ref is
   * always returned in full because each upload is a distinct asset, not a
   * version of a previous one.
   */
  latest_only: z.boolean().default(true),
  limit: z.number().int().min(1).max(200).optional().default(48),
  cursor: z.string().optional().describe("Opaque pagination cursor returned by the previous call. Do NOT mix cursors across different latest_only values."),
});
export type ListGalleryInput = z.input<typeof ListGalleryInputSchema>;

export const ListGalleryOutputSchema = z.object({
  location_id: z.string(),
  items: z.array(GalleryItemSchema),
  next_cursor: z.string().optional(),
});
export type ListGalleryOutput = z.infer<typeof ListGalleryOutputSchema>;
