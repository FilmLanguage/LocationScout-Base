/**
 * Bug 1 (Wave 2, 2026-05-22) — structural tests for SetupsPage
 *
 * These pin the SOURCE-CODE shape that the Bug 1 fix lands. They do not
 * exercise the React tree (which would need every PipelineContext + cache
 * provider wired up); instead they grep the page source for the call shapes
 * mandated by docs/sessions/2026-05-21-wave2/bug-1-audit.md §"Recommended fix
 * scope":
 *
 *   1) `callTool("generate_setup_images", …)` MUST include an explicit
 *      `project_id: projectId` argument. The MCP middleware reads
 *      args.project_id first; URL fallback (`callTool` auto-injection) covers
 *      the common case but the SetupsPage call-site explicitly threading the
 *      id removes any ambiguity for downstream auditors.
 *
 *   2) The SetupsPage / ReferencesPage modules MUST destructure `projectId`
 *      from `useProjectContext()` — proving they consume the namespace marker
 *      that the hook now reports. The old code (`const { locationId } =
 *      useProjectContext()`) would still type-check after the fix but would
 *      silently drop the project namespace at call sites.
 *
 *   3) `useProjectContext()` MUST NOT contain a fallback substitution that
 *      yields `default-project` — that was the literal source of the
 *      `loc_default-project` leak.
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
const HOOK_PATH = join(HERE, "..", "..", "hooks", "useProjectContext.ts");

describe("Bug 1 — SetupsPage threads project_id into MCP args", () => {
  it("destructures projectId from useProjectContext()", () => {
    const src = readFileSync(SETUPS_PAGE_PATH, "utf8");
    expect(src).toMatch(/projectId[^=]*=\s*useProjectContext\(\)/);
  });

  it("every callTool('generate_setup_images', …) args object passes project_id", () => {
    const src = readFileSync(SETUPS_PAGE_PATH, "utf8");
    // Find every callTool("generate_setup_images", …) literal and check the
    // args object 14 lines forward includes project_id. (Multi-line args
    // objects are common — bound the search window.)
    const lines = src.split(/\r?\n/);
    const callIndexes: number[] = [];
    lines.forEach((line, i) => {
      if (/callTool[^"]*"generate_setup_images"/.test(line)) callIndexes.push(i);
    });
    expect(callIndexes.length, "no generate_setup_images callTool found").toBeGreaterThan(0);
    for (const i of callIndexes) {
      const window = lines.slice(i, Math.min(i + 18, lines.length)).join("\n");
      expect(
        window,
        `generate_setup_images args at line ${i + 1} missing project_id`,
      ).toMatch(/project_id/);
    }
  });
});

describe("Bug 1 — ReferencesPage destructures projectId from useProjectContext()", () => {
  it("ReferencesPage destructures projectId from the hook", () => {
    const src = readFileSync(REFERENCES_PAGE_PATH, "utf8");
    expect(src).toMatch(/projectId[^=]*=\s*useProjectContext\(\)/);
  });
});

describe("Bug 1 — useProjectContext has no default-project fallback", () => {
  it("hook source contains no 'default-project' literal", () => {
    const src = readFileSync(HOOK_PATH, "utf8");
    // Comments referencing the historical bug are OK, but no code literal.
    // Strip line + block comments before scanning.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/"default-project"/);
    expect(stripped).not.toMatch(/'default-project'/);
    expect(stripped).not.toMatch(/`default-project`/);
  });

  it("hook returns projectIdReady boolean (callers can branch instead of silently defaulting)", () => {
    const src = readFileSync(HOOK_PATH, "utf8");
    expect(src).toMatch(/projectIdReady/);
  });
});
