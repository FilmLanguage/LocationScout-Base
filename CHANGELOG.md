# Changelog

## Unreleased

### Fixed

- **MCP transport crash** — server crashed after the first `/mcp` request due to
  `server.connect()` being called multiple times on a single `McpServer` instance
  without `close()`. The MCP SDK does not allow re-connection.

### Known performance costs

- **[PERF-001]** `createServer()` per request — a new `McpServer` is instantiated
  and all tools/resources are re-registered on every incoming `/mcp` POST. This is
  the safe fix for the transport crash, but adds overhead per request (29 tools +
  8 resources registered each time). Replace with a pooling or session-based
  approach once the `@modelcontextprotocol/sdk` supports multiple transports on a
  single server instance, or when latency becomes a concern under load.
