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

/**
 * BETA: Extract continuity-critical facts from the bible. Used by all three
 * prompt builders (anchor / isometric / setup) so the templates can render a
 * "KEY FACTS — MUST PRESERVE" header. This is what makes each stage's prompt
 * carry the explicit constraints needed to keep floorplan→isometric→anchor→
 * setups visually consistent.
 */
/**
 * BETA — Bug I (anchor ≠ isometry coherence, 2026-05-18):
 * Build a one-line spatial layout summary that is fed identically into BOTH
 * the anchor and isometric prompts. The intent is that whatever architectural
 * facts drive the isometric/floorplan generation (room dimensions, named
 * spaces, openings, key spatial features) ALSO drive the anchor — so the
 * eye-level photo and the top-down floorplan/isometric describe the SAME
 * room, not two different "visions" of the same name.
 *
 * Pure text — no image input, no img2img conditioning. (Approach 2 from the
 * task brief; approach 1 was already tried in run-019/020 and rolled back
 * because nano-banana bleeds isometric aesthetics when an isometric PNG is
 * passed as image_input.)
 */
export function buildLayoutSummary(bible: LocationBibleLike): string {
  const passport = (bible.passport ?? {}) as Record<string, unknown>;
  const spaces = (bible.spaces as unknown[] | undefined) ?? [];
  const parts: string[] = [];

  const dim =
    (passport.dimensions as string | undefined) ??
    (passport.size as string | undefined) ??
    (passport.area as string | undefined);
  if (dim) parts.push(`approximate dimensions ${dim}`);

  if (Array.isArray(spaces) && spaces.length > 0) {
    const spaceNames = spaces
      .map((s) => (s && typeof s === "object" ? ((s as Record<string, unknown>).name as string | undefined) : undefined))
      .filter((s): s is string => typeof s === "string" && s.length > 0);
    if (spaceNames.length > 0) {
      parts.push(`comprises ${spaceNames.slice(0, 4).join(", ")}`);
    }
  }

  const features =
    (passport.features as string | undefined) ??
    (passport.openings as string | undefined) ??
    (passport.layout as string | undefined);
  if (features) parts.push(features);

  return parts.length > 0 ? parts.join("; ") : "";
}

function extractBibleFacts(bible: LocationBibleLike): {
  location_name: string;
  era: string;
  era_clause: string;
  dimensions: string;
  time_of_day: string;
  light_summary: string;
  atmosphere: string;
  key_details: string;
  negative_list_text: string;
  layout_summary: string;
} {
  const passport = (bible.passport ?? {}) as Record<string, unknown>;
  const light = (bible.light_base_state ?? {}) as Record<string, unknown>;

  const locationName = (passport.location_name as string | undefined) ?? "";
  const era = (passport.era as string | undefined) ?? "";
  const dimensions =
    (passport.dimensions as string | undefined) ??
    (passport.size as string | undefined) ??
    (passport.area as string | undefined) ??
    "as defined by the floorplan";
  const tod = passport.time_of_day as string[] | undefined;
  const lightParts = [
    light.primary_source ? `${String(light.primary_source)} as primary source` : "",
    light.direction ? `from ${String(light.direction)}` : "",
    light.shadow_hardness ? `${String(light.shadow_hardness)} shadows` : "",
    light.color_temp_kelvin ? `${String(light.color_temp_kelvin)}K` : "",
  ].filter(Boolean);
  const atmosphere = (bible.atmosphere as string | undefined) ?? "";
  const keyDetailsArr = (bible.key_details as string[] | undefined) ?? [];
  const negativeArr = (bible.negative_list as string[] | undefined) ?? [];

  return {
    location_name: locationName,
    era,
    era_clause: era ? ` (${era})` : "",
    dimensions,
    time_of_day: tod && tod.length > 0 ? tod.join(" / ") : "as defined by the bible",
    light_summary: lightParts.length > 0 ? lightParts.join(", ") : "as defined by the bible",
    atmosphere,
    key_details: keyDetailsArr.slice(0, 6).join("; ") || "as described in the location bible",
    negative_list_text: negativeArr.slice(0, 8).join(", ") || "anachronisms, unrelated objects",
    layout_summary: buildLayoutSummary(bible),
  };
}

/**
 * Variables for `generate-anchor-system.md`.
 * BETA: now populates location_name, era_clause, dimensions, time_of_day,
 * light_summary, atmosphere, key_details, negative_list_text in addition to
 * space_description, so the template can show a KEY FACTS header.
 */
export function buildAnchorPromptVars(bible: LocationBibleLike): Record<string, string> {
  const facts = extractBibleFacts(bible);
  // Bug I (2026-05-18): expose the shared layout_summary so the anchor template
  // can render a FLOORPLAN LAYOUT block that mirrors what the isometric prompt
  // sees. Empty string is rendered as a fallback line so the template still
  // flows cleanly when the bible has no passport-level layout facts.
  const layoutSummary = facts.layout_summary || "as established by the floorplan and isometric chain";
  const layoutSummaryClause = facts.layout_summary
    ? `\n\nFLOORPLAN LAYOUT — must match the isometric chain (same room, same scale):\n- ${facts.layout_summary}`
    : "";
  return {
    location_name: facts.location_name,
    era_clause: facts.era_clause,
    dimensions: facts.dimensions,
    time_of_day: facts.time_of_day,
    light_summary: facts.light_summary,
    atmosphere: facts.atmosphere,
    key_details: facts.key_details,
    negative_list_text: facts.negative_list_text,
    space_description: (bible.space_description as string | undefined) ?? "",
    layout_summary: layoutSummary,
    layout_summary_clause: layoutSummaryClause,
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
  const facts = extractBibleFacts(bible);
  const locationName = facts.location_name || fallbackLocationName || "";
  const spaceDesc = (bible.space_description as string | undefined) ?? "";
  return {
    location_name: locationName,
    // Original `era_clause` form was ` Era: ${era}.`; new template uses different form, so we rebuild.
    era_clause: facts.era ? ` Era: ${facts.era}.` : "",
    dimensions: facts.dimensions,
    // BETA: keep legacy `space_description` (leading space) for back-compat;
    // also expose `space_description_clause` for the new KEY FACTS template.
    space_description: spaceDesc ? ` ${spaceDesc}` : "",
    space_description_clause: spaceDesc ? ` Spatial reference: ${spaceDesc}` : "",
    // Bug I (2026-05-18): share the same layout summary that the anchor sees,
    // so isometric + anchor describe the same room.
    layout_summary: facts.layout_summary || "as established by the floorplan",
    layout_summary_clause: facts.layout_summary ? ` Layout: ${facts.layout_summary}.` : "",
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

  const facts = extractBibleFacts(bible);
  return {
    space_description: spaceDesc,
    scene,
    mood,
    camera,
    camera_directive: cameraDirective,
    photorealism_clause: photorealismClause,
    // BETA: continuity facts so the template can show a "MUST MATCH ANCHOR" header.
    dimensions: facts.dimensions,
    time_of_day: facts.time_of_day,
    light_summary: facts.light_summary,
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
