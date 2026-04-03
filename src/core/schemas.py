"""Pydantic models for Location Scout agent — exactly per erd-schema.md (10 entities)."""

from __future__ import annotations

from pydantic import BaseModel, Field


# --- Sub-models (used inside main entities) ---


class Passport(BaseModel):
    """Location passport embedded in LocationBible."""

    type: str = Field(..., description="INT | EXT | INT/EXT")
    time_of_day: list[str] = Field(..., description="DAY, NIGHT, DAWN, DUSK, CONTINUOUS")
    era: str = Field(..., description="e.g. '2004 Albuquerque'")
    recurring: bool = Field(default=False, description="true if 3+ scenes")
    scenes: list[str] = Field(default_factory=list)
    cluster_id: str | None = Field(default=None)


class LightBaseState(BaseModel):
    """Structured light data for LocationBible."""

    primary_source: str = Field(..., description="e.g. 'window', 'overhead fluorescent'")
    direction: str = Field(..., description="Cardinal: N/S/E/W/NE/NW/SE/SW/OVERHEAD/MULTIPLE")
    color_temp_kelvin: int = Field(..., description="2700=warm, 4000=neutral, 5500=daylight, 6500=overcast")
    shadow_hardness: str = Field(..., description="hard | soft | mixed")
    fill_to_key_ratio: str = Field(..., description="e.g. '1:2' or '1:8'")
    practical_sources: list[str] = Field(default_factory=list)


# --- 10 Entities from ERD ---


class Script(BaseModel):
    """Source screenplay document."""

    script_id: int
    title: str
    content: str
    version: str | None = None
    author: str | None = None


class AdLocationBrief(BaseModel):
    """Hard constraints from 1st AD, extracted from screenplay."""

    brief_id: int
    script_id: int
    location_name: str
    location_type: str = Field(..., description="INT/EXT/INT-EXT")
    time_of_day: list[str]
    recurring: bool | None = None
    explicit_details: dict | None = None
    character_actions: dict | None = None
    required_practicals: dict | None = None
    entry_exit_points: dict | None = None
    props_mentioned: dict | None = None
    time_continuity: str | None = None
    production_flags: dict | None = None


class DirectorVision(BaseModel):
    """Soft creative interpretation from Director."""

    vision_id: int
    script_id: int
    era_and_style: str
    color_palette_mood: str | None = None
    spatial_philosophy: str | None = None
    reference_films: list | None = None
    reference_images: list | None = None
    emotional_function: str | None = None
    atmosphere: str | None = None
    key_visual_metaphors: list | None = None
    light_vision: str | None = None


class ResearchPack(BaseModel):
    """Historical research output from research cycle."""

    research_id: int
    brief_id: int
    vision_id: int
    period_facts: list[dict]
    typical_elements: list[str]
    anachronism_list: list[str]
    visual_references: list | None = None
    research_status: str | None = None


class LocationBible(BaseModel):
    """Central entity — canonical text description. Source of truth."""

    bible_id: str
    brief_id: int
    vision_id: int
    research_id: int
    passport: Passport
    space_description: str
    atmosphere: str
    light_base_state: LightBaseState
    key_details: list[str]
    negative_list: list[str]
    approval_status: str | None = "draft"


class FloorplanPackage(BaseModel):
    """Spatial layout with lighting data."""

    floorplan_id: int
    bible_id: str
    plan_png: str
    coords_json: dict
    light_sources: list[dict]
    light_direction: str
    color_temp_kelvin: int
    shadow_hardness: str | None = None
    fill_to_key_ratio: float | None = None
    camera_feasibility: dict | None = None
    dimensions: dict | None = None


class AnchorImage(BaseModel):
    """Canonical establishing shot — visual source of truth."""

    anchor_id: int
    bible_id: str
    image_url: str
    anchor_prompt: str
    approval_status: str
    generation_params: dict | None = None
    feedback_notes: str | None = None


class MoodState(BaseModel):
    """Delta from Bible base state, per scene group."""

    state_id: str
    bible_id: str
    scene_ids: list[str]
    act: int
    time_of_day: str
    light_direction: str | None = None
    weather: str | None = None
    color_temp_kelvin: int | None = None
    shadow_hardness: str | None = None
    light_change: str | None = None
    props_change: str | None = None
    atmosphere_shift: str | None = None
    clutter_level: str | None = None
    window_state: str | None = None


class SetupExtraction(BaseModel):
    """Per-scene camera setup combining floorplan + mood."""

    setup_id: int
    floorplan_id: int
    state_id: str
    scene_id: str
    camera_position: dict
    characters: list[dict]
    active_practicals: list[dict] | None = None
    key_props_in_frame: list[str] | None = None
    frame_composition: str | None = None


class IsometricReference(BaseModel):
    """3D spatial reference for Storyboard and DP."""

    iso_id: int
    bible_id: str
    floorplan_id: int
    iso_image_url: str
    iso_prompt: str
    style_reference: str | None = None
