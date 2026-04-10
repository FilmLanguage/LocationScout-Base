import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export const TaskStatusSchema = z.object({
  task_id: z.string().describe("UUID of the task"),
  status: z.enum(["accepted", "processing", "awaiting_approval", "revision", "completed", "failed", "cancelled"]),
  progress: z.number().min(0).max(1).optional().describe("Completion fraction, 0.0 to 1.0"),
  current_step: z.string().optional().describe("Human-readable description of current step"),
  error: z.object({
    code: z.number(),
    message: z.string(),
    retryable: z.boolean(),
  }).optional().describe("Error details if status is 'failed'"),
});

export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export const TaskStatusJsonSchema = zodToJsonSchema(TaskStatusSchema);
