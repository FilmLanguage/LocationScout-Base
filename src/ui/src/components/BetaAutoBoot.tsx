/**
 * BETA: Auto-boot wrapper.
 *
 * Replaces the (hidden) Input screen. On first mount, fires scout_location
 * with a hardcoded fixture brief + vision, polls until the Bible pipeline
 * completes, then dispatches APPROVE_STAGE("input") so the References page
 * becomes accessible. While the pipeline runs, renders a minimal splash.
 *
 * On every page reload the in-memory pipeline state is fresh, so this fires
 * scout_location once per session. Idempotent on the backend per location_id.
 *
 * To restore the visible Input screen, see ROLLOUT.md.
 */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { callTool, pollTask } from "../api/mcp";
import { usePipeline } from "../state/PipelineContext";
import { BibleProgressPanel } from "./BibleProgressPanel";

const PROJECT_ID = "proj_default";
const LOCATION_ID = "loc_001";

const FIXTURE_ARGS = {
  project_id: PROJECT_ID,
  location_brief: {
    location_id: LOCATION_ID,
    location_name: "Marlowe's Office",
    location_type: "INT" as const,
    time_of_day: ["DAY", "NIGHT"],
    era: "1947 Los Angeles",
    scenes: ["sc_007", "sc_012", "sc_023"],
    recurring: true,
    props_mentioned: [
      "Smith Corona typewriter",
      "Bottle of bourbon",
      "Venetian blinds",
      "Brass desk lamp",
    ],
    explicit_details: [
      "Frosted glass door with painted name",
      "Single window facing alley",
    ],
    required_practicals: ["Desk lamp", "Window light"],
  },
  director_vision: {
    era_style:
      "1947 noir Los Angeles — high-contrast B&W aesthetic, hard shadows",
    palette: "Deep blacks, hot whites, smoky greys",
    spatial_philosophy:
      "Cramped, smoke-stained, the city pressing in through the window",
    atmosphere:
      "Cigarette haze, the buzz of neon outside, jazz from a distant club",
    light_vision:
      "Hard practicals, blade-sharp window-blind shadows, single key light",
    reference_films: ["The Big Sleep", "Double Indemnity", "Out of the Past"],
  },
  priority: "normal" as const,
};

type BootStatus = "idle" | "running" | "ready" | "error";

export function BetaAutoBoot({ children }: { children: ReactNode }) {
  const { state, dispatch } = usePipeline();
  const inputApproved = state.statuses.input === "approved";
  const [status, setStatus] = useState<BootStatus>(
    inputApproved ? "ready" : "idle",
  );
  const [step, setStep] = useState<string>("Building location bible…");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (inputApproved) {
      setStatus("ready");
      return;
    }
    if (fired.current) return;
    fired.current = true;
    setStatus("running");
    (async () => {
      try {
        const result = await callTool<{ task_id: string; location_id: string }>(
          "scout_location",
          FIXTURE_ARGS,
        );
        const taskId = result.data?.task_id;
        if (!taskId) throw new Error("scout_location returned no task_id");
        const final = await pollTask(
          taskId,
          (s) => {
            if (s.current_step) setStep(s.current_step);
            if (typeof s.progress === "number") setProgress(s.progress);
          },
          800,
          180000,
        );
        if (final.status === "failed") {
          throw new Error(final.error || "Pipeline failed without an error message");
        }
        dispatch({ type: "APPROVE_STAGE", stage: "input" });
        setStatus("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    })();
  }, [inputApproved, dispatch]);

  if (status === "ready") {
    return <>{children}</>;
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        style={{
          padding: "var(--sp-4)",
          color: "#F7927E",
          fontFamily: "inherit",
        }}
      >
        Failed to build location bible: {error}
      </div>
    );
  }

  return (
    <div role="status">
      <BibleProgressPanel progress={progress} currentStep={step} />
    </div>
  );
}
