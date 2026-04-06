/**
 * Hook for calling MCP tools from the UI.
 * Handles both JSON and SSE responses from StreamableHTTPServerTransport.
 */

import { useState, useCallback } from "react";

interface McpCallResult<T = unknown> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/** Parse SSE or JSON response */
function parseResponse(text: string): { result?: any; error?: { code: number; message: string } } {
  if (text.startsWith("event:") || text.startsWith("data:")) {
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try { return JSON.parse(line.slice(6)); } catch { /* next line */ }
      }
    }
    return { error: { code: -1, message: "No valid JSON in SSE response" } };
  }
  try { return JSON.parse(text); }
  catch { return { error: { code: -1, message: `Invalid response: ${text.slice(0, 100)}` } }; }
}

export function useMcpClient(endpoint = "http://localhost:8080/mcp") {
  const [loading, setLoading] = useState(false);

  const callTool = useCallback(async <T = unknown>(
    name: string, args: Record<string, unknown>,
  ): Promise<McpCallResult<T>> => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } }),
      });
      const text = await res.text();
      const json = parseResponse(text);
      if (json.error) return { data: null, error: json.error.message, loading: false };

      // Check MCP isError flag
      if (json.result?.isError) {
        const errText = json.result.content?.filter((c: any) => c.type === "text").map((c: any) => c.text).join("") ?? "Tool error";
        return { data: null, error: errText, loading: false };
      }

      const textContent = json.result?.content?.filter((c: any) => c.type === "text").map((c: any) => c.text).join("") ?? "";
      try { return { data: JSON.parse(textContent) as T, error: null, loading: false }; }
      catch { return { data: textContent as unknown as T, error: null, loading: false }; }
    } catch (err) { return { data: null, error: (err as Error).message, loading: false }; }
    finally { setLoading(false); }
  }, [endpoint]);

  /** Poll task until completed/failed. Tolerates transient errors. */
  const pollTask = useCallback(async (
    taskId: string, onProgress?: (p: number, s: string) => void, interval = 2000, max = 180,
  ): Promise<McpCallResult> => {
    let consecutiveErrors = 0;
    for (let i = 0; i < max; i++) {
      const r = await callTool<any>("get_task_status", { task_id: taskId });
      if (r.error) {
        consecutiveErrors++;
        if (consecutiveErrors >= 5) return { data: null, error: `Polling failed: ${r.error}`, loading: false };
        await new Promise(r => setTimeout(r, interval * 2));
        continue;
      }
      consecutiveErrors = 0;
      if (!r.data) { await new Promise(r => setTimeout(r, interval)); continue; }
      if (onProgress && r.data.progress !== undefined) onProgress(r.data.progress, r.data.current_step);
      if (r.data.status === "completed") return callTool("get_task_result", { task_id: taskId });
      if (r.data.status === "failed" || r.data.status === "cancelled") return { data: r.data, error: `Task ${r.data.status}`, loading: false };
      await new Promise(r => setTimeout(r, interval));
    }
    return { data: null, error: "Polling timed out", loading: false };
  }, [callTool]);

  return { callTool, pollTask, loading };
}
