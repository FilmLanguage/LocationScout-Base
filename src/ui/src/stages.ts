/**
 * The 7-stage Location Scout pipeline. Mirrors the Figma page
 * "Location Scout" (node 264:800) frames in order.
 */
export type StageId =
  | "input"
  | "research"
  | "analysis"
  | "references"
  | "setups"
  | "light-states"
  | "outputs"
  | "gallery";

export interface Stage {
  id: StageId;
  label: string;
  path: string;
  /** Figma node ID for the frame (for traceability) */
  figmaNodeId: string;
}

// BETA: 2 visible stages — Input is auto-fired in the background by BetaAutoBoot.
// Full order preserved: input → research → analysis → references → setups → light-states → outputs
// See ROLLOUT.md for restoration steps.
export const STAGES: readonly Stage[] = [
  { id: "references", label: "References", path: "/",        figmaNodeId: "433:26" },
  { id: "setups",     label: "Setups",     path: "/setups",  figmaNodeId: "436:33" },
  { id: "gallery",    label: "Gallery",    path: "/gallery", figmaNodeId: "TBD"    },
] as const;
