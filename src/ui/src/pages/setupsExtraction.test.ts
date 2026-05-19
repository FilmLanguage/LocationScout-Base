/**
 * Acceptance tests for setup-extraction logic (LS Setups Discipline).
 *
 * Tests A, B, C, D, E, F from the discipline plan. They drive the
 * design of `setupsExtraction.ts` — the pure helper module that
 * ReferencesPage / SetupsPage share for triggering + classifying
 * extract_setups runs.
 *
 * No DOM. Pure functions only.
 */

import { describe, it, expect, vi } from "vitest";

import {
  classifyExtractResult,
  shouldFireExtractSetups,
  type ExtractResultLike,
} from "./setupsExtraction";

describe("classifyExtractResult — Test C / D / G", () => {
  it("Test C: completed status with non-empty artifacts → kind=ready, count=N", () => {
    const final: ExtractResultLike = {
      status: "completed",
      progress: 1,
      current_step: "3 setups extracted",
      artifacts: [
        { uri: "agent://location-scout/setup/s1" },
        { uri: "agent://location-scout/setup/s2" },
        { uri: "agent://location-scout/setup/s3" },
      ],
    };
    const classified = classifyExtractResult(final);
    expect(classified.kind).toBe("ready");
    if (classified.kind === "ready") {
      expect(classified.count).toBe(3);
    }
  });

  it("Test D: failed status with backend error → kind=failed, exact message preserved", () => {
    const final: ExtractResultLike = {
      status: "failed",
      progress: 0.5,
      current_step: "extract_setups failed",
      error: "Bible may lack spatial detail. Regenerate with richer scene descriptions.",
    };
    const classified = classifyExtractResult(final);
    expect(classified.kind).toBe("failed");
    if (classified.kind === "failed") {
      expect(classified.message).toBe(
        "Bible may lack spatial detail. Regenerate with richer scene descriptions.",
      );
      // Must NOT contain hardcoded fallback strings
      expect(classified.message).not.toMatch(/LLM returned empty plan/);
    }
  });

  it("Test G: completed status with artifacts MUST NOT be classified as error " +
     "even if current_step looks like a description", () => {
    // This is the bug — backend completed successfully with current_step
    // "3 setups extracted" and artifacts populated; UI was painting it as red.
    const final: ExtractResultLike = {
      status: "completed",
      progress: 1,
      current_step: "3 setups extracted",
      artifacts: [{ uri: "agent://x/setup/s1" }],
    };
    const classified = classifyExtractResult(final);
    expect(classified.kind).toBe("ready");
    expect(classified.kind).not.toBe("failed");
  });

  it("completed status BUT empty artifacts → kind=failed with actionable hint", () => {
    // This case can still happen if backend's 3-layer fallback produces 0
    // setups despite status=completed. We surface backend's own message and
    // do not hardcode "LLM returned empty plan".
    const final: ExtractResultLike = {
      status: "completed",
      progress: 1,
      current_step: "0 setups extracted",
      artifacts: [],
    };
    const classified = classifyExtractResult(final);
    expect(classified.kind).toBe("failed");
    if (classified.kind === "failed") {
      // Falls back to current_step (no `error` field present), not hardcoded text.
      expect(classified.message).not.toMatch(/LLM returned empty plan/);
    }
  });
});

describe("shouldFireExtractSetups — Tests A & B", () => {
  it("Test A: from idle state with floorplan ready, firing is allowed", () => {
    expect(
      shouldFireExtractSetups({
        floorplanReady: true,
        currentKind: "idle",
      }),
    ).toBe(true);
  });

  it("Test B (idempotency): if already extracting, second click does NOT re-fire", () => {
    expect(
      shouldFireExtractSetups({
        floorplanReady: true,
        currentKind: "extracting",
      }),
    ).toBe(false);
  });

  it("if extraction already ready, second click does NOT re-fire", () => {
    expect(
      shouldFireExtractSetups({
        floorplanReady: true,
        currentKind: "ready",
      }),
    ).toBe(false);
  });

  it("allows retry from failed state", () => {
    expect(
      shouldFireExtractSetups({
        floorplanReady: true,
        currentKind: "failed",
      }),
    ).toBe(true);
  });

  it("blocks fire when floorplan not ready (precondition gate)", () => {
    expect(
      shouldFireExtractSetups({
        floorplanReady: false,
        currentKind: "idle",
      }),
    ).toBe(false);
  });
});

// Tests E and F are structural — about what's NOT in the DOM and NOT auto-
// firing on mount. Without a DOM testing library we assert at the source-
// code level instead: the strings / call sites that MUST be gone after the
// refactor. This catches accidental reintroduction.

describe("Test E (structural): manual Extract Setups button removed", () => {
  it("ReferencesPage.tsx source no longer contains the Extract Setups button copy", async () => {
    const fs = await import("node:fs");
    const path = new URL("./ReferencesPage.tsx", import.meta.url).pathname.replace(/^\//, "");
    // Normalize Windows path
    const normalized = process.platform === "win32" ? path.replace(/\//g, "\\") : path;
    const src = fs.readFileSync(normalized, "utf8");
    // The literal user-facing button text + the local handler name must be gone.
    expect(src).not.toMatch(/>Extract Setups</);
    expect(src).not.toMatch(/>Re-extract Setups</);
    expect(src).not.toMatch(/handleExtractSetups/);
  });
});

describe("Test F (structural): SetupsPage does not auto-fire extract_setups on mount", () => {
  it("SetupsPage.tsx source no longer calls callTool('extract_setups')", async () => {
    const fs = await import("node:fs");
    const path = new URL("./SetupsPage.tsx", import.meta.url).pathname.replace(/^\//, "");
    const normalized = process.platform === "win32" ? path.replace(/\//g, "\\") : path;
    const src = fs.readFileSync(normalized, "utf8");
    // We removed the auto-fire useEffect. The only allowed remnants are
    // string references (comments are ok, but no callTool with the tool name).
    expect(src).not.toMatch(/callTool[^)]*"extract_setups"/);
  });
});
