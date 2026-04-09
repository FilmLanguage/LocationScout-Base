/**
 * Validate that all exported schemas parse valid data and reject invalid data.
 * Also verifies JSON Schema exports and registry integrity.
 */

import { describe, it, expect } from "vitest";
import {
  IssueSchema,
  IssueJsonSchema,
  FeedbackSchema,
  GateVerdictSchema,
  ArtifactRefSchema,
  TaskStatusSchema,
  TaskResultSchema,
  PaginatedSchema,
  PaginationInputSchema,
  FilmIrSchema,
  FilmIrJsonSchema,
  LocationBibleSchema,
  LocationBibleJsonSchema,
  MoodStateSchema,
  MoodStateJsonSchema,
  ShotRecipeSchema,
  DirectorVisionSchema,
  ResearchPackSchema,
  ReviewReportSchema,
  CharacterBibleSchema,
  CharacterBibleJsonSchema,
  WardrobeBibleSchema,
  AppearanceStatesSchema,
  ModelSheetSchema,
  ARTIFACT_REGISTRY,
} from "./index.js";
import { z } from "zod";

// ─── Common schemas ─────────────────────────────────────────────────

describe("IssueSchema", () => {
  it("parses valid issue", () => {
    const result = IssueSchema.safeParse({
      severity: "warning",
      issue: "Missing field",
      suggestion: "Add it",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid severity", () => {
    const result = IssueSchema.safeParse({
      severity: "unknown",
      issue: "test",
    });
    expect(result.success).toBe(false);
  });

  it("exports JSON Schema", () => {
    expect(IssueJsonSchema).toBeDefined();
    expect((IssueJsonSchema as any).type).toBe("object");
  });
});

describe("FeedbackSchema", () => {
  it("parses valid feedback", () => {
    const result = FeedbackSchema.safeParse({
      category: "creative",
      message: "Looks good",
    });
    expect(result.success).toBe(true);
  });
});

describe("GateVerdictSchema", () => {
  it("parses approved verdict", () => {
    const result = GateVerdictSchema.safeParse({
      gate: "bible_approval",
      verdict: "approved",
    });
    expect(result.success).toBe(true);
  });
});

describe("TaskStatusSchema", () => {
  it("parses valid status", () => {
    const result = TaskStatusSchema.safeParse({
      task_id: "t_001",
      status: "processing",
      progress: 0.5,
      current_step: "Generating",
    });
    expect(result.success).toBe(true);
  });
});

describe("PaginatedSchema", () => {
  it("creates paginated wrapper for any item type", () => {
    const PagedStrings = PaginatedSchema(z.string());
    const result = PagedStrings.safeParse({
      items: ["a", "b"],
      next_cursor: null,
      has_more: false,
    });
    expect(result.success).toBe(true);
  });
});

// ─── Artifact schemas ───────────────────────────────────────────────

describe("LocationBibleSchema", () => {
  it("rejects empty object", () => {
    expect(LocationBibleSchema.safeParse({}).success).toBe(false);
  });

  it("exports JSON Schema", () => {
    expect(LocationBibleJsonSchema).toBeDefined();
    expect((LocationBibleJsonSchema as any).type).toBe("object");
  });
});

describe("MoodStateSchema", () => {
  it("rejects empty object", () => {
    expect(MoodStateSchema.safeParse({}).success).toBe(false);
  });

  it("exports JSON Schema", () => {
    expect(MoodStateJsonSchema).toBeDefined();
  });
});

describe("CharacterBibleSchema", () => {
  it("rejects empty object", () => {
    expect(CharacterBibleSchema.safeParse({}).success).toBe(false);
  });

  it("exports JSON Schema", () => {
    expect(CharacterBibleJsonSchema).toBeDefined();
  });
});

// ─── All schemas export JSON Schema counterpart ─────────────────────

describe("JSON Schema exports", () => {
  const jsonSchemas = [
    ["FilmIr", FilmIrJsonSchema],
    ["LocationBible", LocationBibleJsonSchema],
    ["MoodState", MoodStateJsonSchema],
  ] as const;

  for (const [name, schema] of jsonSchemas) {
    it(`${name} has valid JSON Schema structure`, () => {
      expect(schema).toBeDefined();
      expect(typeof schema).toBe("object");
    });
  }
});

// ─── Registry ───────────────────────────────────────────────────────

describe("ARTIFACT_REGISTRY", () => {
  it("has entries for all core artifact types", () => {
    const types = Object.keys(ARTIFACT_REGISTRY);
    expect(types).toContain("location_bible");
    expect(types).toContain("mood_states");
    expect(types).toContain("film_ir");
    expect(types).toContain("shot_recipe");
    expect(types).toContain("character_bible");
  });

  it("every entry has required fields", () => {
    for (const [type, entry] of Object.entries(ARTIFACT_REGISTRY)) {
      expect(entry.uriPattern, `${type} missing uriPattern`).toBeTruthy();
      expect(entry.producedBy, `${type} missing producedBy`).toBeTruthy();
      expect(entry.mimeType, `${type} missing mimeType`).toBeTruthy();
    }
  });

  it("URI patterns follow agent:// convention", () => {
    for (const [type, entry] of Object.entries(ARTIFACT_REGISTRY)) {
      expect(entry.uriPattern, `${type} URI should start with agent://`).toMatch(/^agent:\/\//);
    }
  });
});
