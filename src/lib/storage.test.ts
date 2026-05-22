import { describe, it, expect, beforeAll, afterAll, vi, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  saveArtifact,
  loadArtifact,
  artifactExists,
  createTask,
  updateTask,
  getTask,
  deleteTask,
  listLocalArtifacts,
} from "./storage.js";

describe("artifact CRUD (memory mode, no GCS)", () => {
  const type = `test-${Date.now()}`;

  it("saves and loads a JSON artifact", async () => {
    const uri = await saveArtifact(type, "item-1", { name: "Test" });
    expect(uri).toContain("mem://");

    const loaded = await loadArtifact(type, "item-1");
    expect(loaded).toMatchObject({ name: "Test" });
  });

  it("returns null for nonexistent artifact", async () => {
    expect(await loadArtifact(type, "nonexistent")).toBeNull();
  });

  it("checks artifact existence", async () => {
    await saveArtifact(type, "exists-check", { ok: true });
    expect(await artifactExists(type, "exists-check")).toBe(true);
    expect(await artifactExists(type, "nope")).toBe(false);
  });

  it("lists artifacts by type", async () => {
    const t = `list-test-${Date.now()}`;
    await saveArtifact(t, "a", { n: 1 });
    await saveArtifact(t, "b", { n: 2 });
    const ids = await listLocalArtifacts(t);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids.length).toBe(2);
  });
});

describe("per-project namespacing", () => {
  it("isolates payloads written under different explicit project_ids", async () => {
    const t = `iso-${Date.now()}`;
    await saveArtifact(t, "shared", { n: "A" }, "proj-a");
    await saveArtifact(t, "shared", { n: "B" }, "proj-b");
    const a = await loadArtifact<{ n: string }>(t, "shared", "proj-a");
    const b = await loadArtifact<{ n: string }>(t, "shared", "proj-b");
    expect(a?.n).toBe("A");
    expect(b?.n).toBe("B");
  });

  it("extracts project_id from payload when explicit not given", async () => {
    const t = `payload-${Date.now()}`;
    await saveArtifact(t, "from-payload", { project_id: "proj-x", value: 42 });
    const x = await loadArtifact<{ value: number }>(t, "from-payload", "proj-x");
    const other = await loadArtifact<{ value: number }>(t, "from-payload", "proj-y");
    expect(x?.value).toBe(42);
    expect(other).toBeNull();
  });

  it("artifactExists honours project namespace", async () => {
    const t = `exists-${Date.now()}`;
    await saveArtifact(t, "thing", { ok: true }, "proj-a");
    expect(await artifactExists(t, "thing", "proj-a")).toBe(true);
    expect(await artifactExists(t, "thing", "proj-b")).toBe(false);
  });
});

describe("task store", () => {
  it("creates and retrieves a task", async () => {
    const task = createTask("task-1", "starting");
    expect(task.task_id).toBe("task-1");
    expect(task.status).toBe("accepted");
    expect(task.progress).toBe(0);
    expect(task.tool_name).toBe("");

    const retrieved = await getTask("task-1");
    expect(retrieved).toEqual(task);
  });

  it("updates a task", async () => {
    createTask("task-2", "init");
    const updated = updateTask("task-2", { status: "completed", progress: 100 });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("completed");
    expect(updated!.progress).toBe(100);
  });

  it("returns null when updating nonexistent task", () => {
    expect(updateTask("nonexistent", { progress: 50 })).toBeNull();
  });

  it("deletes a task", async () => {
    createTask("task-3", "temp");
    expect(deleteTask("task-3")).toBe(true);
    expect(await getTask("task-3")).toBeNull();
  });

  it("returns false when deleting nonexistent task", () => {
    expect(deleteTask("nonexistent")).toBe(false);
  });

  it("passes tool_name through when provided", () => {
    const task = createTask("task-4", "step", "create_mood_states");
    expect(task.tool_name).toBe("create_mood_states");
  });
});

describe("task store v2.tasks dual-write", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createTask attempts persistTask (best-effort — DB warn on failure)", async () => {
    const dbModule = await import("./db.js");
    const spy = vi.spyOn(dbModule, "persistTask").mockRejectedValue(new Error("db down"));

    createTask("task-persist-1", "step", "create_mood_states");

    // Let the fire-and-forget promise settle.
    await new Promise((r) => setTimeout(r, 10));

    expect(spy).toHaveBeenCalledWith(
      "task-persist-1",
      "create_mood_states",
      "accepted",
      expect.objectContaining({ task_id: "task-persist-1", status: "accepted" }),
    );
    // Failure is now emitted as a structured `error` log via lib/log.ts —
    // this test no longer asserts on the console.warn shape.
  });

  it("updateTask attempts persistTask with updated status", async () => {
    const dbModule = await import("./db.js");
    const spy = vi.spyOn(dbModule, "persistTask").mockResolvedValue(undefined);

    createTask("task-persist-2", "step", "write_bible");
    updateTask("task-persist-2", { status: "completed", progress: 1 });

    await new Promise((r) => setTimeout(r, 10));

    const calls = spy.mock.calls;
    const updateCall = calls.find((c) => c[2] === "completed");
    expect(updateCall).toBeDefined();
    expect(updateCall![0]).toBe("task-persist-2");
    expect(updateCall![1]).toBe("write_bible");
  });
});

describe("image versions (sidecar JSON)", () => {
  // saveImage needs LOCAL_OUTPUT_DIR set to actually write versioned files.
  // We set it to a temp dir, run the two saves, then inspect listVersions.
  let tempDir: string;
  let originalEnv: string | undefined;

  beforeAll(async () => {
    originalEnv = process.env.LOCAL_OUTPUT_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "ls-storage-test-"));
    process.env.LOCAL_OUTPUT_DIR = tempDir;
  });

  afterAll(() => {
    if (originalEnv === undefined) delete process.env.LOCAL_OUTPUT_DIR;
    else process.env.LOCAL_OUTPUT_DIR = originalEnv;
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }
  });

  it("listVersions returns sidecars for multiple saves of the same entity", async () => {
    // Import dynamically so LOCAL_OUTPUT_DIR is read at call time — storage.ts
    // reads the env var at module load. We bypass that by using saveImage in
    // a fresh import.
    const storage = await import("./storage.js");
    const entity_id = `anchor_${Date.now()}`;
    const buf1 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const buf2 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

    const saved1 = await storage.saveImage("anchor", buf1, {
      entity_id,
      location_id: entity_id,
      prompt: "first prompt",
      model: "nanobanana",
      source_tool: "generate_anchor",
    });
    // Ensure timestamps differ so sort order is deterministic.
    await new Promise((r) => setTimeout(r, 5));
    const saved2 = await storage.saveImage("anchor", buf2, {
      entity_id,
      location_id: entity_id,
      prompt: "second prompt — edited",
      model: "nanobanana",
      source_tool: "generate_anchor",
    });

    expect(saved1.image_id).not.toBe(saved2.image_id);

    const versions = await storage.listVersions("anchor", entity_id);
    expect(versions).toHaveLength(2);
    // Newest first
    expect(versions[0].image_id).toBe(saved2.image_id);
    expect(versions[0].prompt).toBe("second prompt — edited");
    expect(versions[1].image_id).toBe(saved1.image_id);
    expect(versions[1].prompt).toBe("first prompt");
    // Required contract fields
    for (const v of versions) {
      expect(v.entity_id).toBe(entity_id);
      expect(v.kind).toBe("anchor");
      expect(v.uri).toBe(`agent://location-scout/anchor/${entity_id}`);
      expect(v.source_tool).toBe("generate_anchor");
      expect(v.model).toBe("nanobanana");
      expect(v.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it("listVersions returns empty array when no images exist for entity", async () => {
    const storage = await import("./storage.js");
    const versions = await storage.listVersions("anchor", "nonexistent_entity");
    expect(versions).toEqual([]);
  });
});

describe("per-project image namespacing (Fix A)", () => {
  // saveImage and loadImage / loadImageVersion must read the same per-project
  // namespace as JSON loadArtifact. Without this, /artifacts/<kind>/<id>.png
  // can never disambiguate two projects writing the same entity_id, and the
  // user-ref upload path silently lands at the legacy un-namespaced root
  // (see invest-b-image-display.md task B5 — `user-ref/loc_001_…46ce32a2.png`
  // at bucket root, no project prefix).
  let tempDir: string;
  let originalEnv: string | undefined;

  beforeAll(async () => {
    originalEnv = process.env.LOCAL_OUTPUT_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "ls-storage-image-ns-"));
    process.env.LOCAL_OUTPUT_DIR = tempDir;
  });

  afterAll(() => {
    if (originalEnv === undefined) delete process.env.LOCAL_OUTPUT_DIR;
    else process.env.LOCAL_OUTPUT_DIR = originalEnv;
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }
  });

  it("saveImage with explicit project_id writes under namespaced disk path", async () => {
    const storage = await import("./storage.js");
    const entity_id = `anchor_ns_${Date.now()}`;
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const saved = await storage.saveImage("anchor", buf, {
      entity_id,
      location_id: entity_id,
      prompt: "namespaced write",
      model: "nanobanana",
      source_tool: "generate_anchor",
      project_id: "proj_ns_A",
    });
    // local_path must include the project prefix so two projects writing the
    // same entity_id do not race on a single disk slot.
    expect(saved.local_path).toMatch(/[\\/]proj_ns_A[\\/]anchor[\\/]/);
  });

  it("saveImage with NO explicit project_id falls back to ALS context", async () => {
    const storage = await import("./storage.js");
    const log = await import("./log.js");
    const entity_id = `anchor_als_${Date.now()}`;
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    let saved: Awaited<ReturnType<typeof storage.saveImage>> | null = null;
    await log.withRequestContext(
      "req_als_1",
      "upload_reference",
      async () => {
        saved = await storage.saveImage("user-ref", buf, {
          entity_id,
          location_id: entity_id,
          prompt: "uploaded via UI",
          model: "user_upload",
          source_tool: "upload_reference",
        });
      },
      "proj_als_B",
    );
    expect(saved).not.toBeNull();
    // ALS-context project_id must drive the disk path, not the default key.
    expect(saved!.local_path).toMatch(/[\\/]proj_als_B[\\/]user-ref[\\/]/);
    expect(saved!.local_path).not.toMatch(/[\\/]default-project[\\/]/);
  });

  it("loadImage with explicit projectId returns project-A bytes", async () => {
    const storage = await import("./storage.js");
    const entity_id = `iso_load_${Date.now()}`;
    const bufA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xAA]);
    const bufB = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xBB]);
    await storage.saveImage("anchor", bufA, {
      entity_id, location_id: entity_id, prompt: "A",
      model: "test", source_tool: "test", project_id: "proj_load_A",
    });
    await storage.saveImage("anchor", bufB, {
      entity_id, location_id: entity_id, prompt: "B",
      model: "test", source_tool: "test", project_id: "proj_load_B",
    });
    const loadedA = await storage.loadImage("anchor", entity_id, "png", "proj_load_A");
    const loadedB = await storage.loadImage("anchor", entity_id, "png", "proj_load_B");
    expect(loadedA?.data?.[4]).toBe(0xAA);
    expect(loadedB?.data?.[4]).toBe(0xBB);
  });

  it("loadImageBytes(kind, image_id, projectId) helper exists and resolves to bytes", async () => {
    const storage = await import("./storage.js");
    const entity_id = `bytes_${Date.now()}`;
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xCC, 0xDD]);
    const saved = await storage.saveImage("setup", buf, {
      entity_id, location_id: entity_id, prompt: "bytes",
      model: "test", source_tool: "test", project_id: "proj_bytes",
    });
    // loadImageBytes is the LS counterpart of CD v1.0.32 loadImageBytes.
    // It must (a) accept (kind, image_id, projectId), (b) resolve via the
    // project namespace, and (c) return Buffer bytes — not the sidecar.
    const fn = (storage as unknown as { loadImageBytes?: unknown }).loadImageBytes;
    expect(typeof fn).toBe("function");
    const loaded = await storage.loadImageBytes!("setup", saved.image_id, "proj_bytes");
    expect(loaded).not.toBeNull();
    expect(loaded!.contentType).toMatch(/image\//);
    // Match on the unique bytes we wrote so we know it's the right blob.
    expect(loaded!.data.includes(Buffer.from([0xCC, 0xDD]))).toBe(true);
  });

  it("upload_reference threads project_id through ALS into saveImage", async () => {
    // The MCP middleware stamps ALS from arguments.project_id; the tool
    // schema doesn't accept project_id directly, so the ALS fallback in
    // saveImage IS the contract. Without it, every user upload lands at the
    // default slot and bleeds across projects.
    const storage = await import("./storage.js");
    const log = await import("./log.js");
    const entity_id = `upload_${Date.now()}`;
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x55]);
    let saved: Awaited<ReturnType<typeof storage.saveImage>> | null = null;
    await log.withRequestContext(
      "req_upload_1", "upload_reference",
      async () => {
        saved = await storage.saveImage("user-ref", buf, {
          entity_id, location_id: entity_id,
          prompt: "from ui upload", model: "user_upload",
          source_tool: "upload_reference",
        });
      },
      "proj_upload",
    );
    expect(saved).not.toBeNull();
    expect(saved!.local_path).toMatch(/[\\/]proj_upload[\\/]user-ref[\\/]/);
    expect(saved!.local_path).not.toMatch(/[\\/]default-project[\\/]/);
  });
});
