# Usar Python 3.10 o superior (compatible con ROS Noetic 20.04)
FROM python:3.10-slim

# Variables de Entorno
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV TZ America/Bogota 

# Instalar dependencias del sistema: compilación (para asyncssh/asyncpg) y ssh client
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libssl-dev \
    libpq-dev \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar e instalar dependencias Python
COPY requirements.txt /app/
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copiar el código de la aplicación
COPY app /app/app

# Exponer el puerto
EXPOSE 8000

# Comando de inicio por defecto
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
