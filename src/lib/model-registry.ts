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
 *   4. built-in default: "nano-banana/edit"
 *
 * Override values may be either a logical name ("flux-pro") or a full FAL
 * endpoint path ("fal-ai/flux-pro/v1.1"). Full paths are passed through as-is.
 */

export const FAL_MODELS = {
  "nano-banana": "fal-ai/nano-banana",
  "nano-banana/edit": "fal-ai/nano-banana/edit",
  "flux-pro": "fal-ai/flux-pro/v1.1",
  "flux-dev": "fal-ai/flux/dev",
  "flux-schnell": "fal-ai/flux/schnell",
} as const;

export type LogicalModel = keyof typeof FAL_MODELS;

export type Slot = "ANCHOR" | "MOOD_VARIANT" | "ISOMETRIC";

const BUILTIN_DEFAULT: LogicalModel = "flux-schnell";

/**
 * Resolve a slot to a concrete FAL endpoint path (e.g. "fal-ai/nano-banana/edit").
 * The result is ready to append to `https://queue.fal.run/`.
 */
export function resolveModel(slot: Slot, override?: string): string {
  const raw =
    override ||
    process.env[`FAL_MODEL_${slot}`] ||
    process.env.FAL_MODEL_DEFAULT ||
    BUILTIN_DEFAULT;

  // If the caller passed a full endpoint path (contains a slash and is not a
  // known logical alias), use it verbatim.
  if (raw in FAL_MODELS) {
    return FAL_MODELS[raw as LogicalModel];
  }
  return raw;
}

/** List of all known slots — useful for diagnostics / UI dropdowns. */
export const SLOTS: Slot[] = ["ANCHOR", "MOOD_VARIANT", "ISOMETRIC"];
