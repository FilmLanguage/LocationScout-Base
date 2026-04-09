#!/usr/bin/env node

/**
 * Build script for @filmlanguage/tokens
 * Generates: dist/tokens.css, dist/tokens.json, dist/index.js, dist/figma-mapping.json
 *
 * Source of truth: Figma Design System page → "COLORS - SOURCE OF TRUTH" panel
 */

import { mkdirSync, writeFileSync } from "fs";

// ─── Token definitions (mirrors src/tokens.ts) ─────────────────────
// Updated 2026-04-06 from Figma RIGHT "SOURCE OF TRUTH" panel

const colors = {
  bg: "#111111", surface: "#131416", "surface-2": "#1e2024", "surface-3": "#26272b",
  border: "#2b2e31", "border-accent": "#43474c",
  text: "#eaebec", "text-muted": "#a1a6aa", "text-dim": "#6b6e72",
  accent: "#f7e27e", "accent-dim": "#c4a746",
  blue: "#156bf4", "blue-border": "#4186f6",
  green: "#a6f77e", red: "#ef4444",
  pink: "#d08ab4", cyan: "#60c0c0", orange: "#e0904a",
  "focus-ring": "#7f8081",
  white: "#ffffff",
};

const fonts = {
  sans: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'IBM Plex Mono', 'DM Mono', monospace",
  serif: "'Source Serif 4', Georgia, serif",
};

const spacing = {
  1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "20px",
  6: "24px", 7: "28px", 8: "32px", 9: "36px", 12: "48px", 16: "64px", 20: "80px",
};

const radius = { sm: "4px", md: "6px", card: "8px", tag: "6px", code: "3px" };

const duration = { instant: "100ms", fast: "200ms", normal: "300ms", slow: "500ms" };

const easing = {
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  in: "cubic-bezier(0.7, 0, 0.84, 0)",
  "in-out": "cubic-bezier(0.65, 0, 0.35, 1)",
};

// ─── Generate CSS ───────────────────────────────────────────────────

function generateCSS() {
  const lines = [
    "/* @filmlanguage/tokens — auto-generated, do not edit */",
    "/* Source: Figma Design System → COLORS - SOURCE OF TRUTH */",
    "",
    '@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap");',
    "",
    ":root {",
  ];

  lines.push("  /* Colors */");
  for (const [k, v] of Object.entries(colors)) {
    lines.push(`  --${k}: ${v};`);
  }

  lines.push("");
  lines.push("  /* Typography */");
  for (const [k, v] of Object.entries(fonts)) {
    lines.push(`  --${k}: ${v};`);
  }

  lines.push("");
  lines.push("  /* Spacing (4px base) */");
  for (const [k, v] of Object.entries(spacing)) {
    lines.push(`  --sp-${k}: ${v};`);
  }

  lines.push("");
  lines.push("  /* Border radius */");
  for (const [k, v] of Object.entries(radius)) {
    lines.push(`  --radius-${k}: ${v};`);
  }

  lines.push("");
  lines.push("  /* Duration */");
  for (const [k, v] of Object.entries(duration)) {
    lines.push(`  --dur-${k}: ${v};`);
  }

  lines.push("");
  lines.push("  /* Easing */");
  for (const [k, v] of Object.entries(easing)) {
    lines.push(`  --ease-${k}: ${v};`);
  }

  lines.push("}");
  lines.push("");
  lines.push("@media (prefers-reduced-motion: reduce) {");
  lines.push("  *, *::before, *::after {");
  lines.push("    animation-duration: 0.01ms !important;");
  lines.push("    transition-duration: 0.01ms !important;");
  lines.push("  }");
  lines.push("}");

  return lines.join("\n") + "\n";
}

// ─── Generate JSON ──────────────────────────────────────────────────

function generateJSON() {
  return JSON.stringify({ colors, fonts, spacing, radius, duration, easing }, null, 2) + "\n";
}

// ─── Generate JS (ESM re-export) ────────────────────────────────────

function generateJS() {
  return [
    "// @filmlanguage/tokens — auto-generated ESM entry",
    `import tokens from "./tokens.json" with { type: "json" };`,
    "export default tokens;",
    "export const { colors, fonts, spacing, radius, duration, easing } = tokens;",
    "",
  ].join("\n");
}

// ─── Generate Figma mapping ─────────────────────────────────────────

function hexToFigmaRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r: +r.toFixed(4), g: +g.toFixed(4), b: +b.toFixed(4), a: 1 };
}

function generateFigmaMapping() {
  const entries = [];

  for (const [k, v] of Object.entries(colors)) {
    entries.push({
      tokenPath: `colors.${k}`, figmaName: `color/${k}`,
      figmaType: "COLOR", value: v, figmaValue: hexToFigmaRgb(v),
    });
  }

  for (const [k, v] of Object.entries(spacing)) {
    entries.push({
      tokenPath: `spacing.${k}`, figmaName: `spacing/sp-${k}`,
      figmaType: "FLOAT", value: v, figmaValue: parseInt(v),
    });
  }

  for (const [k, v] of Object.entries(radius)) {
    entries.push({
      tokenPath: `radius.${k}`, figmaName: `radius/${k}`,
      figmaType: "FLOAT", value: v, figmaValue: parseInt(v),
    });
  }

  for (const [k, v] of Object.entries(duration)) {
    entries.push({
      tokenPath: `duration.${k}`, figmaName: `duration/${k}`,
      figmaType: "FLOAT", value: v, figmaValue: parseInt(v),
    });
  }

  for (const [k, v] of Object.entries(fonts)) {
    entries.push({
      tokenPath: `fonts.${k}`, figmaName: `font/${k}`,
      figmaType: "STRING", value: v, figmaValue: v,
    });
  }

  for (const [k, v] of Object.entries(easing)) {
    entries.push({
      tokenPath: `easing.${k}`, figmaName: `easing/${k}`,
      figmaType: "STRING", value: v, figmaValue: v,
    });
  }

  return JSON.stringify(entries, null, 2) + "\n";
}

// ─── Build ──────────────────────────────────────────────────────────

mkdirSync("dist", { recursive: true });
writeFileSync("dist/tokens.css", generateCSS());
writeFileSync("dist/tokens.json", generateJSON());
writeFileSync("dist/index.js", generateJS());
writeFileSync("dist/figma-mapping.json", generateFigmaMapping());

console.log("Built: dist/tokens.css, dist/tokens.json, dist/index.js, dist/figma-mapping.json");
