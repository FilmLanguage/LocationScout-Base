/**
 * Simple prompt loader — reads .md files from `src/prompts/` relative to the caller.
 * Mirrors `loadPrompt` from `@filmlanguage/llm-toolkit` so prompts can live as
 * editable markdown files instead of inline string literals.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function loadPrompt(importMetaUrl: string, name: string): string {
  const callerDir = dirname(fileURLToPath(importMetaUrl));
  const promptPath = resolve(callerDir, "..", "prompts", `${name}.md`);
  return readFileSync(promptPath, "utf8");
}
