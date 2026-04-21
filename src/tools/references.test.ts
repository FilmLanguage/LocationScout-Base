/**
 * Unit tests for the reference-images tools (upload_reference,
 * list_user_references, list_location_images) and ReferenceRef schema.
 *
 * Each test registers the tools onto a fresh McpServer instance and invokes
 * them directly via the registered handler — avoids spinning a full transport.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReferenceRefSchema, AGENT_KEY } from "../lib/ref-schema.js";

describe("ReferenceRefSchema", () => {
  it("validates a minimal ref", () => {
    const parsed = ReferenceRefSchema.parse({
      image_id: "abc12345",
      uri: "agent://location-scout/user-ref/loc_001",
      kind: "user_upload",
      source_agent: AGENT_KEY,
    });
    expect(parsed.kind).toBe("user_upload");
    expect(parsed.source_agent).toBe("location-scout");
  });

  it("rejects an unknown kind", () => {
    expect(() =>
      ReferenceRefSchema.parse({
        image_id: "abc",
        uri: "agent://x/y/z",
        kind: "nonsense",
        source_agent: "location-scout",
      }),
    ).toThrow();
  });

  it("accepts optional prompt + entity_id fields", () => {
    const parsed = ReferenceRefSchema.parse({
      image_id: "xyz",
      uri: "data:image/png;base64,AAAA",
      kind: "external",
      source_agent: "user",
      prompt: "a mood board clip",
      entity_id: "loc_001",
    });
    expect(parsed.prompt).toBe("a mood board clip");
    expect(parsed.entity_id).toBe("loc_001");
  });
});

describe("upload_reference + list_user_references + list_location_images", () => {
  let tempDir: string;
  let originalEnv: string | undefined;

  // Minimal fake MCP server: captures registered tools so we can invoke their
  // handlers directly without standing up a transport.
  const toolHandlers = new Map<string, (args: any) => Promise<any>>();
  const fakeServer = {
    tool: (name: string, _desc: string, _schema: any, _hints: any, handler: any) => {
      toolHandlers.set(name, handler);
    },
  } as any;

  beforeAll(async () => {
    originalEnv = process.env.LOCAL_OUTPUT_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "ls-refs-test-"));
    process.env.LOCAL_OUTPUT_DIR = tempDir;
    // Import after env setup so storage picks up the override.
    const mod = await import("./references.js");
    mod.registerReferenceTools(fakeServer);
  });

  afterAll(() => {
    if (originalEnv === undefined) delete process.env.LOCAL_OUTPUT_DIR;
    else process.env.LOCAL_OUTPUT_DIR = originalEnv;
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }
  });

  function parse<T>(result: any): T {
    const text = result?.content?.[0]?.text;
    return JSON.parse(text) as T;
  }

  it("upload_reference saves a sidecar and returns a ReferenceRef", async () => {
    const handler = toolHandlers.get("upload_reference");
    expect(handler).toBeDefined();
    // 1x1 transparent PNG
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==";
    const result = await handler!({
      kind: "user_upload",
      entity_id: "loc_tool_test",
      base64_data: png,
      content_type: "image/png",
      note: "my lobby ref",
    });
    const ref = parse<any>(result);
    expect(ref.image_id).toMatch(/^[a-z0-9]{6,}$/);
    expect(ref.kind).toBe("user_upload");
    expect(ref.source_agent).toBe("location-scout");
    expect(ref.entity_id).toBe("loc_tool_test");
    expect(ref.uri).toContain("agent://location-scout/user-ref/");
    // Validate the returned shape against the canonical schema.
    expect(() => ReferenceRefSchema.parse(ref)).not.toThrow();
  });

  it("list_user_references returns sidecars written by upload_reference", async () => {
    const upload = toolHandlers.get("upload_reference")!;
    const list = toolHandlers.get("list_user_references")!;
    const png =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==";
    const entity_id = `loc_list_${Date.now()}`;

    await upload({
      kind: "user_upload",
      entity_id,
      base64_data: png,
      content_type: "image/png",
      note: "first",
    });
    await new Promise((r) => setTimeout(r, 5));
    await upload({
      kind: "user_upload",
      entity_id,
      base64_data: png,
      content_type: "image/png",
      note: "second",
    });

    const listResult = await list({ entity_id });
    const { refs } = parse<{ entity_id: string; refs: any[] }>(listResult);
    expect(refs).toHaveLength(2);
    // Newest first
    expect(refs[0].prompt).toBe("second");
    expect(refs[1].prompt).toBe("first");
    for (const r of refs) {
      expect(r.kind).toBe("user-ref");
      expect(r.source_tool).toBe("upload_reference");
      expect(r.entity_id).toBe(entity_id);
    }
  });

  it("list_location_images aggregates anchor + isometric for a bible", async () => {
    const storage = await import("../lib/storage.js");
    const bible_id = `loc_agg_${Date.now()}`;
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await storage.saveImage("anchor", buf, {
      entity_id: bible_id,
      prompt: "anchor p",
      model: "nanobanana",
      source_tool: "generate_anchor",
    });
    await storage.saveImage("isometric", buf, {
      entity_id: bible_id,
      prompt: "iso p",
      model: "nanobanana",
      source_tool: "generate_isometric_reference",
    });

    const list = toolHandlers.get("list_location_images")!;
    const result = await list({ bible_id });
    const data = parse<{ anchor: any[]; isometric: any[]; setup: Record<string, any[]> }>(result);
    expect(data.anchor).toHaveLength(1);
    expect(data.anchor[0].prompt).toBe("anchor p");
    expect(data.isometric).toHaveLength(1);
    expect(data.isometric[0].prompt).toBe("iso p");
    expect(data.setup).toEqual({});
  });
});
