/**
 * Unit tests for useTask (Phase 3a, Variant A).
 *
 * Contract (docs/sessions/2026-05-20-state-ownership-refactor/02-architecture.md §3):
 *  - task_id=null → status="idle", no polling.
 *  - task_id=string → poll get_task_status every pollIntervalMs (default 1000).
 *  - On EITHER "completed" OR "failed" OR "cancelled" → fire get_task_result
 *    ONCE and merge artifacts + error into the returned shape. This is the
 *    LS v1.0.41 fix GENERALIZED to all terminal states.
 *  - Timeout → status="timeout", surfaces last seen current_step.
 *  - cancel() → calls cancel_task and stops polling.
 *  - onComplete fires once on success, onFailed fires once on failure.
 *
 * Vitest fake timers drive the polling loop; promise micro-tasks are flushed
 * with `await Promise.resolve()` blocks where appropriate.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import React from "react";

const callToolMock = vi.hoisted(() => vi.fn());
vi.mock("../../api/mcp", () => ({
  callTool: callToolMock,
  pollTask: vi.fn(),
}));

import { useTask } from "../useTask";

beforeEach(() => {
  callToolMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Probe(props: {
  taskId: string | null;
  onComplete?: (r: unknown) => void;
  onFailed?: (e: string) => void;
  pollIntervalMs?: number;
  timeoutMs?: number;
  exposeCancel?: (fn: () => void) => void;
}) {
  const t = useTask({
    task_id: props.taskId,
    onComplete: props.onComplete,
    onFailed: props.onFailed,
    pollIntervalMs: props.pollIntervalMs,
    timeoutMs: props.timeoutMs,
  });
  React.useEffect(() => {
    props.exposeCancel?.(t.cancel);
  }, [t.cancel]);
  return (
    <div>
      <span data-testid="status">{t.status}</span>
      <span data-testid="artifacts">{t.artifacts?.length ?? -1}</span>
      <span data-testid="error">{t.error ?? "—"}</span>
      <span data-testid="step">{t.currentStep ?? "—"}</span>
    </div>
  );
}

describe("useTask: idle when task_id is null", () => {
  it("does NOT poll while task_id is null", async () => {
    render(<Probe taskId={null} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(callToolMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("status").textContent).toBe("idle");
  });
});

describe("useTask: terminal=completed merges get_task_result", () => {
  it("returns artifacts on completion via get_task_result (LS v1.0.41 fix)", async () => {
    callToolMock.mockImplementation((name: string) => {
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
    render(<Probe taskId="t1" pollIntervalMs={20} />);
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("completed"),
    );
    expect(screen.getByTestId("artifacts").textContent).toBe("3");
    expect(screen.getByTestId("error").textContent).toBe("—");
  });
});

describe("useTask: terminal=failed merges get_task_result", () => {
  it("returns backend error on failure via get_task_result", async () => {
    callToolMock.mockImplementation((name: string) => {
      if (name === "get_task_status") {
        return Promise.resolve({
          raw: {},
          data: {
            task_id: "t1",
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
    render(<Probe taskId="t1" pollIntervalMs={20} />);
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("failed"),
    );
    expect(screen.getByTestId("error").textContent).toBe("upstream brief missing");
  });
});

describe("useTask: terminal=cancelled merges get_task_result", () => {
  it("returns backend error on cancelled via get_task_result", async () => {
    callToolMock.mockImplementation((name: string) => {
      if (name === "get_task_status") {
        return Promise.resolve({
          raw: {},
          data: {
            task_id: "t1",
            status: "cancelled",
            progress: 0.3,
            current_step: "cancelled by user",
          },
        });
      }
      if (name === "get_task_result") {
        return Promise.resolve({
          raw: {},
          data: {
            status: "cancelled",
            error: "task cancelled by user",
          },
        });
      }
      return Promise.resolve({ raw: {}, data: {} });
    });
    render(<Probe taskId="t1" pollIntervalMs={20} />);
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("cancelled"),
    );
    expect(screen.getByTestId("error").textContent).toBe("task cancelled by user");
  });
});

describe("useTask: timeout", () => {
  it("returns timeout state when polling exceeds timeoutMs", async () => {
    callToolMock.mockResolvedValue({
      raw: {},
      data: {
        task_id: "t1",
        status: "running",
        progress: 0.5,
        current_step: "still going",
      },
    });
    render(<Probe taskId="t1" pollIntervalMs={20} timeoutMs={60} />);
    await waitFor(
      () => expect(screen.getByTestId("status").textContent).toBe("timeout"),
      { timeout: 500 },
    );
    expect(screen.getByTestId("step").textContent).toBe("still going");
  });
});

describe("useTask: cancel()", () => {
  it("stops polling on cancel() and calls cancel_task", async () => {
    callToolMock.mockImplementation((name: string) => {
      if (name === "get_task_status") {
        return Promise.resolve({
          raw: {},
          data: { status: "running", progress: 0.5, current_step: "running" },
        });
      }
      if (name === "cancel_task") {
        return Promise.resolve({ raw: {}, data: { ok: true } });
      }
      return Promise.resolve({ raw: {}, data: {} });
    });
    let cancelFn: (() => void) | null = null;
    render(
      <Probe
        taskId="t1"
        pollIntervalMs={15}
        exposeCancel={(fn) => {
          cancelFn = fn;
        }}
      />,
    );
    // Let polling happen a few times.
    await waitFor(() =>
      expect(
        callToolMock.mock.calls.filter((c) => c[0] === "get_task_status").length,
      ).toBeGreaterThanOrEqual(2),
    );
    await act(async () => {
      cancelFn?.();
    });
    const callsAtCancel = callToolMock.mock.calls.filter(
      (c) => c[0] === "get_task_status",
    ).length;
    expect(callToolMock).toHaveBeenCalledWith(
      "cancel_task",
      expect.objectContaining({ task_id: "t1" }),
    );
    // After cancel: give time, assert no further get_task_status calls.
    await new Promise((r) => setTimeout(r, 60));
    const callsAfter = callToolMock.mock.calls.filter(
      (c) => c[0] === "get_task_status",
    ).length;
    expect(callsAfter).toBe(callsAtCancel);
  });
});

describe("useTask: callbacks fire once at terminal", () => {
  it("onComplete fires once with result", async () => {
    callToolMock.mockImplementation((name: string) => {
      if (name === "get_task_status") {
        return Promise.resolve({
          raw: {},
          data: { status: "completed", progress: 1, current_step: "ok" },
        });
      }
      if (name === "get_task_result") {
        return Promise.resolve({
          raw: {},
          data: { status: "completed", artifacts: [{ uri: "x" }] },
        });
      }
      return Promise.resolve({ raw: {}, data: {} });
    });
    const onComplete = vi.fn();
    render(<Probe taskId="t1" pollIntervalMs={20} onComplete={onComplete} />);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    // Verify it stays at 1 even with extra ticks.
    await new Promise((r) => setTimeout(r, 50));
    expect(onComplete).toHaveBeenCalledTimes(1);
    const arg = onComplete.mock.calls[0][0] as { artifacts: unknown[] };
    expect(arg.artifacts).toHaveLength(1);
  });

  it("onFailed fires once with error", async () => {
    callToolMock.mockImplementation((name: string) => {
      if (name === "get_task_status") {
        return Promise.resolve({
          raw: {},
          data: { status: "failed", progress: 0.7, current_step: "bad" },
        });
      }
      if (name === "get_task_result") {
        return Promise.resolve({
          raw: {},
          data: { status: "failed", error: "boom" },
        });
      }
      return Promise.resolve({ raw: {}, data: {} });
    });
    const onFailed = vi.fn();
    render(<Probe taskId="t1" pollIntervalMs={20} onFailed={onFailed} />);
    await waitFor(() => expect(onFailed).toHaveBeenCalledTimes(1));
    expect(onFailed).toHaveBeenCalledWith("boom");
    await new Promise((r) => setTimeout(r, 50));
    expect(onFailed).toHaveBeenCalledTimes(1);
  });
});

describe("useTask: lifecycle transitions", () => {
  it("transitions running → completed without flicker (no premature completion)", async () => {
    let pollCount = 0;
    callToolMock.mockImplementation((name: string) => {
      if (name === "get_task_status") {
        pollCount += 1;
        if (pollCount < 2) {
          return Promise.resolve({
            raw: {},
            data: { status: "running", progress: 0.3, current_step: "step 1" },
          });
        }
        return Promise.resolve({
          raw: {},
          data: { status: "completed", progress: 1, current_step: "done" },
        });
      }
      if (name === "get_task_result") {
        return Promise.resolve({
          raw: {},
          data: { status: "completed", artifacts: [{ uri: "y" }] },
        });
      }
      return Promise.resolve({ raw: {}, data: {} });
    });
    render(<Probe taskId="t1" pollIntervalMs={15} />);
    // running first
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("running"),
    );
    // then completed
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("completed"),
    );
    expect(screen.getByTestId("artifacts").textContent).toBe("1");
  });

  it("transitions to running on first poll when task_id is set after mount", async () => {
    callToolMock.mockResolvedValue({
      raw: {},
      data: { status: "running", progress: 0.1, current_step: "starting" },
    });
    // Start with null, then set
    function Wrapper() {
      const [id, setId] = React.useState<string | null>(null);
      return (
        <>
          <Probe taskId={id} pollIntervalMs={15} />
          <button data-testid="start" onClick={() => setId("t1")}>
            start
          </button>
        </>
      );
    }
    render(<Wrapper />);
    expect(screen.getByTestId("status").textContent).toBe("idle");
    await act(async () => {
      screen.getByTestId("start").click();
    });
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("running"),
    );
  });
});
