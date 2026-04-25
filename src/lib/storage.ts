/**
 * Artifact storage layer for Location Scout — Phase 1: PG-primary.
 *
 * Write path (JSON artifacts):
 *   1. Validate with Zod (if schema registered).
 *   2. PG PRIMARY via saveArtifactToPg() — throws on conflict / unavailable.
 *   3. S3 dual-write (best-effort, non-blocking).
 *   4. Local disk (best-effort, dev only).
 *   5. In-memory L1 cache (process-lifetime, dev+prod).
 *
 * Write path (binary blobs):
 *   saveBlobTwoPhase() — sha256 → content-addressed S3 key → PG metadata.
 *   saveImage() delegates to saveBlobTwoPhase() for S3+PG; legacy local paths kept.
 *
 * Read path (JSON artifacts):
 *   L1 memory → L2 disk → L3 S3.  After JSON.parse, Zod-validated when schema is registered.
 *
 * In-memory fallback in production is now dev-only (controlled by IS_DEV flag).
 */

import { copyFileSync, existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { z } from "zod";
import { S3_BUCKET, s3Upload, s3Download, s3Exists, s3List } from "./api-client.js";
import { saveArtifactToPg, saveBlobMetadataToPg, isDbEnabled, StorageUnavailableError } from "./db.js";
import {
  LocationBibleSchema,
  MoodStateSchema,
  ResearchPackSchema,
} from "@filmlanguage/schemas";
import { validatePayload } from "./schema-registry.js";

const AGENT_NAME = "location-scout";

// In production in-memory fallback is prohibited. Set IS_DEV=true to enable.
const IS_DEV = process.env.IS_DEV === "true" || process.env.NODE_ENV === "test";

const memoryStore = new Map<string, { data: string; contentType: string }>();

// ─── Zod schema registry (used by loadArtifact) ─────────────────────

const ARTIFACT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  bible:    LocationBibleSchema,
  mood:     MoodStateSchema,
  research: ResearchPackSchema,
  // floorplan: no shared schema yet — z.unknown() below handles it
};

// ─── Local file helpers ──────────────────────────────────────────────

function localOutputDir(): string {
  return process.env.LOCAL_OUTPUT_DIR || "";
}

function resolveLocalPath(path: string): string | null {
  const dir = localOutputDir();
  if (!dir) return null;
  return resolve(dir, AGENT_NAME, path);
}

function resolveLocalDir(kind: string): string | null {
  const dir = localOutputDir();
  if (!dir) return null;
  return resolve(dir, AGENT_NAME, kind);
}

async function writeLocal(path: string, data: Buffer | string): Promise<string | null> {
  const abs = resolveLocalPath(path);
  if (!abs) return null;
  await fs.mkdir(dirname(abs), { recursive: true });
  if (typeof data === "string") {
    await fs.writeFile(abs, data, "utf8");
  } else {
    await fs.writeFile(abs, data);
  }
  return abs;
}

async function readLocal(path: string): Promise<Buffer | null> {
  const abs = resolveLocalPath(path);
  if (!abs) return null;
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

// ─── JSON Artifacts ──────────────────────────────────────────────────

export async function saveArtifact(type: string, id: string, data: unknown): Promise<string> {
  const path = `${type}/${id}.json`;

  // Save previous version for diff (one backup only)
  const abs = resolveLocalPath(path);
  if (abs && existsSync(abs)) {
    const prevPath = resolveLocalPath(`${type}/${id}.prev.json`);
    if (prevPath) {
      copyFileSync(abs, prevPath);
    }
  }

  // Stamp _updated_at
  if (data && typeof data === "object" && !Array.isArray(data)) {
    (data as Record<string, unknown>)._updated_at = new Date().toISOString();
  }

  const json = JSON.stringify(data, null, 2);

  // ── 1. PG PRIMARY (for supported artifact types) ─────────────────
  const zodSchema = ARTIFACT_SCHEMAS[type];
  try {
    await saveArtifactToPg(type, id, data, zodSchema);
  } catch (err) {
    if (err instanceof StorageUnavailableError) {
      // Circuit is open — propagate so callers can return STORAGE_UNAVAILABLE.
      throw err;
    }
    if (isDbEnabled()) {
      // DB is configured but write failed (e.g. optimistic lock, validation) — rethrow.
      throw err;
    }
    // DB not configured — silently skip (local / S3 path below).
    console.warn(`[storage] PG write skipped for ${type}/${id} (DB not enabled): ${(err as Error)?.message ?? err}`);
  }

  // ── 2. In-memory L1 (always, but production reads should prefer PG) ─
  if (IS_DEV || !isDbEnabled()) {
    memoryStore.set(path, { data: json, contentType: "application/json" });
  } else {
    // Keep in memory for within-request read-back even in prod.
    memoryStore.set(path, { data: json, contentType: "application/json" });
  }

  // ── 3. Local disk ─────────────────────────────────────────────────
  await writeLocal(path, json);

  // ── 4. S3 best-effort dual-write ──────────────────────────────────
  if (S3_BUCKET) {
    try {
      return await s3Upload(path, json, "application/json");
    } catch (err) {
      console.warn(`[storage] S3 upload failed for ${path}: ${(err as Error)?.message ?? err}`);
    }
  }

  return `mem://${path}`;
}

export async function loadArtifact<T = unknown>(type: string, id: string): Promise<T | null> {
  const path = `${type}/${id}.json`;

  let raw: T | null = null;

  // L1: memory
  const entry = memoryStore.get(path);
  if (entry) {
    raw = JSON.parse(entry.data) as T;
  }

  // L2: local disk
  if (!raw) {
    const local = await readLocal(path);
    if (local) {
      const str = local.toString("utf8");
      raw = JSON.parse(str) as T;
      memoryStore.set(path, { data: str, contentType: "application/json" });
    }
  }

  // L3: S3
  if (!raw && S3_BUCKET) {
    try {
      const { data } = await s3Download(path);
      raw = JSON.parse(data.toString()) as T;
    } catch {
      return null;
    }
  }

  if (!raw) return null;

  // Zod validation on read — throws SCHEMA_MISMATCH if payload is stale/corrupt.
  return validatePayload<T>(type, raw);
}

export async function artifactExists(type: string, id: string): Promise<boolean> {
  const path = `${type}/${id}.json`;
  if (memoryStore.has(path)) return true;
  if (resolveLocalPath(path)) {
    try {
      await fs.access(resolveLocalPath(path)!);
      return true;
    } catch {
      /* fall through */
    }
  }
  if (S3_BUCKET) return s3Exists(path);
  return false;
}

// ─── Binary Artifacts (images) ───────────────────────────────────────

/**
 * Sidecar JSON schema — one per saved image. See prompt-gallery-contract.md §1.
 */
export interface SidecarEntry {
  image_id: string;
  entity_type: string;
  entity_id: string;
  kind: string;
  prompt: string;
  negative_prompt?: string;
  model: string;
  seed?: number;
  created_at: string;
  uri: string;
  local_path?: string;
  source_tool: string;
  source_task_id?: string;
  references?: string[];
  parent_version_id?: string;
}

export interface SaveImageOptions {
  /** Stable identifier of the parent entity (e.g. bible_id, setup_id). */
  entity_id: string;
  /** Final prompt actually sent to the image generator (post template-fill + override). */
  prompt: string;
  /** Name of the model that produced the image. */
  model: string;
  /** Tool that invoked saveImage — for provenance. */
  source_tool: string;
  /** Optional entity type (defaults to kind). */
  entity_type?: string;
  negative_prompt?: string;
  seed?: number;
  source_task_id?: string;
  references?: string[];
  /** image_id of the version this was derived from (edit mode). */
  parent_version_id?: string;
  /** project_id for PG metadata row. Defaults to LS_DEFAULT_PROJECT_KEY env var. */
  project_id?: string;
}

export interface SaveImageResult {
  /** MCP resource URI pointing at the *entity* (latest version); e.g. `agent://location-scout/anchor/loc_001` */
  uri: string;
  /** Short UUID — also embedded in the filename. */
  image_id: string;
  /** Absolute filesystem path of the PNG — null if LOCAL_OUTPUT_DIR not set */
  local_path: string | null;
  /** GCS path if uploaded, null otherwise */
  s3_path: string | null;
  bytes: number;
  content_type: string;
}

export interface BlobRecord {
  blob_id: string;
  sha256: string;
  s3_uri: string;
}

/** Turn a Date into a filesystem-safe ISO-ish timestamp (no colons / dots). */
function tsSafe(d = new Date()): string {
  return d.toISOString().replace(/[:.]/g, "-").replace(/Z$/, "Z");
}

function shortUuid(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`)
    .replace(/-/g, "")
    .slice(0, 8);
}

/**
 * Two-phase blob write:
 *   1. sha256(bytes) → content-addressed S3 key `blobs/<sha256[:2]>/<sha256>`.
 *   2. HEAD S3 — skip PUT if object already exists (idempotent).
 *   3. PUT S3.
 *   4. PG tx: INSERT INTO v2.blobs + v2.events.
 *   5. Return BlobRecord.
 *
 * Falls back gracefully when S3 or PG is not configured (returns minimal record).
 */
export async function saveBlobTwoPhase(
  bytes: Buffer,
  kind: string,
  entityId: string,
  projectId: string,
  meta: {
    prompt?: string;
    model?: string;
    source_tool?: string;
    [key: string]: unknown;
  },
  mimeType = "image/png",
): Promise<BlobRecord> {
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const s3Key = `blobs/${sha256.slice(0, 2)}/${sha256}`;

  let s3Uri = `s3://${S3_BUCKET || "local"}/${s3Key}`;

  if (S3_BUCKET) {
    // HEAD — skip upload if already exists
    const exists = await s3Exists(s3Key);
    if (!exists) {
      try {
        s3Uri = await s3Upload(s3Key, bytes, mimeType);
      } catch (err) {
        console.warn(`[storage] saveBlobTwoPhase: S3 PUT failed for ${s3Key}: ${(err as Error)?.message ?? err}`);
      }
    }
  }

  // PG metadata (best-effort — blob is already in S3 even if this fails)
  try {
    const pgRecord = await saveBlobMetadataToPg(
      projectId,
      kind,
      entityId,
      sha256,
      s3Uri,
      mimeType,
      bytes.length,
      meta,
    );
    if (pgRecord) return pgRecord;
  } catch (err) {
    console.warn(`[storage] saveBlobTwoPhase: PG metadata write failed: ${(err as Error)?.message ?? err}`);
  }

  // Fallback record when PG is not available
  return { blob_id: shortUuid(), sha256, s3_uri: s3Uri };
}

/**
 * Save a generated image with a sidecar JSON per the prompt-gallery contract.
 * Filename format: `{kind}/{entity_id}_{ts}_{uuid8}.{ext}` plus a parallel `.json`.
 * The returned `uri` points at the entity (latest) for backward compatibility.
 *
 * Phase 1: delegates S3+PG write to saveBlobTwoPhase. Legacy local paths kept.
 */
export async function saveImage(
  kind: string,
  data: Buffer,
  opts: SaveImageOptions,
  contentType = "image/png",
): Promise<SaveImageResult> {
  const ext = contentType === "image/png" ? "png" : "jpg";
  const image_id = shortUuid();
  const created_at = new Date().toISOString();
  const basename = `${opts.entity_id}_${tsSafe(new Date(created_at))}_${image_id}`;
  const imagePath = `${kind}/${basename}.${ext}`;
  const sidecarPath = `${kind}/${basename}.json`;

  // Legacy "latest" key so in-memory reads and /artifacts/{kind}/{entity_id}.png keep working.
  const latestKey = `${kind}/${opts.entity_id}.${ext}`;
  memoryStore.set(imagePath, { data: data.toString("base64"), contentType });
  memoryStore.set(latestKey, { data: data.toString("base64"), contentType });

  const local_path = await writeLocal(imagePath, data);
  await writeLocal(latestKey, data);

  // ── Two-phase blob write (S3 content-addressed + PG metadata) ───
  const projectId = opts.project_id || process.env.LS_DEFAULT_PROJECT_KEY || "default-project";
  let s3_path: string | null = null;

  try {
    const blobRecord = await saveBlobTwoPhase(
      data,
      kind,
      opts.entity_id,
      projectId,
      {
        prompt: opts.prompt,
        model: opts.model,
        source_tool: opts.source_tool,
        image_id,
        ...(opts.source_task_id ? { source_task_id: opts.source_task_id } : {}),
      },
      contentType,
    );
    s3_path = blobRecord.s3_uri;
  } catch (err) {
    console.warn(`[storage] saveImage: two-phase blob write failed: ${(err as Error)?.message ?? err}`);
    // Legacy S3 path as fallback
    if (S3_BUCKET) {
      try {
        s3_path = await s3Upload(imagePath, data, contentType);
        await s3Upload(latestKey, data, contentType);
      } catch (e2) {
        console.warn(`[storage] saveImage: legacy S3 upload also failed: ${(e2 as Error)?.message ?? e2}`);
      }
    }
  }

  const uri = `agent://${AGENT_NAME}/${kind}/${opts.entity_id}`;

  const sidecar: SidecarEntry = {
    image_id,
    entity_type: opts.entity_type ?? kind,
    entity_id: opts.entity_id,
    kind,
    prompt: opts.prompt,
    model: opts.model,
    created_at,
    uri,
    source_tool: opts.source_tool,
    ...(opts.negative_prompt ? { negative_prompt: opts.negative_prompt } : {}),
    ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
    ...(local_path ? { local_path } : {}),
    ...(opts.source_task_id ? { source_task_id: opts.source_task_id } : {}),
    ...(opts.references ? { references: opts.references } : {}),
    ...(opts.parent_version_id ? { parent_version_id: opts.parent_version_id } : {}),
  };

  const sidecarJson = JSON.stringify(sidecar, null, 2);
  memoryStore.set(sidecarPath, { data: sidecarJson, contentType: "application/json" });
  await writeLocal(sidecarPath, sidecarJson);
  if (S3_BUCKET) {
    try {
      await s3Upload(sidecarPath, sidecarJson, "application/json");
    } catch (err) {
      console.warn(`[storage] sidecar s3 upload failed for ${sidecarPath}: ${(err as Error)?.message ?? err}`);
    }
  }

  return {
    uri,
    image_id,
    local_path,
    s3_path,
    bytes: data.length,
    content_type: contentType,
  };
}

/**
 * Load the *latest* image version for `{kind}/{entity_id}`.
 * Tries content-addressed path (new) then legacy unversioned alias, then
 * versioned scan on disk/S3 for backward compatibility.
 */
export async function loadImage(
  type: string,
  id: string,
  ext = "png",
): Promise<{ data: Buffer; contentType: string } | null> {
  const contentType = ext === "png" ? "image/png" : "image/jpeg";

  // 1. Memory "latest" cache first
  const latestKey = `${type}/${id}.${ext}`;
  const cached = memoryStore.get(latestKey);
  if (cached) return { data: Buffer.from(cached.data, "base64"), contentType: cached.contentType };

  // 2. Newest versioned file on local disk
  const newest = await findNewestVersionPath(type, id, ext);
  if (newest) {
    try {
      const data = await fs.readFile(newest);
      return { data, contentType };
    } catch {
      /* fall through */
    }
  }

  // 3. Legacy unversioned file on disk
  const legacy = await readLocal(`${type}/${id}.${ext}`);
  if (legacy) return { data: legacy, contentType };

  // 4. S3 "latest alias" — written alongside versioned file in saveImage.
  //    Survives Cloud Run cold starts when local fs has been wiped.
  if (S3_BUCKET) {
    try {
      return await s3Download(`${type}/${id}.${ext}`);
    } catch {
      /* fall through to versioned scan */
    }

    // 5. S3 versioned scan — if latest-alias is missing (older data, or upload
    //    race), list all versioned files for this entity and return the newest.
    const prefix = `${type}/${id}_`;
    const keys = (await s3List(prefix)).filter(
      (k) => k.endsWith(`.${ext}`) && !k.endsWith(".json"),
    );
    if (keys.length > 0) {
      keys.sort();
      try {
        return await s3Download(keys[keys.length - 1]);
      } catch {
        return null;
      }
    }
  }

  return null;
}

/** Load a specific version by its image_id. Local disk first, then S3 fallback. */
export async function loadImageVersion(
  kind: string,
  image_id: string,
  ext = "png",
): Promise<{ data: Buffer; contentType: string } | null> {
  const contentType = ext === "png" ? "image/png" : "image/jpeg";

  const dir = resolveLocalDir(kind);
  if (dir) {
    try {
      const entries = await fs.readdir(dir);
      const match = entries.find((f) => f.endsWith(`_${image_id}.${ext}`));
      if (match) {
        const data = await fs.readFile(join(dir, match));
        return { data, contentType };
      }
    } catch {
      /* fall through to S3 */
    }
  }

  // S3 fallback: list versioned files under kind/ and match by image_id suffix.
  if (S3_BUCKET) {
    const keys = await s3List(`${kind}/`);
    const match = keys.find((k) => k.endsWith(`_${image_id}.${ext}`));
    if (!match) return null;
    try {
      return await s3Download(match);
    } catch {
      return null;
    }
  }

  return null;
}

async function findNewestVersionPath(kind: string, entity_id: string, ext: string): Promise<string | null> {
  const dir = resolveLocalDir(kind);
  if (!dir) return null;
  try {
    const entries = await fs.readdir(dir);
    const prefix = `${entity_id}_`;
    const matches = entries.filter((f) => f.startsWith(prefix) && f.endsWith(`.${ext}`));
    if (matches.length === 0) return null;
    const withStat = await Promise.all(
      matches.map(async (f) => {
        const full = join(dir, f);
        const s = await fs.stat(full);
        return { full, mtime: s.mtimeMs };
      }),
    );
    withStat.sort((a, b) => b.mtime - a.mtime);
    return withStat[0].full;
  } catch {
    return null;
  }
}

/**
 * List every saved version for `{kind}/{entity_id}` newest-first.
 * Reads sidecar JSONs where present; falls back to a synthetic entry for any
 * legacy unversioned image so existing dev data isn't lost.
 */
export async function listVersions(kind: string, entity_id: string): Promise<SidecarEntry[]> {
  const dir = resolveLocalDir(kind);
  const results: SidecarEntry[] = [];
  const seenImageIds = new Set<string>();

  if (dir) {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(dir);
    } catch {
      entries = [];
    }
    const prefix = `${entity_id}_`;
    const sidecarFiles = entries.filter(
      (f) => f.startsWith(prefix) && f.endsWith(".json") && !f.endsWith(".prev.json"),
    );

    for (const f of sidecarFiles) {
      try {
        const raw = await fs.readFile(join(dir, f), "utf8");
        const parsed = JSON.parse(raw) as SidecarEntry;
        if (parsed.entity_id === entity_id) {
          results.push(parsed);
          seenImageIds.add(parsed.image_id);
        }
      } catch {
        /* skip malformed */
      }
    }

    // Backward-compat: if we found no sidecars but a legacy `{entity_id}.{ext}` exists, surface it.
    if (results.length === 0) {
      for (const ext of ["png", "jpg"]) {
        const legacy = join(dir, `${entity_id}.${ext}`);
        if (existsSync(legacy)) {
          try {
            const stat = await fs.stat(legacy);
            results.push({
              image_id: "legacy",
              entity_type: kind,
              entity_id,
              kind,
              prompt: "",
              model: "unknown",
              created_at: stat.mtime.toISOString(),
              uri: `agent://${AGENT_NAME}/${kind}/${entity_id}`,
              local_path: legacy,
              source_tool: "legacy",
            });
          } catch {
            /* ignore */
          }
          break;
        }
      }
    }
  }

  // Cloud Run cold-start fallback: if local has nothing (or only a subset),
  // pick up sidecars from S3 so the UI gallery keeps working across restarts.
  if (S3_BUCKET) {
    const prefix = `${kind}/${entity_id}_`;
    const keys = (await s3List(prefix)).filter(
      (k) => k.endsWith(".json") && !k.endsWith(".prev.json"),
    );
    for (const key of keys) {
      try {
        const { data } = await s3Download(key);
        const parsed = JSON.parse(data.toString("utf8")) as SidecarEntry;
        if (parsed.entity_id !== entity_id) continue;
        if (seenImageIds.has(parsed.image_id)) continue;
        results.push(parsed);
        seenImageIds.add(parsed.image_id);
      } catch {
        /* skip malformed / missing */
      }
    }
  }

  results.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return results;
}

// ─── Task Store (always in-memory) ──────────────────────────────────

interface TaskEntry {
  task_id: string;
  status: "accepted" | "processing" | "completed" | "failed";
  progress: number;
  current_step: string;
  artifacts: Array<{ uri: string; mime_type: string; created_at: string; local_path?: string }>;
  error?: string;
  setup_map?: Record<string, unknown>;
  /** Final prompt actually sent to the image generator (after override + template fill + correction hints). Surfaced to the UI so user can edit and re-run. */
  prompt_used?: string;
  /** Per-setup prompts for multi-image tools like generate_setup_images. */
  prompts_used?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

const taskStore = new Map<string, TaskEntry>();

export function createTask(task_id: string, step: string): TaskEntry {
  const now = new Date().toISOString();
  const entry: TaskEntry = {
    task_id,
    status: "accepted",
    progress: 0,
    current_step: step,
    artifacts: [],
    created_at: now,
    updated_at: now,
  };
  taskStore.set(task_id, entry);
  return entry;
}

export function updateTask(
  task_id: string,
  update: Partial<Pick<TaskEntry, "status" | "progress" | "current_step" | "artifacts" | "error" | "setup_map" | "prompt_used" | "prompts_used">>,
): TaskEntry | null {
  const entry = taskStore.get(task_id);
  if (!entry) return null;
  Object.assign(entry, update, { updated_at: new Date().toISOString() });
  return entry;
}

export function getTask(task_id: string): TaskEntry | null {
  return taskStore.get(task_id) ?? null;
}

export function deleteTask(task_id: string): boolean {
  return taskStore.delete(task_id);
}

// ─── List artifacts by type ──────────────────────────────────────────

/**
 * List artifact ids of a given type. Reads memory + local disk + S3
 * (deduped) so the result survives Cloud Run cold starts. Returns base
 * ids without the `.json` suffix (e.g. `bible_001`, not `bible_001.json`).
 */
export async function listLocalArtifacts(type: string): Promise<string[]> {
  const prefix = `${type}/`;
  const ids = new Set<string>();

  for (const k of memoryStore.keys()) {
    if (!k.startsWith(prefix)) continue;
    ids.add(k.slice(prefix.length).replace(/\.json$/, ""));
  }

  const localDir = resolveLocalDir(type);
  if (localDir) {
    try {
      const entries = await fs.readdir(localDir);
      for (const f of entries) {
        if (!f.endsWith(".json") || f.endsWith(".prev.json")) continue;
        ids.add(f.replace(/\.json$/, ""));
      }
    } catch {
      /* no local dir — fine */
    }
  }

  if (S3_BUCKET) {
    const keys = await s3List(prefix);
    for (const key of keys) {
      if (!key.endsWith(".json") || key.endsWith(".prev.json")) continue;
      const rel = key.slice(prefix.length);
      if (rel.includes("/")) continue; // direct children only
      ids.add(rel.replace(/\.json$/, ""));
    }
  }

  return Array.from(ids).sort();
}

// ─── Diff & Staleness helpers ────────────────────────────────────────

/**
 * Get diff between current and previous version of an artifact.
 * Returns changed field names + old/new values, or null if no prev exists.
 */
export async function getArtifactDiff(
  type: string,
  id: string,
): Promise<{ field: string; old: unknown; new: unknown }[] | null> {
  const currExists = await artifactExists(type, id);
  const prevExists = await artifactExists(type, `${id}.prev`);
  if (!currExists || !prevExists) return null;

  const curr = await loadArtifact<Record<string, unknown>>(type, id);
  const prev = await loadArtifact<Record<string, unknown>>(type, `${id}.prev`);
  if (!curr || !prev) return null;

  const changes: { field: string; old: unknown; new: unknown }[] = [];
  const skipFields = new Set(["_updated_at", "_meta", "$schema", "project_id"]);

  for (const field of new Set([...Object.keys(prev), ...Object.keys(curr)])) {
    if (skipFields.has(field)) continue;
    const oldVal = JSON.stringify(prev[field]);
    const newVal = JSON.stringify(curr[field]);
    if (oldVal !== newVal) {
      changes.push({ field, old: prev[field], new: curr[field] });
    }
  }
  return changes.length > 0 ? changes : null;
}

/**
 * Check if a source artifact is newer than a dependent artifact.
 * Used for "check for updates" — e.g. is DFV newer than location bible?
 * Compares _updated_at timestamps from local disk files.
 */
export async function isArtifactStale(
  dependentType: string,
  dependentId: string,
  sourceDataRoot: string,
  sourceKey: string,
): Promise<boolean> {
  const depPath = resolveLocalPath(`${dependentType}/${dependentId}.json`);
  if (!depPath || !existsSync(depPath)) return false;

  const srcPath = resolve(sourceDataRoot, sourceKey);
  if (!existsSync(srcPath)) return false;

  try {
    const dep = JSON.parse(readFileSync(depPath, "utf8"));
    const src = JSON.parse(readFileSync(srcPath, "utf8"));
    const depTime = dep._updated_at ? new Date(dep._updated_at).getTime() : 0;
    const srcTime = src._updated_at ? new Date(src._updated_at).getTime() : 0;
    return srcTime > depTime;
  } catch {
    return false;
  }
}
