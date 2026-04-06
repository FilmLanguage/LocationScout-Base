import React from "react";
import { createRoot } from "react-dom/client";
import { AgentPanel } from "./components/AgentPanel.js";

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <AgentPanel mcpEndpoint="/mcp" />
  </React.StrictMode>,
);
