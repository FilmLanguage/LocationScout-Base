import {
  createContext,
  useContext,
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

// Hydration disabled: previously this fetched /artifacts/bible/<id>.json on
// mount and auto-approved the input stage if any Bible was found. Combined
// with a stale fixture-Bible on disk, that silently unlocked generation as
// if the user had supplied a real brief. The gate (BetaAutoBoot) is now the
// only path to `input: "approved"`, and it never approves on its own.
export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(pipelineReducer, INITIAL_STATE);

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
