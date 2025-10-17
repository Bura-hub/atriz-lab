from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.experiment import Experiment
from app.models.task import Task

class DBService:
    """Service for database operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # Experiment operations
    def create_experiment(self, name: str, description: str = None, robot_host: str = None) -> Experiment:
        """Create a new experiment"""
        experiment = Experiment(
            name=name,
            description=description,
            robot_host=robot_host,
            status="pending"
        )
        self.db.add(experiment)
        self.db.commit()
        self.db.refresh(experiment)
        return experiment
    
    def get_experiment(self, experiment_id: int) -> Optional[Experiment]:
        """Get experiment by ID"""
        return self.db.query(Experiment).filter(Experiment.id == experiment_id).first()
    
    def get_experiments(self, skip: int = 0, limit: int = 100) -> List[Experiment]:
        """Get all experiments with pagination"""
        return self.db.query(Experiment).offset(skip).limit(limit).all()
    
    def update_experiment_status(self, experiment_id: int, status: str) -> Optional[Experiment]:
        """Update experiment status"""
        experiment = self.get_experiment(experiment_id)
        if experiment:
            experiment.status = status
            self.db.commit()
            self.db.refresh(experiment)
        return experiment
    
    # Task operations
    def create_task(self, task_id: str, name: str, task_type: str, experiment_id: int = None) -> Task:
        """Create a new task"""
        task = Task(
            task_id=task_id,
            name=name,
            task_type=task_type,
            experiment_id=experiment_id,
            status="pending"
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by Celery task ID"""
        return self.db.query(Task).filter(Task.task_id == task_id).first()
    
    def update_task_status(self, task_id: str, status: str, result: str = None, error: str = None) -> Optional[Task]:
        """Update task status and results"""
        task = self.get_task(task_id)
        if task:
            task.status = status
            if result:
                task.result = result
            if error:
                task.error = error
            self.db.commit()
            self.db.refresh(task)
        return task
