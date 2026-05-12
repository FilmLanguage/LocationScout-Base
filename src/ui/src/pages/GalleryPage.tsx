/**
 * Gallery — location-level view of every saved image, plus a drag-and-drop
 * upload affordance. Backed by the `list_gallery` MCP tool (which uses
 * SidecarEntry → GalleryItem via attributedLocationId) and the
 * `upload_reference` tool with entity_id=location_id for location-scoped
 * uploads.
 *
 * Tabs by kind:
 *   - All
 *   - Generated (anchor + floorplan + isometric + setup + mood_variation)
 *   - Uploaded (user-ref)
 *
 * Mirrors the "Uploaded" section pattern from ShotGeneration's GalleryTab,
 * but scoped per-location (not per-shot / per-entity).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { callTool } from "../api/mcp";
import { ImageOverlay } from "../components/ImageOverlay";

const LOCATION_ID = "loc_001"; // BETA: same hard-code as the rest of the pipeline (see ReferencesPage)

type Kind = "anchor" | "floorplan" | "isometric" | "setup" | "mood_variation" | "user-ref";

interface GalleryItem {
  image_id: string;
  kind: Kind;
  entity_id: string;
  location_id: string;
  prompt: string;
  model: string;
  created_at: string;
  uri: string;
  http_path: string;
  source_tool?: string;
  source_task_id?: string;
  negative_prompt?: string;
  seed?: number;
  parent_version_id?: string;
}

interface ListGalleryResult {
  location_id: string;
  items: GalleryItem[];
  next_cursor?: string;
}

type Tab = "all" | "generated" | "uploaded";

const GENERATED_KINDS: Kind[] = ["anchor", "floorplan", "isometric", "setup", "mood_variation"];

function fileToBase64(file: File): Promise<string> {
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

export function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [latestOnly, setLatestOnly] = useState(true);
  const [overlaySrc, setOverlaySrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await callTool<ListGalleryResult>("list_gallery", {
        location_id: LOCATION_ID,
        latest_only: latestOnly,
        limit: 100,
      });
      setItems(data?.items ?? []);
    } catch (err) {
      console.warn("[GalleryPage] list_gallery failed:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [latestOnly]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are supported.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const b64 = await fileToBase64(file);
      await callTool("upload_reference", {
        kind: "user_upload",
        entity_id: LOCATION_ID,
        location_id: LOCATION_ID,
        base64_data: b64,
        content_type: file.type || "image/png",
        note: file.name,
      });
      await refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }, [refresh]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    for (const f of files) await handleFile(f);
  }, [handleFile]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filtered = items.filter((i) => {
    if (tab === "all") return true;
    if (tab === "uploaded") return i.kind === "user-ref";
    return GENERATED_KINDS.includes(i.kind);
  });

  const counts = {
    all: items.length,
    generated: items.filter((i) => GENERATED_KINDS.includes(i.kind)).length,
    uploaded: items.filter((i) => i.kind === "user-ref").length,
  };

  return (
    <div className="input-page" data-figma-node="gallery-tbd">
      {overlaySrc && (
        <ImageOverlay src={overlaySrc} onClose={() => setOverlaySrc(null)} />
      )}

      <div className="section-header">
        <span className="section-header__title">Gallery</span>
        <span className="tech-badge tech-badge--muted">{LOCATION_ID}</span>
      </div>

      {/* Upload affordance — drag-and-drop zone + click-to-pick */}
      <article className="card">
        <div className="card__body" style={{ gap: "var(--sp-2)" }}>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            style={{
              border: "1px dashed var(--border)",
              borderRadius: 8,
              padding: 24,
              textAlign: "center",
              cursor: "pointer",
              background: "rgba(255,255,255,0.02)",
              color: "var(--text-muted)",
              fontSize: 13,
            }}
          >
            {uploading ? "Uploading…" : "Drop an image here or click to upload (PNG / JPG)"}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onPickFile}
            style={{ display: "none" }}
          />
          {uploadError && (
            <div style={{ color: "var(--red)", fontSize: 12 }}>
              ✗ {uploadError}
            </div>
          )}
        </div>
      </article>

      {/* Tabs + latest_only toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "var(--sp-3)" }}>
        {(["all", "generated", "uploaded"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`btn btn--sm ${tab === t ? "btn--primary" : "btn--ghost"}`}
          >
            {t === "all" ? "All" : t === "generated" ? "Generated" : "Uploaded"} ({counts[t]})
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={!latestOnly}
            onChange={(e) => setLatestOnly(!e.target.checked)}
          />
          Show all versions
        </label>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          No images yet. Generate a reference or upload one above.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 8,
            marginTop: "var(--sp-2)",
          }}
        >
          {filtered.map((i) => (
            <button
              key={i.image_id}
              type="button"
              onClick={() => setOverlaySrc(i.http_path)}
              title={[i.kind, i.entity_id, i.prompt].filter(Boolean).join(" · ")}
              style={{
                padding: 0,
                border: "1px solid var(--border)",
                borderRadius: 6,
                overflow: "hidden",
                background: "var(--border)",
                cursor: "zoom-in",
                position: "relative",
              }}
            >
              <img
                src={i.http_path}
                alt={i.kind}
                style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
              />
              <div style={{
                position: "absolute", bottom: 4, left: 4,
                background: "rgba(0,0,0,0.6)", color: "#fff",
                fontSize: 10, padding: "2px 6px", borderRadius: 3,
              }}>
                {i.kind === "user-ref" ? "Uploaded" : i.kind}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
