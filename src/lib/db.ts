/**
 * Yandex Managed PostgreSQL adapter — Phase 1: PG-primary storage.
 *
 * Key changes vs. the previous "best-effort mirror" approach:
 *   - saveArtifactToPg()  → PG is PRIMARY; called inside saveArtifact() before S3/disk.
 *   - waitForDatabase()   → fail-fast exponential-backoff SELECT 1 at startup.
 *   - withDb()            → circuit-breaker wrapper (5 consecutive failures → open 30 s).
 *   - mirrorArtifactToDb  → REMOVED (replaced by saveArtifactToPg).
 *
 * Shadow entity upserts (ensureProject / ensureLocation) are kept for backward
 * compatibility — they ensure v2.projects and v2.locations rows exist before any
 * artifact INSERT references them via project_id FK.
 */

import pg from "pg";
import { z } from "zod";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const { Pool } = pg;

const AGENT_ID = "location_scout";

// ─── Artifact type → table mapping ─────────────────────────────────

interface ArtifactTypeConfig {
  table: string;               // v2.<table>
  entityColumn: "location_id"; // which FK column to populate
  schemaVersion: string;
}

const TYPE_MAP: Record<string, ArtifactTypeConfig> = {
  bible:     { table: "location_bibles",         entityColumn: "location_id", schemaVersion: "location-bible-v2" },
  research:  { table: "location_research_packs", entityColumn: "location_id", schemaVersion: "research-pack-v1" },
  mood:      { table: "mood_states",             entityColumn: "location_id", schemaVersion: "mood-state-v1" },
  floorplan: { table: "floorplans",              entityColumn: "location_id", schemaVersion: "floorplan-v1" },
  setup:     { table: "location_setups",         entityColumn: "location_id", schemaVersion: "location-setup-v1" },
};

// ─── Pool singleton ─────────────────────────────────────────────────

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

export function getPool(): pg.Pool {
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

// ─── Fail-fast startup probe ────────────────────────────────────────

/**
 * Attempt SELECT 1 with exponential backoff up to maxMs.
 * On success returns normally. On timeout calls process.exit(1).
 * Call this in src/index.ts BEFORE server.listen() when DB is enabled.
 */
export async function waitForDatabase(dbPool: pg.Pool, maxMs = 30_000): Promise<void> {
  const start = Date.now();
  let delay = 500;
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      await dbPool.query("SELECT 1");
      console.log(`[db] connected after ${attempt} attempt(s) (${Date.now() - start} ms)`);
      return;
    } catch (err) {
      const elapsed = Date.now() - start;
      if (elapsed + delay > maxMs) {
        console.error(
          `[db] FATAL: could not connect to PostgreSQL within ${maxMs} ms. Last error: ${(err as Error)?.message ?? err}`
        );
        process.exit(1);
      }
      console.warn(`[db] attempt ${attempt} failed (${elapsed} ms elapsed), retrying in ${delay} ms…`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 8_000); // cap at 8 s
    }
  }
}

// ─── Circuit breaker ────────────────────────────────────────────────

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 30_000;

let circuitFailures = 0;
let circuitOpenAt: number | null = null;

export function isCircuitOpen(): boolean {
  if (circuitOpenAt === null) return false;
  if (Date.now() - circuitOpenAt >= CIRCUIT_OPEN_MS) {
    // Half-open: reset so next call is attempted.
    circuitOpenAt = null;
    circuitFailures = 0;
    return false;
  }
  return true;
}

export class StorageUnavailableError extends Error {
  readonly retryable = true;
  readonly code = "STORAGE_UNAVAILABLE";
  constructor() {
    super("Storage circuit is open — database temporarily unavailable");
    this.name = "StorageUnavailableError";
  }
}

/**
 * Wrap any async DB operation with the circuit breaker.
 * If the circuit is open, throws StorageUnavailableError immediately.
 * Each uncaught error increments the failure counter; success resets it.
 */
export async function withDb<T>(fn: (pool: pg.Pool) => Promise<T>): Promise<T> {
  if (isCircuitOpen()) {
    throw new StorageUnavailableError();
  }

  if (!isDbEnabled()) {
    throw new StorageUnavailableError();
  }

  const p = getPool();
  try {
    const result = await fn(p);
    circuitFailures = 0; // success → reset
    return result;
  } catch (err) {
    circuitFailures++;
    if (circuitFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      circuitOpenAt = Date.now();
      console.error(`[db] circuit OPEN after ${circuitFailures} consecutive failures`);
    }
    throw err;
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
  if (type === "mood") return id.split("-")[0] || id;
  return id;
}

// ─── PG-primary artifact save ───────────────────────────────────────

export interface SaveArtifactPgResult {
  artifactId: string;
  version: number;
}

/**
 * Write a JSON artifact as the PRIMARY store to v2.<table> with optimistic
 * locking. Throws on conflict (let caller retry) or DB unavailability.
 *
 * @param type            Artifact type key from TYPE_MAP (e.g. "bible").
 * @param id              Artifact local id (e.g. "loc_001").
 * @param data            Validated payload object.
 * @param zodSchema       Optional Zod schema — if supplied, validates data before INSERT.
 * @param expectedVersion If provided, INSERT checks version = expectedVersion (OCC).
 */
export async function saveArtifactToPg(
  type: string,
  id: string,
  data: unknown,
  zodSchema?: z.ZodTypeAny,
  expectedVersion?: number,
): Promise<SaveArtifactPgResult | null> {
  const mapping = TYPE_MAP[type];
  if (!mapping) {
    // TODO: add mapping for 'validation', 'comparison', 'research-depth' once tables exist in v2.
    return null;
  }

  if (!isDbEnabled()) return null;

  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  // Zod validation before hitting the DB
  if (zodSchema) {
    const result = zodSchema.safeParse(data);
    if (!result.success) {
      const msg = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      throw new Error(`[db] saveArtifactToPg: payload validation failed for ${type}/${id}: ${msg}`);
    }
  }

  const payload = data as Record<string, unknown>;
  const projectKey = extractProjectKey(payload);
  const locationKey = extractLocationKey(type, id, payload);
  const projectTitle = (payload.project_title as string) || projectKey;
  const locationName = (payload.location_name as string) || locationKey;

  return withDb(async (p) => {
    const client = await p.connect();
    try {
      await client.query("BEGIN");
      const projectId = await ensureProject(client, projectKey, projectTitle);
      const locationId = await ensureLocation(client, projectId, locationKey, locationName);

      // Compute next version
      const versionRes = await client.query<{ next_version: number }>(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM v2.${mapping.table}
         WHERE project_id = $1 AND ${mapping.entityColumn} = $2;`,
        [projectId, locationId]
      );
      const nextVersion = versionRes.rows[0].next_version;

      // Optimistic concurrency check — if caller passes expectedVersion, enforce it.
      if (expectedVersion !== undefined) {
        const currentRes = await client.query<{ version: number }>(
          `SELECT version FROM v2.${mapping.table}
           WHERE project_id = $1 AND ${mapping.entityColumn} = $2 AND is_current
           FOR UPDATE;`,
          [projectId, locationId]
        );
        const currentVersion = currentRes.rows[0]?.version ?? 0;
        if (currentVersion !== expectedVersion) {
          await client.query("ROLLBACK");
          throw new Error(
            `[db] optimistic lock conflict for ${type}/${id}: expected version ${expectedVersion}, found ${currentVersion}`
          );
        }
      }

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

      // Event log entry (v2.events if available; fall back to activity_feed)
      try {
        await client.query(
          `INSERT INTO v2.events (project_id, event_type, entity_type, entity_id, payload, published_by)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6);`,
          [projectId, `${type}_saved`, mapping.table, artifactId, JSON.stringify({ artifact_id: artifactId, version: nextVersion }), AGENT_ID]
        );
      } catch {
        // v2.events may not exist yet — fallback to activity_feed.
        await client.query(
          `INSERT INTO v2.activity_feed (project_id, event_type, title, agent_id, target_table, target_id)
           VALUES ($1, $2, $3, $4, $5, $6);`,
          [projectId, `${type}_saved`, `Saved ${type}: ${id}`, AGENT_ID, `v2.${mapping.table}`, artifactId]
        );
      }

      await client.query("COMMIT");
      return { artifactId, version: nextVersion };
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });
}

// ─── Blob: two-phase write (called from storage.ts) ─────────────────

export interface BlobRecord {
  blob_id: string;
  sha256: string;
  s3_uri: string;
}

/**
 * Write blob metadata into v2.blobs + v2.events in a single transaction.
 * Call AFTER the S3 PUT has succeeded.
 */
export async function saveBlobMetadataToPg(
  projectId: string,
  kind: string,
  entityId: string,
  sha256: string,
  s3Uri: string,
  mimeType: string,
  sizeBytes: number,
  meta: Record<string, unknown>,
): Promise<BlobRecord | null> {
  if (!isDbEnabled()) return null;

  return withDb(async (p) => {
    const client = await p.connect();
    try {
      await client.query("BEGIN");

      // Upsert blob row (idempotent on sha256)
      const blobRes = await client.query<{ id: string }>(
        `INSERT INTO v2.blobs
           (project_id, kind, entity_id, sha256, s3_uri, mime_type, size_bytes, created_by_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (sha256) DO UPDATE SET
           entity_id = COALESCE(EXCLUDED.entity_id, v2.blobs.entity_id),
           updated_at = now()
         RETURNING id;`,
        [projectId, kind, entityId, sha256, s3Uri, mimeType, sizeBytes, AGENT_ID]
      );
      const blobId = blobRes.rows[0].id;

      // Event log
      try {
        await client.query(
          `INSERT INTO v2.events (project_id, event_type, entity_type, entity_id, payload, published_by)
           VALUES ($1, 'blob_generated', 'blob', $2, $3::jsonb, $4);`,
          [projectId, blobId, JSON.stringify({ sha256, s3_uri: s3Uri, kind, entity_id: entityId, ...meta }), AGENT_ID]
        );
      } catch {
        // v2.events may not exist — fallback to activity_feed
        await client.query(
          `INSERT INTO v2.activity_feed (project_id, event_type, title, agent_id, target_table, target_id)
           VALUES ($1, 'blob_generated', $2, $3, 'v2.blobs', $4);`,
          [projectId, `Blob ${kind}/${entityId} (${sha256.slice(0, 8)})`, AGENT_ID, blobId]
        );
      }

      await client.query("COMMIT");
      return { blob_id: blobId, sha256, s3_uri: s3Uri };
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });
}

// ─── Introspection helpers (for tests / debug) ──────────────────────

export function supportedArtifactTypes(): string[] {
  return Object.keys(TYPE_MAP);
}

export function artifactTableFor(type: string): string | null {
  return TYPE_MAP[type]?.table ?? null;
}
