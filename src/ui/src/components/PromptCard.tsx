/**
 * PromptCard — unified prompt editor + gallery control for generated images.
 *
 * See `updates/prompt-gallery-contract.md` §5 for the canonical API. One card
 * represents one entity (anchor/isometric/setup/…): it shows the current
 * preview image, a dropdown of prior versions, an editable prompt textarea,
 * and a Regenerate button. When the user's textarea drifts from what the
 * backend actually used last run, a warning chip offers to reload the last
 * prompt.
 */

import { useMemo, useState } from "react";

export interface GalleryVersion {
  image_id: string;
  uri: string;
  prompt: string;
  created_at: string;
  model?: string;
}

export interface PromptCardProps {
  label: string;
  versions: GalleryVersion[];
  selectedVersionId: string | null;
  onSelectVersion: (id: string) => void;
  prompt: string;
  promptUsed: string | null;
  templateHint?: string;
  onChange: (v: string) => void;
  onRegenerate: () => void;
  busy: boolean;
  disabled?: boolean;
  /** Cache-bust token appended to the preview image URL so it refreshes after regeneration. */
  cacheBust?: number;
  /** Artifact kind (e.g. "anchor") — drives the preview URL. */
  kind: string;
  /** Parent entity id — drives the "latest" preview URL. */
  entityId: string;
  /** Status line shown under the preview (progress, error, idle hint). */
  statusLine?: string;
  /**
   * ✦ Auto-fill — when provided, a button appears next to the textarea that
   * asks the backend to preview the prompt it would send (via
   * `assemble_*_prompt` MCP tools) and overwrites the textarea with it.
   * The page owns the confirm-before-clobber logic so it can track "did the
   * user edit since the last auto-fill?" across Regenerate calls.
   */
  onAutoFill?: () => void;
  /** Disables the ✦ Auto-fill button while its preview tool is in flight. */
  autoFillBusy?: boolean;

  // ─── Edit mode (see updates/edit-mode-contract.md) ───
  /** When true, textarea becomes "what to change" and Regenerate sends edit_mode to the backend. */
  editMode?: boolean;
  /** Toggle handler: page owns the prompt save/restore and base-image resolution. */
  onToggleEditMode?: () => void;
  /** image_id of the version currently serving as the edit base (shown in the label). */
  editBaseId?: string | null;
  /** Called when user clicks the per-version ✎ Edit button — seeds edit mode with that specific version. */
  onEditFromVersion?: (imageId: string) => void;

  /** Render with a collapsible "▼ PROMPT" header row (Figma PromptCard/v2). */
  collapsible?: boolean;
  /** Initial collapsed state when `collapsible`; defaults to `false` (open). */
  defaultCollapsed?: boolean;
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PromptCard(props: PromptCardProps) {
  const {
    label,
    versions,
    selectedVersionId,
    onSelectVersion,
    prompt,
    promptUsed,
    templateHint,
    onChange,
    onRegenerate,
    busy,
    disabled,
    cacheBust,
    kind,
    entityId,
    statusLine,
    onAutoFill,
    autoFillBusy,
    editMode = false,
    onToggleEditMode,
    editBaseId,
    onEditFromVersion,
    collapsible = false,
    defaultCollapsed = false,
  } = props;

  const [collapsed, setCollapsed] = useState<boolean>(collapsible && defaultCollapsed);

  const selected = useMemo(
    () => versions.find((v) => v.image_id === selectedVersionId) ?? versions[0] ?? null,
    [versions, selectedVersionId],
  );

  // Selected == newest → use the stable `/artifacts/{kind}/{entity_id}.png`
  // latest pointer (backend serves latest). For older versions, hit the
  // per-image route `/artifacts/{kind}/v/{image_id}.png`.
  const isNewest = selected != null && versions.length > 0 && selected.image_id === versions[0].image_id;
  const previewSrc = !selected
    ? null
    : isNewest
    ? `/artifacts/${encodeURIComponent(kind)}/${encodeURIComponent(entityId)}.png?v=${cacheBust ?? selected.image_id}`
    : `/artifacts/${encodeURIComponent(kind)}/v/${encodeURIComponent(selected.image_id)}.png`;

  const showWarning =
    promptUsed != null &&
    promptUsed.trim() !== prompt.trim() &&
    prompt.trim().length > 0;

  return (
    <div
      className="prompt-card"
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}
      data-prompt-card={label}
    >
      {/* Collapsible header row (Figma PromptCard/v2 — collapsed state) */}
      {collapsible && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 32,
            fontSize: 11,
            color: "var(--text-muted)",
          }}
          data-prompt-card-header
        >
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-controls={`prompt-card-body-${label}`}
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
            data-prompt-card-toggle={label}
          >
            <span aria-hidden style={{ display: "inline-block", width: 10 }}>
              {collapsed ? "▶" : "▼"}
            </span>
            <span>Prompt</span>
          </button>
          {onToggleEditMode && (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginLeft: 8,
                cursor: busy ? "not-allowed" : "pointer",
              }}
              data-edit-mode-toggle-compact={label}
            >
              <input
                type="checkbox"
                checked={editMode}
                onChange={onToggleEditMode}
                disabled={busy || disabled}
                style={{ margin: 0 }}
              />
              <span>Edit mode{editMode && editBaseId ? ` · ${editBaseId.slice(0, 8)}` : ""}</span>
            </label>
          )}
          <span style={{ flex: 1 }} />
          {collapsed && versions.length > 0 && (
            <span style={{ opacity: 0.7 }}>
              {versions.length} version{versions.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}

      {collapsible && collapsed ? null : (
      <div id={`prompt-card-body-${label}`} style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
      {/* Version dropdown */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {label} — {versions.length} version{versions.length === 1 ? "" : "s"}
        </span>
        <span style={{ flex: 1 }} />
        {versions.length > 0 && (
          <select
            value={selected?.image_id ?? ""}
            onChange={(e) => onSelectVersion(e.target.value)}
            disabled={busy || versions.length <= 1}
            style={{
              fontSize: 11,
              padding: "2px 6px",
              background: "var(--bg-input, rgba(255,255,255,0.04))",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
            }}
            aria-label={`${label} version`}
          >
            {versions.map((v) => (
              <option key={v.image_id} value={v.image_id}>
                {formatTs(v.created_at)}
                {v.model ? ` · ${v.model}` : ""}
              </option>
            ))}
          </select>
        )}
        {onEditFromVersion && selected && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onEditFromVersion(selected.image_id)}
            disabled={busy}
            title="Edit this version — enter edit mode with the selected version as base"
            style={{ fontSize: 11, padding: "2px 6px" }}
            data-edit-from-version={label}
          >
            ✎ Edit
          </button>
        )}
      </div>

      {/* Preview */}
      {previewSrc ? (
        <img
          src={previewSrc}
          alt={`${label} preview`}
          style={{ width: "100%", borderRadius: 8, display: "block", background: "var(--img-placeholder)" }}
        />
      ) : (
        <div className="placeholder-box placeholder-box--tall">{statusLine ?? "No image yet"}</div>
      )}

      {statusLine && previewSrc && (
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{statusLine}</div>
      )}

      {/* Warning chip when the textarea diverges from the last actually-used prompt */}
      {showWarning && (
        <div
          role="status"
          style={{
            padding: "6px 8px",
            borderRadius: 4,
            background: "rgba(255,180,0,0.1)",
            border: "1px solid rgba(255,180,0,0.4)",
            fontSize: 11,
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>Last run used a different prompt.</span>
          <button
            type="button"
            onClick={() => onChange(promptUsed ?? "")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--accent)",
              cursor: "pointer",
              padding: 0,
              fontSize: 11,
              textDecoration: "underline",
            }}
          >
            load previous
          </button>
        </div>
      )}

      {/* Edit mode checkbox (hidden when collapsible — header carries the compact checkbox) */}
      {onToggleEditMode && !collapsible && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "var(--text-muted)",
            cursor: busy ? "not-allowed" : "pointer",
          }}
          data-edit-mode-toggle={label}
        >
          <input
            type="checkbox"
            checked={editMode}
            onChange={onToggleEditMode}
            disabled={busy || disabled}
            style={{ margin: 0 }}
          />
          <span>
            Edit mode
            {editMode && editBaseId && (
              <span style={{ opacity: 0.7 }}> — from {editBaseId.slice(0, 8)}</span>
            )}
          </span>
        </label>
      )}

      {/* Prompt textarea */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {editMode ? "What to change" : "Generation prompt"}
          </label>
          {onAutoFill && !editMode && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onAutoFill}
              disabled={autoFillBusy || busy}
              style={{ fontSize: 11, padding: "2px 8px" }}
              title="Preview the prompt that would be sent to FAL.ai, filled from the Location Bible"
              data-auto-fill={label}
            >
              {autoFillBusy ? "…" : "✦ Auto-fill from Bibles"}
            </button>
          )}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            editMode
              ? "Опишите что изменить… e.g. add golden-hour sunset through window"
              : templateHint ?? "Auto-filled after first generation — edit to customise next run"
          }
          rows={3}
          disabled={busy || disabled}
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

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onRegenerate}
          disabled={busy || disabled || (editMode && prompt.trim().length === 0)}
          title={
            disabled
              ? "Disabled — gate not met"
              : editMode && prompt.trim().length === 0
              ? "Describe what to change"
              : undefined
          }
        >
          {busy ? "Generating…" : editMode ? "Generate Edit" : "Regenerate"}
        </button>
      </div>
      </div>
      )}
    </div>
  );
}
