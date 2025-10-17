import asyncio
import asyncssh
import os
from typing import Dict, Any, List
from app.core.config import settings

class SSHService:
    """Service for SSH operations with robots"""
    
    def __init__(self):
        self.robot_host = settings.robot_host
        self.robot_user = settings.robot_user
        self.ssh_key_path = settings.ssh_private_key_path
        
    async def execute_command(self, host: str, command: str, **kwargs) -> Dict[str, Any]:
        """Execute a command on a remote host via SSH"""
        try:
            async with asyncssh.connect(
                host,
                username=self.robot_user,
                client_keys=[self.ssh_key_path],
                known_hosts=None,
                **kwargs
            ) as conn:
                result = await conn.run(command, check=False)
                return {
                    "output": result.stdout,
                    "stderr": result.stderr,
                    "exit_code": result.exit_status,
                    "success": result.exit_status == 0
                }
        except Exception as e:
            return {
                "error": str(e),
                "success": False
            }
    
    async def upload_file(self, host: str, local_path: str, remote_path: str, **kwargs) -> Dict[str, Any]:
        """Upload a file to a remote host via SSH"""
        try:
            async with asyncssh.connect(
                host,
                username=self.robot_user,
                client_keys=[self.ssh_key_path],
                known_hosts=None,
                **kwargs
            ) as conn:
                await conn.run(f"mkdir -p {os.path.dirname(remote_path)}")
                async with conn.start_sftp() as sftp:
                    async with sftp.open(remote_path, 'w') as remote_file:
                        with open(local_path, 'rb') as local_file:
                            remote_file.write(local_file.read())
                return {"success": True}
        except Exception as e:
            return {"error": str(e), "success": False}
    
    async def download_file(self, host: str, remote_path: str, local_path: str, **kwargs) -> Dict[str, Any]:
        """Download a file from a remote host via SSH"""
        try:
            async with asyncssh.connect(
                host,
                username=self.robot_user,
                client_keys=[self.ssh_key_path],
                known_hosts=None,
                **kwargs
            ) as conn:
                async with conn.start_sftp() as sftp:
                    async with sftp.open(remote_path, 'r') as remote_file:
                        with open(local_path, 'wb') as local_file:
                            local_file.write(await remote_file.read())
                return {"success": True}
        except Exception as e:
            return {"error": str(e), "success": False}
    
    async def execute_script(self, host: str, script_content: str, script_name: str) -> Dict[str, Any]:
        """Execute a Python script on a remote robot"""
        temp_dir = "/tmp/atriz_run/"
        remote_path = temp_dir + script_name
        
        try:
            async with asyncssh.connect(
                host,
                username=self.robot_user,
                client_keys=[self.ssh_key_path],
                known_hosts=None
            ) as conn:
                # Create temp directory
                await conn.run(f"mkdir -p {temp_dir}")
                
                # Upload script
                async with conn.start_sftp() as sftp:
                    async with sftp.open(remote_path, 'w') as remote_file:
                        await remote_file.write(script_content)
                
                # Execute script
                result = await conn.run(f"python3 {remote_path}", check=True, timeout=60)
                
                # Cleanup
                await conn.run(f"rm -rf {remote_path}")
                
                return {
                    "status": "completed",
                    "output": result.stdout,
                    "error": result.stderr,
                    "success": True
                }
        except Exception as e:
            return {
                "status": "failed",
                "error": str(e),
                "success": False
            }
