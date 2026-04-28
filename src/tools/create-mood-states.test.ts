/**
 * Unit test for create_mood_states tool — verifies real LLM-driven mood state
 * generation, schema validation, and artifact save (was a stub before this chip).
 *
 * Mocks:
 *   - global fetch — intercepts the Anthropic API call and returns a canned
 *     mood-state delta JSON. No real network traffic.
 *   - LOCAL_OUTPUT_DIR — set to a tmp dir so saveArtifact writes to disk
 *     without polluting the workspace.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir: string;
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

let fetchCalls: Array<{ url: string; body: any }> = [];

function makeBible(bibleId: string, scenes: string[], approval_status: "draft" | "approved") {
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
    space_description: "A 4×4×3m white cube. Matte walls, no windows, no fixtures.",
    atmosphere: "clinical, sterile, weightless",
    light_base_state: {
      primary_source: "overhead diffuser",
      direction: "OVERHEAD",
      color_temp_kelvin: 5600,
      shadow_hardness: "soft" as const,
      fill_to_key_ratio: "1:1",
      practical_sources: [],
    },
    key_details: ["matte white surfaces", "seamless cyc corner", "no fixtures"],
    negative_list: ["warmth", "shadows", "props"],
    approval_status,
  };
}

function makeAnthropicResponse(payload: unknown) {
  const body = JSON.stringify({
    content: [{ type: "text", text: JSON.stringify(payload) }],
    model: "claude-sonnet-4-stub",
    usage: { input_tokens: 100, output_tokens: 50 },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("create_mood_states", () => {
  let server: McpServer;
  let toolHandler: (args: unknown) => Promise<{ content: Array<{ text: string }> }>;
  let saveArtifact: typeof import("../lib/storage.js").saveArtifact;
  let getTask: typeof import("../lib/storage.js").getTask;
  let loadArtifact: typeof import("../lib/storage.js").loadArtifact;

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "mood-state-test-"));
    process.env.LOCAL_OUTPUT_DIR = tempDir;
    process.env.IS_DEV = "true";
    process.env.NODE_ENV = "test";
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.S3_BUCKET;
    delete process.env.YANDEX_DB_HOST;

    // Import AFTER env is set so module-level constants pick up the values.
    const storage = await import("../lib/storage.js");
    saveArtifact = storage.saveArtifact;
    getTask = storage.getTask;
    loadArtifact = storage.loadArtifact;

    const { registerLocationTools } = await import("./location.js");

    server = new McpServer({ name: "test", version: "0.0.0" });
    registerLocationTools(server);
    const registered = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ text: string }> }> }> })._registeredTools;
    toolHandler = registered.create_mood_states.handler;
  });

  beforeEach(() => {
    fetchCalls = [];
    // Default fetch mock: every call returns the same canned mood delta.
    globalThis.fetch = (async (url: any, init: any) => {
      fetchCalls.push({
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return makeAnthropicResponse({
        light_direction: "OVERHEAD",
        weather: null,
        color_temp_kelvin: 5600,
        shadow_hardness: "soft",
        light_change: "Diffused overhead daylight; shadows nearly disappear.",
        props_change: "",
        atmosphere_shift: "Clinical, shadowless laboratory void.",
        clutter_level: "clean",
        window_state: null,
      });
    }) as typeof fetch;
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  async function waitForTask(taskId: string, timeoutMs = 5_000): Promise<ReturnType<typeof getTask>> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const t = getTask(taskId);
      if (t && (t.status === "completed" || t.status === "failed")) return t;
      await new Promise((r) => setTimeout(r, 25));
    }
    return getTask(taskId);
  }

  it("validates the bible-approval gate and saves one mood-state-v1 artifact per scene_group", async () => {
    const bibleId = "test-loc-001";
    await saveArtifact("bible", bibleId, makeBible(bibleId, ["S1", "S2", "S3"], "approved"));

    const result = await toolHandler({
      bible_uri: `agent://location-scout/bible/${bibleId}`,
      scene_groups: [
        { scene_ids: ["S1"], act: 1, time_of_day: "DAY", context: "Entry — wide" },
        { scene_ids: ["S2"], act: 1, time_of_day: "DAY", context: "Center — flat" },
        { scene_ids: ["S3"], act: 1, time_of_day: "DAY", context: "Overhead — still" },
      ],
      user_notes: "Keep it sterile.",
    });

    const accepted = JSON.parse(result.content[0].text);
    expect(accepted.task_id).toBeDefined();
    expect(accepted.status).toBe("accepted");
    expect(accepted.count).toBe(3);

    const task = await waitForTask(accepted.task_id);
    expect(task?.status).toBe("completed");
    expect(task?.artifacts.length).toBe(3);
    expect(task?.artifacts.map((a) => a.uri)).toEqual([
      `agent://location-scout/mood/mood_${bibleId}_01`,
      `agent://location-scout/mood/mood_${bibleId}_02`,
      `agent://location-scout/mood/mood_${bibleId}_03`,
    ]);
    expect(task?.prompts_used).toBeDefined();
    expect(Object.keys(task?.prompts_used ?? {})).toHaveLength(3);

    // Anthropic was called once per scene_group with the right system prompt + user prompt shape.
    expect(fetchCalls).toHaveLength(3);
    for (const call of fetchCalls) {
      expect(call.url).toBe("https://api.anthropic.com/v1/messages");
      expect(call.body.system).toContain("mood-state generator");
      expect(call.body.system).toContain("DELTA");
      expect(call.body.messages[0].role).toBe("user");
      expect(call.body.messages[0].content).toContain("Location bible");
      expect(call.body.messages[0].content).toContain("Light base state");
      expect(call.body.messages[0].content).toContain("Keep it sterile.");
    }
    // Per-scene context distinct in user prompts.
    expect(fetchCalls[0].body.messages[0].content).toContain("Entry — wide");
    expect(fetchCalls[1].body.messages[0].content).toContain("Center — flat");
    expect(fetchCalls[2].body.messages[0].content).toContain("Overhead — still");

    // Artifact actually saved + readable + schema-valid.
    const stored = await loadArtifact<Record<string, unknown>>("mood", `mood_${bibleId}_01`);
    expect(stored).toBeTruthy();
    expect(stored?.$schema).toBe("mood-state-v1");
    expect(stored?.state_id).toBe(`mood_${bibleId}_01`);
    expect(stored?.bible_id).toBe(bibleId);
    expect(stored?.scene_ids).toEqual(["S1"]);
    expect(stored?.act).toBe(1);
    expect(stored?.time_of_day).toBe("DAY");
    // Delta fields from LLM response present.
    expect(stored?.light_direction).toBe("OVERHEAD");
    expect(stored?.color_temp_kelvin).toBe(5600);
    expect(stored?.shadow_hardness).toBe("soft");
  });

  it("fails the task if the LLM returns invalid JSON", async () => {
    const bibleId = "test-loc-002";
    await saveArtifact("bible", bibleId, makeBible(bibleId, ["S1"], "approved"));

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        content: [{ type: "text", text: "not json at all" }],
        model: "stub",
        usage: { input_tokens: 1, output_tokens: 1 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const result = await toolHandler({
      bible_uri: `agent://location-scout/bible/${bibleId}`,
      scene_groups: [{ scene_ids: ["S1"], act: 1, time_of_day: "DAY" }],
    });
    const accepted = JSON.parse(result.content[0].text);
    const task = await waitForTask(accepted.task_id);
    expect(task?.status).toBe("failed");
    expect(task?.error ?? "").toMatch(/parse error|JSON/i);
  });

  it("rejects unapproved bibles via Bible First gate", async () => {
    const bibleId = "test-loc-003-draft";
    await saveArtifact("bible", bibleId, makeBible(bibleId, ["S1"], "draft"));

    const result = await toolHandler({
      bible_uri: `agent://location-scout/bible/${bibleId}`,
      scene_groups: [{ scene_ids: ["S1"], act: 1, time_of_day: "DAY" }],
    });
    const accepted = JSON.parse(result.content[0].text);
    const task = await waitForTask(accepted.task_id);
    expect(task?.status).toBe("failed");
    expect(task?.error ?? "").toMatch(/not approved|gate/i);

    // Fetch must NOT have been called — gate fails before LLM call.
    expect(fetchCalls).toHaveLength(0);
  });
});
