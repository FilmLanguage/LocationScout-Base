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
import { useNavigate } from "react-router-dom";
import { callTool, pollTask, type TaskStatus } from "../api/mcp";
import { usePipeline } from "../state/PipelineContext";
import type { SetupTile } from "../state/pipeline";
import { PromptCard } from "../components/PromptCard";
import { ReferencePicker, type ReferenceRef } from "../components/ReferencePicker";
import { useGallery } from "../hooks/useGallery";
import { useAssemblePrompt } from "../hooks/useAssemblePrompt";

const LOCATION_ID = "loc_001";
const BIBLE_URI = `agent://location-scout/bible/${LOCATION_ID}`;
const ANCHOR_URI = `agent://location-scout/anchor/${LOCATION_ID}`;
const setupUri = (id: string) => `agent://location-scout/setup/${id}`;
const setupImgPath = (id: string) => `/artifacts/setup/${id}.png`;

/** Default camera descriptions per setup, pulled from the Figma mock-up. */
const SETUP_CAMERA: Record<string, string> = {
  "S1-A": "35mm, angle 45°, medium wide, couch centered",
  "S1-B": "35mm, angle 45°, medium wide, daylight key",
  "S1-C": "35mm, angle 45°, dusk warm fill",
  "S2-A": "50mm, angle 180°, close-up, TV reflection in eyes",
  "S2-B": "50mm, angle 180°, close-up, night practical only",
  "S2-C": "50mm, angle 180°, dusk side light",
  "S3-A": "24mm, angle 90°, wide, kitchen archway frame, late-night moonlight",
  "S3-B": "24mm, angle 90°, wide, flat daylight",
  "S3-C": "24mm, angle 90°, wide, overhead practicals at night",
};

type BatchState =
  | { kind: "checking" }
  | { kind: "generating"; status: TaskStatus | null }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export function SetupsPage() {
  const { state, dispatch } = usePipeline();
  const navigate = useNavigate();
  const { tiles, selectedId } = state.setups;
  const selected = tiles.find((t) => t.id === selectedId) ?? tiles[0];
  const approvedCount = tiles.filter((t) => t.status === "approved").length;
  const draftCount = tiles.filter((t) => t.status === "draft").length;

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
        camera: SETUP_CAMERA[t.id] ?? undefined,
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
      const final = await pollTask(
        taskId,
        (s) => setBatch({ kind: "generating", status: s }),
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

  // On mount: see what's missing, generate if needed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = await findMissing(tiles);
      if (cancelled) return;
      if (missing.length === 0) {
        // Mark everything as freshly-cached so the browser actually renders.
        const now = Date.now();
        const map: Record<string, number> = {};
        for (const t of tiles) map[t.id] = now;
        setTileCacheBust(map);
        setBatch({ kind: "ready" });
        return;
      }
      const targets = setupsArg.filter((s) => missing.includes(s.id));
      await runBatch(targets);
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
    const drafts = tiles.filter((t) => t.status === "draft").map((t) => t.id);
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

  const handleAdvance = () => {
    dispatch({ type: "APPROVE_STAGE", stage: "setups" });
    navigate("/light-states");
  };

  const isBatchBusy = batch.kind === "checking" || batch.kind === "generating";

  const renderTileImage = (t: SetupTile) => {
    const isRegen = regenerating.has(t.id);
    const bust = tileCacheBust[t.id];
    if (isBatchBusy || isRegen || bust === undefined) {
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
          {isRegen ? "↻ regenerating…" : batch.kind === "generating" ? "⏳ generating…" : "…"}
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

  return (
    <div className="input-page" data-figma-node="436:33">
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
                    <span className={`status-badge status-badge--${t.status}`}>{t.status}</span>
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
          </article>
        </div>

        {/* ───── Setup Detail ───── */}
        <div className="input-page__column" ref={setupCardRef}>
          <div className="section-header">
            <span className="section-header__title" style={{ color: "var(--accent)" }}>
              Setup Detail: {selected.id}
            </span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--sp-3)" }}>
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
              <PromptCard
                label={`Setup ${selected.id}`}
                kind="setup"
                entityId={selected.id.replace(/\//g, "_")}
                collapsible
                versions={setupGallery.versions}
                selectedVersionId={setupSelectedVersionId}
                onSelectVersion={setSetupSelectedVersionId}
                prompt={setupPrompt}
                promptUsed={setupGallery.versions[0]?.prompt ?? null}
                onChange={setSetupPrompt}
                onRegenerate={handleRegenerateSelected}
                onAutoFill={handleSetupAutoFill}
                autoFillBusy={assemble.busy}
                busy={regenerating.has(selected.id) || isBatchBusy}
                cacheBust={tileCacheBust[selected.id]}
                editMode={setupEditMode[selected.id] === true}
                onToggleEditMode={toggleSetupEdit}
                editBaseId={setupEditBaseId[selected.id] ?? null}
                onEditFromVersion={handleSetupEditFromVersion}
              />
              <ReferencePicker
                entity_id={selected.id.replace(/\//g, "_")}
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
                disabled={regenerating.has(selected.id) || isBatchBusy}
              />
              <button type="button" className="btn btn--ghost btn--block" onClick={handleCompare}>
                ⇄ Compare with Anchor
              </button>
            </div>
          </article>
        </div>
      </div>

      <div className="page-footer">
        <button
          type="button"
          className="btn btn--success"
          onClick={handleApproveAll}
          disabled={draftCount === 0}
        >
          Approve All ({draftCount})
        </button>
        <span className="page-footer__spacer" />
        <span className="mini-label" style={{ marginRight: "var(--sp-2)" }}>
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
