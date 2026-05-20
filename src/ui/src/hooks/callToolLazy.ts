/**
 * Lazy resolver for the MCP `callTool` boundary.
 *
 * Hooks (useArtifact / useTask / useProjectArtifacts) call this helper instead
 * of importing `callTool` statically. The helper performs a dynamic
 * `await import("../api/mcp")` per call, which has two important properties:
 *
 *  1. Vitest's `vi.doMock("../api/mcp", ...)` is honoured: subsequent
 *     dynamic imports inside the same test session see the mock factory.
 *     The acceptance suite in `__tests__/state-ownership.test.tsx` relies on
 *     this pattern — it sets `vi.doMock` after `importHooks()` so the mock
 *     applies on the next callTool invocation, not on the hook's import.
 *
 *  2. Module-level singleton state (e.g. the `nextId` counter in api/mcp.ts)
 *     remains intact because the dynamic import returns the cached module
 *     unless a mock replaces it.
 *
 * Production cost is one module-cache hit per call — sub-microsecond. The
 * lazy boundary is the only deviation from the architecture doc's "static
 * imports throughout"; without it the acceptance tests cannot intercept
 * MCP calls from hooks that were imported before the mock was installed.
 */

import type { McpToolResult } from "../api/mcp";

/**
 * Per-call dynamic resolution of the api/mcp module. We do NOT memoize the
 * resolved module across calls — that would cache whatever was in the
 * registry at the moment of the first call, and the state-ownership suite
 * installs `vi.doMock("../api/mcp", ...)` AFTER the hooks are imported but
 * BEFORE the first MCP call fires. Each call goes through the registry so
 * vitest's mock factory has a chance to apply (verified against vitest 3.2
 * behaviour for hoisted vi.mock and post-import vi.doMock).
 *
 * Concurrent calls share a single in-flight `import()` promise to avoid a
 * vitest race where two parallel dynamic imports can resolve to different
 * module instances (one mocked, one not). Once the import resolves, every
 * pending caller awaits the same mcp module and calls its current
 * `callTool`. The shared promise is NOT memoized across calls — only across
 * concurrent ones — so each independent invocation still consults the
 * registry afresh.
 */
let inFlight: Promise<typeof import("../api/mcp")> | null = null;

export async function callToolLazy<T = unknown>(
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult<T>> {
  if (!inFlight) {
    inFlight = import("../api/mcp");
    // Clear the cache as soon as the import settles so the NEXT independent
    // call re-queries the registry — vital for state-ownership tests that
    // install vi.doMock between test cases.
    inFlight.finally(() => {
      inFlight = null;
    });
  }
  const mcp = await inFlight;
  return mcp.callTool<T>(name, args);
}
