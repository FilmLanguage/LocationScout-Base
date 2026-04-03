"""Location Scout Pipeline — 8 steps, 3 approval gates, Ralph Wiggum Loop.

Flow: INPUT → Research → Bible → Floorplan → Anchor → Mood States → Setup → Isometric
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import anthropic

from .anchor import AnchorImageGenerator
from .bible_writer import BibleWriter
from .mood_states import MoodStateGenerator
from .prompts import build_anchor_prompt, build_negative_prompt
from .research import ResearchCycle
from .schemas import (
    AdLocationBrief,
    AnchorImage,
    DirectorVision,
    FloorplanPackage,
    IsometricReference,
    LocationBible,
    MoodState,
    ResearchPack,
    SetupExtraction,
)
from .setup_extraction import SetupExtractor

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"


class PipelineError(Exception):
    """Raised when a pipeline step fails irrecoverably."""


class LocationScoutPipeline:
    """8-step pipeline per pipeline.md with 3 approval gates.

    Ralph Wiggum Loop config:
      max_retries: 3
      exit_condition: all hooks pass
      on_budget_exceeded: raise PipelineError (escalate to human)
      context_policy: only errors in context
    """

    def __init__(
        self,
        client: anthropic.Anthropic | None = None,
        max_retries: int = 3,
    ):
        self.client = client or anthropic.Anthropic()
        self.max_retries = max_retries

        self.research_cycle = ResearchCycle(client=self.client, max_retries=max_retries)
        self.bible_writer = BibleWriter(client=self.client, max_retries=max_retries)
        self.mood_generator = MoodStateGenerator(client=self.client)
        self.anchor_generator = AnchorImageGenerator(client=self.client, max_retries=max_retries)
        self.setup_extractor = SetupExtractor(client=self.client)

    # --- Step 1: Location Analysis ---

    def step_1_location_analysis(
        self, brief: AdLocationBrief, vision: DirectorVision
    ) -> dict:
        """Extract location requirements from brief + vision.

        Output: analysis summary dict for research + bible.
        """
        analysis = {
            "location_name": brief.location_name,
            "location_type": brief.location_type,
            "time_of_day": brief.time_of_day,
            "recurring": brief.recurring or False,
            "physical_requirements": {},
            "props": brief.props_mentioned,
            "character_actions": brief.character_actions,
            "entry_exit_points": brief.entry_exit_points,
            "era_and_style": vision.era_and_style,
            "production_flags": brief.production_flags,
        }
        logger.info("Step 1 complete: Location analysis for '%s'", brief.location_name)
        return analysis

    # --- Step 2: Historical Research (RESEARCH CYCLE) ---
    # Gate 1: ⛔ Research sufficient?

    def step_2_research(
        self, brief: AdLocationBrief, vision: DirectorVision
    ) -> ResearchPack:
        """Run research cycle. Gate 1: validate_research hook."""
        logger.info("Step 2: Starting research cycle for '%s'", brief.location_name)
        pack = self.research_cycle.research(brief, vision)
        logger.info("Step 2 complete: Research pack created (%d anachronisms)", len(pack.anachronism_list))
        return pack

    # --- Step 3: Location Bible ---
    # Gate 2: ⛔ Era-accurate?

    def step_3_bible(
        self,
        brief: AdLocationBrief,
        vision: DirectorVision,
        research: ResearchPack,
        bible_id: str = "loc_001",
    ) -> LocationBible:
        """Write Location Bible. Gate 2: validate_bible + check_era_accuracy hooks."""
        logger.info("Step 3: Writing Location Bible for '%s'", brief.location_name)
        bible = self.bible_writer.write_bible(brief, vision, research, bible_id)
        logger.info("Step 3 complete: Bible '%s' written and validated", bible.bible_id)
        return bible

    # --- Step 4: Floorplan + Light Map ---

    def step_4_floorplan(
        self, bible: LocationBible, output_path: str
    ) -> FloorplanPackage:
        """Generate floorplan with lighting data.

        Uses LLM to generate spatial layout JSON, which in production
        would feed into a floorplan rendering tool.
        """
        logger.info("Step 4: Generating floorplan for '%s'", bible.bible_id)

        response = self.client.messages.create(
            model=MODEL,
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Generate a JSON floorplan for this location.\n\n"
                        f"SPACE: {bible.space_description[:500]}\n"
                        f"TYPE: {bible.passport.type}\n"
                        f"ERA: {bible.passport.era}\n"
                        f"KEY DETAILS: {json.dumps(bible.key_details)}\n\n"
                        f"Output JSON:\n"
                        f'{{"coords_json": {{"camera_positions": [...], "furniture": [...]}}, '
                        f'"light_sources": [{{"type": "...", "position": "...", "direction": "..."}}], '
                        f'"dimensions": {{"width_ft": 0, "length_ft": 0, "height_ft": 0}}, '
                        f'"camera_feasibility": {{"zones": [...]}}}}'
                    ),
                }
            ],
        )

        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        data = json.loads(raw)

        # Save floorplan data
        plan_path = output_path
        Path(plan_path).parent.mkdir(parents=True, exist_ok=True)
        Path(plan_path).write_text(json.dumps(data, indent=2))

        floorplan = FloorplanPackage(
            floorplan_id=1,
            bible_id=bible.bible_id,
            plan_png=plan_path,
            coords_json=data.get("coords_json", {}),
            light_sources=data.get("light_sources", []),
            light_direction=bible.light_base_state.direction,
            color_temp_kelvin=bible.light_base_state.color_temp_kelvin,
            shadow_hardness=bible.light_base_state.shadow_hardness,
            fill_to_key_ratio=float(bible.light_base_state.fill_to_key_ratio.split(":")[1]) if ":" in bible.light_base_state.fill_to_key_ratio else None,
            camera_feasibility=data.get("camera_feasibility"),
            dimensions=data.get("dimensions"),
        )

        logger.info("Step 4 complete: Floorplan generated")
        return floorplan

    # --- Step 5: Anchor Image Generation ---
    # Gate 3: ⛔ Anchor Image approved?

    def step_5_anchor(
        self,
        bible: LocationBible,
        vision: DirectorVision,
        output_path: str,
    ) -> AnchorImage:
        """Generate canonical anchor image. Gate 3: vlm_audit_image hook."""
        logger.info("Step 5: Generating anchor image for '%s'", bible.bible_id)
        anchor = self.anchor_generator.generate(bible, vision, output_path)
        logger.info("Step 5 complete: Anchor image approved")
        return anchor

    # --- Step 6: Mood States Matrix ---

    def step_6_mood_states(
        self, bible: LocationBible, scenes: list[dict]
    ) -> list[MoodState]:
        """Generate mood state deltas from base state."""
        logger.info("Step 6: Generating mood states for '%s'", bible.bible_id)
        moods = self.mood_generator.generate(bible, scenes)
        logger.info("Step 6 complete: %d mood states generated", len(moods))
        return moods

    # --- Step 7: Setup Extraction ---

    def step_7_setup_extraction(
        self,
        floorplan: FloorplanPackage,
        mood_states: list[MoodState],
        scenes: list[dict],
    ) -> list[SetupExtraction]:
        """Extract per-scene camera setups."""
        logger.info("Step 7: Extracting setups for %d scenes", len(scenes))
        setups = self.setup_extractor.extract(floorplan, mood_states, scenes)
        logger.info("Step 7 complete: %d setups extracted", len(setups))
        return setups

    # --- Step 8: Isometric Reference ---

    def step_8_isometric(
        self,
        bible: LocationBible,
        floorplan: FloorplanPackage,
        output_path: str,
    ) -> IsometricReference:
        """Generate isometric 3D-style view for Storyboard and DP reference."""
        logger.info("Step 8: Generating isometric reference for '%s'", bible.bible_id)

        iso_prompt = (
            f"Isometric 3D architectural cutaway view of {bible.passport.type} location.\n"
            f"Era: {bible.passport.era}.\n"
            f"Space: {bible.space_description[:300]}...\n"
            f"Key furniture/objects: {', '.join(bible.key_details)}\n"
            f"Show: room layout, furniture placement, light source directions, "
            f"window/door positions. Clean architectural style, no people.\n"
            f"Negative: {', '.join(bible.negative_list)}"
        )

        # In production: generate actual isometric PNG
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(output_path).write_text(
            json.dumps({"prompt": iso_prompt, "status": "prompt_generated"})
        )

        iso = IsometricReference(
            iso_id=1,
            bible_id=bible.bible_id,
            floorplan_id=floorplan.floorplan_id,
            iso_image_url=output_path,
            iso_prompt=iso_prompt,
        )

        logger.info("Step 8 complete: Isometric reference generated")
        return iso
