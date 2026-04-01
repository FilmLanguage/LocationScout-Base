"""Agent configuration from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Agent settings loaded from environment."""

    VERSION: str = "0.1.0"
    AGENT_NAME: str = "LocationScout-Base"
    AGENT_ROLE: str = "Location Scout"
    AGENT_ENV: str = "dev"

    DATABASE_URL: str = "sqlite:///./local.db"
    GCS_BUCKET: str = ""
    ORCHESTRATOR_URL: str = ""

    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
