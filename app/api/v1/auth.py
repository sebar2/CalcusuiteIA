from typing import Dict, Any, Optional
from datetime import timedelta, datetime, timezone
import os
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.database.session import get_db, SessionLocal
from app.models.accounting_entities import SystemUser
from app.models.multitenant_entities import TenantAccount
from app.services.monitoring_service import verify_password, hash_password, MonitoringService
from app.core.vault import (
    generate_captcha_challenge,
    verify_captcha_challenge,
    generate_totp_secret,
    verify_totp_code,
    build_otpauth_uri,
    encrypt_vault_payload,
    decrypt_vault_payload,
)
from app.core.security import (
    create_access_token,
    get_current_user,
    require_roles,
    UserContext,
    ROLE_CONTROLLER_ADMIN,
    ROLE_ANALISTA_OPERACIONES,
    ROLE_ANALISTA_COMERCIAL,
    ROLE_3PL_ADMIN,
    ROLE_3PL_OPERARIO,
    ROLE_3PL_CONDUCTOR,
    VALID_ROLES,
)
from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticación Multi-Tenant, Captcha & 2FA"])


class LoginRequest(BaseModel):
    username: str = Field(..., description="Nombre de usuario o correo corporativo")
    password: str = Field(..., description="Contraseña del usuario")
    captcha_token: Optional[str] = Field(None, description="Token HMAC del desafío Captcha")
    captcha_answer: Optional[str] = Field(None, description="Respuesta humana al Captcha")
    totp_code: Optional[str] = Field(None, description="Código de 6 dígitos de Autenticador 2FA (TOTP)")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    role: str
    user_id: str
    nombre: Optional[str] = None
    driver_id: Optional[int] = None
    tenant_id: str = "tenant_calcu_corp"
    company_name: str = "Calcu Corporación Central S.A."
    license_tier: str = "ENTERPRISE_3PL"
    simulated_tier: Optional[str] = None
    subscription_status: str = "ACTIVE_PAID"
    trial_days_remaining: int = 14
    two_factor_enabled: bool = False
    is_master_superadmin: bool = False
    mfa_required: bool = False


class UserProfileResponse(BaseModel):
    user_id: str
    role: str
    is_admin: bool
    status: str = "active"
    tenant_id: str = "tenant_calcu_corp"


class TwoFactorVerifyRequest(BaseModel):
    totp_code: str = Field(..., min_length=6, max_length=6, description="Código TOTP de 6 dígitos")


def get_authorized_users() -> Dict[str, Dict[str, Any]]:
    """
    Directorio de credenciales corporativas autorizadas.
    Carga de forma dinámica y segura las credenciales desde variables de entorno (.env).
    """
    admin_user = os.getenv("CALCU_ADMIN_USER", "admin").strip().lower()
    admin_pass = os.getenv("CALCU_ADMIN_PASSWORD", "admin123")

    controller_user = os.getenv("CALCU_CONTROLLER_USER", "controller_admin").strip().lower()
    controller_pass = os.getenv("CALCU_CONTROLLER_PASSWORD", "calcu2026")

    ops_user = os.getenv("CALCU_OPS_USER", "operaciones").strip().lower()
    ops_pass = os.getenv("CALCU_OPS_PASSWORD", "ops123")

    ops_analyst_user = os.getenv("CALCU_OPS_ANALYST_USER", "analista_operaciones").strip().lower()
    ops_analyst_pass = os.getenv("CALCU_OPS_ANALYST_PASSWORD", "calcu2026")

    com_user = os.getenv("CALCU_COM_USER", "comercial").strip().lower()
    com_pass = os.getenv("CALCU_COM_PASSWORD", "com123")

    com_analyst_user = os.getenv("CALCU_COM_ANALYST_USER", "analista_comercial").strip().lower()
    com_analyst_pass = os.getenv("CALCU_COM_ANALYST_PASSWORD", "calcu2026")

    admin_3pl_user = os.getenv("CALCU_3PL_ADMIN_USER", "admin_3pl").strip().lower()
    admin_3pl_pass = os.getenv("CALCU_3PL_ADMIN_PASSWORD", "admin3pl123")

    operario_3pl_user = os.getenv("CALCU_3PL_OPERARIO_USER", "operario_3pl").strip().lower()
    operario_3pl_pass = os.getenv("CALCU_3PL_OPERARIO_PASSWORD", "operario123")

    conductor_3pl_user = os.getenv("CALCU_3PL_CHOFER_USER", "conductor_3pl").strip().lower()
    conductor_3pl_pass = os.getenv("CALCU_3PL_CHOFER_PASSWORD", "chofer123")

    demo_user = os.getenv("CALCU_DEMO_USER", "demo").strip().lower()
    demo_pass = os.getenv("CALCU_DEMO_PASSWORD", "demo123")

    return {
        "seba": {
            "password": os.getenv("CALCU_SEBA_PASSWORD", "seba2026!"),
            "role": ROLE_CONTROLLER_ADMIN,
            "name": "Sebastián (Superadministrador Maestro)",
            "driver_id": None,
            "tenant_id": "tenant_calcu_corp",
            "is_master_superadmin": True,
        },
        "sebar_2@hotmail.com": {
            "password": os.getenv("CALCU_SEBA_PASSWORD", "seba2026!"),
            "role": ROLE_CONTROLLER_ADMIN,
            "name": "Sebastián (Superadministrador Maestro)",
            "driver_id": None,
            "tenant_id": "tenant_calcu_corp",
            "is_master_superadmin": True,
        },
        demo_user: {
            "password": demo_pass,
            "role": ROLE_CONTROLLER_ADMIN,
            "name": "Usuario Demo (Trial 14 Días Enterprise)",
            "driver_id": None,
            "tenant_id": "tenant_demo_sandbox",
            "is_master_superadmin": False,
        },
        admin_user: {
            "password": admin_pass,
            "role": ROLE_CONTROLLER_ADMIN,
            "name": "Controller Financiero & Administrador",
            "driver_id": None,
            "tenant_id": "tenant_calcu_corp",
            "is_master_superadmin": False,
        },
        controller_user: {
            "password": controller_pass,
            "role": ROLE_CONTROLLER_ADMIN,
            "name": "Controller Financiero Senior",
            "driver_id": None,
            "tenant_id": "tenant_calcu_corp",
            "is_master_superadmin": False,
        },
        ops_user: {
            "password": ops_pass,
            "role": ROLE_ANALISTA_OPERACIONES,
            "name": "Jefe de Operaciones Logísticas",
            "driver_id": None,
            "tenant_id": "tenant_calcu_corp",
            "is_master_superadmin": False,
        },
        ops_analyst_user: {
            "password": ops_analyst_pass,
            "role": ROLE_ANALISTA_OPERACIONES,
            "name": "Analista de Supply Chain",
            "driver_id": None,
            "tenant_id": "tenant_calcu_corp",
            "is_master_superadmin": False,
        },
        com_user: {
            "password": com_pass,
            "role": ROLE_ANALISTA_COMERCIAL,
            "name": "Gerente Comercial",
            "driver_id": None,
            "tenant_id": "tenant_calcu_corp",
            "is_master_superadmin": False,
        },
        com_analyst_user: {
            "password": com_analyst_pass,
            "role": ROLE_ANALISTA_COMERCIAL,
            "name": "Ejecutivo de Cuentas B2B",
            "driver_id": None,
            "tenant_id": "tenant_calcu_corp",
            "is_master_superadmin": False,
        },
        admin_3pl_user: {
            "password": admin_3pl_pass,
            "role": ROLE_3PL_ADMIN,
            "name": "Administrador 3PL Distribución",
            "driver_id": None,
            "tenant_id": "tenant_calcu_corp",
            "is_master_superadmin": False,
        },
        operario_3pl_user: {
            "password": operario_3pl_pass,
            "role": ROLE_3PL_OPERARIO,
            "name": "Operario Depósito & Picking",
            "driver_id": None,
            "tenant_id": "tenant_calcu_corp",
            "is_master_superadmin": False,
        },
        conductor_3pl_user: {
            "password": conductor_3pl_pass,
            "role": ROLE_3PL_CONDUCTOR,
            "name": "Carlos Rodríguez (Chofer)",
            "driver_id": 1,
            "tenant_id": "tenant_calcu_corp",
            "is_master_superadmin": False,
        },
    }


def _resolve_tenant_metadata(master_db: Session, tenant_id: str) -> Dict[str, Any]:
    """Obtiene los metadatos de cuenta y estado de licencia del Tenant."""
    tenant = master_db.query(TenantAccount).filter(TenantAccount.id == tenant_id).first()
    if not tenant:
        return {
            "tenant_id": tenant_id or "tenant_calcu_corp",
            "company_name": "Calcu Corporación Central S.A.",
            "license_tier": "ENTERPRISE_3PL",
            "simulated_tier": None,
            "subscription_status": "ACTIVE_PAID",
            "trial_days_remaining": 14,
            "is_active": True,
        }
    now_utc = datetime.now(timezone.utc)
    t_end = tenant.trial_ends_at
    if t_end and t_end.tzinfo is None:
        t_end = t_end.replace(tzinfo=timezone.utc)
    days_left = max(0, (t_end - now_utc).days) if t_end else 14
    return {
        "tenant_id": tenant.id,
        "company_name": tenant.nombre_empresa,
        "license_tier": tenant.license_tier,
        "simulated_tier": tenant.simulated_tier or tenant.license_tier,
        "subscription_status": tenant.subscription_status,
        "trial_days_remaining": days_left,
        "is_active": tenant.is_active,
    }


@router.get(
    "/captcha",
    summary="Genera un desafío humano Captcha SVG firmado con HMAC-SHA256"
)
def get_login_captcha():
    return generate_captcha_challenge()


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Inicia sesión Multi-Tenant con validación de Captcha, 2FA TOTP y licencia"
)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Autentica al usuario contra la base de datos SystemUser, Cuentas Tenant o el directorio corporativo.
    Detecta automáticamente la cuenta empresarial (Tenant), valida su licencia,
    verifica el desafío Captcha (si se provee) y aplica segundo factor 2FA TOTP cuando está activo.
    """
    # 0. Validar Captcha si el cliente envía captcha_token
    if payload.captcha_token:
        if not verify_captcha_challenge(payload.captcha_token, payload.captcha_answer or ""):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código Captcha incorrecto o expirado. Por favor verifique los caracteres.",
            )

    clean_user = payload.username.strip().lower()
    master_db = SessionLocal()

    try:
        # 1. Comprobar primero en la base de datos de usuarios del sistema (SystemUser)
        db_user = master_db.query(SystemUser).filter(
            or_(
                func.lower(SystemUser.username) == clean_user,
                func.lower(SystemUser.email) == clean_user
            )
        ).first()

        if db_user:
            if not db_user.activo:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Usuario desactivado por el Administrador. Contacte al Controller.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            is_valid = False
            if db_user.password_hash:
                is_valid = verify_password(payload.password, db_user.password_hash)

            if not is_valid:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Credenciales inválidas. Verifique su usuario y contraseña.",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Verificar Segundo Factor de Autenticación (2FA TOTP) si está activo
            if db_user.two_factor_enabled and db_user.two_factor_secret_encrypted:
                if not payload.totp_code:
                    return TokenResponse(
                        access_token="",
                        expires_in_minutes=0,
                        role=db_user.role,
                        user_id=db_user.username,
                        nombre=db_user.nombre_completo,
                        two_factor_enabled=True,
                        mfa_required=True,
                    )
                secret_data = decrypt_vault_payload(db_user.two_factor_secret_encrypted)
                totp_secret = secret_data.get("totp_secret", "")
                if not verify_totp_code(totp_secret, payload.totp_code):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Código de verificación 2FA (6 dígitos) inválido.",
                    )

            user_tenant_id = db_user.tenant_id or "tenant_calcu_corp"
            tenant_meta = _resolve_tenant_metadata(master_db, user_tenant_id)
            if not tenant_meta["is_active"] or tenant_meta["subscription_status"] in ("SUSPENDED", "EXPIRED"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"La licencia de la cuenta '{tenant_meta['company_name']}' se encuentra suspendida o vencida.",
                )

            role = db_user.role
            is_super = bool(clean_user in {"seba", "sebar_2@hotmail.com"})
            token_data = {
                "sub": db_user.username,
                "role": role,
                "name": db_user.nombre_completo,
                "email": db_user.email,
                "driver_id": None,
                "tenant_id": tenant_meta["tenant_id"],
                "restricted_modules": db_user.restricted_modules or [],
                "is_master_superadmin": is_super,
            }
            db_user.last_login = datetime.now(timezone.utc)
            master_db.commit()

            MonitoringService.log_activity(
                master_db,
                user_id=db_user.username,
                role=role,
                action="INICIO_SESION",
                resource="auth/login",
                evento_realizado=f"Inicio de sesión exitoso '{db_user.username}' en cuenta '{tenant_meta['company_name']}'",
                severidad="INFO",
                details={"email": db_user.email, "role": role, "tenant_id": tenant_meta["tenant_id"]}
            )

            expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            token = create_access_token(data=token_data, expires_delta=expires)

            return TokenResponse(
                access_token=token,
                token_type="bearer",
                expires_in_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
                role=role,
                user_id=db_user.username,
                nombre=db_user.nombre_completo,
                driver_id=None,
                tenant_id=tenant_meta["tenant_id"],
                company_name=tenant_meta["company_name"],
                license_tier=tenant_meta["license_tier"],
                simulated_tier=tenant_meta["simulated_tier"],
                subscription_status=tenant_meta["subscription_status"],
                trial_days_remaining=tenant_meta["trial_days_remaining"],
                two_factor_enabled=bool(db_user.two_factor_enabled),
                is_master_superadmin=is_super,
                mfa_required=False,
            )

        # 2. Verificar si coincide con el administrador de una cuenta Tenant creada en tenant_accounts
        tenant_by_admin = master_db.query(TenantAccount).filter(
            or_(
                func.lower(TenantAccount.admin_username) == clean_user,
                func.lower(TenantAccount.admin_email) == clean_user,
            )
        ).first()

        # 3. Verificar usuarios autorizados de sistema (.env / demo)
        authorized_users = get_authorized_users()
        user_info = authorized_users.get(clean_user)

        if not user_info and tenant_by_admin:
            # Permitir login para cuentas tenant recién aprovisionadas con clave por defecto o calcu2026
            if payload.password in {"calcu2026", "admin123", "demo123"}:
                user_info = {
                    "password": payload.password,
                    "role": ROLE_CONTROLLER_ADMIN,
                    "name": f"Admin - {tenant_by_admin.nombre_empresa}",
                    "driver_id": None,
                    "tenant_id": tenant_by_admin.id,
                    "is_master_superadmin": False,
                }

        if not user_info or user_info["password"] != payload.password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas. Verifique su usuario y contraseña.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        role = user_info["role"]
        driver_id = user_info.get("driver_id")
        resolved_tid = user_info.get("tenant_id", "tenant_calcu_corp")
        is_super = bool(clean_user in {"seba", "sebar_2@hotmail.com"})
        tenant_meta = _resolve_tenant_metadata(master_db, resolved_tid)

        if not tenant_meta["is_active"] or tenant_meta["subscription_status"] in ("SUSPENDED", "EXPIRED"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"La licencia de la cuenta '{tenant_meta['company_name']}' se encuentra suspendida o vencida.",
            )

        token_data = {
            "sub": clean_user,
            "role": role,
            "name": user_info["name"],
            "driver_id": driver_id,
            "tenant_id": tenant_meta["tenant_id"],
            "is_master_superadmin": is_super,
        }

        expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        token = create_access_token(data=token_data, expires_delta=expires)

        return TokenResponse(
            access_token=token,
            token_type="bearer",
            expires_in_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
            role=role,
            user_id=clean_user,
            nombre=user_info["name"],
            driver_id=driver_id,
            tenant_id=tenant_meta["tenant_id"],
            company_name=tenant_meta["company_name"],
            license_tier=tenant_meta["license_tier"],
            simulated_tier=tenant_meta["simulated_tier"],
            subscription_status=tenant_meta["subscription_status"],
            trial_days_remaining=tenant_meta["trial_days_remaining"],
            two_factor_enabled=False,
            is_master_superadmin=is_super,
            mfa_required=False,
        )
    finally:
        master_db.close()


@router.get(
    "/me",
    response_model=UserProfileResponse,
    summary="Retorna el perfil del usuario autenticado mediante token JWT"
)
def get_current_user_profile(user: UserContext = Depends(require_roles(list(VALID_ROLES)))):
    return UserProfileResponse(
        user_id=user.user_id,
        role=user.role,
        is_admin=user.is_admin(),
        status="active",
        tenant_id=user.tenant_id,
    )


@router.get(
    "/admin-only",
    summary="Endpoint protegido exclusivamente para rol controller_admin"
)
def admin_only_test(user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN]))):
    return {
        "status": "success",
        "message": "Acceso concedido a zona restringida de Controller Admin.",
        "user_id": user.user_id,
        "role": user.role,
        "tenant_id": user.tenant_id,
    }


# =====================================================================
# GESTIÓN DE SEGUNDO FACTOR DE AUTENTICACIÓN (2FA / MFA TOTP)
# =====================================================================

@router.post(
    "/2fa/setup",
    summary="Genera secreto TOTP RFC 6238 y URI para configurar Google Authenticator / Authy"
)
def setup_2fa(
    user: UserContext = Depends(require_roles(list(VALID_ROLES))),
):
    master_db = SessionLocal()
    try:
        secret_b32 = generate_totp_secret()
        uri = build_otpauth_uri(secret_b32, user.user_id, issuer="Calcu Suite 2026")
        encrypted_sec = encrypt_vault_payload({"totp_secret": secret_b32})

        db_user = master_db.query(SystemUser).filter(func.lower(SystemUser.username) == user.user_id.lower()).first()
        if db_user:
            db_user.two_factor_secret_encrypted = encrypted_sec
            master_db.commit()

        return {
            "status": "pending_verification",
            "user_id": user.user_id,
            "totp_secret": secret_b32,
            "otpauth_uri": uri,
            "instructions": "Escanee el código o ingrese la clave en Google Authenticator / Authy y confirme con el código de 6 dígitos.",
        }
    finally:
        master_db.close()


@router.post(
    "/2fa/enable",
    summary="Verifica el código TOTP de 6 dígitos y activa 2FA para el usuario"
)
def enable_2fa(
    payload: TwoFactorVerifyRequest,
    user: UserContext = Depends(require_roles(list(VALID_ROLES))),
):
    master_db = SessionLocal()
    try:
        db_user = master_db.query(SystemUser).filter(func.lower(SystemUser.username) == user.user_id.lower()).first()
        if not db_user or not db_user.two_factor_secret_encrypted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Primero debe iniciar la configuración 2FA en /api/v1/auth/2fa/setup.",
            )
        sec_data = decrypt_vault_payload(db_user.two_factor_secret_encrypted)
        totp_secret = sec_data.get("totp_secret", "")
        if not verify_totp_code(totp_secret, payload.totp_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El código de 6 dígitos no coincide. Verifique la hora de su dispositivo.",
            )
        db_user.two_factor_enabled = True
        master_db.commit()
        return {
            "status": "enabled",
            "two_factor_enabled": True,
            "message": "Autenticación de 2 Factores (2FA) activada exitosamente.",
        }
    finally:
        master_db.close()


@router.post(
    "/2fa/disable",
    summary="Desactiva el Segundo Factor de Autenticación (2FA)"
)
def disable_2fa(
    user: UserContext = Depends(require_roles(list(VALID_ROLES))),
):
    master_db = SessionLocal()
    try:
        db_user = master_db.query(SystemUser).filter(func.lower(SystemUser.username) == user.user_id.lower()).first()
        if db_user:
            db_user.two_factor_enabled = False
            db_user.two_factor_secret_encrypted = None
            master_db.commit()
        return {
            "status": "disabled",
            "two_factor_enabled": False,
            "message": "Autenticación de 2 Factores desactivada.",
        }
    finally:
        master_db.close()
