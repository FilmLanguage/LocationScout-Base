/**
 * Pure helpers for setup-extraction state classification + idempotent firing.
 *
 * The "Approve Anchor" button on ReferencesPage triggers extract_setups in
 * the background. The result is stored in PipelineState.setupsExtraction
 * and observed by SetupsPage (no more manual card, no more tab-mount auto-
 * fire). Keeping the logic DOM-free lets us unit-test it directly.
 *
 * See LS Setups Discipline (2026-05-19, docs/sessions/...) for context.
 */

/** Shape of what `pollTask` returns once it has merged get_task_result. */
export interface ExtractResultLike {
  status: "accepted" | "processing" | "completed" | "failed";
  progress?: number;
  current_step?: string;
  error?: string | null;
  artifacts?: Array<{ uri: string }>;
}

/** State that survives in PipelineState.setupsExtraction. */
export type SetupsExtractionState =
  | { kind: "idle" }
  | { kind: "extracting"; progress: number; current_step: string; task_id?: string }
  | { kind: "ready"; count: number; at: number }
  | { kind: "failed"; message: string };

/**
 * Classify a pollTask terminal result into a setupsExtraction state slice.
 *
 * Contract:
 *   - completed + artifacts.length>0 → ready (this is the bug-fix path:
 *     before, this was rendered as error because artifacts were undefined)
 *   - failed → failed (use backend error message verbatim; never
 *     hardcode "LLM returned empty plan")
 *   - completed + artifacts.length===0 → failed (degenerate success;
 *     surface backend's actionable text rather than guess)
 */
export function classifyExtractResult(
  final: ExtractResultLike,
): SetupsExtractionState {
  if (final.status === "failed") {
    const message =
      final.error ||
      final.current_step ||
      "Setup extraction failed — check agent logs.";
    return { kind: "failed", message };
  }
  if (final.status === "completed") {
    const artifacts = final.artifacts ?? [];
    if (artifacts.length > 0) {
      return { kind: "ready", count: artifacts.length, at: Date.now() };
    }
    // Empty-artifacts completed = degenerate success. Surface the backend's
    // actionable text so the user can act on it. Never paste a hardcoded
    // misleading message.
    const message =
      final.error ||
      final.current_step ||
      "Setup extraction returned no setups. Try regenerating the Location Bible with richer scene/space descriptions.";
    return { kind: "failed", message };
  }
  // Non-terminal status reaching classifier is a bug in callers — be safe.
  return { kind: "failed", message: `Unexpected terminal status: ${final.status}` };
}

/**
 * Decide whether a fresh extract_setups call should fire when the user
 * clicks Approve Anchor. Encodes the idempotency contract:
 *
 *   - Block if no floorplan (precondition gate).
 *   - Block if already running (extracting).
 *   - Block if already ready (don't blow away tiles on second click).
 *   - Allow if idle (first run) OR failed (retry).
 */
export function shouldFireExtractSetups(args: {
  floorplanReady: boolean;
  currentKind: SetupsExtractionState["kind"];
}): boolean {
  if (!args.floorplanReady) return false;
  return args.currentKind === "idle" || args.currentKind === "failed";
}
