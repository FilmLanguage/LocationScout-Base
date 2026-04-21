/**
 * Artifact storage layer for Location Scout.
 *
 * Three backends:
 *   1. S3-compatible storage — if S3_BUCKET is set (production; uses GCS S3 interop)
 *   2. Local filesystem — if LOCAL_OUTPUT_DIR is set (local dev; images can
 *      then be read back by humans or by Claude via Read tool)
 *   3. In-memory map — always active as L1 cache / fallback
 *
 * Binary artifacts (images) are stored as versioned files with a sidecar JSON
 * per file (see prompt-gallery-contract.md §1). Each generate_* call creates
 * a new version; `loadImage` returns the newest version; `listVersions`
 * returns the full history for a gallery UI.
 */

import { copyFileSync, existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { S3_BUCKET, s3Upload, s3Download, s3Exists } from "./api-client.js";
import { mirrorArtifactToDb } from "./db.js";

const AGENT_NAME = "location-scout";

// In-memory fallback for local development
const memoryStore = new Map<string, { data: string; contentType: string }>();

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

// ─── JSON Artifacts ─────────────────────────────────────────────────

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

  // Always keep in memory for fast read-back within the same process
  memoryStore.set(path, { data: json, contentType: "application/json" });

  // Persist to disk if configured
  await writeLocal(path, json);

  // Best-effort mirror to v2 Postgres schema. DB failures never fail the save.
  mirrorArtifactToDb(type, id, data).catch((err) => {
    console.warn(`[storage] v2 mirror failed for ${type}/${id}: ${err?.message ?? err}`);
  });

  if (S3_BUCKET) {
    return s3Upload(path, json, "application/json");
  }

  return `mem://${path}`;
}

export async function loadArtifact<T = unknown>(type: string, id: string): Promise<T | null> {
  const path = `${type}/${id}.json`;

  // L1: memory
  const entry = memoryStore.get(path);
  if (entry) return JSON.parse(entry.data) as T;

  // L2: local disk
  const local = await readLocal(path);
  if (local) {
    const parsed = JSON.parse(local.toString("utf8")) as T;
    memoryStore.set(path, { data: local.toString("utf8"), contentType: "application/json" });
    return parsed;
  }

  // L3: GCS
  if (S3_BUCKET) {
    try {
      const { data } = await s3Download(path);
      return JSON.parse(data.toString()) as T;
    } catch {
      return null;
    }
  }

  return null;
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

// ─── Binary Artifacts (images) ──────────────────────────────────────

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
 * Save a generated image with a sidecar JSON per the prompt-gallery contract.
 * Filename format: `{kind}/{entity_id}_{ts}_{uuid8}.{ext}` plus a parallel `.json`.
 * The returned `uri` points at the entity (latest) for backward compatibility.
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

  // Also mirror the bytes under the legacy "latest" key so in-memory reads stay
  // fast and /artifacts/{kind}/{entity_id}.png keeps working.
  const latestKey = `${kind}/${opts.entity_id}.${ext}`;
  memoryStore.set(imagePath, { data: data.toString("base64"), contentType });
  memoryStore.set(latestKey, { data: data.toString("base64"), contentType });

  const local_path = await writeLocal(imagePath, data);

  let s3_path: string | null = null;
  if (S3_BUCKET) {
    s3_path = await s3Upload(imagePath, data, contentType);
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
 * Load the *latest* image version for `{kind}/{entity_id}`. Falls back to any
 * legacy unversioned `{kind}/{entity_id}.{ext}` file if no versioned files exist.
 */
export async function loadImage(
  type: string,
  id: string,
  ext = "png",
): Promise<{ data: Buffer; contentType: string } | null> {
  const contentType = ext === "png" ? "image/png" : "image/jpeg";

  // 1. Check memory "latest" cache first
  const latestKey = `${type}/${id}.${ext}`;
  const cached = memoryStore.get(latestKey);
  if (cached) return { data: Buffer.from(cached.data, "base64"), contentType: cached.contentType };

  // 2. Find newest versioned file on local disk
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

  // 4. GCS (unversioned legacy key; multi-version listing over S3 not implemented yet)
  if (S3_BUCKET) {
    try {
      return await s3Download(`${type}/${id}.${ext}`);
    } catch {
      return null;
    }
  }

  return null;
}

/** Load a specific version by its image_id. Local disk only for now. */
export async function loadImageVersion(
  kind: string,
  image_id: string,
  ext = "png",
): Promise<{ data: Buffer; contentType: string } | null> {
  const dir = resolveLocalDir(kind);
  if (!dir) return null;
  try {
    const entries = await fs.readdir(dir);
    const match = entries.find((f) => f.endsWith(`_${image_id}.${ext}`));
    if (!match) return null;
    const data = await fs.readFile(join(dir, match));
    return { data, contentType: ext === "png" ? "image/png" : "image/jpeg" };
  } catch {
    return null;
  }
}

async function findNewestVersionPath(kind: string, entity_id: string, ext: string): Promise<string | null> {
  const dir = resolveLocalDir(kind);
  if (!dir) return null;
  try {
    const entries = await fs.readdir(dir);
    const prefix = `${entity_id}_`;
    const matches = entries.filter((f) => f.startsWith(prefix) && f.endsWith(`.${ext}`));
    if (matches.length === 0) return null;
    // Sort by mtime descending.
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
        if (parsed.entity_id === entity_id) results.push(parsed);
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

  // Sort newest first
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

// ─── List artifacts by type ─────────────────────────────────────────

export function listLocalArtifacts(type: string): string[] {
  const prefix = `${type}/`;
  return Array.from(memoryStore.keys())
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.slice(prefix.length).replace(/\.json$/, ""));
}

// ─── Diff & Staleness helpers ──────────────────────────────────────

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
