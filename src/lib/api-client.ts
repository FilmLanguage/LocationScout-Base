/**
 * External API clients for GCS, LLM (Anthropic), and image generation (FAL.ai).
 * Each agent customizes this for its specific external dependencies.
 */

import { flError, FL_ERRORS } from "./errors.js";

// ─── Environment ────────────────────────────────────────────────────

export const GCS_BUCKET = process.env.GCS_BUCKET || "";
export const PROJECT_ID = process.env.PROJECT_ID || "";
export const LLM_MODEL = process.env.LLM_MODEL || "claude-sonnet-4-6";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const FAL_AI_API_KEY = process.env.FAL_AI_API_KEY || "";

// ─── LLM Client (Anthropic Claude) ─────────────────────────────────

interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

interface LlmResponse {
  content: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

export async function llmComplete(
  systemPrompt: string,
  messages: LlmMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<LlmResponse> {
  if (!ANTHROPIC_API_KEY) {
    throw flError(FL_ERRORS.LLM_ERROR, "ANTHROPIC_API_KEY not configured", {
      retryable: false,
      suggestion: "Set ANTHROPIC_API_KEY in .env",
    });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw flError(FL_ERRORS.LLM_ERROR, `Anthropic API error: ${res.status}`, {
      retryable: res.status >= 500,
      suggestion: res.status === 401 ? "Check ANTHROPIC_API_KEY" : "Retry later",
      status: res.status,
      body,
    });
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
    model: string;
    usage: { input_tokens: number; output_tokens: number };
  };

  return {
    content: data.content.filter((c) => c.type === "text").map((c) => c.text).join(""),
    model: data.model,
    usage: data.usage,
  };
}

// ─── Image Generation (FAL.ai) ──────────────────────────────────────

interface ImageGenParams {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  num_images?: number;
}

interface ImageGenResult {
  images: Array<{ url: string; content_type: string }>;
  seed: number;
}

export async function generateImage(params: ImageGenParams): Promise<ImageGenResult> {
  if (!FAL_AI_API_KEY) {
    throw flError(FL_ERRORS.GENERATION_ERROR, "FAL_AI_API_KEY not configured", {
      retryable: false,
      suggestion: "Set FAL_AI_API_KEY in .env",
    });
  }

  // Submit to FAL.ai queue
  const submitRes = await fetch("https://queue.fal.run/fal-ai/flux/dev", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${FAL_AI_API_KEY}`,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      negative_prompt: params.negative_prompt,
      image_size: {
        width: params.width ?? 1024,
        height: params.height ?? 768,
      },
      seed: params.seed,
      num_images: params.num_images ?? 1,
    }),
  });

  if (!submitRes.ok) {
    const body = await submitRes.text();
    throw flError(FL_ERRORS.GENERATION_ERROR, `FAL.ai submit error: ${submitRes.status}`, {
      retryable: submitRes.status >= 500,
      suggestion: submitRes.status === 401 ? "Check FAL_AI_API_KEY" : "Retry later",
      status: submitRes.status,
      body,
    });
  }

  const submitData = await submitRes.json() as { request_id: string; status_url: string; response_url: string };

  // Poll for completion
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const statusRes = await fetch(submitData.status_url, {
      headers: { "Authorization": `Key ${FAL_AI_API_KEY}` },
    });
    const statusData = await statusRes.json() as { status: string };

    if (statusData.status === "COMPLETED") {
      const resultRes = await fetch(submitData.response_url, {
        headers: { "Authorization": `Key ${FAL_AI_API_KEY}` },
      });
      const resultData = await resultRes.json() as { images: Array<{ url: string; content_type: string }>; seed: number };
      return resultData;
    }

    if (statusData.status === "FAILED") {
      throw flError(FL_ERRORS.GENERATION_ERROR, "FAL.ai generation failed", {
        retryable: true,
        suggestion: "Check prompt or retry",
      });
    }
  }

  throw flError(FL_ERRORS.TIMEOUT, "FAL.ai generation timed out", {
    retryable: true,
    suggestion: "Retry — generation may be queued",
  });
}

// ─── GCS Storage ────────────────────────────────────────────────────

export async function gcsUpload(
  path: string,
  data: Uint8Array | string,
  contentType: string,
): Promise<string> {
  if (!GCS_BUCKET) {
    throw flError(FL_ERRORS.MISSING_DEPENDENCY, "GCS_BUCKET not configured", {
      retryable: false,
      suggestion: "Set GCS_BUCKET in .env",
    });
  }

  const url = `https://storage.googleapis.com/upload/storage/v1/b/${GCS_BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      // Uses Application Default Credentials (ADC) on Cloud Run.
      // For local dev, run: gcloud auth application-default login
    },
    body: typeof data === "string" ? data : new Blob([data as BlobPart], { type: contentType }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw flError(FL_ERRORS.GENERATION_ERROR, `GCS upload failed: ${res.status}`, {
      retryable: res.status >= 500,
      suggestion: "Check GCS_BUCKET and credentials",
      status: res.status,
      body,
    });
  }

  return `gs://${GCS_BUCKET}/${path}`;
}

export async function gcsDownload(path: string): Promise<{ data: Buffer; contentType: string }> {
  if (!GCS_BUCKET) {
    throw flError(FL_ERRORS.MISSING_DEPENDENCY, "GCS_BUCKET not configured", {
      retryable: false,
      suggestion: "Set GCS_BUCKET in .env",
    });
  }

  const url = `https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET}/o/${encodeURIComponent(path)}?alt=media`;

  const res = await fetch(url);

  if (!res.ok) {
    if (res.status === 404) {
      throw flError(FL_ERRORS.MISSING_DEPENDENCY, `Object not found: ${path}`, {
        retryable: false,
        suggestion: "Check artifact ID",
      });
    }
    throw flError(FL_ERRORS.GENERATION_ERROR, `GCS download failed: ${res.status}`, {
      retryable: res.status >= 500,
      suggestion: "Retry later",
      status: res.status,
    });
  }

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await res.arrayBuffer();
  return { data: Buffer.from(arrayBuffer), contentType };
}

export async function gcsExists(path: string): Promise<boolean> {
  if (!GCS_BUCKET) return false;

  const url = `https://storage.googleapis.com/storage/v1/b/${GCS_BUCKET}/o/${encodeURIComponent(path)}`;
  const res = await fetch(url, { method: "HEAD" });
  return res.ok;
}
