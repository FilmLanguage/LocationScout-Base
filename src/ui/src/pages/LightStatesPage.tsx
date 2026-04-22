/**
 * Stage 6 — Light State Variations.
 * Mirrors Figma frame "Light State Variations" (node 440:40).
 *
 * Reuses the per-setup images generated in Stage 5 (Setups page). Each
 * Source Setups row shows a thumbnail of the first matching setup tile,
 * and each Generated Variation tile shows the setup image whose mood
 * matches the variation (falls back to the "-A" tile if no exact match).
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { callTool, pollTask, type TaskStatus } from "../api/mcp";
import { usePipeline } from "../state/PipelineContext";
import type { SetupTile } from "../state/pipeline";

const LOCATION_ID = "loc_001";
const BIBLE_URI = `agent://location-scout/bible/${LOCATION_ID}`;

const variationUri = (id: string) =>
  `agent://location-scout/mood-variation/${encodeURIComponent(id)}`;

const setupImgPath = (id: string) => `/artifacts/setup/${id}.png`;
const moodVariationImgPath = (setupId: string) => `/artifacts/mood-variation/${setupId}.png`;

/**
 * Resolve the setup tile ID whose generated image should back a given
 * Source/Variation identifier.
 *
 *  - "S1"              → first tile whose id startsWith "S1" (usually S1-A)
 *  - "S1 / NIGHT"      → tile with source S1 AND mood NIGHT, else S1-A
 *  - "S3 / LATE_NIGHT" → tile with source S3 AND mood LATE_NIGHT, else S3-A
 */
function resolveSetupId(
  ref: string,
  setups: SetupTile[],
): string | null {
  const [rawSource, rawMood] = ref.split("/").map((s) => s.trim());
  if (!rawSource) return null;
  const source = rawSource.toUpperCase();
  const mood = rawMood?.toUpperCase();

  if (mood) {
    const exact = setups.find(
      (t) => t.id.toUpperCase().startsWith(source) && t.mood.toUpperCase() === mood,
    );
    if (exact) return exact.id;
  }

  const fallback = setups.find((t) => t.id.toUpperCase().startsWith(source));
  return fallback?.id ?? null;
}

export function LightStatesPage() {
  const { state, dispatch } = usePipeline();
  const navigate = useNavigate();
  const ls = state.lightStates;
  const setupTiles = state.setups.tiles;
  const activeSource = ls.sources.find((s) => s.id === ls.activeSourceId) ?? ls.sources[0];
  const visibleVariations = ls.variations.filter((v) => v.status !== "canceled");
  const approvedCount = visibleVariations.filter((v) => v.status === "approved").length;
  const draftCount = visibleVariations.filter((v) => v.status === "draft").length;

  /** Map each source.id → the setup tile id whose image represents it. */
  const sourceImageMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const s of ls.sources) m[s.id] = resolveSetupId(s.id, setupTiles);
    return m;
  }, [ls.sources, setupTiles]);

  /** Map each variation.id → the setup tile id whose image represents it. */
  const variationImageMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const v of ls.variations) m[v.id] = resolveSetupId(v.id, setupTiles);
    return m;
  }, [ls.variations, setupTiles]);

  const activeSourceImageId = sourceImageMap[activeSource.id] ?? null;
  const mc = ls.moodConfig;

  /**
   * Per-source cache of the most recent mood-variation generation.
   *   cacheBust   → query-param number to force <img> to re-fetch after regen
   *   status      → null when idle, TaskStatus while polling, 'error' on fail
   *   errorMsg    → present on failure
   * Keyed by activeSource.id ("S1", "S2", "S3") so switching sources doesn't
   * lose in-progress state of the others.
   */
  const [moodGen, setMoodGen] = useState<
    Record<
      string,
      {
        cacheBust: number | null;
        status: TaskStatus | null;
        errorMsg?: string;
      }
    >
  >({});

  const activeGen = moodGen[activeSource.id] ?? {
    cacheBust: null,
    status: null,
  };
  const isGenerating =
    activeGen.status !== null &&
    activeGen.status.status !== "completed" &&
    activeGen.status.status !== "failed";

  const DIRECTION_OPTIONS = ["W", "E", "N", "S", "OVERHEAD", "FLOOR"];
  const TIME_OF_DAY_OPTIONS = ["DAY", "DUSK", "NIGHT", "LATE_NIGHT", "DAWN"];
  const SHADOW_OPTIONS: Array<"hard" | "soft" | "mixed"> = ["hard", "soft", "mixed"];
  const CLUTTER_OPTIONS: Array<"clean" | "slight" | "messy" | "destroyed"> = [
    "clean",
    "slight",
    "messy",
    "destroyed",
  ];
  const WINDOW_OPTIONS: Array<"open" | "closed" | "curtains_drawn" | "boarded_up"> = [
    "open",
    "closed",
    "curtains_drawn",
    "boarded_up",
  ];

  const handleAdvance = () => {
    dispatch({ type: "APPROVE_STAGE", stage: "light-states" });
    navigate("/outputs");
  };

  const handleGenerateVariation = async () => {
    const sourceId = activeSource.id;
    const cfg = ls.moodConfig;
    // Flip into "processing" immediately so the overlay shows.
    setMoodGen((prev) => ({
      ...prev,
      [sourceId]: {
        cacheBust: prev[sourceId]?.cacheBust ?? null,
        status: {
          task_id: "",
          status: "accepted",
          progress: 0,
          current_step: "Submitting…",
        },
      },
    }));
    try {
      const result = await callTool<{ task_id: string }>("add_mood_variation", {
        setup_id: sourceId,
        bible_uri: BIBLE_URI,
        mood_config: {
          time_of_day: cfg.timeOfDay,
          color_temp_k: cfg.colorTempK,
          shadow_hardness: cfg.shadowHardness,
          clutter_level: cfg.clutterLevel,
          window_state: cfg.windowState,
          direction_override: cfg.directionOverride,
          notes: `Generated from Light States UI (${cfg.colorTempK}K, ${cfg.shadowHardness} shadows, ${cfg.timeOfDay})`,
        },
      });
      const taskId = result.data?.task_id;
      if (!taskId) throw new Error("no task_id returned");
      const final = await pollTask(
        taskId,
        (s) =>
          setMoodGen((prev) => ({
            ...prev,
            [sourceId]: { ...(prev[sourceId] ?? { cacheBust: null }), status: s },
          })),
        1000,
        180000,
      );
      if (final.status === "failed") {
        setMoodGen((prev) => ({
          ...prev,
          [sourceId]: {
            cacheBust: prev[sourceId]?.cacheBust ?? null,
            status: final,
            errorMsg: final.error || "Mood variation generation failed",
          },
        }));
        return;
      }
      // Success — bust the cache so the <img> re-fetches the new file.
      setMoodGen((prev) => ({
        ...prev,
        [sourceId]: {
          cacheBust: Date.now(),
          status: final,
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[add_mood_variation] failed:", err);
      setMoodGen((prev) => ({
        ...prev,
        [sourceId]: {
          cacheBust: prev[sourceId]?.cacheBust ?? null,
          status: {
            task_id: "",
            status: "failed",
            progress: 0,
            current_step: "Failed",
            error: msg,
          },
          errorMsg: msg,
        },
      }));
    }
  };

  const approveVariation = async (id: string) => {
    dispatch({ type: "SET_VARIATION_STATUS", id, status: "approved" });
    try {
      const r = await callTool("approve_artifact", {
        artifact_uri: variationUri(id),
        notes: `Variation ${id} approved`,
      });
      console.log(`[approve variation ${id}] →`, r.data);
    } catch (err) {
      console.error(`[approve variation ${id}] failed:`, err);
    }
  };

  const rejectVariation = async (id: string) => {
    dispatch({ type: "SET_VARIATION_STATUS", id, status: "rejected" });
    try {
      const r = await callTool("reject_artifact", {
        artifact_uri: variationUri(id),
        issues: [{ severity: "blocker", description: `Variation ${id} rejected` }],
      });
      console.log(`[reject variation ${id}] →`, r.data);
    } catch (err) {
      console.error(`[reject variation ${id}] failed:`, err);
    }
  };

  const cancelVariation = async (id: string) => {
    dispatch({ type: "CANCEL_VARIATION", id });
    try {
      const r = await callTool("cancel_task", { task_id: id });
      console.log(`[cancel_task ${id}] →`, r.data);
    } catch (err) {
      console.error(`[cancel_task ${id}] failed:`, err);
    }
  };

  const handleApply = async () => {
    dispatch({ type: "APPLY_MOOD_SUGGESTION" });
    try {
      const r = await callTool("apply_mood_suggestion", {
        setup_id: activeSource.id,
        suggestion_id: "ai_2700k_hard_night",
      });
      console.log("[apply_mood_suggestion] →", r.data);
    } catch (err) {
      console.error("[apply_mood_suggestion] failed:", err);
    }
  };

  const handleDismiss = async () => {
    dispatch({ type: "DISMISS_MOOD_SUGGESTION" });
    try {
      const r = await callTool("dismiss_mood_suggestion", {
        setup_id: activeSource.id,
        suggestion_id: "ai_2700k_hard_night",
      });
      console.log("[dismiss_mood_suggestion] →", r.data);
    } catch (err) {
      console.error("[dismiss_mood_suggestion] failed:", err);
    }
  };

  const handleApproveAllVariations = async () => {
    const drafts = ls.variations.filter((v) => v.status === "draft").map((v) => v.id);
    dispatch({ type: "APPROVE_ALL_VARIATIONS" });
    for (const id of drafts) {
      try {
        const r = await callTool("approve_artifact", {
          artifact_uri: variationUri(id),
          notes: "Bulk approve variations",
        });
        console.log(`[approve bulk variation ${id}] →`, r.data);
      } catch (err) {
        console.error(`[approve bulk variation ${id}] failed:`, err);
      }
    }
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

      {/*
        2-column layout: left column stacks Source Setups + Generated Variations,
        right column holds the tall Mood Configuration card. This avoids the
        unused vertical gap that a 3-column grid leaves under Source Setups
        when Mood Configuration is taller than Source Setups.
      */}
      <div className="columns-2">
        {/* ───── Left column: Source Setups + Generated Variations stacked ───── */}
        <div className="input-page__column" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <div className="section-header">
            <span className="section-header__title">Source Setups</span>
            <span className="section-header__subtitle">Select setup</span>
          </div>
          <article className="card">
            <div className="source-list">
              {ls.sources.map((s) => {
                const imgId = sourceImageMap[s.id];
                return (
                  <div
                    key={s.id}
                    className={`source-item${s.id === ls.activeSourceId ? " source-item--active" : ""}`}
                    onClick={() => dispatch({ type: "SELECT_LIGHT_SOURCE", id: s.id })}
                    style={{
                      display: "flex",
                      gap: "var(--sp-2)",
                      alignItems: "center",
                    }}
                  >
                    {imgId ? (
                      <img
                        src={setupImgPath(imgId)}
                        alt={`${s.id} setup reference`}
                        style={{
                          width: 72,
                          height: 54,
                          objectFit: "cover",
                          borderRadius: 4,
                          flexShrink: 0,
                          background: "var(--border)",
                        }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 72,
                          height: 54,
                          borderRadius: 4,
                          flexShrink: 0,
                          background: "rgba(255,255,255,0.05)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          opacity: 0.4,
                        }}
                      >
                        no image
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                      <span className="source-item__title">{s.id}</span>
                      <span className="source-item__meta">{s.meta}</span>
                      <span className="source-item__meta">{s.variations} variations configured</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          {/* ───── Generated Variations (stacked below Source Setups in left col) ───── */}
          <div className="section-header">
            <span className="section-header__title">Generated Variations</span>
            <span className="count-pill">{visibleVariations.length}</span>
          </div>
          <article className="card">
            <div className="card__body tile-grid tile-grid--two">
              {visibleVariations.map((v) => {
                const imgId = variationImageMap[v.id];
                return (
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
                  {v.status === "generating" ? (
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
                      ⏳ Generating...
                    </div>
                  ) : imgId ? (
                    <img
                      src={setupImgPath(imgId)}
                      alt={`Variation ${v.id}`}
                      className="setup-tile__image"
                      style={{ objectFit: "cover", width: "100%", display: "block" }}
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        img.style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className="setup-tile__image"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        opacity: 0.4,
                      }}
                    >
                      no image
                    </div>
                  )}
                  <div className="setup-tile__footer">
                    <span className="mini-chip mini-chip--mood">{v.temp}</span>
                    <span className="setup-tile__spacer" />
                    {v.status === "generating" ? (
                      <button
                        type="button"
                        className="btn btn--danger-ghost"
                        onClick={() => cancelVariation(v.id)}
                      >
                        Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="icon-btn icon-btn--approve"
                          aria-label="Approve"
                          onClick={() => approveVariation(v.id)}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--reject"
                          aria-label="Reject"
                          onClick={() => rejectVariation(v.id)}
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
                );
              })}
            </div>
          </article>
        </div>

        {/* ───── Mood Configuration ───── */}
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Mood Configuration for {activeSource.id}</span>
          </div>
          <article className="card">
            <div className="card__body" style={{ gap: "var(--sp-3)" }}>
              {/*
                Preview image — shows the generated mood variation if one exists
                for the active source, otherwise falls back to the setup image.
                An overlay appears while a new variation is being generated.
              */}
              <div style={{ position: "relative" }}>
                {activeGen.cacheBust !== null ? (
                  <img
                    key={`mood-${activeSource.id}-${activeGen.cacheBust}`}
                    src={`${moodVariationImgPath(activeSource.id)}?v=${activeGen.cacheBust}`}
                    alt={`${activeSource.id} mood variation`}
                    style={{
                      width: "100%",
                      borderRadius: 6,
                      background: "var(--border)",
                      display: "block",
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                ) : activeSourceImageId ? (
                  <img
                    key={`setup-${activeSource.id}-${activeSourceImageId}`}
                    src={setupImgPath(activeSourceImageId)}
                    alt={`${activeSource.id} base setup`}
                    style={{
                      width: "100%",
                      borderRadius: 6,
                      background: "var(--border)",
                      display: "block",
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                    }}
                  />
                ) : null}
                {isGenerating && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      background: "rgba(0,0,0,0.55)",
                      borderRadius: 6,
                      color: "var(--text)",
                      fontSize: 13,
                      textAlign: "center",
                      padding: 16,
                    }}
                  >
                    <span aria-hidden style={{ fontSize: 28 }}>⏳</span>
                    <span>{activeGen.status?.current_step || "Generating…"}</span>
                    <span style={{ fontSize: 11, opacity: 0.7 }}>
                      {Math.round((activeGen.status?.progress ?? 0) * 100)}%
                    </span>
                  </div>
                )}
                {activeGen.errorMsg && !isGenerating && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(220,60,60,0.55)",
                      borderRadius: 6,
                      color: "var(--text)",
                      fontSize: 12,
                      padding: 16,
                      textAlign: "center",
                    }}
                  >
                    ✗ {activeGen.errorMsg}
                  </div>
                )}
              </div>
              <span className="mini-label">Base: Bible state (W, 5500K, soft, clean)</span>

              {/* Direction — base is W, user can override to any compass direction */}
              <div className="delta-row">
                <span className="delta-row__label">Direction</span>
                <span style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                  <span className="delta-row__base">W</span>{" "}
                  <span className="delta-arrow">→</span>{" "}
                  {DIRECTION_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`chip chip--sm chip--outlined${mc.directionOverride === d ? " chip--active" : ""}`}
                      onClick={() =>
                        dispatch({ type: "SET_MOOD_CONFIG", patch: { directionOverride: d } })
                      }
                    >
                      {d}
                    </button>
                  ))}
                </span>
              </div>

              {/* Time of Day */}
              <div className="delta-row">
                <span className="delta-row__label">Time of Day</span>
                <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {TIME_OF_DAY_OPTIONS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`chip chip--sm chip--outlined${mc.timeOfDay === t ? " chip--active" : ""}`}
                      onClick={() =>
                        dispatch({ type: "SET_MOOD_CONFIG", patch: { timeOfDay: t } })
                      }
                    >
                      {t}
                    </button>
                  ))}
                </span>
              </div>

              {/* Color Temp — slider + direct input, 1800K → 6500K */}
              <div className="delta-row">
                <span className="delta-row__label">Color Temp</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="range"
                      className="color-temp-slider"
                      min={1800}
                      max={6500}
                      step={100}
                      value={mc.colorTempK}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_MOOD_CONFIG",
                          patch: { colorTempK: Number(e.target.value) },
                        })
                      }
                      style={{ flex: 1 }}
                      aria-label="Color temperature in Kelvin"
                    />
                    <input
                      type="number"
                      min={1800}
                      max={6500}
                      step={100}
                      value={mc.colorTempK}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) {
                          dispatch({ type: "SET_MOOD_CONFIG", patch: { colorTempK: v } });
                        }
                      }}
                      style={{
                        width: 72,
                        padding: "2px 6px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: 4,
                        color: "var(--accent)",
                        fontSize: 12,
                        fontFamily: "inherit",
                      }}
                    />
                    <span className="delta-row__base" style={{ fontSize: 11 }}>K</span>
                  </span>
                  <span className="delta-row__base" style={{ fontSize: 11 }}>
                    Base: 5500K
                  </span>
                </span>
              </div>

              {/* Shadow Hardness */}
              <div className="delta-row">
                <span className="delta-row__label">Shadow Hardness</span>
                <span style={{ display: "flex", gap: 4 }}>
                  {SHADOW_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`chip chip--sm chip--outlined${mc.shadowHardness === s ? " chip--active" : ""}`}
                      onClick={() =>
                        dispatch({ type: "SET_MOOD_CONFIG", patch: { shadowHardness: s } })
                      }
                    >
                      {s}
                    </button>
                  ))}
                </span>
              </div>

              <span className="section-label">State Deltas</span>
              {/* Live-computed deltas that reflect the current config */}
              <div className="delta-row">
                <span className="delta-row__label">Light Change</span>
                <span className="delta-row__value">
                  5500K → {mc.colorTempK}K, direction W → {mc.directionOverride.toLowerCase()}
                </span>
              </div>
              <div className="delta-row">
                <span className="delta-row__label">Props Change</span>
                <span className="delta-row__value">Beer cans accumulate on table, ashtray appears</span>
              </div>
              <div className="delta-row">
                <span className="delta-row__label">Atmosphere Shift</span>
                <span className="delta-row__value">Tense silence replaces morning bustle</span>
              </div>

              {/* Clutter Level */}
              <div className="delta-row">
                <span className="delta-row__label">Clutter Level</span>
                <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {CLUTTER_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`chip chip--sm chip--outlined${mc.clutterLevel === c ? " chip--active" : ""}`}
                      onClick={() =>
                        dispatch({ type: "SET_MOOD_CONFIG", patch: { clutterLevel: c } })
                      }
                    >
                      {c}
                    </button>
                  ))}
                </span>
              </div>

              {/* Window State */}
              <div className="delta-row">
                <span className="delta-row__label">Window State</span>
                <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {WINDOW_OPTIONS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      className={`chip chip--sm chip--outlined${mc.windowState === w ? " chip--active" : ""}`}
                      onClick={() =>
                        dispatch({ type: "SET_MOOD_CONFIG", patch: { windowState: w } })
                      }
                    >
                      {w}
                    </button>
                  ))}
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
                    onClick={handleApply}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="ai-suggest__dismiss"
                    aria-label="Dismiss suggestion"
                    title="Dismiss"
                    onClick={handleDismiss}
                  >
                    ×
                  </button>
                </div>
              )}

              <button
                type="button"
                className="btn btn--primary btn--block"
                onClick={handleGenerateVariation}
                disabled={isGenerating}
              >
                {isGenerating
                  ? `Generating ${activeSource.id} / ${mc.timeOfDay}…`
                  : `Generate Variation for ${activeSource.id} / ${mc.timeOfDay}`}
              </button>
              <button type="button" className="add-link">+ Add another variation for {activeSource.id}</button>
            </div>
          </article>
        </div>
      </div>

      <div className="page-footer">
        <button
          type="button"
          className="btn btn--success"
          onClick={handleApproveAllVariations}
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
