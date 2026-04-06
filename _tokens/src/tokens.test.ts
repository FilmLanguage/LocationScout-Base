/**
 * Validate token definitions: completeness, format, and consistency.
 */

import { describe, it, expect } from "vitest";
import { colors, fonts, typeScale, spacing, radius, duration, easing, layout, tokens } from "./tokens.js";

describe("colors", () => {
  it("exports all required color tokens", () => {
    const required = ["bg", "surface", "border", "text", "text-muted", "accent", "blue", "green", "red"];
    for (const key of required) {
      expect(colors, `missing color: ${key}`).toHaveProperty(key);
    }
  });

  it("all hex colors are valid format", () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    for (const [key, value] of Object.entries(colors)) {
      if (typeof value === "string" && !value.startsWith("rgba")) {
        expect(value, `invalid hex for ${key}: ${value}`).toMatch(hexPattern);
      }
    }
  });
});

describe("fonts", () => {
  it("defines sans, mono, and serif stacks", () => {
    expect(fonts.sans).toContain("IBM Plex Sans");
    expect(fonts.mono).toContain("IBM Plex Mono");
    expect(fonts.serif).toContain("Source Serif");
  });
});

describe("typeScale", () => {
  it("defines all required scale entries", () => {
    const required = ["h1", "h2", "h3", "body", "bodySm", "bodyXs", "tableHeader", "badge", "tag"];
    for (const key of required) {
      expect(typeScale, `missing typeScale: ${key}`).toHaveProperty(key);
    }
  });

  it("each entry has font, size, weight", () => {
    for (const [key, entry] of Object.entries(typeScale)) {
      expect(entry, `${key} missing font`).toHaveProperty("font");
      expect(entry, `${key} missing size`).toHaveProperty("size");
      expect(entry, `${key} missing weight`).toHaveProperty("weight");
    }
  });
});

describe("spacing", () => {
  it("follows 4px base grid", () => {
    for (const [key, value] of Object.entries(spacing)) {
      const px = parseInt(value);
      expect(px % 4, `spacing.${key} = ${value} is not on 4px grid`).toBe(0);
    }
  });
});

describe("radius", () => {
  it("defines sm, md, card, tag, code", () => {
    expect(Object.keys(radius)).toEqual(expect.arrayContaining(["sm", "md", "card", "tag", "code"]));
  });
});

describe("duration", () => {
  it("defines instant < fast < normal < slow", () => {
    const ms = (v: string) => parseInt(v);
    expect(ms(duration.instant)).toBeLessThan(ms(duration.fast));
    expect(ms(duration.fast)).toBeLessThan(ms(duration.normal));
    expect(ms(duration.normal)).toBeLessThan(ms(duration.slow));
  });
});

describe("easing", () => {
  it("defines cubic-bezier values", () => {
    for (const [key, value] of Object.entries(easing)) {
      expect(value, `easing.${key} should be cubic-bezier`).toMatch(/^cubic-bezier/);
    }
  });
});

describe("tokens (flat export)", () => {
  it("contains all token groups", () => {
    expect(tokens.colors).toBe(colors);
    expect(tokens.fonts).toBe(fonts);
    expect(tokens.typeScale).toBe(typeScale);
    expect(tokens.spacing).toBe(spacing);
    expect(tokens.radius).toBe(radius);
    expect(tokens.duration).toBe(duration);
    expect(tokens.easing).toBe(easing);
    expect(tokens.layout).toBe(layout);
  });
});
