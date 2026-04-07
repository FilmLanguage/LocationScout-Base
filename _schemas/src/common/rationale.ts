/**
 * Rationale — optional explainability field shared by Bible-class artifacts.
 *
 * Captures *why* an agent made a particular creative choice (light direction,
 * face structure, wardrobe palette, etc.). Optional by design: agents may
 * leave it null when not generating bibles via LLM, or fill it during
 * write_bible to expose reasoning to users and downstream critics.
 *
 * Usage:
 *   import { RationaleSchema, type Rationale } from "@filmlanguage/schemas";
 *
 *   const MyBibleSchema = z.object({
 *     // …other fields…
 *     rationale: RationaleSchema.optional(),
 *   });
 *
 * Guidance for agents:
 *   - Keep `primary_reason` concise (1–2 sentences).
 *   - Reference upstream artifacts in `references` (research-pack URIs,
 *     director-vision URIs) — this lets a Critic argue against the source,
 *     not just the value.
 *   - `confidence` is optional; use it when the LLM signals uncertainty.
 *   - DO NOT post-hoc rationalize — only fill rationale when it reflects
 *     actual reasoning chain. Empty rationale is better than fabricated.
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const RationaleSchema = z.object({
  primary_reason: z
    .string()
    .min(1)
    .describe("1–2 sentence explanation of why this creative choice was made"),
  references: z
    .array(z.string())
    .default([])
    .describe("MCP URIs to upstream artifacts that informed this choice (research-pack, director-vision, etc.)"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Optional self-reported confidence (0.0–1.0) when LLM signals uncertainty"),
});

export type Rationale = z.infer<typeof RationaleSchema>;
export const RationaleJsonSchema = zodToJsonSchema(RationaleSchema);
