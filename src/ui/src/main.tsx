import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PipelineProvider } from "./state/PipelineContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary agentName="Location Scout">
      <PipelineProvider>
        <App />
      </PipelineProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
