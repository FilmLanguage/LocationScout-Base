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
  ValidationReportSchema,
  ValidationReportJsonSchema,
  RationaleSchema,
  RationaleJsonSchema,
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

describe("ValidationReportSchema", () => {
  it("parses a valid VLM validation report", () => {
    const result = ValidationReportSchema.safeParse({
      $schema: "validation-report-v1",
      validation_id: "val_001",
      artifact_uri: "agent://location-scout/anchor/loc_001",
      artifact_type: "location_anchor",
      validator: "gemini_vision",
      validator_version: "gemini-2.5-pro",
      attempt: 1,
      max_attempts: 3,
      score: 0.82,
      passed: true,
      threshold: 0.75,
      issues: [],
      produced_by: "location-scout-base",
      validated_at: "2026-04-07T12:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects score outside [0,1]", () => {
    const result = ValidationReportSchema.safeParse({
      $schema: "validation-report-v1",
      validation_id: "val_002",
      artifact_uri: "agent://x/y/1",
      artifact_type: "x",
      validator: "gemini_vision",
      attempt: 1,
      max_attempts: 3,
      score: 1.5,
      passed: false,
      threshold: 0.75,
      produced_by: "x-base",
      validated_at: "2026-04-07T12:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("exports JSON Schema", () => {
    expect(ValidationReportJsonSchema).toBeDefined();
  });
});

describe("RationaleSchema", () => {
  it("parses minimal rationale", () => {
    const result = RationaleSchema.safeParse({
      primary_reason: "Warm low-angle light reflects the era research and director vision.",
    });
    expect(result.success).toBe(true);
  });

  it("parses rationale with references and confidence", () => {
    const result = RationaleSchema.safeParse({
      primary_reason: "Hard shadows match midday Albuquerque sun.",
      references: ["agent://location-scout/research/loc_001"],
      confidence: 0.85,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty primary_reason", () => {
    const result = RationaleSchema.safeParse({ primary_reason: "" });
    expect(result.success).toBe(false);
  });

  it("exports JSON Schema", () => {
    expect(RationaleJsonSchema).toBeDefined();
  });
});

describe("LocationBible with optional rationale", () => {
  it("accepts a bible without rationale", () => {
    const minimal = {
      $schema: "location-bible-v2" as const,
      bible_id: "loc_001",
      brief_id: "brief_001",
      vision_id: "vision_001",
      research_id: "research_001",
      passport: {
        type: "INT" as const,
        time_of_day: ["DAY"],
        era: "2004 Albuquerque",
        recurring: false,
        scenes: ["s1"],
      },
      space_description: "A small kitchen.",
      atmosphere: "Tense.",
      light_base_state: {
        primary_source: "window",
        direction: "E",
        color_temp_kelvin: 5500,
        shadow_hardness: "soft" as const,
        fill_to_key_ratio: "1:2",
        practical_sources: [],
      },
      key_details: ["yellow walls"],
      negative_list: ["modern phones"],
    };
    expect(LocationBibleSchema.safeParse(minimal).success).toBe(true);
  });

  it("accepts a bible with rationale", () => {
    const withRationale = {
      $schema: "location-bible-v2" as const,
      bible_id: "loc_002",
      brief_id: "b",
      vision_id: "v",
      research_id: "r",
      passport: { type: "EXT" as const, time_of_day: ["DAY"], era: "1990s", recurring: false, scenes: ["s1"] },
      space_description: "Open desert.",
      atmosphere: "Vast.",
      light_base_state: {
        primary_source: "sun",
        direction: "OVERHEAD",
        color_temp_kelvin: 5500,
        shadow_hardness: "hard" as const,
        fill_to_key_ratio: "1:8",
        practical_sources: [],
      },
      key_details: ["cracked earth"],
      negative_list: ["green plants"],
      rationale: {
        primary_reason: "Hard noon shadows match research-pack note on midday filming.",
        references: ["agent://location-scout/research/loc_002"],
      },
    };
    expect(LocationBibleSchema.safeParse(withRationale).success).toBe(true);
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
    expect(types).toContain("validation_report");
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
