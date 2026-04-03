import { McpError } from "@modelcontextprotocol/sdk/types.js";

export const FL_ERRORS = {
  MISSING_DEPENDENCY: 1001,
  GATE_REJECTED: 1002,
  LLM_ERROR: 1003,
  GENERATION_ERROR: 1004,
  TIMEOUT: 1005,
  CAPACITY_EXCEEDED: 1006,
} as const;

export function flError(
  code: number,
  message: string,
  data: { retryable: boolean; suggestion: string; [key: string]: unknown },
): McpError {
  return new McpError(code, message, data);
}
