/**
 * Stage 7 — Outputs.
 * Mirrors Figma frame "Outputs" (node 445:47).
 *
 * NOTE: request_revision and submit_feedback are intentionally dropped for v1.
 */

import { useEffect, useState } from "react";
import { callTool } from "../api/mcp";
import { usePipeline } from "../state/PipelineContext";

const LOCATION_ID = "loc_001";

interface Consumer {
  title: string;
  fileCount: number;
  description: string;
  consumers: string;
  files: string[];
  extra?: number;
}

const consumers: Consumer[] = [
  {
    title: "Gallery",
    fileCount: 14,
    description: "All PNG artifacts: anchor, floorplan, isometric, setup images",
    consumers: "Central project gallery",
    files: [
      "anchor_loc_001.png",
      "floorplan_loc_001.png",
      "isometric_loc_001.png",
      "setup_S1-A.png",
      "setup_S1-B.png",
    ],
    extra: 1,
  },
  {
    title: "DP + Storyboard",
    fileCount: 6,
    description: "Floorplan, setup positions, anchor image for cinematographer",
    consumers: "Cinematographer, Storyboard Artist",
    files: [
      "floorplan_with_lights.png",
      "setup_positions.json",
      "anchor_reference.png",
      "camera_S1.json",
      "camera_S2.json",
    ],
  },
  {
    title: "Prompt Composer",
    fileCount: 4,
    description: "Bible text, mood states, negative_list for downstream agents",
    consumers: "Art Director, Sound Designer",
    files: [
      "location_bible.txt",
      "mood_states.json",
      "negative_list.json",
      "atmosphere.txt",
    ],
  },
  {
    title: "Shot Generation",
    fileCount: 9,
    description: "Anchor reference, mood delta configs, setup definitions",
    consumers: "Shot Generation Agent",
    files: [
      "anchor_ref.png",
      "mood_delta_sc003.json",
      "setup_config_S1.json",
    ],
  },
];

const summary: Array<{ name: string; status: string; tone?: "success" | "info" }> = [
  { name: "Bible", status: "approved", tone: "success" },
  { name: "Anchor", status: "approved", tone: "success" },
  { name: "Floorplan", status: "validated", tone: "success" },
  { name: "Isometric", status: "validated", tone: "success" },
  { name: "Moods (3)", status: "approved", tone: "success" },
  { name: "Setups (9)", status: "5/9 approved", tone: "info" },
];

export function OutputsPage() {
  const { state, dispatch } = usePipeline();
  const outputsStatus = state.statuses.outputs;
  const [outputs, setOutputs] = useState<unknown>(null);

  // Fetch outputs from backend on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await callTool("get_outputs", { location_id: LOCATION_ID });
        if (!cancelled) {
          setOutputs(r.data);
          console.log("[get_outputs] →", r.data);
        }
      } catch (err) {
        console.error("[get_outputs] failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSend = async () => {
    dispatch({ type: "APPROVE_STAGE", stage: "outputs" });
    try {
      const r = await callTool("approve_artifact", {
        artifact_uri: `agent://location-scout/outputs/${LOCATION_ID}`,
        notes: "All outputs sent to downstream pipeline",
      });
      console.log("[approve_artifact outputs] →", r.data);
    } catch (err) {
      console.error("[approve_artifact outputs] failed:", err);
    }
  };
  // Reference to silence unused-var when console.log gets stripped:
  void outputs;

  return (
    <div className="input-page" data-figma-node="445:47">
      <div className="banner banner--success">
        <span className="banner__icon" aria-hidden>✓</span>
        <span className="banner__title">ALL COMPLETE</span>
        <span className="banner__spacer" />
        <span className="badge badge--approved">Ready</span>
      </div>

      {/* 4 consumer cards */}
      <div className="columns-2">
        {consumers.map((c) => (
          <article key={c.title} className="card">
            <div className="consumer-card__header">
              <span className="consumer-card__title">{c.title}</span>
              <span className="consumer-card__count">{c.fileCount} files</span>
            </div>
            <p className="consumer-card__desc">{c.description}</p>
            <p className="consumer-card__consumers">
              <strong>Consumer:</strong> {c.consumers}
            </p>
            <ul className="file-list">
              {c.files.map((f) => (
                <li key={f} className="file-list__item">• {f}</li>
              ))}
              {c.extra ? (
                <li className="file-list__more">...+{c.extra} more</li>
              ) : null}
            </ul>
          </article>
        ))}
      </div>

      {/* Artifact summary */}
      <div className="section-header">
        <span className="section-header__title">Artifact Summary</span>
      </div>
      <div className="artifact-summary">
        {summary.map((s) => (
          <div key={s.name} className="artifact-item">
            <span className="artifact-item__name">{s.name}</span>
            <span
              className="artifact-item__status"
              style={{
                color: s.tone === "info" ? "var(--accent)" : "var(--green)",
              }}
            >
              {s.status}
            </span>
          </div>
        ))}
      </div>

      <div className="page-footer">
        <span className="page-footer__spacer" />
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleSend}
          disabled={outputsStatus === "approved"}
        >
          {outputsStatus === "approved" ? "✓ Sent to Pipeline" : "Send to Pipeline"}
          {outputsStatus !== "approved" && (
            <span className="btn__arrow" aria-hidden>→</span>
          )}
        </button>
      </div>
    </div>
  );
}
