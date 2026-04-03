"""Verification hooks for Location Scout — exactly per hooks.md.

Hook convention:
  pass → (True, [])
  fail → (False, ["specific error", ...])
"""

from __future__ import annotations

import base64
import json
import os
from pathlib import Path

import anthropic

from .schemas import LocationBible, ResearchPack

MODEL = "claude-sonnet-4-20250514"


# ---------------------------------------------------------------------------
# Hook: post-bible-write
# ---------------------------------------------------------------------------


def validate_bible(bible: LocationBible) -> tuple[bool, list[str]]:
    """Validate a LocationBible per hooks.md post-bible-write checks.

    1. All NOT_NULL fields populated (Pydantic handles, but verify sub-fields)
    2. space_description word count >= 400
    3. negative_list >= 3 entries
    4. light_base_state: direction + color_temp_kelvin + shadow_hardness filled
    5. key_details: 5-8 entries
    6. No negative_list terms appear in space_description or atmosphere
    """
    errors: list[str] = []

    # 1. Required sub-fields in passport
    if not bible.passport.type:
        errors.append("passport.type is empty")
    if not bible.passport.time_of_day:
        errors.append("passport.time_of_day is empty")
    if not bible.passport.era:
        errors.append("passport.era is empty")

    # 2. Word count
    word_count = len(bible.space_description.split())
    if word_count < 400:
        errors.append(f"space_description has {word_count} words, minimum is 400")

    # 3. Negative list size
    if len(bible.negative_list) < 3:
        errors.append(
            f"negative_list has {len(bible.negative_list)} entries, minimum is 3"
        )

    # 4. Light base state required fields
    if not bible.light_base_state.direction:
        errors.append("light_base_state.direction is empty")
    if not bible.light_base_state.color_temp_kelvin:
        errors.append("light_base_state.color_temp_kelvin is empty")
    if not bible.light_base_state.shadow_hardness:
        errors.append("light_base_state.shadow_hardness is empty")

    # 5. Key details count
    count = len(bible.key_details)
    if count < 5 or count > 8:
        errors.append(f"key_details has {count} entries, must be 5-8")

    # 6. Negative list terms must not appear in text
    combined_text = (bible.space_description + " " + bible.atmosphere).lower()
    for term in bible.negative_list:
        if term.lower() in combined_text:
            errors.append(
                f"negative_list term '{term}' found in space_description or atmosphere"
            )

    if errors:
        return (False, errors)
    return (True, [])


# ---------------------------------------------------------------------------
# Hook: era-accuracy-check
# ---------------------------------------------------------------------------


def check_era_accuracy(
    bible: LocationBible, research: ResearchPack
) -> tuple[bool, list[str]]:
    """Cross-reference Bible against research anachronism_list.

    Checks key_details and space_description for anachronistic terms.
    """
    errors: list[str] = []

    # Combine text to search
    details_text = " ".join(bible.key_details).lower()
    description_text = bible.space_description.lower()

    for anachronism in research.anachronism_list:
        term_lower = anachronism.lower()
        if term_lower in details_text:
            errors.append(f"Anachronism '{anachronism}' found in key_details")
        if term_lower in description_text:
            errors.append(f"Anachronism '{anachronism}' found in space_description")

    if errors:
        return (False, errors)
    return (True, [])


# ---------------------------------------------------------------------------
# Hook: post-anchor-generation (VLM audit)
# ---------------------------------------------------------------------------


def vlm_audit_image(
    image_path: str, bible: LocationBible
) -> tuple[bool, list[str]]:
    """VLM audit: send image + Bible to Claude Vision, check for issues.

    Checks:
    - Does image match space description?
    - Are there anachronistic elements?
    - Are items from negative_list visible?
    - Does lighting match light_base_state?
    """
    path = Path(image_path)
    if not path.exists():
        return (False, [f"Image file not found: {image_path}"])

    image_data = base64.standard_b64encode(path.read_bytes()).decode("utf-8")

    media_type = "image/png"
    if path.suffix.lower() in (".jpg", ".jpeg"):
        media_type = "image/jpeg"

    client = anthropic.Anthropic()

    audit_prompt = f"""You are a visual quality auditor for a film production pipeline.

Compare this generated image against the Location Bible below. Check for:

1. SPACE MATCH: Does the image match the space description?
2. ANACHRONISMS: Are there any objects/elements that don't belong in the era "{bible.passport.era}"?
3. NEGATIVE LIST: Are any of these items visible? {json.dumps(bible.negative_list)}
4. LIGHTING: Does the lighting match? Expected: direction={bible.light_base_state.direction}, color_temp={bible.light_base_state.color_temp_kelvin}K, shadow={bible.light_base_state.shadow_hardness}

Location Bible:
- Space: {bible.space_description[:500]}
- Atmosphere: {bible.atmosphere}
- Key details expected: {json.dumps(bible.key_details)}

Respond in JSON format:
{{"pass": true/false, "issues": ["issue 1", "issue 2", ...]}}

If everything looks correct, respond: {{"pass": true, "issues": []}}"""

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {"type": "text", "text": audit_prompt},
                ],
            }
        ],
    )

    response_text = response.content[0].text

    try:
        # Extract JSON from response (handle markdown code blocks)
        text = response_text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(text)
        if result.get("pass", False):
            return (True, [])
        return (False, result.get("issues", ["VLM audit failed"]))
    except (json.JSONDecodeError, IndexError):
        return (False, [f"VLM response parse error: {response_text[:200]}"])


# ---------------------------------------------------------------------------
# Hook: post-research
# ---------------------------------------------------------------------------


def validate_research(research: ResearchPack) -> tuple[bool, list[str]]:
    """Validate research pack per hooks.md post-research checks.

    1. anachronism_list >= 5 entries
    2. period_facts is not empty
    3. typical_elements >= 3 entries
    """
    errors: list[str] = []

    if len(research.anachronism_list) < 5:
        errors.append(
            f"anachronism_list has {len(research.anachronism_list)} entries, minimum is 5"
        )

    if not research.period_facts:
        errors.append("period_facts is empty")

    if len(research.typical_elements) < 3:
        errors.append(
            f"typical_elements has {len(research.typical_elements)} entries, minimum is 3"
        )

    if errors:
        return (False, errors)
    return (True, [])
