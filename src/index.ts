import "./env.js";
process.env.AGENT_NAME ??= "location-scout";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "node:crypto";
import { VERSION } from "./lib/version.js";
import { isDbEnabled, getPool, isCircuitOpen } from "./lib/db.js";

import { registerCommonTools } from "./tools/common.js";
import { registerLocationTools } from "./tools/location.js";
import { registerReferenceTools } from "./tools/references.js";
import { registerResources } from "./resources/location.js";
import { mountSwagger } from "./swagger.js";
import { log, withRequestContext } from "./lib/log.js";


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
  registerReferenceTools(server);
  registerResources(server);
  return server;
}

const app = express();
app.use(express.json());

// CORS for local dev (Vite on :5176 → Express on :8083)
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, x-agent-token");
  if (_req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// http_in middleware — register before auth so 401 responses are also logged.
app.use((req, res, next) => {
  const start = Date.now();
  const method = req.method;
  const path = req.originalUrl.split("?")[0];
  res.on("finish", () => {
    log({
      category: "http_in",
      action: `${method} ${path}`,
      status: res.statusCode < 400 ? "ok" : "error",
      duration_ms: Date.now() - start,
      details: { status: res.statusCode, content_length: res.get("content-length") },
    });
  });
  next();
});

// Inter-agent auth: if INTER_AGENT_TOKEN is set, require x-agent-token header.
// Skip auth when token is empty (dev mode) or for health check.
const INTER_AGENT_TOKEN = process.env.INTER_AGENT_TOKEN || "";
app.use((req, res, next) => {
  if (!INTER_AGENT_TOKEN) { next(); return; }
  if (req.path === "/health") { next(); return; }
  const raw = req.headers["x-agent-token"];
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (token?.trim() !== INTER_AGENT_TOKEN.trim()) {
    res.status(401).json({ error: "unauthorized", message: "Invalid or missing x-agent-token" });
    return;
  }
  next();
});

app.post("/mcp", async (req, res) => {
  const request_id = randomUUID();
  const body = req.body as { method?: string; params?: { name?: string; uri?: string } } | undefined;
  const rpcMethod = body?.method ?? "unknown";
  const tool = body?.params?.name;
  const uri = body?.params?.uri;
  const action = tool ? `tool:${tool}` : uri ? `resource_read:${uri}` : `mcp:${rpcMethod}`;

  await withRequestContext(request_id, tool, async () => {
    const start = Date.now();
    log({ category: "mcp_in", action, status: "started" });
    try {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
      log({ category: "mcp_in", action, status: "completed", duration_ms: Date.now() - start });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log({ category: "error", action, status: "error", duration_ms: Date.now() - start, details: { from_category: "mcp_in", error_message: message.slice(0, 500) } });
      throw err;
    }
  });
});

// Serve a specific image version by its short image_id — used by PromptCard
// when the user selects an older version from the gallery dropdown.
app.get("/artifacts/:type/v/:file", async (req, res) => {
  const { type, file } = req.params;
  const ext = file.split(".").pop() ?? "png";
  const image_id = file.replace(/\.[^.]+$/, "");
  try {
    const { loadImageVersion } = await import("./lib/storage.js");
    const img = await loadImageVersion(type, image_id, ext === "jpeg" ? "jpg" : ext);
    if (!img) { res.status(404).json({ error: "not_found" }); return; }
    res.setHeader("Content-Type", img.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(img.data);
  } catch {
    res.status(500).json({ error: "internal" });
  }
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

app.get("/health", async (_req, res) => {
  if (isDbEnabled()) {
    try {
      await getPool().query("SELECT 1");
    } catch {
      res.status(503).json({ status: "error", reason: "db_unavailable" });
      return;
    }
  }
  res.json({ status: "ok", version: VERSION, uptime_seconds: Math.floor(process.uptime()) });
});

const PORT = process.env.PORT || 8083;

app.listen(PORT, () => {
  console.log(`Location Scout MCP server listening on port ${PORT}`);
});
