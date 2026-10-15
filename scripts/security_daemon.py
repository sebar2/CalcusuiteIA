#!/usr/bin/env python3
"""
Daemon de Ciberseguridad Local en Segundo Plano - Calcu Core & 3PL
Alineado con el estándar ISO/IEC 27001:2022 (A.8.15, A.8.16, A.8.20, A.8.21).

Monitorea periódicamente las interfaces del nodo central y Tailscale.
Solo los puertos 8000 (FastAPI) y 5173 (Vite) están autorizados para la plataforma.
"""

import sys
import os
import time
import signal
import logging

# Añadir raíz del proyecto al sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.security_agent import security_agent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [ISO-27001-DAEMON] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("security_daemon")

RUNNING = True

def handle_exit(signum, frame):
    global RUNNING
    logger.info("Recibida señal de detención (%s). Finalizando daemon de ciberseguridad...", signum)
    RUNNING = False

def run_daemon(interval_seconds: int = 30):
    logger.info("Iniciando Agente Guardián de Ciberseguridad ISO 27001 (Intervalo: %ds)...", interval_seconds)
    logger.info("Baseline estricto de puertos autorizados: 8000 (FastAPI), 5173 (Vite)")

    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_exit)
    if hasattr(signal, "SIGINT"):
        signal.signal(signal.SIGINT, handle_exit)

    scan_count = 0
    while RUNNING:
        scan_count += 1
        try:
            result = security_agent.run_perimeter_audit()
            if result["is_compliant"]:
                logger.info(
                    "Ciclo #%d: Estado CONFORME. Puertos autorizados verificados: %s",
                    scan_count,
                    result["authorized_found"],
                )
            else:
                logger.warning(
                    "Ciclo #%d: ¡ALERTA NO CONFORME! Puertos anómalos detectados: %s (Tailscale: %s)",
                    scan_count,
                    result["unauthorized_ports"],
                    result.get("tailscale_ip") or "No conectado",
                )
        except Exception as e:
            logger.error("Error inesperado en ciclo de auditoría #%d: %s", scan_count, e)

        # Espera en tramos de 1 segundo para permitir salida limpia
        for _ in range(interval_seconds):
            if not RUNNING:
                break
            time.sleep(1)

    logger.info("Daemon de ciberseguridad finalizado correctamente.")

if __name__ == "__main__":
    interval = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    run_daemon(interval)
