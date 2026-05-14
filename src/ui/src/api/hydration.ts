/**
 * Phase 5: server hydration.
 *
 * On app start, fetches existing artifacts from the MCP server and maps them
 * to PipelineState so the UI skips re-running the expensive scout_location
 * pipeline and restores analysis + research content.
 *
 * Fetch strategy (all parallel):
 *   GET /artifacts/bible/<id>.json   → LocationBible
 *   GET /artifacts/research/<id>.json → ResearchPack
 *   HEAD /artifacts/anchor/<id>.png  → image exists?
 *   HEAD /artifacts/floorplan/<id>.png → image exists?
 *
 * Status inference:
 *   bible present            → input=approved, references=draft
 *   bible + anchor+floorplan → input=approved, references=approved, setups=draft
 */

import type { AnalysisState, PipelineState, ResearchState } from "../state/pipeline";

const LOCATION_ID = "loc_001";

export interface HydrationResult {
  found: boolean;
  patch: Partial<PipelineState>;
}

async function jsonOrNull<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function hydrateFromServer(): Promise<HydrationResult> {
  const [bible, research, anchorExists, floorplanExists] = await Promise.all([
    jsonOrNull<Record<string, unknown>>(`/artifacts/bible/${LOCATION_ID}.json`),
    jsonOrNull<Record<string, unknown>>(`/artifacts/research/${LOCATION_ID}.json`),
    headOk(`/artifacts/anchor/${LOCATION_ID}.png`),
    headOk(`/artifacts/floorplan/${LOCATION_ID}.png`),
  ]);

  if (!bible) return { found: false, patch: {} };

  const patch: Partial<PipelineState> = {};

  // ── Statuses ─────────────────────────────────────────────────────
  const imagesReady = anchorExists && floorplanExists;
  patch.statuses = {
    input: "approved",
    research: "locked",
    analysis: "locked",
    references: imagesReady ? "approved" : "draft",
    setups: imagesReady ? "draft" : "locked",
    "light-states": "locked",
    outputs: "locked",
  };
  patch.currentStage = "references";

  // ── Analysis from LocationBible ───────────────────────────────────
  const spaceDesc =
    typeof bible.space_description === "string" ? bible.space_description : "";
  const atmosphere =
    typeof bible.atmosphere === "string" ? bible.atmosphere : "";
  const keyDetails = Array.isArray(bible.key_details)
    ? (bible.key_details as string[])
    : [];
  const negatives = Array.isArray(bible.negative_list)
    ? (bible.negative_list as string[])
    : [];
  const lightBase = bible.light_base_state as Record<string, unknown> | undefined;
  const colorTemp =
    lightBase && typeof lightBase.color_temp_kelvin === "number"
      ? `${lightBase.color_temp_kelvin}K`
      : "5500K";
  const shadowHardness =
    (lightBase?.shadow_hardness as AnalysisState["shadowHardness"]) ?? "soft";

  patch.analysis = {
    spaceDescription: spaceDesc,
    atmosphere,
    wordCount: spaceDesc.split(/\s+/).filter(Boolean).length,
    wordBudget: 200,
    keyDetails,
    negatives,
    colorTemp,
    shadowHardness,
  };

  // ── Research from ResearchPack ────────────────────────────────────
  if (research) {
    type RawFact = { fact: string; source?: string; relevance?: string };
    const periodFacts = Array.isArray(research.period_facts)
      ? (research.period_facts as RawFact[])
      : [];
    const typicalElements = Array.isArray(research.typical_elements)
      ? (research.typical_elements as string[])
      : [];
    const anachronisms = Array.isArray(research.anachronism_list)
      ? (research.anachronism_list as string[])
      : [];

    patch.research = {
      facts: periodFacts.map((f, i) => ({
        id: `f${i + 1}`,
        title: f.fact,
        subtitle: f.source ?? f.relevance ?? "",
      })),
      typicalElements,
      anachronisms,
      iteration: 1,
      maxIterations: 3,
    } satisfies ResearchState;
  }

  return { found: true, patch };
}
