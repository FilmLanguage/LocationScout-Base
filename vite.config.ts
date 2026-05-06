import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy injects x-agent-token from INTER_AGENT_TOKEN (.env) or VITE_AGENT_TOKEN
// so the browser UI can call /mcp without per-request auth wiring. Production
// deployments handle auth via the calling agent — this is dev-only.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", ["INTER_AGENT_TOKEN", "VITE_"]);
  const token = env.INTER_AGENT_TOKEN || env.VITE_AGENT_TOKEN || "";
  const proxyConfig = {
    target: "http://localhost:8080",
    changeOrigin: true,
    configure: (proxy: { on: (event: string, cb: (req: { setHeader: (k: string, v: string) => void }) => void) => void }) => {
      if (!token) return;
      proxy.on("proxyReq", (proxyReq) => {
        proxyReq.setHeader("x-agent-token", token);
      });
    },
  };
  return {
    plugins: [react()],
    root: ".",
    server: {
      port: 5176,
      proxy: {
        "/mcp": proxyConfig,
        "/health": proxyConfig,
      },
    },
    build: { outDir: "dist-ui" },
  };
});
