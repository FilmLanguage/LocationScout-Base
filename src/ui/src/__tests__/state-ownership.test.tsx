/**
 * Acceptance tests for the State Ownership Refactor (Variant A).
 *
 * Spec: ai-stanislavsky-workspace/docs/sessions/2026-05-20-state-ownership-refactor/04-acceptance-tests.md
 *
 * These tests intentionally FAIL on current LS `main` — they are the red baseline
 * that PHASE 3 (LS reference implementation) closes. The future hooks
 * (`useArtifact`, `useTask`, `useProjectArtifacts`) do not exist yet; each test
 * attempts to dynamically import them and is expected to throw with
 * `Cannot find module …` until Phase 3 lands.
 *
 * A handful of tests are structural source-grep checks that verify current
 * anti-patterns are STILL in the code (so the green direction after the
 * refactor is the disappearance of those patterns). Those tests pass today —
 * see comments inline.
 *
 * Test-naming convention: each `it()` is prefixed with its test ID from the
 * spec. When triaging a failing test, search the spec for that slug.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

// -- Test helpers --------------------------------------------------------

/**
 * Dynamically import the future state-ownership hooks. Returns null when the
 * modules don't resolve. Tests that need them assert the import succeeds; the
 * failure mode pre-Phase-3 is "expected hook module to exist".
 */
async function importHooks() {
  try {
    // Indirect dynamic-import via variable + /* @vite-ignore */ disables Vite's
    // static-analysis, letting these imports throw at runtime (the desired
    // pre-Phase-3 failure mode) instead of bringing down the whole test file at
    // transform time. Path strings are concatenated so Vite cannot statically
    // resolve them.
    const base = "../hooks/";
    const stateBase = "../state/";
    const useArtifactMod = await import(/* @vite-ignore */ base + "useArtifact");
    const useTaskMod = await import(/* @vite-ignore */ base + "useTask");
    const useProjectArtifactsMod = await import(
      /* @vite-ignore */ base + "useProjectArtifacts",
    );
    const cacheMod = await import(/* @vite-ignore */ stateBase + "artifactCache");
    return {
      useArtifact: (useArtifactMod as Record<string, unknown>).useArtifact,
      useTask: (useTaskMod as Record<string, unknown>).useTask,
      useProjectArtifacts: (useProjectArtifactsMod as Record<string, unknown>)
        .useProjectArtifacts,
      ArtifactCacheProvider: (cacheMod as Record<string, unknown>)
        .ArtifactCacheProvider,
    };
  } catch {
    return null;
  }
}

beforeEach(() => {
  // Clean URL + storage per test.
  window.history.replaceState({}, "", "/?project_id=p1&location_id=loc_p1");
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// -- Hook-existence gate -------------------------------------------------
// These trip Phase 3 to land the canonical hooks. After Phase 3, the hooks
// exist and every downstream test gets a chance to evaluate its real
// behaviour.

describe("STATE-OWNERSHIP: hook scaffolding (Phase 3 gate)", () => {
  it("hooks-exist: useArtifact / useTask / useProjectArtifacts modules resolve", async () => {
    const hooks = await importHooks();
    expect(hooks).not.toBeNull();
    expect(typeof hooks?.useArtifact).toBe("function");
    expect(typeof hooks?.useTask).toBe("function");
    expect(typeof hooks?.useProjectArtifacts).toBe("function");
    expect(typeof hooks?.ArtifactCacheProvider).toBe("function");
  });
});

// -- Acceptance tests (mapped to 04-acceptance-tests.md) -----------------

describe("STATE-OWNERSHIP: refetch-on-mount", () => {
  it("refetch-on-mount: useArtifact fires get_bible exactly once on mount with project_id", async () => {
    const hooks = await importHooks();
    if (!hooks) {
      throw new Error(
        "useArtifact/useTask/useProjectArtifacts not yet implemented (Phase 3 deliverable)",
      );
    }
    const { useArtifact, ArtifactCacheProvider } = hooks as {
      useArtifact: (spec: {
        type: string;
        id: string;
        project_id: string;
      }) => { status: string; data: unknown };
      ArtifactCacheProvider: React.FC<{ children: React.ReactNode }>;
    };
    const callToolMock = vi.fn().mockResolvedValue({
      raw: {},
      data: { bible_id: "loc_p1", name: "Test Bible" },
    });
    vi.doMock("../api/mcp", () => ({ callTool: callToolMock, pollTask: vi.fn() }));
    const ssGetSpy = vi.spyOn(Storage.prototype, "getItem");

    function Probe() {
      const a = useArtifact({ type: "bible", id: "loc_p1", project_id: "p1" });
      return <div>{a.status}</div>;
    }
    render(
      <ArtifactCacheProvider>
        <Probe />
      </ArtifactCacheProvider>,
    );
    await waitFor(() => {
      expect(callToolMock).toHaveBeenCalledWith(
        "get_bible",
        expect.objectContaining({ bible_id: "loc_p1", project_id: "p1" }),
      );
    });
    expect(callToolMock).toHaveBeenCalledTimes(1);
    expect(
      ssGetSpy.mock.calls.some((c) =>
        String(c[0]).startsWith("ls.bible_task."),
      ),
    ).toBe(false);
  });
});

describe("STATE-OWNERSHIP: cache-hit-no-refetch", () => {
  it("cache-hit-no-refetch: second mount of same key does NOT re-fetch", async () => {
    const hooks = await importHooks();
    if (!hooks) throw new Error("Phase 3 hooks missing");
    const { useArtifact, ArtifactCacheProvider } = hooks as {
      useArtifact: (spec: {
        type: string;
        id: string;
        project_id: string;
      }) => { status: string; data: unknown };
      ArtifactCacheProvider: React.FC<{ children: React.ReactNode }>;
    };
    const callToolMock = vi.fn().mockResolvedValue({
      raw: {},
      data: { bible_id: "loc_p1" },
    });
    vi.doMock("../api/mcp", () => ({ callTool: callToolMock, pollTask: vi.fn() }));
    function Probe({ tag }: { tag: string }) {
      const a = useArtifact({ type: "bible", id: "loc_p1", project_id: "p1" });
      return <div data-testid={tag}>{a.status}</div>;
    }
    render(
      <ArtifactCacheProvider>
        <Probe tag="a" />
        <Probe tag="b" />
      </ArtifactCacheProvider>,
    );
    await waitFor(() =>
      expect(callToolMock).toHaveBeenCalledWith("get_bible", expect.any(Object)),
    );
    // Exactly one network call shared by both components.
    expect(callToolMock).toHaveBeenCalledTimes(1);
  });
});

describe("STATE-OWNERSHIP: cache-stale-refetch", () => {
  it("cache-stale-refetch: stale (>30s) entry yields immediate ready + background refetch", async () => {
    const hooks = await importHooks();
    if (!hooks) throw new Error("Phase 3 hooks missing");
    // This test is intentionally written as a future-shape check. Phase 3
    // exposes ArtifactCacheProvider with a `seed` prop or imperative API to
    // prime the cache with `fetchedAt = now - 60s`. Until then, the import
    // throws and the test fails — the desired baseline state.
    const stateBase = "../state/";
    const cacheMod = await import(/* @vite-ignore */ stateBase + "artifactCache");
    const seed = (cacheMod as Record<string, unknown>).seed as
      | ((args: unknown) => void)
      | undefined;
    expect(typeof seed).toBe("function");
  });
});

describe("STATE-OWNERSHIP: tab-switch-state-preservation-LS", () => {
  it("tab-switch-LS: References → Setups → References does NOT re-fetch within 30s window", async () => {
    const hooks = await importHooks();
    if (!hooks) throw new Error("Phase 3 hooks missing");
    const { useArtifact, ArtifactCacheProvider } = hooks as {
      useArtifact: (spec: {
        type: string;
        id: string;
        project_id: string;
      }) => { status: string; data: unknown };
      ArtifactCacheProvider: React.FC<{ children: React.ReactNode }>;
    };
    const callToolMock = vi.fn().mockResolvedValue({
      raw: {},
      data: { bible_id: "loc_p1" },
    });
    vi.doMock("../api/mcp", () => ({ callTool: callToolMock, pollTask: vi.fn() }));
    function Refs() {
      useArtifact({ type: "bible", id: "loc_p1", project_id: "p1" });
      useArtifact({ type: "anchor", id: "loc_p1", project_id: "p1" });
      return <div>refs</div>;
    }
    function Setups() {
      return <div>setups</div>;
    }
    const { rerender } = render(
      <ArtifactCacheProvider>
        <Refs />
      </ArtifactCacheProvider>,
    );
    await waitFor(() => expect(callToolMock).toHaveBeenCalled());
    const callsAfterFirstMount = callToolMock.mock.calls.length;
    // Switch to Setups
    rerender(
      <ArtifactCacheProvider>
        <Setups />
      </ArtifactCacheProvider>,
    );
    // Switch back to References — cache must serve, no new fetches.
    rerender(
      <ArtifactCacheProvider>
        <Refs />
      </ArtifactCacheProvider>,
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(callToolMock.mock.calls.length).toBe(callsAfterFirstMount);
  });
});

describe("STATE-OWNERSHIP: cross-project-isolation-list", () => {
  it("cross-project-isolation-list: useProjectArtifacts scopes to one project_id at a time", async () => {
    const hooks = await importHooks();
    if (!hooks) throw new Error("Phase 3 hooks missing");
    const { useProjectArtifacts, ArtifactCacheProvider } = hooks as {
      useProjectArtifacts: (type: string) => {
        items: unknown[];
        status: string;
      };
      ArtifactCacheProvider: React.FC<{ children: React.ReactNode }>;
    };
    const callToolMock = vi.fn().mockImplementation((name: string, args: Record<string, unknown>) => {
      if (name === "list_bibles") {
        const pid = String(args.project_id);
        return Promise.resolve({
          raw: {},
          data: { items: [{ bible_id: `bible_${pid}` }] },
        });
      }
      return Promise.resolve({ raw: {}, data: {} });
    });
    vi.doMock("../api/mcp", () => ({ callTool: callToolMock, pollTask: vi.fn() }));
    window.history.replaceState({}, "", "/?project_id=p1");
    function Probe() {
      const { items } = useProjectArtifacts("bible");
      return <div data-testid="items">{JSON.stringify(items)}</div>;
    }
    render(
      <ArtifactCacheProvider>
        <Probe />
      </ArtifactCacheProvider>,
    );
    await waitFor(() =>
      expect(callToolMock).toHaveBeenCalledWith(
        "list_bibles",
        expect.objectContaining({ project_id: "p1" }),
      ),
    );
    // Each list_* call MUST include project_id (no undefined / missing).
    for (const call of callToolMock.mock.calls) {
      if (String(call[0]).startsWith("list_")) {
        expect(call[1]).toHaveProperty("project_id", "p1");
      }
    }
  });
});

describe("STATE-OWNERSHIP: poll-task-merges-result-on-completed", () => {
  it("poll-task-completed: artifacts populated from get_task_result even when get_task_status omits them", async () => {
    const hooks = await importHooks();
    if (!hooks) throw new Error("Phase 3 hooks missing");
    const { useTask } = hooks as {
      useTask: (
        id: string,
        opts?: Record<string, unknown>,
      ) => {
        status: string;
        artifacts: Array<{ uri: string }> | null;
        error: string | null;
      };
    };
    const callToolMock = vi.fn().mockImplementation((name: string) => {
      if (name === "get_task_status") {
        return Promise.resolve({
          raw: {},
          data: {
            task_id: "t1",
            status: "completed",
            progress: 1,
            current_step: "3 setups extracted",
          },
        });
      }
      if (name === "get_task_result") {
        return Promise.resolve({
          raw: {},
          data: {
            status: "completed",
            artifacts: [
              { uri: "agent://location-scout/setup/s1" },
              { uri: "agent://location-scout/setup/s2" },
              { uri: "agent://location-scout/setup/s3" },
            ],
          },
        });
      }
      return Promise.resolve({ raw: {}, data: {} });
    });
    vi.doMock("../api/mcp", () => ({ callTool: callToolMock, pollTask: vi.fn() }));
    function Probe() {
      const t = useTask("t1");
      return <div data-testid="x">{t.status}::{t.artifacts?.length ?? -1}</div>;
    }
    render(<Probe />);
    await waitFor(
      () => expect(screen.getByTestId("x").textContent).toBe("completed::3"),
      { timeout: 4000 },
    );
  });
});

describe("STATE-OWNERSHIP: poll-task-merges-result-on-failed", () => {
  it("poll-task-failed: error string preserved end-to-end (not swallowed)", async () => {
    const hooks = await importHooks();
    if (!hooks) throw new Error("Phase 3 hooks missing");
    const { useTask } = hooks as {
      useTask: (id: string) => { status: string; error: string | null };
    };
    const callToolMock = vi.fn().mockImplementation((name: string) => {
      if (name === "get_task_status") {
        return Promise.resolve({
          raw: {},
          data: {
            status: "failed",
            progress: 0.5,
            current_step: "extract_setups failed",
            error: "upstream brief missing",
          },
        });
      }
      if (name === "get_task_result") {
        return Promise.resolve({
          raw: {},
          data: {
            status: "failed",
            error: "upstream brief missing",
            error_code: "NO_BRIEF",
          },
        });
      }
      return Promise.resolve({ raw: {}, data: {} });
    });
    vi.doMock("../api/mcp", () => ({ callTool: callToolMock, pollTask: vi.fn() }));
    function Probe() {
      const t = useTask("t1");
      return <div data-testid="err">{t.status}::{t.error}</div>;
    }
    render(<Probe />);
    await waitFor(
      () => expect(screen.getByTestId("err").textContent).toMatch(/failed::upstream brief missing/),
      { timeout: 4000 },
    );
  });
});

describe("STATE-OWNERSHIP: poll-task-no-attach-on-reload", () => {
  it("poll-task-no-attach: fresh PipelineContext does NOT call get_task_status for prior task; uses useArtifact instead", async () => {
    const hooks = await importHooks();
    if (!hooks) throw new Error("Phase 3 hooks missing");
    const { useArtifact, ArtifactCacheProvider } = hooks as {
      useArtifact: (spec: {
        type: string;
        id: string;
        project_id: string;
      }) => { status: string };
      ArtifactCacheProvider: React.FC<{ children: React.ReactNode }>;
    };
    const callToolMock = vi.fn().mockResolvedValue({ raw: {}, data: { bible_id: "loc_p1" } });
    vi.doMock("../api/mcp", () => ({ callTool: callToolMock, pollTask: vi.fn() }));
    sessionStorage.setItem("ls.bible_task.loc_p1", "t1"); // legacy hand-off
    function Probe() {
      useArtifact({ type: "bible", id: "loc_p1", project_id: "p1" });
      return <div>x</div>;
    }
    render(
      <ArtifactCacheProvider>
        <Probe />
      </ArtifactCacheProvider>,
    );
    await waitFor(() => expect(callToolMock).toHaveBeenCalled());
    // get_task_status MUST NOT have been called — the legacy sessionStorage
    // task_id is irrelevant under Variant A.
    const calledTaskStatus = callToolMock.mock.calls.some(
      (c) => c[0] === "get_task_status",
    );
    expect(calledTaskStatus).toBe(false);
  });
});

describe("STATE-OWNERSHIP: list-filters-on-project-id", () => {
  it("list-filters-on-project-id: list_bibles always passes project_id (never undefined)", async () => {
    const hooks = await importHooks();
    if (!hooks) throw new Error("Phase 3 hooks missing");
    const { useProjectArtifacts, ArtifactCacheProvider } = hooks as {
      useProjectArtifacts: (type: string) => { items: unknown[] };
      ArtifactCacheProvider: React.FC<{ children: React.ReactNode }>;
    };
    const callToolMock = vi.fn().mockResolvedValue({ raw: {}, data: { items: [] } });
    vi.doMock("../api/mcp", () => ({ callTool: callToolMock, pollTask: vi.fn() }));
    window.history.replaceState({}, "", "/?project_id=p1");
    function Probe() {
      useProjectArtifacts("bible");
      return <div>x</div>;
    }
    render(
      <ArtifactCacheProvider>
        <Probe />
      </ArtifactCacheProvider>,
    );
    await waitFor(() => expect(callToolMock).toHaveBeenCalled());
    for (const call of callToolMock.mock.calls) {
      if (String(call[0]).startsWith("list_")) {
        const args = call[1] as Record<string, unknown>;
        expect(args.project_id).toBeDefined();
        expect(args.project_id).not.toBeNull();
      }
    }
  });
});

describe("STATE-OWNERSHIP: cache-invalidation-on-mutation", () => {
  it.todo(
    "cache-invalidation-on-mutation: onTerminal invalidates anchor cache → next mount refetches " +
      "(Phase 3 must expose cache.invalidate API; covered by integration after impl)",
  );
});

describe("STATE-OWNERSHIP: refs-survive-close-reopen-cycle (Phase 5 sidecar)", () => {
  it.skip(
    "refs-survive-close-reopen: requires Phase 5 sidecar refs field. Promote to canary in Phase 6.",
    () => {
      /* defer to Phase 6 multi-project canary — needs real backend sidecar */
    },
  );
});

describe("STATE-OWNERSHIP: setup-extraction-fires-on-approve-anchor", () => {
  it.todo(
    "setup-extraction-fires-on-approve-anchor: covered by setupsExtraction.test.ts (Tests A/B/C/D/G); " +
      "after Phase 3, re-assert the call ordering through useTask",
  );
});

describe("STATE-OWNERSHIP: setups-page-renders-tiles-after-task-completes", () => {
  it("setups-page-success-no-red-banner: classifyExtractResult flags completed+artifacts as ready, not failed", async () => {
    // This one CAN pass on current code — already implemented 2026-05-19 LS
    // Setups Discipline. Acts as a regression guard.
    const mod = await import("../pages/setupsExtraction");
    const classify = (mod as Record<string, unknown>).classifyExtractResult as (
      r: unknown,
    ) => { kind: string };
    const result = classify({
      status: "completed",
      progress: 1,
      current_step: "3 setups extracted",
      artifacts: [{ uri: "agent://x/setup/s1" }],
    });
    expect(result.kind).toBe("ready");
  });
});

describe("STATE-OWNERSHIP: bible-bootstrap-doesnt-refire-on-tab-return", () => {
  it("bible-bootstrap-no-refire: ReferencesPage source no longer writes ls.bible_task.* sessionStorage keys", async () => {
    // Variant A deletes the sessionStorage handoff. Pre-Phase-3 this FAILS
    // (current code DOES write that key on every scout_location fire).
    const fs = await import("node:fs");
    const path = new URL("../pages/ReferencesPage.tsx", import.meta.url).pathname.replace(/^\//, "");
    const normalized = process.platform === "win32" ? path.replace(/\//g, "\\") : path;
    const src = fs.readFileSync(normalized, "utf8");
    expect(src).not.toMatch(/sessionStorage\.setItem\([^)]*ls\.bible_task/);
    expect(src).not.toMatch(/sessionStorage\.setItem\([^)]*ls\.bible_error/);
  });
});

describe("STATE-OWNERSHIP: prompt-draft-localstorage-survives-reload", () => {
  it.todo(
    "prompt-draft-localstorage-survives-reload: PromptCard already uses localStorage drafts; " +
      "after Phase 3 add explicit test asserting key shape ls.draft.<type>.<project>.<id>",
  );
});

describe("STATE-OWNERSHIP: no-cross-project-bleed-with-two-tabs", () => {
  it("no-cross-project-bleed: parallel renders with different project_ids cache independently", async () => {
    const hooks = await importHooks();
    if (!hooks) throw new Error("Phase 3 hooks missing");
    const { useArtifact, ArtifactCacheProvider } = hooks as {
      useArtifact: (spec: {
        type: string;
        id: string;
        project_id: string;
      }) => { status: string; data: { name?: string } | null };
      ArtifactCacheProvider: React.FC<{ children: React.ReactNode }>;
    };
    const callToolMock = vi.fn().mockImplementation((name: string, args: Record<string, unknown>) => {
      if (name === "get_bible") {
        const pid = String(args.project_id);
        const id = String(args.bible_id);
        return Promise.resolve({
          raw: {},
          data: { bible_id: id, project_id: pid, name: `bible_${pid}` },
        });
      }
      return Promise.resolve({ raw: {}, data: {} });
    });
    vi.doMock("../api/mcp", () => ({ callTool: callToolMock, pollTask: vi.fn() }));
    function P1() {
      const a = useArtifact({ type: "bible", id: "loc_p1", project_id: "p1" });
      return <div data-testid="p1">{a.data?.name ?? "loading"}</div>;
    }
    function P2() {
      const a = useArtifact({ type: "bible", id: "loc_p2", project_id: "p2" });
      return <div data-testid="p2">{a.data?.name ?? "loading"}</div>;
    }
    render(
      <>
        <ArtifactCacheProvider>
          <P1 />
        </ArtifactCacheProvider>
        <ArtifactCacheProvider>
          <P2 />
        </ArtifactCacheProvider>
      </>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("p1").textContent).toBe("bible_p1");
      expect(screen.getByTestId("p2").textContent).toBe("bible_p2");
    });
    // No call leaked the wrong project_id.
    for (const call of callToolMock.mock.calls) {
      if (call[0] === "get_bible") {
        const args = call[1] as Record<string, unknown>;
        const id = String(args.bible_id);
        const pid = String(args.project_id);
        expect(id).toContain(pid); // loc_p1↔p1, loc_p2↔p2
      }
    }
  });
});

describe("STATE-OWNERSHIP: useArtifact-handles-404-as-missing", () => {
  it("useArtifact-404-missing: backend not_found → status='missing', error=null", async () => {
    const hooks = await importHooks();
    if (!hooks) throw new Error("Phase 3 hooks missing");
    const { useArtifact, ArtifactCacheProvider } = hooks as {
      useArtifact: (spec: {
        type: string;
        id: string;
        project_id: string;
      }) => { status: string; error: string | null; data: unknown };
      ArtifactCacheProvider: React.FC<{ children: React.ReactNode }>;
    };
    const callToolMock = vi.fn().mockResolvedValue({
      raw: {},
      data: { error: "not_found" },
    });
    vi.doMock("../api/mcp", () => ({ callTool: callToolMock, pollTask: vi.fn() }));
    function Probe() {
      const a = useArtifact({ type: "bible", id: "loc_unknown", project_id: "p1" });
      return <div data-testid="s">{a.status}::{String(a.error)}</div>;
    }
    render(
      <ArtifactCacheProvider>
        <Probe />
      </ArtifactCacheProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("s").textContent).toBe("missing::null"),
    );
  });
});

describe("STATE-OWNERSHIP: pipeline-state-reducer-survives-Variant-A", () => {
  it.todo(
    "pipeline-state-reducer-survives-Variant-A: existing PipelineContext reducer for currentStage/gates " +
      "remains untouched by the refactor — verify after Phase 3 lands with a transition assertion",
  );
});

describe("STATE-OWNERSHIP: list-no-projectId-rejected-or-empty", () => {
  it("list-no-projectId: when URL has no project_id, useProjectArtifacts surfaces an error or empty", async () => {
    const hooks = await importHooks();
    if (!hooks) throw new Error("Phase 3 hooks missing");
    const { useProjectArtifacts, ArtifactCacheProvider } = hooks as {
      useProjectArtifacts: (type: string) => {
        items: unknown[];
        status: string;
        error: string | null;
      };
      ArtifactCacheProvider: React.FC<{ children: React.ReactNode }>;
    };
    const callToolMock = vi.fn().mockResolvedValue({ raw: {}, data: { items: [] } });
    vi.doMock("../api/mcp", () => ({ callTool: callToolMock, pollTask: vi.fn() }));
    // Clear project_id from URL.
    window.history.replaceState({}, "", "/?location_id=loc_p1");
    function Probe() {
      const r = useProjectArtifacts("bible");
      return <div data-testid="s">{r.status}::{r.items.length}::{String(r.error)}</div>;
    }
    render(
      <ArtifactCacheProvider>
        <Probe />
      </ArtifactCacheProvider>,
    );
    // Either: hook returns error banner, OR returns empty list. Either is acceptable —
    // the contract is NO list_* call without project_id.
    await new Promise((r) => setTimeout(r, 30));
    const listCalls = callToolMock.mock.calls.filter((c) => String(c[0]).startsWith("list_"));
    for (const call of listCalls) {
      const args = call[1] as Record<string, unknown>;
      expect(args.project_id).toBeDefined();
      expect(args.project_id).not.toBe("");
    }
  });
});

describe("STATE-OWNERSHIP: bootstrap-idempotent (LS variant)", () => {
  it("LS bootstrap-idempotent: scout_location not refired on remount of ReferencesPage when bible exists", async () => {
    const hooks = await importHooks();
    if (!hooks) throw new Error("Phase 3 hooks missing");
    // After Phase 3, ReferencesPage uses useArtifact("bible", ...) which sees
    // the existing bible in cache → no scout_location fire. Pre-Phase-3, the
    // page calls scout_location on every mount (mitigated by sticky-error
    // sessionStorage). This test fails until the refactor lands.
    const { useArtifact, ArtifactCacheProvider } = hooks as {
      useArtifact: (spec: {
        type: string;
        id: string;
        project_id: string;
      }) => { status: string };
      ArtifactCacheProvider: React.FC<{ children: React.ReactNode }>;
    };
    const callToolMock = vi.fn().mockImplementation((name: string) => {
      if (name === "get_bible")
        return Promise.resolve({ raw: {}, data: { bible_id: "loc_p1", name: "Bible" } });
      return Promise.resolve({ raw: {}, data: {} });
    });
    vi.doMock("../api/mcp", () => ({ callTool: callToolMock, pollTask: vi.fn() }));
    function Probe() {
      useArtifact({ type: "bible", id: "loc_p1", project_id: "p1" });
      return <div>x</div>;
    }
    const { unmount } = render(
      <ArtifactCacheProvider>
        <Probe />
      </ArtifactCacheProvider>,
    );
    await waitFor(() => expect(callToolMock).toHaveBeenCalled());
    unmount();
    render(
      <ArtifactCacheProvider>
        <Probe />
      </ArtifactCacheProvider>,
    );
    await new Promise((r) => setTimeout(r, 30));
    const scoutCalls = callToolMock.mock.calls.filter((c) => c[0] === "scout_location");
    expect(scoutCalls.length).toBe(0);
  });
});

describe("STATE-OWNERSHIP: useTask-cancels-on-unmount-only-when-instructed", () => {
  it("useTask-cancel-opt-in: cancelOnUnmount=true fires cancel_task; default does NOT", async () => {
    const hooks = await importHooks();
    if (!hooks) throw new Error("Phase 3 hooks missing");
    const { useTask } = hooks as {
      useTask: (
        id: string,
        opts?: { cancelOnUnmount?: boolean },
      ) => { status: string };
    };
    const callToolMock = vi.fn().mockImplementation((name: string) => {
      if (name === "get_task_status")
        return Promise.resolve({
          raw: {},
          data: { status: "running", progress: 0.5, current_step: "working" },
        });
      return Promise.resolve({ raw: {}, data: {} });
    });
    vi.doMock("../api/mcp", () => ({ callTool: callToolMock, pollTask: vi.fn() }));
    function NoCancel() {
      useTask("t1");
      return <div>x</div>;
    }
    function YesCancel() {
      useTask("t2", { cancelOnUnmount: true });
      return <div>y</div>;
    }
    const r1 = render(<NoCancel />);
    await new Promise((r) => setTimeout(r, 20));
    r1.unmount();
    const r2 = render(<YesCancel />);
    await new Promise((r) => setTimeout(r, 20));
    r2.unmount();
    await new Promise((r) => setTimeout(r, 20));
    const cancelCalls = callToolMock.mock.calls.filter((c) => c[0] === "cancel_task");
    const cancelTaskIds = cancelCalls.map((c) => (c[1] as Record<string, unknown>).task_id);
    expect(cancelTaskIds).not.toContain("t1");
    expect(cancelTaskIds).toContain("t2");
  });
});

// -- Structural source-grep tests (run today, on current code) ----------
// These verify the anti-patterns Variant A deletes are STILL in the source
// pre-Phase-3. After Phase 3, the same greps must come up empty — that's the
// green direction.

describe("STATE-OWNERSHIP: legacy mechanisms expected to be deleted by Phase 3", () => {
  it("legacy-mechanisms-A: ReferencesPage no longer defines bibleTaskKey/bibleErrorKey helpers", async () => {
    // Phase 3b (2026-05-20) deleted the bibleTaskKey/bibleErrorKey
    // sessionStorage shims; useArtifact("bible") + useTask own the bootstrap
    // now. This is the post-Phase-3b assertion — the inverse direction the
    // original test author called out:
    //   "Phase 3 must delete them, at which point the grep should be
    //    inverted — see the bible-bootstrap-no-refire test above"
    // The companion bible-bootstrap-doesnt-refire-on-tab-return test (above)
    // covers the runtime side: no sessionStorage.setItem("ls.bible_task..."|
    // "ls.bible_error...") writes. This one covers the source-grep side:
    // even the helper names are gone.
    const fs = await import("node:fs");
    const path = new URL("../pages/ReferencesPage.tsx", import.meta.url).pathname.replace(/^\//, "");
    const normalized = process.platform === "win32" ? path.replace(/\//g, "\\") : path;
    const src = fs.readFileSync(normalized, "utf8");
    expect(src).not.toMatch(/function bibleTaskKey|function bibleErrorKey/);
  });
});
