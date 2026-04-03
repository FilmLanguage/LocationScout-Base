import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { IssueSchema } from "./issue.js";

export const GateVerdictSchema = z.object({
  gate: z.string().describe("Gate name: era_accuracy, bible_approval, anchor_approval, consistency"),
  verdict: z.enum(["approved", "rejected"]),
  issues: z.array(IssueSchema).optional().describe("Issues found (if rejected)"),
  consistency_score: z.number().min(0).max(1).optional().describe("0.0 = inconsistent, 1.0 = perfectly consistent"),
  notes: z.string().optional().describe("Reviewer notes"),
  approved_artifacts: z.array(z.string()).optional().describe("MCP URIs of approved artifacts"),
});

export type GateVerdict = z.infer<typeof GateVerdictSchema>;
export const GateVerdictJsonSchema = zodToJsonSchema(GateVerdictSchema);
