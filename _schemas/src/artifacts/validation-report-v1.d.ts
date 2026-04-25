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
export declare const ARTIFACT_TYPE: "validation_report";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "any";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://{producer}/validation/{id}";
export declare const ValidatorTypeSchema: z.ZodEnum<["gemini_vision", "gpt4_vision", "rule_based", "schema_check", "other"]>;
export declare const ValidationReportSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"validation-report-v1">;
    validation_id: z.ZodString;
    artifact_uri: z.ZodString;
    artifact_type: z.ZodString;
    validator: z.ZodEnum<["gemini_vision", "gpt4_vision", "rule_based", "schema_check", "other"]>;
    validator_version: z.ZodOptional<z.ZodString>;
    attempt: z.ZodNumber;
    max_attempts: z.ZodNumber;
    score: z.ZodNumber;
    passed: z.ZodBoolean;
    threshold: z.ZodNumber;
    issues: z.ZodDefault<z.ZodArray<z.ZodObject<{
        severity: z.ZodEnum<["critical", "warning", "info"]>;
        field: z.ZodOptional<z.ZodString>;
        issue: z.ZodString;
        suggestion: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        severity: "critical" | "warning" | "info";
        issue: string;
        suggestion?: string | undefined;
        field?: string | undefined;
    }, {
        severity: "critical" | "warning" | "info";
        issue: string;
        suggestion?: string | undefined;
        field?: string | undefined;
    }>, "many">>;
    observed: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    expected: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    produced_by: z.ZodString;
    validated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    issues: {
        severity: "critical" | "warning" | "info";
        issue: string;
        suggestion?: string | undefined;
        field?: string | undefined;
    }[];
    $schema: "validation-report-v1";
    artifact_uri: string;
    validation_id: string;
    artifact_type: string;
    validator: "gemini_vision" | "gpt4_vision" | "rule_based" | "schema_check" | "other";
    attempt: number;
    max_attempts: number;
    score: number;
    passed: boolean;
    threshold: number;
    produced_by: string;
    validated_at: string;
    expected?: Record<string, unknown> | undefined;
    validator_version?: string | undefined;
    observed?: Record<string, unknown> | undefined;
}, {
    $schema: "validation-report-v1";
    artifact_uri: string;
    validation_id: string;
    artifact_type: string;
    validator: "gemini_vision" | "gpt4_vision" | "rule_based" | "schema_check" | "other";
    attempt: number;
    max_attempts: number;
    score: number;
    passed: boolean;
    threshold: number;
    produced_by: string;
    validated_at: string;
    issues?: {
        severity: "critical" | "warning" | "info";
        issue: string;
        suggestion?: string | undefined;
        field?: string | undefined;
    }[] | undefined;
    expected?: Record<string, unknown> | undefined;
    validator_version?: string | undefined;
    observed?: Record<string, unknown> | undefined;
}>;
export type ValidationReport = z.infer<typeof ValidationReportSchema>;
export type ValidatorType = z.infer<typeof ValidatorTypeSchema>;
export declare const ValidationReportJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
