import { useState, useCallback } from "react";

interface McpCallResult<T = unknown> {
  data: T | null; error: string | null; loading: boolean;
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
      const json = await res.json() as any;
      if (json.error) return { data: null, error: json.error.message, loading: false };
      const text = json.result?.content?.filter((c: any) => c.type === "text").map((c: any) => c.text).join("") ?? "";
      try { return { data: JSON.parse(text) as T, error: null, loading: false }; }
      catch { return { data: text as unknown as T, error: null, loading: false }; }
    } catch (err) { return { data: null, error: (err as Error).message, loading: false }; }
    finally { setLoading(false); }
  }, [endpoint]);

  const pollTask = useCallback(async (
    taskId: string, onProgress?: (p: number, s: string) => void, interval = 1000, max = 120,
  ): Promise<McpCallResult> => {
    for (let i = 0; i < max; i++) {
      const r = await callTool<any>("get_task_status", { task_id: taskId });
      if (r.error) return r;
      if (!r.data) return { data: null, error: "No data", loading: false };
      if (onProgress && r.data.progress !== undefined) onProgress(r.data.progress, r.data.current_step);
      if (r.data.status === "completed") return callTool("get_task_result", { task_id: taskId });
      if (r.data.status === "failed" || r.data.status === "cancelled") return { data: r.data, error: `Task ${r.data.status}`, loading: false };
      await new Promise(r => setTimeout(r, interval));
    }
    return { data: null, error: "Polling timed out", loading: false };
  }, [callTool]);

  return { callTool, pollTask, loading };
}
