import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { IssueSchema } from "../common/issue.js";

export const ARTIFACT_TYPE = "review_report" as const;
export const ARTIFACT_VERSION = "v1" as const;
export const PRODUCED_BY = "unassigned" as const;
export const MIME_TYPE = "application/json" as const;
export const URI_PATTERN = "agent://pipeline/review-report/{id}" as const;

export const ReviewReportSchema = z.object({
  $schema: z.literal("review-report-v1"),
  report_id: z.string().describe("Unique report ID"),
  artifact_uri: z.string().describe("MCP resource URI of the reviewed artifact"),
  reviewer: z.string().describe("Agent slug that performed the review"),
  gate: z.string().describe("Gate name this review belongs to"),
  verdict: z.enum(["approved", "rejected"]),
  issues: z.array(IssueSchema).describe("Issues found during review"),
  consistency_score: z.number().min(0).max(1).optional().describe("Overall consistency score"),
  recommendation: z.string().optional().describe("Summary recommendation"),
  reviewed_at: z.string().describe("ISO 8601 timestamp"),
});

export type ReviewReport = z.infer<typeof ReviewReportSchema>;
export const ReviewReportJsonSchema = zodToJsonSchema(ReviewReportSchema);
