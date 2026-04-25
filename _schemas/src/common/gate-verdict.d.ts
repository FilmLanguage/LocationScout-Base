import { z } from "zod";
export declare const GateVerdictSchema: z.ZodObject<{
    gate: z.ZodString;
    verdict: z.ZodEnum<["approved", "rejected"]>;
    issues: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
    consistency_score: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
    approved_artifacts: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    gate: string;
    verdict: "approved" | "rejected";
    issues?: {
        severity: "critical" | "warning" | "info";
        issue: string;
        suggestion?: string | undefined;
        field?: string | undefined;
    }[] | undefined;
    consistency_score?: number | undefined;
    notes?: string | undefined;
    approved_artifacts?: string[] | undefined;
}, {
    gate: string;
    verdict: "approved" | "rejected";
    issues?: {
        severity: "critical" | "warning" | "info";
        issue: string;
        suggestion?: string | undefined;
        field?: string | undefined;
    }[] | undefined;
    consistency_score?: number | undefined;
    notes?: string | undefined;
    approved_artifacts?: string[] | undefined;
}>;
export type GateVerdict = z.infer<typeof GateVerdictSchema>;
export declare const GateVerdictJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
