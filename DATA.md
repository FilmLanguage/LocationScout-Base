# Data Policy: LocationScout

## Owns (authoritative writer)

- `v2.location_bibles` — schema `location-bible-v2` (one per location)
- `v2.location_research_packs` — supporting research data per location
- `v2.mood_states` — per-location mood state snapshots
- `v2.floorplans` — per-location floorplan records (with blob refs)
- `v2.location_setups` — per-location camera setup records

## Writes blobs of kind

- `anchor` — primary visual reference image for a location (content-addressed)
- `floorplan` — floor plan image for a location (content-addressed)

## Reads (via MCP, with 30 s TTL cache)

- `agent://1ad/location-briefs/{project_id}` — auto-resolve location briefs when executing `scout_location`
- `agent://director/location-vision/{project_id}` — director's spatial/atmospheric intent, used to align bible generation

## Never touches

All artifact tables owned by other agents:
`v2.film_irs`, `v2.script_briefs`, `v2.character_briefs`,
`v2.director_film_visions`, `v2.director_scene_visions`,
`v2.dop_film_visions`, `v2.dop_scene_visions`,
`v2.edls`, `v2.pacing_maps`,
`v2.character_bibles`, `v2.character_research_packs`, `v2.wardrobe_bibles`, `v2.model_sheets`, `v2.appearance_states`, `v2.face_anchors`, `v2.body_anchors`,
`v2.scene_styles`, `v2.style_references`,
`v2.composer_film_visions`, `v2.composer_scene_visions`, `v2.music_versions`,
`v2.sound_breakdowns`, `v2.sound_replacements`, `v2.final_mixes`,
`v2.shot_recipes`, `v2.shots`, `v2.end_frames`.

## MCP resources exposed

- `agent://location-scout/bible/{location_id}` → `v2.location_bibles WHERE location_id=?`
- `agent://location-scout/anchor/{location_id}` → `v2.blobs` via ref in `v2.location_research_packs WHERE location_id=?` (kind=`anchor`)
- `agent://location-scout/floorplan/{location_id}` → `v2.floorplans WHERE location_id=?` + blob ref
- `agent://location-scout/research/{location_id}` → `v2.location_research_packs WHERE location_id=?`

## PG role

`fl_location_scout`

Grants: `SELECT, INSERT, UPDATE` on own tables; `SELECT, INSERT` on `v2.blobs`, `v2.events`, `v2.artifact_versions`; `SELECT, INSERT, UPDATE` on `v2.tasks`; `SELECT` on `v2.projects`, `v2.scenes`, `v2.locations`, `v2.characters`.

## Write order

1. (blobs) S3 upload content-addressed (`sha256` as object key), idempotent.
2. (blobs) `INSERT v2.blobs` in transaction (kind=`anchor` or `floorplan`).
3. `INSERT ... ON CONFLICT DO UPDATE WHERE version = $expected` on own artifact table (optimistic lock).
4. Trigger writes old payload to `v2.artifact_versions`.
5. `INSERT v2.events` (`bible_saved` / `anchor_generated` / `floorplan_saved` / ...).
6. `COMMIT`.

## Invalidation

- On `location_briefs_saved project_id=X` → drop `agent://1ad/location-briefs/X` from LRU cache.
- On `location_vision_saved project_id=X` → drop `agent://director/location-vision/X` from LRU cache.
- Downstream agents (ArtDirector, ShotGeneration) must invalidate `agent://location-scout/bible/{location_id}` and `agent://location-scout/anchor/{location_id}` when LocationScout publishes `bible_saved` / `anchor_generated`.

## Fail-fast policy

- PG unreachable on startup → `process.exit(1)`.
- PG unreachable in runtime → circuit breaker (5 failures → open 30 s), tool returns `STORAGE_UNAVAILABLE retryable: true`.
- S3 upload fail → retry 3×, then `STORAGE_UNAVAILABLE retryable: true`.
- In-memory fallback in production → **forbidden**.
