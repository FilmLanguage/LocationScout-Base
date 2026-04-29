# Changelog

## Unreleased

### Fixed

- **Anchor renders as isometric, not photo (run-019 I5)** — `generate_anchor` was using
  the isometric.png as a high-strength img2img reference, so FAL's nano-banana inherited
  the isometric aesthetic and produced 3D-illustration-styled anchors (run-018 anchor.png
  was visually indistinguishable from isometric.jpg). Three changes: (a) anchor prompt
  template now opens with "photorealistic, eye-level wide establishing shot, real
  photograph captured on film" and explicitly negates "isometric / axonometric / 3D
  render / schematic", (b) `image_ref_strength` for non-edit anchor generations defaults
  to 0.35 (was unset → FAL default), so the prompt dominates over the isometric ref,
  (c) negative_prompt for anchor adds isometric/3D-style terms (kept for the few models
  that honour it). Architecture preserved: floorplan→isometric→anchor still chains.

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
