import "./env.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { registerCommonTools } from "./tools/common.js";
import { registerLocationTools } from "./tools/location.js";
import { registerResources } from "./resources/location.js";
import { mountSwagger } from "./swagger.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";


// ---------------------------------------------------------------------------
// VERSION — read from package.json at startup, allow env override.
// Replaces hardcoded "1.0.0" so /health and MCP server init reflect the real
// semver after each `gcloud run deploy --source` (Dockerfile copies package.json).
// ---------------------------------------------------------------------------
function __dirnameFromMetaUrl(metaUrl: string): string {
  const p = new URL(metaUrl).pathname;
  // Windows: strip leading "/" from "/C:/path"
  const normalized = /^\/[A-Za-z]:\//.test(p) ? p.slice(1) : p;
  return normalized.substring(0, normalized.lastIndexOf("/"));
}

const __pkgVersion: string = (() => {
  try {
    const __dir = __dirnameFromMetaUrl(import.meta.url);
    return JSON.parse(readFileSync(join(__dir, "..", "package.json"), "utf8")).version;
  } catch {
    return "dev";
  }
})();
const VERSION: string = process.env.VERSION ?? __pkgVersion;


// PERF: McpServer is created per-request to avoid the SDK's
// "Already connected to a transport" crash on concurrent/sequential calls.
// This re-registers all tools on every request — acceptable for now,
// but should be replaced with a pooling or session-based approach
// once the MCP SDK supports multiple transports on a single server.
// See CHANGELOG.md [PERF-001].
function createServer(): McpServer {
  const server = new McpServer({
    name: "location-scout-base",
    version: VERSION,
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, x-agent-token");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// Inter-agent auth: if INTER_AGENT_TOKEN is set, require x-agent-token header.
// Skip auth when token is empty (dev mode) or for health check.
const INTER_AGENT_TOKEN = process.env.INTER_AGENT_TOKEN || "";
app.use((req, res, next) => {
  if (!INTER_AGENT_TOKEN) { next(); return; }
  if (req.path === "/health") { next(); return; }
  const token = req.headers["x-agent-token"];
  if (token !== INTER_AGENT_TOKEN) {
    res.status(401).json({ error: "unauthorized", message: "Invalid or missing x-agent-token" });
    return;
  }
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

// Serve stored artifacts (images, JSON) via HTTP so the UI can display them.
// GET /artifacts/:type/:id.ext → loads from storage layer (memory → disk → S3).
app.get("/artifacts/:type/:file", async (req, res) => {
  const { type, file } = req.params;
  const ext = file.split(".").pop() ?? "";
  const id = file.replace(/\.[^.]+$/, "");
  try {
    if (["png", "jpg", "jpeg"].includes(ext)) {
      const { loadImage } = await import("./lib/storage.js");
      const img = await loadImage(type, id, ext === "jpeg" ? "jpg" : ext);
      if (!img) { res.status(404).json({ error: "not_found" }); return; }
      res.setHeader("Content-Type", img.contentType);
      res.setHeader("Cache-Control", "no-cache");
      res.send(img.data);
    } else {
      const { loadArtifact } = await import("./lib/storage.js");
      const data = await loadArtifact(type, id);
      if (!data) { res.status(404).json({ error: "not_found" }); return; }
      res.json(data);
    }
  } catch {
    res.status(500).json({ error: "internal" });
  }
});

mountSwagger(app);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: VERSION, uptime_seconds: Math.floor(process.uptime()) });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Location Scout MCP server listening on port ${PORT}`);
});
