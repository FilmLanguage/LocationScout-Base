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

import { useMemo } from "react";

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
  } = props;

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

      {/* Prompt textarea */}
      <div>
        <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
          Generation prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => onChange(e.target.value)}
          placeholder={templateHint ?? "Auto-filled after first generation — edit to customise next run"}
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
          disabled={busy || disabled}
          title={disabled ? "Disabled — gate not met" : undefined}
        >
          {busy ? "Generating…" : "Regenerate"}
        </button>
      </div>
    </div>
  );
}
