const INTER_AGENT_TOKEN = process.env.INTER_AGENT_TOKEN ?? "";

export async function readAgentResource(agentBaseUrl: string, uri: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${agentBaseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        ...(INTER_AGENT_TOKEN ? { "Authorization": `Bearer ${INTER_AGENT_TOKEN}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "resources/read", params: { uri }, id: 1 }),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      const text = await res.text();
      for (const line of text.split("\n")) {
        if (line.startsWith("data:")) {
          try {
            const msg = JSON.parse(line.slice(5).trim());
            const content = msg?.result?.contents?.[0]?.text;
            if (content) return JSON.parse(content);
          } catch { /* skip */ }
        }
      }
      return null;
    }
    const json = await res.json() as Record<string, unknown>;
    const textVal = ((json?.result as Record<string, unknown>)?.contents as Array<{text?: string}>)?.[0]?.text;
    return textVal ? JSON.parse(textVal) : null;
  } catch { return null; }
}
