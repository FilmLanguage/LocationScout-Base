/**
 * Unit test for the Phase 5D scout_location fallback brief path.
 *
 * Background — backlog row 54, T13 (2026-05-20):
 *   When the LS UI auto-triggers scout_location on Location panel mount with
 *   only `project_id` + `location_id`, and 1AD has no upstream briefs for the
 *   project (extract_locations never ran on the demo path), the tool used to
 *   error out with "location_brief required: …" leaving the demo dead in the
 *   water. The c59a6b1 hardening (slug/UUID detection + diagnostic reasons)
 *   improved the error message but did not unblock the demo flow.
 *
 *   This test pins the fallback contract:
 *
 *   (1) `AGENT_1AD_URL` set + 1AD returns `{error: "..."}`  (upstream_unreachable)
 *       + caller passes `location_id` → task accepted, bible generated from a
 *       thin synthesized brief, saved under the caller's location_id slug.
 *
 *   (2) `AGENT_1AD_URL` set + 1AD returns empty briefs collection
 *       (empty_briefs_collection) + caller passes `location_id` → same as (1).
 *
 *   (3) `AGENT_1AD_URL` UNSET → still errors with `agent_url_unset` diagnostic.
 *       The fallback is *only* for "1AD reachable but empty" — a missing env
 *       var is a real configuration error worth surfacing.
 *
 *   (4) Caller passes `location_name` hint instead of `location_id` → fallback
 *       still kicks in and uses the hint as the human-readable name.
 *
 * Mocks:
 *   - global fetch — intercepts BOTH the inter-agent MCP call to 1AD AND the
 *     Anthropic LLM call. The 1AD mock simulates the empty/error cases; the
 *     Anthropic mock returns a canned bible JSON.
 *   - LOCAL_OUTPUT_DIR — tmp dir so saveArtifact writes to disk without
 *     polluting the workspace.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir: string;
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

type FetchCall = { url: string; body: unknown };
let fetchCalls: FetchCall[] = [];

/** Canned bible payload that passes the v2 schema coercion in scout_location. */
function makeCannedBibleJson(bibleId: string) {
  return {
    bible_id: bibleId,
    space_description: "A small interior room.",
    atmosphere: "neutral",
    light_base_state: {
      primary_source: "overhead diffuser",
      direction: "OVERHEAD",
      color_temp_kelvin: 5600,
      shadow_hardness: "soft",
      fill_to_key_ratio: "1:1",
      practical_sources: [],
    },
    passport: {
      type: "INT",
      time_of_day: ["DAY"],
      era: "present day",
      recurring: false,
      scenes: ["scene_001"],
    },
    key_details: ["matte surfaces"],
    negative_list: ["clutter"],
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

/** MCP-shaped response that looks like 1AD threw on the resource. */
function makeMcpErrorResponse(message: string) {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: {
        contents: [
          {
            uri: "agent://1ad/location-briefs/x",
            mimeType: "application/json",
            text: JSON.stringify({ error: message }),
          },
        ],
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** MCP-shaped response with an empty briefs collection. */
function makeMcpEmptyBriefsResponse() {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: {
        contents: [
          {
            uri: "agent://1ad/location-briefs/x",
            mimeType: "application/json",
            text: JSON.stringify({ locations: [] }),
          },
        ],
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("scout_location fallback brief (Phase 5D)", () => {
  let toolHandler: (args: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
  let saveArtifact: typeof import("../lib/storage.js").saveArtifact;
  let loadArtifact: typeof import("../lib/storage.js").loadArtifact;
  let getTask: typeof import("../lib/storage.js").getTask;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "scout-fallback-test-"));
    process.env.LOCAL_OUTPUT_DIR = tempDir;
    process.env.IS_DEV = "true";
    process.env.NODE_ENV = "test";
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.S3_BUCKET;
    delete process.env.YANDEX_DB_HOST;

    const storage = await import("../lib/storage.js");
    saveArtifact = storage.saveArtifact;
    loadArtifact = storage.loadArtifact;
    getTask = storage.getTask;

    const { registerLocationTools } = await import("./location.js");
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerLocationTools(server);
    const registered = (server as unknown as {
      _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }> }>;
    })._registeredTools;
    toolHandler = registered.scout_location.handler;
    // Reference saveArtifact + loadArtifact so the linter doesn't complain when
    // a particular test doesn't touch them.
    void saveArtifact;
    void loadArtifact;
  });

  beforeEach(() => {
    fetchCalls = [];
    // Tests override this per case.
    globalThis.fetch = (async () => new Response("not configured", { status: 500 })) as typeof fetch;
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  async function waitForTask(taskId: string, timeoutMs = 5_000): Promise<Awaited<ReturnType<typeof getTask>>> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const t = await getTask(taskId);
      if (t && (t.status === "completed" || t.status === "failed")) return t;
      await new Promise((r) => setTimeout(r, 25));
    }
    return getTask(taskId);
  }

  /**
   * Helper: install a fetch mock that distinguishes the 1AD MCP call from the
   * Anthropic LLM call by URL substring. `oneAdResponseFactory` returns the
   * Response to send back for the MCP call.
   */
  function installFetchMock(oneAdResponseFactory: () => Response) {
    globalThis.fetch = (async (url: unknown, init: unknown) => {
      const u = String(url);
      const body = (init as { body?: string } | undefined)?.body;
      fetchCalls.push({ url: u, body: body ? JSON.parse(String(body)) : null });
      if (u.includes("/mcp")) {
        return oneAdResponseFactory();
      }
      if (u.includes("api.anthropic.com")) {
        return makeAnthropicResponse(makeCannedBibleJson("__will_be_overwritten__"));
      }
      return new Response("unrouted", { status: 500 });
    }) as typeof fetch;
  }

  it("(1) AGENT_1AD_URL set + 1AD returns error envelope: synthesizes fallback brief from caller location_id and accepts task", async () => {
    process.env.AGENT_1AD_URL = "http://fake-1ad.local";
    delete process.env.AGENT_DIRECTOR_URL;

    installFetchMock(() => makeMcpErrorResponse("Location briefs not found for project proj_demo. Run extract_locations first."));

    const callerLocationId = "loc_proj_demo";
    const result = await toolHandler({
      project_id: "proj_demo",
      location_id: callerLocationId,
    });

    expect(result.isError).toBeFalsy();
    const accepted = JSON.parse(result.content[0].text);
    expect(accepted.status).toBe("accepted");
    expect(accepted.task_id).toBeDefined();
    expect(accepted.location_id).toBe(callerLocationId);

    const task = await waitForTask(accepted.task_id);
    expect(task?.status).toBe("completed");
    // Bible saved under the caller's slug, not 1AD's deterministicGuid.
    expect(task?.artifacts?.map((a) => a.uri)).toEqual([
      `agent://location-scout/bible/${callerLocationId}`,
    ]);

    // 1AD MCP call happened (proves we tried upstream first).
    const mcpCalls = fetchCalls.filter((c) => c.url.includes("/mcp"));
    expect(mcpCalls.length).toBeGreaterThan(0);

    // Anthropic was called for the bible — confirms fallback brief reached the
    // LLM, not the error path.
    const anthropicCalls = fetchCalls.filter((c) => c.url.includes("api.anthropic.com"));
    expect(anthropicCalls.length).toBe(1);
  });

  it("(2) AGENT_1AD_URL set + 1AD returns empty briefs: same fallback path accepts the task", async () => {
    process.env.AGENT_1AD_URL = "http://fake-1ad.local";
    delete process.env.AGENT_DIRECTOR_URL;

    installFetchMock(() => makeMcpEmptyBriefsResponse());

    const callerLocationId = "loc_proj_empty";
    const result = await toolHandler({
      project_id: "proj_empty",
      location_id: callerLocationId,
    });

    expect(result.isError).toBeFalsy();
    const accepted = JSON.parse(result.content[0].text);
    expect(accepted.status).toBe("accepted");
    expect(accepted.location_id).toBe(callerLocationId);

    const task = await waitForTask(accepted.task_id);
    expect(task?.status).toBe("completed");
  });

  it("(3) AGENT_1AD_URL UNSET: still errors with agent_url_unset diagnostic (no fallback)", async () => {
    delete process.env.AGENT_1AD_URL;
    delete process.env.AGENT_DIRECTOR_URL;

    // Install fetch mock anyway — if scout_location ever called out we'd see it.
    installFetchMock(() => new Response("should not be called", { status: 500 }));

    const result = await toolHandler({
      project_id: "proj_no_env",
      location_id: "loc_proj_no_env",
    });

    expect(result.isError).toBe(true);
    const errResp = JSON.parse(result.content[0].text);
    expect(errResp.error).toMatch(/AGENT_1AD_URL is not configured/);

    // No MCP call attempted (URL was unset).
    const mcpCalls = fetchCalls.filter((c) => c.url.includes("/mcp"));
    expect(mcpCalls.length).toBe(0);

    // Anthropic NOT called — fallback intentionally skipped for misconfig.
    const anthropicCalls = fetchCalls.filter((c) => c.url.includes("api.anthropic.com"));
    expect(anthropicCalls.length).toBe(0);
  });

  it("(4) caller passes only location_name (no location_id): fallback still kicks in and uses the name as bible.location_name", async () => {
    process.env.AGENT_1AD_URL = "http://fake-1ad.local";
    delete process.env.AGENT_DIRECTOR_URL;

    installFetchMock(() => makeMcpEmptyBriefsResponse());

    const result = await toolHandler({
      project_id: "proj_namehint",
      location_name: "MARLOWE'S OFFICE",
    });

    expect(result.isError).toBeFalsy();
    const accepted = JSON.parse(result.content[0].text);
    expect(accepted.status).toBe("accepted");
    // Falls back to a synthesized slug because no caller_location_id was given.
    expect(accepted.location_id).toBe("loc_proj_namehint");

    const task = await waitForTask(accepted.task_id);
    expect(task?.status).toBe("completed");

    // The LLM call carries the human-readable hint, NOT the opaque slug.
    const anthropicCalls = fetchCalls.filter((c) => c.url.includes("api.anthropic.com"));
    expect(anthropicCalls.length).toBe(1);
    const userMsg = (anthropicCalls[0].body as { messages: Array<{ content: string }> }).messages[0].content;
    expect(userMsg).toContain("MARLOWE'S OFFICE");
  });
});
