from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query, status, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.domain.models import UserPreference
from app.domain.schemas import (
    UserPreferenceUpdate,
    UserPreferenceResponse,
)
from app.core.security import (
    get_current_user,
    require_roles,
    UserContext,
    ROLE_CONTROLLER_ADMIN,
    VALID_ROLES,
)
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/api/v1/settings", tags=["Configuración & Preferencias"])

def _require_superadmin_user(user: UserContext) -> None:
    clean_user = user.user_id.lower()
    if not (user.is_master_superadmin or clean_user in {"seba", "sebar_2@hotmail.com"}):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido: Esta funcionalidad está reservada exclusivamente para el Superadministrador Maestro (Sebastian Rodriguez)."
        )



# ============================================================================
# 1. PREFERENCIAS DE USUARIO (PREEXISTENTES / RETROCOMPATIBILIDAD)
# ============================================================================

@router.get(
    "/preferences",
    response_model=UserPreferenceResponse,
    summary="Obtener preferencias de usuario",
    description="Devuelve las preferencias guardadas del usuario (tema, filtros favoritos, columnas visibles y última vista). Si no existen, inicializa un perfil por defecto."
)
def get_user_preferences(
    user_id: str = Query(default="default_user", description="Identificador único del usuario"),
    db: Session = Depends(get_db)
):
    pref = db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
    if not pref:
        pref = UserPreference(
            user_id=user_id,
            active_theme="light_bitrix",
            saved_filters={
                "categoria": "Todas",
                "only_alerts": False,
                "lead_time_min": 0,
                "periodo": "2025-09"
            },
            visible_columns=[
                "sku", "nombre", "categoria", "stock_actual", "rop", "doh", "is_alert"
            ],
            last_view="control_room"
        )
        db.add(pref)
        db.commit()
        db.refresh(pref)

    return pref


@router.post(
    "/preferences",
    response_model=UserPreferenceResponse,
    summary="Guardar o actualizar preferencias de usuario",
    description="Actualiza filtros favoritos, vistas predeterminadas, presets de simulación de pricing y modo visual (light_bitrix/dark)."
)
def update_user_preferences(
    payload: UserPreferenceUpdate,
    db: Session = Depends(get_db)
):
    target_user = payload.user_id or "default_user"
    pref = db.query(UserPreference).filter(UserPreference.user_id == target_user).first()
    
    if not pref:
        pref = UserPreference(
            user_id=target_user,
            active_theme=payload.active_theme or "light_bitrix",
            default_engine_mode=payload.default_engine_mode or "auto",
            saved_filters=payload.saved_filters if payload.saved_filters is not None else {
                "categoria": "Todas",
                "only_alerts": False,
                "lead_time_min": 0,
                "periodo": "2025-09"
            },
            visible_columns=payload.visible_columns if payload.visible_columns is not None else [
                "sku", "nombre", "categoria", "stock_actual", "rop", "doh", "is_alert"
            ],
            last_view=payload.last_view or "control_room",
            updated_at=datetime.now(timezone.utc)
        )
        db.add(pref)
    else:
        if payload.active_theme is not None:
            pref.active_theme = payload.active_theme
        if payload.default_engine_mode is not None:
            pref.default_engine_mode = payload.default_engine_mode
        if payload.saved_filters is not None:
            pref.saved_filters = payload.saved_filters
        if payload.visible_columns is not None:
            pref.visible_columns = payload.visible_columns
        if payload.last_view is not None:
            pref.last_view = payload.last_view
        pref.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(pref)
    return pref


# ============================================================================
# 2. TELEMETRÍA DE RED Y PAQUETES EN VIVO (SUPERADMIN)
# ============================================================================

@router.get(
    "/telemetry",
    summary="Telemetría de Red ZTNA y Paquetes en Vivo (Exclusivo SuperAdmin)",
    description="Retorna monitor de nodos Tailscale Mesh (P2P vs DERP), inspector de WebSockets, throughput FastAPI :8000 y auditoría de puertos."
)
def get_network_telemetry(
    user: UserContext = Depends(get_current_user)
):
    _require_superadmin_user(user)
    return SettingsService.get_network_telemetry()


# ============================================================================
# 3. GESTIÓN DEL MOTOR IA & BÓVEDA CRIPTOGRÁFICA (SUPERADMIN)
# ============================================================================

class AIPerformanceUpdateSchema(BaseModel):
    endpoint: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0)


@router.get(
    "/ai-vault",
    summary="Consulta configuración del motor LLM Ollama y estado de la bóveda AES-256",
)
def get_ai_and_vault(
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    _require_superadmin_user(user)
    return SettingsService.get_ai_and_vault_config(db)


@router.post(
    "/ai-vault/rotate-keys",
    summary="Rotación oficial de claves criptográficas AES-256 de la bóveda (ISO 27001)",
)
def rotate_vault_keys(
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN])),
):
    _require_superadmin_user(user)
    return SettingsService.rotate_vault_keys(db, user_id=user.user_id)


@router.post(
    "/ai-vault/parameters",
    summary="Actualiza endpoints Ollama y temperaturas de generación",
)
def update_ai_parameters(
    payload: AIPerformanceUpdateSchema,
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN])),
):
    _require_superadmin_user(user)
    return SettingsService.update_ai_parameters(endpoint=payload.endpoint, temperature=payload.temperature)


# ============================================================================
# 4. CONSOLA DE SOPORTE TÉCNICO ASISTIDO (JIT IMPERSONATION CON CONSENTIMIENTO)
# ============================================================================

class JITSupportRequestSchema(BaseModel):
    target_tenant_id: str
    reason: str


class JITSupportActionSchema(BaseModel):
    session_id: str
    action: str = Field(..., description="'approve' o 'revoke'")


@router.get(
    "/jit-support",
    summary="Lista las sesiones de soporte técnico JIT activas o pendientes",
)
def list_jit_support_sessions(
    user: UserContext = Depends(get_current_user),
):
    is_super = user.is_master_superadmin or user.user_id.lower() in {"seba", "sebar_2@hotmail.com"}
    return SettingsService.list_jit_sessions(tenant_id=user.tenant_id, is_superadmin=is_super)


@router.post(
    "/jit-support/request",
    summary="SuperAdmin solicita acceso temporal a una empresa cliente (JIT)",
)
def request_jit_support_access(
    payload: JITSupportRequestSchema,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN])),
):
    clean_user = user.user_id.lower()
    is_super = user.is_master_superadmin or clean_user in {"seba", "sebar_2@hotmail.com"}
    if not is_super:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Únicamente el Superadministrador Maestro (Sebastian Rodriguez) tiene privilegios para solicitar sesiones JIT."
        )
    return SettingsService.request_jit_support(
        db=db,
        target_tenant_id=payload.target_tenant_id,
        reason=payload.reason,
        superadmin_user=user.user_id,
    )


@router.post(
    "/jit-support/action",
    summary="Admin de Tenant aprueba (60 min) o revoca el acceso de soporte técnico (ISO 27001)",
)
def action_jit_support_access(
    payload: JITSupportActionSchema,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN])),
):
    return SettingsService.action_jit_support(
        db=db,
        session_id=payload.session_id,
        action=payload.action,
        approver_user=user.user_id,
        tenant_id=user.tenant_id,
    )


# ============================================================================
# 5. PARÁMETROS OPERATIVOS DEL TENANT (DGI, ALERTAS, LOGO & NOTIFICACIONES)
# ============================================================================

class TenantOperationalParamsUpdateSchema(BaseModel):
    idioma: Optional[str] = None
    moneda_base: Optional[str] = None
    formato_numerico: Optional[str] = None
    tema_visual: Optional[str] = None
    rut_dgi: Optional[str] = None
    razon_social: Optional[str] = None
    cfe_serie: Optional[str] = None
    cfe_sucursal: Optional[str] = None
    logo_url: Optional[str] = None
    rop_min_days_alert: Optional[int] = None
    doh_critical_alert: Optional[int] = None
    whatsapp_notifications: Optional[bool] = None
    email_notifications: Optional[bool] = None


@router.get(
    "/tenant-params",
    summary="Obtiene los parámetros operativos del Tenant activo",
)
def get_tenant_operational_parameters(
    user: UserContext = Depends(get_current_user),
):
    return SettingsService.get_tenant_operational_parameters(tenant_id=user.tenant_id)


@router.put(
    "/tenant-params",
    summary="Actualiza los parámetros operativos del Tenant activo",
)
def update_tenant_operational_parameters(
    payload: TenantOperationalParamsUpdateSchema,
    db: Session = Depends(get_db),
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN])),
):
    return SettingsService.update_tenant_operational_parameters(
        tenant_id=user.tenant_id,
        payload=payload.model_dump(exclude_unset=True),
        db=db
    )


# ============================================================================
# 6. COPILOTO IA DE CIBERSEGURIDAD EXCLUSIVO SUPERADMIN (SECOPS COPILOT)
# ============================================================================

class CybersecCopilotQuerySchema(BaseModel):
    prompt: str


@router.post(
    "/cybersec-copilot",
    summary="Consulta al Copiloto IA Guardián de Ciberseguridad (SecOps Copilot ISO 27001)",
)
def ask_cybersec_copilot(
    payload: CybersecCopilotQuerySchema,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    _require_superadmin_user(user)
    return SettingsService.run_cybersec_ai_copilot_audit(
        db=db,
        prompt=payload.prompt,
        user_id=user.user_id
    )


# ============================================================================
# 7. TIPO DE CAMBIO BROU Y MANUAL (BIMONETARIA USD / UYU)
# ============================================================================

class ExchangeRateUpdateSchema(BaseModel):
    manual_rate_uyu: Optional[float] = None
    official_rate_uyu: Optional[float] = None
    use_manual: Optional[bool] = None


@router.get(
    "/exchange-rate",
    summary="Obtiene la configuración y cotización del Tipo de Cambio BROU / Manual (Bimonetaria USD/UYU)",
)
def get_exchange_rate_config():
    return SettingsService.get_exchange_rate_config()


@router.post(
    "/exchange-rate",
    summary="Actualiza la cotización o alternancia del Tipo de Cambio BROU / Manual",
)
def update_exchange_rate_config(
    payload: ExchangeRateUpdateSchema,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    return SettingsService.update_exchange_rate_config(
        payload=payload.model_dump(exclude_unset=True),
        db=db,
    )
