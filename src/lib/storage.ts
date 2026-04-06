/**
 * Artifact storage layer for Location Scout.
 * Abstracts GCS operations behind typed read/write functions.
 * Falls back to in-memory store when GCS_BUCKET is not set (local dev).
 */

import { GCS_BUCKET, gcsUpload, gcsDownload, gcsExists } from "./api-client.js";

// In-memory fallback for local development
const memoryStore = new Map<string, { data: string; contentType: string }>();

// ─── JSON Artifacts ─────────────────────────────────────────────────

export async function saveArtifact(type: string, id: string, data: unknown): Promise<string> {
  const path = `${type}/${id}.json`;
  const json = JSON.stringify(data, null, 2);

  if (GCS_BUCKET) {
    return gcsUpload(path, json, "application/json");
  }

  // Local fallback
  memoryStore.set(path, { data: json, contentType: "application/json" });
  return `mem://${path}`;
}

export async function loadArtifact<T = unknown>(type: string, id: string): Promise<T | null> {
  const path = `${type}/${id}.json`;

  if (GCS_BUCKET) {
    try {
      const { data } = await gcsDownload(path);
      return JSON.parse(data.toString()) as T;
    } catch {
      return null;
    }
  }

  // Local fallback
  const entry = memoryStore.get(path);
  if (!entry) return null;
  return JSON.parse(entry.data) as T;
}

export async function artifactExists(type: string, id: string): Promise<boolean> {
  const path = `${type}/${id}.json`;

  if (GCS_BUCKET) {
    return gcsExists(path);
  }

  return memoryStore.has(path);
}

// ─── Binary Artifacts (images) ──────────────────────────────────────

export async function saveImage(type: string, id: string, data: Buffer, contentType = "image/png"): Promise<string> {
  const ext = contentType === "image/png" ? "png" : "jpg";
  const path = `${type}/${id}.${ext}`;

  if (GCS_BUCKET) {
    return gcsUpload(path, data, contentType);
  }

  memoryStore.set(path, { data: data.toString("base64"), contentType });
  return `mem://${path}`;
}

export async function loadImage(type: string, id: string, ext = "png"): Promise<{ data: Buffer; contentType: string } | null> {
  const path = `${type}/${id}.${ext}`;

  if (GCS_BUCKET) {
    try {
      return await gcsDownload(path);
    } catch {
      return null;
    }
  }

  const entry = memoryStore.get(path);
  if (!entry) return null;
  return { data: Buffer.from(entry.data, "base64"), contentType: entry.contentType };
}

// ─── Task Store (always in-memory) ──────────────────────────────────

interface TaskEntry {
  task_id: string;
  status: "accepted" | "processing" | "completed" | "failed";
  progress: number;
  current_step: string;
  artifacts: Array<{ uri: string; mime_type: string; created_at: string }>;
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
