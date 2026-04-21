/**
 * Tests for edit-mode helpers: preservation-biased prompt composition +
 * base-image resolution against the gallery.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("composeEditPrompt", () => {
  it("wraps the user's change in a preservation-biased directive with location-appropriate wording", async () => {
    const { composeEditPrompt } = await import("./edit-mode.js");
    const prompt = composeEditPrompt("add golden-hour sunset through window");
    expect(prompt).toContain("Given the reference image");
    expect(prompt).toContain("add golden-hour sunset through window");
    expect(prompt).toContain("Preserve all other visible elements");
    // LocationScout-specific hints (not "face/pose" like CastingDirector)
    expect(prompt).toContain("composition");
    expect(prompt).toContain("lighting");
    expect(prompt).toContain("location-specific details");
  });
});

describe("resolveEditBase", () => {
  let tempDir: string;
  let originalEnv: string | undefined;

  beforeAll(() => {
    originalEnv = process.env.LOCAL_OUTPUT_DIR;
    tempDir = mkdtempSync(join(tmpdir(), "ls-edit-mode-test-"));
    process.env.LOCAL_OUTPUT_DIR = tempDir;
  });

  afterAll(() => {
    if (originalEnv === undefined) delete process.env.LOCAL_OUTPUT_DIR;
    else process.env.LOCAL_OUTPUT_DIR = originalEnv;
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* best effort */ }
  });

  it("picks the newest gallery version when no base_image_id is given", async () => {
    const storage = await import("./storage.js");
    const { resolveEditBase } = await import("./edit-mode.js");
    const bible_id = `loc_edit_${Date.now()}`;
    // 1x1 PNG bytes
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==",
      "base64",
    );
    const v1 = await storage.saveImage("anchor", png, {
      entity_id: bible_id,
      prompt: "v1 dim office",
      model: "nanobanana",
      source_tool: "generate_anchor",
    });
    await new Promise((r) => setTimeout(r, 10));
    const v2 = await storage.saveImage("anchor", png, {
      entity_id: bible_id,
      prompt: "v2 sunset office",
      model: "nanobanana",
      source_tool: "generate_anchor",
    });

    const resolved = await resolveEditBase("anchor", bible_id, undefined);
    expect(resolved).not.toBeNull();
    expect(resolved!.image_id).toBe(v2.image_id);
    expect(resolved!.dataUrl.startsWith("data:image/png;base64,")).toBe(true);

    // Now pin to v1 explicitly.
    const pinned = await resolveEditBase("anchor", bible_id, v1.image_id);
    expect(pinned).not.toBeNull();
    expect(pinned!.image_id).toBe(v1.image_id);
  });

  it("returns null when no versions exist for the entity", async () => {
    const { resolveEditBase } = await import("./edit-mode.js");
    const result = await resolveEditBase("anchor", `missing_${Date.now()}`, undefined);
    expect(result).toBeNull();
  });

  it("supports a chained edit: v1 → v2 → v3 with parent_version_id sidecar trail", async () => {
    const storage = await import("./storage.js");
    const { resolveEditBase } = await import("./edit-mode.js");
    const bible_id = `loc_chain_${Date.now()}`;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==",
      "base64",
    );

    // v1 — initial generation (no parent).
    const v1 = await storage.saveImage("anchor", png, {
      entity_id: bible_id,
      prompt: "dim office interior",
      model: "nanobanana",
      source_tool: "generate_anchor",
    });
    await new Promise((r) => setTimeout(r, 10));

    // v2 — first edit derived from v1.
    const base1 = await resolveEditBase("anchor", bible_id, undefined);
    expect(base1!.image_id).toBe(v1.image_id);
    const v2 = await storage.saveImage("anchor", png, {
      entity_id: bible_id,
      prompt: "edit: add golden-hour sunset through window",
      model: "nanobanana",
      source_tool: "generate_anchor",
      parent_version_id: base1!.image_id,
    });
    await new Promise((r) => setTimeout(r, 10));

    // v3 — second edit, chained from v2 (newest auto-resolve).
    const base2 = await resolveEditBase("anchor", bible_id, undefined);
    expect(base2!.image_id).toBe(v2.image_id);
    const v3 = await storage.saveImage("anchor", png, {
      entity_id: bible_id,
      prompt: "edit: add dust motes",
      model: "nanobanana",
      source_tool: "generate_anchor",
      parent_version_id: base2!.image_id,
    });

    // Walk the chain via listVersions sidecars.
    const versions = await storage.listVersions("anchor", bible_id);
    expect(versions).toHaveLength(3);
    const byId = new Map(versions.map((v) => [v.image_id, v]));
    expect(byId.get(v1.image_id)!.parent_version_id).toBeUndefined();
    expect(byId.get(v2.image_id)!.parent_version_id).toBe(v1.image_id);
    expect(byId.get(v3.image_id)!.parent_version_id).toBe(v2.image_id);
  });
});
