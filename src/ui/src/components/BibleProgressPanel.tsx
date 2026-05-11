/**
 * Bible-build progress panel.
 *
 * Single Orchestrator-style step card shown by BetaAutoBoot while the
 * scout_location pipeline is running. Mirrors the visual language of
 * Orchestrator's StartSteps (StepCard + ProgressList + Badge), but as
 * a standalone single panel — no "Step N of M" label.
 *
 * Maps the backend `progress` value (0.0-1.0) emitted by scout_location
 * to a 3-step checklist.
 */

import "./bibleProgressPanel.css";

export interface BibleProgressItem {
  label: string;
  status: "done" | "active" | "pending";
}

interface Props {
  progress: number; // 0.0 – 1.0
  currentStep: string; // backend-emitted step description
}

function buildItems(progress: number): BibleProgressItem[] {
  // BETA pipeline emits: 0.1 "Building location bible", 1.0 "Pipeline complete".
  // Research disabled — see ROLLOUT.md.
  const items: Array<{ label: string; threshold: number }> = [
    { label: "Loading brief and director vision", threshold: 0.1 },
    { label: "Generating Bible with LLM", threshold: 0.95 },
    { label: "Saving Bible artifact", threshold: 1.0 },
  ];

  return items.map((it, i) => {
    if (progress >= it.threshold) return { label: it.label, status: "done" };
    // First item still pending → active. Otherwise: active when previous is done.
    const prevThreshold = i === 0 ? 0 : items[i - 1].threshold;
    if (progress >= prevThreshold) return { label: it.label, status: "active" };
    return { label: it.label, status: "pending" };
  });
}

export function BibleProgressPanel({ progress, currentStep }: Props) {
  const items = buildItems(progress);
  return (
    <div className="bible-progress">
      <div className="bible-progress__card fade-in">
        <div className="bible-progress__header">
          <div className="bible-progress__title-group">
            <span className="bible-progress__eyebrow">Location Scout</span>
            <h2 className="bible-progress__title">Building location bible</h2>
          </div>
          <span className="bible-progress__badge">
            <span className="bible-progress__badge-dot" />
            Generating...
          </span>
        </div>
        <div className="bible-progress__loading-content">
          <p className="bible-progress__detail">{currentStep}</p>
        </div>
        <div className="bible-progress__list">
          {items.map((item, i) => (
            <div
              key={i}
              className={`bible-progress__item ${
                item.status === "pending" ? "bible-progress__item--pending" : ""
              }`}
            >
              <div
                className={`bible-progress__icon bible-progress__icon--${item.status}`}
              />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
