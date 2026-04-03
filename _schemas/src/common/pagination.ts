import { z } from "zod";

export function PaginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    next_cursor: z.string().nullable().describe("Cursor for next page, null if last page"),
    has_more: z.boolean(),
    total_count: z.number().int().optional().describe("Total items across all pages"),
  });
}

export const PaginationInputSchema = {
  cursor: z.string().optional().describe("Opaque cursor from previous response. Omit for first page."),
  limit: z.number().int().min(1).max(100).default(20).describe("Max items per page"),
};
