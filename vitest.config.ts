import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Vitest 3 single-config with environmentMatchGlobs so backend tests run in
// Node and UI component tests (.tsx under src/ui/src/) run in jsdom.
// Phase 2 prep: enables React Testing Library acceptance tests at
// src/ui/src/__tests__/*.test.tsx without breaking the backend node tests.
//
// React dedupe (Phase 3a): the repo has two React installs side-by-side —
// root `node_modules/react` (devDependency for vitest + RTL) and
// `src/ui/node_modules/react` (the UI app's own dep, used by Vite at build).
// Without the alias below, a hook file under `src/ui/src/hooks/*` resolved
// `import "react"` to the NESTED copy while @testing-library/react (hoisted
// to root) still held root's react-dom — two React instances in the same
// render → `useState` reads from a null dispatcher and crashes. Pinning
// every `react` / `react-dom` import to root's copy keeps the dispatcher
// consistent across the whole test module graph, including hook source
// files under `src/ui/src/`.
const ROOT_REACT = path.resolve("node_modules/react");
const ROOT_REACT_DOM = path.resolve("node_modules/react-dom");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: ROOT_REACT,
      "react-dom": ROOT_REACT_DOM,
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    include: ["src/**/*.test.ts", "src/ui/src/**/*.test.{ts,tsx}"],
    // src/ui/node_modules contains thousands of vendor tests (zod, pg-protocol).
    // Allow our own UI tests at src/ui/src/**, exclude only the nested deps.
    exclude: ["src/ui/node_modules/**", "node_modules/**"],
    environmentMatchGlobs: [
      ["src/ui/src/**", "jsdom"],
    ],
    setupFiles: ["./test/setup.ts"],
  },
});
