import type { FC } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { StagePlaceholder } from "./components/StagePlaceholder";
import { AnalysisPage } from "./pages/AnalysisPage";
import { InputPage } from "./pages/InputPage";
import { LightStatesPage } from "./pages/LightStatesPage";
import { OutputsPage } from "./pages/OutputsPage";
import { ReferencesPage } from "./pages/ReferencesPage";
import { ResearchPage } from "./pages/ResearchPage";
import { SetupsPage } from "./pages/SetupsPage";
import { STAGES, type StageId } from "./stages";
import { usePipeline } from "./state/PipelineContext";
import { isStageAccessible } from "./state/pipeline";

const PAGES: Partial<Record<string, FC>> = {
  input: InputPage,
  research: ResearchPage,
  analysis: AnalysisPage,
  references: ReferencesPage,
  setups: SetupsPage,
  "light-states": LightStatesPage,
  outputs: OutputsPage,
};

/**
 * Guard wrapper — if user navigates (via URL bar) to a locked stage,
 * bounce them to the Input page.
 */
function StageGuard({ id, children }: { id: StageId; children: React.ReactNode }) {
  const { state } = usePipeline();
  if (!isStageAccessible(state.statuses, id)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main className="app__main">
          <Routes>
            {STAGES.map((stage) => {
              const Page = PAGES[stage.id];
              const element = Page ? <Page /> : <StagePlaceholder stage={stage} />;
              return (
                <Route
                  key={stage.id}
                  path={stage.path}
                  element={<StageGuard id={stage.id}>{element}</StageGuard>}
                />
              );
            })}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
