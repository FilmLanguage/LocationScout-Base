/**
 * Acceptance tests for the pollTask polling-bug fix.
 *
 * Bug (LS Setups Discipline, 2026-05-19): pollTask returned the
 * get_task_status snapshot on completion. That snapshot has no `artifacts`
 * field — only get_task_result does. So callers downstream always saw
 * `artifacts: undefined`, surfaced backend's `current_step` ("3 setups
 * extracted") as the error message, and painted a successful run as red.
 *
 * Fix: on `status === "completed"`, pollTask now calls get_task_result
 * and merges the result fields (artifacts, mood_state_ids, etc.) onto
 * the status snapshot before returning.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Module under test imports DOM-free fetch via global.fetch. We mock fetch
// to return SSE-shaped JSON envelopes mirroring the StreamableHTTP transport.
import { pollTask } from "./mcp";

function sse(payload: unknown) {
  const envelope = {
    jsonrpc: "2.0",
    id: 0,
    result: {
      content: [{ type: "text", text: JSON.stringify(payload) }],
    },
  };
  return `event: message\ndata: ${JSON.stringify(envelope)}\n\n`;
}

interface FetchCall {
  method: string;
  body: { params: { name: string; arguments: Record<string, unknown> } };
}

function setupFetchSequence(responses: unknown[]) {
  const calls: FetchCall[] = [];
  const queue = [...responses];
  globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ method: body.method, body });
    const next = queue.shift();
    if (next === undefined) throw new Error("Unexpected fetch (queue empty)");
    return {
      ok: true,
      status: 200,
      text: async () => sse(next),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return calls;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pollTask — Test G (polling bug fix)", () => {
  it("on completed status, calls get_task_result and merges artifacts onto the returned object", async () => {
    const calls = setupFetchSequence([
      // first poll: completed status snapshot, no artifacts
      {
        task_id: "t1",
        status: "completed",
        progress: 1,
        current_step: "3 setups extracted",
        error: null,
      },
      // get_task_result follow-up: returns artifacts
      {
        task_id: "t1",
        status: "completed",
        artifacts: [
          { uri: "agent://location-scout/setup/setup_001" },
          { uri: "agent://location-scout/setup/setup_002" },
          { uri: "agent://location-scout/setup/setup_003" },
        ],
        error: null,
      },
    ]);

    const final = await pollTask("t1", undefined, 10, 5000);

    // The merged final result must carry artifacts now — this is the
    // contract the UI relies on to render success instead of red error.
    expect((final as { artifacts?: unknown[] }).artifacts).toHaveLength(3);
    expect(final.status).toBe("completed");
    // Backend's friendly current_step should still come through
    expect(final.current_step).toBe("3 setups extracted");

    // pollTask must have called both tools, in order.
    expect(calls[0].body.params.name).toBe("get_task_status");
    expect(calls[1].body.params.name).toBe("get_task_result");
    expect(calls[1].body.params.arguments.task_id).toBe("t1");
  });

  it("on failed status, still fetches get_task_result to backfill the error (regression guard)", async () => {
    const calls = setupFetchSequence([
      { task_id: "t2", status: "failed", progress: 0.5, current_step: "LLM failure", error: null },
      { task_id: "t2", status: "failed", artifacts: [], error: "Bible may lack spatial detail. Regenerate with richer scene descriptions." },
    ]);

    const final = await pollTask("t2", undefined, 10, 5000);
    expect(final.status).toBe("failed");
    expect(final.error).toMatch(/Bible may lack spatial detail/);
    expect(calls[0].body.params.name).toBe("get_task_status");
    expect(calls[1].body.params.name).toBe("get_task_result");
  });

  it("does not call get_task_result while task is still processing", async () => {
    const calls = setupFetchSequence([
      { task_id: "t3", status: "processing", progress: 0.4, current_step: "Generating setup plan via LLM", error: null },
      { task_id: "t3", status: "completed", progress: 1, current_step: "done", error: null },
      { task_id: "t3", status: "completed", artifacts: [{ uri: "agent://x/y/z" }], error: null },
    ]);

    const final = await pollTask("t3", undefined, 5, 5000);
    expect(final.status).toBe("completed");
    // 2 status polls + 1 result fetch. The first poll (processing) must NOT
    // have triggered a get_task_result call.
    const resultCalls = calls.filter((c) => c.body.params.name === "get_task_result");
    expect(resultCalls).toHaveLength(1);
    const statusCalls = calls.filter((c) => c.body.params.name === "get_task_status");
    expect(statusCalls).toHaveLength(2);
  });
});
