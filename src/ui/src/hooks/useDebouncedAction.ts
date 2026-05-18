import { useCallback, useRef } from "react";

/**
 * Wrap an action handler with a leading-edge debounce guard.
 *
 * The first call within a `ms` window fires immediately; subsequent calls
 * inside that window are swallowed. Prevents double-click double-charging
 * on paid backend actions (FAL image gen, LLM generation, etc.). T22.
 *
 * Returns the same function reference on every render with the same `fn`
 * identity (memoized via useCallback), so it can be passed safely to JSX.
 */
export function useDebouncedAction<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  ms = 1000,
): (...args: TArgs) => TReturn | undefined {
  const lastCallRef = useRef(0);
  return useCallback(
    (...args: TArgs): TReturn | undefined => {
      const now = Date.now();
      if (now - lastCallRef.current < ms) return undefined;
      lastCallRef.current = now;
      return fn(...args);
    },
    [fn, ms],
  );
}
