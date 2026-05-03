/**
 * Unit tests for the prompt-assembly helpers used by both the generator tools
 * and the assemble-preview tools (`assemble_anchor_prompt` etc).
 *
 * The contract under test: given a Location Bible + (optionally) a setup, the
 * builders produce the same {{var}} map the template engine expects, and
 * `fillTemplate(TEMPLATE, vars)` yields a stable preview string identical to
 * what the generator would send to FAL.
 */

import { describe, it, expect } from "vitest";
import {
  buildAnchorPromptVars,
  buildIsometricPromptVars,
  buildSetupPromptVars,
  stripPersonTokens,
  isOverheadCamera,
} from "./prompt-assembly.js";
import { fillTemplate, loadPrompt } from "./prompt-loader.js";

const ANCHOR_TPL = loadPrompt(import.meta.url, "generate-anchor-system");
const ISOMETRIC_TPL = loadPrompt(import.meta.url, "generate-isometric-system");
const SETUP_TPL = loadPrompt(import.meta.url, "generate-setup-system");

const mockBible = {
  bible_id: "loc_001",
  passport: { location_name: "Jesse Apartment - Living Room", era: "2004 Albuquerque" },
  space_description: "A dimly-lit suburban living room with mustard couch and CRT TV",
  approval_status: "approved",
};

describe("buildAnchorPromptVars", () => {
  it("pulls space_description from the Bible", () => {
    expect(buildAnchorPromptVars(mockBible)).toEqual({
      space_description: "A dimly-lit suburban living room with mustard couch and CRT TV",
    });
  });

  it("falls back to empty string when Bible lacks space_description", () => {
    expect(buildAnchorPromptVars({})).toEqual({ space_description: "" });
  });
});

describe("buildIsometricPromptVars", () => {
  it("assembles location_name + era_clause + space_description from passport", () => {
    const vars = buildIsometricPromptVars(mockBible);
    expect(vars.location_name).toBe("Jesse Apartment - Living Room");
    expect(vars.era_clause).toBe(" Era: 2004 Albuquerque.");
    expect(vars.space_description).toContain("mustard couch");
    // Era clause always starts with a leading space so the template flows.
    expect(vars.era_clause.startsWith(" ")).toBe(true);
  });

  it("uses fallback location name when passport is missing one", () => {
    const bibleWithoutPassport = { space_description: "x" };
    const vars = buildIsometricPromptVars(bibleWithoutPassport, "fallback_id");
    expect(vars.location_name).toBe("fallback_id");
    expect(vars.era_clause).toBe("");
  });
});

describe("buildSetupPromptVars", () => {
  it("clamps space_description to 300 chars to mirror the generator", () => {
    const longBible = { space_description: "x".repeat(500) };
    const setup = { id: "S1-A", scene: "S1", mood: "daylight", camera: "35mm" };
    const vars = buildSetupPromptVars(longBible, setup);
    expect(vars.space_description.length).toBe(300);
    expect(vars.scene).toBe("S1");
    expect(vars.mood).toBe("daylight");
    expect(vars.camera).toBe("35mm");
  });

  it("tolerates a missing camera field", () => {
    const setup = { id: "S1-A", scene: "S1", mood: "daylight" };
    expect(buildSetupPromptVars(mockBible, setup).camera).toBe("");
  });
});

describe("template fills — end-to-end preview", () => {
  it("anchor template renders the space description inline", () => {
    const prompt = fillTemplate(ANCHOR_TPL, buildAnchorPromptVars(mockBible));
    expect(prompt).toContain("Cinematic film location photograph");
    expect(prompt).toContain("A dimly-lit suburban living room with mustard couch and CRT TV");
    // run-019 I5: anchor must read as photoreal eye-level photo, not isometric.
    expect(prompt).toContain("photorealistic");
    expect(prompt).toContain("eye-level");
    expect(prompt).toContain("no isometric projection");
  });

  it("isometric template includes location name and era", () => {
    const prompt = fillTemplate(ISOMETRIC_TPL, buildIsometricPromptVars(mockBible));
    expect(prompt).toContain("Jesse Apartment - Living Room");
    expect(prompt).toContain("Era: 2004 Albuquerque");
    expect(prompt).toContain("mustard couch");
    expect(prompt).not.toContain("{{");
  });

  it("setup template substitutes scene, mood, camera", () => {
    const setup = { id: "S1-A", scene: "scene-1", mood: "dusk", camera: "35mm wide" };
    const prompt = fillTemplate(SETUP_TPL, buildSetupPromptVars(mockBible, setup));
    expect(prompt).toContain("scene-1");
    expect(prompt).toContain("dusk");
    expect(prompt).toContain("35mm wide");
    expect(prompt).not.toContain("{{");
  });

  // run-021 P0.3: setup images must be empty/unstaged — no people, no
  // figures, no characters, even when scenario passes person-words.
  it("setup template emits empty-room language and never includes person-words", () => {
    const setup = {
      id: "S1-A",
      scene: "Overhead shot, two figures on white floor, absolute stillness",
      mood: "clinical, lit by fluorescents over the people",
      camera: "12mm wide overhead",
    };
    const prompt = fillTemplate(SETUP_TPL, buildSetupPromptVars(mockBible, setup));

    // Empty room language present
    expect(prompt).toMatch(/empty|no people|no figures/i);

    // Person tokens from input MUST NOT appear as ENTITIES IN THE SCENE.
    // The template intentionally repeats "no people, no figures, no characters"
    // as explicit anti-instructions (these are RGB-style negation cues that
    // diffusion models honor) and lists banned tokens in the NEGATIVE section.
    // What we forbid is the input scene's "two figures on white floor" reaching
    // FAL as a positive ENTITY — verified by grepping for the input's noun
    // phrase (e.g. "two figures") rather than the word "figure".
    expect(prompt).not.toContain("two figures");
    expect(prompt).not.toMatch(/\b(?:figures|people|persons|humans|characters)\s+on\s+/i);
    expect(prompt).not.toMatch(/lit by fluorescents over the people/i);
  });
});

// run-025 B7: camera directive must appear at the TOP of the setup prompt
// so the diffusion model weights it at maximum priority.
describe("setup camera directive — run-025 B7", () => {
  it("places camera directive at top of setup prompt for overhead shots", () => {
    const setup = { id: "S2", scene: "Absolute stillness", mood: "sterile", camera: "overhead, crane, wide" };
    const prompt = fillTemplate(SETUP_TPL, buildSetupPromptVars(mockBible, setup));
    expect(prompt.slice(0, 200).toLowerCase()).toMatch(/overhead|top-down|90°/);
  });

  it("emits no eye-level fallback for explicit overhead camera", () => {
    const setup = { id: "S2", scene: "Absolute stillness", mood: "sterile", camera: "overhead, crane, wide" };
    const prompt = fillTemplate(SETUP_TPL, buildSetupPromptVars(mockBible, setup));
    // The positive photorealism clause must not describe the shot as eye-level.
    expect(prompt).not.toContain("eye-level real photograph");
    // The overhead photorealism clause must be used instead.
    expect(prompt).toContain("top-down real photograph");
  });

  it("retains eye-level phrasing for non-overhead setups", () => {
    const setup = { id: "S1", scene: "Wide entry shot", mood: "clinical", camera: "wide, eye-level" };
    const prompt = fillTemplate(SETUP_TPL, buildSetupPromptVars(mockBible, setup));
    expect(prompt).toContain("eye-level real photograph");
  });

  it("injects CAMERA ANGLE directive before room description", () => {
    const setup = { id: "S2", scene: "Still", mood: "sterile", camera: "overhead, crane, wide" };
    const prompt = fillTemplate(SETUP_TPL, buildSetupPromptVars(mockBible, setup));
    const cameraPos = prompt.indexOf("CAMERA ANGLE");
    const roomPos = prompt.indexOf("Empty unstaged");
    expect(cameraPos).toBeGreaterThanOrEqual(0);
    expect(cameraPos).toBeLessThan(roomPos);
  });

  it("omits camera_directive prefix when camera is empty", () => {
    const setup = { id: "S1", scene: "Wide shot", mood: "daylight" };
    const prompt = fillTemplate(SETUP_TPL, buildSetupPromptVars(mockBible, setup));
    expect(prompt).not.toContain("CAMERA ANGLE");
    // Should still start with room description
    expect(prompt.trimStart()).toMatch(/^Empty unstaged/);
  });
});

describe("isOverheadCamera", () => {
  it("detects 'overhead'", () => expect(isOverheadCamera("overhead, crane, wide")).toBe(true));
  it("detects 'top-down'", () => expect(isOverheadCamera("top-down shot")).toBe(true));
  it("detects 'top down'", () => expect(isOverheadCamera("top down view")).toBe(true));
  it("detects '90°'", () => expect(isOverheadCamera("90° angle")).toBe(true));
  it("detects 'bird's eye'", () => expect(isOverheadCamera("bird's eye view")).toBe(true));
  it("returns false for eye-level", () => expect(isOverheadCamera("wide, eye-level")).toBe(false));
  it("returns false for empty string", () => expect(isOverheadCamera("")).toBe(false));
});

describe("stripPersonTokens", () => {
  it("removes figure/figures/people/person/character tokens", () => {
    expect(stripPersonTokens("two figures on white floor")).not.toMatch(/figures?/i);
    expect(stripPersonTokens("a person walks")).not.toMatch(/person/i);
    expect(stripPersonTokens("crowd of humans")).not.toMatch(/humans?|crowd/i);
  });

  it("does not break room descriptors", () => {
    expect(stripPersonTokens("white minimalist room")).toBe("white minimalist room");
    expect(stripPersonTokens("12mm wide overhead")).toBe("12mm wide overhead");
  });
});
