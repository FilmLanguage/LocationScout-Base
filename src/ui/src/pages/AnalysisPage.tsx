/**
 * Stage 3 — Analysis.
 * Mirrors Figma frame "Analysis" (node 429:19).
 */

import { useNavigate } from "react-router-dom";
import { usePipeline } from "../state/PipelineContext";

export function AnalysisPage() {
  const { state, dispatch } = usePipeline();
  const navigate = useNavigate();
  const a = state.analysis;

  const handleApprove = () => {
    dispatch({ type: "APPROVE_STAGE", stage: "analysis" });
    navigate("/references");
  };

  const overBudget = a.wordCount > a.wordBudget;

  return (
    <div className="input-page" data-figma-node="429:19">
      <div className="banner banner--gate">
        <span className="banner__icon" aria-hidden>⚠</span>
        <span className="banner__title">
          GATE 2: ERA-Accurate? — Cross-referencing key_details against anachronism_list
        </span>
        <span className="banner__spacer" />
        <span className="badge badge--draft">🔒 Bible First: Approve to unlock Windows 4–7</span>
      </div>

      <div className="columns-2">
        {/* ───── Location Bible ───── */}
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Location Bible</span>
            <span className="section-header__subtitle">Space &amp; Atmosphere</span>
          </div>
          <article className="card">
            <div className="card__body">
              {/* Passport row */}
              <div className="passport-row">
                <span className="chip chip--sm chip--outlined chip--active">INT</span>
                <span className="chip chip--sm chip--outlined">EXT</span>
                <span className="chip chip--sm chip--outlined">INT-EXT</span>
                <span className="passport-row__label">Era:</span>
                <span className="passport-row__value">2004 Albuquerque</span>
                <span className="passport-row__label">Scenes:</span>
                <span className="chip chip--sm chip--filled">sc_003</span>
                <span className="chip chip--sm chip--filled">sc_007</span>
                <span className="chip chip--sm chip--filled">sc_015</span>
              </div>

              {/* Space Description */}
              <div className="field">
                <span className="field__label" style={{ display: "flex", gap: "var(--s-2)", alignItems: "center" }}>
                  Space Description
                  <span className={`word-count ${overBudget ? "word-count--over" : "word-count--ok"}`}>
                    {a.wordCount} / {a.wordBudget} words
                  </span>
                </span>
                <div className="text-block">{a.spaceDescription}</div>
              </div>

              {/* Atmosphere */}
              <div className="field">
                <span className="field__label">Atmosphere</span>
                <div className="text-block">{a.atmosphere}</div>
              </div>
            </div>
          </article>
        </div>

        {/* ───── Light Base State ───── */}
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Light Base State</span>
            <span className="section-header__subtitle">Key Details</span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--s-3)" }}>
              <div className="metric-row">
                <span className="metric-row__label">Primary Source</span>
                <span className="metric-row__value">Window (west-facing)</span>
              </div>

              <div className="metric-row">
                <span className="metric-row__label">Color Temperature</span>
                <span className="metric-row__value metric-row__value--accent">{a.colorTemp}</span>
              </div>

              <div className="metric-row">
                <span className="metric-row__label">Shadow Hardness</span>
                {(["hard", "soft", "mixed"] as const).map((s) => (
                  <span
                    key={s}
                    className={`chip chip--sm chip--outlined${a.shadowHardness === s ? " chip--active" : ""}`}
                  >
                    {s}
                  </span>
                ))}
              </div>

              <div className="metric-row">
                <span className="metric-row__label">Fill:Key Ratio</span>
                <span className="metric-row__value">1:4</span>
                <span className="metric-row__label">Practicals</span>
                <span className="chip chip--sm chip--filled">TV glow</span>
              </div>

              <div className="metric-row">
                <span className="metric-row__label">Key Details</span>
                <span className="count-pill count-pill--success">6/8</span>
              </div>

              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
                {a.keyDetails.map((d) => (
                  <li key={d} className="bullet-row">
                    <span className="bullet-row__marker" aria-hidden>•</span>
                    <span className="bullet-row__text">{d}</span>
                  </li>
                ))}
              </ul>

              <span className="danger-label">⛔ Negative List (Ban)</span>
              <div className="chip-group">
                {a.negatives.map((n) => (
                  <span key={n} className="chip chip--sm chip--negative">
                    {n}
                  </span>
                ))}
              </div>

              <div className="metric-row">
                <span className="metric-row__label">Status</span>
                <span className="badge badge--draft">Draft</span>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div className="page-footer">
        <button type="button" className="btn btn--ghost">Generate Bible</button>
        <button type="button" className="btn btn--ghost">Validate</button>
        <span className="page-footer__spacer" />
        <button type="button" className="btn btn--primary" onClick={handleApprove}>
          Approve Bible
          <span className="btn__arrow" aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
