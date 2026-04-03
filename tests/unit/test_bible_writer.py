"""Tests for BibleWriter — mocked Anthropic API."""

import json
from unittest.mock import MagicMock

import pytest

from src.core.bible_writer import BibleWriter, BibleWriteError
from src.core.schemas import AdLocationBrief, DirectorVision, ResearchPack


def _brief():
    return AdLocationBrief(
        brief_id=1,
        script_id=1,
        location_name="Jesse's Apartment — Living Room",
        location_type="INT",
        time_of_day=["DAY", "NIGHT"],
        props_mentioned={"bong": True, "beer_cans": True},
    )


def _vision():
    return DirectorVision(
        vision_id=1,
        script_id=1,
        era_and_style="2004 Albuquerque, lower-middle class",
        atmosphere="Stagnant, depressed, trapped",
        color_palette_mood="Desaturated yellows and browns",
    )


def _research():
    return ResearchPack(
        research_id=1,
        brief_id=1,
        vision_id=1,
        period_facts=[{"fact": "CRT TVs common in 2004"}],
        typical_elements=["wood-veneer furniture", "linoleum", "popcorn ceiling"],
        anachronism_list=[
            "flat screen TV",
            "smartphone",
            "LED bulbs",
            "USB-C cables",
            "smart speaker",
        ],
    )


def _valid_bible_json():
    return json.dumps({
        "bible_id": "loc_001",
        "location_name": "Jesse's Apartment — Living Room",
        "passport": {
            "type": "INT",
            "time_of_day": ["DAY", "NIGHT"],
            "era": "2004 Albuquerque",
            "recurring": True,
            "scenes": ["sc_001", "sc_002"],
            "cluster_id": None,
        },
        "space_description": " ".join(
            [
                "A cramped, ground-floor apartment living room, roughly 14 by 16 feet,",
                "with low popcorn ceilings that amplify the claustrophobic feel.",
                "The walls are off-white drywall, yellowed by years of cigarette smoke,",
                "with water stains blooming near the ceiling corners.",
                "The carpet is industrial beige, matted and stained.",
            ]
            + ["The room continues with more period-accurate details. "] * 60
            + ["Final sentence about the worn condition of the space."]
        ),
        "atmosphere": (
            "The air is thick with stale cigarette smoke and the faint sweetness of old beer. "
            "A persistent low hum from the refrigerator in the adjacent kitchen bleeds through "
            "the thin walls. The space feels abandoned even when occupied."
        ),
        "light_base_state": {
            "primary_source": "window",
            "direction": "W",
            "color_temp_kelvin": 5500,
            "shadow_hardness": "soft",
            "fill_to_key_ratio": "1:4",
            "practical_sources": [
                "CRT television glow",
                "single overhead bulb with no shade",
            ],
        },
        "key_details": [
            "sagging brown corduroy couch with cigarette burns",
            "glass bong on a cluttered coffee table",
            "CRT television showing static",
            "overflowing ceramic ashtray",
            "cordless landline phone on the floor",
        ],
        "negative_list": [
            "flat screen TV",
            "smartphone",
            "LED bulbs",
            "USB-C cables",
            "smart speaker",
            "modern appliances",
        ],
        "approval_status": "draft",
    })


def _invalid_bible_json_short():
    """Bible with too-short space_description (will fail validate_bible)."""
    return json.dumps({
        "bible_id": "loc_001",
        "passport": {
            "type": "INT",
            "time_of_day": ["DAY"],
            "era": "2004",
        },
        "space_description": "A small room.",
        "atmosphere": "Tense.",
        "light_base_state": {
            "primary_source": "window",
            "direction": "W",
            "color_temp_kelvin": 5500,
            "shadow_hardness": "soft",
            "fill_to_key_ratio": "1:4",
        },
        "key_details": ["one item"],
        "negative_list": ["a"],
        "approval_status": "draft",
    })


def _make_response(text: str):
    content_block = MagicMock()
    content_block.text = text
    response = MagicMock()
    response.content = [content_block]
    return response


class TestBibleWriter:
    def test_success_first_attempt(self):
        client = MagicMock()
        client.messages.create.return_value = _make_response(_valid_bible_json())

        writer = BibleWriter(client=client)
        bible = writer.write_bible(_brief(), _vision(), _research())

        assert bible.bible_id == "loc_001"
        assert bible.passport.type == "INT"
        assert len(bible.key_details) == 5
        assert len(bible.negative_list) >= 3
        assert client.messages.create.call_count == 1

    def test_retry_on_validation_failure(self):
        client = MagicMock()
        client.messages.create.side_effect = [
            _make_response(_invalid_bible_json_short()),
            _make_response(_valid_bible_json()),
        ]

        writer = BibleWriter(client=client)
        bible = writer.write_bible(_brief(), _vision(), _research())

        assert client.messages.create.call_count == 2
        assert len(bible.space_description.split()) >= 400

    def test_max_retries_exceeded(self):
        client = MagicMock()
        client.messages.create.return_value = _make_response(
            _invalid_bible_json_short()
        )

        writer = BibleWriter(client=client, max_retries=3)
        with pytest.raises(BibleWriteError):
            writer.write_bible(_brief(), _vision(), _research())

        assert client.messages.create.call_count == 3

    def test_era_accuracy_gate(self):
        """Bible passes validate_bible but has anachronism → triggers era check failure."""
        anachronistic_bible = json.loads(_valid_bible_json())
        anachronistic_bible["key_details"][0] = "flat screen TV on the wall"
        first_response = json.dumps(anachronistic_bible)

        client = MagicMock()
        client.messages.create.side_effect = [
            _make_response(first_response),
            _make_response(_valid_bible_json()),
        ]

        writer = BibleWriter(client=client)
        bible = writer.write_bible(_brief(), _vision(), _research())

        # First attempt fails era check, second succeeds
        assert client.messages.create.call_count == 2
        assert "flat screen TV" not in " ".join(bible.key_details)

    def test_handles_markdown_code_block(self):
        client = MagicMock()
        wrapped = "```json\n" + _valid_bible_json() + "\n```"
        client.messages.create.return_value = _make_response(wrapped)

        writer = BibleWriter(client=client)
        bible = writer.write_bible(_brief(), _vision(), _research())

        assert bible.bible_id == "loc_001"

    def test_brief_constraints_in_prompt(self):
        """Verify that AD brief constraints appear in the prompt sent to LLM."""
        client = MagicMock()
        client.messages.create.return_value = _make_response(_valid_bible_json())

        writer = BibleWriter(client=client)
        writer.write_bible(_brief(), _vision(), _research())

        call_args = client.messages.create.call_args
        user_msg = call_args.kwargs["messages"][0]["content"]
        assert "Jesse's Apartment" in user_msg
        assert "hard constraints" in user_msg.lower()
