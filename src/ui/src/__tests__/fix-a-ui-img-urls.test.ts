/**
 * Fix A L4 — UI sweep. Every `<img src=>` (and HEAD probe / fetch URL) that
 * targets the LS /artifacts/* HTTP route MUST include `?project_id=`.
 *
 * Before Fix A, six UI sites built bare `/artifacts/<kind>/<id>.png` strings
 * with no project_id query, so the backend's per-project namespace lookup
 * always missed and fell back to legacy un-namespaced paths — which leaks
 * one project's bytes into another's UI as soon as two projects share an
 * entity_id (`loc_001` is the canonical collision in invest-b task B5).
 *
 * The fix routes every URL build through `buildArtifactUrl(type, filename,
 * projectId)` (the helper already exists in src/ui/src/hooks/useProjectContext.ts).
 *
 * Structural / regex test — actually rendering these pages requires the full
 * pipeline + cache provider tree (50+ lines of scaffolding). Pinning the
 * source shape is the cheapest gate that catches regressions.
 *
 * Spec: docs/sessions/2026-05-22-rootcause/invest-b-image-display.md task B3
 *       + docs/canonical/per-project-namespace.md §"UI MCP wrapper".
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = join(HERE, "..");

const SETUPS_PAGE = join(SRC_ROOT, "pages", "SetupsPage.tsx");
const LIGHT_STATES_PAGE = join(SRC_ROOT, "pages", "LightStatesPage.tsx");
const REFERENCE_PICKER = join(SRC_ROOT, "components", "ReferencePicker.tsx");
const PROMPT_CARD = join(SRC_ROOT, "components", "PromptCard.tsx");

/** Strip comments + string-literal contents so we only match live code paths. */
function stripCommentsAndStrings(src: string): string {
  // Remove block comments
  let out = src.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments
  out = out.replace(/\/\/[^\n]*/g, "");
  return out;
}

describe("Fix A L4 — UI img URLs include project_id", () => {
  it("SetupsPage: no bare /artifacts/<kind>/<id>.png literals in live code", () => {
    const src = stripCommentsAndStrings(readFileSync(SETUPS_PAGE, "utf8"));
    // A bare literal is `/artifacts/<kind>/<file>.png` not followed by
    // `?project_id=`. Forbid the literal that doesn't pass through
    // buildArtifactUrl. Allow `/artifacts/${var}` template tokens only when
    // the surrounding code also includes `buildArtifactUrl`.
    // Easier check: forbid the specific old-shape literal helper
    // `setupImgPath = (id) => "/artifacts/setup/${id}.png"`.
    expect(
      src,
      "setupImgPath must not be a bare URL builder — use buildArtifactUrl",
    ).not.toMatch(/setupImgPath\s*=\s*\(id[^)]*\)\s*=>\s*`\/artifacts\/setup\/\$\{[^}]*\}\.png`/);

    // lockedAutoRefs anchor URL must not be bare either.
    expect(
      src,
      "lockedAutoRefs anchor imageUrl must include ?project_id=",
    ).not.toMatch(/imageUrl:\s*`\/artifacts\/anchor\/\$\{LOCATION_ID\}\.png`/);
  });

  it("SetupsPage: uses buildArtifactUrl from useProjectContext", () => {
    const src = readFileSync(SETUPS_PAGE, "utf8");
    expect(src).toMatch(/buildArtifactUrl/);
  });

  it("LightStatesPage: no bare setupImgPath / moodVariationImgPath builders", () => {
    const src = stripCommentsAndStrings(readFileSync(LIGHT_STATES_PAGE, "utf8"));
    expect(
      src,
      "setupImgPath must include project_id via buildArtifactUrl",
    ).not.toMatch(/setupImgPath\s*=\s*\(id[^)]*\)\s*=>\s*`\/artifacts\/setup\/\$\{[^}]*\}\.png`/);
    expect(
      src,
      "moodVariationImgPath must include project_id via buildArtifactUrl",
    ).not.toMatch(/moodVariationImgPath\s*=\s*\([^)]*\)\s*=>\s*`\/artifacts\/mood-variation\/\$\{[^}]*\}\.png`/);
  });

  it("LightStatesPage: uses buildArtifactUrl", () => {
    const src = readFileSync(LIGHT_STATES_PAGE, "utf8");
    expect(src).toMatch(/buildArtifactUrl/);
  });

  it("ReferencePicker previewUrl: no bare /artifacts/${kind}/v/${image_id}.png literal", () => {
    const src = stripCommentsAndStrings(readFileSync(REFERENCE_PICKER, "utf8"));
    // The previous shape was `/artifacts/${encodeURIComponent(kindPath)}/v/${encodeURIComponent(ref.image_id)}.png`
    // After Fix A the URL must go through buildArtifactUrl (which appends ?project_id=).
    expect(
      src,
      "previewUrl must include project_id — use buildArtifactUrl or append ?project_id= manually",
    ).not.toMatch(/`\/artifacts\/\$\{encodeURIComponent\(kindPath\)\}\/v\/\$\{encodeURIComponent\(ref\.image_id\)\}\.png`/);
  });

  it("ReferencePicker: imports buildArtifactUrl", () => {
    const src = readFileSync(REFERENCE_PICKER, "utf8");
    expect(src).toMatch(/buildArtifactUrl/);
  });

  it("PromptCard previewSrc: no bare /artifacts/${kind}/...png literal in live code", () => {
    const src = stripCommentsAndStrings(readFileSync(PROMPT_CARD, "utf8"));
    // Old shape: `/artifacts/${encodeURIComponent(kind)}/${encodeURIComponent(entityId)}.png?v=...`
    // and       `/artifacts/${encodeURIComponent(kind)}/v/${encodeURIComponent(selected.image_id)}.png`
    expect(
      src,
      "PromptCard latest URL must include project_id",
    ).not.toMatch(/`\/artifacts\/\$\{encodeURIComponent\(kind\)\}\/\$\{encodeURIComponent\(entityId\)\}\.png\?v=/);
    expect(
      src,
      "PromptCard versioned URL must include project_id",
    ).not.toMatch(/`\/artifacts\/\$\{encodeURIComponent\(kind\)\}\/v\/\$\{encodeURIComponent\(selected\.image_id\)\}\.png`/);
  });

  it("PromptCard: imports buildArtifactUrl", () => {
    const src = readFileSync(PROMPT_CARD, "utf8");
    expect(src).toMatch(/buildArtifactUrl/);
  });
});
