/**
 * Artifact storage layer for Location Scout.
 *
 * Three backends:
 *   1. Google Cloud Storage — if GCS_BUCKET is set (production)
 *   2. Local filesystem — if LOCAL_OUTPUT_DIR is set (local dev; images can
 *      then be read back by humans or by Claude via Read tool)
 *   3. In-memory map — always active as L1 cache / fallback
 *
 * Binary artifacts (images) are persisted to disk whenever LOCAL_OUTPUT_DIR
 * is set, and the absolute path is returned to the caller so it can surface
 * it in tool responses.
 */

import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { GCS_BUCKET, gcsUpload, gcsDownload, gcsExists } from "./api-client.js";

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
  const json = JSON.stringify(data, null, 2);

  // Always keep in memory for fast read-back within the same process
  memoryStore.set(path, { data: json, contentType: "application/json" });

  // Persist to disk if configured
  await writeLocal(path, json);

  if (GCS_BUCKET) {
    return gcsUpload(path, json, "application/json");
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
  if (GCS_BUCKET) {
    try {
      const { data } = await gcsDownload(path);
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
  if (GCS_BUCKET) return gcsExists(path);
  return false;
}

// ─── Binary Artifacts (images) ──────────────────────────────────────

export interface SaveImageResult {
  /** MCP resource URI (e.g. `agent://location-scout/anchor/loc_001`) */
  uri: string;
  /** Absolute filesystem path — null if LOCAL_OUTPUT_DIR not set */
  local_path: string | null;
  /** GCS path if uploaded, null otherwise */
  gcs_path: string | null;
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

  let gcs_path: string | null = null;
  if (GCS_BUCKET) {
    gcs_path = await gcsUpload(path, data, contentType);
  }

  return {
    uri: `agent://${AGENT_NAME}/${type}/${id}`,
    local_path,
    gcs_path,
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
  if (GCS_BUCKET) {
    try {
      return await gcsDownload(path);
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
  update: Partial<Pick<TaskEntry, "status" | "progress" | "current_step" | "artifacts" | "error">>,
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
