/**
 * External API clients for S3-compatible storage, LLM (Anthropic), and image generation (FAL.ai).
 * Each agent customizes this for its specific external dependencies.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { flError, FL_ERRORS } from "./errors.js";
import { log } from "./log.js";

// ─── Environment ────────────────────────────────────────────────────

export const S3_BUCKET = process.env.S3_BUCKET || "";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || "";
const S3_ENDPOINT = process.env.S3_ENDPOINT || "https://storage.googleapis.com";

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
  /**
   * FAL endpoint path — either a logical alias ("nano-banana/edit") or a
   * full FAL path ("fal-ai/flux-pro/v1.1"). Defaults to nano-banana/edit.
   * Callers should usually resolve via `resolveModel(slot, override)` from
   * model-registry.ts rather than passing a raw string here.
   */
  model?: string;
  /** Reference image URLs (for edit / img2img models like nano-banana/edit) */
  image_urls?: string[];
  /** Strength with which the reference image biases the generation (0..1). Used by edit mode to force preservation. */
  image_ref_strength?: number;
}

interface ImageGenResult {
  images: Array<{ url: string; content_type: string }>;
  seed: number;
  /** Resolved FAL endpoint that served this request (useful for logging). */
  model: string;
}

export async function generateImage(params: ImageGenParams): Promise<ImageGenResult> {
  if (!FAL_AI_API_KEY) {
    throw flError(FL_ERRORS.GENERATION_ERROR, "FAL_AI_API_KEY not configured", {
      retryable: false,
      suggestion: "Set FAL_AI_API_KEY in .env",
    });
  }

  // Default to nano-banana/edit if caller didn't pass anything.
  const modelPath = params.model ?? "fal-ai/nano-banana/edit";
  const endpoint = modelPath.startsWith("fal-ai/")
    ? `https://queue.fal.run/${modelPath}`
    : `https://queue.fal.run/fal-ai/${modelPath}`;

  // Build request body — schemas differ slightly between model families.
  // nano-banana/edit expects `prompt` + `image_urls`; flux expects `prompt`
  // + `image_size`. We pass a union and let FAL ignore unknown fields.
  const body: Record<string, unknown> = {
    prompt: params.prompt,
  };
  if (params.negative_prompt) body.negative_prompt = params.negative_prompt;
  if (params.seed != null) body.seed = params.seed;
  if (params.num_images) body.num_images = params.num_images;
  if (modelPath.includes("nano-banana")) {
    // nano-banana edit variant expects reference images; if none supplied the
    // text-to-image variant (`fal-ai/nano-banana`) is the right one, but we
    // send the field anyway — FAL accepts both.
    if (params.image_urls && params.image_urls.length > 0) {
      body.image_urls = params.image_urls;
    }
    if (params.image_ref_strength != null) {
      body.image_ref_strength = params.image_ref_strength;
    }
  } else {
    body.image_size = {
      width: params.width ?? 1024,
      height: params.height ?? 768,
    };
  }

  // Submit to FAL.ai queue
  const start = Date.now();
  log({
    category: "fal",
    action: `${modelPath}:submit`,
    status: "started",
    details: {
      model: modelPath,
      prompt_chars: params.prompt.length,
      ref_count: params.image_urls?.length ?? 0,
      image_ref_strength: params.image_ref_strength,
      width: params.width,
      height: params.height,
      seed: params.seed,
    },
  });
  const submitRes = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${FAL_AI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    log({
      category: "fal",
      action: `${modelPath}:submit`,
      status: "error",
      duration_ms: Date.now() - start,
      details: { model: modelPath, http_status: submitRes.status },
    });
    const body = await submitRes.text();
    throw flError(FL_ERRORS.GENERATION_ERROR, `FAL.ai submit error: ${submitRes.status} (model=${modelPath})`, {
      retryable: submitRes.status >= 500,
      suggestion: submitRes.status === 401 ? "Check FAL_AI_API_KEY" : "Retry later",
      status: submitRes.status,
      body,
    });
  }
  log({
    category: "fal",
    action: `${modelPath}:submit`,
    status: "completed",
    duration_ms: Date.now() - start,
    details: { model: modelPath, http_status: submitRes.status },
  });

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
      const resultData = await resultRes.json() as {
        images?: Array<{ url: string; content_type?: string }>;
        image?: { url: string; content_type?: string };
        seed?: number;
      };
      // Normalize: some FAL endpoints return `image` (singular), others `images`.
      const images = resultData.images
        ? resultData.images.map((i) => ({ url: i.url, content_type: i.content_type ?? "image/png" }))
        : resultData.image
          ? [{ url: resultData.image.url, content_type: resultData.image.content_type ?? "image/png" }]
          : [];
      return { images, seed: resultData.seed ?? 0, model: modelPath };
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

// ─── S3-Compatible Storage (GCS S3 interop) ────────────────────────

function getS3Client(): S3Client {
  return new S3Client({
    endpoint: S3_ENDPOINT,
    region: "auto",
    forcePathStyle: true,
    credentials: {
      accessKeyId: S3_ACCESS_KEY,
      secretAccessKey: S3_SECRET_KEY,
    },
  });
}

export async function s3Upload(
  path: string,
  data: Uint8Array | string,
  contentType: string,
): Promise<string> {
  if (!S3_BUCKET) {
    throw flError(FL_ERRORS.MISSING_DEPENDENCY, "S3_BUCKET not configured", {
      retryable: false,
      suggestion: "Set S3_BUCKET in .env",
    });
  }

  const client = getS3Client();
  const body = typeof data === "string" ? Buffer.from(data, "utf8") : data;

  try {
    await client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: path,
      Body: body,
      ContentType: contentType,
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw flError(FL_ERRORS.GENERATION_ERROR, `S3 upload failed: ${message}`, {
      retryable: true,
      suggestion: "Check S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_ENDPOINT",
    });
  }

  return `s3://${S3_BUCKET}/${path}`;
}

export async function s3Download(path: string): Promise<{ data: Buffer; contentType: string }> {
  if (!S3_BUCKET) {
    throw flError(FL_ERRORS.MISSING_DEPENDENCY, "S3_BUCKET not configured", {
      retryable: false,
      suggestion: "Set S3_BUCKET in .env",
    });
  }

  const client = getS3Client();

  try {
    const response = await client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: path,
    }));

    const contentType = response.ContentType || "application/octet-stream";
    const bodyBytes = await response.Body!.transformToByteArray();
    return { data: Buffer.from(bodyBytes), contentType };
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NoSuchKey" || name === "NotFound") {
      throw flError(FL_ERRORS.MISSING_DEPENDENCY, `Object not found: ${path}`, {
        retryable: false,
        suggestion: "Check artifact ID",
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    throw flError(FL_ERRORS.GENERATION_ERROR, `S3 download failed: ${message}`, {
      retryable: true,
      suggestion: "Retry later",
    });
  }
}

export async function s3Exists(path: string): Promise<boolean> {
  if (!S3_BUCKET) return false;

  const client = getS3Client();
  try {
    await client.send(new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: path,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * List all keys under a prefix. Returns full keys (including the prefix).
 * Returns [] if S3 is not configured or listing fails.
 */
export async function s3List(prefix: string): Promise<string[]> {
  if (!S3_BUCKET) return [];

  const client = getS3Client();
  const keys: string[] = [];
  let continuationToken: string | undefined;

  try {
    do {
      const resp = await client.send(new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }));
      for (const obj of resp.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }
      continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
    } while (continuationToken);
  } catch (err) {
    console.warn(`[api-client] s3List failed for prefix ${prefix}:`, (err as Error)?.message ?? err);
    return keys;
  }

  return keys;
}
