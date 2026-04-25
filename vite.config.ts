import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  server: {
    port: 5176,
    proxy: {
      "/mcp": { target: "http://localhost:8083", changeOrigin: true },
      "/health": { target: "http://localhost:8083", changeOrigin: true },
    },
  },
  build: { outDir: "dist-ui" },
});
