/**
 * Edit-mode helpers — shared by generate_anchor, generate_isometric_reference,
 * and generate_setup_images. See updates/edit-mode-contract.md.
 *
 * The UX is a single textarea whose semantics flip when the user ticks the
 * "Edit mode" checkbox: normal = full generation prompt, edit = "what to
 * change". The backend composes a preservation-biased prompt and resolves the
 * base image (either explicit or newest) so the image model is anchored on
 * the prior version.
 *
 * Wording is location-appropriate ("composition, lighting, location-specific
 * details"); CastingDirector uses different hints (face, pose).
 */

import { z } from "zod";
import { listVersions, loadImageVersion } from "./storage.js";

export const EditModeSchema = z.object({
  enabled: z.boolean().default(false),
  base_image_id: z.string().optional().describe("Specific version to edit. If omitted, the newest gallery version for the entity is used."),
});

export type EditMode = z.infer<typeof EditModeSchema>;

/**
 * Compose the preservation-biased prompt sent to the image model when the
 * user is editing an existing version. LocationScout wording emphasises the
 * location-specific elements we want untouched.
 */
export function composeEditPrompt(userChange: string): string {
  return `Given the reference image, apply this change: ${userChange}. Preserve all other visible elements — composition, lighting, location-specific details — unless the change explicitly requires altering them.`;
}

/**
 * Resolve the base image for an edit operation to a data URL. Returns the
 * data URL + image_id actually used so callers can record parent_version_id.
 */
export async function resolveEditBase(
  kind: string,
  entity_id: string,
  explicit_image_id: string | undefined,
): Promise<{ dataUrl: string; image_id: string } | null> {
  let image_id = explicit_image_id ?? null;
  if (!image_id) {
    const versions = await listVersions(kind, entity_id);
    image_id = versions[0]?.image_id ?? null;
  }
  if (!image_id) return null;
  const img = await loadImageVersion(kind, image_id, "png")
    ?? await loadImageVersion(kind, image_id, "jpg");
  if (!img) return null;
  return {
    dataUrl: `data:${img.contentType};base64,${img.data.toString("base64")}`,
    image_id,
  };
}
