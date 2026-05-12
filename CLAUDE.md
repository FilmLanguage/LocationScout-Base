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

## Who depends on this agent

- **Shot Generation** — reads Location Bible + Anchor + Mood States for visual consistency (ConsisID prompt context)

## Current implementation

| File | Status | What it does |
|------|--------|--------------|
| `src/index.ts` | ✓ Done | Express + MCP server, 25MB body limit (base64 images), CORS, inter-agent auth |
| `src/tools/location.ts` | ✓ Done | 25 domain tools: scout, research_era, write_bible, generate_anchor, create_mood_states, create_floorplan, extract_setups, generate_setup_images, check_era_accuracy, check_consistency, compare_with_anchor, + prompt assembly / mood helpers |
| `src/tools/references.ts` | ✓ Done | 3 reference tools: upload_reference, list_user_references, list_location_images |
| `src/tools/common.ts` | ✓ Done | 9 shared FLACP tools (ping, approve, reject, task management) |
| `src/resources/location.ts` | ✓ Done | 10 MCP resources: bible, anchor, mood, floorplan, isometric, comparison, setup, task, research, schema |
| `src/lib/db.ts` | ✓ Done | Yandex PG adapter — PRIMARY write-path; v2 tables: `location_bibles`, `location_research_packs`, `mood_states`, `floorplans`, `location_setups`; circuit breaker (5 failures → 30s open) |
| `src/lib/storage.ts` | ✓ Done | Multi-tier artifact storage: memory → disk → S3 |
| `src/lib/mcp-resource-client.ts` | ✓ Done | Reads upstream: 1AD film-ir, Director location-vision via MCP |
| `src/lib/api-client.ts` | ✓ Done | FAL.ai image generation + Anthropic LLM completion |
| `src/lib/gemini-vision.ts` | ✓ Done | Anchor validation via Gemini Vision API |
| `src/lib/prompt-assembly.ts` | ✓ Done | Builds prompt variables for anchor / isometric / setup generation |
| `src/prompts/` | ✓ Done | 15 markdown prompts + `prompts-manifest.json` (research, bible, anchor, mood, setup, validation) |
| `_schemas/` | ✓ Synced | `@filmlanguage/schemas` incl. `LocationBibleSchema`, `MoodStateSchema`, `ResearchPackSchema` |

## Key patterns (reference implementation)

1. **Tool registration**: `src/tools/location.ts` — Zod input schemas, structured hint responses
2. **Resource registration**: `src/resources/location.ts` — URI templates, mime types
3. **DB-first storage**: `src/lib/db.ts` + `src/lib/storage.ts` — write to PG, replicate to S3
4. **Error handling**: `src/lib/errors.ts` — Film Language error codes
5. **VLM validation**: `src/lib/anchor-validator.ts` — Gemini Vision checks anchor against Bible

## Tool flow

```
scout_location({project_id, location_id})         [async composite]
  ├── readAgentResource(AGENT_1AD_URL, film-ir)    → location brief
  ├── readAgentResource(AGENT_DIRECTOR_URL, location-vision) → director notes
  ├── research_era(...)   → research_pack (DB: v2.location_research_packs)
  ├── write_bible(...)    → location_bible (DB: v2.location_bibles)
  ├── generate_anchor(...)
  │     ├── prompt_assembly.buildAnchorVars(bible)
  │     ├── FAL.ai image generation
  │     ├── gemini-vision validate anchor vs bible
  │     └── storage.saveBlobTwoPhase (S3 + v2.blobs)
  └── create_floorplan(...)  → floorplan (DB: v2.floorplans)

create_mood_states({project_id, location_id, scene_ids})
  ├── readArtifact("bible")   [local / DB]
  ├── for each scene: LLM → MoodStateSchema.safeParse
  └── saveArtifact("mood", state) → DB: v2.mood_states
```

## Tests

Unit tests run via `npm test` (default vitest). Inter-tool name parity runs via `npm run test:integration` (the existing `tool-names` suite). Integration tests against real Postgres live at `src/integration/*.test.ts` and run via `npm run test:integration:pg` — they require Docker (testcontainers spins up `postgres:16-alpine`, applies workspace `db/v2-schema.sql`, exercises the canonical chain `saveArtifact("research") → saveArtifact("bible") → saveBlobTwoPhase("anchor")`, and asserts `v2.location_research_packs`, `v2.location_bibles`, `v2.blobs`, and `v2.events` rows). Excluded from the default `npm test` run because container startup is ~30 s.

<!-- WORKSPACE-DOCS-START -->
## Workspace docs

All shared documentation lives in `../ai-stanislavsky-workspace/docs/`. Full docs index with descriptions → workspace `CLAUDE.md` (canonical).
<!-- WORKSPACE-DOCS-END -->

## Local development

```bash
# Start 1AD-Base and Director-Base first (LocationScout reads from both)
cd ../1AD-Base && npm start          # :8081
cd ../Director-Base && npm start     # :8082

cd ../LocationScout-Base
npm install    # once
npm run dev    # tsx watch, hot reload
```

Env vars required (see `.env`):
```
PORT=8085
ANTHROPIC_API_KEY=sk-ant-...
FAL_KEY=...
GEMINI_API_KEY=...
AGENT_1AD_URL=http://localhost:8081
AGENT_DIRECTOR_URL=http://localhost:8082
# Yandex PG (optional for local dev — agent degrades gracefully without it)
YANDEX_DB_HOST=...
YANDEX_DB_NAME=filmlanguage
YANDEX_DB_USER=...
YANDEX_DB_PASSWORD=...
```


## Figma

Follow the 4-step UI workflow in `docs/canonical/ui-architecture.md` and design rules in `docs/canonical/design-system.md`.

| Resource | URL |
|----------|-----|
| **Design System** | [narrativity-UI?node-id=326-2](https://www.figma.com/design/PnAhZwUJJmtTBRJWZh08ed/narrativity-UI?node-id=326-2) |
| **Location Scout** | [narrativity-UI?node-id=264-800](https://www.figma.com/design/PnAhZwUJJmtTBRJWZh08ed/narrativity-UI?node-id=264-800) |
