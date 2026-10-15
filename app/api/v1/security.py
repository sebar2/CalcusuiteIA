from fastapi import APIRouter, Depends
from typing import Dict, Any, List
from app.services.security_agent import security_agent
from app.core.security import get_current_user, UserContext

from app.services.tailscale_p2p import TailscaleP2PDiagnoser

router = APIRouter(prefix="/api/v1/security", tags=["Ciberseguridad & ISO 27001"])

@router.get("/status")
def get_security_status(current_user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Retorna el estado actual de cumplimiento ISO/IEC 27001:2022 del nodo central y Tailscale VPN.
    Supervisa la whitelist de puertos autorizados (:8000 API y :5173 Web).
    """
    return security_agent.get_status()

@router.post("/scan")
def trigger_perimeter_scan(current_user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Fuerza una auditoría perimetral instantánea de puertos e interfaces locales y Tailscale.
    Registra el evento en el log inmutable de auditoría JSONL.
    """
    return security_agent.run_perimeter_audit()

@router.get("/alerts")
def get_security_alerts(current_user: UserContext = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """
    Retorna el historial de alertas de seguridad e incidentes de puertos no autorizados.
    """
    return security_agent.get_alerts()

@router.get("/tailscale-p2p")
def get_tailscale_p2p_status(current_user: UserContext = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Diagnóstico de conexiones directas Peer-to-Peer vs relays DERP en Tailscale VPN.
    Asegura que el tracking de choferes y la API operen con mínima latencia y sin cuellos de botella.
    """
    return TailscaleP2PDiagnoser.get_tailscale_status()
