/**
 * Artifact storage layer for Location Scout.
 *
 * Three backends:
 *   1. S3-compatible storage — if S3_BUCKET is set (production; uses GCS S3 interop)
 *   2. Local filesystem — if LOCAL_OUTPUT_DIR is set (local dev; images can
 *      then be read back by humans or by Claude via Read tool)
 *   3. In-memory map — always active as L1 cache / fallback
 *
 * Binary artifacts (images) are persisted to disk whenever LOCAL_OUTPUT_DIR
 * is set, and the absolute path is returned to the caller so it can surface
 * it in tool responses.
 */

import { copyFileSync, existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { S3_BUCKET, s3Upload, s3Download, s3Exists } from "./api-client.js";

const LOCAL_OUTPUT_DIR = process.env.LOCAL_OUTPUT_DIR || "";
const AGENT_NAME = "location-scout";

// In-memory fallback for local development
const memoryStore = new Map<string, { data: string; contentType: string }>();

function resolveLocalPath(path: string): string | null {
  if (!LOCAL_OUTPUT_DIR) return null;
  return resolve(LOCAL_OUTPUT_DIR, AGENT_NAME, path);
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

export interface SaveImageResult {
  /** MCP resource URI (e.g. `agent://location-scout/anchor/loc_001`) */
  uri: string;
  /** Absolute filesystem path — null if LOCAL_OUTPUT_DIR not set */
  local_path: string | null;
  /** GCS path if uploaded, null otherwise */
  s3_path: string | null;
  bytes: number;
  content_type: string;
}

export async function saveImage(
  type: string,
  id: string,
  data: Buffer,
  contentType = "image/png",
): Promise<SaveImageResult> {
  const ext = contentType === "image/png" ? "png" : "jpg";
  const path = `${type}/${id}.${ext}`;

  memoryStore.set(path, { data: data.toString("base64"), contentType });

  const local_path = await writeLocal(path, data);

  let s3_path: string | null = null;
  if (S3_BUCKET) {
    s3_path = await s3Upload(path, data, contentType);
  }

  return {
    uri: `agent://${AGENT_NAME}/${type}/${id}`,
    local_path,
    s3_path,
    bytes: data.length,
    content_type: contentType,
  };
}

export async function loadImage(
  type: string,
  id: string,
  ext = "png",
): Promise<{ data: Buffer; contentType: string } | null> {
  const path = `${type}/${id}.${ext}`;

  // Memory
  const entry = memoryStore.get(path);
  if (entry) return { data: Buffer.from(entry.data, "base64"), contentType: entry.contentType };

  // Disk
  const local = await readLocal(path);
  if (local) {
    return { data: local, contentType: ext === "png" ? "image/png" : "image/jpeg" };
  }

  // GCS
  if (S3_BUCKET) {
    try {
      return await s3Download(path);
    } catch {
      return null;
    }
  }

  return null;
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
  update: Partial<Pick<TaskEntry, "status" | "progress" | "current_step" | "artifacts" | "error" | "setup_map">>,
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
