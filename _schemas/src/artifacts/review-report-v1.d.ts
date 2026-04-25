import { z } from "zod";
export declare const ARTIFACT_TYPE: "review_report";
export declare const ARTIFACT_VERSION: "v1";
export declare const PRODUCED_BY: "unassigned";
export declare const MIME_TYPE: "application/json";
export declare const URI_PATTERN: "agent://pipeline/review-report/{id}";
export declare const ReviewReportSchema: z.ZodObject<{
    $schema: z.ZodLiteral<"review-report-v1">;
    report_id: z.ZodString;
    artifact_uri: z.ZodString;
    reviewer: z.ZodString;
    gate: z.ZodString;
    verdict: z.ZodEnum<["approved", "rejected"]>;
    issues: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
    consistency_score: z.ZodOptional<z.ZodNumber>;
    recommendation: z.ZodOptional<z.ZodString>;
    reviewed_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    issues: {
        severity: "critical" | "warning" | "info";
        issue: string;
        suggestion?: string | undefined;
        field?: string | undefined;
    }[];
    gate: string;
    verdict: "approved" | "rejected";
    $schema: "review-report-v1";
    report_id: string;
    artifact_uri: string;
    reviewer: string;
    reviewed_at: string;
    consistency_score?: number | undefined;
    recommendation?: string | undefined;
}, {
    issues: {
        severity: "critical" | "warning" | "info";
        issue: string;
        suggestion?: string | undefined;
        field?: string | undefined;
    }[];
    gate: string;
    verdict: "approved" | "rejected";
    $schema: "review-report-v1";
    report_id: string;
    artifact_uri: string;
    reviewer: string;
    reviewed_at: string;
    consistency_score?: number | undefined;
    recommendation?: string | undefined;
}>;
export type ReviewReport = z.infer<typeof ReviewReportSchema>;
export declare const ReviewReportJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
