import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  INITIAL_STATE,
  pipelineReducer,
  type PipelineAction,
  type PipelineState,
} from "./pipeline";
import { hydrateFromServer } from "../api/hydration";

interface PipelineContextValue {
  state: PipelineState;
  dispatch: Dispatch<PipelineAction>;
}

const PipelineContext = createContext<PipelineContextValue | null>(null);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(pipelineReducer, INITIAL_STATE);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    hydrateFromServer()
      .then(({ found, patch }) => {
        if (found) dispatch({ type: "HYDRATE", patch });
      })
      .catch(() => {
        // Server unreachable — proceed with INITIAL_STATE; BetaAutoBoot handles it.
      })
      .finally(() => setHydrating(false));
  }, []);

  if (hydrating) return null;

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
