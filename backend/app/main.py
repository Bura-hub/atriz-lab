from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.endpoints import health, experiments, tasks
import uvicorn

# Create FastAPI instance
app = FastAPI(
    title=settings.api_title,
    description="API for Atriz Lab experiments and data management",
    version=settings.api_version,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(experiments.router)
app.include_router(tasks.router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
