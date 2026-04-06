import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { registerCommonTools } from "./tools/common.js";
import { registerLocationTools } from "./tools/location.js";
import { registerResources } from "./resources/location.js";
import { mountSwagger } from "./swagger.js";

// PERF: McpServer is created per-request to avoid the SDK's
// "Already connected to a transport" crash on concurrent/sequential calls.
// This re-registers all tools on every request — acceptable for now,
// but should be replaced with a pooling or session-based approach
// once the MCP SDK supports multiple transports on a single server.
// See CHANGELOG.md [PERF-001].
function createServer(): McpServer {
  const server = new McpServer({
    name: "location-scout-base",
    version: "1.0.0",
  });
  registerCommonTools(server);
  registerLocationTools(server);
  registerResources(server);
  return server;
}

const app = express();
app.use(express.json());

// CORS for local dev (Vite on :5173 → Express on :8080)
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

mountSwagger(app);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0", uptime_seconds: Math.floor(process.uptime()) });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Location Scout MCP server listening on port ${PORT}`);
});
