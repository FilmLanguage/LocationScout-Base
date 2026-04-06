# Location Scout — MCP Server

Location research, Bible writing, anchor image generation, mood state creation, and spatial planning agent for the Film Language platform.

## MCP Server: `location-scout-base`

**Cloud Run:** `fl-location-scout-base`
**Endpoint:** `/mcp`
**Transport:** Streamable HTTP (stateless)

## Tools

### Common (all agents)
- `ping` — Health check
- `get_info` — Agent metadata
- `get_task_status` — Async task status
- `get_task_result` — Completed task result
- `cancel_task` — Cancel running task
- `approve_artifact` — Gate approval
- `reject_artifact` — Gate rejection
- `request_revision` — Request artifact revision
- `submit_feedback` — Advisory feedback

### Domain — Pipeline
- `scout_location` — Full pipeline: research + bible + anchor + floorplan
- `research_era` — Historical research step
- `write_bible` — Generate Location Bible
- `generate_anchor` — Generate anchor image
- `create_mood_states` — Generate mood deltas per scene
- `create_floorplan` — Generate spatial layout + light map
- `extract_setups` — Per-scene camera setups

### Domain — Read
- `get_bible` — Read Location Bible
- `get_mood_state` — Read mood state
- `get_setup_prompt` — Get generation prompt for a setup image
- `get_outputs` — All output artifacts grouped by consumer

### Domain — Validation
- `check_era_accuracy` — Validate Bible against research pack for anachronisms
- `check_consistency` — Cross-check Bible, anchor, and mood states

### Domain — Research Cycle (W2)
- `add_fact` — Add period fact to research pack
- `add_anachronism` — Add anachronism to negative list

### Domain — Reference Generation (W4)
- `manual_setup_input` — Manually add/edit a camera setup

### Domain — Setups & Variations (W5/W6)
- `compare_with_anchor` — Compare setup image vs anchor (perceptual similarity)
- `apply_mood_suggestion` — Apply AI-suggested mood configuration
- `dismiss_mood_suggestion` — Dismiss AI mood suggestion
- `add_mood_variation` — Add mood variation and trigger image generation

## Resources

- `agent://location-scout/bible/{id}` — Location Bible (JSON)
- `agent://location-scout/anchor/{id}` — Anchor image (PNG)
- `agent://location-scout/mood/{id}` — Mood state (JSON)
- `agent://location-scout/floorplan/{id}` — Floorplan (PNG)
- `agent://location-scout/setup/{id}` — Setup extraction (JSON)
- `agent://location-scout/task/{id}` — Task status (JSON)
- `agent://location-scout/schema/{type}` — JSON Schema

## Development

```bash
npm install
npm run dev          # Start with hot-reload
npm run build        # Compile TypeScript
npm run inspect      # MCP Inspector
```

## Testing

```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'
```
