/**
 * Stage 1 — Input Page.
 * Mirrors Figma frame "Input Page" (node 306:2).
 *
 * Two independently editable cards:
 *   - Location Brief (Hard Constraints): quotes, description, chip groups
 *   - Director Vision (Soft Constraints): text fields, color swatches, reference films
 *
 * Each card has its own Edit → Done/Cancel flow with a snapshot-based revert.
 * Clicking a swatch in edit mode opens a color picker popover with hex input.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { callTool, pollTask, type TaskStatus } from "../api/mcp";
import { usePipeline } from "../state/PipelineContext";
import type { DirectorVision, LocationBrief } from "../state/pipeline";

// Stable IDs for the demo session — Phase 5 wiring uses fixed values so the
// backend can be exercised without persistent project state.
const PROJECT_ID = "demo-project";
const LOCATION_ID = "loc_001";

type BriefListField = "scenes" | "props" | "entryExit" | "generationFlags";

export function InputPage() {
  const { state, dispatch } = usePipeline();
  const navigate = useNavigate();
  const brief = state.brief;
  const vision = state.vision;

  // Anchor for the Type/Time-of-day row + flash feedback when the user
  // tries to advance without making the required selections.
  const passportRef = useRef<HTMLDivElement | null>(null);
  const [flashSelections, setFlashSelections] = useState(false);

  // Async progress state for the Start Research pipeline call.
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const isRunning = taskStatus !== null && taskStatus.status !== "completed" && taskStatus.status !== "failed";

  // ──────────── Location Brief edit state ────────────
  const [editingBrief, setEditingBrief] = useState(false);
  const [briefSnapshot, setBriefSnapshot] = useState<LocationBrief | null>(null);
  const [briefAdders, setBriefAdders] = useState<Record<BriefListField, string>>({
    scenes: "",
    props: "",
    entryExit: "",
    generationFlags: "",
  });

  const isStartReady = !!brief.selectedType && !!brief.selectedTimeOfDay;

  const handleStart = async () => {
    if (!isStartReady) {
      // Bring the Type/TOD row into view and flash all chips for 1s
      passportRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashSelections(true);
      window.setTimeout(() => setFlashSelections(false), 1000);
      return;
    }

    // Phase 5: fire scout_location → poll get_task_status until the backend
    // pipeline reaches a terminal state. Only navigate on successful completion.
    setTaskError(null);
    setTaskStatus({
      task_id: "",
      status: "accepted",
      progress: 0,
      current_step: "Submitting to Location Scout…",
    });

    try {
      const result = await callTool<{ task_id: string; location_id: string }>(
        "scout_location",
        {
          project_id: PROJECT_ID,
          location_brief: {
            location_id: LOCATION_ID,
            location_name: brief.locationName,
            location_type: brief.selectedType as "INT" | "EXT" | "INT/EXT",
            time_of_day: [brief.selectedTimeOfDay],
            era: vision.eraStyle,
            scenes: brief.scenes,
            recurring: brief.scenes.length > 1,
            props_mentioned: brief.props,
            explicit_details: brief.entryExit,
            required_practicals: brief.generationFlags,
          },
          director_vision: {
            era_style: vision.eraStyle,
            palette: vision.colorPalette.description,
            spatial_philosophy: vision.spatialPhilosophy,
            atmosphere: vision.atmosphere,
            light_vision: vision.lightVision,
            reference_films: vision.referenceFilms,
          },
          priority: "normal",
        },
      );

      const taskId = result.data?.task_id;
      console.log("[scout_location] task_id=", taskId);
      if (!taskId) {
        throw new Error("scout_location returned no task_id");
      }

      const final = await pollTask(taskId, (s) => setTaskStatus(s), 800, 180000);
      console.log("[scout_location] final status=", final);

      if (final.status === "failed") {
        setTaskError(final.error || "Pipeline failed without an error message");
        return; // do not navigate
      }

      // Success — unlock the next stage and navigate.
      dispatch({ type: "APPROVE_STAGE", stage: "input" });
      navigate("/research");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[scout_location] failed:", err);
      setTaskError(msg);
    }
  };

  const handleRetry = () => {
    setTaskError(null);
    setTaskStatus(null);
  };

  const enterBriefEdit = () => {
    setBriefSnapshot(brief);
    setEditingBrief(true);
  };
  const commitBriefEdit = () => {
    setBriefSnapshot(null);
    setEditingBrief(false);
  };
  const cancelBriefEdit = () => {
    if (briefSnapshot) dispatch({ type: "SET_BRIEF", patch: briefSnapshot });
    setBriefSnapshot(null);
    setBriefAdders({ scenes: "", props: "", entryExit: "", generationFlags: "" });
    setEditingBrief(false);
  };

  const updateQuote = (idx: number, value: string) =>
    dispatch({
      type: "SET_BRIEF",
      patch: { scriptQuotes: brief.scriptQuotes.map((q, i) => (i === idx ? value : q)) },
    });
  const removeQuote = (idx: number) =>
    dispatch({
      type: "SET_BRIEF",
      patch: { scriptQuotes: brief.scriptQuotes.filter((_, i) => i !== idx) },
    });
  const addQuote = () =>
    dispatch({
      type: "SET_BRIEF",
      patch: { scriptQuotes: [...brief.scriptQuotes, ""] },
    });
  const updateShortDesc = (value: string) =>
    dispatch({ type: "SET_BRIEF", patch: { shortDescription: value } });

  const removeBriefItem = (field: BriefListField, idx: number) =>
    dispatch({
      type: "SET_BRIEF",
      patch: { [field]: brief[field].filter((_, i) => i !== idx) },
    });
  const updateBriefItem = (field: BriefListField, idx: number, value: string) =>
    dispatch({
      type: "SET_BRIEF",
      patch: { [field]: brief[field].map((v, i) => (i === idx ? value : v)) },
    });
  const commitBriefAdder = (field: BriefListField) => {
    const value = briefAdders[field].trim();
    if (!value || brief[field].includes(value)) {
      setBriefAdders((a) => ({ ...a, [field]: "" }));
      return;
    }
    dispatch({ type: "SET_BRIEF", patch: { [field]: [...brief[field], value] } });
    setBriefAdders((a) => ({ ...a, [field]: "" }));
  };

  // ──────────── Director Vision edit state ────────────
  const [editingVision, setEditingVision] = useState(false);
  const [visionSnapshot, setVisionSnapshot] = useState<DirectorVision | null>(null);
  const [filmAdder, setFilmAdder] = useState("");
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [pickerDraft, setPickerDraft] = useState("");

  const enterVisionEdit = () => {
    setVisionSnapshot(vision);
    setEditingVision(true);
  };
  const commitVisionEdit = () => {
    setVisionSnapshot(null);
    setEditingVision(false);
    setPickerIndex(null);
  };
  const cancelVisionEdit = () => {
    if (visionSnapshot) dispatch({ type: "SET_VISION", patch: visionSnapshot });
    setVisionSnapshot(null);
    setFilmAdder("");
    setPickerIndex(null);
    setEditingVision(false);
  };

  const updateVisionText = (field: keyof DirectorVision, value: string) =>
    dispatch({ type: "SET_VISION", patch: { [field]: value } });
  const updatePaletteDescription = (value: string) =>
    dispatch({
      type: "SET_VISION",
      patch: { colorPalette: { ...vision.colorPalette, description: value } },
    });

  const updateFilm = (idx: number, value: string) =>
    dispatch({
      type: "SET_VISION",
      patch: { referenceFilms: vision.referenceFilms.map((f, i) => (i === idx ? value : f)) },
    });
  const removeFilm = (idx: number) =>
    dispatch({
      type: "SET_VISION",
      patch: { referenceFilms: vision.referenceFilms.filter((_, i) => i !== idx) },
    });
  const commitFilmAdder = () => {
    const value = filmAdder.trim();
    if (!value || vision.referenceFilms.includes(value)) {
      setFilmAdder("");
      return;
    }
    dispatch({
      type: "SET_VISION",
      patch: { referenceFilms: [...vision.referenceFilms, value] },
    });
    setFilmAdder("");
  };

  // ──────────── Color picker ────────────
  const openPicker = (idx: number) => {
    // Literal hex fallback: the <input type="color"> requires a concrete hex
    // string; can't pass a CSS var here. Matches --img-placeholder.
    setPickerDraft(vision.colorPalette.swatches[idx] ?? "#000000");
    setPickerIndex(idx);
  };
  const closePicker = () => setPickerIndex(null);
  const savePicker = () => {
    if (pickerIndex === null) return;
    const next = [...vision.colorPalette.swatches];
    next[pickerIndex] = pickerDraft;
    dispatch({
      type: "SET_VISION",
      patch: { colorPalette: { ...vision.colorPalette, swatches: next } },
    });
    setPickerIndex(null);
  };

  // Normalize hex input while typing (keep only hex chars + #)
  const onHexInput = (raw: string) => {
    let v = raw.trim();
    if (!v.startsWith("#")) v = "#" + v.replace(/#/g, "");
    v = "#" + v.slice(1).replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    setPickerDraft(v);
  };

  // Esc closes the picker
  useEffect(() => {
    if (pickerIndex === null) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") closePicker();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerIndex]);

  // ──────────── Render helpers ────────────
  const renderBriefChips = (field: BriefListField, variant: "filled" | "accent" = "filled") =>
    brief[field].map((value, i) => {
      const key = `${field}-${i}`;
      if (!editingBrief) {
        return (
          <span key={key} className={`chip chip--${variant}`}>
            {value}
          </span>
        );
      }
      return (
        <span key={key} className={`chip chip--${variant} chip--editable`}>
          <input
            type="text"
            className={`chip__input${variant === "accent" ? " chip__input--accent" : ""}`}
            value={value}
            onChange={(e) => updateBriefItem(field, i, e.target.value)}
            aria-label={`${field} item ${i + 1}`}
          />
          <button
            type="button"
            className="chip__remove"
            aria-label={`Remove ${value || "item"}`}
            onClick={() => removeBriefItem(field, i)}
          >
            ×
          </button>
        </span>
      );
    });

  const renderBriefAdder = (field: BriefListField) =>
    editingBrief && (
      <input
        type="text"
        className="chip-add-input"
        placeholder="+"
        value={briefAdders[field]}
        onChange={(e) => setBriefAdders((a) => ({ ...a, [field]: e.target.value }))}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitBriefAdder(field);
          }
        }}
        onBlur={() => commitBriefAdder(field)}
      />
    );

  const renderFilmChips = () =>
    vision.referenceFilms.map((value, i) => {
      const key = `film-${i}`;
      if (!editingVision) {
        return (
          <span key={key} className="chip chip--filled">
            {value}
          </span>
        );
      }
      return (
        <span key={key} className="chip chip--filled chip--editable">
          <input
            type="text"
            className="chip__input"
            value={value}
            onChange={(e) => updateFilm(i, e.target.value)}
            aria-label={`Reference film ${i + 1}`}
          />
          <button
            type="button"
            className="chip__remove"
            aria-label={`Remove ${value || "film"}`}
            onClick={() => removeFilm(i)}
          >
            ×
          </button>
        </span>
      );
    });

  const renderFilmAdder = () =>
    editingVision && (
      <input
        type="text"
        className="chip-add-input"
        placeholder="+"
        value={filmAdder}
        onChange={(e) => setFilmAdder(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitFilmAdder();
          }
        }}
        onBlur={commitFilmAdder}
      />
    );

  return (
    <div className="input-page" data-figma-node="306:2">
      <div className="input-page__columns">
        {/* ───── Left column: Location Brief ───── */}
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Location Brief</span>
            <span className="section-header__subtitle">Hard Constraints</span>
          </div>

          <article className="card">
            <div className="card__body">
              {/* Location Name (read-only) */}
              <div className="field">
                <span className="field__label">Location Name</span>
                <span className="field__value field__value--heading">
                  {brief.locationName}
                </span>
              </div>

              {/* In-script description */}
              <div className="field">
                <span className="field__label">In-script description</span>
                {editingBrief ? (
                  <>
                    {brief.scriptQuotes.map((q, i) => (
                      <div key={i} className="quote-edit-row">
                        <textarea
                          className="form-textarea form-textarea--italic"
                          value={q}
                          onChange={(e) => updateQuote(i, e.target.value)}
                          rows={2}
                          placeholder="Quote from the script..."
                        />
                        <button
                          type="button"
                          className="chip__remove"
                          aria-label={`Remove quote ${i + 1}`}
                          onClick={() => removeQuote(i)}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button type="button" className="add-link" onClick={addQuote}>
                      + Add quote
                    </button>
                  </>
                ) : (
                  <ul className="field__quote-list">
                    {brief.scriptQuotes.map((q, i) => (
                      <li key={i} className="field__quote">{q}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Short description */}
              <div className="field">
                <span className="field__label">Short description</span>
                {editingBrief ? (
                  <textarea
                    className="form-textarea"
                    value={brief.shortDescription}
                    onChange={(e) => updateShortDesc(e.target.value)}
                    rows={3}
                  />
                ) : (
                  <span className="field__value">{brief.shortDescription}</span>
                )}
              </div>

              {/* Type + Time of day (single-select, always interactive) */}
              <div className="field-row field-row--wide" ref={passportRef}>
                <div className="field">
                  <span className="field__label">Type</span>
                  <div className="chip-group" role="radiogroup" aria-label="Type">
                    {brief.type.map((t) => {
                      const active = brief.selectedType === t;
                      const cls =
                        "chip chip--outlined" +
                        (active ? " chip--active" : "") +
                        (flashSelections && !brief.selectedType ? " chip--flash" : "");
                      return (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={cls}
                          onClick={() => dispatch({ type: "SET_BRIEF_TYPE", value: t })}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="field">
                  <span className="field__label">Time of day</span>
                  <div className="chip-group" role="radiogroup" aria-label="Time of day">
                    {brief.timeOfDay.map((t) => {
                      const active = brief.selectedTimeOfDay === t;
                      const cls =
                        "chip chip--outlined" +
                        (active ? " chip--active" : "") +
                        (flashSelections && !brief.selectedTimeOfDay ? " chip--flash" : "");
                      return (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={cls}
                          onClick={() => dispatch({ type: "SET_BRIEF_TIME_OF_DAY", value: t })}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Scenes + Props */}
              <div className="field-row">
                <div className="field">
                  <span className="field__label">
                    Scenes <span className="sublabel">Recurring</span>
                  </span>
                  <div className="chip-group">
                    {renderBriefChips("scenes")}
                    {renderBriefAdder("scenes")}
                  </div>
                </div>
                <div className="field">
                  <span className="field__label">Props mentioned</span>
                  <div className="chip-group">
                    {renderBriefChips("props")}
                    {renderBriefAdder("props")}
                  </div>
                </div>
              </div>

              {/* Entry/exit + Generation flags */}
              <div className="field-row">
                <div className="field">
                  <span className="field__label">Entry/exit points</span>
                  <div className="chip-group">
                    {renderBriefChips("entryExit")}
                    {renderBriefAdder("entryExit")}
                  </div>
                </div>
                <div className="field">
                  <span className="field__label">Generation flags</span>
                  <div className="chip-group">
                    {renderBriefChips("generationFlags", "accent")}
                    {renderBriefAdder("generationFlags")}
                  </div>
                </div>
              </div>

              <div className="edit-actions">
                {editingBrief ? (
                  <>
                    <button type="button" className="btn btn--primary" onClick={commitBriefEdit}>
                      Done
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={cancelBriefEdit}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn--ghost" onClick={enterBriefEdit}>
                    Edit
                  </button>
                )}
              </div>
            </div>
          </article>
        </div>

        {/* ───── Right column: Director Vision ───── */}
        <div className="input-page__column">
          <div className="section-header">
            <span className="section-header__title">Director Vision</span>
            <span className="section-header__subtitle">Soft Constraints</span>
          </div>

          <article className="card">
            <div className="card__body">
              {/* Era & style */}
              <div className="field">
                <span className="field__label">Era &amp; style</span>
                {editingVision ? (
                  <textarea
                    className="form-textarea"
                    value={vision.eraStyle}
                    onChange={(e) => updateVisionText("eraStyle", e.target.value)}
                    rows={2}
                  />
                ) : (
                  <span className="field__value">{vision.eraStyle}</span>
                )}
              </div>

              {/* Color palette / Mood */}
              <div className="field">
                <span className="field__label">Color palette / Mood</span>
                {editingVision ? (
                  <textarea
                    className="form-textarea"
                    value={vision.colorPalette.description}
                    onChange={(e) => updatePaletteDescription(e.target.value)}
                    rows={2}
                  />
                ) : (
                  <span className="field__value">{vision.colorPalette.description}</span>
                )}
                <div className="swatch-row" aria-label="Color swatches">
                  {vision.colorPalette.swatches.map((hex, i) => {
                    const isActive = editingVision && pickerIndex === i;
                    const className =
                      "swatch" +
                      (editingVision ? " swatch--editable" : "") +
                      (isActive ? " swatch--active" : "");
                    return (
                      <button
                        key={i}
                        type="button"
                        className={className}
                        style={{ background: hex }}
                        title={hex}
                        disabled={!editingVision}
                        aria-label={`Edit swatch ${i + 1} (${hex})`}
                        onClick={() => editingVision && openPicker(i)}
                      />
                    );
                  })}
                  {pickerIndex !== null && (
                    <div className="color-picker" role="dialog" aria-label="Color picker">
                      <div className="color-picker__row">
                        <input
                          type="color"
                          className="color-picker__native"
                          // Literal hex: the native color input needs a valid
                          // hex string, not a CSS var. Matches --img-placeholder.
                          value={
                            /^#[0-9a-fA-F]{6}$/.test(pickerDraft) ? pickerDraft : "#000000"
                          }
                          onChange={(e) => setPickerDraft(e.target.value)}
                          aria-label="Color picker"
                        />
                        <input
                          type="text"
                          className="form-input color-picker__hex"
                          value={pickerDraft}
                          onChange={(e) => onHexInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") savePicker();
                            if (e.key === "Escape") closePicker();
                          }}
                          placeholder="#RRGGBB"
                          spellCheck={false}
                          autoFocus
                        />
                      </div>
                      <div className="color-picker__actions">
                        <button type="button" className="btn btn--ghost" onClick={closePicker}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={savePicker}
                          disabled={!/^#[0-9a-fA-F]{6}$/.test(pickerDraft)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Spatial philosophy */}
              <div className="field">
                <span className="field__label">Spatial philosophy</span>
                {editingVision ? (
                  <textarea
                    className="form-textarea"
                    value={vision.spatialPhilosophy}
                    onChange={(e) => updateVisionText("spatialPhilosophy", e.target.value)}
                    rows={3}
                  />
                ) : (
                  <span className="field__value">{vision.spatialPhilosophy}</span>
                )}
              </div>

              {/* Atmosphere */}
              <div className="field">
                <span className="field__label">Atmosphere</span>
                {editingVision ? (
                  <textarea
                    className="form-textarea"
                    value={vision.atmosphere}
                    onChange={(e) => updateVisionText("atmosphere", e.target.value)}
                    rows={3}
                  />
                ) : (
                  <span className="field__value">{vision.atmosphere}</span>
                )}
              </div>

              {/* Light vision */}
              <div className="field">
                <span className="field__label">Light vision</span>
                {editingVision ? (
                  <textarea
                    className="form-textarea"
                    value={vision.lightVision}
                    onChange={(e) => updateVisionText("lightVision", e.target.value)}
                    rows={3}
                  />
                ) : (
                  <span className="field__value">{vision.lightVision}</span>
                )}
              </div>

              {/* Reference films */}
              <div className="field">
                <span className="field__label">Reference films</span>
                <div className="chip-group">
                  {renderFilmChips()}
                  {renderFilmAdder()}
                </div>
              </div>

              <div className="edit-actions">
                {editingVision ? (
                  <>
                    <button type="button" className="btn btn--primary" onClick={commitVisionEdit}>
                      Done
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={cancelVisionEdit}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn--ghost" onClick={enterVisionEdit}>
                    Edit
                  </button>
                )}
              </div>
            </div>
          </article>
        </div>
      </div>

      <div className="input-page__footer">
        {/* Progress / error feedback while the backend pipeline runs */}
        {(taskStatus || taskError) && (
          <div
            role="status"
            aria-live="polite"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "10px 14px",
              borderRadius: 8,
              background: taskError ? "rgba(220, 60, 60, 0.08)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${taskError ? "rgba(220,60,60,0.4)" : "rgba(255,255,255,0.1)"}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span aria-hidden>{taskError ? "✗" : isRunning ? "⏳" : "✓"}</span>
              <span>
                {taskError
                  ? `Failed: ${taskError}`
                  : taskStatus?.current_step || "Working…"}
              </span>
              {!taskError && taskStatus && (
                <span style={{ marginLeft: "auto", opacity: 0.7 }}>
                  {Math.round((taskStatus.progress ?? 0) * 100)}%
                </span>
              )}
            </div>
            {!taskError && taskStatus && (
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.round((taskStatus.progress ?? 0) * 100)}%`,
                    height: "100%",
                    background: "var(--accent)",
                    transition: "width 200ms ease",
                  }}
                />
              </div>
            )}
          </div>
        )}

        {taskError ? (
          <button type="button" className="btn btn--ghost" onClick={handleRetry}>
            Try again
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleStart}
            disabled={isRunning}
            aria-disabled={!isStartReady || isRunning}
            title={
              !isStartReady
                ? "Select a Type and a Time of day to continue"
                : isRunning
                ? "Pipeline is running — please wait"
                : undefined
            }
          >
            {isRunning ? "Researching…" : "Start Research"}
            {!isRunning && <span className="btn__arrow" aria-hidden>→</span>}
          </button>
        )}
      </div>
    </div>
  );
}
