/**
 * Bug 1 REGRESSION (2026-05-22, post v1.0.43) — LS UI must block ALL
 * generation when `?project_id=` is missing from the URL.
 *
 * Symptom reported by user (LS v1.0.43 live, 2026-05-22):
 *   "Setup generation failed: MCP error 1001: Location Bible not found:
 *    agent://location-scout/bible/"
 *
 * Root cause:
 *   The Wave 2 fix (commit `5bea39d`) removed the silent `default-project`
 *   fallback from `useProjectContext`, but callers never branched on
 *   `projectIdReady`. SetupsPage / ReferencesPage still constructed
 *   `BIBLE_URI = "agent://location-scout/bible/${LOCATION_ID}"` with
 *   `LOCATION_ID = ""`, then fired Generate. The backend correctly rejected
 *   `agent://location-scout/bible/` (no bible id) and surfaced a confusing
 *   1001 error.
 *
 * Fix contract enforced by this test file:
 *   Layer A (global banner) — `App.tsx` renders a top-level banner when
 *     `!projectIdReady`, telling the user to open the agent with a
 *     `?project_id=...` URL.
 *   Layer B (page-level disabled buttons) — `SetupsPage` and
 *     `ReferencesPage` disable every Generate / Approve / Send button when
 *     `!projectIdReady`. callTool is never invoked, even if the user
 *     somehow clicks through.
 *
 * Why both layers? A is immediate context for the user; B is a hard guard
 * that prevents the broken backend call regardless of UI layout drift.
 *
 * Why structural tests for the source-grep parts? Wiring full React trees
 * for SetupsPage / ReferencesPage in RTL requires every provider + router +
 * cache + ~50 lines of scaffolding for one shape. Source-grep catches
 * regression in milliseconds. The Layer A behavioural test below renders
 * App.tsx end-to-end through its actual provider tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_PATH = join(HERE, "..", "App.tsx");
const SETUPS_PAGE_PATH = join(HERE, "..", "pages", "SetupsPage.tsx");
const REFERENCES_PAGE_PATH = join(HERE, "..", "pages", "ReferencesPage.tsx");

// ─── Layer A — global banner in App.tsx ───────────────────────────────────

describe("Bug 1 REGRESSION — Layer A: App.tsx renders missing-project banner", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("App.tsx source imports useProjectContext (Layer A guard depends on it)", () => {
    const src = readFileSync(APP_PATH, "utf8");
    expect(
      src,
      "App.tsx must import useProjectContext to render the missing-project banner",
    ).toMatch(/useProjectContext/);
  });

  it("App.tsx source contains a missing-project banner (project_id mention near guard)", () => {
    const src = readFileSync(APP_PATH, "utf8");
    // Banner is keyed on projectIdReady === false; we assert it mentions
    // `project_id` so the user gets actionable guidance.
    expect(
      src,
      "App.tsx must render an explanatory banner about the missing project_id URL param",
    ).toMatch(/project_id/);
    expect(
      src,
      "App.tsx must branch on projectIdReady (the readiness flag from useProjectContext)",
    ).toMatch(/projectIdReady/);
  });

  it("App renders an alert role banner when ?project_id= is missing", async () => {
    // Render through the actual provider tree the way main.tsx does.
    const { ArtifactCacheProvider } = await import("../state/artifactCache");
    const { PipelineProvider } = await import("../state/PipelineContext");
    const { App } = await import("../App");
    render(
      <ArtifactCacheProvider>
        <PipelineProvider>
          <App />
        </PipelineProvider>
      </ArtifactCacheProvider>,
    );
    // The banner uses role="alert" so screen readers announce it.
    const banners = await screen.findAllByRole("alert");
    expect(banners.length).toBeGreaterThan(0);
    const text = banners.map((b) => b.textContent ?? "").join(" ");
    expect(
      text,
      "banner must mention project_id so the user knows what's missing",
    ).toMatch(/project_id/i);
  });

  it("App does NOT render the missing-project banner when project_id is present", async () => {
    window.history.replaceState({}, "", "/?project_id=p1");
    const { ArtifactCacheProvider } = await import("../state/artifactCache");
    const { PipelineProvider } = await import("../state/PipelineContext");
    const { App } = await import("../App");
    render(
      <ArtifactCacheProvider>
        <PipelineProvider>
          <App />
        </PipelineProvider>
      </ArtifactCacheProvider>,
    );
    // The page itself renders without the missing-project alert. There may
    // be OTHER alerts (e.g. transient bible-checking banner), so we filter
    // by text content rather than asserting "no alerts at all".
    const alerts = screen.queryAllByRole("alert");
    const missingProjectAlerts = alerts.filter((a) =>
      /Open this agent.*project_id|project_id.*missing|missing.*project_id/i.test(
        a.textContent ?? "",
      ),
    );
    expect(missingProjectAlerts).toHaveLength(0);
  });
});

// ─── Layer B — page-level disabled buttons ────────────────────────────────

describe("Bug 1 REGRESSION — Layer B: SetupsPage disables Generate when !projectIdReady", () => {
  it("SetupsPage destructures projectIdReady from useProjectContext", () => {
    const src = readFileSync(SETUPS_PAGE_PATH, "utf8");
    expect(
      src,
      "SetupsPage must read projectIdReady from useProjectContext to gate its buttons",
    ).toMatch(/projectIdReady/);
  });

  it("SetupsPage handleGenerateAll / runBatch path is guarded by projectIdReady", () => {
    const src = readFileSync(SETUPS_PAGE_PATH, "utf8");
    // The contract: somewhere in the file, projectIdReady is referenced in a
    // disabled-prop or early-return context. We accept either:
    //   - `disabled={... !projectIdReady ...}` on a button
    //   - `if (!projectIdReady) return ...` in a handler
    const hasDisabledGuard = /disabled={[^}]*!projectIdReady/.test(src);
    const hasEarlyReturn = /if\s*\(\s*!projectIdReady\s*\)/.test(src);
    expect(
      hasDisabledGuard || hasEarlyReturn,
      "SetupsPage must guard generation buttons / handlers on projectIdReady",
    ).toBe(true);
  });

  it("SetupsPage Generate button source includes !projectIdReady in its disabled expression", () => {
    const src = readFileSync(SETUPS_PAGE_PATH, "utf8");
    // The Generate-All button line / window contains handleGenerateAll. We
    // assert the disabled expression on that button (within a small window)
    // mentions projectIdReady. This catches the case where someone added an
    // early-return-guard to ONE handler but left the button visually
    // enabled — bad UX.
    const lines = src.split(/\r?\n/);
    const idx = lines.findIndex((l) => /onClick=\{handleGenerateAll\}/.test(l));
    expect(idx, "handleGenerateAll button not found in SetupsPage").toBeGreaterThan(-1);
    const window = lines.slice(Math.max(0, idx - 2), Math.min(idx + 8, lines.length)).join("\n");
    expect(
      window,
      "Generate-All button must have projectIdReady in its disabled expression for visible feedback",
    ).toMatch(/projectIdReady/);
  });
});

describe("Bug 1 REGRESSION — Layer B: ReferencesPage disables generation when !projectIdReady", () => {
  it("ReferencesPage destructures projectIdReady from useProjectContext", () => {
    const src = readFileSync(REFERENCES_PAGE_PATH, "utf8");
    expect(
      src,
      "ReferencesPage must read projectIdReady from useProjectContext to gate its buttons",
    ).toMatch(/projectIdReady/);
  });

  it("ReferencesPage generation handlers are guarded by projectIdReady", () => {
    const src = readFileSync(REFERENCES_PAGE_PATH, "utf8");
    const hasDisabledGuard = /disabled={[^}]*!projectIdReady/.test(src);
    const hasEarlyReturn = /if\s*\(\s*!projectIdReady\s*\)/.test(src);
    expect(
      hasDisabledGuard || hasEarlyReturn,
      "ReferencesPage must guard generation buttons / handlers on projectIdReady",
    ).toBe(true);
  });
});
