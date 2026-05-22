/**
 * Per-project URL → identity hook.
 *
 * The agent receives `project_id`, `scene_id`, `shot_id` (and optionally
 * `location_id`) on the URL query string. Every page used to hard-code
 * `LOCATION_ID = "loc_001"`, which silently collapsed every project to a
 * single global slot and caused cross-project artifact collisions in S3 +
 * UI bleed-through between sessions.
 *
 * This hook is the single source of truth for those identifiers in the UI.
 * `locationId` defaults to a deterministic `loc_${projectId}` so a fresh
 * project gets a fresh artifact namespace; an explicit `?location_id=` on
 * the URL overrides that derivation.
 *
 * No React state — the URL doesn't mutate during a session in the current
 * flows, so we just read once per render. If we ever add multi-location
 * navigation we'll wire this through `useSearchParams` from react-router.
 *
 * Wave 2 / Bug 1 (2026-05-22): the previous implementation silently
 * substituted FALLBACK_PROJECT_ID="default-project" when ?project_id= was
 * missing from the URL. That derived `locationId` as `loc_default-project`,
 * which leaked all projects into a single global artifact namespace and
 * surfaced the user-visible
 *   "Location Bible not found: agent://location-scout/bible/loc_default-project"
 * error when the embedding URL forgot the param.
 *
 * The fix returns `projectId: ""` + `projectIdReady: false` so callers can
 * branch on readiness instead of silently writing to a shared slot. The
 * MCP wrapper (api/mcp.ts) skips auto-injection of an empty string, so the
 * request reaches the server unstamped — the backend's storage layer then
 * returns null (a clean "not found") rather than picking up another
 * project's artifacts.
 *
 * Spec: docs/sessions/2026-05-21-wave2/bug-1-audit.md +
 *       docs/canonical/per-project-namespace.md
 */

export interface ProjectContext {
  projectId: string;
  sceneId: string | null;
  shotId: string | null;
  /**
   * Derived location id. Either the explicit `?location_id=` URL param or
   * `loc_${projectId}` when a projectId is present. Empty string when both
   * are missing — callers must guard on `projectIdReady` before threading
   * this value into storage / MCP calls.
   */
  locationId: string;
  /**
   * `true` when `?project_id=` was present (and non-blank). `false` signals
   * "URL is missing the namespace marker" — callers should render an error
   * banner / inert UI instead of silently writing to a shared slot.
   */
  projectIdReady: boolean;
}

export function useProjectContext(): ProjectContext {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const rawProjectId = params.get("project_id") ?? "";
  const projectId = rawProjectId.trim();
  const projectIdReady = projectId.length > 0;
  const sceneId = params.get("scene_id");
  const shotId = params.get("shot_id");
  const explicitLocationId = params.get("location_id");
  // Without a projectId we must NOT derive `loc_` (broken) or
  // `loc_default-project` (the pre-fix leak). Honour an explicit
  // ?location_id= even when projectId missing so legacy URLs still surface
  // an identifier; the caller still sees projectIdReady=false and can flag
  // the missing param.
  const trimmedLocation = explicitLocationId?.trim() ?? "";
  const locationId = trimmedLocation
    ? trimmedLocation
    : projectIdReady
      ? `loc_${projectId}`
      : "";
  return { projectId, sceneId, shotId, locationId, projectIdReady };
}

/**
 * Build an /artifacts/<type>/<id>.<ext> URL scoped to the current project.
 * Appending `?project_id=…` tells the backend HTTP route to namespace the
 * storage lookup; without it, the route falls back to legacy un-namespaced
 * paths, which would surface another project's data.
 */
export function buildArtifactUrl(
  type: string,
  filename: string,
  projectId: string,
  cacheBust?: string | number,
): string {
  const qs = new URLSearchParams({ project_id: projectId });
  if (cacheBust !== undefined) qs.set("v", String(cacheBust));
  return `/artifacts/${type}/${filename}?${qs.toString()}`;
}
