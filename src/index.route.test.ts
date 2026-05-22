/**
 * Fix A L3 — structural test for the /artifacts/* HTTP route.
 *
 * The route at `src/index.ts` extracts `?project_id=` and stamps it onto
 * AsyncLocalStorage via `withRequestContext`. That alone is enough for the
 * storage layer to read it back (storage.resolveProjectKey reads ALS as the
 * last fallback). However we ALSO want the explicit fn arg threaded —
 * belt-and-braces: makes the contract obvious to a reader of index.ts and
 * survives any future refactor that drops the ALS wrap.
 *
 * Why structural / regex? Express + supertest + multi-tier storage mocking
 * is 80+ lines of scaffolding for one shape; a regex over the source pins
 * the call-shape mandated by Fix A and runs in milliseconds. The functional
 * coverage already lives in `src/lib/storage.test.ts` (the `loadImage with
 * explicit projectId returns project-A bytes` test).
 *
 * Spec: docs/sessions/2026-05-22-rootcause/00-SYNTHESIS.md Fix A Layer 3 +
 *       docs/canonical/per-project-namespace.md §"HTTP route".
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(HERE, "index.ts");

describe("Fix A L3 — /artifacts route threads project_id into storage calls", () => {
  it("loadImage call inside /artifacts/:type/:file passes project_id explicitly", () => {
    const src = readFileSync(INDEX_PATH, "utf8");
    // Pattern: loadImage(type, id, …, project_id) with project_id as 4th arg.
    // We grep for "loadImage(" followed by an arg list that includes
    // project_id before the next semicolon.
    const match = src.match(/loadImage\(([^)]*)\)/);
    expect(match, "no loadImage(...) call in index.ts").not.toBeNull();
    expect(
      match![0],
      "loadImage call missing project_id arg — Fix A requires explicit threading",
    ).toMatch(/project_id/);
  });

  it("loadImageVersion call inside /artifacts/:type/v/:file passes project_id explicitly", () => {
    const src = readFileSync(INDEX_PATH, "utf8");
    const match = src.match(/loadImageVersion\(([^)]*)\)/);
    expect(match, "no loadImageVersion(...) call in index.ts").not.toBeNull();
    expect(
      match![0],
      "loadImageVersion call missing project_id arg — Fix A requires explicit threading",
    ).toMatch(/project_id/);
  });

  it("loadArtifact (JSON branch) of /artifacts route passes project_id", () => {
    const src = readFileSync(INDEX_PATH, "utf8");
    // The JSON branch inside the same route handler must also thread it so
    // /artifacts/<type>/<id>.json?project_id=... resolves the right namespace.
    // Find all loadArtifact( calls and confirm AT LEAST ONE in this file
    // passes a 3rd arg containing "project_id".
    const calls = src.match(/loadArtifact\([^)]*\)/g) ?? [];
    expect(calls.length, "no loadArtifact(...) calls in index.ts").toBeGreaterThan(0);
    const withProjectId = calls.filter((c) => /project_id/.test(c));
    expect(
      withProjectId.length,
      "no loadArtifact(...) call in index.ts passes project_id — Fix A requires explicit threading on the HTTP route",
    ).toBeGreaterThan(0);
  });
});
