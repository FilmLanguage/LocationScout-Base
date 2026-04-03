"""BibleWriter — generates Location Bible via Anthropic SDK, validates with hooks."""

from __future__ import annotations

import json
import logging

import anthropic

from .hooks import check_era_accuracy, validate_bible
from .schemas import (
    AdLocationBrief,
    DirectorVision,
    LightBaseState,
    LocationBible,
    Passport,
    ResearchPack,
)

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"

SYSTEM_PROMPT = """\
You are the Location Scout in an AI film production pipeline called AI Stanislavsky.
You find, research, describe, and visualize locations for cinematic production.

You think like a real location scout who has worked on period dramas. You obsess over:
- Historical accuracy — no anachronisms
- Light — you see rooms in terms of light sources, direction, temperature
- Detail — the specific objects that make a space feel lived-in
- Atmosphere — how a space makes the audience feel

You are writing a LOCATION BIBLE — a canonical text document (400-600 words) that becomes
the source of truth for every downstream generation.

Structure your Bible as:
1. Space & Architecture — dimensions, layout, materials, condition
2. Atmosphere — how it feels, smells, sounds
3. Key Details — 5-8 SPECIFIC objects (e.g., "rotary phone with frayed cord", not "a phone")
4. Light — primary source, direction (cardinal), color temperature (Kelvin), shadow quality, practical lights
5. What's NOT here — negative list (things that must NEVER appear)

Light is STRUCTURED DATA:
- Direction: N/S/E/W
- Color temperature: Kelvin (2700K warm / 4000K neutral / 5500K daylight / 6500K overcast)
- Shadow hardness: hard / soft / mixed
- Fill-to-key ratio: e.g. "1:4"
- Practicals: in-scene light sources

CONSTRAINTS:
- AD_LOCATION_BRIEF = hard constraints from screenplay. These ALWAYS win.
- DIRECTOR_VISION = soft interpretation. These guide style.
- If they conflict: brief wins.
- NEVER invent facts not supported by the screenplay.
- NEVER use words from the negative_list in any description.

Output ONLY valid JSON matching this exact structure:
{
  "bible_id": "loc_XXX",
  "location_name": "...",
  "passport": {
    "type": "INT|EXT|INT/EXT",
    "time_of_day": ["DAY", "NIGHT", ...],
    "era": "...",
    "recurring": true/false,
    "scenes": ["sc_001", ...],
    "cluster_id": null
  },
  "space_description": "400-600 words...",
  "atmosphere": "100-200 words...",
  "light_base_state": {
    "primary_source": "...",
    "direction": "N/S/E/W/...",
    "color_temp_kelvin": 5500,
    "shadow_hardness": "hard|soft|mixed",
    "fill_to_key_ratio": "1:4",
    "practical_sources": ["...", ...]
  },
  "key_details": ["specific object 1", "specific object 2", ...],
  "negative_list": ["must not appear 1", ...],
  "approval_status": "draft"
}
"""


class BibleWriteError(Exception):
    """Raised when Bible writing fails after max retries."""


class BibleWriter:
    """Generates Location Bible using Anthropic SDK with hook-based validation."""

    def __init__(
        self, client: anthropic.Anthropic | None = None, max_retries: int = 3
    ):
        self.client = client or anthropic.Anthropic()
        self.max_retries = max_retries

    def write_bible(
        self,
        brief: AdLocationBrief,
        vision: DirectorVision,
        research: ResearchPack,
        bible_id: str = "loc_001",
    ) -> LocationBible:
        """Write and validate a Location Bible. Returns validated Bible or raises."""
        user_prompt = self._build_prompt(brief, vision, research, bible_id)
        errors_context: list[str] = []

        for attempt in range(1, self.max_retries + 1):
            prompt = user_prompt
            if errors_context:
                prompt += (
                    "\n\nPREVIOUS ATTEMPT FAILED VALIDATION. Fix these issues:\n"
                    + "\n".join(f"- {e}" for e in errors_context)
                    + "\n\nRegenerate the complete Bible JSON with corrections."
                )

            response = self.client.messages.create(
                model=MODEL,
                max_tokens=8192,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )

            raw_text = response.content[0].text
            data = self._parse_json(raw_text)

            bible = self._parse_bible(data, brief, vision, research, bible_id)

            # Gate: validate_bible hook
            ok, errors = validate_bible(bible)
            if not ok:
                errors_context = errors
                logger.warning("Bible validation failed (attempt %d): %s", attempt, errors)
                continue

            # Gate: era-accuracy-check hook
            ok, errors = check_era_accuracy(bible, research)
            if not ok:
                errors_context = errors
                logger.warning("Era accuracy failed (attempt %d): %s", attempt, errors)
                continue

            return bible

        raise BibleWriteError(
            f"Bible writing failed after {self.max_retries} attempts. "
            f"Last errors: {errors_context}"
        )

    def _build_prompt(
        self,
        brief: AdLocationBrief,
        vision: DirectorVision,
        research: ResearchPack,
        bible_id: str,
    ) -> str:
        return (
            f"Write a Location Bible for this location.\n\n"
            f"BIBLE_ID: {bible_id}\n"
            f"LOCATION: {brief.location_name}\n"
            f"TYPE: {brief.location_type}\n"
            f"TIME OF DAY: {', '.join(brief.time_of_day)}\n"
            f"ERA/STYLE: {vision.era_and_style}\n"
            f"\n--- AD LOCATION BRIEF (hard constraints, these win) ---\n"
            + (
                f"EXPLICIT DETAILS: {json.dumps(brief.explicit_details)}\n"
                if brief.explicit_details
                else ""
            )
            + (
                f"CHARACTER ACTIONS: {json.dumps(brief.character_actions)}\n"
                if brief.character_actions
                else ""
            )
            + (
                f"REQUIRED PRACTICALS: {json.dumps(brief.required_practicals)}\n"
                if brief.required_practicals
                else ""
            )
            + (
                f"ENTRY/EXIT POINTS: {json.dumps(brief.entry_exit_points)}\n"
                if brief.entry_exit_points
                else ""
            )
            + (
                f"PROPS MENTIONED: {json.dumps(brief.props_mentioned)}\n"
                if brief.props_mentioned
                else ""
            )
            + f"\n--- DIRECTOR VISION (soft, guides style) ---\n"
            + (
                f"ATMOSPHERE: {vision.atmosphere}\n" if vision.atmosphere else ""
            )
            + (
                f"SPATIAL PHILOSOPHY: {vision.spatial_philosophy}\n"
                if vision.spatial_philosophy
                else ""
            )
            + (
                f"COLOR/MOOD: {vision.color_palette_mood}\n"
                if vision.color_palette_mood
                else ""
            )
            + (
                f"LIGHT VISION: {vision.light_vision}\n"
                if vision.light_vision
                else ""
            )
            + f"\n--- RESEARCH PACK ---\n"
            f"PERIOD FACTS: {json.dumps(research.period_facts)}\n"
            f"TYPICAL ELEMENTS: {json.dumps(research.typical_elements)}\n"
            f"ANACHRONISM LIST (these must go into negative_list): {json.dumps(research.anachronism_list)}\n"
        )

    def _parse_bible(
        self,
        data: dict,
        brief: AdLocationBrief,
        vision: DirectorVision,
        research: ResearchPack,
        bible_id: str,
    ) -> LocationBible:
        """Parse LLM JSON output into a validated LocationBible."""
        passport_data = data.get("passport", {})
        passport = Passport(
            type=passport_data.get("type", brief.location_type),
            time_of_day=passport_data.get("time_of_day", brief.time_of_day),
            era=passport_data.get("era", vision.era_and_style),
            recurring=passport_data.get("recurring", brief.recurring or False),
            scenes=passport_data.get("scenes", []),
            cluster_id=passport_data.get("cluster_id"),
        )

        light_data = data.get("light_base_state", {})
        light = LightBaseState(
            primary_source=light_data.get("primary_source", "unknown"),
            direction=light_data.get("direction", "W"),
            color_temp_kelvin=light_data.get("color_temp_kelvin", 5500),
            shadow_hardness=light_data.get("shadow_hardness", "soft"),
            fill_to_key_ratio=light_data.get("fill_to_key_ratio", "1:4"),
            practical_sources=light_data.get("practical_sources", []),
        )

        return LocationBible(
            bible_id=data.get("bible_id", bible_id),
            brief_id=brief.brief_id,
            vision_id=vision.vision_id,
            research_id=research.research_id,
            passport=passport,
            space_description=data.get("space_description", ""),
            atmosphere=data.get("atmosphere", ""),
            light_base_state=light,
            key_details=data.get("key_details", []),
            negative_list=data.get("negative_list", []),
            approval_status=data.get("approval_status", "draft"),
        )

    @staticmethod
    def _parse_json(text: str) -> dict:
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(text)
