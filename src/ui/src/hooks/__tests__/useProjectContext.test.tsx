/**
 * Unit tests for useProjectContext (Bug 1, Wave 2 — 2026-05-22).
 *
 * Contract (docs/canonical/per-project-namespace.md):
 *   - `project_id` is REQUIRED, not optional. Missing URL param must NOT
 *     silently substitute "default-project" (the root cause of the
 *     loc_default-project leak that hit production on 2026-05-21).
 *   - When ?project_id= is present: return it verbatim + derive
 *     locationId = explicit ?location_id= OR `loc_${projectId}`.
 *   - When ?project_id= is missing: return projectId="" and locationId="";
 *     `projectIdReady=false` lets callers render an error banner instead of
 *     silently writing to "default-project".
 *
 * The empty-string approach (rather than throwing) is the least-invasive
 * shape given the many existing call sites that already destructure
 * { projectId, locationId } from the hook. Backend MCP auto-injection
 * (api/mcp.ts) skips empty strings so the request reaches the server
 * unstamped, where the storage layer will return null (clean error) rather
 * than picking up another project's artifacts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useProjectContext } from "../useProjectContext";

beforeEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("useProjectContext: project_id present", () => {
  it("returns the projectId verbatim from ?project_id=", () => {
    window.history.replaceState({}, "", "/?project_id=my-project-123");
    const { result } = renderHook(() => useProjectContext());
    expect(result.current.projectId).toBe("my-project-123");
    expect(result.current.projectIdReady).toBe(true);
  });

  it("trims whitespace around the URL param", () => {
    window.history.replaceState({}, "", "/?project_id=%20foo%20");
    const { result } = renderHook(() => useProjectContext());
    expect(result.current.projectId).toBe("foo");
    expect(result.current.projectIdReady).toBe(true);
  });

  it("derives locationId as `loc_${projectId}` when no explicit ?location_id=", () => {
    window.history.replaceState({}, "", "/?project_id=foo");
    const { result } = renderHook(() => useProjectContext());
    expect(result.current.locationId).toBe("loc_foo");
  });

  it("uses explicit ?location_id= URL param when given (overrides derivation)", () => {
    window.history.replaceState({}, "", "/?project_id=foo&location_id=loc_999");
    const { result } = renderHook(() => useProjectContext());
    expect(result.current.locationId).toBe("loc_999");
  });

  it("exposes sceneId and shotId from URL", () => {
    window.history.replaceState({}, "", "/?project_id=foo&scene_id=S1&shot_id=SH-1");
    const { result } = renderHook(() => useProjectContext());
    expect(result.current.sceneId).toBe("S1");
    expect(result.current.shotId).toBe("SH-1");
  });
});

describe("useProjectContext: project_id missing (the bug case)", () => {
  it("returns empty projectId — NOT 'default-project' — when URL param absent", () => {
    window.history.replaceState({}, "", "/?location_id=loc_001");
    const { result } = renderHook(() => useProjectContext());
    expect(result.current.projectId).toBe("");
    expect(result.current.projectId).not.toBe("default-project");
    expect(result.current.projectIdReady).toBe(false);
  });

  it("returns empty locationId when projectId missing AND no explicit ?location_id=", () => {
    window.history.replaceState({}, "", "/");
    const { result } = renderHook(() => useProjectContext());
    // Without projectId we MUST NOT derive `loc_` (broken) or
    // `loc_default-project` (leaks). Empty signals "not ready" to callers.
    expect(result.current.locationId).toBe("");
    expect(result.current.locationId).not.toBe("loc_default-project");
    expect(result.current.locationId).not.toBe("loc_");
  });

  it("still honors explicit ?location_id= even when projectId missing", () => {
    // Edge case: legacy URLs without project_id but with location_id should
    // still surface the location_id so the caller can decide what to do.
    // projectIdReady stays false so the caller can still flag the error.
    window.history.replaceState({}, "", "/?location_id=loc_999");
    const { result } = renderHook(() => useProjectContext());
    expect(result.current.locationId).toBe("loc_999");
    expect(result.current.projectIdReady).toBe(false);
  });

  it("treats whitespace-only ?project_id= as missing", () => {
    window.history.replaceState({}, "", "/?project_id=%20%20");
    const { result } = renderHook(() => useProjectContext());
    expect(result.current.projectId).toBe("");
    expect(result.current.projectIdReady).toBe(false);
  });
});
