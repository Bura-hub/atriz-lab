from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.db import Base

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(255), unique=True, index=True)  # Celery task ID
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="pending", index=True)  # pending, progress, success, failure
    task_type = Column(String(100), nullable=False)  # ssh_execute, ssh_upload, ssh_download, etc.
    
    # Foreign key to experiment
    experiment_id = Column(Integer, ForeignKey("experiments.id"), nullable=True)
    
    # Task parameters
    host = Column(String(255), nullable=True)
    command = Column(Text, nullable=True)
    local_path = Column(String(500), nullable=True)
    remote_path = Column(String(500), nullable=True)
    
    # Results
    result = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    is_active = Column(Boolean, default=True)
    
    def __repr__(self):
        return f"<Task(id={self.id}, task_id='{self.task_id}', status='{self.status}')>"
