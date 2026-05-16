/**
 * Stage 5 — Setups Generation.
 * Mirrors Figma frame "Setups Generation" (node 436:33).
 *
 * On mount, checks whether each setup tile already has an image at
 * /artifacts/setup/<id>.png. If any are missing, fires the backend
 * generate_setup_images tool (runs all missing setups in parallel via
 * FAL.ai) and polls until complete. Each tile shows its own image,
 * the detail panel shows a full-resolution preview of the selected
 * setup, and the "PROMPT (click to expand)" link loads the exact
 * prompt used for the selected setup from get_setup_prompt.
 */

import { useEffect, useMemo, useRef, useState } from "react";
// BETA: useNavigate no longer used (handleSend doesn't navigate). See ROLLOUT.md.
// import { useNavigate } from "react-router-dom";
import { callTool, pollTask, type TaskStatus } from "../api/mcp";
import { usePipeline } from "../state/PipelineContext";
import type { SetupTile } from "../state/pipeline";
import { ReferencePicker, type ReferenceRef } from "../components/ReferencePicker";
import { ImageOverlay } from "../components/ImageOverlay";
import { useGallery } from "../hooks/useGallery";
import { useAssemblePrompt } from "../hooks/useAssemblePrompt";
import { useProjectContext } from "../hooks/useProjectContext";
const setupUri = (id: string) => `agent://location-scout/setup/${id}`;
const setupImgPath = (id: string) => `/artifacts/setup/${id}.png`;

// Camera descriptions previously hardcoded per Figma mock IDs (S1-A through S3-C)
// containing Walter's-living-room specifics like "TV reflection in eyes" and
// "kitchen archway frame". Removed 2026-05-15 — real setups come from the backend
// state.setups.tiles[].camera, populated upstream by Cinematographer/Editor.
// When tile.camera is missing the UI shows an empty/dash, not a fixture.

type BatchState =
  | { kind: "checking" }
  | { kind: "generating"; status: TaskStatus | null; task_id?: string }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export function SetupsPage() {
  const { state, dispatch } = usePipeline();
  const { tiles, selectedId } = state.setups;
  const { locationId: LOCATION_ID } = useProjectContext();
  const BIBLE_URI = `agent://location-scout/bible/${LOCATION_ID}`;
  const ANCHOR_URI = `agent://location-scout/anchor/${LOCATION_ID}`;
  const selected = tiles.find((t) => t.id === selectedId) ?? tiles[0];
  // Empty-tiles guard: without this, every JSX access to `selected.id` below
  // throws `TypeError: Cannot read properties of undefined (reading 'id')` and
  // the route renders a blank iframe. Reproduced live 2026-05-16.
  if (!selected) {
    return (
      <div
        className="input-page"
        data-figma-node="436:33"
        style={{ padding: 32, textAlign: "center" }}
      >
        <h3 style={{ fontSize: 14, marginBottom: 8, color: "var(--text)" }}>
          No setups extracted yet
        </h3>
        <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
          Go to <a href="/" style={{ color: "var(--accent)" }}>References</a> and
          click <strong>Extract Setups</strong> after the floorplan + anchor are
          ready. Setups depend on a Location Bible plus a generated floorplan.
        </p>
      </div>
    );
  }
  const approvedCount = tiles.filter((t) => t.status === "approved").length;
  // "Reviewable" = not yet approved (covers both legacy "draft" and the
  // new "none" initial state). Drives the Approve-All count + send gate.
  const draftCount = tiles.filter(
    (t) => t.status === "draft" || t.status === "none",
  ).length;
  const rejectedCount = tiles.filter((t) => t.status === "rejected").length;

  const [batch, setBatch] = useState<BatchState>({ kind: "checking" });
  /** Per-tile cache-bust number that refreshes the <img src> after regeneration. */
  const [tileCacheBust, setTileCacheBust] = useState<Record<string, number>>({});
  /** Set of tile IDs currently generating (for the single-tile regenerate flow). */
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());

  // Per-setup gallery + prompt state for the selected setup.
  const selectedSetupId = selected?.id ?? "";
  const setupGallery = useGallery("setup", selectedSetupId.replace(/\//g, "_"));
  const [setupPrompt, setSetupPrompt] = useState("");
  const [setupSelectedVersionId, setSetupSelectedVersionId] = useState<string | null>(null);

  // Per-setup record of what ✦ Auto-fill last populated the textarea with,
  // so we only show a confirm dialog when the user has actually edited the
  // text since the last auto-fill for that specific setup.
  const [setupAutoFillBase, setSetupAutoFillBase] = useState<Record<string, string>>({});
  // Per-setup extra reference images (beyond the default anchor chain ref).
  const [setupRefs, setSetupRefs] = useState<Record<string, ReferenceRef[]>>({});
  const assemble = useAssemblePrompt();

  // ─── Edit mode (see updates/edit-mode-contract.md) ───
  const [setupEditMode, setSetupEditMode] = useState<Record<string, boolean>>({});
  const [setupEditBaseId, setSetupEditBaseId] = useState<Record<string, string | null>>({});
  const [setupSavedPrompt, setSetupSavedPrompt] = useState<Record<string, string>>({});
  const setupCardRef = useRef<HTMLDivElement | null>(null);
  const [setupPromptOpen, setSetupPromptOpen] = useState(true);
  const [setupOverlayOpen, setSetupOverlayOpen] = useState(false);

  const enterSetupEdit = (id: string, imageId: string | null) => {
    setSetupSavedPrompt((prev) => ({ ...prev, [id]: setupPrompt }));
    setSetupPrompt("");
    setSetupEditBaseId((prev) => ({ ...prev, [id]: imageId }));
    setSetupEditMode((prev) => ({ ...prev, [id]: true }));
  };
  const toggleSetupEdit = () => {
    if (!selected) return;
    const id = selected.id;
    const on = setupEditMode[id] === true;
    if (!on) {
      const baseId = setupSelectedVersionId ?? setupGallery.versions[0]?.image_id ?? null;
      enterSetupEdit(id, baseId);
    } else {
      setSetupPrompt(setupSavedPrompt[id] ?? "");
      setSetupSavedPrompt((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      setSetupEditBaseId((prev) => ({ ...prev, [id]: null }));
      setSetupEditMode((prev) => ({ ...prev, [id]: false }));
    }
  };
  const handleSetupEditFromVersion = (imageId: string) => {
    if (!selected) return;
    enterSetupEdit(selected.id, imageId);
    setupCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // When the selected tile changes or its gallery loads, pre-fill the textarea
  // from the latest sidecar and reset the version selector to newest.
  useEffect(() => {
    setSetupPrompt(setupGallery.versions[0]?.prompt ?? "");
    setSetupSelectedVersionId(setupGallery.versions[0]?.image_id ?? null);
  }, [selectedSetupId, setupGallery.versions]);

  const setupsArg = useMemo(
    () =>
      tiles.map((t) => ({
        id: t.id,
        scene: t.scene,
        mood: t.mood,
        camera: undefined,
      })),
    [tiles],
  );

  /** HEAD /artifacts/setup/<id>.png for each tile, return IDs that are missing. */
  const findMissing = async (ts: SetupTile[]): Promise<string[]> => {
    const missing: string[] = [];
    await Promise.all(
      ts.map(async (t) => {
        try {
          const res = await fetch(setupImgPath(t.id), { method: "HEAD", cache: "no-store" });
          if (!res.ok) missing.push(t.id);
        } catch {
          missing.push(t.id);
        }
      }),
    );
    return missing;
  };

  const runBatch = async (
    targetTiles: Array<{ id: string; scene: string; mood: string; camera?: string }>,
  ) => {
    if (targetTiles.length === 0) {
      setBatch({ kind: "ready" });
      return;
    }
    setBatch({ kind: "generating", status: null });
    try {
      const result = await callTool<{ task_id: string }>("generate_setup_images", {
        bible_uri: BIBLE_URI,
        setups: targetTiles,
      });
      const taskId = result.data?.task_id;
      if (!taskId) {
        setBatch({ kind: "error", message: "generate_setup_images returned no task_id" });
        return;
      }
      setBatch({ kind: "generating", status: null, task_id: taskId });
      const final = await pollTask(
        taskId,
        (s) => setBatch({ kind: "generating", status: s, task_id: taskId }),
        1500,
        240000,
      );
      if (final.status === "failed") {
        setBatch({ kind: "error", message: final.error || "Generation failed" });
        return;
      }
      // Bust the cache on each generated tile so the <img> re-requests it.
      const now = Date.now();
      setTileCacheBust((prev) => {
        const next = { ...prev };
        for (const t of targetTiles) next[t.id] = now;
        return next;
      });
      setBatch({ kind: "ready" });
    } catch (err) {
      setBatch({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  // BETA: on mount, only check what already exists. Do NOT auto-generate.
  // User triggers generation via per-tile Regenerate or batch buttons.
  // `runBatch` retained for re-wiring to a "Generate All Missing" button.
  // See ROLLOUT.md for restoration steps.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = await findMissing(tiles);
      if (cancelled) return;
      // Only bust the cache for tiles that ACTUALLY have an image on disk —
      // otherwise the <img> tag tries to load a missing file and renders the
      // browser's broken-image icon. Missing tiles fall back to the placeholder.
      const missingSet = new Set(missing);
      const now = Date.now();
      const map: Record<string, number> = {};
      for (const t of tiles) {
        if (!missingSet.has(t.id)) map[t.id] = now;
      }
      setTileCacheBust(map);
      // Generated-but-not-reviewed setups (i.e. file exists, status still "none")
      // start in the "draft" state so the user sees the chip and can approve/reject.
      for (const t of tiles) {
        if (!missingSet.has(t.id) && t.status === "none") {
          dispatch({ type: "SET_SETUP_STATUS", id: t.id, status: "draft" });
        }
      }
      setBatch({ kind: "ready" });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approveSetup = async (id: string) => {
    dispatch({ type: "SET_SETUP_STATUS", id, status: "approved" });
    try {
      await callTool("approve_artifact", {
        artifact_uri: setupUri(id),
        notes: `Setup ${id} approved`,
      });
    } catch (err) {
      console.error(`[approve_artifact setup ${id}] failed:`, err);
    }
  };

  const rejectSetup = async (id: string) => {
    dispatch({ type: "SET_SETUP_STATUS", id, status: "rejected" });
    try {
      await callTool("reject_artifact", {
        artifact_uri: setupUri(id),
        issues: [{ severity: "blocker", description: `Setup ${id} rejected from UI` }],
      });
    } catch (err) {
      console.error(`[reject_artifact setup ${id}] failed:`, err);
    }
  };

  const handleApproveAll = async () => {
    const drafts = tiles
      .filter((t) => t.status === "draft" || t.status === "none")
      .map((t) => t.id);
    dispatch({ type: "APPROVE_ALL_SETUPS" });
    for (const id of drafts) {
      try {
        await callTool("approve_artifact", {
          artifact_uri: setupUri(id),
          notes: "Bulk approve",
        });
      } catch (err) {
        console.error(`[approve_artifact bulk ${id}] failed:`, err);
      }
    }
  };

  const handleCompare = async () => {
    if (!selected) return;
    try {
      const r = await callTool("compare_with_anchor", {
        setup_uri: setupUri(selected.id),
        anchor_uri: ANCHOR_URI,
      });
      console.log("[compare_with_anchor] →", r.data);
    } catch (err) {
      console.error("[compare_with_anchor] failed:", err);
    }
  };

  const handleRegenerateSelected = async () => {
    if (!selected) return;
    const tile = setupsArg.find((s) => s.id === selected.id);
    if (!tile) return;
    setRegenerating((prev) => new Set(prev).add(selected.id));
    try {
      const editing = setupEditMode[tile.id] === true;
      const override = setupPrompt.trim();
      const refs = setupRefs[tile.id];
      const baseId = setupEditBaseId[tile.id] ?? null;
      const result = await callTool<{ task_id: string }>("generate_setup_images", {
        bible_uri: BIBLE_URI,
        setups: [tile],
        ...(override ? { prompt_overrides: { [tile.id]: override } } : {}),
        ...(refs && refs.length > 0 && !editing ? { reference_images: { [tile.id]: refs } } : {}),
        ...(editing
          ? {
              edit_mode: {
                [tile.id]: {
                  enabled: true,
                  ...(baseId ? { base_image_id: baseId } : {}),
                },
              },
            }
          : {}),
      });
      const taskId = result.data?.task_id;
      if (!taskId) throw new Error("no task_id");
      const final = await pollTask(taskId, undefined, 1500, 120000);
      if (final.status === "failed") {
        throw new Error(final.error || "Regeneration failed");
      }
      setTileCacheBust((prev) => ({ ...prev, [selected.id]: Date.now() }));
      // Newly-generated setup → flip "none" to "draft" so the chip appears.
      if (selected.status === "none") {
        dispatch({ type: "SET_SETUP_STATUS", id: selected.id, status: "draft" });
      }
      const refreshed = await setupGallery.refresh();
      setSetupSelectedVersionId(null);
      if (editing) {
        // Chain edits: clear the textarea and re-point the base to the new newest.
        setSetupPrompt("");
        const newest = refreshed[0]?.image_id ?? null;
        if (newest) setSetupEditBaseId((prev) => ({ ...prev, [tile.id]: newest }));
      }
    } catch (err) {
      console.error("[regenerate] failed:", err);
    } finally {
      setRegenerating((prev) => {
        const next = new Set(prev);
        next.delete(selected.id);
        return next;
      });
    }
  };

  const handleGenerateAll = async () => {
    // Generate all tiles that don't yet have an image on disk. Reuses the
    // batch tool so progress + cancel flow into the existing batch banner.
    const targets = setupsArg.filter((s) => tileCacheBust[s.id] === undefined);
    if (targets.length === 0) return;
    await runBatch(targets);
    // Mark freshly-generated tiles as "draft" so the chip appears.
    for (const t of targets) {
      dispatch({ type: "SET_SETUP_STATUS", id: t.id, status: "draft" });
    }
  };

  const handleRegenerateRejected = async () => {
    const targets = setupsArg.filter((s) =>
      tiles.find((t) => t.id === s.id)?.status === "rejected",
    );
    if (targets.length === 0) return;
    // Mark each rejected tile as in-flight so its image switches to the
    // "↻ regenerating…" placeholder.
    setRegenerating((prev) => {
      const next = new Set(prev);
      for (const t of targets) next.add(t.id);
      return next;
    });
    try {
      const result = await callTool<{ task_id: string }>("generate_setup_images", {
        bible_uri: BIBLE_URI,
        setups: targets,
      });
      const taskId = result.data?.task_id;
      if (!taskId) throw new Error("no task_id");
      const final = await pollTask(taskId, undefined, 1500, 240000);
      if (final.status === "failed") {
        throw new Error(final.error || "Regeneration failed");
      }
      const now = Date.now();
      setTileCacheBust((prev) => {
        const next = { ...prev };
        for (const t of targets) next[t.id] = now;
        return next;
      });
      // Move re-generated tiles back to "draft" so the user can review again.
      for (const t of targets) {
        dispatch({ type: "SET_SETUP_STATUS", id: t.id, status: "draft" });
      }
    } catch (err) {
      console.error("[regenerate rejected] failed:", err);
    } finally {
      setRegenerating((prev) => {
        const next = new Set(prev);
        for (const t of targets) next.delete(t.id);
        return next;
      });
    }
  };

  const handleSetupAutoFill = async () => {
    if (!selected) return;
    const tile = setupsArg.find((s) => s.id === selected.id);
    if (!tile) return;
    const baseline = setupAutoFillBase[selected.id];
    const hasUnsavedEdits =
      setupPrompt.trim().length > 0 &&
      baseline !== undefined &&
      setupPrompt !== baseline;
    if (hasUnsavedEdits) {
      const ok = window.confirm(
        "Overwrite your edits with auto-filled text from the Location Bible?",
      );
      if (!ok) return;
    }
    const result = await assemble.assembleSetup(BIBLE_URI, tile);
    if (result) {
      setSetupPrompt(result.prompt);
      setSetupAutoFillBase((prev) => ({ ...prev, [selected.id]: result.prompt }));
    }
  };

  // BETA: replace navigate→/light-states with direct "Send to Pipeline".
  // Auto-approves any draft setups and the outputs gate, then shows confirmation.
  // See ROLLOUT.md for restoration steps.
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleSend = async () => {
    setSending(true);
    setSendError(null);
    try {
      const drafts = tiles.filter(
        (t) => t.status === "draft" || t.status === "none",
      );
      dispatch({ type: "APPROVE_ALL_SETUPS" });
      for (const t of drafts) {
        await callTool("approve_artifact", {
          artifact_uri: setupUri(t.id),
          notes: "Auto-approve on send",
        });
      }
      await callTool("approve_artifact", {
        artifact_uri: `agent://location-scout/outputs/${LOCATION_ID}`,
        notes: "Setups sent to Shot Generation",
      });
      dispatch({ type: "APPROVE_STAGE", stage: "setups" });
      setSent(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const isBatchBusy = batch.kind === "checking" || batch.kind === "generating";

  const renderTileImage = (t: SetupTile) => {
    const isRegen = regenerating.has(t.id);
    const bust = tileCacheBust[t.id];
    // No image on disk yet → empty placeholder (no broken <img>).
    if (bust === undefined && !isRegen && !isBatchBusy) {
      return (
        <div
          className="setup-tile__image"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            opacity: 0.5,
          }}
        >
          Not generated
        </div>
      );
    }
    if (isBatchBusy || isRegen) {
      return (
        <div
          className="setup-tile__image"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            opacity: 0.7,
          }}
        >
          {isRegen ? "↻ regenerating…" : "⏳ generating…"}
        </div>
      );
    }
    return (
      <img
        src={`${setupImgPath(t.id)}?v=${bust}`}
        alt={`Setup ${t.id}`}
        className="setup-tile__image"
        style={{ objectFit: "cover", width: "100%", display: "block" }}
      />
    );
  };

  const selectedBust = selected ? tileCacheBust[selected.id] : undefined;
  const selectedImgSrc = selected
    ? `${setupImgPath(selected.id)}${selectedBust ? `?v=${selectedBust}` : ""}`
    : "";
  const selectedEditMode = selected ? setupEditMode[selected.id] === true : false;
  const selectedBusy = selected ? regenerating.has(selected.id) || isBatchBusy : false;

  return (
    <div className="input-page" data-figma-node="436:33">
      {setupOverlayOpen && selected && selectedBust !== undefined && (
        <ImageOverlay
          src={selectedImgSrc}
          alt={`Setup ${selected.id}`}
          onClose={() => setSetupOverlayOpen(false)}
        />
      )}
      {/* Batch-level progress / error banner */}
      {batch.kind === "generating" && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: "var(--sp-3)",
          }}
        >
          <span aria-hidden>⏳</span>
          <span>{batch.status?.current_step || "Generating setup images…"}</span>
          <span style={{ marginLeft: "auto", opacity: 0.7 }}>
            {Math.round((batch.status?.progress ?? 0) * 100)}%
          </span>
          {batch.task_id && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={async () => {
                if (batch.kind !== "generating" || !batch.task_id) return;
                try {
                  await callTool("cancel_task", { task_id: batch.task_id });
                } catch (e) {
                  console.warn("[cancel_task]", e);
                }
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}
      {batch.kind === "error" && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            background: "rgba(220,60,60,0.08)",
            border: "1px solid rgba(220,60,60,0.4)",
            marginBottom: "var(--sp-3)",
            color: "var(--red)",
          }}
        >
          ✗ Setup generation failed: {batch.message}
        </div>
      )}

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
                    {t.status !== "none" && (
                      <span className={`status-badge status-badge--${t.status}`}>{t.status}</span>
                    )}
                  </div>
                  {renderTileImage(t)}
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
                        approveSetup(t.id);
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
                        rejectSetup(t.id);
                      }}
                    >
                      ✗
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                paddingTop: "var(--sp-2)",
              }}
            >
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleRegenerateRejected}
                disabled={rejectedCount === 0 || isBatchBusy}
                title={rejectedCount === 0 ? "No rejected setups to regenerate" : undefined}
              >
                Regenerate Rejected
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleApproveAll}
                disabled={draftCount === 0}
              >
                Approve All
              </button>
              <span style={{ flex: 1 }} />
              {(() => {
                const missingCount = tiles.filter(
                  (t) => tileCacheBust[t.id] === undefined,
                ).length;
                const allGenerated = missingCount === 0;
                const someGenerated =
                  missingCount > 0 && missingCount < tiles.length;
                const label = allGenerated
                  ? "Generate All"
                  : someGenerated
                    ? `Generate Remaining (${missingCount})`
                    : "Generate All";
                return (
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleGenerateAll}
                    disabled={isBatchBusy || allGenerated}
                    title={allGenerated ? "All setups already generated" : undefined}
                  >
                    {label}
                  </button>
                );
              })()}
            </div>
          </article>
        </div>

        {/* ───── Setup Detail ───── */}
        <div className="input-page__column" ref={setupCardRef}>
          <div className="section-header">
            <span className="section-header__title" style={{ color: "#eaebec" }}>
              Setup Detail: {selected.id}
            </span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--sp-2)" }}>
              <div style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap" }}>
                <div className="detail-field">
                  <span className="detail-field__label">Scene / Mood</span>
                  <span className="detail-field__value">
                    {selected.scene} / {selected.mood}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-field__label">Status</span>
                  <span className="detail-field__value">
                    {selected.status === "none" ? "not generated" : selected.status}
                  </span>
                </div>
              </div>

              {/* Image — always visible, click to zoom. Locked to 16:9 via
                  padding-bottom wrapper so the placeholder + image keep the
                  same frame ratio. */}
              <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%" }}>
                {selectedBust !== undefined ? (
                  <img
                    src={selectedImgSrc}
                    alt={`Setup ${selected.id}`}
                    onClick={() => setSetupOverlayOpen(true)}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: 8,
                      display: "block",
                      background: "var(--border)",
                      cursor: "zoom-in",
                    }}
                  />
                ) : (
                  <div
                    className="placeholder-box"
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {selectedBusy ? "Generating…" : "No setup image yet"}
                  </div>
                )}
              </div>

              {/* Collapse toggle */}
              <div style={{ display: "flex", alignItems: "center", height: 32 }}>
                <button
                  type="button"
                  onClick={() => setSetupPromptOpen((o) => !o)}
                  aria-expanded={setupPromptOpen}
                  aria-controls="setup-prompt-body"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text)",
                    cursor: "pointer",
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                  }}
                >
                  <span aria-hidden style={{ display: "inline-block", width: 10 }}>
                    {setupPromptOpen ? "▼" : "▶"}
                  </span>
                  <span>Prompt</span>
                </button>
              </div>

              {setupPromptOpen && (
                <div id="setup-prompt-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {selectedEditMode ? "What to change" : "Generation prompt"}
                      </label>
                      {!selectedEditMode && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={handleSetupAutoFill}
                          disabled={assemble.busy || selectedBusy}
                          style={{ fontSize: 11, padding: "2px 8px" }}
                          title="Preview the prompt that would be sent, filled from the Location Bible"
                        >
                          {assemble.busy ? "…" : "✦ Auto-fill from Bibles"}
                        </button>
                      )}
                    </div>
                    <textarea
                      value={setupPrompt}
                      onChange={(e) => setSetupPrompt(e.target.value)}
                      placeholder={
                        selectedEditMode
                          ? "Describe what to change… e.g. add golden-hour sunset through window"
                          : "Auto-filled after first generation — edit to customise next run"
                      }
                      rows={3}
                      disabled={selectedBusy}
                      style={{
                        width: "100%",
                        resize: "vertical",
                        fontFamily: "ui-monospace, Menlo, monospace",
                        fontSize: 12,
                        lineHeight: 1.45,
                        background: "var(--bg-input, rgba(255,255,255,0.04))",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        padding: "6px 8px",
                        color: "var(--text-primary)",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <ReferencePicker
                    entity_id={selected.id.replace(/\//g, "_")}
                    bible_id={LOCATION_ID}
                    setup_ids={tiles.map((t) => t.id)}
                    value={setupRefs[selected.id] ?? []}
                    onChange={(next) =>
                      setSetupRefs((prev) => ({ ...prev, [selected.id]: next }))
                    }
                    lockedAutoRefs={[
                      {
                        parentLabel: "anchor",
                        imageUrl: `/artifacts/anchor/${LOCATION_ID}.png`,
                        kind: "anchor",
                      },
                    ]}
                    label={`Refs for ${selected.id}`}
                    disabled={selectedBusy}
                  />
                </div>
              )}

              {/* Edit + Regenerate — always visible */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    if (!selectedEditMode) setSetupPromptOpen(true);
                    toggleSetupEdit();
                  }}
                  disabled={selectedBusy}
                  title={selectedEditMode ? "Exit edit mode" : "Edit current setup"}
                >
                  {selectedEditMode ? "Cancel" : "Edit"}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleRegenerateSelected}
                  disabled={selectedBusy || (selectedEditMode && setupPrompt.trim().length === 0)}
                  title={selectedEditMode && setupPrompt.trim().length === 0 ? "Describe what to change" : undefined}
                >
                  {selectedBusy ? "Generating…" : selectedEditMode ? "Generate Edit" : "Regenerate"}
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div className="page-footer">
        <span className="page-footer__spacer" />
        <span className="mini-label" style={{ marginRight: "var(--sp-2)" }}>
          {approvedCount} / {tiles.length} approved
        </span>
        {sent ? (
          <span
            role="status"
            style={{
              // BETA: confirmation banner. #A6F77E is one of the 14 palette-locked hexes.
              backgroundColor: "#A6F77E",
              color: "#111111",
              padding: "var(--sp-2) var(--sp-3)",
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            ✓ Sent to Shot Generation
          </span>
        ) : (
          <>
            {sendError && (
              <span style={{ color: "#F7927E", marginRight: "var(--sp-2)" }}>{sendError}</span>
            )}
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSend}
              disabled={isBatchBusy || sending || sent}
            >
              {sending ? "Sending…" : "Send to Pipeline"}
              <span className="btn__arrow" aria-hidden>→</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
