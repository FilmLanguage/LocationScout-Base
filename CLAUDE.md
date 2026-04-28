# Location Scout — Reference Implementation

## Role

The **Location Scout** researches locations, creates Location Bibles, generates anchor images, mood states, floorplans, and setup extractions. This is the **reference implementation** — all other agents should follow its patterns.

## Position in pipeline

```
1AD (Location Brief) + Director (DFV) → [Location Scout] → Bible, Anchor, Moods, Floorplan, Setups
```

## What this agent produces

| Artifact | Description |
|----------|-------------|
| **Location Bible** | Canonical text description (`LocationBibleSchema`) |
| **Anchor Image** | First approved image (visual source of truth) |
| **Mood States** | Per-scene light/weather deltas (`MoodStateSchema`) |
| **Floorplan** | Top-down spatial map |
| **Setup Extractions** | Per-scene camera configurations |
| **Research Pack** | Historical research (`ResearchPackSchema`) |

## Dependencies

| Source | Resource URI |
|--------|-------------|
| 1AD | `agent://1ad/film-ir/{project_id}` |
| Director | `agent://director/vision/dfv/{project_id}` |

## Implementation status: COMPLETE

All 20 domain tools + 9 common tools (29 total) + 8 resources are implemented.

## Key patterns for other agents to follow

1. **Tool registration**: `src/tools/location.ts` — Zod schemas, hints, structured responses
2. **Resource registration**: `src/resources/location.ts` — URI templates, mime types
3. **Schema usage**: `_schemas/src/` — import types, validate inputs/outputs
4. **Error handling**: `src/lib/errors.ts` — Film Language error codes
5. **Swagger/OpenAPI**: `src/swagger.ts` — auto-generated docs

## Tests

Unit tests run via `npm test` (default vitest). Inter-tool name parity runs via `npm run test:integration` (the existing `tool-names` suite). Integration tests against real Postgres live at `src/integration/*.test.ts` and run via `npm run test:integration:pg` — they require Docker (testcontainers spins up `postgres:16-alpine`, applies workspace `db/v2-schema.sql`, exercises the canonical chain `saveArtifact("research") → saveArtifact("bible") → saveBlobTwoPhase("anchor")`, and asserts `v2.location_research_packs`, `v2.location_bibles`, `v2.blobs`, and `v2.events` rows). Excluded from the default `npm test` run because container startup is ~30 s.

<!-- WORKSPACE-DOCS-START -->
## Workspace docs

All shared documentation lives in `../ai-stanislavsky-workspace/docs/`. Full docs index with descriptions → workspace `CLAUDE.md` (canonical).
<!-- WORKSPACE-DOCS-END -->

## Development

```bash
npm install && npm run dev
```


## Figma workflow (Phase 10: UI)

When building the UI panel for this agent, follow the 4-step Figma workflow.

### Step 1: Draft in Figma

Use the Figma MCP tools to create the initial mockup:

```
get_design_context  — read existing narrativity-UI layout for context
use_figma           — create agent panel components via Plugin API
get_screenshot      — capture result for review
```

**Figma file**: `https://www.figma.com/design/PnAhZwUJJmtTBRJWZh08ed/narrativity-UI`

Start by reading the existing Narrativity Editor layout (`get_design_context`), then create the agent panel inside it. Follow:
- Agent panel pattern from `../ai-stanislavsky-workspace/docs/ui-architecture.md`
- Color tokens, typography, spacing from `../ai-stanislavsky-workspace/docs/design-system.md`
- Interactive states (8-state model) and motion tokens from the same design system

### Step 2: Refinement

Manual polish in Figma: add states (hover, focus, disabled, loading, error, success), micro-interactions, edge cases. Use `search_design_system` to find reusable components.

### Step 3: Handoff

Extract structure from Figma to code:
- `get_design_context` with node ID — get code + assets for specific components
- `get_variable_defs` — extract design tokens used
- `get_metadata` — get layer structure

### Step 4: Assembly

Build the React UI component from the Figma handoff. Deploy to Narrativity Editor (Replit).

### Design rules

- **Bible First rule**: generation UI controls disabled until Bible has `approval_status: "approved"`
- **Gate visualization**: red border + badge when gate blocks downstream
- **Negative list**: always red tags (`--red`), never collapsible
- **Delta display**: inherited values dimmed, overrides highlighted with arrows
- Reduced motion: mandatory `@media (prefers-reduced-motion: reduce)`
- All interactive elements: declare which of 8 states apply (use state matrix template)
- Touch targets: 44x44px minimum
- Color contrast: 4.5:1 text, 3:1 UI components

## Figma

| Resource | URL |
|----------|-----|
| **Design System** (all agents) | [https://www.figma.com/design/PnAhZwUJJmtTBRJWZh08ed/narrativity-UI?node-id=326-2](https://www.figma.com/design/PnAhZwUJJmtTBRJWZh08ed/narrativity-UI?node-id=326-2) |
| **Location Scout [Claude]** (this agent) | [https://www.figma.com/design/PnAhZwUJJmtTBRJWZh08ed/narrativity-UI?node-id=264-800](https://www.figma.com/design/PnAhZwUJJmtTBRJWZh08ed/narrativity-UI?node-id=264-800) |

Design tokens come from the Design System page via `@filmlanguage/tokens` (in `_tokens/`). Never hardcode color/font values — import from `tokens.ts`.
