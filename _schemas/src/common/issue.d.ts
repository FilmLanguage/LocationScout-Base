import { z } from "zod";
export declare const IssueSchema: z.ZodObject<{
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
}>;
export type Issue = z.infer<typeof IssueSchema>;
export declare const IssueJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
