"""LLM integration utilities."""

from src.config import settings


async def call_llm(prompt: str, system: str = "") -> str:
    """Call LLM API (Claude or GPT).

    TODO: Implement actual LLM calls.

    Args:
        prompt: User prompt.
        system: System prompt.

    Returns:
        LLM response text.
    """
    raise NotImplementedError("LLM integration not yet configured")
