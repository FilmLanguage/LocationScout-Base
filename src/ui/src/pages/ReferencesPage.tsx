/**
 * Stage 4 — Reference Generation.
 * Mirrors Figma frame "Reference Generation" (node 433:26).
 */

import { useNavigate } from "react-router-dom";
import { usePipeline } from "../state/PipelineContext";

const setupsSummary = [
  { id: "S1", camera: "x:2.1 y:3.0 angle:45° | 35mm", characters: "Characters: Walter, Skyler", composition: "Composition: Medium wide, couch centered" },
  { id: "S2", camera: "x:4.0 y:1.5 angle:180° | 50mm", characters: "Characters: Walter", composition: "Composition: Close-up, TV reflection in eyes" },
  { id: "S3", camera: "x:1.0 y:2.0 angle:90° | 24mm", characters: "Characters: Skyler (entering)", composition: "Composition: Wide, kitchen archway frame" },
];

export function ReferencesPage() {
  const { state, dispatch } = usePipeline();
  const navigate = useNavigate();
  const r = state.references;

  const handleApprove = () => {
    dispatch({ type: "APPROVE_STAGE", stage: "references" });
    navigate("/setups");
  };

  return (
    <div className="input-page" data-figma-node="433:26">
      <div className="banner banner--gate">
        <span className="banner__icon" aria-hidden>⚠</span>
        <span className="banner__title">
          GATE 3: Anchor Approved? | VLM Audit (gemini-2.5-pro vision) | LPIPS &lt; 0.4 | SSIM &gt; 0.6
        </span>
        <span className="banner__spacer" />
        <span className="badge badge--draft">Attempt 1 / 3 (max retry)</span>
      </div>

      {/* ───── Top row: Floorplan + Isometric ───── */}
      <div className="columns-2">
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Floorplan + Light Map</span>
            <span className="tech-badge tech-badge--muted">PYTHON + FFmpeg</span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--s-2)" }}>
              <div className="placeholder-box placeholder-box--tall">
                Floorplan Visualization
              </div>
              <div className="metric-row">
                <span className="metric-row__label">{r.floorplanSize}</span>
                <span className="page-footer__spacer" />
                <span className="chip chip--sm chip--outlined">− 100% +</span>
              </div>
            </div>
          </article>
        </div>

        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Isometric Reference</span>
            <span className="tech-badge tech-badge--gold">NANOBANANA</span>
          </div>
          <article className="card">
            <div className="card__body">
              <div className="placeholder-box placeholder-box--tall">
                3D Isometric View
                <br />
                (zoom + pan)
              </div>
            </div>
          </article>
        </div>
      </div>

      {/* ───── Bottom row: Setup Extraction + Anchor Image ───── */}
      <div className="columns-2">
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Setup Extraction</span>
            <span className="tech-badge tech-badge--green">CLAUDE</span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--s-2)" }}>
              {setupsSummary.map((s) => (
                <div key={s.id} className="setup-row">
                  <span className="setup-row__badge">{s.id}</span>
                  <div className="setup-row__info">
                    <span className="setup-row__line">{s.camera}</span>
                    <span className="setup-row__sub">{s.characters}</span>
                    <span className="setup-row__sub">{s.composition}</span>
                  </div>
                </div>
              ))}
              <button type="button" className="add-link" style={{ color: "var(--accent)" }}>
                ✏ Manual Input?
              </button>
            </div>
          </article>
        </div>

        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Anchor Image</span>
            <span className="tech-badge tech-badge--gold">NANOBANANA</span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--s-3)" }}>
              <div className="placeholder-box placeholder-box--tall">
                Establishing Wide Shot
                <br />
                (Canonical Reference)
              </div>
              <span className="section-label">VLM Audit</span>
              <div className="score-group">
                <div className="score">
                  <span className="score__label">LPIPS</span>
                  <span className={`score__value ${r.vlmAudit.lpips < 0.4 ? "score__value--good" : "score__value--bad"}`}>
                    {r.vlmAudit.lpips.toFixed(2)}
                  </span>
                </div>
                <div className="score">
                  <span className="score__label">SSIM</span>
                  <span className={`score__value ${r.vlmAudit.ssim > 0.6 ? "score__value--good" : "score__value--bad"}`}>
                    {r.vlmAudit.ssim.toFixed(2)}
                  </span>
                </div>
                <div className="score">
                  <span className="score__label">Bible match</span>
                  <span className="score__value">{r.vlmAudit.bibleMatch}%</span>
                </div>
                <div className="score">
                  <span className="score__label">Anachronisms</span>
                  <span className={`score__value ${r.vlmAudit.anachronismsFound === 0 ? "score__value--good" : "score__value--bad"}`}>
                    {r.vlmAudit.anachronismsFound} found
                  </span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div className="page-footer">
        <button type="button" className="btn btn--ghost">Regenerate Anchor</button>
        <span className="page-footer__spacer" />
        <button type="button" className="btn btn--primary" onClick={handleApprove}>
          Approve Anchor
          <span className="btn__arrow" aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
