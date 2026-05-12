import type { FC } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { BetaAutoBoot } from "./components/BetaAutoBoot";
import { Header } from "./components/Header";
import { StagePlaceholder } from "./components/StagePlaceholder";
// BETA: only References/Setups visible. Input is auto-fired by BetaAutoBoot.
// See ROLLOUT.md for restoration.
// import { AnalysisPage } from "./pages/AnalysisPage";
// import { InputPage } from "./pages/InputPage";
// import { LightStatesPage } from "./pages/LightStatesPage";
// import { OutputsPage } from "./pages/OutputsPage";
// import { ResearchPage } from "./pages/ResearchPage";
import { GalleryPage } from "./pages/GalleryPage";
import { ReferencesPage } from "./pages/ReferencesPage";
import { SetupsPage } from "./pages/SetupsPage";
import { STAGES, type StageId } from "./stages";
import { usePipeline } from "./state/PipelineContext";
import { isStageAccessible } from "./state/pipeline";

const PAGES: Partial<Record<string, FC>> = {
  references: ReferencesPage,
  setups: SetupsPage,
  gallery: GalleryPage,
};

/**
 * Guard wrapper — if user navigates (via URL bar) to a locked stage,
 * bounce them to the References page (BETA: References is the new "/").
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
          <BetaAutoBoot>
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BetaAutoBoot>
        </main>
      </div>
    </BrowserRouter>
  );
}
