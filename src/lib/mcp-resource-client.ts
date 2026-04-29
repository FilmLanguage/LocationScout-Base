/**
 * HTTP MCP resource client for inter-agent reads.
 *
 * Sends JSON-RPC `resources/read` to another agent's /mcp endpoint and
 * returns the parsed content. Both JSON (text) and image (blob) content types
 * are handled. Responses are cached via mcp-cache.ts (30 s LRU).
 *
 * Auth: INTER_AGENT_TOKEN bearer header when set.
 * Graceful degradation: any fetch / parse error returns null.
 */

import { getCached, setCached } from "./mcp-cache.js";
import { log } from "./log.js";

const INTER_AGENT_TOKEN = process.env.INTER_AGENT_TOKEN ?? "";

interface McpContent {
  text?: string;
  blob?: string;
  mimeType?: string;
}

interface McpResponse {
  result?: {
    contents?: McpContent[];
  };
}

async function mcpRead(agentBaseUrl: string, uri: string): Promise<McpResponse | null> {
  const cacheKey = `${agentBaseUrl}::${uri}`;
  const cached = getCached<McpResponse>(cacheKey);
  if (cached) {
    log({ category: "mcp_out", action: `resource_read:${uri}`, status: "skipped", details: { agent: agentBaseUrl, reason: "cache_hit" } });
    return cached;
  }

  const start = Date.now();
  log({ category: "mcp_out", action: `resource_read:${uri}`, status: "started", details: { agent: agentBaseUrl } });
  try {
    const res = await fetch(`${agentBaseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        ...(INTER_AGENT_TOKEN ? { "x-agent-token": INTER_AGENT_TOKEN } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "resources/read", params: { uri }, id: 1 }),
    });
    if (!res.ok) {
      log({ category: "mcp_out", action: `resource_read:${uri}`, status: "error", duration_ms: Date.now() - start, details: { agent: agentBaseUrl, http_status: res.status } });
      return null;
    }

    const contentType = res.headers.get("content-type") ?? "";
    let parsed: McpResponse | null = null;

    if (contentType.includes("text/event-stream")) {
      const text = await res.text();
      for (const line of text.split("\n")) {
        if (line.startsWith("data:")) {
          try {
            parsed = JSON.parse(line.slice(5).trim()) as McpResponse;
            break;
          } catch { /* skip */ }
        }
      }
    } else {
      parsed = await res.json() as McpResponse;
    }

    if (parsed) setCached(cacheKey, parsed);
    log({ category: "mcp_out", action: `resource_read:${uri}`, status: "completed", duration_ms: Date.now() - start, details: { agent: agentBaseUrl, parsed: parsed != null } });
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log({ category: "error", action: `resource_read:${uri}`, status: "error", duration_ms: Date.now() - start, details: { from_category: "mcp_out", agent: agentBaseUrl, error_message: message.slice(0, 500) } });
    return null;
  }
}

/**
 * Read a JSON resource from an upstream agent via MCP.
 * Returns parsed JSON or null on any failure.
 */
export async function readAgentResource(agentBaseUrl: string, uri: string): Promise<unknown | null> {
  const msg = await mcpRead(agentBaseUrl, uri);
  const text = msg?.result?.contents?.[0]?.text;
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Read an image resource from an upstream agent via MCP.
 * Returns a data: URL suitable for image_urls[], or null on any failure.
 *
 * Handles:
 *   - blob content (base64 + mimeType in MCP response)
 *   - JSON text containing image_url / data_url field
 */
export async function readAgentResourceAsDataUrl(agentBaseUrl: string, uri: string): Promise<string | null> {
  const msg = await mcpRead(agentBaseUrl, uri);
  if (!msg?.result?.contents?.[0]) return null;
  const { blob, mimeType, text } = msg.result.contents[0];

  if (blob && mimeType) {
    return `data:${mimeType};base64,${blob}`;
  }

  if (text) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (typeof parsed.data_url === "string") return parsed.data_url;
      if (typeof parsed.image_url === "string") return parsed.image_url;
    } catch { /* not JSON */ }
  }

  return null;
}
