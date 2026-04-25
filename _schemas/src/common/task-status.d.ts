import { z } from "zod";
export declare const TaskStatusSchema: z.ZodObject<{
    task_id: z.ZodString;
    status: z.ZodEnum<["accepted", "processing", "awaiting_approval", "revision", "completed", "failed", "cancelled"]>;
    progress: z.ZodOptional<z.ZodNumber>;
    current_step: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodNumber;
        message: z.ZodString;
        retryable: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        retryable: boolean;
        code: number;
        message: string;
    }, {
        retryable: boolean;
        code: number;
        message: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "accepted" | "processing" | "awaiting_approval" | "revision" | "completed" | "failed" | "cancelled";
    task_id: string;
    error?: {
        retryable: boolean;
        code: number;
        message: string;
    } | undefined;
    progress?: number | undefined;
    current_step?: string | undefined;
}, {
    status: "accepted" | "processing" | "awaiting_approval" | "revision" | "completed" | "failed" | "cancelled";
    task_id: string;
    error?: {
        retryable: boolean;
        code: number;
        message: string;
    } | undefined;
    progress?: number | undefined;
    current_step?: string | undefined;
}>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export declare const TaskStatusJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
