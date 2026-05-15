# Changelog

## v1.0.34 — 2026-05-15

### Added

- **Eager Bible generation on References mount** — until now, opening the
  References page when no upstream agent had seeded a Location Bible left
  every panel in the "Bible not found" failure state. The References page now
  calls `get_bible` on mount; if missing, it auto-fires `scout_location` (the
  existing async composite: research_era → write_bible → generate_anchor →
  create_floorplan) and surfaces a `BibleProgressPanel` at the top of the page
  while the pipeline runs. When the bible lands, the banner disappears and the
  page renders normally. Failures surface a Retry button.
- **Idempotency across remounts** — the in-flight scout task_id is stashed in
  `sessionStorage` under `ls.bible_task.${locationId}`. Re-mounts and tab
  switches re-attach to the existing task via `get_task_status` and continue
  polling, rather than starting a second pipeline. Cleared on terminal status.

### Contract change

LocationScout no longer requires an upstream agent (Orchestrator, manual
script analysis, fixture seeding) to write a Location Bible before the
References stage opens. LocationScout itself will initiate the scout pipeline
if the artifact is missing. The Orchestrator may also fan-out at
`extract_locations` time (planned in a separate change) — both layers are
idempotent and will not double-fire.

The underlying `scout_location` tool still auto-resolves `location_brief`
from 1AD and `director_vision` from Director via MCP — if those upstream
agents have no data for the project, the pipeline fails and the user sees
the error banner with Retry, instead of a silent "Bible not found".

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
