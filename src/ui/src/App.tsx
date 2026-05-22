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
import { ReferencesPage } from "./pages/ReferencesPage";
import { SetupsPage } from "./pages/SetupsPage";
import { STAGES, type StageId } from "./stages";
import { usePipeline } from "./state/PipelineContext";
import { isStageAccessible } from "./state/pipeline";
import { useProjectContext } from "./hooks/useProjectContext";

const PAGES: Partial<Record<string, FC>> = {
  references: ReferencesPage,
  setups: SetupsPage,
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

/**
 * Bug 1 REGRESSION guard (2026-05-22) — Layer A.
 *
 * Renders a top-level blocking banner whenever ?project_id= is missing
 * from the URL. The Wave 2 fix (v1.0.43) removed the silent
 * default-project fallback from useProjectContext, but the pages never
 * branched on projectIdReady — so they silently constructed empty
 * bible/anchor URIs and fired Generate, producing the user-visible
 * "Location Bible not found: agent://location-scout/bible/" error.
 *
 * The banner replaces the routed page entirely so no Generate / Approve
 * button is reachable. Page-level disabled-prop guards (Layer B) provide
 * defense in depth in case this banner is ever bypassed or split into a
 * dismissable variant.
 */
function MissingProjectBanner() {
  return (
    <div
      role="alert"
      style={{
        margin: "var(--sp-4)",
        padding: "var(--sp-4)",
        borderRadius: 8,
        border: "1px solid rgba(247,146,126,0.5)",
        background: "rgba(247,146,126,0.08)",
        color: "var(--text)",
        fontSize: 14,
        lineHeight: 1.6,
        maxWidth: 640,
      }}
    >
      <strong style={{ display: "block", marginBottom: 8, fontSize: 15 }}>
        Missing project_id
      </strong>
      Open this agent with <code>?project_id=&lt;your-project-id&gt;</code> in
      the URL. Location Scout needs the project namespace to look up the right
      Location Bible, Anchor and Setups — without it every generation request
      would resolve to an empty slot and fail.
      <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>
        Embedded inside the Narrativity Editor this happens automatically; if
        you reached this page directly, append the parameter and reload.
      </div>
    </div>
  );
}

export function App() {
  const { projectIdReady } = useProjectContext();
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main className="app__main">
          {!projectIdReady ? (
            <MissingProjectBanner />
          ) : (
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
          )}
        </main>
      </div>
    </BrowserRouter>
  );
}
