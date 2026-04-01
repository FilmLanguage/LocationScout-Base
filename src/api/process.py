"""Process endpoints — main task processing."""

import uuid
from fastapi import APIRouter
from src.models.schemas import FLACPMessage, TaskStatus

router = APIRouter(tags=["processing"])

# In-memory task store (replace with DB in production)
_tasks: dict[str, dict] = {}


@router.post("/process", status_code=202)
async def process_task(message: FLACPMessage):
    task_id = str(uuid.uuid4())
    _tasks[task_id] = {
        "status": "accepted",
        "message": message.model_dump(),
        "result": None,
    }
    # TODO: dispatch to core pipeline
    return {"task_id": task_id, "status": "accepted"}


@router.get("/process/{task_id}/status")
async def get_task_status(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        return {"error": "Task not found"}, 404
    return TaskStatus(task_id=task_id, status=task["status"])


@router.get("/process/{task_id}/result")
async def get_task_result(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        return {"error": "Task not found"}, 404
    return {"task_id": task_id, "result": task["result"]}
