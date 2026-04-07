import React from "react";
import { color, font, radius, motion, type GateStatus } from "../tokens.js";

/**
 * GateBadge — visual indicator for an artifact's approval gate.
 * When `showBlocker` is true and the gate is not yet approved, the badge
 * shows a red dot + red border so the user can see *why* a downstream
 * action is disabled.
 *
 * Mirrors the pattern in CastingDirector-Base/src/ui/components/GateBadge.tsx
 * to keep visual parity across agents until shared UI is extracted.
 */
interface GateBadgeProps {
  status: GateStatus;
  /** Show red border on parent when gate blocks downstream */
  showBlocker?: boolean;
}

const statusConfig: Record<GateStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: color.tagGoldBg, text: color.accentGold, label: "Draft" },
  pending_review: { bg: color.tagGoldBg, text: color.accentGold, label: "Pending Review" },
  approved: { bg: color.tagGreenBg, text: color.accentGreen, label: "Approved" },
  rejected: { bg: color.tagRedBg, text: color.accentRed, label: "Rejected" },
  revision: { bg: color.tagGoldBg, text: color.accentGold, label: "Revision" },
};

export function GateBadge({ status, showBlocker = false }: GateBadgeProps) {
  const config = statusConfig[status] ?? { bg: color.tagGoldBg, text: color.accentGold, label: status };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 16px",
        borderRadius: radius.md,
        backgroundColor: config.bg,
        color: config.text,
        fontFamily: font.family,
        fontSize: font.sizeSm,
        fontWeight: font.weightMedium,
        lineHeight: font.lineHeight,
        border: showBlocker && status !== "approved" ? `1px solid ${color.accentRed}` : "none",
        transition: `all ${motion.durationNormal} ${motion.easing}`,
      }}
      role="status"
      aria-label={`Gate status: ${config.label}`}
    >
      {showBlocker && status !== "approved" && (
        <span aria-hidden style={{ color: color.accentRed }}>●</span>
      )}
      {config.label}
    </span>
  );
}
