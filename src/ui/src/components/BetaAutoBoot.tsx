/**
 * Pass-through wrapper.
 *
 * Pipeline contract: script analysis happens upstream (Director / analysis
 * agents). By the time the user lands on Location Scout, the brief either
 * already exists (in which case generation uses it) or doesn't (in which
 * case Generate calls will fail at the backend — the location agent does
 * not invent input data).
 *
 * History:
 *   - First this component auto-fired `scout_location` with a hardcoded
 *     "Marlowe's Office, 1947 noir LA" fixture. That was a silent mock.
 *   - Then it was a gate that blocked the UI behind a "no brief" screen.
 *     That was overreach — supplying briefs is an upstream concern, not
 *     this agent's UI concern.
 *   - Now it simply renders children. The agent UI is always available;
 *     the cards stay empty until the user presses Generate.
 */

import type { ReactNode } from "react";

export function BetaAutoBoot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
