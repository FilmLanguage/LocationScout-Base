/**
 * MCP resource cache — LRU with TTL for inter-agent reads.
 *
 * Used by consumer agents to avoid repeated MCP reads within a single
 * tool call or across rapid successive calls for the same artifact.
 *
 * Key: full `agent://` URI string.
 * TTL: 30 seconds (artifacts change infrequently within a session).
 * Max entries: 200 (covers ~20 characters × 10 artifact types).
 *
 * Invalidation: call `invalidateCache(uri)` when you know an artifact
 * has changed (e.g. after receiving a bible_saved event from v2.events).
 * Or let entries expire naturally via TTL.
 */

const TTL_MS = 30_000;
const MAX_ENTRIES = 200;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  uri: string;
}

// Insertion-ordered Map for LRU eviction (oldest first)
const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get a cached value by URI. Returns null if missing or expired.
 */
export function getCached<T>(uri: string): T | null {
  const entry = cache.get(uri);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(uri);
    return null;
  }
  // LRU: re-insert to move to end (most recently used)
  cache.delete(uri);
  cache.set(uri, entry);
  return entry.value as T;
}

/**
 * Store a value in the cache.
 */
export function setCached<T>(uri: string, value: T): void {
  // Evict LRU entry if at capacity
  if (cache.size >= MAX_ENTRIES && !cache.has(uri)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(uri, { value, expiresAt: Date.now() + TTL_MS, uri });
}

/**
 * Invalidate a specific URI. Call when you know the artifact changed.
 */
export function invalidateCache(uri: string): void {
  cache.delete(uri);
}

/**
 * Invalidate all entries matching a prefix.
 * Useful for project-level invalidation: invalidateCachePrefix("agent://location-scout/bible/loc_001")
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/**
 * Get cache stats for debugging / health endpoint.
 */
export function getCacheStats(): { size: number; maxEntries: number; ttlMs: number } {
  return { size: cache.size, maxEntries: MAX_ENTRIES, ttlMs: TTL_MS };
}

/**
 * Clear the entire cache (e.g. on agent restart or test teardown).
 */
export function clearCache(): void {
  cache.clear();
}
