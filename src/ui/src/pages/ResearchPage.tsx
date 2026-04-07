/**
 * Stage 2 — Research Cycle.
 * Mirrors Figma frame "Research Cycle" (node 408:12).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePipeline } from "../state/PipelineContext";

export function ResearchPage() {
  const { state, dispatch } = usePipeline();
  const navigate = useNavigate();
  const { facts, typicalElements, anachronisms, iteration, maxIterations } = state.research;

  const [newFact, setNewFact] = useState("");
  const [newAnachronism, setNewAnachronism] = useState("");

  const handleAddFact = () => {
    if (!newFact.trim()) return;
    dispatch({ type: "ADD_FACT", title: newFact.trim(), subtitle: "Added manually" });
    setNewFact("");
  };

  const handleAddAnachronism = () => {
    if (!newAnachronism.trim()) return;
    dispatch({ type: "ADD_ANACHRONISM", text: newAnachronism.trim() });
    setNewAnachronism("");
  };

  const handleApprove = () => {
    dispatch({ type: "APPROVE_STAGE", stage: "research" });
    navigate("/analysis");
  };

  return (
    <div className="input-page" data-figma-node="408:12">
      <div className="banner banner--gate">
        <span className="banner__icon" aria-hidden>⚠</span>
        <span className="banner__title">GATE 1: Research Sufficient?</span>
        <span className="banner__meta">
          Iteration {iteration} / {maxIterations}
        </span>
        <span className="banner__spacer" />
        <span className="badge badge--draft">Draft</span>
      </div>

      <div className="columns-3">
        {/* ───── Period Facts ───── */}
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Period Facts</span>
            <span className="section-header__subtitle">Research Data</span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--s-2)" }}>
              {facts.map((f) => (
                <div key={f.id} className="fact-card">
                  <span className="fact-card__title">{f.title}</span>
                  <span className="fact-card__subtitle">{f.subtitle}</span>
                </div>
              ))}
              <input
                type="text"
                className="form-input"
                placeholder="Add a new fact..."
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddFact()}
              />
              <button type="button" className="add-link" onClick={handleAddFact}>
                + Add fact
              </button>
            </div>
          </article>
        </div>

        {/* ───── Typical Elements ───── */}
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Typical Elements</span>
            <span className="count-pill">{typicalElements.length}</span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--s-3)" }}>
              <div className="chip-group">
                {typicalElements.map((e) => (
                  <span key={e} className="chip chip--filled">
                    {e}
                  </span>
                ))}
              </div>
              <span className="field__label" style={{ color: "var(--text)" }}>
                Visual References
              </span>
              <div className="ref-row">
                <div className="ref-thumb">Ref 1</div>
                <div className="ref-thumb">Ref 2</div>
                <div className="ref-thumb">Ref 3</div>
              </div>
            </div>
          </article>
        </div>

        {/* ───── Anachronisms ───── */}
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Anachronisms</span>
            <span className="section-header__subtitle">Negative List</span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--s-2)" }}>
              <span className="mini-label">
                min 5 required ({anachronisms.length} present)
              </span>
              {anachronisms.map((a) => (
                <span key={a} className="neg-item">
                  {a}
                </span>
              ))}
              <input
                type="text"
                className="form-input"
                placeholder="Add an anachronism..."
                value={newAnachronism}
                onChange={(e) => setNewAnachronism(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddAnachronism()}
              />
              <button type="button" className="add-link" onClick={handleAddAnachronism}>
                + Add anachronism
              </button>
            </div>
          </article>
        </div>
      </div>

      <div className="page-footer">
        <button type="button" className="btn btn--ghost">Deeper Research</button>
        <span className="page-footer__spacer" />
        <button type="button" className="btn btn--primary" onClick={handleApprove}>
          Approve Research
          <span className="btn__arrow" aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
