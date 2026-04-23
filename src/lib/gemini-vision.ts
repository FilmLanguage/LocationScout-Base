/**
 * Gemini Vision client for Location Scout.
 *
 * Used by anchor-validator to compare generated anchor images against
 * the source Location Bible. Returns structured JSON with score, issues,
 * and observations.
 *
 * Routes through FAL's any-llm endpoint (fal-ai/any-llm) using FAL_AI_API_KEY.
 * Falls back to a deterministic mock when FAL_AI_API_KEY is not set so
 * the retry loop can be exercised in tests and local dev.
 */

import { FL_ERRORS, flError } from "./errors.js";

export interface GeminiVisionInput {
  /** Image URLs or data: URIs to analyze */
  image_urls: string[];
  /** System instruction */
  system_prompt: string;
  /** User prompt — should ask for JSON output */
  user_prompt: string;
}

export interface GeminiVisionOutput {
  content: string;
  model: string;
}

const FAL_AI_API_KEY = process.env.FAL_AI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

/** Map bare model name to FAL model ID (e.g. "gemini-2.5-pro" → "google/gemini-2.5-pro"). */
function toFalModelId(model: string): string {
  return model.includes("/") ? model : `google/${model}`;
}

/**
 * Analyze images via Gemini Vision (routed through FAL any-llm) and return raw text content.
 * Caller is responsible for parsing JSON from the response.
 */
export async function analyzeWithGeminiVision(input: GeminiVisionInput): Promise<GeminiVisionOutput> {
  if (!FAL_AI_API_KEY) {
    // Mock response: deterministic, lets retry-loop logic be tested without network.
    return {
      content: JSON.stringify({
        score: 0.82,
        passed: true,
        observed: {
          light_direction: "approximate match to spec",
          era_markers: "consistent with brief",
        },
        issues: [],
        notes: "Mock validation — FAL_AI_API_KEY not set",
      }),
      model: "mock",
    };
  }

  const imageContentParts = input.image_urls.map((url) => ({
    type: "image_url",
    image_url: { url },
  }));

  const resp = await fetch("https://fal.run/fal-ai/any-llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${FAL_AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: toFalModelId(GEMINI_MODEL),
      system: input.system_prompt,
      messages: [
        {
          role: "user",
          content: [
            ...imageContentParts,
            { type: "text", text: input.user_prompt },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    throw flError(FL_ERRORS.GENERATION_ERROR, `FAL Gemini Vision error ${resp.status}: ${await resp.text()}`, {
      retryable: true,
      suggestion: "Check FAL_AI_API_KEY and retry.",
    });
  }

  const data = (await resp.json()) as { output: string; model?: string };
  return { content: data.output, model: data.model ?? toFalModelId(GEMINI_MODEL) };
}

/** Strip markdown fences from a JSON-ish string. */
export function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)(?:\n\s*```|$)/);
  return match ? match[1].trim() : trimmed;
}
