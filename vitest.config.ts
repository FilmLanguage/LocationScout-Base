import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // src/ui/node_modules contains thousands of vendor tests (zod, pg-protocol).
    // Allow our own UI tests at src/ui/src/**, exclude only the nested deps.
    exclude: ["src/ui/node_modules/**", "node_modules/**"],
  },
});
