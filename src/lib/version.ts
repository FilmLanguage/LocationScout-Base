import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared VERSION for MCP server init, /health endpoint, and the common
 * `ping` tool. Read from package.json at startup, with `VERSION` env var
 * as an optional override. Stripping the env var (or leaving it unset)
 * makes package.json the single source of truth.
 */

function __dirnameFromMetaUrl(metaUrl: string): string {
  const p = new URL(metaUrl).pathname;
  // Windows: strip leading "/" from "/C:/path"
  const normalized = /^\/[A-Za-z]:\//.test(p) ? p.slice(1) : p;
  return normalized.substring(0, normalized.lastIndexOf("/"));
}

const __pkgVersion: string = (() => {
  try {
    const __dir = __dirnameFromMetaUrl(import.meta.url);
    // src/lib/version.ts -> dist/lib/version.js -> ../../package.json
    return JSON.parse(readFileSync(join(__dir, "..", "..", "package.json"), "utf8")).version;
  } catch {
    return "dev";
  }
})();

export const VERSION: string = process.env.VERSION ?? __pkgVersion;
