/**
 * useArtifact — canonical single-artifact fetch hook (Phase 3a, Variant A).
 *
 * Every artifact-rendering component reads through this hook. The backend is
 * the source of truth; the UI never holds canonical artifact state.
 *
 * Mechanics:
 *  1. On mount + on (type, id, project_id) change: consult artifactCache.
 *     - Cache hit with fetchedAt < 30 s old → return cached, NO network.
 *     - Cache miss or stale → fire callTool("get_<type>", { <type>_id, project_id }).
 *  2. 404 / `{ error: "not_found" }` payload → status="missing" (distinguishes
 *     "doesn't exist yet" from "backend errored").
 *  3. Subscribes to artifactCache so external invalidate (e.g. from useTask's
 *     onTerminal after a Regenerate) triggers a re-render + refetch.
 *  4. refetch() forces a network call regardless of TTL.
 *
 * project_id resolution: explicit `spec.project_id` wins; otherwise the URL's
 * `?project_id=` via useProjectContext. The URL is the per-project namespace
 * carrier (docs/canonical/per-project-namespace.md).
 *
 * Spec: docs/sessions/2026-05-20-state-ownership-refactor/02-architecture.md §2
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { callTool } from "../api/mcp";
import {
  artifactCache,
  type CacheEntry,
  type CacheStatus,
} from "../state/artifactCache";
import { useProjectContext } from "./useProjectContext";

/** Stale-after duration. Tab return / explicit refetch supersedes this. */
const CACHE_TTL_MS = 30_000;

export interface UseArtifactSpec {
  type: string;
  id: string;
  /** Defaults to useProjectContext().projectId. Pass to override. */
  project_id?: string;
  /** When false, skip the fetch. Status stays "idle". Default true. */
  enabled?: boolean;
}

export interface UseArtifactResult<T> {
  status: CacheStatus;
  data?: T;
  error?: string;
  refetch: () => void;
}

export function useArtifact<T = unknown>(
  spec: UseArtifactSpec,
): UseArtifactResult<T> {
  const ctx = useProjectContext();
  const project_id = (spec.project_id ?? ctx.projectId).trim();
  const enabled = spec.enabled !== false;
  const { type, id } = spec;
  const key = { type, id, project_id };

  // We don't store data in component state — the cache IS our state. We
  // bump this counter to force a re-render whenever the cache notifies us.
  const [, setTick] = useState(0);
  const reqIdRef = useRef(0); // monotonic — guards against out-of-order fetches

  // Read latest cache snapshot. Returning a literal idle entry when no entry
  // exists keeps consumers' typeof checks simple.
  const entry = artifactCache.get<T>(key) ?? ({ status: "idle" } as CacheEntry<T>);

  const fetchOnce = useCallback(async (): Promise<void> => {
    const myReqId = ++reqIdRef.current;
    artifactCache.set<T>(key, { status: "loading" });
    try {
      const { data } = await callTool<Record<string, unknown>>(
        `get_${type}`,
        { [`${type}_id`]: id, project_id },
      );
      // Out-of-order guard: a later refetch began before we resolved → drop.
      if (myReqId !== reqIdRef.current) return;
      if (data && typeof data === "object" && (data as { error?: string }).error === "not_found") {
        artifactCache.set<T>(key, {
          status: "missing",
          data: undefined,
          fetchedAt: Date.now(),
        });
        return;
      }
      artifactCache.set<T>(key, {
        status: "ready",
        data: data as T,
        fetchedAt: Date.now(),
      });
    } catch (e: unknown) {
      if (myReqId !== reqIdRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      artifactCache.set<T>(key, {
        status: "error",
        error: msg,
        fetchedAt: Date.now(),
      });
    }
  }, [type, id, project_id]);

  // Subscribe to cache mutations for this key (set / invalidate from anywhere).
  // On invalidate (entry removed), trigger a refetch — this is how external
  // mutations (e.g. useTask.onTerminal after Regenerate) cascade into a refresh
  // here. setTick forces a re-render so the caller reads the new entry.
  useEffect(() => {
    const unsub = artifactCache.subscribe(key, () => {
      setTick((n) => n + 1);
      // Only refetch on full removal (invalidate); a `set` to "loading" /
      // "ready" / "missing" / "error" leaves an entry present and is the
      // result of fetchOnce itself — refetching here would loop forever.
      const after = artifactCache.get(key);
      if (after === undefined && enabled && id) {
        void fetchOnce();
      }
    });
    return unsub;
    // key is a fresh object each render but the underlying string is stable
    // for (type, id, project_id); subscribe internally serializes to that
    // string, so listing the three components covers identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id, project_id, enabled, fetchOnce]);

  // Mount + (type/id/project_id) change effect: decide cache-hit vs fetch.
  useEffect(() => {
    if (!enabled || !id) return;
    const current = artifactCache.get<T>(key);
    const fresh =
      current?.status === "ready" &&
      current.fetchedAt !== undefined &&
      Date.now() - current.fetchedAt < CACHE_TTL_MS;
    if (fresh) return; // cache hit, do nothing
    void fetchOnce();
    // Same intentional dep list as the subscribe effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id, project_id, enabled]);

  return {
    status: entry.status,
    data: entry.data,
    error: entry.error,
    refetch: () => {
      void fetchOnce();
    },
  };
}
