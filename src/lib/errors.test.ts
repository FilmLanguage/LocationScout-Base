import { describe, it, expect } from "vitest";
import { FL_ERRORS, flError } from "./errors.js";

describe("FL_ERRORS", () => {
  it("defines expected error codes", () => {
    expect(FL_ERRORS.MISSING_DEPENDENCY).toBe(1001);
    expect(FL_ERRORS.GATE_REJECTED).toBe(1002);
    expect(FL_ERRORS.LLM_ERROR).toBe(1003);
    expect(FL_ERRORS.GENERATION_ERROR).toBe(1004);
    expect(FL_ERRORS.TIMEOUT).toBe(1005);
    expect(FL_ERRORS.CAPACITY_EXCEEDED).toBe(1006);
  });
});

describe("flError", () => {
  it("creates McpError with code, message, and data", () => {
    const err = flError(FL_ERRORS.LLM_ERROR, "API failed", {
      retryable: true,
      suggestion: "Try again",
    });
    expect(err.code).toBe(1003);
    expect(err.message).toContain("API failed");
    expect(err.data).toEqual({ retryable: true, suggestion: "Try again" });
  });
});
