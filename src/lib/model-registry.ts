/**
 * FAL model registry + per-slot resolution.
 *
 * Logical names are short aliases for FAL endpoints. A "slot" is a use case
 * within the agent (ANCHOR, MOOD_VARIANT, ...) — each slot can be pinned to
 * a different model via env vars or overridden at call time by passing a
 * `model` argument to the tool.
 *
 * Resolution order (first match wins):
 *   1. explicit `override` arg (from tool input)
 *   2. env var `FAL_MODEL_<SLOT>` (e.g. FAL_MODEL_ANCHOR)
 *   3. env var `FAL_MODEL_DEFAULT`
 *   4. auto-select by reference availability:
 *        hasReferenceImages=true  → nano-banana/edit  (img2img)
 *        hasReferenceImages=false → nano-banana        (txt2img)
 *
 * Override values may be either a logical name ("nano-banana") or a full FAL
 * endpoint path ("fal-ai/nano-banana/edit"). Full paths are passed through as-is.
 */

export const FAL_MODELS = {
  // run-024 P0.1: Reverted defaults to Nano Banana 2 — Pro caused regressions
  // (LS isometric failed) on run-022/023 e2e.
  // /edit variant supports multi-ref `image_urls` (anchor, isometric, setup).
  "nano-banana-2": "fal-ai/nano-banana-2",
  "nano-banana-2/edit": "fal-ai/nano-banana-2/edit",
  // Legacy registrations preserved for explicit overrides — no slot defaults to them.
  "nano-banana-pro": "fal-ai/nano-banana-pro",
  "nano-banana-pro/edit": "fal-ai/nano-banana-pro/edit",
  "nano-banana": "fal-ai/nano-banana",
  "nano-banana/edit": "fal-ai/nano-banana/edit",
  "flux-pro": "fal-ai/flux-pro/v1.1",
  "flux-dev": "fal-ai/flux/dev",
  "flux-schnell": "fal-ai/flux/schnell",
} as const;

export type LogicalModel = keyof typeof FAL_MODELS;

export type Slot = "ANCHOR" | "MOOD_VARIANT" | "ISOMETRIC" | "SETUP";

/**
 * Resolve a slot to a concrete FAL endpoint path (e.g. "fal-ai/nano-banana-2/edit").
 * The result is ready to append to `https://queue.fal.run/`.
 *
 * Pass hasReferenceImages=true when the call site has at least one reference
 * image — this selects nano-banana-2/edit (img2img). Without references,
 * falls back to nano-banana-2 (t2i).
 */
export function resolveModel(slot: Slot, override?: string, hasReferenceImages = false): string {
  const raw =
    override ||
    process.env[`FAL_MODEL_${slot}`] ||
    process.env.FAL_MODEL_DEFAULT;

  if (raw) {
    return raw in FAL_MODELS ? FAL_MODELS[raw as LogicalModel] : raw;
  }

  return hasReferenceImages ? FAL_MODELS["nano-banana-2/edit"] : FAL_MODELS["nano-banana-2"];
}

/** List of all known slots — useful for diagnostics / UI dropdowns. */
export const SLOTS: Slot[] = ["ANCHOR", "MOOD_VARIANT", "ISOMETRIC", "SETUP"];
