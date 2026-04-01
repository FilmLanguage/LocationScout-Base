"""Pydantic models for FLACP protocol and agent data."""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


class FLACPMetadata(BaseModel):
    """FLACP message metadata."""
    project_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    priority: str = "normal"


class FLACPMessage(BaseModel):
    """Film Language Agent Communication Protocol envelope."""
    protocol: str = "flacp/1.0"
    from_agent: str = Field(..., alias="from")
    to: str
    task_id: str
    action: str
    payload: dict[str, Any] = {}
    metadata: FLACPMetadata = FLACPMetadata()

    class Config:
        populate_by_name = True


class TaskStatus(BaseModel):
    """Task status response."""
    task_id: str
    status: str
    progress: Optional[float] = None
    message: Optional[str] = None
