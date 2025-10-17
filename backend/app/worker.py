#!/usr/bin/env python3
"""
Celery Worker Startup Script for Atriz Lab
Simplified version for robot script execution
"""

import os
import sys
from app.tasks import celery_app

if __name__ == "__main__":
    # Start the Celery worker
    celery_app.worker_main([
        "worker",
        "--loglevel=info",
        "--concurrency=2",
        "--queues=default",
        "--hostname=atriz-worker@%h"
    ])
