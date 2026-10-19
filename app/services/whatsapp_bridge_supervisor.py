"""
Calcu Suite — Supervisor y Watchdog del Micro-Servidor WhatsApp Baileys Multi-Dispositivo
========================================================================================
Garantiza que el proceso 'node scripts/whatsapp_qr_bridge.js' esté siempre en ejecución
en http://127.0.0.1:3010, aislándolo en Loopback para cumplimiento perimetral ISO 27001.
Elimina por completo el 'Modo Simulación Local' y asegura el emparejamiento real por QR.
"""

import os
import sys
import time
import json
import socket
import logging
import subprocess
import urllib.request
from typing import Dict, Any, Optional

logger = logging.getLogger("whatsapp_bridge_supervisor")

BRIDGE_HOST = "127.0.0.1"
BRIDGE_PORT = int(os.getenv("WA_BRIDGE_PORT", "3010"))
BRIDGE_URL = f"http://{BRIDGE_HOST}:{BRIDGE_PORT}"


class WhatsAppBridgeSupervisor:
    _instance: Optional["WhatsAppBridgeSupervisor"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.process = None
            cls._instance.script_path = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "whatsapp_qr_bridge.js")
            )
        return cls._instance

    def is_port_open(self, host: str = BRIDGE_HOST, port: int = BRIDGE_PORT, timeout: float = 0.8) -> bool:
        """Verifica si el puerto local 3010 está abierto y escuchando."""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            return result == 0

    def query_status(self, timeout: float = 1.5) -> Optional[Dict[str, Any]]:
        """Consulta el estado del socket en vivo de Baileys."""
        try:
            req = urllib.request.Request(f"{BRIDGE_URL}/status", method="GET")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status == 200:
                    return json.loads(resp.read().decode("utf-8"))
        except Exception:
            return None
        return None

    def ensure_bridge_running(self, wait_seconds: float = 3.0) -> Dict[str, Any]:
        """
        Garantiza que el micro-servidor Baileys esté corriendo.
        Si no responde, lo levanta como subproceso en segundo plano sin ventana en Windows.
        """
        status = self.query_status(timeout=1.0)
        if status and status.get("bridge_online"):
            return status

        # Si el puerto está abierto pero no responde /status, esperar brevemente
        if self.is_port_open():
            time.sleep(1.0)
            status = self.query_status(timeout=1.5)
            if status:
                return status

        if not os.path.exists(self.script_path):
            logger.error(f"[WhatsApp Supervisor] Script no encontrado: {self.script_path}")
            return {"bridge_online": False, "connection": "offline", "error": "script_not_found"}

        logger.info(f"[WhatsApp Supervisor] Iniciando micro-puente Baileys: {self.script_path}")

        # Configuración de arranque en segundo plano sin crear ventana emergente en Windows
        creationflags = 0
        if sys.platform == "win32":
            creationflags = subprocess.CREATE_NO_WINDOW | getattr(subprocess, "DETACHED_PROCESS", 0x00000008)

        env = os.environ.copy()
        env["WA_BRIDGE_PORT"] = str(BRIDGE_PORT)
        env["CALCU_BASE_URL"] = os.getenv("CALCU_BASE_URL", "http://127.0.0.1:8000")

        try:
            cwd = os.path.dirname(self.script_path)
            self.process = subprocess.Popen(
                ["node", self.script_path],
                cwd=cwd,
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=creationflags,
            )
            logger.info(f"[WhatsApp Supervisor] Proceso iniciado con PID: {self.process.pid}")
        except Exception as e:
            logger.error(f"[WhatsApp Supervisor] Error al spawnear Node: {e}")
            return {"bridge_online": False, "connection": "offline", "error": str(e)}

        # Esperar hasta que el puerto esté activo y devuelva estado
        start_time = time.time()
        while time.time() - start_time < wait_seconds:
            time.sleep(0.4)
            status = self.query_status(timeout=1.0)
            if status and status.get("bridge_online"):
                return status

        return {"bridge_online": self.is_port_open(), "connection": "initializing"}

    def stop_bridge(self):
        """Detiene el micro-servidor local limpiamente."""
        if self.process and self.process.poll() is None:
            try:
                self.process.terminate()
                self.process.wait(timeout=2.0)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
            self.process = None


whatsapp_bridge_supervisor = WhatsAppBridgeSupervisor()
