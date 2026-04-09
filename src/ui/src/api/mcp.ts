/**
 * Thin JSON-RPC 2.0 client for the Location Scout MCP server.
 *
 * The Vite dev server proxies /mcp → http://localhost:8080/mcp.
 * The server speaks the StreamableHTTP transport (SSE-style responses),
 * so requests must send `Accept: application/json, text/event-stream`.
 *
 * Each call sends a fresh `id` and parses the SSE `data:` payload.
 */

let nextId = 1;

export interface McpToolResult<T = unknown> {
  raw: unknown;
  data: T;
}

/**
 * Call an MCP tool by name. Returns the parsed JSON inside the first
 * text content block, plus the raw envelope for inspection.
 *
 * Throws on transport / JSON-RPC errors.
 */
export async function callTool<T = unknown>(
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult<T>> {
  const id = nextId++;
  const body = {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  };

  // Retry on 500/502/503 — backend may still be starting up.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    res = await fetch("/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(body),
    });
    if (res.ok || (res.status >= 400 && res.status < 500)) break;
    // Server error — wait and retry
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }

  if (!res || !res.ok) {
    throw new Error(`MCP HTTP ${res?.status ?? "no response"} for tool=${name}`);
  }

  const text = await res.text();

  // StreamableHTTP returns SSE: "event: message\ndata: {json}\n\n"
  // We extract the last `data:` line and parse it.
  const dataLine = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith("data:"))
    .pop();

  if (!dataLine) {
    throw new Error(`MCP empty response for tool=${name}: ${text.slice(0, 200)}`);
  }

  const envelope = JSON.parse(dataLine.slice(5).trim()) as {
    result?: { content?: Array<{ type: string; text?: string }> };
    error?: { code: number; message: string };
  };

  if (envelope.error) {
    throw new Error(`MCP error ${envelope.error.code}: ${envelope.error.message}`);
  }

  // Try to parse the first text-block content as JSON; fall back to the
  // raw string. Most Location Scout tools return a JSON-encoded string.
  const first = envelope.result?.content?.[0];
  let data: unknown = undefined;
  if (first?.type === "text" && typeof first.text === "string") {
    try {
      data = JSON.parse(first.text);
    } catch {
      data = first.text;
    }
  }

  return { raw: envelope, data: data as T };
}

/** Convenience: tools that take no args (ping, get_info). */
export const ping = () => callTool("ping", {});
export const getInfo = () => callTool("get_info", {});

export interface TaskStatus {
  task_id: string;
  status: "accepted" | "processing" | "completed" | "failed";
  progress: number;
  current_step: string;
  error?: string;
}

/**
 * Poll get_task_status until the task reaches a terminal state
 * (completed | failed) or `timeoutMs` elapses.
 *
 * On failure, also fetches get_task_result to retrieve the error message
 * (which get_task_status omits).
 *
 * @param onProgress  called every poll with the latest status
 * @param intervalMs  poll cadence in ms (default 1000)
 * @param timeoutMs   give up after this many ms (default 120000)
 */
export async function pollTask(
  taskId: string,
  onProgress?: (status: TaskStatus) => void,
  intervalMs = 1000,
  timeoutMs = 120000,
): Promise<TaskStatus> {
  const startedAt = Date.now();
  while (true) {
    const { data } = await callTool<TaskStatus>("get_task_status", { task_id: taskId });
    if (data) onProgress?.(data);

    if (data?.status === "completed") {
      return data;
    }

    if (data?.status === "failed") {
      // get_task_status doesn't include `error` — fetch the full result to surface it.
      try {
        const { data: result } = await callTool<{ error?: string }>("get_task_result", {
          task_id: taskId,
        });
        return { ...data, error: result?.error || data.error };
      } catch {
        return data;
      }
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`pollTask: timed out after ${timeoutMs}ms (last status=${data?.status})`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
