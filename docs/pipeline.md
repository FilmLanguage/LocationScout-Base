# Location Scout — Pipeline v2

## Overview
8 steps, 3 approval gates, 1 research cycle with feedback loop.
Flow: INPUT → Research → Bible → Floorplan → Anchor → Mood States → Setup → Scene Gen → Isometric

---

## Step 1: Location Analysis
**Input:** AD_LOCATION_BRIEF + DIRECTOR_VISION
**Action:** Extract location requirements. Identify:
- Location type (INT/EXT/INT-EXT)
- Time of day constraints from screenplay
- Physical requirements (size, layout, entry points)
- Props explicitly mentioned in script
- Character actions that constrain space (e.g., "sits at a long table" = table must exist)
- Recurring flag (does this location appear in multiple scenes?)

**Output:** Analysis summary → feeds into Research + Bible

---

## Step 2: Historical Research (RESEARCH CYCLE)
**Input:** Location analysis + Director's era/style guidance
**Action:** Research the period, architecture, materials, interiors, technology of the era.
**Research covers:**
- Typical room layouts for the era and social class
- Materials (what walls, floors, furniture were made of)
- Available technology (what appliances, phones, lights existed)
- Social markers (what objects signal wealth, poverty, profession)
- What definitely did NOT exist (→ feeds negative_list)

**Gate 1: ⛔ Research sufficient?**
- NO → deeper research, loop back
- YES → proceed to Bible

**Output:** RESEARCH_PACK (JSON with period_facts, typical_elements, anachronism_list, visual_references)

---

## Step 3: Location Bible
**Input:** Analysis + Research Pack + Director Vision
**Action:** Write the canonical Location Bible (400–600 words). Structure:
- Passport (type, time_of_day, era, scenes, recurring)
- Space description (architecture, materials, dimensions, condition)
- Atmosphere (mood, sensory details)
- Light base state (structured: direction, kelvin, shadow, fill ratio, sources)
- Key details (5–8 specific objects)
- Negative list (things that must NEVER appear)

**Gate 2: ⛔ Era-accurate?**
- Check Bible against research_pack.anachronism_list
- NO → back to Research Cycle for gap-filling
- YES → proceed

**Output:** Location Bible JSON → /project/bibles/locations/{id}.json

---

## Step 4: Floorplan + Light Map
**Input:** Location Bible
**Action:** Generate top-down floorplan showing:
- Room layout with dimensions
- Furniture placement
- Window/door positions
- Light source positions and directions (arrows)
- Camera feasibility zones

**Output:** Floorplan PNG + coords JSON (camera positions, light positions)

---

## Step 5: Anchor Image Generation
**Input:** Location Bible (text) + Floorplan (spatial reference)
**Action:** Generate the canonical establishing wide shot. This is THE reference image for this location. All subsequent generations must match it.

**Prompt construction:**
1. Core description from Bible.space_description
2. Light parameters from Bible.light_base_state
3. Key details from Bible.key_details
4. Negative prompt from Bible.negative_list
5. Style/era guidance from Director Vision

**Gate 3: ⛔ Anchor Image approved?**
- NO → regenerate with adjusted prompt, loop back
- YES → this becomes the visual anchor for all downstream work

**Output:** Anchor Image PNG → /project/gallery/locations/{id}_anchor.png

---

## Step 6: Mood States Matrix
**Input:** Location Bible + screenplay (which scenes happen here)
**Action:** For each scene group that needs different conditions, create a DELTA from the base state:
- Time of day change
- Light parameter changes (direction, kelvin, shadow)
- Weather (if exterior)
- Props changes (what appears/disappears)
- Atmosphere shift
- Clutter level change

Each mood state is NOT a full rewrite — it's a diff from the Bible's base state.

**Output:** Mood States JSON array → /project/bibles/locations/{id}_moods.json

---

## Step 7: Setup Extraction
**Input:** Floorplan + Mood States + screenplay scene descriptions
**Action:** For each scene, extract a camera setup:
- Camera position (from floorplan coords)
- Which characters are present
- Active practical lights
- Key props in frame
- Frame composition notes

**Output:** Setup Extraction JSON → /project/breakdowns/{id}_setups.json

---

## Step 8: Isometric Reference
**Input:** Location Bible + Floorplan
**Action:** Generate isometric 3D-style view of the location showing spatial relationships, furniture placement, and light directions. Used as spatial reference for Storyboard and DP.

**Output:** Isometric PNG → /project/gallery/locations/{id}_isometric.png

---

## Downstream outputs (to other agents)
- **Gallery** → all PNGs (anchor, floorplan, isometric, scene images)
- **DP + Storyboard** → floorplan coords, setup extraction, anchor image
- **Prompt Composer** → Bible text, mood states, negative list → for Production Designer and Sound Director
- **Shot Generation** → anchor image (as reference), mood state (as delta), setup (as camera config)
