"""Tests for Location Scout verification hooks — pass/fail cases per hooks.md."""

import pytest

from src.core.hooks import (
    check_era_accuracy,
    validate_bible,
    validate_research,
)
from src.core.schemas import (
    LightBaseState,
    LocationBible,
    Passport,
    ResearchPack,
)


# --- Helpers ---


def _light(**overrides) -> LightBaseState:
    defaults = dict(
        primary_source="window",
        direction="W",
        color_temp_kelvin=5500,
        shadow_hardness="soft",
        fill_to_key_ratio="1:4",
        practical_sources=["desk lamp"],
    )
    defaults.update(overrides)
    return LightBaseState(**defaults)


def _passport(**overrides) -> Passport:
    defaults = dict(type="INT", time_of_day=["DAY", "NIGHT"], era="2004 Albuquerque")
    defaults.update(overrides)
    return Passport(**defaults)


def _bible(**overrides) -> LocationBible:
    defaults = dict(
        bible_id="loc_001",
        brief_id=1,
        vision_id=1,
        research_id=1,
        passport=_passport(),
        space_description="word " * 400,  # exactly 400 words
        atmosphere="Tense and stale air fills the room.",
        light_base_state=_light(),
        key_details=[
            "rotary phone with frayed cord",
            "overflowing ashtray",
            "sagging brown couch",
            "beer cans on coffee table",
            "CRT television with static",
        ],
        negative_list=["modern appliances", "LED lights", "smartphones"],
    )
    defaults.update(overrides)
    return LocationBible(**defaults)


def _research(**overrides) -> ResearchPack:
    defaults = dict(
        research_id=1,
        brief_id=1,
        vision_id=1,
        period_facts=[{"fact": "CRT TVs common in 2004"}],
        typical_elements=["wood paneling", "linoleum", "tube TV"],
        anachronism_list=[
            "flat screen TV",
            "smartphone",
            "LED bulbs",
            "USB-C cables",
            "smart speaker",
        ],
    )
    defaults.update(overrides)
    return ResearchPack(**defaults)


# --- validate_bible ---


class TestValidateBible:
    def test_pass(self):
        ok, errors = validate_bible(_bible())
        assert ok is True
        assert errors == []

    def test_fail_word_count_too_low(self):
        ok, errors = validate_bible(_bible(space_description="short description"))
        assert ok is False
        assert any("word" in e.lower() for e in errors)

    def test_fail_negative_list_too_short(self):
        ok, errors = validate_bible(_bible(negative_list=["one", "two"]))
        assert ok is False
        assert any("negative_list" in e for e in errors)

    def test_fail_key_details_too_few(self):
        ok, errors = validate_bible(_bible(key_details=["a", "b", "c"]))
        assert ok is False
        assert any("key_details" in e for e in errors)

    def test_fail_key_details_too_many(self):
        ok, errors = validate_bible(
            _bible(key_details=[f"item_{i}" for i in range(9)])
        )
        assert ok is False
        assert any("key_details" in e for e in errors)

    def test_fail_negative_term_in_description(self):
        bible = _bible(
            space_description="The room has modern appliances and " + "word " * 400,
        )
        ok, errors = validate_bible(bible)
        assert ok is False
        assert any("modern appliances" in e for e in errors)

    def test_fail_negative_term_in_atmosphere(self):
        bible = _bible(atmosphere="LED lights glow softly.")
        ok, errors = validate_bible(bible)
        assert ok is False
        assert any("LED lights" in e for e in errors)

    def test_fail_empty_light_direction(self):
        ok, errors = validate_bible(_bible(light_base_state=_light(direction="")))
        assert ok is False
        assert any("direction" in e for e in errors)

    def test_multiple_errors(self):
        bible = _bible(
            space_description="short",
            negative_list=["a"],
            key_details=["one"],
        )
        ok, errors = validate_bible(bible)
        assert ok is False
        assert len(errors) >= 3  # word count + negative_list + key_details


# --- check_era_accuracy ---


class TestCheckEraAccuracy:
    def test_pass_no_anachronisms(self):
        ok, errors = check_era_accuracy(_bible(), _research())
        assert ok is True
        assert errors == []

    def test_fail_anachronism_in_key_details(self):
        bible = _bible(
            key_details=[
                "flat screen TV on the wall",
                "rotary phone",
                "ashtray",
                "beer cans",
                "couch",
            ]
        )
        ok, errors = check_era_accuracy(bible, _research())
        assert ok is False
        assert any("flat screen TV" in e for e in errors)

    def test_fail_anachronism_in_space_description(self):
        bible = _bible(
            space_description="A smartphone sits on the table. " + "word " * 400
        )
        ok, errors = check_era_accuracy(bible, _research())
        assert ok is False
        assert any("smartphone" in e.lower() for e in errors)

    def test_case_insensitive(self):
        bible = _bible(
            space_description="A FLAT SCREEN TV dominates the wall. " + "word " * 400
        )
        ok, errors = check_era_accuracy(bible, _research())
        assert ok is False


# --- validate_research ---


class TestValidateResearch:
    def test_pass(self):
        ok, errors = validate_research(_research())
        assert ok is True
        assert errors == []

    def test_fail_anachronism_list_too_short(self):
        ok, errors = validate_research(
            _research(anachronism_list=["one", "two", "three"])
        )
        assert ok is False
        assert any("anachronism_list" in e for e in errors)

    def test_fail_empty_period_facts(self):
        ok, errors = validate_research(_research(period_facts=[]))
        assert ok is False
        assert any("period_facts" in e for e in errors)

    def test_fail_typical_elements_too_few(self):
        ok, errors = validate_research(_research(typical_elements=["one", "two"]))
        assert ok is False
        assert any("typical_elements" in e for e in errors)

    def test_fail_all_three(self):
        ok, errors = validate_research(
            _research(
                anachronism_list=["a"],
                period_facts=[],
                typical_elements=["b"],
            )
        )
        assert ok is False
        assert len(errors) == 3
