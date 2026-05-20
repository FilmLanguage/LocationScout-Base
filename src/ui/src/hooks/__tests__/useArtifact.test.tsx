/**
 * Unit tests for useArtifact (Phase 3a, Variant A).
 *
 * Contract (docs/sessions/2026-05-20-state-ownership-refactor/02-architecture.md §2):
 *  - On mount + params change: check cache → if fresh (<30 s) return cached, else fetch.
 *  - Fetch via callTool("get_<type>", { <type>_id, project_id }).
 *  - Cache key is (type, id, project_id); project_id falls back to URL via useProjectContext.
 *  - 404 / { error: "not_found" } → status="missing" (NOT error). Caller renders empty state.
 *  - refetch() forces a network call regardless of TTL.
 *  - Subscribes to artifactCache so external invalidate triggers re-render.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import React from "react";

// Hoist mock so the module-graph captures it before useArtifact imports it.
const callToolMock = vi.hoisted(() => vi.fn());
vi.mock("../../api/mcp", () => ({
  callTool: callToolMock,
  pollTask: vi.fn(),
}));

import { useArtifact } from "../useArtifact";
import { artifactCache } from "../../state/artifactCache";

// Each test gets a clean cache + URL + mocks + DOM.
beforeEach(() => {
  callToolMock.mockReset();
  // Reset cache by invalidating every conceivable key used in this file.
  // The cache is a singleton; tests can use a unique id per case to avoid
  // cross-test bleed, but to be robust, we wipe the well-known ids too.
  ["loc_p1", "loc_p2", "loc_unknown", "loc_refetch", "loc_explicit"].forEach((id) => {
    ["bible", "anchor", "floorplan"].forEach((type) => {
      ["p1", "p2", "p_url"].forEach((project_id) => {
        artifactCache.invalidate({ type, id, project_id });
      });
    });
  });
  window.history.replaceState({}, "", "/?project_id=p_url");
});

afterEach(() => {
  cleanup(); // tear down React tree so duplicate testids don't bleed across tests
  vi.useRealTimers();
});

function Probe({
  type,
  id,
  project_id,
  enabled,
}: {
  type: string;
  id: string;
  project_id?: string;
  enabled?: boolean;
}) {
  const a = useArtifact<{ name?: string }>({ type, id, project_id, enabled });
  return (
    <div>
      <span data-testid="status">{a.status}</span>
      <span data-testid="name">{a.data?.name ?? "—"}</span>
      <span data-testid="err">{a.error ?? "—"}</span>
      <button data-testid="refetch" onClick={() => a.refetch()}>
        rf
      </button>
    </div>
  );
}

describe("useArtifact: mount fetch", () => {
  it("returns loading then ready after fetch", async () => {
    callToolMock.mockResolvedValue({
      raw: {},
      data: { bible_id: "loc_p1", name: "Test Bible" },
    });
    render(<Probe type="bible" id="loc_p1" project_id="p1" />);
    // First synchronous render: status=loading
    expect(screen.getByTestId("status").textContent).toBe("loading");
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready"),
    );
    expect(screen.getByTestId("name").textContent).toBe("Test Bible");
    expect(callToolMock).toHaveBeenCalledTimes(1);
    expect(callToolMock).toHaveBeenCalledWith(
      "get_bible",
      expect.objectContaining({ bible_id: "loc_p1", project_id: "p1" }),
    );
  });

  it("does NOT fetch when enabled=false", async () => {
    callToolMock.mockResolvedValue({ raw: {}, data: {} });
    render(<Probe type="bible" id="loc_p1" project_id="p1" enabled={false} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(callToolMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("status").textContent).toBe("idle");
  });
});

describe("useArtifact: cache reuse", () => {
  it("returns cached data without re-fetching within TTL", async () => {
    callToolMock.mockResolvedValue({
      raw: {},
      data: { bible_id: "loc_p1", name: "Cached" },
    });
    const r1 = render(<Probe type="bible" id="loc_p1" project_id="p1" />);
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("ready"),
    );
    expect(callToolMock).toHaveBeenCalledTimes(1);
    r1.unmount();
    // Second mount of same key — within 30 s TTL — should NOT re-fetch.
    render(<Probe type="bible" id="loc_p1" project_id="p1" />);
    // The synchronous first render should already be "ready" (cache hit).
    expect(screen.getByTestId("status").textContent).toBe("ready");
    expect(screen.getByTestId("name").textContent).toBe("Cached");
    // Brief wait to make sure no async fetch was queued.
    await new Promise((r) => setTimeout(r, 30));
    expect(callToolMock).toHaveBeenCalledTimes(1);
  });
});

describe("useArtifact: refetch", () => {
  it("refetch() forces a network call after invalidate", async () => {
    callToolMock
      .mockResolvedValueOnce({ raw: {}, data: { bible_id: "loc_refetch", name: "v1" } })
      .mockResolvedValueOnce({ raw: {}, data: { bible_id: "loc_refetch", name: "v2" } });
    render(<Probe type="bible" id="loc_refetch" project_id="p1" />);
    await waitFor(() => expect(screen.getByTestId("name").textContent).toBe("v1"));
    expect(callToolMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      screen.getByTestId("refetch").click();
    });
    await waitFor(() => expect(screen.getByTestId("name").textContent).toBe("v2"));
    expect(callToolMock).toHaveBeenCalledTimes(2);
  });

  it("external cache invalidate triggers refetch via subscription", async () => {
    callToolMock
      .mockResolvedValueOnce({ raw: {}, data: { bible_id: "loc_p1", name: "first" } })
      .mockResolvedValueOnce({ raw: {}, data: { bible_id: "loc_p1", name: "second" } });
    render(<Probe type="bible" id="loc_p1" project_id="p1" />);
    await waitFor(() => expect(screen.getByTestId("name").textContent).toBe("first"));
    expect(callToolMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      artifactCache.invalidate({ type: "bible", id: "loc_p1", project_id: "p1" });
    });
    await waitFor(() => expect(screen.getByTestId("name").textContent).toBe("second"));
    expect(callToolMock).toHaveBeenCalledTimes(2);
  });
});

describe("useArtifact: error path", () => {
  it("surfaces backend error message on thrown rejection", async () => {
    callToolMock.mockRejectedValue(new Error("MCP HTTP 500"));
    render(<Probe type="bible" id="loc_p1" project_id="p1" />);
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("error"),
    );
    expect(screen.getByTestId("err").textContent).toMatch(/MCP HTTP 500/);
  });

  it("treats { error: 'not_found' } payload as status='missing' (not error)", async () => {
    callToolMock.mockResolvedValue({ raw: {}, data: { error: "not_found" } });
    render(<Probe type="bible" id="loc_unknown" project_id="p1" />);
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("missing"),
    );
    expect(screen.getByTestId("err").textContent).toBe("—"); // null/undefined → "—"
  });
});

describe("useArtifact: project_id scoping", () => {
  it("defaults project_id from URL when not provided in spec", async () => {
    window.history.replaceState({}, "", "/?project_id=p_url");
    callToolMock.mockResolvedValue({
      raw: {},
      data: { bible_id: "loc_p1", name: "URL Bible" },
    });
    render(<Probe type="bible" id="loc_p1" />);
    await waitFor(() => expect(callToolMock).toHaveBeenCalled());
    expect(callToolMock).toHaveBeenCalledWith(
      "get_bible",
      expect.objectContaining({ project_id: "p_url" }),
    );
  });

  it("explicit project_id in spec overrides URL default", async () => {
    window.history.replaceState({}, "", "/?project_id=p_url");
    callToolMock.mockResolvedValue({
      raw: {},
      data: { bible_id: "loc_explicit", name: "Explicit" },
    });
    render(<Probe type="bible" id="loc_explicit" project_id="p2" />);
    await waitFor(() => expect(callToolMock).toHaveBeenCalled());
    expect(callToolMock).toHaveBeenCalledWith(
      "get_bible",
      expect.objectContaining({ project_id: "p2" }),
    );
  });

  it("scopes cache by project_id (same type+id, different project → independent entries)", async () => {
    callToolMock.mockImplementation((_name: string, args: Record<string, unknown>) => {
      return Promise.resolve({
        raw: {},
        data: { bible_id: args.bible_id, name: `bible_${args.project_id}` },
      });
    });
    render(
      <>
        <Probe type="bible" id="loc_p1" project_id="p1" />
        <Probe type="bible" id="loc_p1" project_id="p2" />
      </>,
    );
    // Two distinct fetches — namespaces must NOT collide.
    await waitFor(() => expect(callToolMock).toHaveBeenCalledTimes(2));
    const projectIds = callToolMock.mock.calls.map(
      (c) => (c[1] as Record<string, unknown>).project_id,
    );
    expect(projectIds).toContain("p1");
    expect(projectIds).toContain("p2");
  });
});
