/**
 * Stage 2 — Research Cycle.
 * Mirrors Figma frame "Research Cycle" (node 408:12).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { callTool } from "../api/mcp";
import { usePipeline } from "../state/PipelineContext";

const LOCATION_ID = "loc_001";
const RESEARCH_PACK_URI = `agent://location-scout/research/research_${LOCATION_ID}`;

export function ResearchPage() {
  const { state, dispatch } = usePipeline();
  const navigate = useNavigate();
  const { facts, typicalElements, anachronisms, iteration, maxIterations } = state.research;

  const [newFact, setNewFact] = useState("");
  const [newAnachronism, setNewAnachronism] = useState("");

  const handleAddFact = async () => {
    if (!newFact.trim()) return;
    const fact = newFact.trim();
    dispatch({ type: "ADD_FACT", title: fact, subtitle: "Added manually" });
    setNewFact("");
    try {
      const r = await callTool("add_fact", {
        research_pack_uri: RESEARCH_PACK_URI,
        fact,
      });
      console.log("[add_fact] →", r.data);
    } catch (err) {
      console.error("[add_fact] failed:", err);
    }
  };

  const handleAddAnachronism = async () => {
    if (!newAnachronism.trim()) return;
    const item = newAnachronism.trim();
    dispatch({ type: "ADD_ANACHRONISM", text: item });
    setNewAnachronism("");
    try {
      const r = await callTool("add_anachronism", {
        target_uri: RESEARCH_PACK_URI,
        item,
      });
      console.log("[add_anachronism] →", r.data);
    } catch (err) {
      console.error("[add_anachronism] failed:", err);
    }
  };

  const handleDeeperResearch = async () => {
    try {
      const r = await callTool("research_era", {
        location_brief: {
          location_id: LOCATION_ID,
          location_name: state.brief.locationName,
          location_type: (state.brief.selectedType || "INT") as "INT" | "EXT" | "INT/EXT",
          time_of_day: [state.brief.selectedTimeOfDay || "DAY"],
          era: state.vision.eraStyle,
          scenes: state.brief.scenes,
          recurring: state.brief.scenes.length > 1,
        },
        director_vision: { era_style: state.vision.eraStyle },
      });
      console.log("[research_era] →", r.data);
    } catch (err) {
      console.error("[research_era] failed:", err);
    }
  };

  const handleApprove = async () => {
    dispatch({ type: "APPROVE_STAGE", stage: "research" });
    try {
      const r = await callTool("approve_artifact", {
        artifact_uri: RESEARCH_PACK_URI,
        notes: "Approved from Research Cycle UI",
      });
      console.log("[approve_artifact research] →", r.data);
    } catch (err) {
      console.error("[approve_artifact research] failed:", err);
    }
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
        <button type="button" className="btn btn--ghost" onClick={handleDeeperResearch}>Deeper Research</button>
        <span className="page-footer__spacer" />
        <button type="button" className="btn btn--primary" onClick={handleApprove}>
          Approve Research
          <span className="btn__arrow" aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
