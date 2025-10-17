from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from datetime import datetime
import uuid
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])

# Mock task storage for testing
MOCK_TASKS = {}

class RobotScriptRequest(BaseModel):
    robot_host: str
    user_script_content: str
    script_name: str

@router.post("/robot/execute")
async def execute_robot_script(request: RobotScriptRequest):
    """Execute a Python script on a remote robot via SSH (mock for testing)"""
    try:
        # Generate mock task ID
        task_id = str(uuid.uuid4())
        
        # Create mock task
        task = {
            "task_id": task_id,
            "name": f"Execute {request.script_name}",
            "task_type": "robot_script",
            "status": "queued",
            "robot_host": request.robot_host,
            "script_name": request.script_name,
            "created_at": datetime.now().isoformat() + "Z",
            "script_content": request.user_script_content[:100] + "..." if len(request.user_script_content) > 100 else request.user_script_content
        }
        
        MOCK_TASKS[task_id] = task
        
        return {
            "task_id": task_id,
            "status": "queued",
            "message": "Robot script execution queued (mock)",
            "robot_host": request.robot_host,
            "script_name": request.script_name
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """Get the status of a task (mock for testing)"""
    try:
        # Get task from mock storage
        task = MOCK_TASKS.get(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Simulate task progression
        import random
        statuses = ["queued", "running", "completed", "failed"]
        current_status = random.choice(statuses)
        
        if current_status == "completed":
            return {
                "task_id": task_id,
                "status": "success",
                "message": "Task completed successfully (mock)",
                "result": {
                    "output": "Robot script executed successfully",
                    "exit_code": 0,
                    "execution_time": "2.5s"
                }
            }
        elif current_status == "failed":
            return {
                "task_id": task_id,
                "status": "failure",
                "message": "Task failed (mock)",
                "error": "Connection timeout to robot"
            }
        else:
            return {
                "task_id": task_id,
                "status": current_status,
                "message": f"Task is {current_status} (mock)"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def get_active_tasks():
    """Get information about active tasks"""
    return {
        "message": "Atriz Lab Task Management",
        "available_endpoints": [
            "POST /api/v1/tasks/robot/execute - Execute robot script",
            "GET /api/v1/tasks/status/{task_id} - Check task status"
        ],
        "note": "Use /status/{task_id} to check individual task status"
    }
