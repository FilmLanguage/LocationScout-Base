import { describe, it, expect, afterEach } from "vitest";
import { isDbEnabled, supportedArtifactTypes, artifactTableFor, saveArtifactToPg, deriveSetupName } from "./db.js";

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

describe("saveArtifactToPg (DB disabled)", () => {
  const snap = snapshotEnv();
  afterEach(() => restoreEnv(snap));

  it("returns null for unsupported type regardless of DB env", async () => {
    process.env.YANDEX_DB_HOST = "h";
    process.env.YANDEX_DB_NAME = "n";
    process.env.YANDEX_DB_USER = "u";
    process.env.YANDEX_DB_PASSWORD = "p";
    // "validation" is not in TYPE_MAP → null without hitting the network
    expect(await saveArtifactToPg("validation", "v_001", { ok: true })).toBeNull();
  });

  it("returns null when DB env vars missing", async () => {
    for (const k of KEYS) delete process.env[k];
    expect(await saveArtifactToPg("bible", "loc_001", { bible_id: "loc_001" })).toBeNull();
  });

  it("returns null for non-object payload", async () => {
    process.env.YANDEX_DB_HOST = "h";
    process.env.YANDEX_DB_NAME = "n";
    process.env.YANDEX_DB_USER = "u";
    process.env.YANDEX_DB_PASSWORD = "p";
    expect(await saveArtifactToPg("bible", "loc_001", null)).toBeNull();
    expect(await saveArtifactToPg("bible", "loc_001", "string")).toBeNull();
    expect(await saveArtifactToPg("bible", "loc_001", [1, 2, 3])).toBeNull();
  });
});

describe("deriveSetupName (location_setups.setup_name NOT NULL)", () => {
  it("returns explicit setup_name when present", () => {
    expect(deriveSetupName("setup_S1_A", { setup_name: "Wide kitchen establish" })).toBe("Wide kitchen establish");
  });

  it("trims and caps explicit setup_name to 200 chars", () => {
    const long = "  " + "x".repeat(300) + "  ";
    const out = deriveSetupName("setup_S1_A", { setup_name: long });
    expect(out.length).toBe(200);
    expect(out.startsWith("x")).toBe(true);
  });

  it("falls back to composition snippet (80 chars)", () => {
    const composition = "Low-angle from doorway, foreground table dressed with letters";
    expect(deriveSetupName("setup_S1_A", { composition })).toBe(composition);
  });

  it("falls back to scene_id + setup_id when no name/composition", () => {
    expect(deriveSetupName("setup_S1_A", { scene_id: "S1", setup_id: "setup_S1_A" })).toBe("S1 — setup_S1_A");
  });

  it("falls back to setup_id alone when no scene_id", () => {
    expect(deriveSetupName("setup_xyz", { setup_id: "setup_xyz" })).toBe("setup_xyz");
  });

  it("falls back to id when payload is empty", () => {
    expect(deriveSetupName("setup_fallback", {})).toBe("setup_fallback");
  });

  it("never returns empty string", () => {
    expect(deriveSetupName("", {})).toBe("Untitled setup");
  });

  it("ignores non-string setup_name", () => {
    expect(deriveSetupName("setup_xyz", { setup_name: 42, setup_id: "setup_xyz" })).toBe("setup_xyz");
  });
});
