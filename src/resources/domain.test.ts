/**
 * Resource registration tests for Location Scout (Wave 3 task 4.3).
 *
 * Catches two specific footguns that broke 75 sites earlier this session:
 *
 * 1. Plain-string parameterized URIs. Per
 *    docs/canonical/inter-agent-communication-plan.md §2.2, any URI containing
 *    `{param}` MUST be wrapped in `new ResourceTemplate(uri, { list: undefined })`.
 *    A plain string with `{` registers as a literal — the SDK matches it
 *    character-for-character and every concrete URI returns
 *    `-32602 Resource not found`.
 *
 * 2. Legacy "JSON-in-200" miss envelope. The post-B1b shape for a missing
 *    artifact is `{ contents: [] }` — an empty envelope. The legacy bug returned
 *    `{ contents: [{ ..., text: '{"error":"not_found"}' }] }`, which presents
 *    a 200-OK to the client and a parsed body that *looks* successful. Tests
 *    here invoke each handler with a synthetic URL pointing at a non-existent
 *    id and assert the empty envelope.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

interface Capture {
  name: string;
  uriOrTemplate: unknown;
  metadata: { description?: string; mimeType?: string };
  handler: (uri: URL) => Promise<{ contents: unknown[] }>;
}

const captured: Capture[] = [];

const fakeServer = {
  resource: (
    name: string,
    uriOrTemplate: unknown,
    metadata: { description?: string; mimeType?: string },
    handler: (uri: URL) => Promise<{ contents: unknown[] }>,
  ) => {
    captured.push({ name, uriOrTemplate, metadata, handler });
  },
} as unknown as Parameters<
  typeof import("./location.js").registerResources
>[0];

let tempDir: string;
let originalEnv: string | undefined;

beforeAll(async () => {
  originalEnv = process.env.LOCAL_OUTPUT_DIR;
  tempDir = mkdtempSync(join(tmpdir(), "ls-resources-test-"));
  process.env.LOCAL_OUTPUT_DIR = tempDir;
  const mod = await import("./location.js");
  mod.registerResources(fakeServer);
});

afterAll(() => {
  if (originalEnv === undefined) delete process.env.LOCAL_OUTPUT_DIR;
  else process.env.LOCAL_OUTPUT_DIR = originalEnv;
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

describe("registerResources — registration shape", () => {
  it("registers at least one resource", () => {
    expect(captured.length).toBeGreaterThan(0);
  });

  it("every parameterized URI uses ResourceTemplate (rule 2.2)", () => {
    const drift: string[] = [];
    for (const r of captured) {
      const isTemplate = r.uriOrTemplate instanceof ResourceTemplate;
      const isString = typeof r.uriOrTemplate === "string";
      if (isString && (r.uriOrTemplate as string).includes("{")) {
        drift.push(`${r.name} → plain string with {param}: ${r.uriOrTemplate}`);
      } else if (!isTemplate && !isString) {
        // Some other unexpected shape — treat as drift to flag.
        drift.push(`${r.name} → unexpected uri type ${typeof r.uriOrTemplate}`);
      }
    }
    expect(drift, drift.join("\n")).toEqual([]);
  });

  it("every resource handler is a function", () => {
    for (const r of captured) {
      expect(typeof r.handler, r.name).toBe("function");
    }
  });
});

describe("registerResources — miss envelope shape (post-B1b)", () => {
  // Build a concrete URL by replacing the {param} segment with a synthetic id
  // that won't exist in the (empty) tmp storage.
  function concretizeUri(template: string, missId: string): string {
    return template.replace(/\{[^}]+\}/g, missId);
  }

  // Pull the original template string out of either ResourceTemplate or plain
  // string — for building a synthetic URL to feed the handler.
  function templateString(uriOrTemplate: unknown): string {
    if (uriOrTemplate instanceof ResourceTemplate) {
      // SDK 1.12+: ResourceTemplate exposes the raw template via uriTemplate.
      const raw = (uriOrTemplate as unknown as { uriTemplate?: { toString(): string } | string }).uriTemplate;
      if (typeof raw === "string") return raw;
      if (raw && typeof raw === "object" && "toString" in raw) return raw.toString();
    }
    if (typeof uriOrTemplate === "string") return uriOrTemplate;
    throw new Error(`Cannot derive template string from ${typeof uriOrTemplate}`);
  }

  for (const name of [
    "bible",
    "anchor",
    "mood",
    "floorplan",
    "isometric",
    "comparison",
    "setup",
    "task",
    "research",
  ]) {
    it(`${name}: missing id returns empty envelope, not legacy not_found JSON`, async () => {
      const r = captured.find((x) => x.name === name);
      expect(r, `resource "${name}" not registered`).toBeDefined();

      const tmpl = templateString(r!.uriOrTemplate);
      const concrete = concretizeUri(tmpl, "definitely_does_not_exist_xyz");
      const result = await r!.handler(new URL(concrete));

      expect(result, `${name} response shape`).toBeDefined();
      expect(Array.isArray(result.contents), `${name} contents must be an array`).toBe(true);

      // Post-B1b contract: miss = empty contents array.
      expect(result.contents.length, `${name} miss must be empty contents`).toBe(0);

      // Defense-in-depth: if a future change adds content on miss, ensure it
      // is NOT the legacy `{"error":"not_found"}` JSON-in-200 envelope that
      // every consumer parsed as a hit.
      for (const c of result.contents) {
        const text = (c as { text?: string }).text;
        if (typeof text === "string") {
          let parsed: unknown = null;
          try {
            parsed = JSON.parse(text);
          } catch {
            /* not JSON, fine */
          }
          if (parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).error === "not_found") {
            throw new Error(
              `${name}: legacy not_found JSON-in-200 envelope leaked back into the handler`,
            );
          }
        }
      }
    });
  }

  it("schema (non-storage-backed): unknown type returns enveloped error, not empty", async () => {
    // The `schema` resource is intentionally different — it serves static JSON
    // Schemas, not user artifacts, so an unknown type returns an explicit
    // enveloped error rather than {contents:[]}. Lock that contract here so a
    // future "normalize all misses to empty" refactor doesn't silently break
    // schema consumers.
    const r = captured.find((x) => x.name === "schema");
    expect(r).toBeDefined();
    const result = await r!.handler(new URL("agent://location-scout/schema/no-such-schema"));
    expect(result.contents.length).toBe(1);
    const text = (result.contents[0] as { text: string }).text;
    const parsed = JSON.parse(text) as { error?: string; available?: string[] };
    expect(parsed.error).toBe("unknown_schema_type");
    expect(Array.isArray(parsed.available)).toBe(true);
  });
});
