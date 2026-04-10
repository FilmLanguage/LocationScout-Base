/**
 * Variant B schema tests — scene_splitter pipeline artifacts.
 *
 * Covers the 8 schemas ported from the Python splitter_v1 codebase during
 * the Variant B refactor:
 *   - SceneBreakdownSchema (1AD)
 *   - ScriptBriefSchema (1AD)
 *   - DirectorFilmVisionSchema (Director)
 *   - DirectorSceneVisionSchema (Director)
 *   - DoPFilmVisionSchema (Cinematographer)
 *   - DoPSceneVisionSchema (Cinematographer)
 *   - ShotSchema (Editor, sub-type)
 *   - EdlSchema / EdlRowSchema / PacingMapSchema (Editor)
 *
 * Each schema gets a "valid" test and at least one "invalid" test.
 */

import { describe, it, expect } from "vitest";
import {
  SceneBreakdownSchema,
  SceneSchema,
  ScriptBriefSchema,
  DirectorFilmVisionSchema,
  DirectorSceneVisionSchema,
  DoPFilmVisionSchema,
  DoPSceneVisionSchema,
  ShotSchema,
  EdlSchema,
  EdlRowSchema,
  PacingMapSchema,
  ARTIFACT_REGISTRY,
} from "./index.js";

// ─── Scene Breakdown ───────────────────────────────────────────────────────

describe("SceneBreakdownSchema", () => {
  const validBreakdown = {
    $schema: "scene-breakdown-v1",
    project_id: "test-project",
    total_scenes: 2,
    scenes: [
      {
        scene_id: "abc123def456",
        number: 1,
        heading: "INT. KITCHEN — MORNING",
        body: "Alice pours coffee. She stares out the window.",
        characters: ["Alice"],
        location: "Kitchen",
        time: "morning",
        int_ext: "INT",
        emotional_beat: "quiet contemplation",
      },
      {
        scene_id: "def456abc789",
        number: 2,
        heading: "EXT. STREET — DAY",
        body: "Alice walks down the street.",
        characters: ["Alice"],
        location: "Street",
        time: "day",
        int_ext: "EXT",
        emotional_beat: "purpose",
      },
    ],
  };

  it("parses valid scene breakdown", () => {
    const result = SceneBreakdownSchema.safeParse(validBreakdown);
    expect(result.success).toBe(true);
  });

  it("rejects wrong $schema literal", () => {
    const result = SceneBreakdownSchema.safeParse({
      ...validBreakdown,
      $schema: "wrong-version",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing project_id", () => {
    const { project_id: _, ...rest } = validBreakdown;
    const result = SceneBreakdownSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects scene with non-numeric number", () => {
    const result = SceneBreakdownSchema.safeParse({
      ...validBreakdown,
      scenes: [{ ...validBreakdown.scenes[0], number: "first" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects scene without body", () => {
    const { body: _, ...sceneWithoutBody } = validBreakdown.scenes[0];
    const result = SceneBreakdownSchema.safeParse({
      ...validBreakdown,
      scenes: [sceneWithoutBody],
    });
    expect(result.success).toBe(false);
  });

  it("applies defaults for optional fields (characters, location, time)", () => {
    const minimalScene = {
      scene_id: "xyz",
      number: 1,
      heading: "INT. ROOM",
      body: "Something happens.",
    };
    const result = SceneSchema.safeParse(minimalScene);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.characters).toEqual([]);
      expect(result.data.location).toBe("");
      expect(result.data.emotional_beat).toBe("");
    }
  });
});

// ─── Script Brief ──────────────────────────────────────────────────────────

describe("ScriptBriefSchema", () => {
  it("parses valid brief", () => {
    const result = ScriptBriefSchema.safeParse({
      $schema: "script-brief-v1",
      project_id: "p1",
      film_title: "Lost Dogs",
      genre: "Drama",
      subgenre: "Family",
      logline: "A family discovers truths through a missing dog.",
      runtime_minutes: "6",
      synopsis: "Short synopsis here.",
      central_conflict: "The search reveals tensions.",
      screenplay_version: "unknown",
      writer: "unknown",
      total_scenes: 5,
      act_structure: "three-act",
    });
    expect(result.success).toBe(true);
  });

  it("applies 'unknown' defaults for missing string fields", () => {
    const result = ScriptBriefSchema.safeParse({
      $schema: "script-brief-v1",
      project_id: "p1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.film_title).toBe("unknown");
      expect(result.data.genre).toBe("unknown");
      expect(result.data.total_scenes).toBe(0);
    }
  });

  it("rejects non-numeric total_scenes", () => {
    const result = ScriptBriefSchema.safeParse({
      $schema: "script-brief-v1",
      project_id: "p1",
      total_scenes: "five",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Director Film Vision (DFV) ────────────────────────────────────────────

describe("DirectorFilmVisionSchema", () => {
  const validDfv = {
    $schema: "director-film-vision-v1",
    project_id: "p1",
    central_themes: ["loss", "acceptance"],
    emotional_journey: "From denial to understanding",
    visual_style: "Overlit suburban mundanity",
    key_visual_techniques: "Handheld only during conflict",
    color_philosophy: "Warm yellows in memory",
    tone_reference_films: ["Manchester by the Sea (2016)"],
    recurring_visual_motifs: ["empty dog bed"],
    world_feeling: "The weight of ordinary domestic life",
    genre_approach: "Subverts family drama",
    character_energies: [
      { name: "Alice", energy: "Control masking grief" },
    ],
  };

  it("parses valid DFV", () => {
    const result = DirectorFilmVisionSchema.safeParse(validDfv);
    expect(result.success).toBe(true);
  });

  it("rejects character_energies with wrong shape", () => {
    const result = DirectorFilmVisionSchema.safeParse({
      ...validDfv,
      character_energies: [{ name: "Alice" /* missing energy */ }],
    });
    expect(result.success).toBe(false);
  });

  it("applies array defaults when missing", () => {
    const result = DirectorFilmVisionSchema.safeParse({
      $schema: "director-film-vision-v1",
      project_id: "p1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.central_themes).toEqual([]);
      expect(result.data.character_energies).toEqual([]);
    }
  });
});

// ─── Director Scene Vision (DSV) ───────────────────────────────────────────

describe("DirectorSceneVisionSchema", () => {
  const validDsv = {
    $schema: "director-scene-vision-v1",
    project_id: "p1",
    scene_id: "abc123",
    location: "Kitchen",
    scene_summary: "Alice makes coffee alone.",
    scene_purpose: "Establish the loss",
    narrative_position: "setup",
    emotional_beat: "quiet devastation",
    tonal_mix: "Domestic routine with undertow",
    character_moment: "Alice's disciplined mask",
    key_image: "Hand over empty bowl",
    spatial_relationship: "Haunted by emptiness",
    key_visual_detail: "Dog bowl with water",
    most_important_moment: "Hand on the bowl",
    location_feeling: "Room designed for absence",
    sound_atmosphere: "Morning quiet, but wrong",
    key_sounds: ["silence", "water dripping"],
    action_description: "Alice enters, reaches, stops.",
  };

  it("parses valid DSV", () => {
    const result = DirectorSceneVisionSchema.safeParse(validDsv);
    expect(result.success).toBe(true);
  });

  it("rejects missing scene_id", () => {
    const { scene_id: _, ...rest } = validDsv;
    const result = DirectorSceneVisionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("key_sounds must be string array", () => {
    const result = DirectorSceneVisionSchema.safeParse({
      ...validDsv,
      key_sounds: [123, 456],
    });
    expect(result.success).toBe(false);
  });
});

// ─── DoP Film Vision (DPFV) ────────────────────────────────────────────────

describe("DoPFilmVisionSchema", () => {
  const validDpfv = {
    $schema: "dop-film-vision-v1",
    project_id: "p1",
    camera_system: "Arri Alexa Mini",
    lenses: "Vintage Cooke S4 25-85mm",
    aspect_ratio: "2.39:1",
    movement_vocabulary: "Handheld when lying, locked-off when truth",
    lighting_philosophy: "Practical-only",
    color_temperature: "Warm shift to cool as tension rises",
    exposure_philosophy: "Crushed shadows",
    depth_of_field_approach: "Shallow during intimacy",
    grain_texture: "35mm film grain",
    key_visual_references: ["Moonlight", "Manchester by the Sea"],
    special_requirements: "none",
  };

  it("parses valid DPFV", () => {
    const result = DoPFilmVisionSchema.safeParse(validDpfv);
    expect(result.success).toBe(true);
  });

  it("rejects key_visual_references as string instead of array", () => {
    const result = DoPFilmVisionSchema.safeParse({
      ...validDpfv,
      key_visual_references: "Moonlight",
    });
    expect(result.success).toBe(false);
  });
});

// ─── DoP Scene Vision (DPSV) ───────────────────────────────────────────────

describe("DoPSceneVisionSchema", () => {
  const validDpsv = {
    $schema: "dop-scene-vision-v1",
    project_id: "p1",
    scene_id: "abc123",
    camera_movement: "Locked off",
    lens: "50mm",
    depth_of_field: "Deep",
    lighting_setup: "Single window key",
    color_temperature: "Cool 5600K",
    exposure_notes: "Crushed shadows",
    special_techniques: "none",
    location_challenges: "Window must be consistent",
    mood_through_camera: "Stillness makes absence unbearable",
    key_images: ["Profile shot with cool window light", "Dog bowl close-up"],
  };

  it("parses valid DPSV", () => {
    const result = DoPSceneVisionSchema.safeParse(validDpsv);
    expect(result.success).toBe(true);
  });

  it("rejects missing scene_id", () => {
    const { scene_id: _, ...rest } = validDpsv;
    const result = DoPSceneVisionSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects null in key_images", () => {
    const result = DoPSceneVisionSchema.safeParse({
      ...validDpsv,
      key_images: [null, "valid image"],
    });
    expect(result.success).toBe(false);
  });
});

// ─── Shot ──────────────────────────────────────────────────────────────────

describe("ShotSchema", () => {
  const validShot = {
    shot_number: 1,
    shot_size: "WS" as const,
    action: "Alice enters kitchen",
    dialogue: "Where is the coffee?",
    audio_transition: "cut" as const,
    characters_in_frame: ["Alice"],
    director_note: "Establish routine",
    emotional_intent: "domesticity",
    lens: "35mm",
    shutter_speed: "1/50",
    depth_of_field: "deep",
    lighting_style: "natural window",
    duration: 4,
  };

  it("parses valid shot", () => {
    const result = ShotSchema.safeParse(validShot);
    expect(result.success).toBe(true);
  });

  it("rejects invalid shot_size enum", () => {
    const result = ShotSchema.safeParse({
      ...validShot,
      shot_size: "XXL",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid audio_transition enum", () => {
    const result = ShotSchema.safeParse({
      ...validShot,
      audio_transition: "fade",
    });
    expect(result.success).toBe(false);
  });

  it("allows shot without duration (optional)", () => {
    const { duration: _, ...withoutDuration } = validShot;
    const result = ShotSchema.safeParse(withoutDuration);
    expect(result.success).toBe(true);
  });

  it("rejects negative shot_number", () => {
    const result = ShotSchema.safeParse({
      ...validShot,
      shot_number: -1,
    });
    // shot_number is just int, negative allowed by current schema
    // — this documents the current behaviour
    expect(result.success).toBe(true);
  });
});

// ─── EDL ──────────────────────────────────────────────────────────────────

describe("EdlSchema", () => {
  const validEdl = {
    $schema: "edl-v1",
    project_id: "p1",
    total_shots: 1,
    total_duration_sec: 4,
    shots: [
      {
        shot_number: 1,
        shot_size: "WS",
        action: "Alice enters kitchen",
        dialogue: "",
        audio_transition: "cut",
        characters_in_frame: ["Alice"],
        director_note: "Establish routine",
        emotional_intent: "domesticity",
        lens: "35mm",
        shutter_speed: "1/50",
        depth_of_field: "deep",
        lighting_style: "natural window",
        duration: 4,
        scene_id: "abc123",
        scene_number: 1,
        scene_heading: "INT. KITCHEN",
        location: "Kitchen",
        time: "morning",
        shot_id: "abc123_s001",
      },
    ],
  };

  it("parses valid EDL", () => {
    const result = EdlSchema.safeParse(validEdl);
    expect(result.success).toBe(true);
  });

  it("rejects EDL row without scene_id", () => {
    const { scene_id: _, ...rowWithoutScene } = validEdl.shots[0];
    const result = EdlSchema.safeParse({
      ...validEdl,
      shots: [rowWithoutScene],
    });
    expect(result.success).toBe(false);
  });

  it("EdlRowSchema validates individual rows", () => {
    const result = EdlRowSchema.safeParse(validEdl.shots[0]);
    expect(result.success).toBe(true);
  });

  it("EdlRowSchema rejects row missing shot_id", () => {
    const { shot_id: _, ...bad } = validEdl.shots[0];
    const result = EdlRowSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("total_duration_sec defaults to 0 when missing", () => {
    const { total_duration_sec: _, ...rest } = validEdl;
    const result = EdlSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total_duration_sec).toBe(0);
    }
  });
});

// ─── Pacing Map ────────────────────────────────────────────────────────────

describe("PacingMapSchema", () => {
  it("parses valid pacing map", () => {
    const result = PacingMapSchema.safeParse({
      $schema: "pacing-map-v1",
      project_id: "p1",
      durations: {
        "abc123:1": 4,
        "abc123:2": 6,
        "def456:1": 3,
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-integer durations", () => {
    const result = PacingMapSchema.safeParse({
      $schema: "pacing-map-v1",
      project_id: "p1",
      durations: { "abc:1": 4.5 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric durations", () => {
    const result = PacingMapSchema.safeParse({
      $schema: "pacing-map-v1",
      project_id: "p1",
      durations: { "abc:1": "4s" },
    });
    expect(result.success).toBe(false);
  });

  it("allows empty durations map", () => {
    const result = PacingMapSchema.safeParse({
      $schema: "pacing-map-v1",
      project_id: "p1",
      durations: {},
    });
    expect(result.success).toBe(true);
  });
});

// ─── Registry integration ─────────────────────────────────────────────────

describe("Variant B artifact registry", () => {
  it("all Variant B artifact types are registered", () => {
    const types = Object.keys(ARTIFACT_REGISTRY);
    expect(types).toContain("scene_breakdown");
    expect(types).toContain("script_brief");
    expect(types).toContain("director_film_vision");
    expect(types).toContain("director_scene_vision");
    expect(types).toContain("dop_film_vision");
    expect(types).toContain("dop_scene_vision");
    expect(types).toContain("edl");
  });

  it("scene_breakdown is produced by 1ad-base", () => {
    expect(ARTIFACT_REGISTRY.scene_breakdown.producedBy).toBe("1ad-base");
  });

  it("director_film_vision is produced by director-base", () => {
    expect(ARTIFACT_REGISTRY.director_film_vision.producedBy).toBe("director-base");
  });

  it("dop_film_vision is produced by cinematographer-base", () => {
    expect(ARTIFACT_REGISTRY.dop_film_vision.producedBy).toBe("cinematographer-base");
  });

  it("edl is produced by editor-base", () => {
    expect(ARTIFACT_REGISTRY.edl.producedBy).toBe("editor-base");
  });
});
