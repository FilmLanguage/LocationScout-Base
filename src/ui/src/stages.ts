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

export const STAGES: readonly Stage[] = [
  { id: "input", label: "Input", path: "/", figmaNodeId: "306:2" },
  { id: "research", label: "Research", path: "/research", figmaNodeId: "408:12" },
  { id: "analysis", label: "Analysis", path: "/analysis", figmaNodeId: "429:19" },
  { id: "references", label: "Reference generation", path: "/references", figmaNodeId: "433:26" },
  { id: "setups", label: "Setups", path: "/setups", figmaNodeId: "436:33" },
  { id: "light-states", label: "Light/States", path: "/light-states", figmaNodeId: "440:40" },
  { id: "outputs", label: "Outputs", path: "/outputs", figmaNodeId: "445:47" },
] as const;
