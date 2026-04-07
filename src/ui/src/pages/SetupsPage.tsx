/**
 * Stage 5 — Setups Generation.
 * Mirrors Figma frame "Setups Generation" (node 436:33).
 */

import { useNavigate } from "react-router-dom";
import { usePipeline } from "../state/PipelineContext";

export function SetupsPage() {
  const { state, dispatch } = usePipeline();
  const navigate = useNavigate();
  const { tiles, selectedId } = state.setups;
  const selected = tiles.find((t) => t.id === selectedId) ?? tiles[0];
  const approvedCount = tiles.filter((t) => t.status === "approved").length;
  const draftCount = tiles.filter((t) => t.status === "draft").length;

  const handleAdvance = () => {
    dispatch({ type: "APPROVE_STAGE", stage: "setups" });
    navigate("/light-states");
  };

  return (
    <div className="input-page" data-figma-node="436:33">
      <div className="columns-2">
        {/* ───── Generated Setups grid ───── */}
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Generated Setups</span>
            <span className="count-pill count-pill--success">{tiles.length}</span>
          </div>
          <article className="card">
            <div className="card__body tile-grid">
              {tiles.map((t) => (
                <div
                  key={t.id}
                  className={`setup-tile${t.id === selectedId ? " setup-tile--selected" : ""}`}
                  onClick={() => dispatch({ type: "SELECT_SETUP", id: t.id })}
                  style={{ cursor: "pointer" }}
                >
                  <div className="setup-tile__header">
                    <span className="setup-tile__id">{t.id}</span>
                    <span className={`status-badge status-badge--${t.status}`}>{t.status}</span>
                  </div>
                  <div className="setup-tile__image" />
                  <div className="setup-tile__footer">
                    <span className="mini-chip mini-chip--scene">{t.scene}</span>
                    <span className="mini-chip mini-chip--mood">{t.mood}</span>
                    <span className="setup-tile__spacer" />
                    <button
                      type="button"
                      className="icon-btn icon-btn--approve"
                      aria-label="Approve"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: "SET_SETUP_STATUS", id: t.id, status: "approved" });
                      }}
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--reject"
                      aria-label="Reject"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: "SET_SETUP_STATUS", id: t.id, status: "rejected" });
                      }}
                    >
                      ✗
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        {/* ───── Setup Detail ───── */}
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title" style={{ color: "var(--accent)" }}>
              Setup Detail: {selected.id}
            </span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--s-3)" }}>
              <div className="placeholder-box" style={{ minHeight: 140 }}>
                Full Resolution Preview
              </div>
              <div className="detail-field">
                <span className="detail-field__label">Scene / Mood</span>
                <span className="detail-field__value">
                  {selected.scene} / {selected.mood}
                </span>
              </div>
              <div className="detail-field">
                <span className="detail-field__label">Status</span>
                <span className="detail-field__value">{selected.status}</span>
              </div>
              <div className="detail-field">
                <span className="detail-field__label">Anchor Ref</span>
                <span className="detail-field__value">anchor_loc_001 (matched)</span>
              </div>
              <button type="button" className="add-link">▸ PROMPT (click to expand)</button>
              <button type="button" className="btn btn--ghost btn--block">
                ⇄ Compare with Anchor
              </button>
              <button type="button" className="btn btn--ghost btn--block">
                ↻ Regenerate This Setup
              </button>
            </div>
          </article>
        </div>
      </div>

      <div className="page-footer">
        <button
          type="button"
          className="btn btn--success"
          onClick={() => dispatch({ type: "APPROVE_ALL_SETUPS" })}
          disabled={draftCount === 0}
        >
          Approve All ({draftCount})
        </button>
        <span className="page-footer__spacer" />
        <span className="mini-label" style={{ marginRight: "var(--s-2)" }}>
          {approvedCount} / {tiles.length} approved
        </span>
        <button type="button" className="btn btn--primary" onClick={handleAdvance}>
          View Outputs
          <span className="btn__arrow" aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
