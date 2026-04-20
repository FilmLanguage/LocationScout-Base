import { describe, it, expect, afterEach } from "vitest";
import { isDbEnabled, supportedArtifactTypes, artifactTableFor, mirrorArtifactToDb } from "./db.js";

const KEYS = ["YANDEX_DB_HOST", "YANDEX_DB_NAME", "YANDEX_DB_USER", "YANDEX_DB_PASSWORD"] as const;

function snapshotEnv() {
  const snap: Record<string, string | undefined> = {};
  for (const k of KEYS) snap[k] = process.env[k];
  return snap;
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}

describe("db type map", () => {
  it("lists all supported artifact types", () => {
    expect(supportedArtifactTypes().sort()).toEqual(
      ["bible", "floorplan", "mood", "research", "setup"].sort()
    );
  });

  it("maps each type to a v2 table", () => {
    expect(artifactTableFor("bible")).toBe("location_bibles");
    expect(artifactTableFor("research")).toBe("location_research_packs");
    expect(artifactTableFor("mood")).toBe("mood_states");
    expect(artifactTableFor("floorplan")).toBe("floorplans");
    expect(artifactTableFor("setup")).toBe("location_setups");
  });

  it("returns null for unknown types", () => {
    expect(artifactTableFor("validation")).toBeNull();
    expect(artifactTableFor("comparison")).toBeNull();
    expect(artifactTableFor("")).toBeNull();
  });
});

describe("isDbEnabled", () => {
  const snap = snapshotEnv();
  afterEach(() => restoreEnv(snap));

  it("returns false when any required var is missing", () => {
    for (const k of KEYS) delete process.env[k];
    expect(isDbEnabled()).toBe(false);

    process.env.YANDEX_DB_HOST = "h";
    process.env.YANDEX_DB_NAME = "n";
    process.env.YANDEX_DB_USER = "u";
    // password missing
    expect(isDbEnabled()).toBe(false);
  });

  it("returns true only when all four vars are set", () => {
    process.env.YANDEX_DB_HOST = "h";
    process.env.YANDEX_DB_NAME = "n";
    process.env.YANDEX_DB_USER = "u";
    process.env.YANDEX_DB_PASSWORD = "p";
    expect(isDbEnabled()).toBe(true);
  });
});

describe("mirrorArtifactToDb (DB disabled)", () => {
  const snap = snapshotEnv();
  afterEach(() => restoreEnv(snap));

  it("returns null for unsupported type even with DB enabled", async () => {
    process.env.YANDEX_DB_HOST = "h";
    process.env.YANDEX_DB_NAME = "n";
    process.env.YANDEX_DB_USER = "u";
    process.env.YANDEX_DB_PASSWORD = "p";
    expect(await mirrorArtifactToDb("validation", "v_001", { ok: true })).toBeNull();
  });

  it("returns null when DB env vars missing", async () => {
    for (const k of KEYS) delete process.env[k];
    expect(await mirrorArtifactToDb("bible", "loc_001", { bible_id: "loc_001" })).toBeNull();
  });

  it("returns null for non-object payload", async () => {
    process.env.YANDEX_DB_HOST = "h";
    process.env.YANDEX_DB_NAME = "n";
    process.env.YANDEX_DB_USER = "u";
    process.env.YANDEX_DB_PASSWORD = "p";
    expect(await mirrorArtifactToDb("bible", "loc_001", null)).toBeNull();
    expect(await mirrorArtifactToDb("bible", "loc_001", "string")).toBeNull();
    expect(await mirrorArtifactToDb("bible", "loc_001", [1, 2, 3])).toBeNull();
  });
});
