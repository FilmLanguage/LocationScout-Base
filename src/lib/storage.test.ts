import { describe, it, expect } from "vitest";
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
