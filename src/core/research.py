"""Research Cycle — historical research with feedback loop (max 3 iterations)."""

from __future__ import annotations

import json
import logging

import anthropic

from .hooks import validate_research
from .schemas import AdLocationBrief, DirectorVision, ResearchPack

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"

SYSTEM_PROMPT = """\
You are the Location Scout in an AI film production pipeline called AI Stanislavsky.
You are currently in the RESEARCH phase.

Your task: research the historical period, architecture, materials, interiors, and technology
for a specific location. You obsess over historical accuracy — no anachronisms.

Research must cover:
- Typical room layouts for the era and social class
- Materials (what walls, floors, furniture were made of)
- Available technology (what appliances, phones, lights existed)
- Social markers (what objects signal wealth, poverty, profession)
- What definitely did NOT exist yet (→ feeds the anachronism list)

Output ONLY valid JSON matching this structure:
{
  "period_facts": [{"fact": "description", "source_context": "why relevant"}],
  "typical_elements": ["element1", "element2", ...],
  "anachronism_list": ["thing that did NOT exist", ...],
  "visual_references": ["reference description", ...]
}

Requirements:
- period_facts: at least 1 entry
- typical_elements: at least 3 entries
- anachronism_list: at least 5 entries (things that must NOT appear)
"""


class ResearchInsufficientError(Exception):
    """Raised when research fails validation after max retries."""


class ResearchCycle:
    """Research cycle with feedback loop: generate → validate → retry if needed."""

    def __init__(self, client: anthropic.Anthropic | None = None, max_retries: int = 3):
        self.client = client or anthropic.Anthropic()
        self.max_retries = max_retries

    def research(
        self,
        brief: AdLocationBrief,
        vision: DirectorVision,
    ) -> ResearchPack:
        """Run research cycle. Returns validated ResearchPack or raises."""
        user_prompt = self._build_prompt(brief, vision)
        errors_context: list[str] = []

        for attempt in range(1, self.max_retries + 1):
            prompt = user_prompt
            if errors_context:
                prompt += (
                    "\n\nPREVIOUS ATTEMPT FAILED VALIDATION. Fix these issues:\n"
                    + "\n".join(f"- {e}" for e in errors_context)
                    + "\n\nGenerate deeper, more thorough research."
                )

            response = self.client.messages.create(
                model=MODEL,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )

            raw_text = response.content[0].text
            data = self._parse_json(raw_text)

            pack = ResearchPack(
                research_id=attempt,
                brief_id=brief.brief_id,
                vision_id=vision.vision_id,
                period_facts=data.get("period_facts", []),
                typical_elements=data.get("typical_elements", []),
                anachronism_list=data.get("anachronism_list", []),
                visual_references=data.get("visual_references"),
                research_status="validated",
            )

            ok, errors = validate_research(pack)
            if ok:
                return pack

            # Only errors enter context (hooks.md: context_policy: only_errors_in_context)
            errors_context = errors
            logger.warning("Research attempt %d failed: %s", attempt, errors)

        raise ResearchInsufficientError(
            f"Research failed validation after {self.max_retries} attempts. "
            f"Last errors: {errors_context}"
        )

    def _build_prompt(
        self, brief: AdLocationBrief, vision: DirectorVision
    ) -> str:
        return (
            f"Research this location for a film production:\n\n"
            f"LOCATION: {brief.location_name}\n"
            f"TYPE: {brief.location_type}\n"
            f"TIME OF DAY: {', '.join(brief.time_of_day)}\n"
            f"ERA/STYLE: {vision.era_and_style}\n"
            + (
                f"EXPLICIT DETAILS FROM SCRIPT: {json.dumps(brief.explicit_details)}\n"
                if brief.explicit_details
                else ""
            )
            + (
                f"CHARACTER ACTIONS: {json.dumps(brief.character_actions)}\n"
                if brief.character_actions
                else ""
            )
            + (
                f"PROPS MENTIONED: {json.dumps(brief.props_mentioned)}\n"
                if brief.props_mentioned
                else ""
            )
            + (
                f"\nDIRECTOR'S ATMOSPHERE: {vision.atmosphere}\n"
                if vision.atmosphere
                else ""
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
        )

    @staticmethod
    def _parse_json(text: str) -> dict:
        """Extract JSON from LLM response, handling markdown code blocks."""
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(text)
