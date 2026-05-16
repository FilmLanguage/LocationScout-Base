/**
 * Pipeline state — the single source of truth for the 7-stage Location Scout flow.
 *
 * Phase 4: in-memory only. Refreshing the browser resets to INITIAL_STATE.
 * Phase 5 will replace the hardcoded initial values with fetches to the MCP server.
 */

import type { StageId } from "../stages";

export type StageStatus = "locked" | "draft" | "approved";

export interface LocationBrief {
  locationName: string;
  scriptQuotes: string[];
  shortDescription: string;
  type: string[];
  selectedType: string;
  timeOfDay: string[];
  selectedTimeOfDay: string;
  scenes: string[];
  props: string[];
  entryExit: string[];
  generationFlags: string[];
}

export interface DirectorVision {
  eraStyle: string;
  colorPalette: { description: string; swatches: string[] };
  spatialPhilosophy: string;
  atmosphere: string;
  lightVision: string;
  referenceFilms: string[];
}

export interface Fact {
  id: string;
  title: string;
  subtitle: string;
}

export interface ResearchState {
  facts: Fact[];
  typicalElements: string[];
  anachronisms: string[];
  iteration: number;
  maxIterations: number;
}

export interface AnalysisState {
  spaceDescription: string;
  atmosphere: string;
  wordCount: number;
  wordBudget: number;
  keyDetails: string[];
  negatives: string[];
  colorTemp: string;
  shadowHardness: "hard" | "soft" | "mixed";
}

export interface ReferenceState {
  floorplanSize: string;
  vlmAudit: {
    lpips: number;
    ssim: number;
    bibleMatch: number;
    anachronismsFound: number;
  };
}

export type SetupTileStatus = "none" | "approved" | "draft" | "rejected";

export interface SetupTile {
  id: string;
  status: SetupTileStatus;
  scene: string;
  mood: string;
}

export interface SetupsState {
  tiles: SetupTile[];
  selectedId: string;
}

export type VariationStatus = "approved" | "draft" | "rejected" | "generating" | "canceled";

export interface Variation {
  id: string;
  status: VariationStatus;
  temp: string;
}

export type ShadowHardness = "hard" | "soft" | "mixed";
export type ClutterLevel = "clean" | "slight" | "messy" | "destroyed";
export type WindowState = "open" | "closed" | "curtains_drawn" | "boarded_up";

export interface MoodConfig {
  directionOverride: string;  // e.g. "OVERHEAD"
  timeOfDay: string;          // e.g. "NIGHT"
  colorTempK: number;         // e.g. 2700
  shadowHardness: ShadowHardness;
  clutterLevel: ClutterLevel;
  windowState: WindowState;
}

export interface LightStatesState {
  sources: Array<{ id: string; meta: string; variations: number }>;
  activeSourceId: string;
  variations: Variation[];
  aiSuggestionDismissed: boolean;
  moodConfig: MoodConfig;
}

export interface PipelineState {
  statuses: Record<StageId, StageStatus>;
  currentStage: StageId;
  brief: LocationBrief;
  vision: DirectorVision;
  research: ResearchState;
  analysis: AnalysisState;
  references: ReferenceState;
  setups: SetupsState;
  lightStates: LightStatesState;
}

// ──────────────── Initial state ────────────────

// Script analysis happens upstream; this agent assumes its inputs are
// handled. References + setups are always reachable so the user can hit
// Generate. Backend rejects generation if no Bible is available — the UI
// does not pretend otherwise by gating.
export const INITIAL_STATE: PipelineState = {
  statuses: {
    input: "approved",
    research: "approved",
    analysis: "approved",
    references: "draft",
    setups: "draft",
    "light-states": "locked",
    outputs: "locked",
  },
  currentStage: "references",

  brief: {
    locationName: "",
    scriptQuotes: [],
    shortDescription: "",
    type: [],
    selectedType: "",
    timeOfDay: [],
    selectedTimeOfDay: "",
    scenes: [],
    props: [],
    entryExit: [],
    generationFlags: [],
  },

  vision: {
    eraStyle: "",
    colorPalette: {
      description: "",
      swatches: [],
    },
    spatialPhilosophy: "",
    atmosphere: "",
    lightVision: "",
    referenceFilms: [],
  },

  research: {
    iteration: 0,
    maxIterations: 3,
    facts: [],
    typicalElements: [],
    anachronisms: [],
  },

  analysis: {
    spaceDescription: "",
    atmosphere: "",
    wordCount: 0,
    wordBudget: 200,
    keyDetails: [],
    negatives: [],
    colorTemp: "",
    shadowHardness: "soft",
  },

  references: {
    floorplanSize: "",
    vlmAudit: {
      lpips: 0,
      ssim: 0,
      bibleMatch: 0,
      anachronismsFound: 0,
    },
  },

  setups: {
    selectedId: "",
    tiles: [],
  },

  lightStates: {
    sources: [],
    activeSourceId: "",
    variations: [],
    aiSuggestionDismissed: false,
    moodConfig: {
      directionOverride: "",
      timeOfDay: "",
      colorTempK: 0,
      shadowHardness: "soft",
      clutterLevel: "clean",
      windowState: "closed",
    },
  },
};

// ──────────────── Actions ────────────────

export type PipelineAction =
  | { type: "HYDRATE"; patch: Partial<PipelineState> }
  | { type: "APPROVE_STAGE"; stage: StageId }
  | { type: "SET_BRIEF"; patch: Partial<LocationBrief> }
  | { type: "SET_VISION"; patch: Partial<DirectorVision> }
  | { type: "SET_BRIEF_TYPE"; value: string }
  | { type: "SET_BRIEF_TIME_OF_DAY"; value: string }
  | { type: "ADD_FACT"; title: string; subtitle: string }
  | { type: "ADD_ANACHRONISM"; text: string }
  | { type: "SET_SETUPS_TILES"; tiles: SetupTile[] }
  | { type: "SET_SETUP_STATUS"; id: string; status: SetupTileStatus }
  | { type: "SELECT_SETUP"; id: string }
  | { type: "APPROVE_ALL_SETUPS" }
  | { type: "SELECT_LIGHT_SOURCE"; id: string }
  | { type: "SET_VARIATION_STATUS"; id: string; status: VariationStatus }
  | { type: "CANCEL_VARIATION"; id: string }
  | { type: "APPROVE_ALL_VARIATIONS" }
  | { type: "DISMISS_MOOD_SUGGESTION" }
  | { type: "APPLY_MOOD_SUGGESTION" }
  | { type: "SET_MOOD_CONFIG"; patch: Partial<MoodConfig> }
  | { type: "SET_ANALYSIS"; patch: Partial<AnalysisState> };

/**
 * BETA: 3-stage pipeline order. Used by APPROVE_STAGE to unlock the next stage.
 * Full order: ["input","research","analysis","references","setups","light-states","outputs"]
 * See ROLLOUT.md for restoration steps.
 */
const STAGE_ORDER: StageId[] = ["input", "references", "setups"];

export function pipelineReducer(
  state: PipelineState,
  action: PipelineAction,
): PipelineState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, ...action.patch };

    case "APPROVE_STAGE": {
      const idx = STAGE_ORDER.indexOf(action.stage);
      const next = STAGE_ORDER[idx + 1];
      const statuses = { ...state.statuses, [action.stage]: "approved" as StageStatus };
      if (next && statuses[next] === "locked") {
        statuses[next] = "draft";
      }
      return {
        ...state,
        statuses,
        currentStage: next ?? state.currentStage,
      };
    }

    case "SET_BRIEF":
      return { ...state, brief: { ...state.brief, ...action.patch } };

    case "SET_VISION":
      return { ...state, vision: { ...state.vision, ...action.patch } };

    case "SET_BRIEF_TYPE":
      return { ...state, brief: { ...state.brief, selectedType: action.value } };

    case "SET_BRIEF_TIME_OF_DAY":
      return { ...state, brief: { ...state.brief, selectedTimeOfDay: action.value } };

    case "ADD_FACT": {
      if (!action.title.trim()) return state;
      const newFact: Fact = {
        id: `f${Date.now()}`,
        title: action.title,
        subtitle: action.subtitle,
      };
      return {
        ...state,
        research: { ...state.research, facts: [...state.research.facts, newFact] },
      };
    }

    case "ADD_ANACHRONISM": {
      if (!action.text.trim()) return state;
      if (state.research.anachronisms.includes(action.text)) return state;
      return {
        ...state,
        research: {
          ...state.research,
          anachronisms: [...state.research.anachronisms, action.text],
        },
      };
    }

    case "SET_SETUPS_TILES":
      return {
        ...state,
        setups: {
          tiles: action.tiles,
          selectedId: action.tiles[0]?.id ?? "",
        },
      };

    case "SET_SETUP_STATUS":
      return {
        ...state,
        setups: {
          ...state.setups,
          tiles: state.setups.tiles.map((t) =>
            t.id === action.id ? { ...t, status: action.status } : t,
          ),
        },
      };

    case "SELECT_SETUP":
      return {
        ...state,
        setups: { ...state.setups, selectedId: action.id },
      };

    case "APPROVE_ALL_SETUPS":
      return {
        ...state,
        setups: {
          ...state.setups,
          tiles: state.setups.tiles.map((t) =>
            t.status === "draft" || t.status === "none"
              ? { ...t, status: "approved" }
              : t,
          ),
        },
      };

    case "SELECT_LIGHT_SOURCE":
      return {
        ...state,
        lightStates: { ...state.lightStates, activeSourceId: action.id },
      };

    case "SET_VARIATION_STATUS":
      return {
        ...state,
        lightStates: {
          ...state.lightStates,
          variations: state.lightStates.variations.map((v) =>
            v.id === action.id ? { ...v, status: action.status } : v,
          ),
        },
      };

    case "CANCEL_VARIATION":
      return {
        ...state,
        lightStates: {
          ...state.lightStates,
          variations: state.lightStates.variations.map((v) =>
            v.id === action.id ? { ...v, status: "canceled" } : v,
          ),
        },
      };

    case "APPROVE_ALL_VARIATIONS":
      return {
        ...state,
        lightStates: {
          ...state.lightStates,
          variations: state.lightStates.variations.map((v) =>
            v.status === "draft" ? { ...v, status: "approved" } : v,
          ),
        },
      };

    case "DISMISS_MOOD_SUGGESTION":
      return {
        ...state,
        lightStates: { ...state.lightStates, aiSuggestionDismissed: true },
      };

    case "APPLY_MOOD_SUGGESTION":
      // The AI suggestion shown in the UI is
      // "Use 2700K + hard shadows for sc_003 NIGHT (TV-lit scene)".
      // Applying it writes those concrete values into the mood config so the
      // user can see the delta rows update and then hit Generate Variation.
      return {
        ...state,
        lightStates: {
          ...state.lightStates,
          aiSuggestionDismissed: true,
          moodConfig: {
            ...state.lightStates.moodConfig,
            colorTempK: 2700,
            shadowHardness: "hard",
            timeOfDay: "NIGHT",
          },
        },
      };

    case "SET_MOOD_CONFIG":
      return {
        ...state,
        lightStates: {
          ...state.lightStates,
          moodConfig: { ...state.lightStates.moodConfig, ...action.patch },
        },
      };

    case "SET_ANALYSIS":
      return {
        ...state,
        analysis: { ...state.analysis, ...action.patch },
      };

    default:
      return state;
  }
}

/** Stage is clickable in nav if it's not locked. */
export function isStageAccessible(statuses: Record<StageId, StageStatus>, id: StageId): boolean {
  return statuses[id] !== "locked";
}
