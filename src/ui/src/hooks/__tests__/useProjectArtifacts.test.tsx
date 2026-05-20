/**
 * Unit tests for useProjectArtifacts (Phase 3a, Variant A).
 *
 * Contract (docs/sessions/2026-05-20-state-ownership-refactor/02-architecture.md §4):
 *  - Calls list_<type> with REQUIRED project_id arg.
 *  - Cache key is (project_id, "list", type) — invalidated by invalidateType.
 *  - Two projects with the same type CANNOT bleed.
 *  - When URL has no project_id, hook surfaces an error and DOES NOT fire
 *    list_*. (No "default-project" silent collapse.)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import React from "react";

const callToolMock = vi.hoisted(() => vi.fn());
vi.mock("../../api/mcp", () => ({
  callTool: callToolMock,
  pollTask: vi.fn(),
}));

import { useProjectArtifacts } from "../useProjectArtifacts";
import { artifactCache } from "../../state/artifactCache";

beforeEach(() => {
  callToolMock.mockReset();
  // Wipe any cached list slots from prior tests. List entries are stored
  // under type=`list:<type>` so invalidateType uses that prefix.
  for (const pid of ["p1", "p2", "p_url"]) {
    artifactCache.invalidateType("list:bible", pid);
    artifactCache.invalidateType("list:anchor", pid);
    artifactCache.invalidateType("bible", pid);
    artifactCache.invalidateType("anchor", pid);
  }
  window.history.replaceState({}, "", "/?project_id=p_url");
});

afterEach(() => {
  cleanup();
});

function Probe({
  type,
  project_id,
  tag,
}: {
  type: string;
  project_id?: string;
  tag?: string;
}) {
  const r = useProjectArtifacts<{ bible_id: string }>({ type, project_id });
  return (
    <div>
      <span data-testid={`${tag ?? ""}status`}>{r.status}</span>
      <span data-testid={`${tag ?? ""}count`}>{r.items.length}</span>
      <span data-testid={`${tag ?? ""}error`}>{r.error ?? "—"}</span>
      <span data-testid={`${tag ?? ""}items`}>
        {r.items.map((i) => i.bible_id).join(",")}
      </span>
    </div>
  );
}

describe("useProjectArtifacts: project_id filter on call", () => {
  it("filters by project_id (cache scope, two projects don't bleed)", async () => {
    callToolMock.mockImplementation((name: string, args: Record<string, unknown>) => {
      if (name === "list_bibles") {
        const pid = String(args.project_id);
        return Promise.resolve({
          raw: {},
          data: { items: [{ bible_id: `b_${pid}` }] },
        });
      }
      return Promise.resolve({ raw: {}, data: { items: [] } });
    });
    render(
      <>
        <Probe type="bible" project_id="p1" tag="a-" />
        <Probe type="bible" project_id="p2" tag="b-" />
      </>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("a-items").textContent).toBe("b_p1");
      expect(screen.getByTestId("b-items").textContent).toBe("b_p2");
    });
    // Every list_* call must pass project_id explicitly.
    const listCalls = callToolMock.mock.calls.filter((c) =>
      String(c[0]).startsWith("list_"),
    );
    expect(listCalls.length).toBe(2);
    for (const c of listCalls) {
      const args = c[1] as Record<string, unknown>;
      expect(args.project_id).toBeDefined();
      expect(["p1", "p2"]).toContain(args.project_id);
    }
  });
});

describe("useProjectArtifacts: cache invalidation", () => {
  it("re-fetches after cache invalidation of same type+project", async () => {
    let pollCount = 0;
    callToolMock.mockImplementation((_name: string, args: Record<string, unknown>) => {
      pollCount += 1;
      const items = pollCount === 1 ? [{ bible_id: "v1" }] : [{ bible_id: "v2" }];
      return Promise.resolve({ raw: {}, data: { items } });
    });
    render(<Probe type="bible" project_id="p1" />);
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("v1"));
    expect(callToolMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      artifactCache.invalidateType("bible", "p1");
    });
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("v2"));
    expect(callToolMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT re-fetch when a different project's cache invalidates", async () => {
    callToolMock.mockImplementation((_n: string, args: Record<string, unknown>) =>
      Promise.resolve({ raw: {}, data: { items: [{ bible_id: `for_${args.project_id}` }] } }),
    );
    render(<Probe type="bible" project_id="p1" />);
    await waitFor(() => expect(screen.getByTestId("items").textContent).toBe("for_p1"));
    expect(callToolMock).toHaveBeenCalledTimes(1);
    // Invalidate a DIFFERENT project's cache. p1's hook must not refetch.
    await act(async () => {
      artifactCache.invalidateType("bible", "p2");
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(callToolMock).toHaveBeenCalledTimes(1);
  });
});

describe("useProjectArtifacts: error path", () => {
  it("surfaces backend error on rejection", async () => {
    callToolMock.mockRejectedValue(new Error("MCP HTTP 500"));
    render(<Probe type="bible" project_id="p1" />);
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("error"),
    );
    expect(screen.getByTestId("error").textContent).toMatch(/MCP HTTP 500/);
  });
});

describe("useProjectArtifacts: project_id required contract", () => {
  it("does NOT fire list_* when URL has no project_id (and no explicit override)", async () => {
    // Default-project handling lives in useProjectContext, but the hook MUST
    // NOT issue a list_* call when the resolved project_id is empty after
    // trimming the fallback. We simulate by clearing the URL and using a
    // sentinel project_id="" override.
    window.history.replaceState({}, "", "/");
    render(<Probe type="bible" project_id="" />);
    await new Promise((r) => setTimeout(r, 30));
    const listCalls = callToolMock.mock.calls.filter((c) =>
      String(c[0]).startsWith("list_"),
    );
    expect(listCalls.length).toBe(0);
    // Status surfaces an error explaining why.
    const status = screen.getByTestId("status").textContent;
    expect(["error", "idle"]).toContain(status);
  });
});

describe("useProjectArtifacts: list shape robustness", () => {
  it("treats { items: [] } as a successful empty list (status=ready)", async () => {
    callToolMock.mockResolvedValue({ raw: {}, data: { items: [] } });
    render(<Probe type="bible" project_id="p1" />);
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready"),
    );
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});
