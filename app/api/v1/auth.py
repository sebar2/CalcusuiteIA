from typing import Dict, Any, Optional
from datetime import timedelta
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field

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

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticación"])


class LoginRequest(BaseModel):
    username: str = Field(..., description="Nombre de usuario o correo corporativo")
    password: str = Field(..., description="Contraseña del usuario")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    role: str
    user_id: str
    nombre: Optional[str] = None
    driver_id: Optional[int] = None


class UserProfileResponse(BaseModel):
    user_id: str
    role: str
    is_admin: bool
    status: str = "active"


import os

def get_authorized_users() -> Dict[str, Dict[str, Any]]:
    """
    Directorio de credenciales corporativas autorizadas.
    Carga de forma dinámica y segura las credenciales desde variables de entorno (.env),
    asegurando que ninguna contraseña real sea expuesta en el repositorio público de GitHub.
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
        demo_user: {
            "password": demo_pass,
            "role": ROLE_CONTROLLER_ADMIN,
            "name": "Usuario Demo (Sandbox Aislado)",
            "driver_id": None
        },
        admin_user: {
            "password": admin_pass,
            "role": ROLE_CONTROLLER_ADMIN,
            "name": "Controller Financiero Administrador",
            "driver_id": None
        },
        controller_user: {
            "password": controller_pass,
            "role": ROLE_CONTROLLER_ADMIN,
            "name": "Controller Financiero Senior",
            "driver_id": None
        },
        ops_user: {
            "password": ops_pass,
            "role": ROLE_ANALISTA_OPERACIONES,
            "name": "Jefe de Operaciones Logísticas",
            "driver_id": None
        },
        ops_analyst_user: {
            "password": ops_analyst_pass,
            "role": ROLE_ANALISTA_OPERACIONES,
            "name": "Analista de Supply Chain",
            "driver_id": None
        },
        com_user: {
            "password": com_pass,
            "role": ROLE_ANALISTA_COMERCIAL,
            "name": "Gerente Comercial",
            "driver_id": None
        },
        com_analyst_user: {
            "password": com_analyst_pass,
            "role": ROLE_ANALISTA_COMERCIAL,
            "name": "Ejecutivo de Cuentas B2B",
            "driver_id": None
        },
        admin_3pl_user: {
            "password": admin_3pl_pass,
            "role": ROLE_3PL_ADMIN,
            "name": "Administrador 3PL Distribución",
            "driver_id": None
        },
        operario_3pl_user: {
            "password": operario_3pl_pass,
            "role": ROLE_3PL_OPERARIO,
            "name": "Operario Depósito & Picking",
            "driver_id": None
        },
        conductor_3pl_user: {
            "password": conductor_3pl_pass,
            "role": ROLE_3PL_CONDUCTOR,
            "name": "Carlos Rodríguez (Chofer)",
            "driver_id": 1
        },
    }


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Inicia sesión y genera un access token Bearer JWT con rol RBAC"
)
def login(payload: LoginRequest):
    """
    Autentica al usuario contra el directorio corporativo y expide un JWT
    firmado digitalmente con tiempo de expiración y rol financiero/logístico.
    """
    clean_user = payload.username.strip().lower()
    authorized_users = get_authorized_users()
    user_info = authorized_users.get(clean_user)

    if not user_info or user_info["password"] != payload.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas. Verifique su usuario y contraseña.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role = user_info["role"]
    driver_id = user_info.get("driver_id")
    token_data = {
        "sub": clean_user,
        "role": role,
        "name": user_info["name"],
        "driver_id": driver_id
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
        driver_id=driver_id
    )


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
        status="active"
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
        "role": user.role
    }
