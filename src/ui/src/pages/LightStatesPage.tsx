/**
 * Stage 6 — Light State Variations.
 * Mirrors Figma frame "Light State Variations" (node 440:40).
 */

import { useNavigate } from "react-router-dom";
import { usePipeline } from "../state/PipelineContext";

export function LightStatesPage() {
  const { state, dispatch } = usePipeline();
  const navigate = useNavigate();
  const ls = state.lightStates;
  const activeSource = ls.sources.find((s) => s.id === ls.activeSourceId) ?? ls.sources[0];
  const visibleVariations = ls.variations.filter((v) => v.status !== "canceled");
  const approvedCount = visibleVariations.filter((v) => v.status === "approved").length;
  const draftCount = visibleVariations.filter((v) => v.status === "draft").length;

  const handleAdvance = () => {
    dispatch({ type: "APPROVE_STAGE", stage: "light-states" });
    navigate("/outputs");
  };

  return (
    <div className="input-page" data-figma-node="440:40">
      <div className="advisory">
        <span className="advisory__icon" aria-hidden>⚠</span>
        <span>
          Mood states are deltas from Bible base. Configure variations per setup, then
          generate images.
        </span>
        <span className="banner__spacer" />
        <span className="tech-badge tech-badge--green">CLAUDE</span>
        <span className="tech-badge tech-badge--gold">NANOBANANA</span>
      </div>

      <div className="columns-3">
        {/* ───── Source Setups ───── */}
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Source Setups</span>
            <span className="section-header__subtitle">Select setup</span>
          </div>
          <article className="card">
            <div className="source-list">
              {ls.sources.map((s) => (
                <div
                  key={s.id}
                  className={`source-item${s.id === ls.activeSourceId ? " source-item--active" : ""}`}
                  onClick={() => dispatch({ type: "SELECT_LIGHT_SOURCE", id: s.id })}
                >
                  <span className="source-item__title">{s.id}</span>
                  <span className="source-item__meta">{s.meta}</span>
                  <span className="source-item__meta">{s.variations} variations configured</span>
                </div>
              ))}
            </div>
          </article>
        </div>

        {/* ───── Mood Configuration ───── */}
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Mood Configuration for {activeSource.id}</span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--s-3)" }}>
              <span className="mini-label">Base: Bible state (W, 5500K, soft, clean)</span>

              <div className="delta-row">
                <span className="delta-row__label">Direction</span>
                <span>
                  <span className="delta-row__base">W</span>{" "}
                  <span className="delta-arrow">→ override:</span>{" "}
                  <span className="delta-row__value">OVERHEAD</span>
                </span>
              </div>
              <div className="delta-row">
                <span className="delta-row__label">Time of Day</span>
                <span>
                  <span className="delta-row__value">NIGHT</span>{" "}
                  <span className="delta-row__base">(base: DAY)</span>
                </span>
              </div>
              <div className="delta-row">
                <span className="delta-row__label">Color Temp</span>
                <span>
                  <span className="delta-row__value" style={{ color: "var(--accent)" }}>2700K</span>{" "}
                  <span className="delta-row__base">Base: 5500K</span>
                </span>
              </div>
              <div className="delta-row">
                <span className="delta-row__label">Shadow Hardness</span>
                <span>
                  <span className="chip chip--sm chip--outlined chip--active">hard</span>{" "}
                  <span className="chip chip--sm chip--outlined">soft</span>{" "}
                  <span className="chip chip--sm chip--outlined">mixed</span>
                </span>
              </div>

              <span className="section-label">State Deltas</span>
              <div className="delta-row">
                <span className="delta-row__label">Light Change</span>
                <span className="delta-row__value">5500K → 2700K, direction W → overhead</span>
              </div>
              <div className="delta-row">
                <span className="delta-row__label">Props Change</span>
                <span className="delta-row__value">Beer cans accumulate on table, ashtray appears</span>
              </div>
              <div className="delta-row">
                <span className="delta-row__label">Atmosphere Shift</span>
                <span className="delta-row__value">Tense silence replaces morning bustle</span>
              </div>
              <div className="delta-row">
                <span className="delta-row__label">Clutter Level</span>
                <span>
                  <span className="chip chip--sm chip--outlined">clean</span>{" "}
                  <span className="chip chip--sm chip--outlined">slight</span>{" "}
                  <span className="chip chip--sm chip--outlined chip--active">messy</span>{" "}
                  <span className="chip chip--sm chip--outlined">destroyed</span>
                </span>
              </div>
              <div className="delta-row">
                <span className="delta-row__label">Window State</span>
                <span>
                  <span className="chip chip--sm chip--outlined">open</span>{" "}
                  <span className="chip chip--sm chip--outlined chip--active">closed</span>{" "}
                  <span className="chip chip--sm chip--outlined">curtains_drawn</span>{" "}
                  <span className="chip chip--sm chip--outlined">boarded_up</span>
                </span>
              </div>

              {/* AI Suggestion — dismiss × is the v1 gap-fill for dismiss_mood_suggestion */}
              {!ls.aiSuggestionDismissed && (
                <div className="ai-suggest">
                  <span className="ai-suggest__icon" aria-hidden>🤖</span>
                  <span className="ai-suggest__text">
                    AI: Use 2700K + hard shadows for sc_003 NIGHT (TV-lit scene)
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ padding: "4px 12px" }}
                    onClick={() => dispatch({ type: "APPLY_MOOD_SUGGESTION" })}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="ai-suggest__dismiss"
                    aria-label="Dismiss suggestion"
                    title="Dismiss"
                    onClick={() => dispatch({ type: "DISMISS_MOOD_SUGGESTION" })}
                  >
                    ×
                  </button>
                </div>
              )}

              <button type="button" className="btn btn--primary btn--block">
                Generate Variation for {activeSource.id} / NIGHT
              </button>
              <button type="button" className="add-link">+ Add another variation for {activeSource.id}</button>
            </div>
          </article>
        </div>

        {/* ───── Generated Variations ───── */}
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Generated Variations</span>
            <span className="count-pill">{visibleVariations.length}</span>
          </div>
          <article className="card">
            <div className="card__body tile-grid tile-grid--two">
              {visibleVariations.map((v) => (
                <div
                  key={v.id}
                  className={`setup-tile${v.status === "generating" ? " setup-tile--generating" : ""}`}
                >
                  <div className="setup-tile__header">
                    <span className="setup-tile__id">{v.id}</span>
                    <span className={`status-badge status-badge--${v.status === "generating" ? "draft" : v.status}`}>
                      {v.status}
                    </span>
                  </div>
                  <div className="setup-tile__image">
                    {v.status === "generating" ? "⏳ Generating..." : null}
                  </div>
                  <div className="setup-tile__footer">
                    <span className="mini-chip mini-chip--mood">{v.temp}</span>
                    <span className="setup-tile__spacer" />
                    {v.status === "generating" ? (
                      <button
                        type="button"
                        className="btn btn--danger-ghost"
                        onClick={() => dispatch({ type: "CANCEL_VARIATION", id: v.id })}
                      >
                        Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="icon-btn icon-btn--approve"
                          aria-label="Approve"
                          onClick={() =>
                            dispatch({ type: "SET_VARIATION_STATUS", id: v.id, status: "approved" })
                          }
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--reject"
                          aria-label="Reject"
                          onClick={() =>
                            dispatch({ type: "SET_VARIATION_STATUS", id: v.id, status: "rejected" })
                          }
                        >
                          ✗
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Regenerate"
                          style={{ color: "var(--text-muted)" }}
                          onClick={() =>
                            dispatch({ type: "SET_VARIATION_STATUS", id: v.id, status: "draft" })
                          }
                        >
                          ↻
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>

      <div className="page-footer">
        <button
          type="button"
          className="btn btn--success"
          onClick={() => dispatch({ type: "APPROVE_ALL_VARIATIONS" })}
          disabled={draftCount === 0}
        >
          Approve All ({approvedCount}/{visibleVariations.length})
        </button>
        <span className="page-footer__spacer" />
        <button type="button" className="btn btn--primary" onClick={handleAdvance}>
          View Outputs
          <span className="btn__arrow" aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
