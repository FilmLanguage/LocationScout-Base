/**
 * Stage 4 — Reference Generation.
 * Mirrors Figma frame "Reference Generation" (node 433:26).
 *
 * On mount, checks whether an anchor image already exists at
 * /artifacts/anchor/<location_id>.png. If not, fires generate_anchor and
 * polls until the backend signals completion, then re-loads the image.
 *
 * Floorplan auto-generates via create_floorplan (Python/Pillow).
 * Isometric auto-generates via generate_isometric_reference (FAL img2img)
 * after floorplan is ready.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { callTool, pollTask, type TaskStatus } from "../api/mcp";
import { usePipeline } from "../state/PipelineContext";

const LOCATION_ID = "loc_001";
const BIBLE_URI = `agent://location-scout/bible/${LOCATION_ID}`;
const ANCHOR_URI = `agent://location-scout/anchor/${LOCATION_ID}`;
const ANCHOR_IMG_PATH = `/artifacts/anchor/${LOCATION_ID}.png`;
const FLOORPLAN_IMG_PATH = `/artifacts/floorplan/${LOCATION_ID}.png`;
const ISOMETRIC_IMG_PATH = `/artifacts/isometric/${LOCATION_ID}.png`;

const setupsSummary = [
  { id: "S1", camera: "x:2.1 y:3.0 angle:45° | 35mm", characters: "Characters: Walter, Skyler", composition: "Composition: Medium wide, couch centered" },
  { id: "S2", camera: "x:4.0 y:1.5 angle:180° | 50mm", characters: "Characters: Walter", composition: "Composition: Close-up, TV reflection in eyes" },
  { id: "S3", camera: "x:1.0 y:2.0 angle:90° | 24mm", characters: "Characters: Skyler (entering)", composition: "Composition: Wide, kitchen archway frame" },
];

type AnchorState =
  | { kind: "checking" }
  | { kind: "missing" }
  | { kind: "generating"; status: TaskStatus | null }
  | { kind: "ready"; cacheBust: number }
  | { kind: "error"; message: string };

export function ReferencesPage() {
  const { state, dispatch } = usePipeline();
  const navigate = useNavigate();
  const r = state.references;

  const [anchor, setAnchor] = useState<AnchorState>({ kind: "checking" });
  const [floorplan, setFloorplan] = useState<AnchorState>({ kind: "checking" });
  const [isometric, setIsometric] = useState<AnchorState>({ kind: "checking" });

  const checkExists = async (path: string): Promise<boolean> => {
    try {
      const res = await fetch(path, { method: "HEAD", cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  };

  /** HEAD the artifact endpoint to see if an anchor already exists. */
  const checkAnchorExists = () => checkExists(ANCHOR_IMG_PATH);

  /** Fire generate_anchor and poll until terminal. Requires isometric to exist first. */
  const runGeneration = async () => {
    // Hard gate: isometric must exist before anchor can be generated
    const isoExists = await checkExists(ISOMETRIC_IMG_PATH);
    if (!isoExists) {
      setAnchor({ kind: "error", message: "Isometric reference required. Generate floorplan + isometric first." });
      return;
    }
    setAnchor({ kind: "generating", status: null });
    try {
      const result = await callTool<{ task_id: string }>("generate_anchor", {
        bible_uri: BIBLE_URI,
        generation_params: { aspect_ratio: "16:9", quality: "high" },
      });
      const taskId = result.data?.task_id;
      if (!taskId) {
        setAnchor({ kind: "error", message: "generate_anchor returned no task_id" });
        return;
      }
      const final = await pollTask(
        taskId,
        (s) => setAnchor({ kind: "generating", status: s }),
        1000,
        180000,
      );
      if (final.status === "failed") {
        setAnchor({ kind: "error", message: final.error || "Image generation failed" });
        return;
      }
      // Confirm the image is now reachable, then flip to ready.
      const exists = await checkAnchorExists();
      if (!exists) {
        setAnchor({
          kind: "error",
          message: "Backend reported success but no image at /artifacts/anchor — check storage",
        });
        return;
      }
      setAnchor({ kind: "ready", cacheBust: Date.now() });
    } catch (err) {
      setAnchor({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  // Anchor depends on isometric — only auto-generate after isometric is ready.
  useEffect(() => {
    if (isometric.kind !== "ready") {
      if (isometric.kind === "error" || isometric.kind === "missing") {
        setAnchor({ kind: "error", message: "Isometric reference required. Generate floorplan + isometric first." });
      }
      return;
    }
    let cancelled = false;
    (async () => {
      const exists = await checkAnchorExists();
      if (cancelled) return;
      if (exists) {
        setAnchor({ kind: "ready", cacheBust: Date.now() });
      } else {
        setAnchor({ kind: "missing" });
        runGeneration();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isometric.kind]);

  const handleRegenerateAnchor = async () => {
    runGeneration();
  };

  // ─── Floorplan: auto-generate on mount ──────────────────────────
  const runFloorplan = async () => {
    setFloorplan({ kind: "generating", status: null });
    try {
      const result = await callTool<{ task_id: string }>("create_floorplan", { bible_uri: BIBLE_URI });
      const taskId = result.data?.task_id;
      if (!taskId) { setFloorplan({ kind: "error", message: "create_floorplan returned no task_id" }); return; }
      const final = await pollTask(taskId, (s) => setFloorplan({ kind: "generating", status: s }), 1000, 60000);
      if (final.status === "failed") { setFloorplan({ kind: "error", message: final.error || "Floorplan generation failed" }); return; }
      const exists = await checkExists(FLOORPLAN_IMG_PATH);
      setFloorplan(exists ? { kind: "ready", cacheBust: Date.now() } : { kind: "error", message: "Floorplan generated but not reachable" });
    } catch (err) { setFloorplan({ kind: "error", message: err instanceof Error ? err.message : String(err) }); }
  };

  useEffect(() => {
    let c = false;
    (async () => {
      const exists = await checkExists(FLOORPLAN_IMG_PATH);
      if (c) return;
      if (exists) { setFloorplan({ kind: "ready", cacheBust: Date.now() }); } else { setFloorplan({ kind: "missing" }); runFloorplan(); }
    })();
    return () => { c = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Isometric: auto-generate after floorplan is ready ──────────
  const runIsometric = async () => {
    setIsometric({ kind: "generating", status: null });
    try {
      const result = await callTool<{ task_id: string }>("generate_isometric_reference", {
        floorplan_uri: `agent://location-scout/floorplan/${LOCATION_ID}`,
        bible_uri: BIBLE_URI,
      });
      const taskId = result.data?.task_id;
      if (!taskId) { setIsometric({ kind: "error", message: "generate_isometric returned no task_id" }); return; }
      const final = await pollTask(taskId, (s) => setIsometric({ kind: "generating", status: s }), 1500, 120000);
      if (final.status === "failed") { setIsometric({ kind: "error", message: final.error || "Isometric generation failed" }); return; }
      const exists = await checkExists(ISOMETRIC_IMG_PATH);
      setIsometric(exists ? { kind: "ready", cacheBust: Date.now() } : { kind: "error", message: "Isometric generated but not reachable" });
    } catch (err) { setIsometric({ kind: "error", message: err instanceof Error ? err.message : String(err) }); }
  };

  useEffect(() => {
    if (floorplan.kind !== "ready") return;
    let c = false;
    (async () => {
      const exists = await checkExists(ISOMETRIC_IMG_PATH);
      if (c) return;
      if (exists) { setIsometric({ kind: "ready", cacheBust: Date.now() }); } else { setIsometric({ kind: "missing" }); runIsometric(); }
    })();
    return () => { c = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorplan.kind]);

  const handleApprove = async () => {
    dispatch({ type: "APPROVE_STAGE", stage: "references" });
    try {
      const r = await callTool("approve_artifact", {
        artifact_uri: ANCHOR_URI,
        notes: "Anchor approved from References UI",
      });
      console.log("[approve_artifact anchor] →", r.data);
    } catch (err) {
      console.error("[approve_artifact anchor] failed:", err);
    }
    navigate("/setups");
  };

  const isGenerating = anchor.kind === "generating" || anchor.kind === "checking";
  const canApprove = anchor.kind === "ready";

  /** Anchor image slot — renders different states cleanly. */
  const renderAnchorSlot = () => {
    if (anchor.kind === "ready") {
      return (
        <img
          src={`${ANCHOR_IMG_PATH}?v=${anchor.cacheBust}`}
          alt="Anchor reference"
          style={{
            width: "100%",
            borderRadius: 8,
            display: "block",
            background: "#000",
          }}
        />
      );
    }

    if (anchor.kind === "error") {
      return (
        <div
          className="placeholder-box placeholder-box--tall"
          style={{
            background: "rgba(220,60,60,0.08)",
            borderColor: "rgba(220,60,60,0.4)",
            color: "#ff9a9a",
            textAlign: "center",
            padding: 16,
          }}
        >
          ✗ {anchor.message}
        </div>
      );
    }

    // checking | missing | generating
    const step =
      anchor.kind === "generating" && anchor.status?.current_step
        ? anchor.status.current_step
        : anchor.kind === "checking"
        ? "Checking for existing anchor…"
        : "Starting image generation…";
    const progress =
      anchor.kind === "generating" && anchor.status?.progress !== undefined
        ? Math.round((anchor.status.progress ?? 0) * 100)
        : null;

    return (
      <div
        className="placeholder-box placeholder-box--tall"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 24,
        }}
      >
        <div style={{ fontSize: 28 }} aria-hidden>
          ⏳
        </div>
        <div style={{ fontSize: 13 }}>{step}</div>
        {progress !== null && (
          <div
            style={{
              width: "70%",
              height: 4,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "var(--accent)",
                transition: "width 200ms ease",
              }}
            />
          </div>
        )}
        {progress !== null && <div style={{ fontSize: 11, opacity: 0.7 }}>{progress}%</div>}
      </div>
    );
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
              {floorplan.kind === "ready" ? (
                <img
                  src={`${FLOORPLAN_IMG_PATH}?v=${floorplan.cacheBust}`}
                  alt="Floorplan"
                  style={{ width: "100%", borderRadius: 6 }}
                />
              ) : floorplan.kind === "error" ? (
                <div className="placeholder-box placeholder-box--tall" style={{ borderColor: "rgba(220,60,60,0.5)" }}>
                  <span style={{ color: "var(--red)" }}>{"✗ "}{floorplan.message}</span>
                </div>
              ) : (
                <div className="placeholder-box placeholder-box--tall">
                  {floorplan.kind === "generating" ? `Generating floorplan… ${floorplan.status?.current_step ?? ""}` : "Checking…"}
                </div>
              )}
              <div className="metric-row">
                <span className="metric-row__label">{r.floorplanSize}</span>
                <span className="page-footer__spacer" />
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={floorplan.kind === "generating"}
                  onClick={() => runFloorplan()}
                >
                  {floorplan.kind === "generating" ? "Generating…" : "Regenerate"}
                </button>
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
              {isometric.kind === "ready" ? (
                <img
                  src={`${ISOMETRIC_IMG_PATH}?v=${isometric.cacheBust}`}
                  alt="Isometric reference"
                  style={{ width: "100%", borderRadius: 6 }}
                />
              ) : isometric.kind === "error" ? (
                <div className="placeholder-box placeholder-box--tall" style={{ borderColor: "rgba(220,60,60,0.5)" }}>
                  <span style={{ color: "var(--red)" }}>{"✗ "}{isometric.message}</span>
                </div>
              ) : (
                <div className="placeholder-box placeholder-box--tall">
                  {isometric.kind === "generating" ? `Generating isometric… ${isometric.status?.current_step ?? ""}` : floorplan.kind === "ready" ? "Checking…" : "Waiting for floorplan…"}
                </div>
              )}
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ alignSelf: "flex-end", marginTop: "var(--s-2)" }}
                disabled={isometric.kind === "generating" || floorplan.kind !== "ready"}
                onClick={() => runIsometric()}
              >
                {isometric.kind === "generating" ? "Generating…" : "Regenerate"}
              </button>
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
              {renderAnchorSlot()}
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
        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleRegenerateAnchor}
          disabled={isGenerating}
        >
          {isGenerating ? "Generating…" : "Regenerate Anchor"}
        </button>
        <span className="page-footer__spacer" />
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleApprove}
          disabled={!canApprove}
          title={!canApprove ? "Wait for the anchor image to finish generating" : undefined}
        >
          Approve Anchor
          <span className="btn__arrow" aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
