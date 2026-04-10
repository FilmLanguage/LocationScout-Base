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

<!-- WORKSPACE-DOCS-START -->
<!-- WORKSPACE-DOCS-START -->
## Workspace docs

All shared documentation lives in `../ai-stanislavsky-workspace/docs/`:

| Document | Content |
|----------|---------|
| `architecture.md` | System diagram, agent registry, data flow, tech stack |
| `glossary.md` | All terms: Bible, Anchor, Gate, Film IR, MCP, etc. |
| `design-system.md` | Color tokens, typography, spacing, components, interactive states |
| `ui-architecture.md` | Narrativity Editor layout, zones, agent panels |
| `agent-ui-setup.md` | **Canonical** Vite/TS/package.json setup for every agent's UI layer |
| `agent-capabilities.md` | Opt-in capabilities: Rationale, VLM Validation, Hard Gates — when to enable |
| `branch-strategy.md` | `main` (integration) / `release` (production) / `experiment/*` — merge rules |
| `deploy-model.md` | Current: Variant 2+CI (local gcloud). Future: Variant 1 (WIF+Actions) |
| `design-links.md` | Figma file URLs, local design references |
| `skills.md` | All Claude Code skills: commands, descriptions, workflows |
| `guides/` | Long-form guides: developer (RU), skills reference, UI designer |
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
