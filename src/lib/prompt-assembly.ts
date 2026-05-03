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
 *
 * run-021 P0.3: Setup images are empty/unstaged spatial reference frames —
 * same room, same furniture as anchor, but NEVER people/figures. The scene
 * field is sanitized to strip person/figure/character tokens so even if a
 * scenario accidentally writes "two figures on white floor", the resulting
 * FAL prompt does not include figure-mentions.
 */
const PERSON_TOKENS_REGEX = /\b(?:figures?|people|persons?|humans?|characters?|men|women|man|woman|girls?|boys?|children|crowd|actors?|subjects?|extras?)\b/gi;

export function stripPersonTokens(text: string): string {
  if (!text) return "";
  // Replace each whole-word match with a marker, then collapse phrases.
  let out = text.replace(PERSON_TOKENS_REGEX, "");
  // Clean up "two ", "the ", "a/an " articles/determiners left dangling.
  out = out.replace(/\b(?:two|three|four|five|six|seven|eight|nine|ten|several|many|few|the|a|an|some)\s+(?=[,.;]|$|\s+(?:on|in|at|by|near))/gi, "");
  // Collapse extra whitespace and orphan punctuation
  out = out.replace(/\s+([,.;])/g, "$1").replace(/\s{2,}/g, " ").trim();
  // Drop dangling " on white floor" / " walking" type fragments at start
  out = out.replace(/^[,.;\s]+/, "");
  return out;
}

/**
 * Returns true when the camera string specifies an overhead angle.
 * Matches "overhead", "top-down", "top down", "bird's eye", "birds eye",
 * "90°", "90 degree" (case-insensitive).
 */
export function isOverheadCamera(camera: string): boolean {
  return /overhead|top[- ]down|bird['']?s?[- ]?eye|90\s*°|90[- ]degree/i.test(camera);
}

export function buildSetupPromptVars(
  bible: LocationBibleLike,
  setup: SetupLike,
): Record<string, string> {
  const spaceDesc = ((bible.space_description as string | undefined) ?? "").slice(0, 300);
  // Sanitize the scene + mood text so figure-mentions cannot reach FAL.
  const scene = stripPersonTokens(setup.scene ?? "");
  const mood = stripPersonTokens(setup.mood ?? "");
  const camera = setup.camera ?? "";

  // run-025 B7: surface camera angle as the FIRST directive in the prompt so
  // the diffusion model weights it at maximum priority. For overhead shots we
  // also inject an explicit "no eye-level" guard and strip the hardcoded
  // "eye-level" phrase from the photorealism clause.
  const overhead = isOverheadCamera(camera);
  const cameraDirective = camera
    ? overhead
      ? `CAMERA ANGLE: ${camera} — this is mandatory. The image MUST be shot from this exact angle. Do NOT default to eye-level. Composition is strictly top-down, looking straight down from the ceiling at a flat 90° angle. NO eye-level perspective. NO oblique angles. `
      : `CAMERA ANGLE: ${camera} — this is mandatory. The image MUST be shot from this exact angle. `
    : "";
  const photorealismClause = overhead
    ? "top-down real photograph — NO eye-level perspective"
    : "eye-level real photograph";

  return {
    space_description: spaceDesc,
    scene,
    mood,
    camera,
    camera_directive: cameraDirective,
    photorealism_clause: photorealismClause,
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
