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
});
