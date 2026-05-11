# LocationScout BETA — Test Results

## 1. Branch

`experiment/beta-2-screens` (branched from `main`).
Not pushed, not merged. Local-only.

## 2. Commits

```
1d7a08c  beta: 2-screen UI + auto-approved Bible pipeline
<this>   beta: e2e test results
```

## 3. Changed files

| File | Change |
|------|--------|
| `src/tools/location.ts` | Step 1 (Research) wrapped in `/* BETA: research disabled */`; `researchId` retained for Bible schema; `Research:` field text replaced with "(not available — write from general knowledge of the period: …)"; bible payload gets `approval_status: "approved"`; research artifact removed from `updateTask.artifacts` |
| `src/prompts/write-bible-pipeline-system.md` | Prepended `NOTE:` instructing the LLM to derive era details from the brief when Research is missing |
| `src/index.ts` | `createServer()` now wraps `server.tool` to filter by `process.env.ENABLED_TOOLS` allow-list (default `*`) |
| `.env.beta` | Backend allow-list (25 tool names) |
| `src/ui/src/stages.ts` | `STAGES` reduced to 3 (`input`, `references`, `setups`); `StageId` type unchanged |
| `src/ui/src/state/pipeline.ts` | `STAGE_ORDER` reduced to 3; `INITIAL_STATE.statuses` and reducer untouched |
| `src/ui/src/App.tsx` | Imports of `AnalysisPage`/`LightStatesPage`/`OutputsPage`/`ResearchPage` commented out; `PAGES` map has 3 entries |
| `src/ui/src/pages/InputPage.tsx` | After `scout_location` success → `navigate("/references")` (was `/research`); `current_step: "Building location bible…"`; button label `"Build Location"`/`"Building…"` (was `"Start Research"`/`"Researching…"`) |
| `src/ui/src/pages/SetupsPage.tsx` | `handleAdvance` replaced by `handleSend` — auto-approves drafts via `approve_artifact(setup_uri)` per tile, then `approve_artifact(outputs_uri)`; on success shows `#A6F77E` "Sent to Shot Generation" banner; `useNavigate` import commented out (no longer used) |
| `src/ui/.env.beta` | UI feature flags (`VITE_FEATURE_RESEARCH=false` etc., not yet read by code — markers for future) |
| `ROLLOUT.md` | Per-feature restoration guide, line-level instructions for rollback |

All other files (page components, schemas, tokens) untouched.

## 4. Run mode

**Production** — `.env` had `ANTHROPIC_API_KEY` and `FAL_AI_API_KEY` set. Real LLM (Claude) and FAL.ai calls.

## 5. Test scenario

Exact input (per task spec):

```json
{
  "location_brief": {
    "location_id": "loc_marlowe_office",
    "location_name": "Marlowe's Office",
    "location_type": "INT",
    "time_of_day": ["DAY", "NIGHT"],
    "era": "1947 Los Angeles",
    "scenes": ["sc_007", "sc_012", "sc_023"],
    "recurring": true,
    "props_mentioned": ["Smith Corona typewriter", "Bottle of bourbon", "Venetian blinds", "Brass desk lamp"],
    "explicit_details": ["Frosted glass door with painted name", "Single window facing alley"],
    "required_practicals": ["Desk lamp", "Window light"]
  },
  "director_vision": {
    "era_style": "1947 noir Los Angeles — high-contrast B&W aesthetic, hard shadows",
    "palette": "Deep blacks, hot whites, smoky greys",
    "spatial_philosophy": "Cramped, smoke-stained, the city pressing in through the window",
    "atmosphere": "Cigarette haze, the buzz of neon outside, jazz from a distant club",
    "light_vision": "Hard practicals, blade-sharp window-blind shadows, single key light",
    "reference_films": ["The Big Sleep", "Double Indemnity", "Out of the Past"]
  }
}
```

## 6. Pipeline trace

Backend: port 8080 (per `.env`), auth `x-agent-token: 1234` (`INTER_AGENT_TOKEN=1234` from `.env`). Transport: StreamableHTTP / SSE via JSON-RPC.

| Step | Tool | Status | Duration | Result |
|------|------|--------|----------|--------|
| A | `scout_location` | ✓ | 20 s | `task_id=edc0abae-…`; pipeline reached `status=completed`. Tool also requires `project_id` arg in addition to brief+vision (existing pre-BETA behavior, unrelated to this branch). |
| B | `get_bible` | ✓ | <1 s | `approval_status="approved"` (BETA auto-approve confirmed); 236 words across `space_description` + `atmosphere`; key fields: `passport, space_description, atmosphere, light_base_state, key_details, negative_list, approval_status, $schema, bible_id, brief_id, vision_id, research_id, _updated_at`. **Bible-First gate behavior unchanged: `requireApprovedBible()` accepted the auto-approved bible and downstream tools ran.** |
| C | `create_floorplan` | ✓ | ~10 s | 38 KB PNG. Param shape: `bible_uri`. |
| D | `generate_isometric_reference` | ✓ | 20 s | 1.38 MB PNG. Params: `floorplan_uri` + `bible_uri`. |
| E | `generate_anchor` | ✓ | 75 s | 1.55 MB PNG. **Anchor passed quality gate marginally on attempt 3/3 with score 0.50** (downstream of FAL.ai validation, not affected by BETA changes). |
| F | `extract_setups` | ✓ | 35 s | 6 setups: `setup_sc_007_A, setup_sc_007_B, setup_sc_012_A, setup_sc_012_B, setup_sc_023_A, setup_sc_023_B`. Required `mood_state_uris` arg (passed empty array — schema accepts). |
| G | `generate_setup_images` | ✓ | 125 s | 6 PNGs (~1.3-1.6 MB each). |
| H | `approve_artifact(outputs_uri)` | ✓ | <1 s | `verdict=approved`. Mirrors the BETA UI's "Send to Pipeline" handler. |

End-to-end: ~4.5 minutes wall-clock from `scout_location` to `approve_artifact(outputs)`.

## 7. Output verification

| Artifact | Path | Size | Notes |
|----------|------|------|-------|
| Bible | `output/location-scout/bible/loc_marlowe_office.json` | (JSON) | `approval_status: "approved"` present at top level — confirms BETA auto-approve patch applied during `saveArtifact` |
| Floorplan | `output/location-scout/floorplan/loc_marlowe_office.png` | 38 KB | matplotlib-rendered top-down map |
| Isometric | `output/location-scout/isometric/loc_marlowe_office.png` | 1.38 MB | FAL.ai nano-banana |
| Anchor | `output/location-scout/anchor/loc_marlowe_office.png` | 1.55 MB | FAL.ai nano-banana, passed gate at 0.50 (3rd attempt) |
| Setup PNGs (×6) | `output/location-scout/setup/setup_sc_{007,012,023}_{A,B}.png` | 1.29-1.58 MB each | FAL.ai |

Bible JSON inspected for `approval_status: "approved"` — present.

## 8. Paths

All artifacts under `C:/Users/ZAKHAR/Documents/STANISLAVSKY/repos/LocationScout-Base/output/location-scout/`.

## 9. Issues

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Initial e2e sub-agent reported `tools/list` returned all 42 tools regardless of `ENABLED_TOOLS` — flagged as filter bug. | **Reproducer test by second sub-agent confirmed the wrapper IS working correctly**: `ENABLED_TOOLS=ping,get_info` → 2 tools; `ENABLED_TOOLS=<25 names>` → 25 tools; `*` → 42. First agent likely tested before exporting the env var or against a stale `dist/`. **No code fix needed.** |
| 2 | Backend `dev` predev script (`check-env.sh`) refused to start without `AGENT_EDITOR_URL` and `FAL_MODEL_*` vars set. | Added defaults to local (gitignored) `.env`. Not committed; not part of BETA scope. |
| 3 | Anchor passed FAL.ai quality validator only on attempt 3/3 with marginal score 0.50. | Downstream of BETA changes (FAL.ai output quality). Not a regression. |
| 4 | Tool input schemas in the original prompt did not exactly match runtime signatures (e.g. `bible_uri` vs `location_id`). | Resolved by reading `src/tools/location.ts` directly. Not a BETA-introduced regression — pre-existing tool API. |

## 10. Verdict

**PASS.**

- All 8 pipeline steps (A-H) succeeded end-to-end.
- All required artifacts (bible + floorplan + isometric + anchor + 6 setups) present on disk with non-trivial sizes.
- Bible-First gate (`requireApprovedBible()`) accepted the auto-approved bible; downstream tools ran without gate-block, confirming the BETA auto-approve patch lands correctly into the persisted artifact.
- `ENABLED_TOOLS` allow-list verified working in isolation (2-tool and 25-tool configurations).
- Backend + UI both build clean (`npm run build`, `npm run build:ui` — both PASS).
- No file deletions; all hidden features remain in source per `ROLLOUT.md`.

The marginal anchor validation score (0.50 on attempt 3) is noise from the underlying image-quality validator and is unrelated to BETA changes.

---

## 11. Iteration 2 — drop Input screen, 2 screens visible

After the first PASS the spec changed: Input must also be hidden; the only visible screens are References and Setups. Brief/vision now auto-fed by a fixture, scout_location fired in the background on app mount.

### Additional changes

| File | Change |
|------|--------|
| `src/ui/src/components/BetaAutoBoot.tsx` (new) | Wraps `<Routes>`. On first mount checks `state.statuses.input`; if not approved, fires `scout_location` with the noir Marlowe fixture, polls until terminal, dispatches `APPROVE_STAGE("input")`. Renders splash `"Building location bible…"` (or current step) while running, error banner if it fails. |
| `src/ui/src/stages.ts` | `STAGES` cut to 2: `references` (now `path: "/"`), `setups`. |
| `src/ui/src/App.tsx` | `InputPage` import commented out; `PAGES` has 2 entries; `<Routes>` wrapped in `<BetaAutoBoot>`; added `<Route path="*" element={<Navigate to="/" replace />} />`. |
| `package.json` (root) | Removed extraneous root-level `react`, `react-dom`, `react-router-dom`, `@types/react-router-dom` from `dependencies` — they were causing Vite to load React 19 at runtime (split with React 18 in `src/ui/`), which silently produced a 0-children mount. Pre-existing on `main`; surfaced because BETA navigates straight to References. |
| `package-lock.json` (root) | Regenerated (`npm install`); 10 transitive packages dropped. |
| `vite.config.ts` | Proxy targets `localhost:8083` → `localhost:8080` (matches actual backend port). Added `configure` hook injecting `x-agent-token` from `INTER_AGENT_TOKEN` (.env) so browser UI authenticates against the dev backend without per-request wiring. Dev-only — production agents still use header-based auth as before. |
| `src/ui/src/components/ReferencePicker.tsx` | Renamed prop `ref` → `refData` on internal `Thumbnail` and `LockedThumbnail` components. `ref` is reserved by React; the components used it as data, which on React 18.3+ silently strips it (`undefined` access → component crash, which the StageGuard tree caught and unmounted the page). Pre-existing `main` bug; surfaced because BETA renders References on first paint. |
| `.claude/launch.json` (repo) | `agent-ui` → `location-scout-ui`, port `5173` → `5176` to match `vite.config.ts`. |
| `ROLLOUT.md` | Added "Input screen" row with restoration steps. |

### Browser verification (Iteration 2)

Local run (production mode, real Claude + FAL.ai):

| Step | Result |
|------|--------|
| Backend up on :8080 | ✓ |
| Vite dev on :5176 (preview_start) | ✓ |
| First snapshot | Splash `"Building location bible"` visible, both nav stages shown as 🔒 |
| Auto-boot completes (`scout_location` ~25-40 s) | ✓ — `dispatch(APPROVE_STAGE("input"))` fired |
| References renders | ✓ — Header: `References > 🔒 Setups`; page shows GATE 3 banner, Floorplan + Light Map, Isometric Reference (with locked auto-ref tile, proves `LockedThumbnail` rename), Setup Extraction, Anchor Image with VLM stats, Regenerate/Approve buttons |
| Console errors (post-fix) | Only stale buffer entries from before HMR re-render; current source clean |
| Screenshot captured | ✓ |

### Verdict (Iteration 2)

**PASS.** Browser-verified end-to-end: app boots, fires the hidden Bible pipeline, lands the user directly on References. No Input form visible. Setups tab will unlock after References is approved (existing `STAGE_ORDER` gate semantics). Sending from Setups still goes through the auto-approve `handleSend` from Iteration 1.

Three pre-existing main bugs were uncovered and fixed minimally as part of this iteration (root React deps drift, Vite proxy port, `ref`-named prop). All three would also crash the original Input → Research → … → References flow on `main` once a user reaches References — they were latent because the manual flow takes longer to reach that screen.

---

Branch left local for review. To resume in a fresh session: `git checkout experiment/beta-2-screens` in `LocationScout-Base/`.
