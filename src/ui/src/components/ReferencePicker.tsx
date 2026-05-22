/**
 * ReferencePicker — horizontal row of attached refs + Upload tile + Gallery button.
 *
 * See updates/reference-images-contract.md §3, §5.
 *
 * Wire pattern:
 *   <ReferencePicker
 *     entity_id={LOCATION_ID}
 *     value={refs}
 *     onChange={setRefs}
 *     autoCascadeHint={["isometric (auto)"]}
 *   />
 *
 * Uploads go through the `upload_reference` MCP tool which saves to the
 * user-ref gallery; the next gallery-modal open lists them alongside any
 * previously-uploaded refs so the user can re-use them on other generations.
 */

import { useCallback, useEffect, useState } from "react";
import { callTool } from "../api/mcp";
import { useProjectContext, buildArtifactUrl } from "../hooks/useProjectContext";

export type ReferenceKind =
  | "face_anchor"
  | "body_anchor"
  | "model_sheet"
  | "anchor"
  | "isometric"
  | "setup"
  | "style_reference"
  | "shot"
  | "end_frame"
  | "user_upload"
  | "external";

export type ReferenceSourceAgent =
  | "location-scout"
  | "casting-director"
  | "shot-generation"
  | "art-director"
  | "user";

export interface ReferenceRef {
  image_id: string;
  uri: string;
  kind: ReferenceKind;
  source_agent: ReferenceSourceAgent;
  prompt?: string;
  entity_id?: string;
  role?: string;
}

/**
 * Locked auto-ref resolved from the cascade parent. Rendered as a real 90×90
 * thumbnail with a 🔒 badge and tooltip. Cannot be removed by the user —
 * toggle off auto-resolve upstream to drop it from the picker.
 */
export interface LockedAutoRef {
  /** Label of the cascade parent (e.g. "floorplan", "isometric", "anchor"). */
  parentLabel: string;
  /** Image URL to display in the thumbnail (usually /artifacts/{kind}/{entity}.png). */
  imageUrl: string;
  /** Kind of the parent artifact — used for the bottom-left type badge. */
  kind: ReferenceKind;
}

export interface ReferencePickerProps {
  entity_id: string;
  value: ReferenceRef[];
  onChange: (refs: ReferenceRef[]) => void;
  /**
   * Locked auto-refs from the cascade parent. Shown before user-attached refs
   * with a 🔒 badge; user cannot remove these from the picker directly.
   */
  lockedAutoRefs?: LockedAutoRef[];
  /** Short labels shown as dimmed tiles when no resolved image is available yet (legacy hint). */
  autoCascadeHint?: string[];
  /** Label shown in the header; defaults to "Reference images". */
  label?: string;
  disabled?: boolean;
  /**
   * Optional location-bible id, used by the gallery modal to fetch anchor +
   * isometric versions keyed by the bible (not the local entity_id). For setup
   * pickers, entity_id is the setup id (e.g. `S1-A`) — without bible_id the
   * Location gallery tab would query for anchors keyed by `S1-A` and come back
   * empty.
   */
  bible_id?: string;
  /** Setup ids whose generated images should appear in the Location gallery tab. */
  setup_ids?: string[];
}

interface SidecarVersion {
  image_id: string;
  uri: string;
  kind: string;
  entity_id: string;
  prompt: string;
  created_at: string;
  source_tool?: string;
}

interface LocationGalleryResponse {
  bible_id: string;
  anchor: SidecarVersion[];
  isometric: SidecarVersion[];
  setup: Record<string, SidecarVersion[]>;
}

interface UserRefResponse {
  entity_id: string;
  refs: SidecarVersion[];
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sidecarToRef(v: SidecarVersion): ReferenceRef {
  const kind = (v.kind === "user-ref" ? "user_upload" : v.kind) as ReferenceKind;
  return {
    image_id: v.image_id,
    uri: v.uri,
    kind,
    source_agent: "location-scout",
    entity_id: v.entity_id,
    ...(v.prompt ? { prompt: v.prompt } : {}),
  };
}

function previewUrl(ref: ReferenceRef, projectId: string): string {
  if (ref.uri.startsWith("data:") || ref.uri.startsWith("http")) return ref.uri;
  const kindPath = ref.kind === "user_upload" ? "user-ref" : ref.kind;
  // Fix A L4: route through buildArtifactUrl so the backend HTTP route
  // can scope the lookup by project_id. Bare /artifacts/<kind>/v/<id>.png
  // collapsed every project to the same storage slot (invest-b B3).
  return buildArtifactUrl(kindPath, `v/${encodeURIComponent(ref.image_id)}.png`, projectId);
}

function kindBadge(kind: ReferenceKind): string {
  switch (kind) {
    case "user_upload": return "upload";
    case "isometric": return "iso";
    case "anchor": return "anchor";
    case "setup": return "setup";
    case "face_anchor": return "face";
    case "body_anchor": return "body";
    case "model_sheet": return "sheet";
    default: return kind;
  }
}

function Thumbnail({
  refData,
  onRemove,
  disabled,
  projectId,
}: {
  // BETA: prop renamed from `ref` to `refData` — `ref` is reserved by React and
  // gets stripped from props (silent crash on access). See ROLLOUT.md.
  refData: ReferenceRef;
  onRemove: () => void;
  disabled?: boolean;
  /** Fix A L4: project namespace marker threaded into previewUrl so the
   *  /artifacts route can scope the backend lookup. */
  projectId: string;
}) {
  return (
    <div
      title={refData.prompt ?? `${refData.kind} · ${refData.source_agent}`}
      style={{
        width: 90,
        height: 90,
        position: "relative",
        borderRadius: 6,
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--border)",
        flex: "0 0 auto",
      }}
    >
      <img
        src={previewUrl(refData, projectId)}
        alt={refData.kind}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      <span
        style={{
          position: "absolute",
          bottom: 2,
          left: 2,
          fontSize: 9,
          padding: "1px 4px",
          borderRadius: 3,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          textTransform: "uppercase",
          letterSpacing: 0.3,
        }}
      >
        {kindBadge(refData.kind)}
      </span>
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove reference"
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: "none",
            background: "rgba(0,0,0,0.65)",
            color: "#fff",
            fontSize: 11,
            lineHeight: "18px",
            cursor: "pointer",
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function LockedThumbnail({ refData }: { refData: LockedAutoRef }) {
  // BETA: prop renamed from `ref` (reserved by React). See ROLLOUT.md.
  const tooltip = `Auto-resolved from ${refData.parentLabel}. Toggle off auto-resolve to remove.`;
  return (
    <div
      title={tooltip}
      data-locked-auto-ref={refData.parentLabel}
      style={{
        width: 90,
        height: 90,
        position: "relative",
        borderRadius: 6,
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--border)",
        flex: "0 0 auto",
      }}
    >
      <img
        src={refData.imageUrl}
        alt={`${refData.parentLabel} (locked auto-ref)`}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      <span
        style={{
          position: "absolute",
          bottom: 2,
          left: 2,
          fontSize: 9,
          padding: "1px 4px",
          borderRadius: 3,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          textTransform: "uppercase",
          letterSpacing: 0.3,
        }}
      >
        {kindBadge(refData.kind)}
      </span>
      {/* 🔒 locked badge — replaces the × close button used by user refs */}
      <span
        aria-label="Locked auto-reference"
        style={{
          position: "absolute",
          top: 2,
          right: 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.65)",
          color: "#fff",
          fontSize: 10,
          lineHeight: "18px",
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        🔒
      </span>
    </div>
  );
}

function AutoHintTile({ label }: { label: string }) {
  return (
    <div
      title={`Auto-resolved: ${label}`}
      style={{
        width: 90,
        height: 90,
        borderRadius: 6,
        border: "1px dashed var(--border)",
        background: "rgba(255,255,255,0.03)",
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontSize: 10,
        padding: 4,
        flex: "0 0 auto",
        opacity: 0.65,
      }}
    >
      {label}
    </div>
  );
}

function UploadTile({
  onFile,
  busy,
  disabled,
}: {
  onFile: (file: File) => void;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        width: 90,
        height: 90,
        borderRadius: 6,
        border: "1px dashed var(--border)",
        background: "rgba(255,255,255,0.03)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        color: "var(--text-muted)",
        cursor: disabled || busy ? "not-allowed" : "pointer",
        flex: "0 0 auto",
        flexDirection: "column",
        gap: 4,
      }}
      data-ref-upload
    >
      <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
        {busy ? "…" : "+"}
      </span>
      <span>{busy ? "Uploading" : "Upload"}</span>
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        disabled={disabled || busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          // Reset so picking the same file twice re-triggers onChange.
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}

function GalleryButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 90,
        height: 90,
        borderRadius: 6,
        border: "1px dashed var(--border)",
        background: "rgba(255,255,255,0.03)",
        color: "var(--text-muted)",
        fontSize: 11,
        cursor: disabled ? "not-allowed" : "pointer",
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
      }}
      data-ref-gallery
    >
      <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden>□</span>
      <span>Gallery</span>
    </button>
  );
}

function GalleryModal({
  entity_id,
  bible_id,
  setup_ids,
  currentRefs,
  onPick,
  onClose,
  projectId,
}: {
  entity_id: string;
  bible_id: string;
  setup_ids?: string[];
  currentRefs: ReferenceRef[];
  onPick: (ref: ReferenceRef) => void;
  onClose: () => void;
  /** Fix A L4: threaded into previewUrl for the modal's gallery grid. */
  projectId: string;
}) {
  const [tab, setTab] = useState<"user" | "location">("user");
  const [userRefs, setUserRefs] = useState<SidecarVersion[]>([]);
  const [locRefs, setLocRefs] = useState<LocationGalleryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const setupIdsKey = (setup_ids ?? []).join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [userResp, locResp] = await Promise.all([
          callTool<UserRefResponse>("list_user_references", { entity_id }),
          callTool<LocationGalleryResponse>("list_location_images", {
            bible_id,
            ...(setup_ids && setup_ids.length > 0 ? { setup_ids } : {}),
          }),
        ]);
        if (cancelled) return;
        setUserRefs(userResp.data?.refs ?? []);
        setLocRefs(locResp.data ?? null);
      } catch (err) {
        console.warn("[GalleryModal] fetch failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entity_id, bible_id, setupIdsKey]);

  const activeIds = new Set(currentRefs.map((r) => r.image_id));

  const renderGrid = (items: SidecarVersion[]) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
        gap: 8,
      }}
    >
      {items.length === 0 && (
        <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--text-muted)", padding: 16, textAlign: "center" }}>
          No images yet.
        </div>
      )}
      {items.map((v) => {
        const already = activeIds.has(v.image_id);
        return (
          <button
            type="button"
            key={v.image_id}
            disabled={already}
            onClick={() => onPick(sidecarToRef(v))}
            title={v.prompt || `${v.kind} · ${v.created_at}`}
            style={{
              padding: 0,
              border: already ? "2px solid var(--accent)" : "1px solid var(--border)",
              borderRadius: 6,
              overflow: "hidden",
              background: "var(--border)",
              cursor: already ? "default" : "pointer",
              opacity: already ? 0.55 : 1,
            }}
          >
            <img
              src={previewUrl(sidecarToRef(v), projectId)}
              alt={v.kind}
              style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }}
            />
            <div style={{ fontSize: 10, padding: "3px 4px", color: "var(--text-muted)", textAlign: "left" }}>
              {v.kind} · {new Date(v.created_at).toLocaleDateString()}
            </div>
          </button>
        );
      })}
    </div>
  );

  // Defensive: backend may return partial shapes — including non-array
  // values when listVersions partially fails (e.g. s3 access denied → field
  // becomes a string error envelope instead of []). Coerce every field to a
  // real array before spreading so the modal never crashes the React tree
  // with `is not iterable`.
  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const setupBuckets = locRefs && locRefs.setup && typeof locRefs.setup === "object"
    ? Object.values(locRefs.setup)
    : [];
  const locationItems: SidecarVersion[] = locRefs
    ? [
      ...asArray<SidecarVersion>(locRefs.anchor),
      ...asArray<SidecarVersion>(locRefs.isometric),
      ...setupBuckets.flatMap((v) => asArray<SidecarVersion>(v)),
    ]
    : [];

  return (
    <div
      role="dialog"
      aria-label="Reference gallery"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          // Use the lighter `--surface` so the modal stands out from the
          // dimmed `--bg` page underneath; previous styling used `--bg` for
          // both, making the modal indistinguishable from the backdrop
          // (looked like a fully-black screen).
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border-accent)",
          borderRadius: 8,
          width: "min(720px, 92vw)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          padding: 16,
          gap: 12,
          boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
        }}
        data-gallery-modal
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 13 }}>Pick reference</strong>
          <div style={{ display: "flex", gap: 4, marginLeft: 12 }}>
            <button
              type="button"
              onClick={() => setTab("user")}
              className={`btn btn--sm ${tab === "user" ? "btn--primary" : "btn--ghost"}`}
            >
              My uploads ({userRefs.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("location")}
              className={`btn btn--sm ${tab === "location" ? "btn--primary" : "btn--ghost"}`}
            >
              Location gallery ({locationItems.length})
            </button>
          </div>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              padding: 0,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Design System X icon — Figma node 2199:149. */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect x="0.5" y="0.5" width="27" height="27" rx="5.5" stroke="#2B2E31" />
              <path
                d="M16.544 17.392L14 14.784L11.456 17.392L10.672 16.608L13.216 14L10.672 11.392L11.456 10.608L14 13.216L16.544 10.608L17.328 11.392L14.784 14L17.328 16.608L16.544 17.392Z"
                fill="#A1A6AA"
              />
            </svg>
          </button>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
          ) : tab === "user" ? (
            renderGrid(userRefs)
          ) : (
            renderGrid(locationItems)
          )}
        </div>
      </div>
    </div>
  );
}

export function ReferencePicker({
  entity_id,
  value,
  onChange,
  lockedAutoRefs,
  autoCascadeHint,
  label = "Reference images",
  disabled,
  bible_id,
  setup_ids,
}: ReferencePickerProps) {
  const [uploading, setUploading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Fix A L4: project namespace for every <img src=> built by Thumbnail or
  // the gallery modal. Without this, `/artifacts/<kind>/v/<image_id>.png`
  // hits the backend without ?project_id= and the lookup falls back to the
  // legacy un-namespaced slot, which leaks cross-project bytes (invest-b B3).
  const { projectId } = useProjectContext();
  // Fall back to entity_id only when caller didn't supply a real bible_id.
  // This keeps the Location gallery useful for non-setup callers (anchor/iso
  // pickers already pass the bible id as entity_id).
  const resolvedBibleId = bible_id ?? entity_id;

  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const b64 = await fileToBase64(file);
        const { data } = await callTool<ReferenceRef>("upload_reference", {
          entity_id,
          base64_data: b64,
          content_type: file.type || "image/png",
          note: `uploaded ${file.name}`,
        });
        if (data && data.image_id) {
          onChange([...value, data]);
        }
      } catch (err) {
        console.warn("[ReferencePicker] upload failed:", err);
      } finally {
        setUploading(false);
      }
    },
    [entity_id, value, onChange],
  );

  const handleRemove = useCallback(
    (idx: number) => {
      onChange(value.filter((_, i) => i !== idx));
    },
    [value, onChange],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-reference-picker={entity_id}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
        <span>{label}</span>
        <span style={{ opacity: 0.5 }}>
          · {value.length + (lockedAutoRefs?.length ?? 0) + (autoCascadeHint?.length ?? 0)} attached
          {lockedAutoRefs && lockedAutoRefs.length > 0 ? ` (${lockedAutoRefs.length} 🔒 auto)` : ""}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
        {lockedAutoRefs?.map((r, i) => (
          <LockedThumbnail key={`locked-${r.parentLabel}-${i}`} refData={r} />
        ))}
        {autoCascadeHint?.map((hint) => <AutoHintTile key={`hint-${hint}`} label={hint} />)}
        {value.map((ref, i) => (
          <Thumbnail
            key={`${ref.image_id}-${i}`}
            refData={ref}
            onRemove={() => handleRemove(i)}
            disabled={disabled}
            projectId={projectId}
          />
        ))}
        <UploadTile onFile={handleFile} busy={uploading} disabled={disabled} />
        <GalleryButton onClick={() => setGalleryOpen(true)} disabled={disabled} />
      </div>
      {galleryOpen && (
        <GalleryModal
          entity_id={entity_id}
          bible_id={resolvedBibleId}
          setup_ids={setup_ids}
          currentRefs={value}
          onPick={(ref) => {
            if (!value.some((v) => v.image_id === ref.image_id)) {
              onChange([...value, ref]);
            }
          }}
          onClose={() => setGalleryOpen(false)}
          projectId={projectId}
        />
      )}
    </div>
  );
}
