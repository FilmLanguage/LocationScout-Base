"""LocationScoutAgent — entry point for the Location Scout pipeline."""

from __future__ import annotations

import json
import logging
from pathlib import Path

import anthropic

from .pipeline import LocationScoutPipeline
from .schemas import AdLocationBrief, DirectorVision

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"


class LocationScoutAgent:
    """Runs the full Location Scout pipeline for a location.

    Entry point: run(screenplay_path, location_name) -> dict of artifact paths.
    """

    def __init__(
        self,
        client: anthropic.Anthropic | None = None,
        output_dir: str = "project",
        max_retries: int = 3,
    ):
        self.client = client or anthropic.Anthropic()
        self.output_dir = Path(output_dir)
        self.pipeline = LocationScoutPipeline(
            client=self.client, max_retries=max_retries
        )

    def run(
        self,
        screenplay_path: str,
        location_name: str,
        brief: AdLocationBrief | None = None,
        vision: DirectorVision | None = None,
        scenes: list[dict] | None = None,
        bible_id: str = "loc_001",
    ) -> dict:
        """Run the full 8-step Location Scout pipeline.

        Args:
            screenplay_path: Path to the screenplay file.
            location_name: Name of the location to scout.
            brief: Pre-built AD brief (optional, will be extracted if not provided).
            vision: Pre-built Director vision (optional, will be extracted if not provided).
            scenes: List of scene dicts for this location (optional).
            bible_id: ID for the bible (default: loc_001).

        Returns:
            Dict with paths to all generated artifacts.
        """
        # Read screenplay
        screenplay_text = Path(screenplay_path).read_text(encoding="utf-8")

        # Extract brief and vision if not provided
        if brief is None:
            brief = self._extract_brief(screenplay_text, location_name)
        if vision is None:
            vision = self._extract_vision(screenplay_text, location_name)
        if scenes is None:
            scenes = self._extract_scenes(screenplay_text, location_name)

        # Set up output paths
        bibles_dir = self.output_dir / "bibles" / "locations"
        gallery_dir = self.output_dir / "gallery" / "locations"
        breakdowns_dir = self.output_dir / "breakdowns"

        bibles_dir.mkdir(parents=True, exist_ok=True)
        gallery_dir.mkdir(parents=True, exist_ok=True)
        breakdowns_dir.mkdir(parents=True, exist_ok=True)

        artifacts: dict[str, str] = {}

        # Step 1: Location Analysis
        analysis = self.pipeline.step_1_location_analysis(brief, vision)

        # Step 2: Research (Gate 1)
        research = self.pipeline.step_2_research(brief, vision)

        # Step 3: Bible (Gate 2)
        bible = self.pipeline.step_3_bible(brief, vision, research, bible_id)
        bible_path = str(bibles_dir / f"{bible_id}.json")
        Path(bible_path).write_text(bible.model_dump_json(indent=2), encoding="utf-8")
        artifacts["bible"] = bible_path

        # Step 4: Floorplan
        floorplan_path = str(gallery_dir / f"{bible_id}_floorplan.png")
        floorplan = self.pipeline.step_4_floorplan(bible, floorplan_path)
        artifacts["floorplan"] = floorplan_path

        # Step 5: Anchor Image (Gate 3)
        anchor_path = str(gallery_dir / f"{bible_id}_anchor.png")
        anchor = self.pipeline.step_5_anchor(bible, vision, anchor_path)
        artifacts["anchor"] = anchor_path

        # Step 6: Mood States
        moods = self.pipeline.step_6_mood_states(bible, scenes)
        moods_path = str(bibles_dir / f"{bible_id}_moods.json")
        moods_data = [m.model_dump() for m in moods]
        Path(moods_path).write_text(json.dumps(moods_data, indent=2), encoding="utf-8")
        artifacts["mood_states"] = moods_path

        # Step 7: Setup Extraction
        setups = self.pipeline.step_7_setup_extraction(floorplan, moods, scenes)
        setups_path = str(breakdowns_dir / f"{bible_id}_setups.json")
        setups_data = [s.model_dump() for s in setups]
        Path(setups_path).write_text(json.dumps(setups_data, indent=2), encoding="utf-8")
        artifacts["setups"] = setups_path

        # Step 8: Isometric Reference
        iso_path = str(gallery_dir / f"{bible_id}_isometric.png")
        iso = self.pipeline.step_8_isometric(bible, floorplan, iso_path)
        artifacts["isometric"] = iso_path

        logger.info("Location Scout pipeline complete for '%s'. Artifacts: %s", location_name, list(artifacts.keys()))
        return artifacts

    def _extract_brief(
        self, screenplay: str, location_name: str
    ) -> AdLocationBrief:
        """Extract AD Location Brief from screenplay using LLM."""
        response = self.client.messages.create(
            model=MODEL,
            max_tokens=2048,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Extract a location brief for '{location_name}' from this screenplay.\n\n"
                        f"SCREENPLAY:\n{screenplay[:3000]}\n\n"
                        f"Output JSON:\n"
                        f'{{"location_name": "{location_name}", '
                        f'"location_type": "INT|EXT|INT-EXT", '
                        f'"time_of_day": ["DAY", "NIGHT"], '
                        f'"recurring": true/false, '
                        f'"explicit_details": {{}}, '
                        f'"character_actions": {{}}, '
                        f'"props_mentioned": {{}}, '
                        f'"entry_exit_points": {{}}, '
                        f'"production_flags": {{}}}}'
                    ),
                }
            ],
        )

        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        data = json.loads(text)

        return AdLocationBrief(
            brief_id=1,
            script_id=1,
            location_name=data.get("location_name", location_name),
            location_type=data.get("location_type", "INT"),
            time_of_day=data.get("time_of_day", ["DAY"]),
            recurring=data.get("recurring"),
            explicit_details=data.get("explicit_details"),
            character_actions=data.get("character_actions"),
            props_mentioned=data.get("props_mentioned"),
            entry_exit_points=data.get("entry_exit_points"),
            production_flags=data.get("production_flags"),
        )

    def _extract_vision(
        self, screenplay: str, location_name: str
    ) -> DirectorVision:
        """Extract Director Vision from screenplay using LLM."""
        response = self.client.messages.create(
            model=MODEL,
            max_tokens=2048,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"As a film director, create a vision for '{location_name}' "
                        f"based on this screenplay.\n\n"
                        f"SCREENPLAY:\n{screenplay[:3000]}\n\n"
                        f"Output JSON:\n"
                        f'{{"era_and_style": "...", '
                        f'"color_palette_mood": "...", '
                        f'"spatial_philosophy": "...", '
                        f'"atmosphere": "...", '
                        f'"emotional_function": "...", '
                        f'"light_vision": "..."}}'
                    ),
                }
            ],
        )

        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        data = json.loads(text)

        return DirectorVision(
            vision_id=1,
            script_id=1,
            era_and_style=data.get("era_and_style", "contemporary"),
            color_palette_mood=data.get("color_palette_mood"),
            spatial_philosophy=data.get("spatial_philosophy"),
            atmosphere=data.get("atmosphere"),
            emotional_function=data.get("emotional_function"),
            light_vision=data.get("light_vision"),
        )

    def _extract_scenes(
        self, screenplay: str, location_name: str
    ) -> list[dict]:
        """Extract scenes at this location from screenplay using LLM."""
        response = self.client.messages.create(
            model=MODEL,
            max_tokens=2048,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"List all scenes that take place at '{location_name}' "
                        f"in this screenplay.\n\n"
                        f"SCREENPLAY:\n{screenplay[:3000]}\n\n"
                        f"Output JSON array:\n"
                        f'[{{"scene_id": "sc_001", "time_of_day": "DAY", "act": 1, '
                        f'"description": "...", "characters": ["Name"]}}]'
                    ),
                }
            ],
        )

        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(text)
