/**
 * Integration test: verify all MCP tool names used in UI components
 * actually exist in the backend's tools/list.
 *
 * Catches the #1 UI↔backend mismatch: calling a tool that doesn't exist.
 *
 * Run: npm run test:integration
 * Requires: backend running on localhost:9876 (npm run dev)
 *
 * Skipped automatically when backend is not reachable.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { globSync } from "glob";

// ─── 1. Check backend availability ─────────────────────────────────

async function fetchBackendTools(): Promise<string[]> {
  try {
    const res = await fetch("http://localhost:9876/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    const text = await res.text();
    let json: any;
    if (text.startsWith("event:") || text.startsWith("data:")) {
      const dataLine = text.split("\n").find((l) => l.startsWith("data: "));
      json = dataLine ? JSON.parse(dataLine.slice(6)) : null;
    } else {
      json = JSON.parse(text);
    }

    return json?.result?.tools?.map((t: any) => t.name) ?? [];
  } catch {
    return [];
  }
}

const backendTools = await fetchBackendTools();
const backendAvailable = backendTools.length > 0;

// ─── 2. Extract tool names from UI source code ──────────────────────

function extractToolNamesFromUI(): { tool: string; file: string; line: number }[] {
  const uiDir = resolve(__dirname, "ui");
  const files = globSync("**/*.{ts,tsx}", { cwd: uiDir, absolute: true });

  const results: { tool: string; file: string; line: number }[] = [];

  // Patterns that call MCP tools:
  //   callTool("tool_name", ...)
  //   callTool<...>("tool_name", ...)
  //   onToolCall("tool_name", ...)
  //   handleToolCall("tool_name", ...)
  const callPattern = /(?:onToolCall|callTool|handleToolCall)\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g;

  for (const filePath of files) {
    if (filePath.includes("__tests__")) continue;
    if (filePath.includes("useMcpClient")) continue;

    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;
      callPattern.lastIndex = 0;
      while ((match = callPattern.exec(line)) !== null) {
        results.push({ tool: match[1], file: filePath, line: i + 1 });
      }
    }
  }

  return results;
}

// ─── 3. Tests (skipped when backend is not running) ─────────────────

describe.skipIf(!backendAvailable)("UI ↔ Backend tool name consistency", () => {
  it("all tool names used in UI must exist in backend", () => {
    const uiToolCalls = extractToolNamesFromUI();
    const uniqueTools = [...new Set(uiToolCalls.map((t) => t.tool))];
    const missing = uniqueTools.filter((t) => !backendTools.includes(t));

    if (missing.length > 0) {
      const details = missing
        .map((tool) => {
          const usages = uiToolCalls
            .filter((t) => t.tool === tool)
            .map((t) => `  ${t.file.split(/[/\\]/).pop()}:${t.line}`)
            .join("\n");
          return `"${tool}" not in backend:\n${usages}`;
        })
        .join("\n\n");

      expect.fail(
        `${missing.length} tool(s) used in UI but missing from backend:\n\n${details}\n\nAvailable tools: ${backendTools.join(", ")}`,
      );
    }
  });

  it("should list all UI tool calls for reference", () => {
    const uiToolCalls = extractToolNamesFromUI();
    const uniqueTools = [...new Set(uiToolCalls.map((t) => t.tool))];
    console.log(`\nUI uses ${uniqueTools.length} unique tools: ${uniqueTools.join(", ")}`);
    expect(true).toBe(true);
  });
});
