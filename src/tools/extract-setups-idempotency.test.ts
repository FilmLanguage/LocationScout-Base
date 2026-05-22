/**
 * Bug 10 (Wave 2, 2026-05-22) — extract_setups MUST be idempotent per location.
 *
 * Reported symptom (user, 2026-05-22):
 *   "Каждый раз когда апрвую якорное изображение запускается заново
 *    экстракция сетапов. Надо чтобы это происходило один раз на локацию."
 *
 * Root cause class: UI guard `shouldFireExtractSetups` was the only barrier,
 * but PipelineState.setupsExtraction lives in sessionStorage — every full
 * reload, every cross-tab Approve, and any UI state-reset path resets it
 * to "idle" and the guard happily re-fires the LLM.
 *
 * Variant A doctrine fix (backend source-of-truth):
 *   extract_setups itself probes the storage layer BEFORE re-running the
 *   LLM. If setups for this bible / project already exist, the tool
 *   short-circuits — returns their URIs verbatim, no LLM call, completes
 *   in ms instead of minutes. This makes re-fire a no-op regardless of
 *   client-side state hygiene.
 *
 * The UI-side `list_setups` probe in ReferencesPage is a faster fast-path
 * (the user sees "ready" instantly on Approve without an LLM ping). The
 * backend idempotency is the real safety net.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir: string;
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

let fetchCalls: Array<{ url: string; body: unknown }> = [];

function makeBible(bibleId: string, scenes: string[]) {
  return {
    $schema: "location-bible-v2" as const,
    bible_id: bibleId,
    brief_id: "brief-x",
    vision_id: "vision-x",
    research_id: "research-x",
    passport: {
      type: "INT",
      time_of_day: ["DAY"],
      era: "near future",
      recurring: false,
      scenes,
    },
    spaces: ["main"],
    space_description:
      "A small interior room with two doors and a single overhead light.",
    atmosphere: "neutral",
    light_base_state: {
      primary_source: "overhead",
      direction: "OVERHEAD",
      color_temp_kelvin: 5600,
      shadow_hardness: "soft" as const,
      fill_to_key_ratio: "1:1",
      practical_sources: [],
    },
    key_details: ["matte surfaces"],
    negative_list: ["clutter"],
    approval_status: "approved" as const,
  };
}

function makeAnthropicResponse(payload: unknown) {
  return new Response(
    JSON.stringify({
      content: [{ type: "text", text: JSON.stringify(payload) }],
      model: "claude-sonnet-4-stub",
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("Bug 10 — extract_setups idempotency", () => {
  let server: McpServer;
  let extractHandler: (args: unknown) => Promise<{ content: Array<{ text: string }> }>;
  let listHandler:
    | ((args: unknown) => Promise<{ content: Array<{ text: string }> }>)
    | undefined;
  let saveArtifact: typeof import("../lib/storage.js").saveArtifact;
  let getTask: typeof import("../lib/storage.js").getTask;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "extract-setups-idempotency-"));
    process.env.LOCAL_OUTPUT_DIR = tempDir;
    process.env.IS_DEV = "true";
    process.env.NODE_ENV = "test";
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.S3_BUCKET;
    delete process.env.YANDEX_DB_HOST;

    const storage = await import("../lib/storage.js");
    saveArtifact = storage.saveArtifact;
    getTask = storage.getTask;

    const { registerLocationTools } = await import("./location.js");
    server = new McpServer({ name: "test", version: "0.0.0" });
    registerLocationTools(server);
    const registered = (
      server as unknown as {
        _registeredTools: Record<
          string,
          {
            handler: (
              args: unknown,
            ) => Promise<{ content: Array<{ text: string }> }>;
          }
        >;
      }
    )._registeredTools;
    extractHandler = registered.extract_setups.handler;
    listHandler = registered.list_setups?.handler;
  });

  beforeEach(() => {
    fetchCalls = [];
    // Default LLM mock — returns 2 setups. Any test that lets this run is
    // exercising the first-time extract path (NOT the idempotent short-circuit).
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      fetchCalls.push({
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return makeAnthropicResponse([
        {
          setup_id: undefined, // tool generates a stable id
          scene_id: "S1",
          setup_name: "wide establishing",
          composition: "wide",
        },
        {
          setup_id: undefined,
          scene_id: "S1",
          setup_name: "close-up",
          composition: "tight",
        },
      ]);
    }) as typeof fetch;
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  async function waitForTask(taskId: string, timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const t = await getTask(taskId);
      if (t && (t.status === "completed" || t.status === "failed")) return t;
      await new Promise((r) => setTimeout(r, 25));
    }
    return getTask(taskId);
  }

  it("first extract_setups call runs the LLM and saves setups (control)", async () => {
    const bibleId = "loc_proj_idempotency_01";
    await saveArtifact("bible", bibleId, makeBible(bibleId, ["S1"]), "proj_idempotency_01");

    const r = await extractHandler({
      floorplan_uri: `agent://location-scout/floorplan/${bibleId}`,
      mood_state_uris: [],
      project_id: "proj_idempotency_01",
    });
    const accepted = JSON.parse(r.content[0].text);
    const task = await waitForTask(accepted.task_id);

    expect(task?.status).toBe("completed");
    expect(task?.artifacts?.length).toBeGreaterThan(0);
    // Sanity: LLM was called.
    expect(
      fetchCalls.filter((c) => c.url.includes("anthropic")).length,
    ).toBeGreaterThan(0);
  });

  it("second extract_setups call for the same bible returns existing setups WITHOUT calling the LLM", async () => {
    const bibleId = "loc_proj_idempotency_02";
    const projectId = "proj_idempotency_02";
    await saveArtifact("bible", bibleId, makeBible(bibleId, ["S1"]), projectId);

    // First call seeds the setups.
    const r1 = await extractHandler({
      floorplan_uri: `agent://location-scout/floorplan/${bibleId}`,
      mood_state_uris: [],
      project_id: projectId,
    });
    const task1 = await waitForTask(JSON.parse(r1.content[0].text).task_id);
    expect(task1?.status).toBe("completed");
    const firstArtifactUris = (task1?.artifacts ?? []).map((a) => a.uri).sort();

    // Reset LLM-call counter, then make the SECOND call.
    fetchCalls = [];

    const r2 = await extractHandler({
      floorplan_uri: `agent://location-scout/floorplan/${bibleId}`,
      mood_state_uris: [],
      project_id: projectId,
    });
    const task2 = await waitForTask(JSON.parse(r2.content[0].text).task_id);
    expect(task2?.status).toBe("completed");
    const secondArtifactUris = (task2?.artifacts ?? []).map((a) => a.uri).sort();

    // The artifact URIs returned the second time must be the SAME ones —
    // the idempotency path serves cached setups, not regenerated ones.
    expect(secondArtifactUris).toEqual(firstArtifactUris);

    // CRITICAL: no LLM call on the second invocation.
    const llmCallsOnSecondInvoke = fetchCalls.filter((c) =>
      c.url.includes("anthropic"),
    );
    expect(
      llmCallsOnSecondInvoke,
      "extract_setups must not re-run the LLM when setups already exist for this bible/project",
    ).toHaveLength(0);
  });

  it("the second-call result includes a flag or current_step signalling 'reused' so callers can distinguish", async () => {
    const bibleId = "loc_proj_idempotency_03";
    const projectId = "proj_idempotency_03";
    await saveArtifact("bible", bibleId, makeBible(bibleId, ["S1"]), projectId);

    await waitForTask(
      JSON.parse(
        (
          await extractHandler({
            floorplan_uri: `agent://location-scout/floorplan/${bibleId}`,
            mood_state_uris: [],
            project_id: projectId,
          })
        ).content[0].text,
      ).task_id,
    );

    fetchCalls = [];
    const r2 = await extractHandler({
      floorplan_uri: `agent://location-scout/floorplan/${bibleId}`,
      mood_state_uris: [],
      project_id: projectId,
    });
    const task2 = await waitForTask(JSON.parse(r2.content[0].text).task_id);

    expect(task2?.status).toBe("completed");
    // The completion message MUST tell the caller this was the idempotent
    // path — UI uses it to decide whether to flash "Re-using extracted setups"
    // instead of "3 setups extracted (fresh)".
    expect(task2?.current_step ?? "").toMatch(/reuse|existing|cached|already/i);
  });
});

describe("Bug 10 — list_setups tool (idempotency-probe surface for UI)", () => {
  let server: McpServer;
  let listHandler: (args: unknown) => Promise<{ content: Array<{ text: string }> }>;
  let saveArtifact: typeof import("../lib/storage.js").saveArtifact;

  beforeAll(async () => {
    if (!tempDir) {
      tempDir = mkdtempSync(join(tmpdir(), "list-setups-test-"));
      process.env.LOCAL_OUTPUT_DIR = tempDir;
      process.env.IS_DEV = "true";
      process.env.NODE_ENV = "test";
      delete process.env.S3_BUCKET;
      delete process.env.YANDEX_DB_HOST;
    }
    const storage = await import("../lib/storage.js");
    saveArtifact = storage.saveArtifact;

    const { registerLocationTools } = await import("./location.js");
    server = new McpServer({ name: "test", version: "0.0.0" });
    registerLocationTools(server);
    const registered = (
      server as unknown as {
        _registeredTools: Record<
          string,
          {
            handler: (
              args: unknown,
            ) => Promise<{ content: Array<{ text: string }> }>;
          }
        >;
      }
    )._registeredTools;
    const reg = registered.list_setups;
    if (!reg) {
      throw new Error(
        "list_setups tool not registered — required by Bug 10 fix (UI probe surface).",
      );
    }
    listHandler = reg.handler;
  });

  it("returns existing setups for a given location_id + project_id", async () => {
    const bibleId = "loc_proj_listsetups_01";
    const projectId = "proj_listsetups_01";
    // Manually seed two setups under the project's namespace.
    await saveArtifact(
      "setup",
      `setup_${bibleId}_aaaa1111`,
      { setup_id: `setup_${bibleId}_aaaa1111`, scene_id: "S1", setup_name: "wide" },
      projectId,
    );
    await saveArtifact(
      "setup",
      `setup_${bibleId}_bbbb2222`,
      { setup_id: `setup_${bibleId}_bbbb2222`, scene_id: "S1", setup_name: "tight" },
      projectId,
    );

    const r = await listHandler({ location_id: bibleId, project_id: projectId });
    const result = JSON.parse(r.content[0].text);
    expect(Array.isArray(result.setups)).toBe(true);
    expect(result.setups.length).toBe(2);
    const ids = result.setups
      .map((s: { setup_id: string }) => s.setup_id)
      .sort();
    expect(ids).toEqual([
      `setup_${bibleId}_aaaa1111`,
      `setup_${bibleId}_bbbb2222`,
    ]);
  });

  it("returns empty array (NOT an error) when no setups exist for the location/project", async () => {
    const r = await listHandler({
      location_id: "loc_proj_listsetups_nonexistent",
      project_id: "proj_listsetups_empty",
    });
    const result = JSON.parse(r.content[0].text);
    expect(result.setups).toEqual([]);
  });
});
