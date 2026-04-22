/**
 * Stage 3 — Analysis.
 * Mirrors Figma frame "Analysis" (node 429:19).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { callTool, pollTask } from "../api/mcp";
import { usePipeline } from "../state/PipelineContext";
import type { AnalysisState } from "../state/pipeline";

const LOCATION_ID = "loc_001";
const RESEARCH_PACK_URI = `agent://location-scout/research/research_${LOCATION_ID}`;
const BIBLE_URI = `agent://location-scout/bible/${LOCATION_ID}`;

type ToolFeedback =
  | { kind: "idle" }
  | { kind: "loading"; tool: string }
  | { kind: "success"; tool: string; message: string }
  | { kind: "error"; tool: string; message: string };

export function AnalysisPage() {
  const { state, dispatch } = usePipeline();
  const navigate = useNavigate();
  const a = state.analysis;
  const [feedback, setFeedback] = useState<ToolFeedback>({ kind: "idle" });

  /** Normalize an array that may contain strings or objects with label/item/name. */
  const toStringArray = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((v) => {
      if (typeof v === "string") return v;
      if (typeof v === "object" && v !== null) {
        const o = v as Record<string, unknown>;
        return String(o.label ?? o.item ?? o.element ?? o.must_never_appear ?? o.name ?? o.text ?? o.description ?? JSON.stringify(v));
      }
      return String(v);
    });
  };

  /** Map a Location Bible v2 JSON to the UI's AnalysisState shape. */
  const bibleToAnalysis = (b: Record<string, unknown>): Partial<AnalysisState> => {
    const desc = (b.space_description as string) ?? "";

    // atmosphere may be a string or an object with sensory_summary etc.
    const rawAtmo = b.atmosphere;
    let atmo: string;
    if (typeof rawAtmo === "string") {
      atmo = rawAtmo;
    } else if (rawAtmo && typeof rawAtmo === "object") {
      const ao = rawAtmo as Record<string, unknown>;
      atmo = [ao.sensory_summary, ao.sound_texture, ao.tactile_quality, ao.emotional_register]
        .filter(Boolean)
        .join(" ");
    } else {
      atmo = "";
    }

    const light = (b.light_base_state as Record<string, unknown>) ?? {};

    // shadow_hardness may be a long description — extract the first word if it matches
    const rawShadow = String(light.shadow_hardness ?? "").toLowerCase();
    const shadowMatch = (["hard", "soft", "mixed"] as const).find((s) => rawShadow.startsWith(s));

    return {
      spaceDescription: desc,
      atmosphere: atmo,
      wordCount: desc.split(/\s+/).filter(Boolean).length,
      keyDetails: toStringArray(b.key_details),
      negatives: toStringArray(b.negative_list),
      colorTemp: light.color_temp_kelvin ? `${light.color_temp_kelvin}K` : a.colorTemp,
      shadowHardness: shadowMatch ?? a.shadowHardness,
    };
  };

  const briefForCall = () => ({
    location_id: LOCATION_ID,
    location_name: state.brief.locationName,
    location_type: (state.brief.selectedType || "INT") as "INT" | "EXT" | "INT/EXT",
    time_of_day: [state.brief.selectedTimeOfDay || "DAY"],
    era: state.vision.eraStyle,
    scenes: state.brief.scenes,
    recurring: state.brief.scenes.length > 1,
  });

  const handleGenerateBible = async () => {
    setFeedback({ kind: "loading", tool: "write_bible" });
    try {
      const r = await callTool<{ task_id?: string }>("write_bible", {
        location_brief: briefForCall(),
        research_pack_uri: RESEARCH_PACK_URI,
        director_vision: {
          era_style: state.vision.eraStyle,
          palette: state.vision.colorPalette.description,
          atmosphere: state.vision.atmosphere,
          light_vision: state.vision.lightVision,
        },
      });
      console.log("[write_bible] →", r.data);
      const taskId = r.data?.task_id;
      if (!taskId) {
        setFeedback({ kind: "success", tool: "write_bible", message: "Bible request accepted" });
        return;
      }

      setFeedback({
        kind: "loading",
        tool: "write_bible",
      });

      // Poll until task completes
      const final = await pollTask(taskId, (s) => {
        setFeedback({
          kind: "loading",
          tool: "write_bible",
        });
        console.log(`[write_bible] poll: ${s.current_step} (${Math.round(s.progress * 100)}%)`);
      });

      if (final.status === "failed") {
        setFeedback({ kind: "error", tool: "write_bible", message: final.error ?? "Bible generation failed" });
        return;
      }

      // Fetch the generated Bible and update state
      const bible = await callTool<Record<string, unknown>>("get_bible", { bible_id: LOCATION_ID });
      if (bible.data && !("error" in bible.data)) {
        dispatch({ type: "SET_ANALYSIS", patch: bibleToAnalysis(bible.data) });
        setFeedback({ kind: "success", tool: "write_bible", message: "Bible generated — data updated" });
      } else {
        setFeedback({ kind: "error", tool: "write_bible", message: "Bible saved but could not be loaded" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[write_bible] failed:", err);
      setFeedback({ kind: "error", tool: "write_bible", message: msg });
    }
  };

  const handleValidate = async () => {
    setFeedback({ kind: "loading", tool: "check_era_accuracy" });
    try {
      const r = await callTool<{ passed?: boolean; issues?: unknown[] }>(
        "check_era_accuracy",
        { bible_uri: BIBLE_URI, research_pack_uri: RESEARCH_PACK_URI },
      );
      console.log("[check_era_accuracy] →", r.data);
      const issues = Array.isArray(r.data?.issues) ? r.data!.issues! : [];
      const passed = r.data?.passed === true || issues.length === 0;
      setFeedback({
        kind: passed ? "success" : "error",
        tool: "check_era_accuracy",
        message: passed
          ? `Era validation passed — no anachronisms found`
          : `${issues.length} issue${issues.length === 1 ? "" : "s"} found`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[check_era_accuracy] failed:", err);
      setFeedback({ kind: "error", tool: "check_era_accuracy", message: msg });
    }
  };

  const isBusy = feedback.kind === "loading";

  const handleApprove = async () => {
    dispatch({ type: "APPROVE_STAGE", stage: "analysis" });
    try {
      const r = await callTool("approve_artifact", {
        artifact_uri: BIBLE_URI,
        notes: "Approved from Analysis UI — Bible First gate",
      });
      console.log("[approve_artifact bible] →", r.data);
    } catch (err) {
      console.error("[approve_artifact bible] failed:", err);
    }
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
                <span className="field__label" style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center" }}>
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
            <div className="card__body" style={{ gap: "var(--sp-3)" }}>
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

              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--sp-1)" }}>
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
        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleGenerateBible}
          disabled={isBusy}
        >
          {feedback.kind === "loading" && feedback.tool === "write_bible"
            ? "Generating…"
            : "Generate Bible"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleValidate}
          disabled={isBusy}
        >
          {feedback.kind === "loading" && feedback.tool === "check_era_accuracy"
            ? "Validating…"
            : "Validate"}
        </button>

        {feedback.kind !== "idle" && (
          <div
            role="status"
            aria-live="polite"
            style={{
              flex: 1,
              marginLeft: "var(--sp-3)",
              marginRight: "var(--sp-3)",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background:
                feedback.kind === "error"
                  ? "rgba(220,60,60,0.08)"
                  : feedback.kind === "success"
                  ? "rgba(60,200,120,0.08)"
                  : "rgba(255,255,255,0.04)",
              border: `1px solid ${
                feedback.kind === "error"
                  ? "rgba(220,60,60,0.4)"
                  : feedback.kind === "success"
                  ? "rgba(60,200,120,0.4)"
                  : "rgba(255,255,255,0.1)"
              }`,
            }}
          >
            <span aria-hidden>
              {feedback.kind === "loading" ? "⏳" : feedback.kind === "success" ? "✓" : "✗"}
            </span>
            <span>
              {feedback.kind === "loading"
                ? `Calling ${feedback.tool}…`
                : feedback.message}
            </span>
            {feedback.kind !== "loading" && (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setFeedback({ kind: "idle" })}
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 16,
                  padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}

        <span className="page-footer__spacer" />
        <button type="button" className="btn btn--primary" onClick={handleApprove} disabled={isBusy}>
          Approve Bible
          <span className="btn__arrow" aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}
