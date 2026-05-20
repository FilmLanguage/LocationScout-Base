/**
 * useTask — unified async-task lifecycle hook (Phase 3a, Variant A).
 *
 * Replaces ad-hoc `pollTask` calls scattered across pages. Every async tool
 * follows the same shape: kick off → returns task_id → poll get_task_status
 * → on terminal state, fetch get_task_result and merge.
 *
 * The LS v1.0.41 fix, GENERALIZED: the polling-bug fix from LS Setups
 * Discipline (2026-05-19) was scoped to the `completed` branch in api/mcp.ts
 * `pollTask`. That left 7 sibling agents (CD/AD/ShotGen + others) showing
 * empty payloads on `failed` and `cancelled` because they never called
 * `get_task_result` on those branches either. This hook calls
 * `get_task_result` on EVERY terminal state — completed, failed, cancelled —
 * closing the failure-path artifact-loss class structurally.
 *
 * task_id=null is the "no task" state — idle, no polling. Pages flip the
 * task_id from null → string when they start a task; the hook self-starts.
 *
 * Spec: docs/sessions/2026-05-20-state-ownership-refactor/02-architecture.md §3
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { callTool } from "../api/mcp";

export type TaskStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

export interface UseTaskParams {
  /** When null, the hook stays idle. Flip to a string to begin polling. */
  task_id: string | null;
  pollIntervalMs?: number; // default 1000
  timeoutMs?: number; // default 180000
  onComplete?: (result: TaskResult) => void;
  onFailed?: (error: string) => void;
}

export interface TaskResult {
  status: TaskStatus;
  progress?: number;
  currentStep?: string;
  artifacts?: Array<{ uri: string }>;
  error?: string;
  /** Tool-specific fields surfaced via get_task_result. Kept open-ended so
   *  the merge logic can pass them through to callers (mood_state_ids,
   *  setup_map, etc.). */
  [extra: string]: unknown;
}

export interface UseTaskReturn extends TaskResult {
  cancel: () => void;
}

const DEFAULT_POLL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 180_000;
const TERMINAL: ReadonlySet<TaskStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

/** Shape returned by get_task_status (loose — the backend may add fields). */
interface RawStatus {
  task_id?: string;
  status?: string;
  progress?: number;
  current_step?: string;
  error?: string | null;
  [extra: string]: unknown;
}

export function useTask(params: UseTaskParams): UseTaskReturn {
  const {
    task_id,
    pollIntervalMs = DEFAULT_POLL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onComplete,
    onFailed,
  } = params;

  const [state, setState] = useState<TaskResult>({ status: "idle" });

  // Refs that survive re-renders without re-triggering effects.
  const cancelledRef = useRef(false); // set on cancel() or unmount-with-cleanup
  const startedAtRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  // Each "polling session" gets a monotonic id; stale loops use it to bail
  // when task_id flips or cancel() runs.
  const sessionIdRef = useRef(0);

  // Keep latest callbacks without restarting the polling loop.
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    onFailedRef.current = onFailed;
  }, [onFailed]);

  const fetchTerminalResult = useCallback(
    async (
      tid: string,
      sessionId: number,
      statusSnap: RawStatus,
    ): Promise<void> => {
      try {
        const { data: result } = await callTool<Record<string, unknown>>(
          "get_task_result",
          { task_id: tid },
        );
        if (sessionId !== sessionIdRef.current) return; // stale
        const r = (result ?? {}) as Record<string, unknown>;
        // Snapshot status wins (it was the trigger). Same convention as the
        // existing `pollTask` helper in api/mcp.ts.
        const status = (statusSnap.status as TaskStatus) ?? "completed";
        const merged: TaskResult = {
          ...r,
          status,
          progress: statusSnap.progress,
          currentStep: statusSnap.current_step,
          artifacts: (r.artifacts as Array<{ uri: string }> | undefined) ??
            (statusSnap.artifacts as Array<{ uri: string }> | undefined),
          error: (r.error as string | undefined) ?? statusSnap.error ?? undefined,
        };
        setState(merged);
        if (status === "completed") {
          onCompleteRef.current?.(merged);
        } else if (status === "failed" || status === "cancelled") {
          onFailedRef.current?.(merged.error ?? `task ${status}`);
        }
      } catch (e) {
        if (sessionId !== sessionIdRef.current) return;
        // get_task_result failed — surface what we have from the snapshot
        // so the UI still renders something. Same fallback shape as
        // `pollTask` in api/mcp.ts.
        const status = (statusSnap.status as TaskStatus) ?? "failed";
        const fallback: TaskResult = {
          status,
          progress: statusSnap.progress,
          currentStep: statusSnap.current_step,
          error:
            statusSnap.error ?? (e instanceof Error ? e.message : String(e)),
        };
        setState(fallback);
        if (status === "failed" || status === "cancelled") {
          onFailedRef.current?.(fallback.error ?? `task ${status}`);
        }
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    if (!task_id) return;
    cancelledRef.current = true;
    sessionIdRef.current += 1; // invalidate any in-flight poll
    // Best-effort backend notify — failure here doesn't block UI.
    void callTool("cancel_task", { task_id }).catch(() => {
      /* swallow; UI already stopped polling locally */
    });
  }, [task_id]);

  // Main polling loop.
  useEffect(() => {
    if (!task_id) {
      setState({ status: "idle" });
      return;
    }
    cancelledRef.current = false;
    startedAtRef.current = Date.now();
    const mySessionId = ++sessionIdRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Set initial state so the first render after task_id flip shows "running"
    // before the first poll resolves. Pages otherwise flicker between idle
    // and the first status — kills layout-shift assertions.
    setState({ status: "running" });

    const tick = async (): Promise<void> => {
      if (cancelledRef.current || mySessionId !== sessionIdRef.current) return;
      try {
        const { data } = await callTool<RawStatus>("get_task_status", {
          task_id,
        });
        if (cancelledRef.current || mySessionId !== sessionIdRef.current) return;
        const status = (data?.status ?? "running") as TaskStatus;
        if (TERMINAL.has(status)) {
          await fetchTerminalResult(task_id, mySessionId, data ?? {});
          return;
        }
        // Still running — set state and schedule next poll.
        setState({
          status: "running",
          progress: data?.progress,
          currentStep: data?.current_step,
        });
        if (Date.now() - startedAtRef.current > timeoutMs) {
          setState({
            status: "timeout",
            progress: data?.progress,
            currentStep: data?.current_step,
            error: `task timed out after ${timeoutMs}ms`,
          });
          return;
        }
        timer = setTimeout(() => {
          void tick();
        }, pollIntervalMs);
      } catch (e) {
        if (cancelledRef.current || mySessionId !== sessionIdRef.current) return;
        // Transient poll error — surface and stop. Same conservative posture as
        // existing pollTask. Pages can choose to re-mount the hook to retry.
        setState({
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
        });
        onFailedRef.current?.(e instanceof Error ? e.message : String(e));
      }
    };

    void tick();

    return () => {
      // On dep-change (task_id flip) or unmount, cancel any pending callback.
      // We do NOT call cancel_task — the spec says background tasks survive
      // unmount unless the caller opts into cancelOnUnmount (a Phase 3b
      // refinement; default behavior here matches §3 of the arch doc).
      if (timer) clearTimeout(timer);
      sessionIdRef.current += 1;
    };
  }, [task_id, pollIntervalMs, timeoutMs, fetchTerminalResult]);

  return { ...state, cancel };
}
