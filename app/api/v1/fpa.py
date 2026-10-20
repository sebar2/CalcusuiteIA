from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.fpa_service import FpaService

router = APIRouter(prefix="/finance/fpa", tags=["Finanzas & Control FP&A"])


class BudgetLineCreateSchema(BaseModel):
    centro_costo_id: int
    periodo: str = "2025-09"
    concepto_opex: str
    monto_presupuestado: float
    monto_real: Optional[float] = 0.0


class GovernanceUpdateSchema(BaseModel):
    centro_costo_id: int
    responsable: Optional[str] = None
    email_notificacion: Optional[str] = None
    alerta_85_activa: Optional[bool] = None
    alerta_100_activa: Optional[bool] = None


class CopilotAuditSchema(BaseModel):
    prompt: str
    periodo: Optional[str] = "2025-09"


@router.get("/summary", response_model=Dict[str, Any])
def get_fpa_summary(
    period: str = Query("2025-09", description="Período contable en formato YYYY-MM"),
    db: Session = Depends(get_db)
):
    """
    Retorna el informe consolidado FP&A:
    - OPEX Presupuestado vs. Real Ejecutado.
    - Desvío neto y porcentual con semáforo de tolerancia (+/- 5%).
    - Desglose por centro de costo y partidas contables (Libro Diario / Gastos).
    - Métricas de liquidez, Runway operacional y Ciclo de Conversión de Efectivo (CCC).
    """
    try:
        return FpaService.get_summary(db, period=period)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar resumen FP&A: {str(e)}")


@router.post("/budget-line", response_model=Dict[str, Any])
def create_or_update_budget_line(
    payload: BudgetLineCreateSchema,
    db: Session = Depends(get_db)
):
    """Crea o actualiza una partida de presupuesto OPEX por centro de costo."""
    try:
        return FpaService.create_or_update_budget_line(db, payload.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al registrar partida presupuestaria: {str(e)}")


@router.post("/responsables", response_model=Dict[str, Any])
def update_cost_center_governance(
    payload: GovernanceUpdateSchema,
    db: Session = Depends(get_db)
):
    """Actualiza responsable, correo y umbrales de alerta preventiva de un centro de costo."""
    try:
        return FpaService.update_governance(db, payload.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al actualizar gobernanza: {str(e)}")


@router.post("/copilot", response_model=Dict[str, Any])
def copilot_audit(
    payload: CopilotAuditSchema,
    db: Session = Depends(get_db)
):
    """
    Copiloto FP&A Inteligente: Audita el libro diario, detecta anomalías contables
    y genera recomendaciones para optimización de OPEX y extensión de runway.
    """
    try:
        return FpaService.copilot_audit(db, prompt=payload.prompt, period=payload.periodo or "2025-09")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en copiloto FP&A: {str(e)}")


@router.get("/projections", response_model=Dict[str, Any])
def get_fpa_projections(
    period: str = Query("2025-09", description="Período contable en formato YYYY-MM"),
    db: Session = Depends(get_db)
):
    """Obtiene las proyecciones de flujo de caja a 30, 60 y 90 días y métricas CCC."""
    try:
        summary = FpaService.get_summary(db, period=period)
        return {
            "periodo": period,
            "caja_actual": summary["caja_actual"],
            "burn_rate_mensual": summary["burn_rate_mensual"],
            "runway_meses": summary["runway_meses"],
            "proyecciones": summary["proyecciones"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al calcular proyecciones: {str(e)}")
