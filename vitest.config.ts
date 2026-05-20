import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest 3 single-config with environmentMatchGlobs so backend tests run in
// Node and UI component tests (.tsx under src/ui/src/) run in jsdom.
// Phase 2 prep: enables React Testing Library acceptance tests at
// src/ui/src/__tests__/*.test.tsx without breaking the backend node tests.
export default defineConfig({
  plugins: [react()],
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
