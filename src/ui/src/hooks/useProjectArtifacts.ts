/**
 * useProjectArtifacts — list-with-filter hook (Phase 3a, Variant A).
 *
 * Wraps `list_<type>` MCP calls and adds the result to the artifact cache
 * under a special list key (type=`list:<type>`, id=`*`, project_id). The
 * cache subscriber re-fires the fetch when invalidateType("<type>", pid)
 * is called — pages don't need to know about lists vs items, the cache
 * propagates updates uniformly.
 *
 * project_id is REQUIRED. If the resolved value is empty (URL lacks
 * ?project_id= and no explicit override), the hook returns an error state
 * and does NOT issue the call. This enforces the per-project namespace
 * contract at the hook layer — the same triple-defence model that closes
 * the CD bible-leak (architecture doc §4).
 *
 * Spec: docs/sessions/2026-05-20-state-ownership-refactor/02-architecture.md §4
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { callTool } from "../api/mcp";
import { artifactCache, type CacheStatus } from "../state/artifactCache";
import { useProjectContext } from "./useProjectContext";

export interface UseProjectArtifactsParams {
  type: string;
  /** Defaults to useProjectContext().projectId. Pass to override. */
  project_id?: string;
  enabled?: boolean;
}

export interface UseProjectArtifactsResult<T> {
  status: CacheStatus;
  items: T[];
  error?: string;
  refetch: () => void;
}

/** Internal cache id used for the list slot — collides with no real entity id. */
const LIST_ID = "__list__";

export function useProjectArtifacts<T = unknown>(
  params: UseProjectArtifactsParams,
): UseProjectArtifactsResult<T> {
  const ctx = useProjectContext();
  const resolvedProjectId =
    params.project_id !== undefined ? params.project_id : ctx.projectId;
  const project_id = resolvedProjectId.trim();
  const enabled = params.enabled !== false;
  const { type } = params;
  const cacheKey = { type: `list:${type}`, id: LIST_ID, project_id };

  const [, setTick] = useState(0);
  const reqIdRef = useRef(0);

  // Empty project_id is an error contract — no list_* call should fire.
  // Reporting via the hook return (not throw) lets pages render a banner.
  const isEmptyProject = project_id === "";

  const entry = artifactCache.get(cacheKey);
  const status: CacheStatus = isEmptyProject
    ? "error"
    : (entry?.status ?? "idle");
  const items = ((entry?.data as { items?: T[] } | undefined)?.items ?? []) as T[];
  const error = isEmptyProject
    ? "project_id required: open this view from GeneralUI to scope by project"
    : entry?.error;

  const fetchOnce = useCallback(async (): Promise<void> => {
    if (isEmptyProject) return;
    const myReqId = ++reqIdRef.current;
    artifactCache.set(cacheKey, { status: "loading" });
    try {
      const { data } = await callTool<Record<string, unknown>>(
        `list_${type}s`,
        { project_id },
      );
      if (myReqId !== reqIdRef.current) return;
      artifactCache.set(cacheKey, {
        status: "ready",
        data: (data ?? { items: [] }) as Record<string, unknown>,
        fetchedAt: Date.now(),
      });
    } catch (e: unknown) {
      if (myReqId !== reqIdRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      artifactCache.set(cacheKey, {
        status: "error",
        error: msg,
        fetchedAt: Date.now(),
      });
    }
  }, [type, project_id, isEmptyProject]);

  // Subscribe to direct mutations of the list slot AND to invalidateType
  // for the underlying type (which clears both list-slot and per-item
  // entries — see ArtifactCache.invalidateType).
  useEffect(() => {
    if (isEmptyProject) return;
    const unsubList = artifactCache.subscribe(cacheKey, () => {
      setTick((n) => n + 1);
      // On invalidation (entry removed), refetch.
      const after = artifactCache.get(cacheKey);
      if (after === undefined && enabled) {
        void fetchOnce();
      }
    });
    return unsubList;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, project_id, enabled, isEmptyProject, fetchOnce]);

  // Initial / dep-change fetch.
  useEffect(() => {
    if (!enabled || isEmptyProject) return;
    const current = artifactCache.get(cacheKey);
    if (current?.status === "ready") return; // cache hit, no refetch
    void fetchOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, project_id, enabled, isEmptyProject]);

  return {
    status,
    items,
    error,
    refetch: () => {
      void fetchOnce();
    },
  };
}
