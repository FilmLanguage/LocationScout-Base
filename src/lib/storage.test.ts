import { describe, it, expect, beforeAll, afterAll } from "vitest";
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
    const ids = listLocalArtifacts(t);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids.length).toBe(2);
  });
});

describe("task store", () => {
  it("creates and retrieves a task", () => {
    const task = createTask("task-1", "starting");
    expect(task.task_id).toBe("task-1");
    expect(task.status).toBe("accepted");
    expect(task.progress).toBe(0);

    const retrieved = getTask("task-1");
    expect(retrieved).toEqual(task);
  });

  it("updates a task", () => {
    createTask("task-2", "init");
    const updated = updateTask("task-2", { status: "completed", progress: 100 });
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("completed");
    expect(updated!.progress).toBe(100);
  });

  it("returns null when updating nonexistent task", () => {
    expect(updateTask("nonexistent", { progress: 50 })).toBeNull();
  });

  it("deletes a task", () => {
    createTask("task-3", "temp");
    expect(deleteTask("task-3")).toBe(true);
    expect(getTask("task-3")).toBeNull();
  });

  it("returns false when deleting nonexistent task", () => {
    expect(deleteTask("nonexistent")).toBe(false);
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
      prompt: "first prompt",
      model: "nanobanana",
      source_tool: "generate_anchor",
    });
    // Ensure timestamps differ so sort order is deterministic.
    await new Promise((r) => setTimeout(r, 5));
    const saved2 = await storage.saveImage("anchor", buf2, {
      entity_id,
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
