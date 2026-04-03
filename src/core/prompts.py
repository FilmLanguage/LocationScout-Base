"""Prompt construction from Location Bible fields.

CRITICAL: negative_list terms are ALWAYS added to negative_prompt in every generation.
"""

from __future__ import annotations

import json

from .schemas import DirectorVision, LocationBible, MoodState


def build_anchor_prompt(bible: LocationBible, vision: DirectorVision) -> str:
    """Build the anchor image generation prompt from Bible fields.

    Prompt sources per pipeline.md Step 5:
    1. Core description from Bible.space_description
    2. Light parameters from Bible.light_base_state
    3. Key details from Bible.key_details
    4. Style/era guidance from Director Vision
    """
    light = bible.light_base_state

    prompt = (
        f"Cinematic establishing wide shot of {bible.passport.type} location.\n"
        f"Era: {bible.passport.era}.\n\n"
        f"SPACE: {bible.space_description}\n\n"
        f"ATMOSPHERE: {bible.atmosphere}\n\n"
        f"LIGHTING:\n"
        f"  Primary source: {light.primary_source}\n"
        f"  Direction: {light.direction}\n"
        f"  Color temperature: {light.color_temp_kelvin}K\n"
        f"  Shadow hardness: {light.shadow_hardness}\n"
        f"  Fill-to-key ratio: {light.fill_to_key_ratio}\n"
        f"  Practical sources: {', '.join(light.practical_sources)}\n\n"
        f"KEY DETAILS (must be visible):\n"
        + "\n".join(f"  - {d}" for d in bible.key_details)
    )

    if vision.color_palette_mood:
        prompt += f"\n\nCOLOR PALETTE: {vision.color_palette_mood}"
    if vision.atmosphere:
        prompt += f"\nDIRECTOR ATMOSPHERE: {vision.atmosphere}"

    return prompt


def build_negative_prompt(bible: LocationBible) -> str:
    """Build negative prompt from Bible's negative_list.

    This is a MECHANICAL ban — every term is included, no exceptions.
    """
    return ", ".join(bible.negative_list)


def build_mood_prompt(bible: LocationBible, mood: MoodState) -> str:
    """Build scene generation prompt applying mood state delta over base.

    The mood state overrides specific base state values.
    """
    light = bible.light_base_state

    # Apply deltas
    direction = mood.light_direction or light.direction
    kelvin = mood.color_temp_kelvin or light.color_temp_kelvin
    shadow = mood.shadow_hardness or light.shadow_hardness

    prompt = (
        f"Scene at {bible.passport.type} location, {bible.passport.era}.\n"
        f"Time: {mood.time_of_day}. Act {mood.act}.\n\n"
        f"BASE SPACE: {bible.space_description[:300]}...\n\n"
    )

    if mood.light_change:
        prompt += f"LIGHT CHANGE from base: {mood.light_change}\n"
    prompt += (
        f"CURRENT LIGHTING:\n"
        f"  Direction: {direction}\n"
        f"  Color temperature: {kelvin}K\n"
        f"  Shadow: {shadow}\n"
    )

    if mood.weather:
        prompt += f"  Weather: {mood.weather}\n"

    if mood.props_change:
        prompt += f"\nPROPS CHANGE: {mood.props_change}\n"
    if mood.atmosphere_shift:
        prompt += f"ATMOSPHERE SHIFT: {mood.atmosphere_shift}\n"
    if mood.clutter_level:
        prompt += f"CLUTTER LEVEL: {mood.clutter_level}\n"
    if mood.window_state:
        prompt += f"WINDOW STATE: {mood.window_state}\n"

    return prompt
