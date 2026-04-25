/**
 * Schema registry for LocationScout artifact validation on read.
 *
 * Used by loadArtifact() to detect stale/corrupt DB payloads at read time.
 * Unknown types pass through (no schema → no validation).
 *
 * Phase 1.4: validatePayload throws SCHEMA_MISMATCH instead of silently
 * returning bad data that crashes downstream.
 */

import { z } from "zod";
import {
  LocationBibleSchema,
  MoodStateSchema,
  ResearchPackSchema,
} from "@filmlanguage/schemas";

export const SCHEMA_REGISTRY: Record<string, z.ZodTypeAny> = {
  bible:    LocationBibleSchema,
  mood:     MoodStateSchema,
  research: ResearchPackSchema,
  // floorplan: no shared Zod schema yet — passes through
};

/**
 * Validate `payload` against the registered schema for `type`.
 * Returns the parsed (coerced) value on success.
 * Throws an error with `code: "SCHEMA_MISMATCH"` on validation failure.
 * If no schema is registered for `type`, passes through as-is.
 */
export function validatePayload<T>(type: string, payload: unknown): T {
  const schema = SCHEMA_REGISTRY[type];
  if (!schema) return payload as T;
  const result = schema.safeParse(payload);
  if (!result.success) {
    const err = new Error(
      `[schema-registry] SCHEMA_MISMATCH for ${type}: ${result.error.message}`
    );
    (err as NodeJS.ErrnoException & { code: string }).code = "SCHEMA_MISMATCH";
    throw err;
  }
  return result.data as T;
}
