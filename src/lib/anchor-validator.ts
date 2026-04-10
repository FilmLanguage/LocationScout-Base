/**
 * Anchor Validator — VLM-based check that a generated anchor image
 * matches the source Location Bible.
 *
 * Compares generated anchor against:
 *   - light_base_state (direction, color temp, shadow hardness)
 *   - passport (era, int/ext, time of day)
 *   - key_details (5–8 anchor visual elements)
 *   - negative_list (anachronisms that must NOT appear)
 *
 * Returns a ValidationReport (validation-report-v1) with score, pass/fail
 * and structured issues. The orchestrator decides whether to retry.
 *
 * Designed to be cheap to run (single Gemini Vision call per attempt) and
 * to degrade gracefully to a mock pass when FAL_AI_API_KEY is not set.
 */

import type { ValidationReport, Issue } from "@filmlanguage/schemas";
import { analyzeWithGeminiVision, stripJsonFence } from "./gemini-vision.js";

export interface ValidatorBibleSpec {
  bible_id: string;
  passport: {
    type: string;
    time_of_day: string[];
    era: string;
  };
  light_base_state: {
    primary_source: string;
    direction: string;
    color_temp_kelvin: number;
    shadow_hardness: string;
  };
  key_details: string[];
  negative_list: string[] | Array<{ item: string }>;
}

export interface ValidatorOptions {
  bible: ValidatorBibleSpec;
  anchor_image_url: string;
  artifact_uri: string;
  attempt: number;
  max_attempts: number;
  threshold?: number;
}

const DEFAULT_THRESHOLD = 0.75;

const SYSTEM_PROMPT = `You are a film location scouting validator. You compare a generated location anchor image against a Location Bible specification. Your goal: detect mismatches in light direction, color temperature, shadow hardness, era accuracy, and presence of forbidden ("negative list") items.

Return STRICT JSON with this shape:
{
  "score": number 0.0–1.0,
  "passed": boolean,
  "observed": {
    "light_direction": string,
    "color_temp_estimate_kelvin": number,
    "shadow_hardness": "hard" | "soft" | "mixed",
    "era_markers": string,
    "negative_list_violations": string[]
  },
  "issues": [{ "severity": "critical" | "warning" | "info", "field": string, "issue": string, "suggestion": string }]
}

Score rubric:
- 1.0 = perfect match
- 0.75 = acceptable, minor drift
- 0.5 = noticeable mismatch in 1 key dimension
- < 0.5 = major mismatch or forbidden item present

Hard fail (score < 0.5) if any negative_list item is visible.`;

/** Normalize negative_list which may be string[] or {item}[]. */
function normalizeNegativeList(neg: ValidatorBibleSpec["negative_list"]): string[] {
  if (!neg) return [];
  return neg.map((n) => (typeof n === "string" ? n : n.item));
}

/**
 * Run a single validation attempt.
 * Returns a ValidationReport that callers can persist via storage.
 */
export async function validateAnchorAgainstBible(
  opts: ValidatorOptions,
): Promise<ValidationReport> {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const negativeList = normalizeNegativeList(opts.bible.negative_list);

  const userPrompt = `Validate this anchor against the Bible spec:

Bible spec:
- bible_id: ${opts.bible.bible_id}
- type: ${opts.bible.passport.type}
- era: ${opts.bible.passport.era}
- time_of_day: ${opts.bible.passport.time_of_day.join(", ")}
- light primary_source: ${opts.bible.light_base_state.primary_source}
- light direction: ${opts.bible.light_base_state.direction}
- color_temp_kelvin: ${opts.bible.light_base_state.color_temp_kelvin}
- shadow_hardness: ${opts.bible.light_base_state.shadow_hardness}
- key_details: ${opts.bible.key_details.join(" | ")}
- negative_list (must NOT appear): ${negativeList.join(" | ")}

Return JSON only. No markdown fences.`;

  const result = await analyzeWithGeminiVision({
    image_urls: [opts.anchor_image_url],
    system_prompt: SYSTEM_PROMPT,
    user_prompt: userPrompt,
  });

  let parsed: {
    score?: number;
    passed?: boolean;
    observed?: Record<string, unknown>;
    issues?: Issue[];
  };
  try {
    parsed = JSON.parse(stripJsonFence(result.content));
  } catch {
    // Validator output unparseable — treat as soft failure so the loop can retry.
    parsed = {
      score: 0,
      passed: false,
      issues: [
        {
          severity: "warning",
          field: "validator.output",
          issue: "Validator response was not valid JSON",
          suggestion: "Retry; if persistent, inspect Gemini response or lower model temperature.",
        },
      ],
    };
  }

  const score = typeof parsed.score === "number" ? parsed.score : 0;
  const passed = parsed.passed === true || score >= threshold;

  const report: ValidationReport = {
    $schema: "validation-report-v1",
    validation_id: `val_${opts.bible.bible_id}_a${opts.attempt}_${Date.now().toString(36)}`,
    artifact_uri: opts.artifact_uri,
    artifact_type: "location_anchor",
    validator: result.model.startsWith("gemini") ? "gemini_vision" : "other",
    validator_version: result.model,
    attempt: opts.attempt,
    max_attempts: opts.max_attempts,
    score,
    passed,
    threshold,
    issues: parsed.issues ?? [],
    observed: parsed.observed,
    expected: {
      light_direction: opts.bible.light_base_state.direction,
      color_temp_kelvin: opts.bible.light_base_state.color_temp_kelvin,
      shadow_hardness: opts.bible.light_base_state.shadow_hardness,
      era: opts.bible.passport.era,
    },
    produced_by: "location-scout-base",
    validated_at: new Date().toISOString(),
  };

  return report;
}

/**
 * Build a corrective hint string from validation issues, for the next
 * regeneration attempt's prompt.
 */
export function issuesToCorrectionHint(report: ValidationReport): string {
  if (!report.issues || report.issues.length === 0) return "";
  const lines = report.issues
    .filter((i) => i.severity !== "info")
    .map((i) => `- ${i.field ?? "?"}: ${i.issue}${i.suggestion ? ` → ${i.suggestion}` : ""}`);
  if (lines.length === 0) return "";
  return `\n\nPrevious attempt failed validation (score ${report.score.toFixed(2)}). Fix:\n${lines.join("\n")}`;
}
