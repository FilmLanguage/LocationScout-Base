import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  INITIAL_STATE,
  pipelineReducer,
  type PipelineAction,
  type PipelineState,
} from "./pipeline";

interface PipelineContextValue {
  state: PipelineState;
  dispatch: Dispatch<PipelineAction>;
}

const PipelineContext = createContext<PipelineContextValue | null>(null);

// ─── sessionStorage persistence (project-scoped) ───────────────────────────
//
// Pre-fix: PipelineContext was pure in-memory `useReducer`. Browser refresh
// always reset to INITIAL_STATE — losing extracted setup tiles, in-flight
// generation status, even which tile the user was reviewing. The "Reload
// erases everything" bug reproduced live 2026-05-16.
//
// Fix: persist on every reducer dispatch, restore on mount. Key includes
// `project_id` so two projects in adjacent tabs/sessions don't clobber each
// other (the per-project namespace contract codified in
// `docs/canonical/per-project-namespace.md`).

const SS_VERSION = "v1";

function readProjectIdFromUrl(): string {
  try {
    if (typeof window === "undefined") return "default-project";
    const raw = new URLSearchParams(window.location.search).get("project_id");
    return (raw && raw.trim()) || "default-project";
  } catch {
    return "default-project";
  }
}

function ssKey(projectId: string): string {
  return `ls-pipeline-${SS_VERSION}:${projectId}`;
}

function loadPersisted(projectId: string): PipelineState | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(ssKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Light shape check — if persisted shape predates a schema change, fall
    // back to INITIAL_STATE rather than crash on first dispatch.
    if (!parsed || typeof parsed !== "object" || !parsed.statuses || !parsed.setups) return null;
    return parsed as PipelineState;
  } catch {
    return null;
  }
}

function savePersisted(projectId: string, state: PipelineState): void {
  try {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(ssKey(projectId), JSON.stringify(state));
  } catch {
    // sessionStorage quota / private mode — ignore (state still works in memory).
  }
}

export function PipelineProvider({ children }: { children: ReactNode }) {
  // Captured once at mount — URL doesn't mutate within a session in current flows.
  const projectId = readProjectIdFromUrl();

  const [state, dispatch] = useReducer(
    pipelineReducer,
    INITIAL_STATE,
    (init): PipelineState => loadPersisted(projectId) ?? init,
  );

  useEffect(() => {
    savePersisted(projectId, state);
  }, [state, projectId]);

  return (
    <PipelineContext.Provider value={{ state, dispatch }}>
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipeline(): PipelineContextValue {
  const ctx = useContext(PipelineContext);
  if (!ctx) {
    throw new Error("usePipeline must be used inside a <PipelineProvider>");
  }
  return ctx;
}
