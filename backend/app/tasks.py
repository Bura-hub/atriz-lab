# Lógica del Worker Celery y la Tarea Asíncrona SSH
import asyncio
import os
import asyncssh
from celery import Celery
from dotenv import load_dotenv
from app.core.config import settings

load_dotenv() # Cargar variables de .env

# --- Configuración de Celery ---
celery_app = Celery(
    'atriz_tasks',
    broker=settings.redis_url,
    backend=settings.redis_url
)

# Configuración adicional de Celery
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='America/Bogota',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutos
    task_soft_time_limit=25 * 60,  # 25 minutos
)

# --- Variables de Entorno para SSH ---
ROBOT_HOST = settings.robot_host
ROBOT_USER = settings.robot_user
SSH_KEY_PATH = settings.ssh_private_key_path

@celery_app.task(name='run_robot_script')
def run_robot_script(robot_host: str, user_script_content: str, script_name: str):
    """
    Tarea Celery que inicia la ejecución remota de un script Python.
    Es vital que esto sea una tarea para evitar bloquear el ciclo de FastAPI.
    """
    # Ejecuta la función asíncrona dentro del Worker síncrono
    return asyncio.run(
        _deploy_and_run_async(robot_host, user_script_content, script_name)
    )

async def _deploy_and_run_async(robot_host: str, user_script_content: str, script_name: str):
    """
    Función Asíncrona: Conexión SSH, subida, ejecución y sandboxing (simulado).
    """
    TEMP_DIR = "/tmp/atriz_run/"
    REMOTE_PATH = TEMP_DIR + script_name
    
    # Sandboxing: En un entorno real, la ejecución de este comando 'python3 {REMOTE_PATH}' 
    # se haría dentro de un contenedor Docker efímero en el propio robot para aislar recursos.
    
    try:
        # 1. Conexión SSH Asíncrona
        async with asyncssh.connect(
            robot_host, 
            username=ROBOT_USER, 
            client_keys=[SSH_KEY_PATH],
            known_hosts=None
        ) as conn:
            
            # 2. Transferencia del Script (SFTP)
            await conn.run(f"mkdir -p {TEMP_DIR}")
            async with conn.start_sftp() as sftp:
                async with sftp.open(REMOTE_PATH, 'w') as remote_file:
                    await remote_file.write(user_script_content)
            
            # 3. Ejecución del Script
            result = await conn.run(f"python3 {REMOTE_PATH}", check=True, timeout=60)
            
            # 4. Limpieza
            await conn.run(f"rm -rf {REMOTE_PATH}")

        return {
            "status": "completed", 
            "output": result.stdout, 
            "error": result.stderr
        }
        
    except asyncssh.Error as e:
        return {"status": "ssh_failure", "error": f"SSH/Execution Error: {str(e)}"}
    except Exception as e:
        return {"status": "general_failure", "error": f"General Error: {str(e)}"}
