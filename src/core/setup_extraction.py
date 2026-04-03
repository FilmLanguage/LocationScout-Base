"""Setup Extraction — per-scene camera setup combining floorplan + mood state."""

from __future__ import annotations

import json
import logging

import anthropic

from .schemas import FloorplanPackage, MoodState, SetupExtraction

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"

SYSTEM_PROMPT = """\
You are the Location Scout in AI Stanislavsky. You are extracting camera setups.

For each scene, determine:
- Camera position (from the floorplan coordinates)
- Which characters are present
- Active practical lights for this mood
- Key props visible in frame
- Frame composition notes

Output a JSON array of setup objects:
{
  "scene_id": "sc_XXX",
  "camera_position": {"x": 0, "y": 0, "angle": "eye_level", "lens_mm": 35},
  "characters": [{"name": "Character", "position": "description"}],
  "active_practicals": [{"source": "desk lamp", "state": "on"}],
  "key_props_in_frame": ["prop1", "prop2"],
  "frame_composition": "Description of framing"
}
"""


class SetupExtractor:
    """Extracts per-scene camera setups from floorplan + mood states."""

    def __init__(self, client: anthropic.Anthropic | None = None):
        self.client = client or anthropic.Anthropic()

    def extract(
        self,
        floorplan: FloorplanPackage,
        mood_states: list[MoodState],
        scenes: list[dict],
    ) -> list[SetupExtraction]:
        """Extract camera setups for each scene.

        Args:
            floorplan: Spatial layout with camera feasibility zones.
            mood_states: Mood state deltas for each scene group.
            scenes: Scene dicts with scene_id, characters, description.
        """
        if not scenes:
            return []

        user_prompt = self._build_prompt(floorplan, mood_states, scenes)

        response = self.client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        raw_text = response.content[0].text
        data = self._parse_json(raw_text)

        if not isinstance(data, list):
            data = [data]

        # Map scene_ids to mood state_ids
        scene_to_state: dict[str, str] = {}
        for mood in mood_states:
            for sid in mood.scene_ids:
                scene_to_state[sid] = mood.state_id

        setups = []
        for i, item in enumerate(data):
            scene_id = item.get("scene_id", f"sc_{i + 1:03d}")
            setup = SetupExtraction(
                setup_id=i + 1,
                floorplan_id=floorplan.floorplan_id,
                state_id=scene_to_state.get(scene_id, mood_states[0].state_id if mood_states else "unknown"),
                scene_id=scene_id,
                camera_position=item.get("camera_position", {"x": 0, "y": 0}),
                characters=item.get("characters", []),
                active_practicals=item.get("active_practicals"),
                key_props_in_frame=item.get("key_props_in_frame"),
                frame_composition=item.get("frame_composition"),
            )
            setups.append(setup)

        return setups

    def _build_prompt(
        self,
        floorplan: FloorplanPackage,
        mood_states: list[MoodState],
        scenes: list[dict],
    ) -> str:
        return (
            f"Extract camera setups for these scenes.\n\n"
            f"FLOORPLAN:\n"
            f"  Dimensions: {json.dumps(floorplan.dimensions)}\n"
            f"  Camera feasibility zones: {json.dumps(floorplan.camera_feasibility)}\n"
            f"  Coordinates: {json.dumps(floorplan.coords_json)}\n"
            f"  Light sources: {json.dumps(floorplan.light_sources)}\n\n"
            f"MOOD STATES:\n"
            + "\n".join(
                f"  - {m.state_id} ({m.time_of_day}): "
                f"light_change={m.light_change}, props_change={m.props_change}"
                for m in mood_states
            )
            + f"\n\nSCENES:\n"
            + "\n".join(
                f"  - {s.get('scene_id', 'unknown')}: {s.get('description', '')} "
                f"[characters: {s.get('characters', [])}]"
                for s in scenes
            )
        )

    @staticmethod
    def _parse_json(text: str) -> list | dict:
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(text)
