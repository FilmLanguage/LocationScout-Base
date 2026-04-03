import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ArtifactRefSchema } from "./artifact-ref.js";

export const TaskResultSchema = z.object({
  task_id: z.string(),
  status: z.literal("completed"),
  artifacts: z.array(ArtifactRefSchema).describe("Artifacts produced by this task"),
  metadata: z.object({
    started_at: z.string().describe("ISO 8601 timestamp"),
    completed_at: z.string().describe("ISO 8601 timestamp"),
    duration_seconds: z.number(),
  }).optional(),
});

export type TaskResult = z.infer<typeof TaskResultSchema>;
export const TaskResultJsonSchema = zodToJsonSchema(TaskResultSchema);
