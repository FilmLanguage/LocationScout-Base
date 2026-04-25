import { z } from "zod";
export declare const TaskResultSchema: z.ZodObject<{
    task_id: z.ZodString;
    status: z.ZodLiteral<"completed">;
    artifacts: z.ZodArray<z.ZodObject<{
        uri: z.ZodString;
        type: z.ZodString;
        mime_type: z.ZodString;
        version: z.ZodOptional<z.ZodNumber>;
        checksum: z.ZodOptional<z.ZodString>;
        storage_path: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        uri: string;
        mime_type: string;
        version?: number | undefined;
        checksum?: string | undefined;
        storage_path?: string | undefined;
    }, {
        type: string;
        uri: string;
        mime_type: string;
        version?: number | undefined;
        checksum?: string | undefined;
        storage_path?: string | undefined;
    }>, "many">;
    metadata: z.ZodOptional<z.ZodObject<{
        started_at: z.ZodString;
        completed_at: z.ZodString;
        duration_seconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        started_at: string;
        completed_at: string;
        duration_seconds: number;
    }, {
        started_at: string;
        completed_at: string;
        duration_seconds: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "completed";
    task_id: string;
    artifacts: {
        type: string;
        uri: string;
        mime_type: string;
        version?: number | undefined;
        checksum?: string | undefined;
        storage_path?: string | undefined;
    }[];
    metadata?: {
        started_at: string;
        completed_at: string;
        duration_seconds: number;
    } | undefined;
}, {
    status: "completed";
    task_id: string;
    artifacts: {
        type: string;
        uri: string;
        mime_type: string;
        version?: number | undefined;
        checksum?: string | undefined;
        storage_path?: string | undefined;
    }[];
    metadata?: {
        started_at: string;
        completed_at: string;
        duration_seconds: number;
    } | undefined;
}>;
export type TaskResult = z.infer<typeof TaskResultSchema>;
export declare const TaskResultJsonSchema: import("zod-to-json-schema").JsonSchema7Type & {
    $schema?: string | undefined;
    definitions?: {
        [key: string]: import("zod-to-json-schema").JsonSchema7Type;
    } | undefined;
};
