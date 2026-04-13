/**
 * Validation Report v1
 *
 * Lightweight, machine-generated validation record produced by VLM/rule-based
 * checkers (e.g. Gemini Vision validating a generated anchor against its Bible).
 *
 * Distinct from ReviewReport (which carries authoritative human verdicts):
 * - Multiple validation reports may exist per artifact (one per retry attempt).
 * - No gate context, no recommendation — just score, pass/fail, and observed issues.
 * - Designed for tight retry loops: agent runs validator, reads `passed`, retries if false.
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { IssueSchema } from "../common/issue.js";

export const ARTIFACT_TYPE = "validation_report" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "any" as const; // any agent can produce
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://{producer}/validation/{id}" as const;

export const ValidatorTypeSchema = z.enum([
  "gemini_vision",
  "gpt4_vision",
  "rule_based",
  "schema_check",
  "other",
]);

export const ValidationReportSchema = z.object({
  $schema: z.literal("validation-report-v1"),
  validation_id: z.string().describe("Unique validation ID"),
  artifact_uri: z.string().describe("MCP resource URI of the artifact being validated"),
  artifact_type: z.string().describe("Type of artifact validated, e.g. 'location_anchor'"),
  validator: ValidatorTypeSchema.describe("Which validator produced this report"),
  validator_version: z.string().optional().describe("Validator/model version, e.g. 'gemini-2.5-pro'"),
  attempt: z.number().int().min(1).describe("Retry attempt number (1-based)"),
  max_attempts: z.number().int().min(1).describe("Maximum retry attempts allowed"),
  score: z.number().min(0).max(1).describe("Overall validation score (0.0–1.0)"),
  passed: z.boolean().describe("Whether the artifact passed validation"),
  threshold: z.number().min(0).max(1).describe("Score threshold required to pass"),
  issues: z.array(IssueSchema).default([]).describe("Issues observed during validation"),
  observed: z
    .record(z.unknown())
    .optional()
    .describe("Validator-specific observations (e.g. detected light direction, era markers)"),
  expected: z
    .record(z.unknown())
    .optional()
    .describe("Reference values from the source Bible/spec"),
  produced_by: z.string().describe("Agent slug that ran the validation, e.g. 'location-scout-base'"),
  validated_at: z.string().describe("ISO 8601 timestamp"),
});

export type ValidationReport = z.infer<typeof ValidationReportSchema>;
export type ValidatorType = z.infer<typeof ValidatorTypeSchema>;
export const ValidationReportJsonSchema = zodToJsonSchema(ValidationReportSchema);
