/**
 * Shared template-variable builders for the three image-generation prompts
 * (anchor, isometric, setup).
 *
 * Exists so that:
 *   - `generate_anchor` / `generate_isometric_reference` / `generate_setup_images`
 *     (the "hot" tools that actually call FAL.ai), AND
 *   - `assemble_anchor_prompt` / `assemble_isometric_prompt` / `assemble_setup_prompt`
 *     (the read-only preview tools that back the UI's ✦ Auto-fill button)
 *
 * build the template variable map from the same place. No template / FAL /
 * storage logic here — just pure functions. The template string itself still
 * lives in `src/prompts/generate-{anchor,isometric,setup}-system.md` and is
 * applied by `fillTemplate` in `prompt-loader.ts`.
 */

export type LocationBibleLike = Record<string, unknown>;

export interface SetupLike {
  id: string;
  scene: string;
  mood: string;
  camera?: string;
}

/** Variables for `generate-anchor-system.md` → `{{space_description}}`. */
export function buildAnchorPromptVars(bible: LocationBibleLike): Record<string, string> {
  return {
    space_description: (bible.space_description as string | undefined) ?? "",
  };
}

/**
 * Variables for `generate-isometric-system.md` →
 * `{{location_name}}{{era_clause}}{{space_description}}`.
 *
 * Mirrors the inline fill that lived in `generate_isometric_reference` so the
 * prompt text is identical whether it was produced by the generator or the
 * assemble-preview tool.
 */
export function buildIsometricPromptVars(
  bible: LocationBibleLike,
  fallbackLocationName?: string,
): Record<string, string> {
  const passport = bible.passport as Record<string, unknown> | undefined;
  const locationName =
    (passport?.location_name as string | undefined) ?? fallbackLocationName ?? "";
  const era = (passport?.era as string | undefined) ?? "";
  const spaceDesc = (bible.space_description as string | undefined) ?? "";
  return {
    location_name: locationName,
    era_clause: era ? ` Era: ${era}.` : "",
    space_description: spaceDesc ? ` ${spaceDesc}` : "",
  };
}

/**
 * Variables for `generate-setup-system.md` →
 * `{{space_description}}, {{scene}}, {{mood}}, {{camera}}`.
 *
 * `spaceDescription` is clamped to 300 chars in the generator to keep the
 * final FAL prompt under 2000 — we keep that behaviour here too so the
 * preview the user sees matches what the backend would actually send.
 */
export function buildSetupPromptVars(
  bible: LocationBibleLike,
  setup: SetupLike,
): Record<string, string> {
  const spaceDesc = ((bible.space_description as string | undefined) ?? "").slice(0, 300);
  return {
    space_description: spaceDesc,
    scene: setup.scene ?? "",
    mood: setup.mood ?? "",
    camera: setup.camera ?? "",
  };
}

/**
 * Compose an edit-mode prompt that biases the image model toward preserving
 * the existing frame while applying a user-requested change. Called by
 * generate_anchor / generate_isometric_reference / generate_setup_images when
 * `edit_mode.enabled === true`. The base image is passed separately via the
 * FAL `image_urls` channel; this function only shapes the text prompt.
 *
 * The "location-specific details" wording is tuned for architectural /
 * environment scenes rather than character portraits (which the Casting
 * Director flavour of this helper emphasises — face, pose, etc.).
 */
export function composeEditPrompt(userPrompt: string): string {
  const trimmed = userPrompt.trim();
  return `Given the reference image, apply this change: ${trimmed}. Preserve all other visible elements — composition, lighting, location-specific details — unless the change explicitly requires altering them.`;
}
