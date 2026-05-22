import "./env.js";
process.env.AGENT_NAME ??= "location-scout";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
// BETA: ENABLED_TOOLS allow-list. Set via env (comma-separated tool names, "*" = all).
// Hides tools that the BETA UI does not need; preserves source code for restoration.
// See ROLLOUT.md.
const ENABLED = new Set(
  (process.env.ENABLED_TOOLS ?? "*").split(",").map((s) => s.trim()).filter(Boolean),
);
const isToolEnabled = (name: string) => ENABLED.has("*") || ENABLED.has(name);

function createServer(): McpServer {
  const server = new McpServer({
    name: "location-scout-base",
    version: VERSION,
  });
  // Wrap server.tool to filter by ENABLED_TOOLS allow-list.
  const originalTool = server.tool.bind(server);
  (server as unknown as { tool: (name: string, ...rest: unknown[]) => unknown }).tool = (
    name: string,
    ...rest: unknown[]
  ) => {
    if (!isToolEnabled(name)) {
      return undefined;
    }
    return (originalTool as unknown as (name: string, ...rest: unknown[]) => unknown)(name, ...rest);
  };
  registerCommonTools(server);
  registerLocationTools(server);
  registerReferenceTools(server);
  registerResources(server);
  return server;
}

const app = express();
// Bump body limit so `upload_reference` can accept base64-encoded images.
// Default `express.json()` cap is ~100kb — anything larger returns 413.
// 25mb covers typical phone/camera uploads after base64 inflation (~33%).
app.use(express.json({ limit: "25mb" }));

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
// Skip auth when token is empty (dev mode), for health check, or for
// /artifacts/* GET requests — those are loaded by browser <img>/<video>
// elements which can't attach custom headers and need to be publicly
// readable so the embedded UIs (GeneralUI, SceneGenerator) can show them.
const INTER_AGENT_TOKEN = process.env.INTER_AGENT_TOKEN || "";
// Paths that bypass auth entirely (UI shell, static assets, SPA client routes).
// Anything served by the embedded React app must be reachable without
// x-agent-token because the browser can't attach custom headers to navigation.
const isApiPath = (p: string) =>
  p === "/mcp" ||
  p === "/health" ||
  p.startsWith("/artifacts/") ||
  p.startsWith("/api-docs");
app.use((req, res, next) => {
  if (!INTER_AGENT_TOKEN) { next(); return; }
  if (req.path === "/health") { next(); return; }
  if ((req.method === "GET" || req.method === "HEAD") && req.path.startsWith("/artifacts/")) { next(); return; }
  // GET to any non-API path → static UI / SPA fallback, no auth required.
  if (req.method === "GET" && !isApiPath(req.path)) { next(); return; }
  // Same-origin bypass: the agent's own UI iframe (served from this same origin)
  // can call /mcp without the inter-agent token. Cross-origin callers still need it.
  const origin = req.headers.origin;
  const host = req.headers.host; // e.g. "fl-location-scout-base-lpymmaqbkq-uc.a.run.app"
  if (origin && host && (origin === `https://${host}` || origin === `http://${host}`)) {
    next();
    return;
  }
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
  const body = req.body as {
    method?: string;
    params?: {
      name?: string;
      uri?: string;
      arguments?: Record<string, unknown>;
    };
  } | undefined;
  const rpcMethod = body?.method ?? "unknown";
  const tool = body?.params?.name;
  const uri = body?.params?.uri;
  const action = tool ? `tool:${tool}` : uri ? `resource_read:${uri}` : `mcp:${rpcMethod}`;
  // Per-project isolation: pull project_id off the request and put it on the
  // request context so storage layer namespaces artifacts under that project
  // for the whole async chain. Two extraction paths, both already canonical
  // elsewhere in the project:
  //   1. tools/call → `body.params.arguments.project_id` (since 2026-05-16)
  //   2. resources/read → `?project_id=` query string on the URI (same
  //      convention as `/artifacts/...` HTTP routes, used by GeneralUI)
  // Without (2), resource handlers fell back to DEFAULT_PROJECT_KEY and
  // 404'd reads of artifacts written under a real project namespace.
  const argProjectId = body?.params?.arguments?.project_id;
  const uriProjectId = extractProjectIdFromUri(body?.params?.uri);
  const rawProjectId =
    (typeof argProjectId === "string" && argProjectId.trim()) ? argProjectId
    : uriProjectId;
  const project_id = typeof rawProjectId === "string" && rawProjectId.trim() ? rawProjectId.trim() : undefined;

  // Strip the ?project_id= query off the URI before the MCP transport tries
  // to match it against a ResourceTemplate — RFC 6570 path templates don't
  // tolerate trailing query strings, so without this the request silently
  // falls through to no handler (empty contents, no error). Verified locally
  // 2026-05-19: without strip, resource handler never fires; with strip the
  // full chain (URI extract → ALS stamp → per-project loadArtifact) succeeds.
  if (body?.params && typeof body.params.uri === "string") {
    const qIdx = body.params.uri.indexOf("?");
    if (qIdx !== -1) body.params.uri = body.params.uri.slice(0, qIdx);
  }

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
  }, project_id);
});

/** Pull ?project_id=… off an /artifacts request and put it on the request
 *  context so storage layers automatically scope to that project. Returns
 *  the resolved id (undefined when not provided) for logging. */
function projectIdFromQuery(req: import("express").Request): string | undefined {
  const raw = req.query.project_id;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return undefined;
}

/** Pull ?project_id=… off an MCP resource URI like
 *  `agent://location-scout/bible/{id}?project_id=white-room-001`. Returns the
 *  resolved id (undefined when missing or malformed). Mirrors the convention
 *  already used by `/artifacts/...` HTTP routes and the GeneralUI client. */
function extractProjectIdFromUri(uri: string | undefined): string | undefined {
  if (typeof uri !== "string") return undefined;
  const qIdx = uri.indexOf("?");
  if (qIdx === -1) return undefined;
  const params = new URLSearchParams(uri.slice(qIdx + 1));
  const raw = params.get("project_id");
  return raw && raw.trim() ? raw.trim() : undefined;
}

// Serve a specific image version by its short image_id — used by PromptCard
// when the user selects an older version from the gallery dropdown.
app.get("/artifacts/:type/v/:file", async (req, res) => {
  const { type, file } = req.params;
  const ext = file.split(".").pop() ?? "png";
  const image_id = file.replace(/\.[^.]+$/, "");
  const project_id = projectIdFromQuery(req);
  await withRequestContext(randomUUID(), `artifacts:${type}:v`, async () => {
    try {
      const { loadImageVersion } = await import("./lib/storage.js");
      // Fix A L3: thread project_id explicitly so the namespace contract
      // doesn't depend on the ALS wrap alone. resolveProjectKey still
      // falls back to ALS when omitted, but explicit > implicit here.
      const img = await loadImageVersion(type, image_id, ext === "jpeg" ? "jpg" : ext, project_id);
      if (!img) { res.status(404).json({ error: "not_found" }); return; }
      res.setHeader("Content-Type", img.contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.send(img.data);
    } catch {
      res.status(500).json({ error: "internal" });
    }
  }, project_id);
});

// Serve stored artifacts (images, JSON) via HTTP so the UI can display them.
// GET /artifacts/:type/:id.ext → loads from storage layer (memory → disk → S3).
// Optional ?project_id=… scopes the lookup; without it, falls back to
// per-process default + legacy un-namespaced paths.
app.get("/artifacts/:type/:file", async (req, res) => {
  const { type, file } = req.params;
  const ext = file.split(".").pop() ?? "";
  const id = file.replace(/\.[^.]+$/, "");
  const project_id = projectIdFromQuery(req);
  await withRequestContext(randomUUID(), `artifacts:${type}`, async () => {
    try {
      if (["png", "jpg", "jpeg"].includes(ext)) {
        const { loadImage } = await import("./lib/storage.js");
        // Fix A L3: thread project_id explicitly into the storage call.
        const img = await loadImage(type, id, ext === "jpeg" ? "jpg" : ext, project_id);
        if (!img) { res.status(404).json({ error: "not_found" }); return; }
        res.setHeader("Content-Type", img.contentType);
        res.setHeader("Cache-Control", "no-cache");
        res.send(img.data);
      } else {
        const { loadArtifact } = await import("./lib/storage.js");
        // Fix A L3: thread project_id explicitly so the JSON branch matches
        // the binary branch contract.
        const data = await loadArtifact(type, id, project_id);
        if (!data) { res.status(404).json({ error: "not_found" }); return; }
        res.json(data);
      }
    } catch {
      res.status(500).json({ error: "internal" });
    }
  }, project_id);
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

// Serve production UI bundle (built into dist-ui by Dockerfile).
const __dirname_ui = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.join(__dirname_ui, "..", "dist-ui");
app.use(express.static(uiDir));
app.get("*", (req, res, next) => {
  // Don't swallow API/MCP/health/artifacts paths if they 404 — pass through.
  if (
    req.path === "/health" ||
    req.path === "/mcp" ||
    req.path.startsWith("/artifacts/") ||
    req.path.startsWith("/api-docs")
  ) {
    return next();
  }
  res.sendFile(path.join(uiDir, "index.html"));
});

const PORT = process.env.PORT || 8083;

app.listen(PORT, () => {
  console.log(`Location Scout MCP server listening on port ${PORT}`);
});
