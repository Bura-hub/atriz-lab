# Atriz Lab - Robot Experiment Management Platform

A complete full-stack application for managing and executing Python scripts on remote robots via SSH, built with FastAPI, Celery, Next.js, and Docker.

## 🏗️ Architecture

```
atriz-lab/
├── backend/                  # FastAPI, Celery, DB Config
│   ├── Dockerfile            # Imagen del servicio Python
│   ├── requirements.txt      # Dependencias de Python
│   ├── app/
│   │   ├── __init__.py       # Inicialización de FastAPI
│   │   ├── main.py           # Endpoints de la API
│   │   ├── tasks.py          # Tareas asíncronas (Celery/AsyncSSH)
│   │   ├── models/           # SQLAlchemy/Alembic models
│   │   │   ├── __init__.py
│   │   │   ├── database.py
│   │   │   ├── experiment.py
│   │   │   └── task.py
│   │   ├── routers/          # API Routes
│   │   │   ├── experiments.py
│   │   │   └── tasks.py
│   │   ├── config.py         # Configuration
│   │   └── worker.py         # Celery Worker
│   ├── docker-compose.yml    # Orquestación de DB, Redis, API, Worker
│   └── config.env            # Variables de entorno
└── frontend/                 # Next.js (React)
    ├── Dockerfile
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    ├── public/
    ├── src/
    │   ├── app/              # App Router
    │   │   ├── layout.tsx
    │   │   ├── page.tsx
    │   │   └── globals.css
    │   └── components/       # Componentes React
    │       ├── ExperimentCard.tsx
    │       ├── TaskStatus.tsx
    │       └── LoadingSpinner.tsx
    └── node_modules/
```

## 🚀 Features

### Backend (FastAPI + Celery)
- **FastAPI REST API** with automatic documentation
- **Celery Task Queue** for asynchronous SSH operations
- **PostgreSQL + TimescaleDB** for data persistence
- **Redis** for task queue and caching
- **SQLAlchemy** models for experiments and tasks
- **AsyncSSH** for secure robot connections
- **Docker** containerization

### Frontend (Next.js + React)
- **Modern React** with TypeScript
- **Tailwind CSS** for styling
- **Responsive Design** for all devices
- **Real-time Updates** for task status
- **Component-based Architecture**

### Robot Integration
- **SSH Key Authentication** for secure connections
- **Script Execution** on remote robots
- **File Transfer** capabilities
- **Real-time Monitoring** of task progress
- **Error Handling** and logging

## 🛠️ Setup Instructions

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.10+ (for local development)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd atriz-lab
```

### 2. Environment Configuration
```bash
# Copy environment template
cp backend/config.env backend/.env

# Edit the .env file with your settings
# - Update ROBOT_HOST, ROBOT_USER
# - Configure SSH_PRIVATE_KEY_PATH
# - Set database credentials
```

### 3. SSH Key Setup
```bash
# Generate SSH key pair
ssh-keygen -t rsa -b 4096 -f C:\Users\Public\.ssh\id_rsa_atriz

# Copy public key to robot
ssh-copy-id -i C:\Users\Public\.ssh\id_rsa_atriz.pub sphero@192.168.1.100
```

### 4. Start with Docker Compose
```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs
- **API**: http://localhost:8000

## 🔧 Development Setup

### Backend Development
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Start Celery Worker
python app/worker.py

# Start FastAPI
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## 📡 API Endpoints

### Experiments
- `GET /api/v1/experiments` - List experiments
- `POST /api/v1/experiments` - Create experiment
- `GET /api/v1/experiments/{id}` - Get experiment details

### Tasks
- `POST /api/v1/tasks/robot/execute` - Execute robot script
- `GET /api/v1/tasks/status/{task_id}` - Check task status
- `GET /api/v1/tasks/` - List available endpoints

### Health
- `GET /` - Root endpoint
- `GET /health` - Health check

## 🤖 Robot Script Execution

### Example Script
```python
# Simple robot script
print("Hello from Atriz Robot!")
print("Current time:", __import__('datetime').datetime.now())

# Robot movement example
import time
print("Starting robot movement...")
time.sleep(2)
print("Movement completed!")
```

### API Usage
```bash
# Execute script on robot
curl -X POST "http://localhost:8000/api/v1/tasks/robot/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "robot_host": "192.168.1.100",
    "user_script_content": "print(\"Hello from robot!\")",
    "script_name": "test_script.py"
  }'

# Check task status
curl "http://localhost:8000/api/v1/tasks/status/{task_id}"
```

## 🐳 Docker Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js React application |
| API | 8000 | FastAPI backend |
| Database | 5432 | PostgreSQL + TimescaleDB |
| Redis | 6379 | Task queue and caching |
| Worker | - | Celery worker (no external port) |

## 🔒 Security Features

- **SSH Key Authentication** - No password-based access
- **Environment Variables** - Secure configuration
- **Docker Isolation** - Containerized services
- **Input Validation** - Pydantic data validation
- **Error Handling** - Comprehensive error capture

## 📊 Monitoring

### Task States
- `PENDING` - Task queued, waiting for worker
- `PROGRESS` - Task being processed
- `SUCCESS` - Task completed successfully
- `FAILURE` - Task failed with error

### Logs
```bash
# Check all logs
docker-compose logs

# Check specific service
docker-compose logs api
docker-compose logs worker
docker-compose logs frontend
```

## 🚀 Production Deployment

### Environment Variables
```bash
# Production settings
DEBUG=False
SECRET_KEY=your-production-secret-key
DATABASE_URL=postgresql://user:pass@db:5432/atriz_experiments
REDIS_URL=redis://redis:6379/0
```

### Docker Compose Production
```bash
# Build and start in production mode
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Troubleshooting

### Common Issues

1. **SSH Connection Failed**
   - Check robot IP and connectivity
   - Verify SSH key configuration
   - Ensure robot SSH service is running

2. **Task Timeout**
   - Check script execution time
   - Verify robot resources
   - Review script for infinite loops

3. **Docker Issues**
   - Check Docker daemon is running
   - Verify port availability
   - Check container logs

### Support
For issues and questions, please create an issue in the repository.
