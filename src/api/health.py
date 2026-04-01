"""Health and info endpoints."""

import time
from fastapi import APIRouter
from src.config import settings

router = APIRouter(tags=["system"])

_start_time = time.time()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "version": settings.VERSION,
        "uptime": round(time.time() - _start_time, 2),
    }


@router.get("/info")
async def info():
    return {
        "name": settings.AGENT_NAME,
        "role": settings.AGENT_ROLE,
        "version": settings.VERSION,
        "environment": settings.AGENT_ENV,
    }
