import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const FeedbackSchema = z.object({
  category: z.enum(["creative", "technical", "accuracy", "consistency"]),
  message: z.string().describe("Feedback message"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  references: z.array(z.string()).optional().describe("MCP URIs of related artifacts"),
});

export type Feedback = z.infer<typeof FeedbackSchema>;
export const FeedbackJsonSchema = zodToJsonSchema(FeedbackSchema);
