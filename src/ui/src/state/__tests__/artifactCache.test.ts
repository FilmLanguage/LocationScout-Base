/**
 * Unit tests for the observable artifact cache (Phase 3a, Variant A).
 *
 * Contract (from docs/sessions/2026-05-20-state-ownership-refactor/02-architecture.md):
 *  - Keyed by (type, id, project_id) — project_id is REQUIRED, no fallback.
 *  - Entries carry status / data / error / fetchedAt.
 *  - Observer pattern: subscribe(key, listener) → unsubscribe; invoked on set + invalidate.
 *  - invalidateType(type, project_id) clears only matching entries for that project.
 *
 * Mirror cache_invalidation: prevent re-introduction of the namespace bug class
 * (CD 8-leaked-bibles, LS cross-project bleed) at the lowest possible layer.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ArtifactCache,
  artifactCache,
  type CacheEntry,
  type CacheKey,
} from "../artifactCache";

const KEY_A: CacheKey = { type: "bible", id: "loc_p1", project_id: "p1" };
const KEY_B: CacheKey = { type: "bible", id: "loc_p1", project_id: "p2" }; // same type+id, different project
const KEY_C: CacheKey = { type: "anchor", id: "loc_p1", project_id: "p1" }; // same id+project, different type

function ready<T>(data: T): CacheEntry<T> {
  return { status: "ready", data, fetchedAt: Date.now() };
}

describe("ArtifactCache: instantiation + module singleton", () => {
  it("exports a module-level singleton `artifactCache`", () => {
    expect(artifactCache).toBeInstanceOf(ArtifactCache);
  });

  it("each new ArtifactCache() is independent", () => {
    const a = new ArtifactCache();
    const b = new ArtifactCache();
    a.set(KEY_A, ready({ name: "a" }));
    expect(b.get(KEY_A)).toBeUndefined();
  });
});

describe("ArtifactCache: get/set basics", () => {
  let cache: ArtifactCache;
  beforeEach(() => {
    cache = new ArtifactCache();
  });

  it("get returns undefined on empty cache", () => {
    expect(cache.get(KEY_A)).toBeUndefined();
  });

  it("set then get returns the entry", () => {
    const e = ready({ bible_id: "loc_p1", name: "Test" });
    cache.set(KEY_A, e);
    expect(cache.get(KEY_A)).toStrictEqual(e);
  });

  it("set overwrites prior entry for same key (double-set)", () => {
    cache.set(KEY_A, ready({ v: 1 }));
    cache.set(KEY_A, ready({ v: 2 }));
    expect((cache.get(KEY_A)?.data as { v: number }).v).toBe(2);
  });
});

describe("ArtifactCache: project_id scoping", () => {
  let cache: ArtifactCache;
  beforeEach(() => {
    cache = new ArtifactCache();
  });

  it("scopes entries by project_id (same type+id, different project_id do NOT collide)", () => {
    cache.set(KEY_A, ready({ project_id: "p1", name: "p1 bible" }));
    cache.set(KEY_B, ready({ project_id: "p2", name: "p2 bible" }));
    expect((cache.get(KEY_A)?.data as { name: string }).name).toBe("p1 bible");
    expect((cache.get(KEY_B)?.data as { name: string }).name).toBe("p2 bible");
  });

  it("scopes entries by type (same id+project, different type do NOT collide)", () => {
    cache.set(KEY_A, ready({ kind: "bible" }));
    cache.set(KEY_C, ready({ kind: "anchor" }));
    expect((cache.get(KEY_A)?.data as { kind: string }).kind).toBe("bible");
    expect((cache.get(KEY_C)?.data as { kind: string }).kind).toBe("anchor");
  });
});

describe("ArtifactCache: invalidate", () => {
  let cache: ArtifactCache;
  beforeEach(() => {
    cache = new ArtifactCache();
  });

  it("invalidate(key) removes only that entry", () => {
    cache.set(KEY_A, ready({ a: 1 }));
    cache.set(KEY_B, ready({ b: 1 }));
    cache.invalidate(KEY_A);
    expect(cache.get(KEY_A)).toBeUndefined();
    expect(cache.get(KEY_B)).toBeDefined();
  });

  it("invalidate on a missing key is a no-op", () => {
    expect(() => cache.invalidate(KEY_A)).not.toThrow();
  });
});

describe("ArtifactCache: invalidateType", () => {
  let cache: ArtifactCache;
  beforeEach(() => {
    cache = new ArtifactCache();
  });

  it("invalidateType clears only entries of that (type, project_id)", () => {
    cache.set(KEY_A, ready({ a: 1 })); // bible / p1
    cache.set(KEY_B, ready({ b: 1 })); // bible / p2 — DIFFERENT project
    cache.set(KEY_C, ready({ c: 1 })); // anchor / p1 — DIFFERENT type
    cache.invalidateType("bible", "p1");
    expect(cache.get(KEY_A)).toBeUndefined();
    expect(cache.get(KEY_B)).toBeDefined(); // other project untouched
    expect(cache.get(KEY_C)).toBeDefined(); // other type untouched
  });

  it("invalidateType on empty cache is a no-op", () => {
    expect(() => cache.invalidateType("bible", "p1")).not.toThrow();
  });

  it("invalidateType ALSO clears companion `list:<type>` slot for same project", () => {
    // Companion list-slot symmetry: mutating any bible for p1 invalidates
    // p1's bible list (useProjectArtifacts cache key uses type=`list:bible`).
    const listKey: CacheKey = {
      type: "list:bible",
      id: "__list__",
      project_id: "p1",
    };
    cache.set(KEY_A, ready({ a: 1 }));
    cache.set(listKey, ready({ items: [{ bible_id: "x" }] }));
    cache.invalidateType("bible", "p1");
    expect(cache.get(KEY_A)).toBeUndefined();
    expect(cache.get(listKey)).toBeUndefined();
  });
});

describe("ArtifactCache: subscribe / observer pattern", () => {
  let cache: ArtifactCache;
  beforeEach(() => {
    cache = new ArtifactCache();
  });

  it("subscribe listener fires on set for the same key", () => {
    const listener = vi.fn();
    cache.subscribe(KEY_A, listener);
    cache.set(KEY_A, ready({ x: 1 }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("subscribe listener does NOT fire for a different key's set", () => {
    const listener = vi.fn();
    cache.subscribe(KEY_A, listener);
    cache.set(KEY_B, ready({ y: 1 }));
    expect(listener).not.toHaveBeenCalled();
  });

  it("subscribe listener fires on invalidate", () => {
    const listener = vi.fn();
    cache.set(KEY_A, ready({ v: 1 }));
    cache.subscribe(KEY_A, listener);
    cache.invalidate(KEY_A);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("subscribe listener fires on invalidateType for matching entries", () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    cache.set(KEY_A, ready({ a: 1 }));
    cache.set(KEY_B, ready({ b: 1 }));
    cache.subscribe(KEY_A, listenerA);
    cache.subscribe(KEY_B, listenerB);
    cache.invalidateType("bible", "p1");
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).not.toHaveBeenCalled();
  });

  it("subscribe returns an unsubscribe function that prevents further notifications (no leak)", () => {
    const listener = vi.fn();
    const unsubscribe = cache.subscribe(KEY_A, listener);
    cache.set(KEY_A, ready({ v: 1 }));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    cache.set(KEY_A, ready({ v: 2 }));
    expect(listener).toHaveBeenCalledTimes(1); // still 1
  });

  it("multiple subscribers on the same key all fire", () => {
    const a = vi.fn();
    const b = vi.fn();
    cache.subscribe(KEY_A, a);
    cache.subscribe(KEY_A, b);
    cache.set(KEY_A, ready({ v: 1 }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
