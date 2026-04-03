"""MoodStateGenerator — generates delta states from Location Bible base state."""

from __future__ import annotations

import json
import logging

import anthropic

from .schemas import LocationBible, MoodState

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"

SYSTEM_PROMPT = """\
You are the Location Scout in AI Stanislavsky. You are generating MOOD STATES.

A Mood State is a DELTA from the Location Bible's base state. You never rewrite the
whole location — you specify only what CHANGES for a specific scene group.

Delta fields (null = use base state, non-null = override):
- light_direction: override base. Cardinal: N/S/E/W/OVERHEAD
- weather: only for EXT. Values: clear, overcast, rain, snow, fog
- color_temp_kelvin: override base. Integer in Kelvin
- shadow_hardness: override base. hard | soft | mixed

Human-readable change descriptions:
- light_change: how light differs from base (e.g., "5500K → 2700K, direction W → overhead")
- props_change: what appeared/disappeared (e.g., "beer cans accumulate on table")
- atmosphere_shift: how feeling changed (e.g., "tense silence replaces morning bustle")
- clutter_level: clean | slight | messy | destroyed
- window_state: open | closed | curtains_drawn | boarded_up

Output a JSON array of mood states. Each element:
{
  "state_id": "mood_{bible_id}_{number}",
  "scene_ids": ["sc_XXX"],
  "act": 1,
  "time_of_day": "DAY|NIGHT|DAWN|DUSK|LATE_NIGHT",
  "light_direction": null or "N/S/E/W/OVERHEAD",
  "weather": null,
  "color_temp_kelvin": null or integer,
  "shadow_hardness": null or "hard|soft|mixed",
  "light_change": "description of change",
  "props_change": "what changed",
  "atmosphere_shift": "how mood changed",
  "clutter_level": "clean|slight|messy|destroyed",
  "window_state": "open|closed|curtains_drawn|boarded_up" or null
}
"""


class MoodStateGenerator:
    """Generates mood state deltas from Location Bible base state."""

    def __init__(self, client: anthropic.Anthropic | None = None):
        self.client = client or anthropic.Anthropic()

    def generate(
        self,
        bible: LocationBible,
        scenes: list[dict],
    ) -> list[MoodState]:
        """Generate mood states for each scene group that needs different conditions.

        Args:
            bible: The Location Bible (base state source).
            scenes: List of scene dicts with at least 'scene_id', 'time_of_day', 'act'.
        """
        if not scenes:
            return []

        user_prompt = self._build_prompt(bible, scenes)

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

        mood_states = []
        for i, item in enumerate(data):
            state = MoodState(
                state_id=item.get("state_id", f"mood_{bible.bible_id}_{i + 1:02d}"),
                bible_id=bible.bible_id,
                scene_ids=item.get("scene_ids", []),
                act=item.get("act", 1),
                time_of_day=item.get("time_of_day", "DAY"),
                light_direction=item.get("light_direction"),
                weather=item.get("weather"),
                color_temp_kelvin=item.get("color_temp_kelvin"),
                shadow_hardness=item.get("shadow_hardness"),
                light_change=item.get("light_change"),
                props_change=item.get("props_change"),
                atmosphere_shift=item.get("atmosphere_shift"),
                clutter_level=item.get("clutter_level"),
                window_state=item.get("window_state"),
            )
            mood_states.append(state)

        return mood_states

    def _build_prompt(self, bible: LocationBible, scenes: list[dict]) -> str:
        light = bible.light_base_state
        return (
            f"Generate mood state deltas for this location.\n\n"
            f"LOCATION: {bible.bible_id}\n"
            f"BASE LIGHT STATE:\n"
            f"  Primary source: {light.primary_source}\n"
            f"  Direction: {light.direction}\n"
            f"  Color temp: {light.color_temp_kelvin}K\n"
            f"  Shadow: {light.shadow_hardness}\n"
            f"  Fill-to-key: {light.fill_to_key_ratio}\n"
            f"  Practicals: {json.dumps(light.practical_sources)}\n\n"
            f"BASE ATMOSPHERE: {bible.atmosphere}\n"
            f"KEY DETAILS: {json.dumps(bible.key_details)}\n"
            f"PASSPORT TYPE: {bible.passport.type}\n\n"
            f"SCENES AT THIS LOCATION:\n"
            + "\n".join(
                f"- {s.get('scene_id', 'unknown')}: {s.get('time_of_day', 'DAY')}, "
                f"act {s.get('act', 1)}, {s.get('description', '')}"
                for s in scenes
            )
            + "\n\nGroup scenes with identical conditions. Generate one mood state per group."
        )

    @staticmethod
    def _parse_json(text: str) -> list | dict:
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(text)
