/**
 * Bug 1 (Wave 2, 2026-05-22) — structural tests for SetupsPage
 *
 * These pin the SOURCE-CODE shape that the Bug 1 fix lands. They do not
 * exercise the React tree (which would need every PipelineContext + cache
 * provider wired up); instead they grep the page source for the call shapes
 * mandated by docs/sessions/2026-05-21-wave2/bug-1-audit.md §"Recommended fix
 * scope":
 *
 *   1) BIBLE_URI MUST carry `?project_id=${projectId}` so the backend HTTP
 *      route / MCP resource resolver namespace the storage lookup correctly.
 *      Without it, `loc_${projectId}` ends up against a default-project
 *      namespace and the user sees
 *      "Location Bible not found: agent://location-scout/bible/loc_default-project".
 *
 *   2) `callTool("generate_setup_images", …)` MUST include an explicit
 *      `project_id: projectId` argument. The MCP middleware reads
 *      args.project_id first; URL fallback (`callTool` auto-injection) covers
 *      the common case but the SetupsPage call-site explicitly threading the
 *      id removes any ambiguity for downstream auditors.
 *
 * Why structural / regex? PipelineContext-wired RTL tests are 50+ lines of
 * scaffolding for this one shape; a regex over the source catches regressions
 * just as well and runs in milliseconds. The companion `useProjectContext`
 * hook test covers the actual identity flow.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SETUPS_PAGE_PATH = join(HERE, "..", "SetupsPage.tsx");
const REFERENCES_PAGE_PATH = join(HERE, "..", "ReferencesPage.tsx");

describe("Bug 1 — SetupsPage carries project_id", () => {
  it("BIBLE_URI literal includes a ?project_id= query parameter", () => {
    const src = readFileSync(SETUPS_PAGE_PATH, "utf8");
    // Accept either inline template (`...?project_id=${projectId}`) or a
    // helper that builds the URI. The forbidden shape is the bare URI with
    // no project marker anywhere on the same line.
    const bibleUriLine = src
      .split(/\r?\n/)
      .find((l) => /const\s+BIBLE_URI\s*=/.test(l));
    expect(bibleUriLine, "BIBLE_URI declaration not found in SetupsPage.tsx").toBeTruthy();
    expect(bibleUriLine!).toMatch(/project_id/);
  });

  it("generate_setup_images callTool args mention project_id explicitly", () => {
    const src = readFileSync(SETUPS_PAGE_PATH, "utf8");
    // Find every callTool("generate_setup_images", …) literal and check the
    // args object 8 lines forward includes project_id. (Multi-line args
    // objects are common — bound the search window.)
    const lines = src.split(/\r?\n/);
    const callIndexes: number[] = [];
    lines.forEach((line, i) => {
      if (/callTool[^"]*"generate_setup_images"/.test(line)) callIndexes.push(i);
    });
    expect(callIndexes.length, "no generate_setup_images callTool found").toBeGreaterThan(0);
    for (const i of callIndexes) {
      const window = lines.slice(i, Math.min(i + 14, lines.length)).join("\n");
      expect(
        window,
        `generate_setup_images args at line ${i + 1} missing project_id`,
      ).toMatch(/project_id/);
    }
  });
});

describe("Bug 1 — ReferencesPage BIBLE_URI also carries project_id (sibling fix)", () => {
  it("ReferencesPage BIBLE_URI line mentions project_id", () => {
    const src = readFileSync(REFERENCES_PAGE_PATH, "utf8");
    const bibleUriLine = src
      .split(/\r?\n/)
      .find((l) => /const\s+BIBLE_URI\s*=/.test(l));
    expect(bibleUriLine, "BIBLE_URI declaration not found in ReferencesPage.tsx").toBeTruthy();
    expect(bibleUriLine!).toMatch(/project_id/);
  });
});
