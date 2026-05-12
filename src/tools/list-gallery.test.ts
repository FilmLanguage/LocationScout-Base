/**
 * Unit tests for the `list_gallery` MCP tool.
 *
 * Registers `registerCommonTools` against a fake MCP server and exercises
 * list_gallery directly through the captured handler — avoids the transport.
 *
 * Coverage:
 *   1. filters strictly by location_id (different locations don't bleed)
 *   2. attributedLocationId backfill — anchor written without explicit
 *      location_id still surfaces under entity_id-as-location
 *   3. latest_only=true collapses anchor versions but keeps every user-ref
 *   4. kinds filter restricts the result set
 *   5. http_path is wired correctly for latest-alias vs version-pinned
 *   6. cursor pagination is deterministic
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("list_gallery", () => {
  let originalEnv: string | undefined;
  let tempDir: string;
  const toolHandlers = new Map<string, any>();
  const fakeServer = {
    tool: (name: string, _desc: string, _schema: any, _hints: any, handler: any) => {
      toolHandlers.set(name, handler);
    },
  } as any;

  beforeAll(async () => {
    originalEnv = process.env.LOCAL_OUTPUT_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "ls-gallery-test-"));
    process.env.LOCAL_OUTPUT_DIR = tempDir;
    const mod = await import("./common.js");
    mod.registerCommonTools(fakeServer);
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

  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it("filters strictly by location_id and respects http_path conventions", async () => {
    const storage = await import("../lib/storage.js");
    const locA = `loc_a_${Date.now()}`;
    const locB = `loc_b_${Date.now()}`;

    await storage.saveImage("anchor", PNG, {
      entity_id: locA, location_id: locA,
      prompt: "anchor A", model: "test", source_tool: "test",
    });
    await storage.saveImage("anchor", PNG, {
      entity_id: locB, location_id: locB,
      prompt: "anchor B", model: "test", source_tool: "test",
    });

    const handler = toolHandlers.get("list_gallery")!;
    const result = await handler({ location_id: locA, latest_only: true, limit: 48 });
    const { items } = parse<{ items: any[] }>(result);

    expect(items).toHaveLength(1);
    expect(items[0].location_id).toBe(locA);
    expect(items[0].kind).toBe("anchor");
    expect(items[0].entity_id).toBe(locA);
    // latest_only + versionable kind → latest-alias HTTP path
    expect(items[0].http_path).toBe(`/artifacts/anchor/${locA}.png`);
  });

  it("collapses anchor versions under latest_only but keeps every user-ref", async () => {
    const storage = await import("../lib/storage.js");
    const loc = `loc_collapse_${Date.now()}`;

    // Two anchor versions of the same entity → should collapse to 1
    await storage.saveImage("anchor", PNG, {
      entity_id: loc, location_id: loc,
      prompt: "anchor v1", model: "test", source_tool: "test",
    });
    await new Promise((r) => setTimeout(r, 5));
    await storage.saveImage("anchor", PNG, {
      entity_id: loc, location_id: loc,
      prompt: "anchor v2", model: "test", source_tool: "test",
    });

    // Two user uploads — each a distinct asset, both must surface
    await storage.saveImage("user-ref", PNG, {
      entity_id: loc, location_id: loc,
      prompt: "upload 1", model: "user_upload", source_tool: "upload_reference",
    });
    await new Promise((r) => setTimeout(r, 5));
    await storage.saveImage("user-ref", PNG, {
      entity_id: loc, location_id: loc,
      prompt: "upload 2", model: "user_upload", source_tool: "upload_reference",
    });

    const handler = toolHandlers.get("list_gallery")!;
    const collapsed = parse<{ items: any[] }>(
      await handler({ location_id: loc, latest_only: true, limit: 48 }),
    );
    const anchorItems = collapsed.items.filter((i) => i.kind === "anchor");
    const uploadItems = collapsed.items.filter((i) => i.kind === "user-ref");
    expect(anchorItems).toHaveLength(1);
    expect(anchorItems[0].prompt).toBe("anchor v2"); // newest collapsed
    expect(uploadItems).toHaveLength(2);
    // user-ref always version-pinned (each is a distinct asset)
    for (const u of uploadItems) {
      expect(u.http_path).toBe(`/artifacts/user-ref/v/${u.image_id}.png`);
    }

    // latest_only=false → both anchor versions show up
    const full = parse<{ items: any[] }>(
      await handler({ location_id: loc, latest_only: false, limit: 48 }),
    );
    const fullAnchors = full.items.filter((i) => i.kind === "anchor");
    expect(fullAnchors).toHaveLength(2);
    // Under latest_only=false, every kind is version-pinned
    for (const a of fullAnchors) {
      expect(a.http_path).toBe(`/artifacts/anchor/v/${a.image_id}.png`);
    }
  });

  it("kinds filter restricts the result set", async () => {
    const storage = await import("../lib/storage.js");
    const loc = `loc_kinds_${Date.now()}`;
    await storage.saveImage("anchor", PNG, {
      entity_id: loc, location_id: loc,
      prompt: "a", model: "test", source_tool: "test",
    });
    await storage.saveImage("floorplan", PNG, {
      entity_id: loc, location_id: loc,
      prompt: "", model: "matplotlib", source_tool: "test",
    });
    await storage.saveImage("user-ref", PNG, {
      entity_id: loc, location_id: loc,
      prompt: "upload", model: "user_upload", source_tool: "upload_reference",
    });

    const handler = toolHandlers.get("list_gallery")!;
    const result = parse<{ items: any[] }>(
      await handler({ location_id: loc, kinds: ["user-ref"], latest_only: true, limit: 48 }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe("user-ref");
  });

  it("backfills location_id for legacy anchor sidecars via attributedLocationId", async () => {
    // Simulate a pre-migration sidecar by writing one without location_id directly to disk.
    const { promises: fs } = await import("node:fs");
    const loc = `loc_legacy_${Date.now()}`;
    // resolveLocalDir() lays files under `<LOCAL_OUTPUT_DIR>/<AGENT_NAME>/<kind>`
    const dir = join(tempDir, "location-scout", "anchor");
    await fs.mkdir(dir, { recursive: true });
    const legacy = {
      image_id: "legacy01",
      entity_type: "anchor",
      entity_id: loc,
      // location_id intentionally omitted
      kind: "anchor",
      prompt: "legacy",
      model: "test",
      created_at: new Date().toISOString(),
      uri: `agent://location-scout/anchor/${loc}`,
      source_tool: "legacy",
    };
    await fs.writeFile(join(dir, `${loc}_legacy.json`), JSON.stringify(legacy));

    const handler = toolHandlers.get("list_gallery")!;
    const result = parse<{ items: any[] }>(
      await handler({ location_id: loc, latest_only: false, limit: 48 }),
    );
    const found = result.items.find((i) => i.image_id === "legacy01");
    expect(found).toBeDefined();
    expect(found.location_id).toBe(loc); // backfilled from entity_id
  });

  it("paginates deterministically via cursor", async () => {
    const storage = await import("../lib/storage.js");
    const loc = `loc_page_${Date.now()}`;
    // 5 distinct user uploads (latest_only doesn't collapse them)
    for (let i = 0; i < 5; i++) {
      await storage.saveImage("user-ref", PNG, {
        entity_id: loc, location_id: loc,
        prompt: `upload ${i}`, model: "user_upload", source_tool: "upload_reference",
      });
      await new Promise((r) => setTimeout(r, 3));
    }

    const handler = toolHandlers.get("list_gallery")!;
    const page1 = parse<{ items: any[]; next_cursor?: string }>(
      await handler({ location_id: loc, latest_only: true, limit: 2 }),
    );
    expect(page1.items).toHaveLength(2);
    expect(page1.next_cursor).toBeDefined();

    const page2 = parse<{ items: any[]; next_cursor?: string }>(
      await handler({ location_id: loc, latest_only: true, limit: 2, cursor: page1.next_cursor }),
    );
    expect(page2.items).toHaveLength(2);
    // No overlap between pages
    const idsP1 = new Set(page1.items.map((i: any) => i.image_id));
    for (const it of page2.items) expect(idsP1.has(it.image_id)).toBe(false);

    const page3 = parse<{ items: any[]; next_cursor?: string }>(
      await handler({ location_id: loc, latest_only: true, limit: 2, cursor: page2.next_cursor }),
    );
    expect(page3.items).toHaveLength(1); // last item
    expect(page3.next_cursor).toBeUndefined();
  });
});
