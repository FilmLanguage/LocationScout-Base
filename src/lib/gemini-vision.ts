/**
 * Gemini Vision client for Location Scout.
 *
 * Used by anchor-validator to compare generated anchor images against
 * the source Location Bible. Returns structured JSON with score, issues,
 * and observations.
 *
 * Falls back to a deterministic mock when GEMINI_API_KEY is not set so
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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

/**
 * Analyze images via Gemini Vision and return raw text content.
 * Caller is responsible for parsing JSON from the response.
 */
export async function analyzeWithGeminiVision(input: GeminiVisionInput): Promise<GeminiVisionOutput> {
  if (!GEMINI_API_KEY) {
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
        notes: "Mock validation — GEMINI_API_KEY not set",
      }),
      model: "mock",
    };
  }

  const imageParts = input.image_urls.map((url) => ({
    inline_data: { mime_type: "image/png", data: url },
  }));

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: input.system_prompt }] },
        contents: [
          {
            parts: [...imageParts, { text: input.user_prompt }],
          },
        ],
      }),
    },
  );

  if (!resp.ok) {
    throw flError(FL_ERRORS.GENERATION_ERROR, `Gemini Vision error ${resp.status}: ${await resp.text()}`, {
      retryable: true,
      suggestion: "Check GEMINI_API_KEY and retry.",
    });
  }

  const data = (await resp.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };
  const text = data.candidates[0]?.content.parts.map((p) => p.text).join("") ?? "";

  return { content: text, model: GEMINI_MODEL };
}

/** Strip markdown fences from a JSON-ish string. */
export function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)(?:\n\s*```|$)/);
  return match ? match[1].trim() : trimmed;
}
