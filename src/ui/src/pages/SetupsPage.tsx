/**
 * Stage 5 — Setups Generation.
 * Mirrors Figma frame "Setups Generation" (node 436:33).
 *
 * State ownership (Variant A status, Phase 3b-2):
 *   - The extract_setups lifecycle was already moved off SetupsPage in the
 *     2026-05-19 LS Setups Discipline pass. SetupsPage no longer auto-fires
 *     anything on mount; it reads PipelineState.setupsExtraction (populated
 *     by the Approve Anchor handler on ReferencesPage) and renders the
 *     SetupsPageEmpty wrapper below if no tiles are present.
 *   - Per-tile setup PNGs have no JSON `get_setup` MCP tool today (Phase 5
 *     backend gap), so the mount `useEffect` still HEAD-probes
 *     /artifacts/setup/<id>.png to flip tile statuses. Cross-project leak
 *     is closed at the URL layer by buildArtifactUrl. Once `get_setup`
 *     lands server-side, swap to `useArtifact({ type: "setup", id })`.
 *   - The pollTask calls inside runBatch / handleRegenerateSelected /
 *     handleRegenerateRejected are imperative await flows that don't
 *     cross page boundaries; converting them to declarative `useTask`
 *     subscriptions requires hoisting taskId state per-tile (Phase 4 task
 *     when CD/AD/ShotGen get the same treatment, since their generation
 *     flows have the same shape). Left as-is.
 *
 *   The setupsExtraction slice on PipelineState stays — it's the
 *   cross-page handoff between Approve-Anchor (on ReferencesPage) and the
 *   empty-state renderer here. useTask in ReferencesPage already drives
 *   that slice's progression; SetupsPage just reads.
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
import { useProjectContext, buildArtifactUrl } from "../hooks/useProjectContext";
import { useDebouncedAction } from "../hooks/useDebouncedAction";
const setupUri = (id: string) => `agent://location-scout/setup/${id}`;
const setupImgPath = (id: string) => `/artifacts/setup/${id}.png`;

// Camera descriptions previously hardcoded per Figma mock IDs (S1-A through S3-C)
// containing fixture-specific text from the Figma mock — removed 2026-05-15. Real
// setups now come from the backend state.setups.tiles[].camera, populated upstream
// by Cinematographer/Editor. When tile.camera is missing the UI shows an empty
// dash, not a fixture.

type BatchState =
  | { kind: "checking" }
  | { kind: "generating"; status: TaskStatus | null; task_id?: string }
  | { kind: "ready" }
  | { kind: "error"; message: string };

/**
 * Empty-state wrapper. Renders the current setupsExtraction lifecycle that
 * was started by the Approve Anchor button on References (LS Setups
 * Discipline 2026-05-19).
 *
 * This component does NOT auto-fire extract_setups. The trigger is on
 * References, not on tab mount. If `setupsExtraction.kind === "idle"`, we
 * tell the user to approve the anchor first.
 */
function SetupsPageEmpty({
  extraction,
}: {
  extraction: import("./setupsExtraction").SetupsExtractionState;
}) {
  const body = (() => {
    switch (extraction.kind) {
      case "idle":
        return (
          <>
            Approve the Anchor on the{" "}
            <a href="/" style={{ color: "var(--accent)" }}>References</a> tab to
            extract setups automatically.
          </>
        );
      case "extracting": {
        const progress = extraction.progress;
        const step = extraction.current_step;
        return (
          <>
            Extracting setups…
            {typeof progress === "number" && progress > 0 && (
              <> {Math.round(progress * 100)}%</>
            )}
            {step && (
              <>
                <br />
                <span style={{ opacity: 0.6, fontSize: 11 }}>{step}</span>
              </>
            )}
          </>
        );
      }
      case "failed":
        return (
          <>
            <span style={{ color: "#F7927E" }}>{extraction.message}</span>
            <br />
            <span style={{ opacity: 0.7 }}>
              Re-approve the anchor from{" "}
              <a href="/" style={{ color: "var(--accent)" }}>References</a> to retry.
            </span>
          </>
        );
      case "ready":
        // ready but tiles empty — shouldn't normally reach here because the
        // handler dispatches SET_SETUPS_TILES before SET_SETUPS_EXTRACTION ready,
        // but render a calm message just in case.
        return (
          <>
            Setups extracted but no tiles were produced. Re-approve from{" "}
            <a href="/" style={{ color: "var(--accent)" }}>References</a> to retry.
          </>
        );
    }
  })();

  return (
    <div
      className="input-page"
      data-figma-node="436:33"
      style={{ padding: 32, textAlign: "center" }}
    >
      <h3 style={{ fontSize: 14, marginBottom: 8, color: "var(--text)" }}>
        {extraction.kind === "extracting" ? "Extracting setups…" : "No setups extracted yet"}
      </h3>
      <p style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}

export function SetupsPage() {
  const { state, dispatch } = usePipeline();
  const { tiles, selectedId } = state.setups;
  const { locationId: LOCATION_ID, projectId, projectIdReady } = useProjectContext();
  // Per Bug 1 (2026-05-22): project_id reaches the backend via two channels:
  //   1. callTool() in api/mcp.ts auto-injects args.project_id from the URL
  //      → MCP middleware stamps it on AsyncLocalStorage → resolveProjectKey
  //      picks it up.
  //   2. We pass project_id explicitly in the generate_setup_images args
  //      below (belt-and-braces; defends against future refactors that drop
  //      the auto-inject helper).
  // The URI fragments themselves carry the per-project location id
  // (loc_${projectId}) so the bibleId resolves to the right slot. Adding
  // ?project_id=… to the URI string would break the backend's
  // `.split("/").pop()` bible-id extraction, so we don't do that.
  const BIBLE_URI = `agent://location-scout/bible/${LOCATION_ID}`;
  const ANCHOR_URI = `agent://location-scout/anchor/${LOCATION_ID}`;
  const selected = tiles.find((t) => t.id === selectedId) ?? tiles[0];
  // Empty-tiles guard: without this, every JSX access to `selected.id` below
  // throws `TypeError: Cannot read properties of undefined (reading 'id')` and
  // the route renders a blank iframe. Reproduced live 2026-05-16.
  //
  // LS Setups Discipline (2026-05-19): the empty wrapper now just reads the
  // shared setupsExtraction lifecycle (started by Approve Anchor on
  // References). No more tab-mount auto-fire.
  if (!selected) {
    return <SetupsPageEmpty extraction={state.setupsExtraction} />;
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
        project_id: projectId,
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

  const handleRegenerateSelected = useDebouncedAction(async () => {
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
        project_id: projectId,
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
  });

  const handleGenerateAll = useDebouncedAction(async () => {
    // Generate all tiles that don't yet have an image on disk. Reuses the
    // batch tool so progress + cancel flow into the existing batch banner.
    const targets = setupsArg.filter((s) => tileCacheBust[s.id] === undefined);
    if (targets.length === 0) return;
    await runBatch(targets);
    // Mark freshly-generated tiles as "draft" so the chip appears.
    for (const t of targets) {
      dispatch({ type: "SET_SETUP_STATUS", id: t.id, status: "draft" });
    }
  });

  const handleRegenerateRejected = useDebouncedAction(async () => {
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
        project_id: projectId,
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
  });

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
