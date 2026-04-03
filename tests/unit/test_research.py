"""Tests for ResearchCycle — mocked Anthropic API."""

import json
from unittest.mock import MagicMock, patch

import pytest

from src.core.research import ResearchCycle, ResearchInsufficientError
from src.core.schemas import AdLocationBrief, DirectorVision


def _brief():
    return AdLocationBrief(
        brief_id=1,
        script_id=1,
        location_name="Jesse's Apartment — Living Room",
        location_type="INT",
        time_of_day=["DAY", "NIGHT"],
    )


def _vision():
    return DirectorVision(
        vision_id=1,
        script_id=1,
        era_and_style="2004 Albuquerque, lower-middle class",
    )


def _valid_research_json():
    return json.dumps({
        "period_facts": [
            {"fact": "CRT TVs were standard in 2004", "source_context": "technology"},
            {"fact": "Cordless landline phones common", "source_context": "technology"},
        ],
        "typical_elements": [
            "wood-veneer furniture",
            "linoleum flooring",
            "popcorn ceiling",
            "venetian blinds",
        ],
        "anachronism_list": [
            "flat screen TV",
            "smartphone",
            "LED bulbs",
            "USB-C cables",
            "smart speaker",
            "streaming service UI",
        ],
        "visual_references": [
            "2004 Albuquerque apartment interiors",
        ],
    })


def _insufficient_research_json():
    return json.dumps({
        "period_facts": [],
        "typical_elements": ["one"],
        "anachronism_list": ["two"],
    })


def _make_response(text: str):
    """Create a mock Anthropic response."""
    content_block = MagicMock()
    content_block.text = text
    response = MagicMock()
    response.content = [content_block]
    return response


class TestResearchCycle:
    def test_success_first_attempt(self):
        client = MagicMock()
        client.messages.create.return_value = _make_response(_valid_research_json())

        cycle = ResearchCycle(client=client, max_retries=3)
        pack = cycle.research(_brief(), _vision())

        assert len(pack.anachronism_list) >= 5
        assert len(pack.typical_elements) >= 3
        assert len(pack.period_facts) >= 1
        assert client.messages.create.call_count == 1

    def test_retry_on_insufficient_then_pass(self):
        client = MagicMock()
        client.messages.create.side_effect = [
            _make_response(_insufficient_research_json()),
            _make_response(_valid_research_json()),
        ]

        cycle = ResearchCycle(client=client, max_retries=3)
        pack = cycle.research(_brief(), _vision())

        assert client.messages.create.call_count == 2
        assert len(pack.anachronism_list) >= 5

    def test_max_retries_exceeded(self):
        client = MagicMock()
        client.messages.create.return_value = _make_response(
            _insufficient_research_json()
        )

        cycle = ResearchCycle(client=client, max_retries=3)
        with pytest.raises(ResearchInsufficientError):
            cycle.research(_brief(), _vision())

        assert client.messages.create.call_count == 3

    def test_handles_markdown_code_block(self):
        client = MagicMock()
        wrapped = "```json\n" + _valid_research_json() + "\n```"
        client.messages.create.return_value = _make_response(wrapped)

        cycle = ResearchCycle(client=client)
        pack = cycle.research(_brief(), _vision())

        assert len(pack.anachronism_list) >= 5

    def test_error_context_included_in_retry(self):
        """Verify that error messages are passed to the next attempt."""
        client = MagicMock()
        client.messages.create.side_effect = [
            _make_response(_insufficient_research_json()),
            _make_response(_valid_research_json()),
        ]

        cycle = ResearchCycle(client=client, max_retries=3)
        cycle.research(_brief(), _vision())

        # Second call should include error context
        second_call = client.messages.create.call_args_list[1]
        user_msg = second_call.kwargs["messages"][0]["content"]
        assert "FAILED VALIDATION" in user_msg
