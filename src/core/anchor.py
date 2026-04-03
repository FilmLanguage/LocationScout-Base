"""Anchor Image Generator — canonical establishing shot with VLM audit loop."""

from __future__ import annotations

import json
import logging

import anthropic

from .hooks import vlm_audit_image
from .prompts import build_anchor_prompt, build_negative_prompt
from .schemas import AnchorImage, DirectorVision, LocationBible

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"


class AnchorGenerationError(Exception):
    """Raised when anchor image fails audit after max retries."""


class AnchorImageGenerator:
    """Generates the canonical anchor image for a location.

    Uses Ralph Wiggum Loop: generate → vlm_audit → if fail, adjust prompt → retry.
    Max retries: 3. On budget exceeded: raise error for human escalation.
    """

    def __init__(
        self,
        client: anthropic.Anthropic | None = None,
        max_retries: int = 3,
    ):
        self.client = client or anthropic.Anthropic()
        self.max_retries = max_retries

    def generate(
        self,
        bible: LocationBible,
        vision: DirectorVision,
        output_path: str,
    ) -> AnchorImage:
        """Generate and validate anchor image. Returns AnchorImage or raises.

        Note: actual image generation requires an image generation API.
        This implementation generates the prompt and performs VLM audit.
        The image generation call is abstracted for future integration
        with DALL-E, Midjourney, Flux, or other providers.
        """
        positive_prompt = build_anchor_prompt(bible, vision)
        negative_prompt = build_negative_prompt(bible)
        errors_context: list[str] = []

        for attempt in range(1, self.max_retries + 1):
            current_prompt = positive_prompt
            if errors_context:
                current_prompt += (
                    "\n\nPREVIOUS IMAGE FAILED AUDIT. Adjust for:\n"
                    + "\n".join(f"- {e}" for e in errors_context)
                )

            # Image generation placeholder
            # In production, this calls the actual image generation API:
            #   image_bytes = image_api.generate(prompt=current_prompt, negative=negative_prompt, ...)
            #   Path(output_path).write_bytes(image_bytes)
            image_generated = self._generate_image(
                current_prompt, negative_prompt, output_path
            )

            if not image_generated:
                logger.warning("Image generation failed (attempt %d)", attempt)
                errors_context = ["Image generation API returned no image"]
                continue

            # VLM Audit hook
            ok, errors = vlm_audit_image(output_path, bible)
            if ok:
                return AnchorImage(
                    anchor_id=attempt,
                    bible_id=bible.bible_id,
                    image_url=output_path,
                    anchor_prompt=current_prompt,
                    approval_status="approved",
                    generation_params={
                        "negative_prompt": negative_prompt,
                        "attempt": attempt,
                    },
                )

            # Only errors enter context (Ralph Wiggum Loop policy)
            errors_context = errors
            logger.warning("VLM audit failed (attempt %d): %s", attempt, errors)

        raise AnchorGenerationError(
            f"Anchor image failed audit after {self.max_retries} attempts. "
            f"Last errors: {errors_context}"
        )

    def _generate_image(
        self, prompt: str, negative_prompt: str, output_path: str
    ) -> bool:
        """Placeholder for actual image generation API call.

        In production, integrate with DALL-E / Flux / Midjourney / ComfyUI.
        Returns True if image was successfully generated and saved.
        """
        # For now, use Claude to generate a detailed image description
        # that can be fed to an image generation pipeline
        try:
            response = self.client.messages.create(
                model=MODEL,
                max_tokens=2048,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            "Generate a detailed image generation prompt for this location.\n\n"
                            f"POSITIVE PROMPT:\n{prompt}\n\n"
                            f"NEGATIVE PROMPT:\n{negative_prompt}\n\n"
                            "Output a single refined prompt optimized for Flux/DALL-E."
                        ),
                    }
                ],
            )

            # Store the refined prompt as a placeholder
            # In production, the actual PNG would be generated here
            from pathlib import Path

            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps(
                    {
                        "status": "prompt_generated",
                        "refined_prompt": response.content[0].text,
                        "negative_prompt": negative_prompt,
                        "note": "Replace with actual image generation API",
                    }
                )
            )
            return True
        except Exception as e:
            logger.error("Image generation failed: %s", e)
            return False
