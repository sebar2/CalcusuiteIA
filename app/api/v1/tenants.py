from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import re
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.session import SessionLocal, tenant_connection_manager
from app.models.multitenant_entities import TenantAccount
from app.models.accounting_entities import SystemUser
from app.services.monitoring_service import hash_password, MonitoringService
from app.core.security import (
    require_roles,
    require_master_superadmin,
    UserContext,
    ROLE_CONTROLLER_ADMIN,
    VALID_ROLES,
)

router = APIRouter(prefix="/api/v1/tenants", tags=["Multi-Tenant SaaS, Licencias & Super-Admin Maestro"])

LICENSE_CAPABILITIES: Dict[str, Dict[str, Any]] = {
    "STARTER": {
        "name": "Licencia Starter (Pyme)",
        "price_monthly_usd": 79.0,
        "max_users": 3,
        "allowed_channels": ["WEB_FORM", "WHATSAPP", "WHATSAPP_QR"],
        "ai_autopilot": False,
        "b2b_invoicing": False,
        "module_3pl": False,
        "restricted_modules": ["logistics-clients", "logistics-fleet", "logistics-inventory", "logistics-kanban", "logistics-tracking", "logistics-orders", "logistics-finance", "invoices", "tenders"],
        "features": [
            "Hasta 3 usuarios (1 Admin, 2 Comerciales)",
            "Pipeline CRM Kanban + Etiquetas de Origen",
            "Integración Webhook Web + WhatsApp (API y QR Directo)",
            "Chat Omnicanal Básico",
        ],
    },
    "PRO": {
        "name": "Licencia Pro (Growth & AdTech)",
        "price_monthly_usd": 190.0,
        "max_users": 10,
        "allowed_channels": ["GOOGLE_ADS", "META_ADS", "WHATSAPP", "WHATSAPP_QR", "EMAIL", "WEB_FORM"],
        "ai_autopilot": True,
        "b2b_invoicing": True,
        "module_3pl": False,
        "restricted_modules": ["logistics-clients", "logistics-fleet", "logistics-inventory", "logistics-kanban", "logistics-tracking", "logistics-orders", "logistics-finance"],
        "features": [
            "Hasta 10 usuarios (Admin, Comerciales, Finanzas)",
            "6 Canales AdTech (Google Ads, Meta, WhatsApp API + QR, Email, Web)",
            "Copiloto de IA Gratuito en Chat Omnicanal",
            "Facturación Electrónica B2B & Control Presupuestario",
        ],
    },
    "ENTERPRISE_3PL": {
        "name": "Licencia Enterprise & 3PL (Suite Completa)",
        "price_monthly_usd": 490.0,
        "max_users": 999,
        "allowed_channels": ["GOOGLE_ADS", "META_ADS", "WHATSAPP", "WHATSAPP_QR", "EMAIL", "WEB_FORM"],
        "ai_autopilot": True,
        "b2b_invoicing": True,
        "module_3pl": True,
        "restricted_modules": [],
        "features": [
            "Usuarios Ilimitados y Multi-Depósito",
            "Hub Omnicanal Completo (incl. WhatsApp QR) + Auto-Respuesta IA 24/7",
            "Suite 3PL Completa (Flota, Ruteo GPS, Despachos, APK)",
            "Licitaciones Estatales SICE/RUPE & Auditoría ISO 27001",
        ],
    },
}


class TenantAccountResponse(BaseModel):
    id: str
    slug: str
    nombre_empresa: str
    rut: Optional[str] = None
    schema_name: str
    db_strategy: str
    license_tier: str
    simulated_tier: str
    effective_tier: str
    subscription_status: str
    trial_days_remaining: int
    trial_ends_at: str
    max_users: int
    admin_email: str
    admin_username: str
    mrr_usd: float
    is_active: bool
    created_at: str
    capabilities: Dict[str, Any]


class TenantCreateRequest(BaseModel):
    slug: str = Field(..., min_length=2, max_length=50, description="Identificador único de la cuenta (ej. distsur)")
    nombre_empresa: str = Field(..., min_length=2, max_length=150)
    rut: Optional[str] = Field(default=None, max_length=50)
    admin_email: str = Field(..., max_length=150)
    admin_username: str = Field(..., min_length=3, max_length=100)
    admin_password: str = Field(default="calcu2026", min_length=6, max_length=100)
    license_tier: str = Field(default="ENTERPRISE_3PL", description="Por defecto los 14 días gratis inician en ENTERPRISE_3PL")
    trial_days: int = Field(default=14, ge=1, le=365)


class LicenseSwitchRequest(BaseModel):
    simulated_tier: Optional[str] = Field(None, description="STARTER | PRO | ENTERPRISE_3PL (Modo Prueba 14 días)")
    license_tier: Optional[str] = Field(None, description="STARTER | PRO | ENTERPRISE_3PL")
    subscription_status: Optional[str] = Field(None, description="TRIAL_14_DAYS | ACTIVE_PAID | SUSPENDED | EXPIRED")
    extend_trial_days: Optional[int] = Field(None, ge=1, le=90)
    is_active: Optional[bool] = None


def _to_tenant_response(t: TenantAccount) -> TenantAccountResponse:
    now_utc = datetime.now(timezone.utc)
    t_end = t.trial_ends_at
    if t_end and t_end.tzinfo is None:
        t_end = t_end.replace(tzinfo=timezone.utc)
    days_left = max(0, (t_end - now_utc).days) if t_end else 14
    sim_tier = t.simulated_tier or t.license_tier or "ENTERPRISE_3PL"
    effective = sim_tier if t.subscription_status == "TRIAL_14_DAYS" else t.license_tier
    caps = LICENSE_CAPABILITIES.get(effective, LICENSE_CAPABILITIES["ENTERPRISE_3PL"])

    return TenantAccountResponse(
        id=t.id,
        slug=t.slug,
        nombre_empresa=t.nombre_empresa,
        rut=t.rut,
        schema_name=t.schema_name,
        db_strategy=t.db_strategy,
        license_tier=t.license_tier,
        simulated_tier=sim_tier,
        effective_tier=effective,
        subscription_status=t.subscription_status,
        trial_days_remaining=days_left,
        trial_ends_at=t_end.strftime("%Y-%m-%d") if t_end else "",
        max_users=caps["max_users"],
        admin_email=t.admin_email,
        admin_username=t.admin_username,
        mrr_usd=float(t.mrr_usd or 0.0),
        is_active=t.is_active,
        created_at=t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "",
        capabilities=caps,
    )


@router.get(
    "/license-matrix",
    summary="Retorna la matriz oficial de planes y capacidades de licenciamiento SaaS"
)
def get_license_matrix():
    return {
        "default_trial_days": 14,
        "default_trial_tier": "ENTERPRISE_3PL",
        "tiers": LICENSE_CAPABILITIES,
    }


@router.get(
    "/current",
    response_model=TenantAccountResponse,
    summary="Retorna la cuenta Tenant actual del usuario autenticado y su estado de licencia / Trial"
)
def get_current_tenant(
    user: UserContext = Depends(require_roles(list(VALID_ROLES))),
):
    master_db = SessionLocal()
    try:
        tenant = master_db.query(TenantAccount).filter(TenantAccount.id == user.tenant_id).first()
        if not tenant:
            tenant = master_db.query(TenantAccount).filter(TenantAccount.id == "tenant_calcu_corp").first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Cuenta Tenant no encontrada.")
        return _to_tenant_response(tenant)
    finally:
        master_db.close()


@router.get(
    "",
    response_model=List[TenantAccountResponse],
    summary="Lista todas las empresas / cuentas aisladas registradas (Exclusivo Super-Admin Maestro 'seba')"
)
def list_all_tenants(
    user: UserContext = Depends(require_master_superadmin()),
):
    master_db = SessionLocal()
    try:
        tenants = master_db.query(TenantAccount).order_by(TenantAccount.created_at.desc()).all()
        return [_to_tenant_response(t) for t in tenants]
    finally:
        master_db.close()


@router.post(
    "",
    response_model=TenantAccountResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Aprovisiona una nueva empresa (Exclusivo Super-Admin Maestro 'seba')"
)
def provision_new_tenant(
    payload: TenantCreateRequest,
    user: UserContext = Depends(require_master_superadmin()),
):
    clean_slug = re.sub(r"[^a-z0-9_]", "_", payload.slug.strip().lower())
    tenant_id = f"tenant_{clean_slug}" if not clean_slug.startswith("tenant_") else clean_slug

    master_db = SessionLocal()
    try:
        existing = master_db.query(TenantAccount).filter(
            (TenantAccount.id == tenant_id) | (TenantAccount.slug == clean_slug)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ya existe una cuenta registrada con el identificador '{clean_slug}'.",
            )

        tier = payload.license_tier.upper() if payload.license_tier.upper() in LICENSE_CAPABILITIES else "ENTERPRISE_3PL"
        caps = LICENSE_CAPABILITIES[tier]
        now_utc = datetime.now(timezone.utc)
        trial_end = now_utc + timedelta(days=payload.trial_days)

        new_tenant = TenantAccount(
            id=tenant_id,
            slug=clean_slug,
            nombre_empresa=payload.nombre_empresa.strip(),
            rut=payload.rut.strip() if payload.rut else None,
            schema_name=tenant_id,
            db_strategy="POSTGRES_SCHEMA",
            license_tier=tier,
            simulated_tier=tier,
            subscription_status="TRIAL_14_DAYS",
            trial_starts_at=now_utc,
            trial_ends_at=trial_end,
            max_users=caps["max_users"],
            admin_email=payload.admin_email.strip().lower(),
            admin_username=payload.admin_username.strip().lower(),
            mrr_usd=Decimal(str(caps["price_monthly_usd"])),
            is_active=True,
            created_at=now_utc,
        )
        master_db.add(new_tenant)

        # Crear o actualizar el usuario administrador de esta cuenta en SystemUser
        existing_u = master_db.query(SystemUser).filter(
            SystemUser.username == payload.admin_username.strip().lower()
        ).first()
        if not existing_u:
            new_admin = SystemUser(
                username=payload.admin_username.strip().lower(),
                email=payload.admin_email.strip().lower(),
                nombre_completo=f"Admin - {payload.nombre_empresa.strip()}",
                puesto="Controller Administrador de Cuenta",
                role=ROLE_CONTROLLER_ADMIN,
                restricted_modules=[],
                activo=True,
                password_hash=hash_password(payload.admin_password),
                tenant_id=tenant_id,
                two_factor_enabled=False,
                is_master_superadmin=False,
                created_at=now_utc,
            )
            master_db.add(new_admin)

        master_db.commit()
        master_db.refresh(new_tenant)

        # Inicializar físicamente el esquema PostgreSQL / base de datos aislada del nuevo Tenant
        isolated_session = tenant_connection_manager.get_session_for_tenant(tenant_id)
        isolated_session.close()

        MonitoringService.log_activity(
            db=master_db,
            user_id=user.user_id,
            role=user.role,
            action="PROVISION_TENANT_ACCOUNT",
            resource=f"tenants/{tenant_id}",
            evento_realizado=f"Nueva cuenta aislada aprovisionada: {new_tenant.nombre_empresa} ({tenant_id})",
            severidad="INFO",
            details={"tenant_id": tenant_id, "license_tier": tier, "trial_days": payload.trial_days},
        )

        return _to_tenant_response(new_tenant)
    finally:
        master_db.close()


@router.patch(
    "/{tenant_id}/license",
    response_model=TenantAccountResponse,
    summary="Cambia la licencia activa o el modo simulado durante los 14 días de prueba (Trial Switcher)"
)
def update_tenant_license(
    tenant_id: str,
    payload: LicenseSwitchRequest,
    user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN])),
):
    clean_name = user.user_id.strip().lower()
    is_master = user.is_master_superadmin or clean_name in {"seba", "sebar_2@hotmail.com"}
    if not is_master and user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido: Solo el superadministrador maestro 'seba' puede modificar licencias de otras empresas.",
        )

    master_db = SessionLocal()
    try:
        tenant = master_db.query(TenantAccount).filter(TenantAccount.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail=f"Cuenta '{tenant_id}' no encontrada.")

        if payload.simulated_tier is not None:
            sim_up = payload.simulated_tier.upper()
            if sim_up not in LICENSE_CAPABILITIES:
                raise HTTPException(status_code=400, detail=f"Nivel de licencia '{sim_up}' inválido.")
            tenant.simulated_tier = sim_up

        if payload.license_tier is not None:
            tier_up = payload.license_tier.upper()
            if tier_up not in LICENSE_CAPABILITIES:
                raise HTTPException(status_code=400, detail=f"Nivel de licencia '{tier_up}' inválido.")
            tenant.license_tier = tier_up
            tenant.simulated_tier = tier_up
            tenant.max_users = LICENSE_CAPABILITIES[tier_up]["max_users"]
            tenant.mrr_usd = Decimal(str(LICENSE_CAPABILITIES[tier_up]["price_monthly_usd"]))

        if payload.subscription_status is not None:
            tenant.subscription_status = payload.subscription_status.upper()

        if payload.extend_trial_days is not None:
            base_date = tenant.trial_ends_at or datetime.now(timezone.utc)
            if base_date.tzinfo is None:
                base_date = base_date.replace(tzinfo=timezone.utc)
            tenant.trial_ends_at = base_date + timedelta(days=payload.extend_trial_days)

        if payload.is_active is not None:
            tenant.is_active = payload.is_active

        master_db.commit()
        master_db.refresh(tenant)
        return _to_tenant_response(tenant)
    finally:
        master_db.close()
