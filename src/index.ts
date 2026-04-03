import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { registerCommonTools } from "./tools/common.js";
import { registerLocationTools } from "./tools/location.js";
import { registerResources } from "./resources/location.js";
import { mountSwagger } from "./swagger.js";

const server = new McpServer({
  name: "location-scout-base",
  version: "1.0.0",
});

registerCommonTools(server);
registerLocationTools(server);
registerResources(server);

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

mountSwagger(app);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0", uptime_seconds: Math.floor(process.uptime()) });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Location Scout MCP server listening on port ${PORT}`);
});
