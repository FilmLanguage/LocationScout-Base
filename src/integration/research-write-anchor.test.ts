// @vitest-environment node
/**
 * Integration test — Task 4.1 from discipline-plan.md (replicates 1AD POC ff18f99).
 *
 * Spins up real Postgres via testcontainers, applies workspace v2 DDL, then
 * exercises the same storage code path that LocationScout's canonical chain
 * (research_era → write_bible → generate_anchor) hits at runtime:
 *
 *   saveArtifact("research", id, ...)  → saveArtifactToPg → INSERT v2.location_research_packs + v2.events
 *   saveArtifact("bible",    id, ...)  → saveArtifactToPg → INSERT v2.location_bibles         + v2.events
 *   saveBlobTwoPhase(...) [anchor PNG] → saveBlobMetadataToPg → INSERT v2.blobs + v2.events
 *   loadArtifact("research"|"bible")   ← what get_research / get_bible return to MCP clients
 *
 * The MCP tool entry points (research_era / write_bible / generate_anchor) wrap
 * Anthropic + FAL.ai calls that are out of scope for an integration test — but
 * the storage layer they ultimately call IS the thing this test exists to lock
 * down. Auth+RT crisis lesson: mocked PG unit tests passed for years while
 * production was broken.
 *
 * Run with: npm run test:integration:pg   (requires Docker)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const DDL_PATH = resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "repos",
  "ai-stanislavsky-workspace",
  "db",
  "v2-schema.sql",
);

const PROJECT_SLUG = `it-poc-${Date.now()}`;
const LOCATION_KEY = "loc_001";
const RESEARCH_ID  = "research_001";

// Module-level handles populated by beforeAll.
let container: StartedPostgreSqlContainer;
let pool: pg.Pool;
// Late-bound after env vars are set, so storage.ts/db.ts read the right config.
let saveArtifact:     typeof import("../lib/storage.js").saveArtifact;
let loadArtifact:     typeof import("../lib/storage.js").loadArtifact;
let saveBlobTwoPhase: typeof import("../lib/storage.js").saveBlobTwoPhase;
let closePool:        typeof import("../lib/db.js").closePool;

const validResearch = {
  $schema: "research-pack-v1" as const,
  research_id: RESEARCH_ID,
  brief_id: "brief_001",
  vision_id: "vision_001",
  period_facts: [
    { fact: "1920s tenement kitchens used coal-fired ranges, no gas" },
  ],
  typical_elements: [
    "cast-iron range",
    "wooden iceboxes",
    "oilcloth-covered tables",
  ],
  anachronism_list: ["microwave", "stainless steel", "LED bulbs"],
  research_status: "draft" as const,
  project_id: PROJECT_SLUG,
  location_id: LOCATION_KEY,
  location_name: "Tenement Kitchen",
};

const validBible = {
  $schema: "location-bible-v2" as const,
  bible_id: LOCATION_KEY,
  brief_id: "brief_001",
  vision_id: "vision_001",
  research_id: RESEARCH_ID,
  passport: {
    type: "INT" as const,
    time_of_day: ["DAY"],
    era: "1920s NYC tenement",
    recurring: true,
    scenes: ["scene_001", "scene_002", "scene_003"],
  },
  space_description:
    "A cramped 1920s Lower East Side tenement kitchen, low ceilings darkened by years of coal smoke. " +
    "A blackened cast-iron range dominates the back wall, its chimney pipe disappearing through a tin-patched ceiling. " +
    "Oilcloth covers a small wooden table beneath the single window facing an airshaft.",
  atmosphere: "Cramped, smoke-stained, working-class intimacy",
  light_base_state: {
    primary_source: "airshaft window",
    direction: "E",
    color_temp_kelvin: 5500,
    shadow_hardness: "soft" as const,
    fill_to_key_ratio: "1:4",
    practical_sources: ["kerosene lamp on table", "range firelight"],
  },
  key_details: [
    "blackened cast-iron range",
    "oilcloth-covered table",
    "airshaft window",
    "tin-patched ceiling",
    "kerosene lamp",
  ],
  negative_list: ["microwave", "stainless steel", "LED bulbs"],
  approval_status: "draft" as const,
  project_id: PROJECT_SLUG,
  location_name: "Tenement Kitchen",
};

describe("integration: LocationScout storage chain against real Postgres", () => {
  beforeAll(async () => {
    // 1. Spin up Postgres 16 (matches Yandex Managed PG major in prod).
    container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("filmlanguage_test")
      .withUsername("test")
      .withPassword("test")
      .start();

    // 2. Apply workspace v2 DDL.
    const ddl = readFileSync(DDL_PATH, "utf8");
    pool = new pg.Pool({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: container.getDatabase(),
      user: container.getUsername(),
      password: container.getPassword(),
    });
    await pool.query(ddl);

    // 3. Configure LocationScout's PG client to point at the testcontainer.
    //    Must happen BEFORE importing src/lib/db.ts (env read at module load).
    process.env.YANDEX_DB_HOST     = container.getHost();
    process.env.YANDEX_DB_PORT     = String(container.getMappedPort(5432));
    process.env.YANDEX_DB_NAME     = container.getDatabase();
    process.env.YANDEX_DB_USER     = container.getUsername();
    process.env.YANDEX_DB_PASSWORD = container.getPassword();
    delete process.env.YANDEX_DB_CA_CERT; // local container has no TLS

    const storage = await import("../lib/storage.js");
    const db      = await import("../lib/db.js");
    saveArtifact     = storage.saveArtifact;
    loadArtifact     = storage.loadArtifact;
    saveBlobTwoPhase = storage.saveBlobTwoPhase;
    closePool        = db.closePool;
  }, 120_000);

  afterAll(async () => {
    if (closePool) await closePool();
    if (pool)      await pool.end();
    if (container) await container.stop();
  });

  it("research_era → write_bible → generate_anchor storage path writes v2 rows + events; readback returns parsed JSON", async () => {
    // ── Step 1: equivalent of research_era (writes research-pack JSON).
    await saveArtifact("research", RESEARCH_ID, validResearch);

    const projects = await pool.query<{ id: string }>(
      "SELECT id FROM v2.projects WHERE legacy_scenario_id = $1",
      [PROJECT_SLUG],
    );
    expect(projects.rowCount).toBe(1);
    const projectUuid = projects.rows[0].id;

    const locations = await pool.query<{ id: string }>(
      "SELECT id FROM v2.locations WHERE project_id = $1 AND legacy_location_id = $2",
      [projectUuid, RESEARCH_ID],
    );
    expect(locations.rowCount).toBe(1);

    const research = await pool.query(
      `SELECT id, schema_version, payload
         FROM v2.location_research_packs
        WHERE project_id = $1 AND is_current = TRUE`,
      [projectUuid],
    );
    expect(research.rowCount).toBe(1);
    expect(research.rows[0].schema_version).toBe("research-pack-v1");
    expect((research.rows[0].payload as any).research_id).toBe(RESEARCH_ID);

    const researchEvents = await pool.query(
      `SELECT event_type, entity_type, published_by
         FROM v2.events
        WHERE project_id = $1 AND event_type = 'research_saved'`,
      [projectUuid],
    );
    expect(researchEvents.rowCount).toBeGreaterThanOrEqual(1);
    expect(researchEvents.rows[0].entity_type).toBe("location");
    expect(researchEvents.rows[0].published_by).toBe("location_scout");

    // ── Step 2: equivalent of write_bible (writes location-bible JSON).
    await saveArtifact("bible", LOCATION_KEY, validBible);

    const bibleLocs = await pool.query<{ id: string }>(
      "SELECT id FROM v2.locations WHERE project_id = $1 AND legacy_location_id = $2",
      [projectUuid, LOCATION_KEY],
    );
    expect(bibleLocs.rowCount).toBe(1);
    const locationUuid = bibleLocs.rows[0].id;

    const bibles = await pool.query(
      `SELECT id, schema_version, payload
         FROM v2.location_bibles
        WHERE project_id = $1 AND location_id = $2 AND is_current = TRUE`,
      [projectUuid, locationUuid],
    );
    expect(bibles.rowCount).toBe(1);
    expect(bibles.rows[0].schema_version).toBe("location-bible-v2");
    expect((bibles.rows[0].payload as any).bible_id).toBe(LOCATION_KEY);

    const bibleEvents = await pool.query(
      `SELECT event_type, entity_id, published_by
         FROM v2.events
        WHERE project_id = $1 AND event_type = 'bible_saved'`,
      [projectUuid],
    );
    expect(bibleEvents.rowCount).toBeGreaterThanOrEqual(1);
    expect(bibleEvents.rows[0].entity_id).toBe(locationUuid);
    expect(bibleEvents.rows[0].published_by).toBe("location_scout");

    // ── Step 3: equivalent of generate_anchor — blob (PNG bytes) write path.
    //    saveImage() in production wraps this; we call the primitive directly so the
    //    test does not depend on FAL.ai or filesystem-write quirks.
    const fakePng = Buffer.from("fake-png-bytes-for-integration-test");
    const blob = await saveBlobTwoPhase(
      fakePng,
      "anchor",
      locationUuid,
      projectUuid,
      { prompt: "test prompt", model: "fal-ai/flux", source_tool: "generate_anchor" },
      "image/png",
    );
    expect(blob.sha256).toMatch(/^[0-9a-f]{64}$/);

    const blobs = await pool.query(
      `SELECT id, kind, sha256, size_bytes, created_by_agent
         FROM v2.blobs
        WHERE project_id = $1 AND kind = 'anchor'`,
      [projectUuid],
    );
    expect(blobs.rowCount).toBe(1);
    expect(blobs.rows[0].sha256).toBe(blob.sha256);
    expect(blobs.rows[0].size_bytes).toBe(String(fakePng.length));
    expect(blobs.rows[0].created_by_agent).toBe("location_scout");

    const blobEvents = await pool.query(
      `SELECT event_type, entity_type, published_by
         FROM v2.events
        WHERE project_id = $1 AND event_type = 'blob_generated'`,
      [projectUuid],
    );
    expect(blobEvents.rowCount).toBeGreaterThanOrEqual(1);
    expect(blobEvents.rows[0].entity_type).toBe("blob");
    expect(blobEvents.rows[0].published_by).toBe("location_scout");

    // ── Step 4: equivalent of get_research / get_bible — must return parsed JSON.
    //    LocationScout's loadArtifact reads from L1 memory cache (populated by saveArtifact).
    const researchRead = await loadArtifact<{ research_id: string; period_facts: unknown[] }>(
      "research",
      RESEARCH_ID,
    );
    expect(researchRead).not.toBeNull();
    expect(researchRead!.research_id).toBe(RESEARCH_ID);
    expect(Array.isArray(researchRead!.period_facts)).toBe(true);

    const bibleRead = await loadArtifact<{ bible_id: string; key_details: string[] }>(
      "bible",
      LOCATION_KEY,
    );
    expect(bibleRead).not.toBeNull();
    expect(bibleRead!.bible_id).toBe(LOCATION_KEY);
    expect(bibleRead!.key_details.length).toBeGreaterThanOrEqual(5);
  }, 60_000);
});
