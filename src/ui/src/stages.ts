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
  | "outputs";

export interface Stage {
  id: StageId;
  label: string;
  path: string;
  /** Figma node ID for the frame (for traceability) */
  figmaNodeId: string;
}

// BETA: 3 active stages.
// Full order preserved: input → research → analysis → references → setups → light-states → outputs
// See ROLLOUT.md for restoration steps.
export const STAGES: readonly Stage[] = [
  { id: "input",      label: "Input",      path: "/",           figmaNodeId: "306:2" },
  { id: "references", label: "References", path: "/references", figmaNodeId: "433:26" },
  { id: "setups",     label: "Setups",     path: "/setups",     figmaNodeId: "436:33" },
] as const;
