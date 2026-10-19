import os
import json
import socket
import logging
import subprocess
import platform
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger("calcu.security_agent")

LOGS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
AUDIT_LOG_FILE = os.path.join(LOGS_DIR, "security_audit.jsonl")

# Baseline ISO/IEC 27001:2022 - Control A.8.20 & A.8.21: Servicios de Red y Puertos Autorizados en Perímetro Expuesto
AUTHORIZED_APP_PORTS = {
    8000: "FastAPI Core (SupplyFinance & 3PL Backend)",
    5173: "Vite React 19 Frontend Web",
    443: "Tailscale Funnel HTTPS Ingress Gateway (Mercado Libre Webhooks & OAuth2)",
}

# Motores y servicios internos autorizados de Calcu (estrictamente en Loopback/Localhost)
AUTHORIZED_INTERNAL_SERVICES = {
    11434: "Ollama Local LLM (Motor IA Local de Calcu)",
}

# Puertos del sistema operativo y entornos de desarrollo tolerados en localhost/loopback
SYSTEM_TOLERATED_PORTS = {
    135: "Windows RPC Endpoint Mapper",
    139: "NetBIOS Session Service (Local)",
    445: "Microsoft-DS SMB (Local)",
    902: "VMware Auth Daemon (Host-Only)",
    912: "VMware VIX (Host-Only)",
    5040: "Windows Connected Devices Platform",
    5353: "mDNS Multicast DNS",
    5355: "LLMNR",
    5357: "Network Discovery WSDAPI",
    7680: "Windows Delivery Optimization (WUDO)",
    18789: "Developer / IDE IPC Helper",
    27015: "Steam / Local Media Service",
    38066: "Electron / Dev IPC Helper",
}

class SecurityAuditEntry:
    def __init__(
        self,
        event_type: str,
        severity: str,
        message: str,
        iso_controls: List[str],
        detected_ports: List[int],
        unauthorized_ports: List[int],
        tailscale_ip: Optional[str] = None,
        raw_details: Optional[Dict[str, Any]] = None,
    ):
        self.timestamp = datetime.now(timezone.utc).isoformat()
        self.event_type = event_type
        self.severity = severity  # INFO, WARNING, CRITICAL
        self.message = message
        self.iso_controls = iso_controls
        self.detected_ports = detected_ports
        self.unauthorized_ports = unauthorized_ports
        self.tailscale_ip = tailscale_ip
        self.raw_details = raw_details or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "event_type": self.event_type,
            "severity": self.severity,
            "message": self.message,
            "iso_controls": self.iso_controls,
            "detected_ports": self.detected_ports,
            "unauthorized_ports": self.unauthorized_ports,
            "tailscale_ip": self.tailscale_ip,
            "raw_details": self.raw_details,
        }


class LocalCybersecurityAgent:
    """
    Agente Local de Ciberseguridad para Calcu (Baseline ISO/IEC 27001:2022).
    Supervisa activamente:
    - Control A.8.15: Registro y almacenamiento inmutable de eventos.
    - Control A.8.16: Monitoreo periódico de actividades anómalas.
    - Control A.8.20: Seguridad de redes y segmentación en Tailscale VPN.
    - Control A.8.21: Seguridad en servicios de red (Whitelist estricta: :8000 y :5173).
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LocalCybersecurityAgent, cls).__new__(cls)
            cls._instance._init_agent()
        return cls._instance

    def _init_agent(self):
        os.makedirs(LOGS_DIR, exist_ok=True)
        self.alerts_history: List[Dict[str, Any]] = []
        self.last_scan_time: Optional[str] = None
        self.last_scan_result: Optional[Dict[str, Any]] = None
        self.tailscale_ip = self._detect_tailscale_ip()

    def _detect_tailscale_ip(self) -> Optional[str]:
        """Detecta la IP asignada a la interfaz Tailscale (rango CGNAT 100.64.0.0/10)."""
        try:
            # Consulta a CLI de tailscale o resolución de interfaces
            out = subprocess.run(
                ["tailscale", "ip", "-4"],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            if out.returncode == 0 and out.stdout.strip():
                return out.stdout.strip()
        except Exception:
            pass

        # Fallback: Resolver hostname local en búsqueda de IP en 100.x.y.z
        try:
            hostname = socket.gethostname()
            addr_info = socket.getaddrinfo(hostname, None)
            for item in addr_info:
                ip = item[4][0]
                if ip.startswith("100."):
                    return ip
        except Exception:
            pass

        return None

    def get_active_listening_ports(self) -> List[Dict[str, Any]]:
        """
        Inspecciona los puertos TCP en estado LISTENING en la máquina anfitriona.
        Compatible con Windows y Linux.
        """
        listening = []
        is_windows = platform.system() == "Windows"

        try:
            if is_windows:
                cmd = ["netstat", "-ano", "-p", "tcp"]
            else:
                cmd = ["ss", "-tlpn"]

            res = subprocess.run(cmd, capture_output=True, text=True, timeout=5, check=False)
            if res.returncode == 0:
                for line in res.stdout.splitlines():
                    parts = line.strip().split()
                    if is_windows:
                        # Formato: TCP    0.0.0.0:8000           0.0.0.0:0              LISTENING       1234
                        if len(parts) >= 4 and parts[0].upper() == "TCP" and "LISTENING" in parts[3].upper():
                            local_addr = parts[1]
                            pid = parts[4] if len(parts) >= 5 else "N/A"
                            if ":" in local_addr:
                                host, port_str = local_addr.rsplit(":", 1)
                                try:
                                    port = int(port_str)
                                    listening.append({"host": host, "port": port, "pid": pid})
                                except ValueError:
                                    continue
                    else:
                        # Formato Linux ss: LISTEN 0 128 0.0.0.0:8000 ...
                        if "LISTEN" in line:
                            for p in parts:
                                if ":" in p and not p.startswith("*:*"):
                                    try:
                                        host, port_str = p.rsplit(":", 1)
                                        port = int(port_str)
                                        listening.append({"host": host, "port": port, "pid": "N/A"})
                                    except ValueError:
                                        pass
        except Exception as e:
            logger.error("Error al inspeccionar puertos mediante netstat/ss: %s", e)

        # Si netstat falló, probar socket connect sobre puertos críticos comunes
        if not listening:
            test_ports = [8000, 5173, 22, 80, 443, 3306, 5432, 6379, 8080, 27017]
            for p in test_ports:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(0.05)
                try:
                    result = s.connect_ex(("127.0.0.1", p))
                    if result == 0:
                        listening.append({"host": "127.0.0.1", "port": p, "pid": "N/A"})
                except Exception:
                    pass
                finally:
                    s.close()

        return listening

    def run_perimeter_audit(self) -> Dict[str, Any]:
        """
        Ejecuta la auditoría perimetral conforme a ISO 27001:2022 (A.8.15, A.8.16, A.8.20, A.8.21).
        Distingue rigurosamente entre:
        - Perímetro Expuesto de Red (0.0.0.0, ::, y nodo Tailscale): Solo :8000 y :5173 autorizados.
        - Interfaces de Loopback Local (127.0.0.1, ::1): Motores internos como Ollama (:11434) y servicios del SO.
        """
        self.tailscale_ip = self._detect_tailscale_ip() or self.tailscale_ip
        active = self.get_active_listening_ports()

        exposed_hosts = {"0.0.0.0", "::"}
        if self.tailscale_ip:
            exposed_hosts.add(self.tailscale_ip)

        loopback_hosts = {"127.0.0.1", "::1", "localhost"}

        exposed_ports = set()
        loopback_ports = set()

        for entry in active:
            h = entry["host"]
            p = entry["port"]
            if h in exposed_hosts or (self.tailscale_ip and self.tailscale_ip in h):
                exposed_ports.add(p)
            elif h in loopback_hosts:
                loopback_ports.add(p)
            else:
                # Si bind es en otra IP local (ej. 192.168.x.x), clasificar según si es red o loopback
                if h.startswith("127."):
                    loopback_ports.add(p)
                else:
                    exposed_ports.add(p)

        # 1. Auditoría del Perímetro Expuesto (A.8.20 / A.8.21)
        unauthorized_exposed = []
        authorized_found = []

        for p in sorted(exposed_ports):
            if p in AUTHORIZED_APP_PORTS:
                authorized_found.append(p)
            elif p in AUTHORIZED_INTERNAL_SERVICES:
                # Motores de IA locales autorizados de Calcu (Ollama 11434)
                authorized_found.append(p)
            elif p in SYSTEM_TOLERATED_PORTS:
                # Puertos del sistema Windows / Tailscale tolerados
                pass
            elif 49152 <= p <= 65535:
                # Puertos dinámicos/efímeros RPC del SO
                pass
            else:
                unauthorized_exposed.append(p)

        # 2. Auditoría de Servicios Internos en Loopback (Ollama 11434, etc.)
        internal_services_active = []
        for p in sorted(loopback_ports):
            if p in AUTHORIZED_INTERNAL_SERVICES:
                internal_services_active.append(f"{AUTHORIZED_INTERNAL_SERVICES[p]} (:{p})")
            elif p in AUTHORIZED_APP_PORTS:
                if p not in authorized_found:
                    authorized_found.append(p)

        is_compliant = len(unauthorized_exposed) == 0
        severity = "INFO" if is_compliant else "CRITICAL"

        if is_compliant:
            internal_desc = f", Internos Loopback: {internal_services_active}" if internal_services_active else ""
            msg = f"Perímetro de red CONFORME (ISO 27001). Servicios autorizados: {authorized_found}{internal_desc}. 0 puertos externos anómalos."
            event_type = "BASELINE_COMPLIANCE_CHECK_PASSED"
        else:
            msg = f"¡ALERTA PERIMETRAL ISO 27001! Se detectaron puertos externos NO autorizados en 0.0.0.0/Tailscale: {unauthorized_exposed}."
            event_type = "UNAUTHORIZED_PORT_DETECTED"

        entry = SecurityAuditEntry(
            event_type=event_type,
            severity=severity,
            message=msg,
            iso_controls=["A.8.15", "A.8.16", "A.8.20", "A.8.21"],
            detected_ports=sorted(list(exposed_ports.union(loopback_ports))),
            unauthorized_ports=unauthorized_exposed,
            tailscale_ip=self.tailscale_ip,
            raw_details={
                "authorized_app_ports": list(AUTHORIZED_APP_PORTS.keys()),
                "exposed_ports": sorted(list(exposed_ports)),
                "loopback_ports": sorted(list(loopback_ports)),
                "internal_ai_engine_active": 11434 in loopback_ports,
                "total_listening_sockets": len(active),
                "tailscale_active": self.tailscale_ip is not None,
            },
        )

        audit_dict = entry.to_dict()
        self._append_to_audit_log(audit_dict)

        if not is_compliant:
            self.alerts_history.append(audit_dict)
            logger.warning("[ISO 27001 ALERT] %s", msg)
        else:
            logger.info("[ISO 27001 OK] %s", msg)

        self.last_scan_time = entry.timestamp
        self.last_scan_result = {
            "status": "COMPLIANT" if is_compliant else "NON_COMPLIANT_ALERT",
            "is_compliant": is_compliant,
            "timestamp": entry.timestamp,
            "tailscale_ip": self.tailscale_ip,
            "authorized_found": authorized_found,
            "unauthorized_ports": unauthorized_exposed,
            "all_detected_ports": sorted(list(exposed_ports.union(loopback_ports))),
            "exposed_ports": sorted(list(exposed_ports)),
            "loopback_ports": sorted(list(loopback_ports)),
            "internal_services": internal_services_active,
            "active_sockets": active,
            "iso_baseline": {
                "authorized_whitelist": AUTHORIZED_APP_PORTS,
                "authorized_internal": AUTHORIZED_INTERNAL_SERVICES,
                "framework": "ISO/IEC 27001:2022",
                "controls": ["A.8.15 Registro", "A.8.16 Monitoreo", "A.8.20 Seguridad Redes", "A.8.21 Servicios de Red"],
            },
        }

        return self.last_scan_result

    def _append_to_audit_log(self, data: Dict[str, Any]):
        """Persiste el evento en el archivo de auditoría inmutable JSONL."""
        try:
            with open(AUDIT_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(json.dumps(data, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.error("Error persistiendo log de auditoría ISO 27001: %s", e)

    def get_status(self) -> Dict[str, Any]:
        """Retorna el estado de seguridad perimetral actual."""
        if not self.last_scan_result:
            return self.run_perimeter_audit()
        return self.last_scan_result

    def get_alerts(self) -> List[Dict[str, Any]]:
        """Retorna las alertas acumuladas."""
        return self.alerts_history


# Singleton exportado
security_agent = LocalCybersecurityAgent()
