Given the following location bible and scene context, produce a mood-state-v1 JSON describing the per-scene light/atmosphere delta.

## Location bible
{{bible}}

## Light base state
{{light_base_state}}

## Scene
{{scene_description}}

## Optional user notes
{{user_notes}}

Output: a single valid mood-state-v1 JSON object (delta fields only — no `state_id`/`bible_id`/`scene_ids`/`act`/`time_of_day`/`$schema`), no markdown fences, no commentary.
