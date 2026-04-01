"""Schema endpoint — expose input/output JSON schema."""

from fastapi import APIRouter
from src.models.schemas import FLACPMessage

router = APIRouter(tags=["system"])


@router.get("/schema")
async def get_schema():
    return {
        "input": FLACPMessage.model_json_schema(),
        "output": {
            "description": "TODO: Define output schema for this agent",
        },
    }
