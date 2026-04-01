"""LocationScout-Base — Location Scout Agent entry point."""

from fastapi import FastAPI
from src.api.health import router as health_router
from src.api.process import router as process_router
from src.api.feedback import router as feedback_router
from src.api.schema import router as schema_router
from src.config import settings

app = FastAPI(
    title="LocationScout-Base",
    description="Location Scout Agent — Film Language / Stanislavsky AI Platform",
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(health_router)
app.include_router(process_router)
app.include_router(feedback_router)
app.include_router(schema_router)
