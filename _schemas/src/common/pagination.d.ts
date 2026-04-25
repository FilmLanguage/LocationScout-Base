import { z } from "zod";
export declare function PaginatedSchema<T extends z.ZodTypeAny>(itemSchema: T): z.ZodObject<{
    items: z.ZodArray<T, "many">;
    next_cursor: z.ZodNullable<z.ZodString>;
    has_more: z.ZodBoolean;
    total_count: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    items: T["_output"][];
    next_cursor: string | null;
    has_more: boolean;
    total_count?: number | undefined;
}, {
    items: T["_input"][];
    next_cursor: string | null;
    has_more: boolean;
    total_count?: number | undefined;
}>;
export declare const PaginationInputSchema: {
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
};
