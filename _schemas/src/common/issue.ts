import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const IssueSchema = z.object({
  severity: z.enum(["critical", "warning", "info"]),
  field: z.string().optional().describe("JSON path to problematic field, e.g. 'key_details[3]'"),
  issue: z.string().describe("What is wrong"),
  suggestion: z.string().optional().describe("How to fix it"),
});

export type Issue = z.infer<typeof IssueSchema>;
export const IssueJsonSchema = zodToJsonSchema(IssueSchema);
