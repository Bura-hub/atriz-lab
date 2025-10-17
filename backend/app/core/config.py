import os
from typing import Optional

class Settings:
    """Application settings loaded from environment variables"""
    
    def __init__(self):
        # API Configuration
        self.api_title = os.getenv("API_TITLE", "Atriz Lab API")
        self.api_version = os.getenv("API_VERSION", "1.0.0")
        self.debug = os.getenv("DEBUG", "False").lower() == "true"
        
        # Database Configuration
        self.database_url = os.getenv("DATABASE_URL")
        self.postgres_user = os.getenv("POSTGRES_USER", "user_atriz")
        self.postgres_password = os.getenv("POSTGRES_PASSWORD", "password_atriz_dev")
        self.postgres_db = os.getenv("POSTGRES_DB", "atriz_experiments")
        self.postgres_host = os.getenv("POSTGRES_HOST", "localhost")
        self.postgres_port = int(os.getenv("POSTGRES_PORT", "5432"))
        
        # Redis Configuration
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        
        # Robot SSH Configuration
        self.robot_host = os.getenv("ROBOT_HOST", "192.168.1.100")
        self.robot_user = os.getenv("ROBOT_USER", "sphero")
        self.ssh_private_key_path = os.getenv("SSH_PRIVATE_KEY_PATH", "C:\\Users\\Public\\.ssh\\id_rsa_atriz")
        
        # Security
        self.secret_key = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
        self.algorithm = os.getenv("ALGORITHM", "HS256")
        self.access_token_expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Global settings instance
settings = Settings()
