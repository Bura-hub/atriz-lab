from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from datetime import datetime

router = APIRouter(prefix="/api/v1/experiments", tags=["experiments"])

# Mock data for testing
MOCK_EXPERIMENTS = [
    {
        "id": 1,
        "name": "Robot Navigation Test",
        "description": "Testing robot navigation in a maze",
        "status": "completed",
        "robot_host": "192.168.1.100",
        "created_at": "2025-10-17T10:00:00Z",
        "updated_at": "2025-10-17T10:30:00Z"
    },
    {
        "id": 2,
        "name": "Sensor Calibration",
        "description": "Calibrating robot sensors",
        "status": "running",
        "robot_host": "192.168.1.101",
        "created_at": "2025-10-17T11:00:00Z",
        "updated_at": "2025-10-17T11:15:00Z"
    }
]

@router.get("/")
async def get_experiments(skip: int = 0, limit: int = 100):
    """Get all experiments (mock data for testing)"""
    experiments = MOCK_EXPERIMENTS[skip:skip + limit]
    return {"experiments": experiments, "total": len(MOCK_EXPERIMENTS)}

@router.get("/{experiment_id}")
async def get_experiment(experiment_id: int):
    """Get experiment by ID (mock data for testing)"""
    experiment = next((exp for exp in MOCK_EXPERIMENTS if exp["id"] == experiment_id), None)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return experiment

@router.post("/")
async def create_experiment(
    name: str,
    description: str = None,
    robot_host: str = None
):
    """Create a new experiment (mock for testing)"""
    new_experiment = {
        "id": len(MOCK_EXPERIMENTS) + 1,
        "name": name,
        "description": description or "No description provided",
        "status": "created",
        "robot_host": robot_host or "192.168.1.100",
        "created_at": datetime.now().isoformat() + "Z",
        "updated_at": datetime.now().isoformat() + "Z"
    }
    MOCK_EXPERIMENTS.append(new_experiment)
    return new_experiment

@router.put("/{experiment_id}/status")
async def update_experiment_status(experiment_id: int, status: str):
    """Update experiment status (mock for testing)"""
    experiment = next((exp for exp in MOCK_EXPERIMENTS if exp["id"] == experiment_id), None)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    experiment["status"] = status
    experiment["updated_at"] = datetime.now().isoformat() + "Z"
    return experiment
