import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PipelineProvider } from "./state/PipelineContext";
import { ArtifactCacheProvider } from "./state/artifactCache";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary agentName="Location Scout">
      {/* ArtifactCacheProvider wraps the whole tree so useArtifact /
          useProjectArtifacts share one cache across pages. */}
      <ArtifactCacheProvider>
        <PipelineProvider>
          <App />
        </PipelineProvider>
      </ArtifactCacheProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
