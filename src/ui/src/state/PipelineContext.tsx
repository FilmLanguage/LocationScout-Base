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
