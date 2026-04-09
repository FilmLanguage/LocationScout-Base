/**
 * @filmlanguage/tokens — Design tokens
 *
 * Source of truth: Figma Design System page → "COLORS - SOURCE OF TRUTH" panel
 * File: narrativity-UI (PnAhZwUJJmtTBRJWZh08ed), page node 326:2
 *
 * Sync pipeline: Figma → (figma-sync pull) → this file → (npm run build) → dist/
 */

// ─── Colors ─────────────────────────────────────────────────────────
// From Figma RIGHT panel "COLORS - SOURCE OF TRUTH" (node 332:1087)

export const colors = {
  // Backgrounds
  bg:         "#0c0c0f",    // Page BG
  surface:    "#16161b",    // Card BG
  "surface-2": "#1e1e25",   // Nested containers
  "surface-3": "#26262f",   // Tertiary depth

  // Borders
  border:       "#2a2a35",  // Page Border
  "border-accent": "#3a3a48", // Card / Chip Border

  // Text
  text:      "#e8e6e3",     // Primary Text
  "text-muted": "#9a9890",  // Secondary Text
  "text-dim":   "#6b6960",  // Tertiary text

  // Accent & semantic
  accent:    "#f0c040",     // Gold / Active
  "accent-dim": "#c09a20",  // Muted accent
  blue:      "#5b9bd5",     // Blue / CTA
  green:     "#7bc47f",     // Green / Status
  red:       "#d97070",     // Error, gates, negative list
  pink:      "#d08ab4",     // Gate badges, keywords
  cyan:      "#60c0c0",     // Technical tags
  orange:    "#e0904a",     // Warnings

  // Chip/Tag fills
  "chip-fill": "rgba(255,255,255,0.1)",   // 10% white
  "flag-fill": "rgba(240,192,64,0.25)",   // 25% gold
  "tag-green": "rgba(123,196,127,0.2)",   // 20% green
  "tag-red":   "rgba(217,112,112,0.2)",   // 20% red

  // Focus
  "focus-ring": "#7f8081",

  white: "#ffffff",
} as const;

// ─── Typography ─────────────────────────────────────────────────────

export const fonts = {
  sans:  "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  mono:  "'IBM Plex Mono', 'DM Mono', monospace",
  serif: "'Source Serif 4', Georgia, serif",
} as const;

export const typeScale = {
  h1:          { font: "serif", size: "42px", weight: "700", letterSpacing: "-0.02em", lineHeight: "1.2" },
  h2:          { font: "serif", size: "28px", weight: "600", letterSpacing: "-0.01em", lineHeight: "1.3" },
  h3:          { font: "sans",  size: "18px", weight: "600", letterSpacing: "0",       lineHeight: "1.4" },
  body:        { font: "sans",  size: "16px", weight: "400", letterSpacing: "0",       lineHeight: "1.7" },
  bodySm:      { font: "sans",  size: "14px", weight: "400", letterSpacing: "0",       lineHeight: "1.5" },
  bodyXs:      { font: "sans",  size: "12px", weight: "400", letterSpacing: "0",       lineHeight: "1.4" },
  tableHeader: { font: "mono",  size: "11px", weight: "400", letterSpacing: "0.06em",  lineHeight: "1.4", textTransform: "uppercase" },
  badge:       { font: "mono",  size: "11px", weight: "400", letterSpacing: "0.1em",   lineHeight: "1.4", textTransform: "uppercase" },
  tag:         { font: "sans",  size: "14px", weight: "500", letterSpacing: "0",       lineHeight: "1.4" },
  codeInline:  { font: "mono",  size: "0.9em", weight: "400", letterSpacing: "0",      lineHeight: "1.4" },
  codeBlock:   { font: "mono",  size: "13px", weight: "400", letterSpacing: "0",       lineHeight: "1.65" },
} as const;

// ─── Spacing (4px base) ─────────────────────────────────────────────

export const spacing = {
  1:  "4px",
  2:  "8px",
  3:  "12px",
  4:  "16px",
  5:  "20px",
  6:  "24px",
  7:  "28px",
  8:  "32px",
  9:  "36px",
  12: "48px",
  16: "64px",
  20: "80px",
} as const;

// ─── Border Radius ──────────────────────────────────────────────────

export const radius = {
  sm:   "4px",
  md:   "6px",
  card: "8px",
  tag:  "6px",
  code: "3px",
} as const;

// ─── Motion ─────────────────────────────────────────────────────────

export const duration = {
  instant: "100ms",
  fast:    "200ms",
  normal:  "300ms",
  slow:    "500ms",
} as const;

export const easing = {
  out:   "cubic-bezier(0.16, 1, 0.3, 1)",
  in:    "cubic-bezier(0.7, 0, 0.84, 0)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

// ─── Layout ─────────────────────────────────────────────────────────

export const layout = {
  maxWidth:       "920px",
  pagePadding:    "80px 40px 120px",
  mobilePadding:  "40px 20px 80px",
  mobileBreak:    "640px",
  tabletBreak:    "1024px",
} as const;

// ─── Flat export ────────────────────────────────────────────────────

export const tokens = {
  colors,
  fonts,
  typeScale,
  spacing,
  radius,
  duration,
  easing,
  layout,
} as const;
