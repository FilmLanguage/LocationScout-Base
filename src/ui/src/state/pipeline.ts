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

export type SetupTileStatus = "approved" | "draft" | "rejected";

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

export const INITIAL_STATE: PipelineState = {
  statuses: {
    input: "draft",
    research: "locked",
    analysis: "locked",
    references: "locked",
    setups: "locked",
    "light-states": "locked",
    outputs: "locked",
  },
  currentStage: "input",

  brief: {
    locationName: "Walter's living room",
    scriptQuotes: [
      '"The living room is dim, lit only by the blue glow of the CRT television. Pizza boxes are stacked on the coffee table."',
      '"WALTER enters through the front door, crosses the hallway into the living room. The air-conditioning hums."',
      '"Morning light filters through cheap blinds, casting prison-bar shadows across the carpet. A half-empty bottle of beer sits on the armrest."',
    ],
    shortDescription:
      "A cramped, sun-bleached suburban living room in Albuquerque. Low ceilings, worn furniture, and an oppressive stillness that feels like it's closing in.",
    type: ["INT", "EXT", "INT/EXT"],
    selectedType: "",
    timeOfDay: ["Day", "Night", "Morning", "Evening"],
    selectedTimeOfDay: "",
    scenes: ["sc_001", "sc_007", "sc_015"],
    props: ["CRT TV", "Bottle of beer", "Pizza box"],
    entryExit: ["Front door", "Kitchen archway", "Hallway"],
    generationFlags: ["Night shoot", "Practical TV light"],
  },

  vision: {
    eraStyle:
      "2004 suburban Albuquerque — middle-class decay, sun-bleached surfaces, Walmart furniture aesthetic",
    colorPalette: {
      description:
        "Desaturated beiges, sickly yellows, muted earth tones. Oppressive flatness.",
      // Mock director palette for Walter's living room demo — user-editable
      // content, not UI styling. Intentionally NOT tokenized; the palette is
      // the director's creative data that flows into the color-picker swatches.
      swatches: ["#c4a746", "#a89a6b", "#6b5d3a", "#7a7a5e"],
    },
    spatialPhilosophy:
      "Claustrophobic despite open plan. Low ceilings press down. The space should feel like it's slowly suffocating its inhabitants.",
    atmosphere:
      "Stale air-conditioning hum. Faint smell of carpet cleaner. The silence between family members is deafening.",
    lightVision:
      "Harsh New Mexico daylight filtered through cheap blinds creates prison-bar shadows. At night, only the blue TV glow.",
    referenceFilms: [
      "No Country for Old Men",
      "American Beauty",
      "Blue Velvet",
      "Safe (1995)",
    ],
  },

  research: {
    iteration: 2,
    maxIterations: 3,
    facts: [
      {
        id: "f1",
        title: "CRT televisions dominated American homes until mid-2000s",
        subtitle: "Flat screens rare before 2006 in middle-class homes",
      },
      {
        id: "f2",
        title: "Berber carpet was ubiquitous in 2000s suburban homes",
        subtitle: "Low-pile, usually beige or cream colored",
      },
      {
        id: "f3",
        title: "Cordless phones (not cell) primary home communication",
        subtitle: "Nokia/Motorola flip phones just emerging for personal use",
      },
      {
        id: "f4",
        title: "Venetian blinds standard in Southwest residential",
        subtitle: "Cheap horizontal plastic blinds, often yellowed",
      },
      {
        id: "f5",
        title: "La-Z-Boy recliners peak suburban furniture",
        subtitle: "Brown/tan leather or fabric, well-worn armrests",
      },
    ],
    typicalElements: [
      "CRT TV set (bulky)",
      "Berber carpet (beige)",
      "La-Z-Boy recliner",
      "Venetian blinds (plastic)",
      "Cordless phone",
      "Wall-mounted clock",
    ],
    anachronisms: [
      "LED lighting (any type)",
      "Flat screen / LCD TV",
      "Smartphones / tablets",
      "USB cables visible",
      "Modern laptop (thin)",
      "Stainless steel appliances",
      "Granite countertops",
      "Ring doorbell / smart home",
    ],
  },

  analysis: {
    spaceDescription:
      "The living room of the White residence is a monument to middle-class stagnation. A rectangular space approximately 5.5m x 4m with a 2.4m ceiling that seems to press down oppressively. The walls are painted in a washed-out cream that has yellowed from years of New Mexico sunlight filtering through cheap horizontal blinds.\n\nA bulky CRT television dominates the far wall, its screen perpetually reflecting the room back at itself. A well-worn La-Z-Boy recliner faces it at an angle, its brown fabric smooth and shiny on the armrests.",
    atmosphere:
      "Stale air-conditioning hum undercut by the distant drone of lawnmowers. The faint chemical tang of carpet cleaner. A heaviness in the air that makes every conversation feel like an interrogation. The silence between family members has texture — dense, oppressive, loaded with unspoken accusations.",
    wordCount: 438,
    wordBudget: 200,
    keyDetails: [
      "CRT TV (bulky, 90s model)",
      "Frayed beige Berber carpet",
      "La-Z-Boy recliner (brown leather)",
      "Horizontal plastic blinds (yellowed)",
      "Pizza box on coffee table",
      "Cordless phone on end table",
    ],
    negatives: [
      "LED lighting",
      "Flat screen TV",
      "Smartphones",
      "USB cables",
      "Modern laptop",
    ],
    colorTemp: "5500K",
    shadowHardness: "soft",
  },

  references: {
    floorplanSize: "5.5m × 4.0m × 2.4m",
    vlmAudit: {
      lpips: 0.32,
      ssim: 0.71,
      bibleMatch: 94,
      anachronismsFound: 0,
    },
  },

  setups: {
    selectedId: "S1-A",
    tiles: [
      { id: "S1-A", status: "approved", scene: "sc_003", mood: "NIGHT" },
      { id: "S1-B", status: "approved", scene: "sc_003", mood: "DAY" },
      { id: "S2-A", status: "draft",    scene: "sc_007", mood: "DAY" },
      { id: "S2-B", status: "draft",    scene: "sc_007", mood: "NIGHT" },
      { id: "S3-A", status: "approved", scene: "sc_015", mood: "LATE_NIGHT" },
      { id: "S3-B", status: "rejected", scene: "sc_015", mood: "DAY" },
      { id: "S1-C", status: "draft",    scene: "sc_003", mood: "DUSK" },
      { id: "S2-C", status: "draft",    scene: "sc_007", mood: "DUSK" },
      { id: "S3-C", status: "draft",    scene: "sc_015", mood: "NIGHT" },
    ],
  },

  lightStates: {
    sources: [
      { id: "S1", meta: "35mm · 45° · sc_003", variations: 3 },
      { id: "S2", meta: "50mm · 180° · sc_007", variations: 2 },
      { id: "S3", meta: "24mm · 90° · sc_015", variations: 1 },
    ],
    activeSourceId: "S1",
    variations: [
      { id: "S1 / NIGHT",      status: "approved",   temp: "2700K" },
      { id: "S1 / DAY",        status: "approved",   temp: "5500K" },
      { id: "S1 / DUSK",       status: "draft",      temp: "4200K" },
      { id: "S2 / NIGHT",      status: "approved",   temp: "2700K" },
      { id: "S2 / DAY",        status: "approved",   temp: "5500K" },
      { id: "S3 / LATE_NIGHT", status: "generating", temp: "1800K" },
    ],
    aiSuggestionDismissed: false,
    moodConfig: {
      directionOverride: "OVERHEAD",
      timeOfDay: "NIGHT",
      colorTempK: 2700,
      shadowHardness: "hard",
      clutterLevel: "messy",
      windowState: "closed",
    },
  },
};

// ──────────────── Actions ────────────────

export type PipelineAction =
  | { type: "APPROVE_STAGE"; stage: StageId }
  | { type: "SET_BRIEF"; patch: Partial<LocationBrief> }
  | { type: "SET_VISION"; patch: Partial<DirectorVision> }
  | { type: "SET_BRIEF_TYPE"; value: string }
  | { type: "SET_BRIEF_TIME_OF_DAY"; value: string }
  | { type: "ADD_FACT"; title: string; subtitle: string }
  | { type: "ADD_ANACHRONISM"; text: string }
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
 * The 7-stage pipeline order. Used by APPROVE_STAGE to unlock the next stage.
 */
const STAGE_ORDER: StageId[] = [
  "input",
  "research",
  "analysis",
  "references",
  "setups",
  "light-states",
  "outputs",
];

export function pipelineReducer(
  state: PipelineState,
  action: PipelineAction,
): PipelineState {
  switch (action.type) {
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
            t.status === "draft" ? { ...t, status: "approved" } : t,
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
