/**
 * Design tokens — imports from @filmlanguage/tokens.
 * Source of truth: Figma Design System → @filmlanguage/tokens → this file.
 */

// @ts-expect-error — JSON import from tokens package
import sharedTokens from "@filmlanguage/tokens";

const c = sharedTokens.colors;
const f = sharedTokens.fonts;
const s = sharedTokens.spacing;
const r = sharedTokens.radius;
const d = sharedTokens.duration;
const e = sharedTokens.easing;

export const color = {
  bg: c.bg, bgCard: c.surface,
  border: c.border, borderCard: c["border-accent"],
  textPrimary: c.text, textSecondary: c["text-muted"],
  accentGold: c.accent, accentGreen: c.green, accentRed: c.red,
  accentBlue: c.blue, accentBlueBorder: c["blue-border"],
  tagBg: "rgba(255,255,255,0.1)", tagGoldBg: "rgba(253,231,118,0.25)",
  tagGreenBg: "rgba(166,247,126,0.2)", tagRedBg: "rgba(239,68,68,0.2)",
  white: c.white, white10: "rgba(255,255,255,0.1)", white05: "rgba(255,255,255,0.05)",
} as const;

export const font = {
  family: f.sans, sizeXs: "12px", sizeSm: "14px", sizeMd: "16px", sizeLg: "18px",
  weightRegular: 400, weightMedium: 500, weightSemiBold: 600, lineHeight: "20px",
} as const;

export const spacing = {
  xs: s["1"], sm: s["2"], md: s["3"], lg: s["4"],
  xl: s["6"], xxl: s["8"], xxxl: s["12"],
} as const;

export const radius = { sm: r.sm, md: r.md } as const;

export const motion = {
  durationFast: d.instant, durationNormal: d.fast, durationSlow: d.normal,
  easing: e.out, reducedMotion: "@media (prefers-reduced-motion: reduce)",
} as const;

export type InteractiveState = "default"|"hover"|"focus"|"active"|"disabled"|"loading"|"error"|"success";
export type GateStatus = "draft"|"pending_review"|"approved"|"rejected"|"revision";
