# Atriz Lab API

FastAPI application for Atriz Lab experiments and data management.

## Structure

```
app/
├── __init__.py          # Package initialization
├── main.py             # FastAPI application entry point
├── config.py           # Application configuration
├── routers/            # API route handlers
│   ├── __init__.py
│   └── experiments.py  # Experiment-related endpoints
└── README.md           # This file
```

## Running the Application

### Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run with uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### With Docker
```bash
# Build and run with docker-compose
docker-compose up --build
```

## API Documentation

Once the application is running, you can access:
- Interactive API docs: http://localhost:8000/docs
- ReDoc documentation: http://localhost:8000/redoc

## Endpoints

- `GET /` - Root endpoint
- `GET /health` - Health check
- `GET /api/v1/experiments` - List experiments
- `GET /api/v1/experiments/{id}` - Get specific experiment
- `POST /api/v1/experiments` - Create new experiment
