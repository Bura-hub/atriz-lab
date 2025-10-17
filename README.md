# 🤖 Atriz Lab - Laboratorio Remoto de Robótica

> **Sistema de laboratorio remoto para experimentos de robótica en enjambre**  
> Universidad de Nariño - Colombia

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.3-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

## 🎯 Descripción

Atriz Lab es un sistema completo de laboratorio remoto que permite a investigadores y estudiantes realizar experimentos de robótica en enjambre de forma remota. El sistema integra robots Mercator (RVR + Raspberry Pi) con una plataforma web moderna para monitoreo y control en tiempo real.

## ✨ Características Principales

### 🖥️ **Frontend Moderno**
- **Dashboard responsivo** con diseño profesional
- **Monitoreo en tiempo real** de robots y experimentos
- **Streaming de video** del laboratorio
- **Métricas del sistema** en tiempo real
- **Tema oscuro/claro** con transiciones suaves
- **Animaciones profesionales** y efectos visuales

### 🔧 **Backend Robusto**
- **API RESTful** con FastAPI
- **Base de datos** PostgreSQL con SQLAlchemy
- **Cache Redis** para rendimiento
- **Cola de tareas** Celery para procesos asíncronos
- **Comunicación SSH** con robots
- **Monitoreo de salud** del sistema

### 🤖 **Integración con Robots**
- **Robots Mercator** (RVR + Raspberry Pi 4)
- **ROS Noetic** en Ubuntu 20.04
- **Control remoto** vía SSH
- **Telemetría en tiempo real** (20-30 Hz)
- **Ejecución segura** con Docker + cgroups

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cliente Web   │◄──►│  Servidor API   │◄──►│   Robots RVR    │
│   (Next.js)     │    │   (FastAPI)     │    │  (Raspberry Pi) │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • PostgreSQL    │    │ • ROS Noetic    │
│ • Video Stream  │    │ • Redis Cache  │    │ • Python Scripts│
│ • Telemetría    │    │ • Celery Tasks │    │ • SSH Control   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Estructura del Proyecto

```
atriz-lab/
├── 📁 frontend/                 # Dashboard Next.js
│   ├── src/
│   │   ├── app/                 # App Router
│   │   └── components/          # Componentes React
│   ├── package.json
│   └── tailwind.config.ts
├── 📁 backend/                  # API FastAPI
│   ├── app/
│   │   ├── api/endpoints/       # Endpoints REST
│   │   ├── models/              # Modelos SQLAlchemy
│   │   ├── services/            # Lógica de negocio
│   │   └── core/                # Configuración
│   ├── requirements.txt
│   └── docker-compose.yml
├── 📁 mockups/                  # Diseños y prototipos
└── 📄 README.md
```

## 🚀 Instalación y Configuración

### Prerrequisitos
- **Node.js** 18+ y npm
- **Python** 3.11+
- **Docker** y Docker Compose
- **PostgreSQL** 14+
- **Redis** 6+

### 1. Clonar el Repositorio
```bash
git clone https://github.com/universidad-narino/atriz-lab.git
cd atriz-lab
```

### 2. Configurar Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configurar Frontend
```bash
cd frontend
npm install
```

### 4. Variables de Entorno
```bash
# backend/.env
DATABASE_URL=postgresql://user:password@localhost:5432/atriz_lab
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key
```

## 🏃‍♂️ Desarrollo

### Backend (API)
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Dashboard)
```bash
cd frontend
npm run dev
```

### Base de Datos
```bash
cd backend
alembic upgrade head
```

### Cola de Tareas
```bash
cd backend
celery -A app.worker worker --loglevel=info
```

## 🐳 Docker

### Desarrollo Completo
```bash
cd backend
docker-compose up -d
```

### Producción
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Componentes del Dashboard

### 🎛️ **RobotStatusCard**
- Estado de robots conectados
- Nivel de batería y temperatura
- Señal WiFi y última actividad
- Métricas en tiempo real

### 🧪 **ActiveExperimentsCard**
- Experimentos en ejecución
- Progreso y tiempo estimado
- Control de pausa/reanudación
- Sistema de prioridades

### 📈 **SystemMetricsCard**
- Rendimiento del servidor
- Latencia y conexiones
- Uso de CPU y memoria
- Gráficas de tendencia

### 📹 **LaboratoryVideoCard**
- Stream en tiempo real
- Controles de video
- Indicadores de calidad
- Grabación de sesiones

## 🔧 Tecnologías Utilizadas

### Frontend
- **Next.js 14** - Framework React
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos utilitarios
- **Lucide React** - Iconografía
- **Inter Font** - Tipografía

### Backend
- **FastAPI** - API moderna y rápida
- **SQLAlchemy** - ORM para PostgreSQL
- **Celery** - Cola de tareas asíncronas
- **Redis** - Cache y broker
- **Alembic** - Migraciones de BD

### DevOps
- **Docker** - Containerización
- **Docker Compose** - Orquestación
- **PostgreSQL** - Base de datos
- **Nginx** - Proxy reverso

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver `LICENSE` para más detalles.

## 👥 Equipo

- **Desarrollo Frontend** - Universidad de Nariño
- **Desarrollo Backend** - Universidad de Nariño
- **Integración Robótica** - Universidad de Nariño

## 📞 Contacto

- **Proyecto**: [Atriz Lab](https://github.com/universidad-narino/atriz-lab)
- **Universidad**: Universidad de Nariño
- **Email**: atriz-lab@udenar.edu.co

---

<div align="center">
  <strong>🤖 Desarrollado con ❤️ para la investigación en robótica</strong>
</div>