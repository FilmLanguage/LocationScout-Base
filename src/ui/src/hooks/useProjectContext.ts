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
 */

export interface ProjectContext {
  projectId: string;
  sceneId: string | null;
  shotId: string | null;
  locationId: string;
}

const FALLBACK_PROJECT_ID = "default-project";

export function useProjectContext(): ProjectContext {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const projectId = (params.get("project_id") || FALLBACK_PROJECT_ID).trim();
  const sceneId = params.get("scene_id");
  const shotId = params.get("shot_id");
  const explicitLocationId = params.get("location_id");
  const locationId = (explicitLocationId || `loc_${projectId}`).trim();
  return { projectId, sceneId, shotId, locationId };
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
