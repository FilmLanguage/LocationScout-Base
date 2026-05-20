/**
 * Observable artifact cache (Phase 3a, Variant A).
 *
 * Backend is the source of truth. The UI caches fetched artifacts here so
 * adjacent mounts of the same key are O(1), but the cache NEVER outlives
 * the session and is invalidated on mutation.
 *
 * Cache key is the tuple (type, id, project_id) — `project_id` is REQUIRED
 * to close the cross-project bleed class (CD 8-leaked-bibles, LS tab swap).
 * The triple-defence model (per-project-namespace.md): cache key includes
 * project_id, list_* MCP tools filter by project_id, S3 prefix is
 * project-scoped. This module is layer 1.
 *
 * Observer pattern: subscribe(key, listener) lets React hooks re-render on
 * cache mutations from any caller (e.g. a Regenerate-anchor task's onTerminal
 * → cache.invalidate(anchor key) → useArtifact subscribers refetch).
 *
 * Spec: docs/sessions/2026-05-20-state-ownership-refactor/02-architecture.md
 */

export type CacheStatus = "idle" | "loading" | "ready" | "error" | "missing";

export interface CacheKey {
  type: string;
  id: string;
  project_id: string;
}

export interface CacheEntry<T = unknown> {
  status: CacheStatus;
  data?: T;
  error?: string;
  /** Date.now() at which the entry's `data` was fetched. Used by useArtifact
   *  to decide between cache-hit and background refetch (TTL = 30 s). */
  fetchedAt?: number;
}

export type CacheListener = () => void;

/** Internal key serialization. project_id first so groupings by project_id
 *  are contiguous in the underlying Map's iteration order — minor optimization
 *  but it also makes the `:` delimiter unambiguous (project_id values are
 *  agent-controlled UUID-ish strings, not user input). */
function serializeKey(k: CacheKey): string {
  return `${k.project_id}::${k.type}::${k.id}`;
}

export class ArtifactCache {
  private entries = new Map<string, CacheEntry>();
  /** Per-key listener sets. We use one Set per key (created lazily) so
   *  unsubscribe is O(1) and we don't grow a fat global listener list. */
  private listeners = new Map<string, Set<CacheListener>>();

  get<T = unknown>(key: CacheKey): CacheEntry<T> | undefined {
    return this.entries.get(serializeKey(key)) as CacheEntry<T> | undefined;
  }

  set<T = unknown>(key: CacheKey, entry: CacheEntry<T>): void {
    const k = serializeKey(key);
    this.entries.set(k, entry as CacheEntry);
    this.notify(k);
  }

  invalidate(key: CacheKey): void {
    const k = serializeKey(key);
    const had = this.entries.delete(k);
    if (had) this.notify(k);
  }

  /**
   * Clear all entries matching (type, project_id). Used after a list mutation
   * (e.g. a new bible was written) to force `useProjectArtifacts` to refetch.
   *
   * Also clears the companion list slot `list:<type>` for the same project
   * so list-rendering hooks pick up the mutation without callers needing to
   * know about the internal list-slot naming. This is the load-bearing
   * symmetry that closes the CD bible-leak class — mutating ANY bible for
   * project_a invalidates project_a's bible list, and ONLY project_a's.
   *
   * Does NOT touch other projects or other types — the project_id scope is
   * the load-bearing invariant.
   */
  invalidateType(type: string, project_id: string): void {
    const prefixes = [
      `${project_id}::${type}::`,
      // Companion list slot. Safe even when `type` already begins with
      // "list:" because the resulting `list:list:foo` prefix simply won't
      // match anything in practice.
      `${project_id}::list:${type}::`,
    ];
    const toClear: string[] = [];
    for (const k of this.entries.keys()) {
      if (prefixes.some((p) => k.startsWith(p))) toClear.push(k);
    }
    for (const k of toClear) {
      this.entries.delete(k);
      this.notify(k);
    }
  }

  /**
   * Register a listener for cache mutations at a specific key. Returns an
   * unsubscribe function. Memory hygiene: the listener Set is dropped from
   * the map when its last subscriber unsubscribes.
   */
  subscribe(key: CacheKey, listener: CacheListener): () => void {
    const k = serializeKey(key);
    let set = this.listeners.get(k);
    if (!set) {
      set = new Set();
      this.listeners.set(k, set);
    }
    set.add(listener);
    return () => {
      const current = this.listeners.get(k);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(k);
    };
  }

  /** Internal: fire all listeners for a key. Errors in listeners are isolated
   *  so a single buggy subscriber can't break the rest. */
  private notify(k: string): void {
    const set = this.listeners.get(k);
    if (!set) return;
    for (const l of set) {
      try {
        l();
      } catch {
        /* swallow — a broken listener should not corrupt cache notifications */
      }
    }
  }
}

/** Module-level singleton. Hooks default to this; tests can instantiate
 *  a fresh ArtifactCache() to avoid cross-test pollution. */
export const artifactCache = new ArtifactCache();

/**
 * Seed the singleton cache with a known entry. Intended for tests that need
 * to prime cache state (e.g. simulate a stale entry that should trigger a
 * background refetch under the cache-stale-refetch acceptance contract). Not
 * used by production code — pages MUST go through `useArtifact` so the cache
 * + subscriber invariants stay intact.
 *
 * Spec: state-ownership.test.tsx ("cache-stale-refetch") expects this helper
 * to exist; the implementation is a trivial pass-through.
 */
export function seed<T>(key: CacheKey, entry: CacheEntry<T>): void {
  artifactCache.set<T>(key, entry);
}

// ─── React Context wrapper (forward-compatible, Phase 3a) ──────────────────
//
// The architecture doc (§2) calls for a `<PipelineContext>`-style provider so
// future variants can swap in a per-tree cache instead of the singleton.
// Today the singleton is canonical — the Provider is a pass-through that
// exists so consumers can write `<ArtifactCacheProvider>…</ArtifactCacheProvider>`
// without breaking once we tighten it.
//
// Importing React at the top of the file would force every consumer of
// ArtifactCache (incl. backend test setup) to load React. We deliberately
// import the React types lazily via a dynamic `import("react")` would not
// work for the type-side, so we accept the small cost of importing React
// from the same place hooks use it. Module sits under `src/ui/src/state/`
// which is jsdom/browser-only territory.

import { createContext, useContext, useMemo, type ReactNode, createElement } from "react";

const ArtifactCacheContext = createContext<ArtifactCache>(artifactCache);

export interface ArtifactCacheProviderProps {
  /** Optional override for tests / nested scopes. When supplied, used as-is;
   *  when omitted, the Provider creates its own per-mount cache. */
  cache?: ArtifactCache;
  children: ReactNode;
}

/**
 * Provider that hosts a per-mount ArtifactCache. Production apps wrap their
 * root subtree once (so the whole UI shares cache state); tests wrap each
 * `render()` separately and so get fresh, isolated caches automatically.
 *
 * If `cache` prop is supplied, that instance is used verbatim — escape hatch
 * for tests that want to inspect cache state across a render boundary.
 */
export function ArtifactCacheProvider(
  props: ArtifactCacheProviderProps,
): ReturnType<typeof createElement> {
  // useMemo with an empty dep list pins this cache instance to the Provider's
  // lifetime — remounting the Provider gives a fresh cache, which is the test-
  // isolation behaviour the state-ownership acceptance tests rely on.
  const owned = useMemo(() => new ArtifactCache(), []);
  const cache = props.cache ?? owned;
  return createElement(
    ArtifactCacheContext.Provider,
    { value: cache },
    props.children,
  );
}

/** Hook accessor — returns the contextual ArtifactCache. Outside any
 *  Provider, falls back to the module singleton so legacy code paths and
 *  unit tests that bypass the provider still resolve to a valid cache. */
export function useArtifactCache(): ArtifactCache {
  return useContext(ArtifactCacheContext);
}
