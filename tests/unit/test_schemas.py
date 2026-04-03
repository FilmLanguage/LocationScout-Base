"""Tests for Location Scout Pydantic schemas — all 10 entities."""

import pytest
from pydantic import ValidationError

from src.core.schemas import (
    AdLocationBrief,
    AnchorImage,
    DirectorVision,
    FloorplanPackage,
    IsometricReference,
    LightBaseState,
    LocationBible,
    MoodState,
    Passport,
    ResearchPack,
    Script,
    SetupExtraction,
)


# --- Fixtures ---


def _passport() -> Passport:
    return Passport(type="INT", time_of_day=["DAY", "NIGHT"], era="2004 Albuquerque")


def _light() -> LightBaseState:
    return LightBaseState(
        primary_source="window",
        direction="W",
        color_temp_kelvin=5500,
        shadow_hardness="soft",
        fill_to_key_ratio="1:4",
        practical_sources=["desk lamp"],
    )


def _bible() -> LocationBible:
    return LocationBible(
        bible_id="loc_001",
        brief_id=1,
        vision_id=1,
        research_id=1,
        passport=_passport(),
        space_description="word " * 400,
        atmosphere="Tense and stale.",
        light_base_state=_light(),
        key_details=["rotary phone", "frayed cord", "ashtray", "beer cans", "sagging couch"],
        negative_list=["modern appliances", "LED lights", "smartphones"],
    )


# --- Script ---


class TestScript:
    def test_valid(self):
        s = Script(script_id=1, title="Lost Dogs", content="Scene 1...")
        assert s.title == "Lost Dogs"

    def test_missing_required(self):
        with pytest.raises(ValidationError):
            Script(script_id=1, title="Lost Dogs")  # missing content


# --- AdLocationBrief ---


class TestAdLocationBrief:
    def test_valid(self):
        b = AdLocationBrief(
            brief_id=1,
            script_id=1,
            location_name="Jesse's Apartment",
            location_type="INT",
            time_of_day=["DAY", "NIGHT"],
        )
        assert b.location_name == "Jesse's Apartment"

    def test_missing_location_type(self):
        with pytest.raises(ValidationError):
            AdLocationBrief(
                brief_id=1,
                script_id=1,
                location_name="Jesse's Apartment",
                time_of_day=["DAY"],
            )

    def test_optional_fields_default_none(self):
        b = AdLocationBrief(
            brief_id=1,
            script_id=1,
            location_name="Test",
            location_type="EXT",
            time_of_day=["DAY"],
        )
        assert b.explicit_details is None
        assert b.character_actions is None
        assert b.production_flags is None


# --- DirectorVision ---


class TestDirectorVision:
    def test_valid(self):
        v = DirectorVision(
            vision_id=1, script_id=1, era_and_style="2004 Southwest meth culture"
        )
        assert v.era_and_style == "2004 Southwest meth culture"

    def test_missing_era(self):
        with pytest.raises(ValidationError):
            DirectorVision(vision_id=1, script_id=1)


# --- ResearchPack ---


class TestResearchPack:
    def test_valid(self):
        r = ResearchPack(
            research_id=1,
            brief_id=1,
            vision_id=1,
            period_facts=[{"fact": "CRT TVs common in 2004"}],
            typical_elements=["wood paneling", "linoleum", "tube TV"],
            anachronism_list=[
                "flat screen TV",
                "smartphone",
                "LED bulbs",
                "USB-C",
                "smart speaker",
            ],
        )
        assert len(r.anachronism_list) == 5

    def test_missing_anachronism_list(self):
        with pytest.raises(ValidationError):
            ResearchPack(
                research_id=1,
                brief_id=1,
                vision_id=1,
                period_facts=[{"fact": "test"}],
                typical_elements=["a", "b", "c"],
            )


# --- LocationBible ---


class TestLocationBible:
    def test_valid(self):
        bible = _bible()
        assert bible.bible_id == "loc_001"
        assert bible.approval_status == "draft"

    def test_missing_space_description(self):
        with pytest.raises(ValidationError):
            LocationBible(
                bible_id="loc_001",
                brief_id=1,
                vision_id=1,
                research_id=1,
                passport=_passport(),
                atmosphere="test",
                light_base_state=_light(),
                key_details=["a"],
                negative_list=["b"],
            )

    def test_passport_embedded(self):
        bible = _bible()
        assert bible.passport.type == "INT"
        assert bible.passport.era == "2004 Albuquerque"

    def test_light_embedded(self):
        bible = _bible()
        assert bible.light_base_state.color_temp_kelvin == 5500
        assert bible.light_base_state.direction == "W"


# --- FloorplanPackage ---


class TestFloorplanPackage:
    def test_valid(self):
        f = FloorplanPackage(
            floorplan_id=1,
            bible_id="loc_001",
            plan_png="/project/gallery/locations/loc_001_floorplan.png",
            coords_json={"camera_1": {"x": 100, "y": 200}},
            light_sources=[{"type": "window", "position": "W"}],
            light_direction="W",
            color_temp_kelvin=5500,
        )
        assert f.plan_png.endswith(".png")

    def test_missing_required(self):
        with pytest.raises(ValidationError):
            FloorplanPackage(
                floorplan_id=1,
                bible_id="loc_001",
                plan_png="/test.png",
                coords_json={},
                light_sources=[],
                # missing light_direction, color_temp_kelvin
            )


# --- AnchorImage ---


class TestAnchorImage:
    def test_valid(self):
        a = AnchorImage(
            anchor_id=1,
            bible_id="loc_001",
            image_url="/project/gallery/locations/loc_001_anchor.png",
            anchor_prompt="Wide shot of a dingy apartment...",
            approval_status="approved",
        )
        assert a.approval_status == "approved"

    def test_missing_approval_status(self):
        with pytest.raises(ValidationError):
            AnchorImage(
                anchor_id=1,
                bible_id="loc_001",
                image_url="/test.png",
                anchor_prompt="test",
            )


# --- MoodState ---


class TestMoodState:
    def test_valid_delta(self):
        m = MoodState(
            state_id="mood_loc_001_01",
            bible_id="loc_001",
            scene_ids=["sc_002"],
            act=1,
            time_of_day="NIGHT",
            light_change="5500K → 2700K, direction W → overhead",
            props_change="beer cans accumulate",
            atmosphere_shift="tense silence",
        )
        assert m.light_direction is None  # delta — null means use base
        assert m.weather is None

    def test_required_fields(self):
        with pytest.raises(ValidationError):
            MoodState(
                state_id="mood_001",
                bible_id="loc_001",
                scene_ids=["sc_001"],
                # missing act and time_of_day
            )


# --- SetupExtraction ---


class TestSetupExtraction:
    def test_valid(self):
        s = SetupExtraction(
            setup_id=1,
            floorplan_id=1,
            state_id="mood_loc_001_01",
            scene_id="sc_001",
            camera_position={"x": 100, "y": 200, "angle": "eye_level"},
            characters=[{"name": "Jesse", "position": "couch"}],
        )
        assert s.scene_id == "sc_001"


# --- IsometricReference ---


class TestIsometricReference:
    def test_valid(self):
        i = IsometricReference(
            iso_id=1,
            bible_id="loc_001",
            floorplan_id=1,
            iso_image_url="/project/gallery/locations/loc_001_isometric.png",
            iso_prompt="Isometric view of a small apartment...",
        )
        assert i.style_reference is None

    def test_missing_prompt(self):
        with pytest.raises(ValidationError):
            IsometricReference(
                iso_id=1,
                bible_id="loc_001",
                floorplan_id=1,
                iso_image_url="/test.png",
            )


# --- Sub-models ---


class TestPassport:
    def test_defaults(self):
        p = Passport(type="INT", time_of_day=["DAY"], era="2004")
        assert p.recurring is False
        assert p.scenes == []
        assert p.cluster_id is None


class TestLightBaseState:
    def test_all_fields(self):
        l = _light()
        assert l.primary_source == "window"
        assert l.practical_sources == ["desk lamp"]
