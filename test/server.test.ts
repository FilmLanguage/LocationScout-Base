import { describe, it, expect, beforeAll, afterAll } from "vitest";

const PORT = 9876;
let serverProcess: { kill: () => void } | null = null;

async function mcpCall(method: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`http://localhost:${PORT}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return res.json() as Promise<{ result?: unknown; error?: unknown }>;
}

describe("Location Scout MCP Server", () => {
  beforeAll(async () => {
    // Start server in subprocess
    const { spawn } = await import("child_process");
    serverProcess = spawn("node", ["--import", "tsx", "src/index.ts"], {
      cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
      env: { ...process.env, PORT: String(PORT) },
      stdio: "pipe",
    });

    // Wait for server to be ready
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://localhost:${PORT}/health`);
        if (res.ok) break;
      } catch {
        // not ready yet
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }, 20_000);

  afterAll(() => {
    serverProcess?.kill();
  });

  // ─── Health ─────────────────────────────────────────────────────

  it("GET /health returns ok", async () => {
    const res = await fetch(`http://localhost:${PORT}/health`);
    const body = await res.json() as { status: string; version: string };
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
    expect(body.version).not.toBe("");
  });

  // ─── MCP Initialize ────────────────────────────────────────────

  it("MCP initialize returns server info", async () => {
    const data = await mcpCall("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" },
    });
    expect(data.result).toBeDefined();
    const result = data.result as { serverInfo: { name: string } };
    expect(result.serverInfo.name).toBe("location-scout-base");
  });

  // ─── Tools List ─────────────────────────────────────────────────

  it("tools/list returns 29 tools", async () => {
    const data = await mcpCall("tools/list");
    expect(data.result).toBeDefined();
    const result = data.result as { tools: Array<{ name: string }> };
    expect(result.tools.length).toBeGreaterThanOrEqual(29);

    const names = result.tools.map((t) => t.name);
    // Common tools
    expect(names).toContain("ping");
    expect(names).toContain("get_info");
    expect(names).toContain("get_task_status");
    expect(names).toContain("approve_artifact");

    // Domain tools
    expect(names).toContain("scout_location");
    expect(names).toContain("research_era");
    expect(names).toContain("write_bible");
    expect(names).toContain("generate_anchor");
    expect(names).toContain("create_mood_states");
    expect(names).toContain("get_bible");
  });

  // ─── Resources List ─────────────────────────────────────────────

  it("resources/list returns 8 resource templates", async () => {
    const data = await mcpCall("resources/list");
    expect(data.result).toBeDefined();
  });

  // ─── Tool Call: ping ────────────────────────────────────────────

  it("ping returns ok", async () => {
    const data = await mcpCall("tools/call", { name: "ping", arguments: {} });
    expect(data.result).toBeDefined();
    const result = data.result as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("ok");
  });

  // ─── Tool Call: get_info ────────────────────────────────────────

  it("get_info returns agent metadata", async () => {
    const data = await mcpCall("tools/call", { name: "get_info", arguments: {} });
    const result = data.result as { content: Array<{ text: string }> };
    const info = JSON.parse(result.content[0].text);
    expect(info.name).toBe("location-scout-base");
    expect(info.capabilities).toContain("write_bible");
    expect(info.schema_versions["location-bible"]).toBe("v2");
  });

  // ─── Tool Call: get_bible (not found) ───────────────────────────

  it("get_bible returns not_found for unknown ID", async () => {
    const data = await mcpCall("tools/call", {
      name: "get_bible",
      arguments: { bible_id: "nonexistent" },
    });
    const result = data.result as { content: Array<{ text: string }> };
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("not_found");
  });

  // ─── Swagger ────────────────────────────────────────────────────

  it("GET /openapi.json returns spec", async () => {
    const res = await fetch(`http://localhost:${PORT}/openapi.json`);
    expect(res.status).toBe(200);
    const body = await res.json() as { openapi: string };
    expect(body.openapi).toBeDefined();
  });
});
