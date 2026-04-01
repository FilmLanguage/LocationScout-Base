"""Feedback endpoint — receive feedback from other agents."""

from fastapi import APIRouter
from src.models.schemas import FLACPMessage

router = APIRouter(tags=["communication"])


@router.post("/feedback")
async def receive_feedback(message: FLACPMessage):
    # TODO: process feedback and adjust outputs
    return {"status": "received", "task_id": message.task_id}
