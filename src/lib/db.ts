/**
 * Yandex Managed PostgreSQL adapter — mirrors Location Scout artifacts into
 * the shared `v2` schema so downstream agents can read them by UUID.
 *
 * Strategy: non-breaking. When YANDEX_DB_* env vars are set, saveArtifact()
 * calls mirrorArtifactToDb() after writing to disk/S3. All DB errors are
 * swallowed with a console.warn — agent functionality never depends on DB.
 *
 * Shadow entities:
 *   - v2.projects.legacy_scenario_id = project_key (string from payload or env)
 *   - v2.locations.legacy_location_id = location_key (string from payload or artifact id)
 *
 * Supported artifact types → tables:
 *   bible         → v2.location_bibles          (location-scoped)
 *   research      → v2.location_research_packs  (location-scoped)
 *   mood          → v2.mood_states              (location-scoped)
 *   floorplan     → v2.floorplans               (location-scoped)
 *   setup         → v2.location_setups          (location + setup_name)
 *
 * Other types (validation, comparison, research-depth) are not mirrored yet.
 */

import pg from "pg";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const { Pool } = pg;

const AGENT_ID = "location_scout";

interface ArtifactTypeConfig {
  table: string;               // v2.<table>
  entityColumn: "location_id"; // which FK column to populate (always location for LS)
  schemaVersion: string;
}

const TYPE_MAP: Record<string, ArtifactTypeConfig> = {
  bible:     { table: "location_bibles",         entityColumn: "location_id", schemaVersion: "location-bible-v2" },
  research:  { table: "location_research_packs", entityColumn: "location_id", schemaVersion: "research-pack-v1" },
  mood:      { table: "mood_states",             entityColumn: "location_id", schemaVersion: "mood-state-v1" },
  floorplan: { table: "floorplans",              entityColumn: "location_id", schemaVersion: "floorplan-v1" },
  setup:     { table: "location_setups",         entityColumn: "location_id", schemaVersion: "location-setup-v1" },
};

let pool: pg.Pool | null = null;

export function isDbEnabled(): boolean {
  return Boolean(
    process.env.YANDEX_DB_HOST &&
    process.env.YANDEX_DB_NAME &&
    process.env.YANDEX_DB_USER &&
    process.env.YANDEX_DB_PASSWORD
  );
}

function resolveCaCert(): string | undefined {
  const explicit = process.env.YANDEX_DB_CA_CERT;
  if (explicit && existsSync(explicit)) return readFileSync(explicit, "utf8");
  const defaultPath = join(homedir(), ".postgresql", "root.crt");
  if (existsSync(defaultPath)) return readFileSync(defaultPath, "utf8");
  return undefined;
}

function getPool(): pg.Pool {
  if (pool) return pool;
  const ca = resolveCaCert();
  pool = new Pool({
    host:     process.env.YANDEX_DB_HOST,
    port:     Number(process.env.YANDEX_DB_PORT || 6432),
    database: process.env.YANDEX_DB_NAME,
    user:     process.env.YANDEX_DB_USER,
    password: process.env.YANDEX_DB_PASSWORD,
    ssl:      ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (err) => console.warn("[db] pool error:", err.message));
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ─── Shadow entity upserts ──────────────────────────────────────────

async function ensureProject(client: pg.PoolClient, projectKey: string, title: string): Promise<string> {
  const res = await client.query<{ id: string }>(
    `INSERT INTO v2.projects (title, legacy_scenario_id)
     VALUES ($1, $2)
     ON CONFLICT (legacy_scenario_id) DO UPDATE SET updated_at = now()
     RETURNING id;`,
    [title, projectKey]
  );
  return res.rows[0].id;
}

async function ensureLocation(
  client: pg.PoolClient,
  projectId: string,
  locationKey: string,
  name: string
): Promise<string> {
  const res = await client.query<{ id: string }>(
    `INSERT INTO v2.locations (project_id, name, legacy_location_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id, name) DO UPDATE SET
       legacy_location_id = EXCLUDED.legacy_location_id,
       updated_at = now()
     RETURNING id;`,
    [projectId, name, locationKey]
  );
  return res.rows[0].id;
}

// ─── Key extraction ─────────────────────────────────────────────────

function extractProjectKey(payload: Record<string, unknown>): string {
  const fromPayload = typeof payload.project_id === "string" ? payload.project_id : null;
  return fromPayload || process.env.LS_DEFAULT_PROJECT_KEY || "default-project";
}

function extractLocationKey(type: string, id: string, payload: Record<string, unknown>): string {
  const candidates = [
    payload.location_id,
    payload.bible_id,
    payload.location_key,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);
  if (candidates.length > 0) return candidates[0];
  // Fallback: the artifact id itself (e.g. "loc_001" for bible, "loc_001-dawn" for mood)
  // Strip trailing variants like "-dawn", "-stormy" from mood ids so they group under one location.
  if (type === "mood") return id.split("-")[0] || id;
  return id;
}

// ─── Main entry point ───────────────────────────────────────────────

/**
 * Best-effort mirror of a saved artifact into v2.
 * Returns the artifact UUID on success, null if skipped, throws on unexpected.
 * Callers wrap with try/catch — DB is never required.
 */
export async function mirrorArtifactToDb(
  type: string,
  id: string,
  data: unknown
): Promise<string | null> {
  const mapping = TYPE_MAP[type];
  if (!mapping) return null;
  if (!isDbEnabled()) return null;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const payload = data as Record<string, unknown>;
  const projectKey = extractProjectKey(payload);
  const locationKey = extractLocationKey(type, id, payload);

  const projectTitle = (payload.project_title as string) || projectKey;
  const locationName = (payload.location_name as string) || locationKey;

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const projectId = await ensureProject(client, projectKey, projectTitle);
    const locationId = await ensureLocation(client, projectId, locationKey, locationName);

    // Compute next version for (project, location, type)
    const versionRes = await client.query<{ next_version: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM v2.${mapping.table}
       WHERE project_id = $1 AND ${mapping.entityColumn} = $2;`,
      [projectId, locationId]
    );
    const nextVersion = versionRes.rows[0].next_version;

    // Mark previous current rows stale
    await client.query(
      `UPDATE v2.${mapping.table}
         SET is_current = FALSE
       WHERE project_id = $1 AND ${mapping.entityColumn} = $2 AND is_current;`,
      [projectId, locationId]
    );

    // Insert new version
    const insertRes = await client.query<{ id: string }>(
      `INSERT INTO v2.${mapping.table}
         (project_id, ${mapping.entityColumn}, version, is_current, schema_version, payload)
       VALUES ($1, $2, $3, TRUE, $4, $5::jsonb)
       RETURNING id;`,
      [projectId, locationId, nextVersion, mapping.schemaVersion, JSON.stringify(payload)]
    );
    const artifactId = insertRes.rows[0].id;

    // Activity feed entry
    await client.query(
      `INSERT INTO v2.activity_feed (project_id, event_type, title, agent_id, target_table, target_id)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [projectId, `${type}_saved`, `Saved ${type}: ${id}`, AGENT_ID, `v2.${mapping.table}`, artifactId]
    );

    await client.query("COMMIT");
    return artifactId;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ─── Introspection helpers (for tests / debug) ──────────────────────

export function supportedArtifactTypes(): string[] {
  return Object.keys(TYPE_MAP);
}

export function artifactTableFor(type: string): string | null {
  return TYPE_MAP[type]?.table ?? null;
}
