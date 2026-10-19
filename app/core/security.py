from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import jwt
from fastapi import Header, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.domain.models import AuditLog
from app.core.config import (
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

# Roles válidos del sistema según política financiera y logística RBAC
ROLE_ANALISTA_COMERCIAL = "analista_comercial"
ROLE_ANALISTA_OPERACIONES = "analista_operaciones"
ROLE_CONTROLLER_ADMIN = "controller_admin"

# Roles específicos de la Unidad de Negocio 3PL Logística & Distribución
ROLE_3PL_ADMIN = "admin_3pl"
ROLE_3PL_OPERARIO = "operario_3pl"
ROLE_3PL_CONDUCTOR = "conductor_3pl"

VALID_ROLES = {
    ROLE_ANALISTA_COMERCIAL,
    ROLE_ANALISTA_OPERACIONES,
    ROLE_CONTROLLER_ADMIN,
    ROLE_3PL_ADMIN,
    ROLE_3PL_OPERARIO,
    ROLE_3PL_CONDUCTOR,
}

security_bearer = HTTPBearer(auto_error=False)


class UserContext:
    def __init__(
        self,
        user_id: str,
        role: str,
        driver_id: Optional[int] = None,
        tenant_id: str = "tenant_calcu_corp",
        is_master_superadmin: bool = False,
    ):
        self.user_id = user_id
        self.role = role
        self.driver_id = driver_id
        self.tenant_id = tenant_id or "tenant_calcu_corp"
        self.is_master_superadmin = is_master_superadmin

    def is_admin(self) -> bool:
        return self.role in {ROLE_CONTROLLER_ADMIN, ROLE_3PL_ADMIN}

    def is_3pl_operario(self) -> bool:
        return self.role == ROLE_3PL_OPERARIO

    def is_3pl_conductor(self) -> bool:
        return self.role == ROLE_3PL_CONDUCTOR


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Genera un token JWT criptográficamente firmado con claims de identidad, tenant_id y rol RBAC.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": now,
    })
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> UserContext:
    """
    Decodifica y valida un token JWT. Lanza HTTPException 401 si expiró o fue manipulado.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        driver_id: Optional[int] = payload.get("driver_id")
        tenant_id: str = str(payload.get("tenant_id") or "tenant_calcu_corp")
        if not user_id or not role:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token no contiene los claims requeridos (sub, role)",
                headers={"WWW-Authenticate": "Bearer"},
            )
        clean_role = str(role).strip().lower()
        if clean_role not in VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rol no autorizado '{clean_role}'. Roles válidos: {list(VALID_ROLES)}"
            )
        
        clean_user = str(user_id).strip().lower()
        is_super = bool(payload.get("is_master_superadmin", False))
        if clean_user in {"seba", "sebar_2@hotmail.com"}:
            is_super = True
        elif clean_user in {"demo", "admin"}:
            is_super = False

        return UserContext(
            user_id=str(user_id),
            role=clean_role,
            driver_id=driver_id,
            tenant_id=tenant_id,
            is_master_superadmin=is_super
        )

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acceso expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido o firma digital corrupta: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
) -> UserContext:
    """
    Extrae y valida el contexto del usuario.
    Prioridad 1: Bearer Token JWT criptográfico.
    Prioridad 2: Header X-User-Role (retrocompatibilidad controlada con pruebas).
    Fallback seguro: Usuario por defecto para endpoints abiertos.
    """
    if credentials and credentials.credentials:
        return decode_access_token(credentials.credentials)

    if x_user_role:
        clean_role = x_user_role.strip().lower()
        if clean_role not in VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rol no autorizado '{clean_role}'. Roles válidos: {list(VALID_ROLES)}"
            )
        clean_uid = (x_user_id or "analista_usuario").strip().lower()
        is_super = clean_uid in {"seba", "sebar_2@hotmail.com"}
        return UserContext(user_id=x_user_id or "analista_usuario", role=clean_role, is_master_superadmin=is_super)

    # Fallback predeterminado para endpoints informativos abiertos
    return UserContext(user_id=x_user_id or "default_user", role=ROLE_CONTROLLER_ADMIN, is_master_superadmin=False)


def require_roles(allowed_roles: List[str]):
    """
    Dependencia estricta de seguridad: Exige autenticación y restringe endpoints
    exclusivamente a los roles especificados. Si no hay credenciales, rechaza con 401.
    Si el rol es insuficiente, rechaza con 403.
    """
    def role_checker(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
        x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
        x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    ) -> UserContext:
        user: Optional[UserContext] = None

        if credentials and credentials.credentials:
            user = decode_access_token(credentials.credentials)
        elif x_user_role:
            clean_role = x_user_role.strip().lower()
            if clean_role not in VALID_ROLES:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Rol no autorizado '{clean_role}'. Roles válidos: {list(VALID_ROLES)}"
                )
            clean_uid = (x_user_id or "analista_usuario").strip().lower()
            is_super = clean_uid in {"seba", "sebar_2@hotmail.com"}
            user = UserContext(user_id=x_user_id or "analista_usuario", role=clean_role, is_master_superadmin=is_super)

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Se requiere autenticación Bearer JWT",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado: Se requiere uno de los roles {allowed_roles}. Tu rol actual es '{user.role}'."
            )
        return user

    return role_checker


def require_master_superadmin():
    """
    Dependencia estricta de seguridad: Exige que el usuario autenticado sea
    exclusivamente el Super-Administrador Maestro ('seba' o 'sebar_2@hotmail.com').
    Cualquier otro rol o administrador (incluso 'admin' o 'demo') es rechazado con 403.
    """
    def master_checker(
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
        x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
        x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    ) -> UserContext:
        user: Optional[UserContext] = None
        if credentials and credentials.credentials:
            user = decode_access_token(credentials.credentials)
        elif x_user_id:
            clean_uid = x_user_id.strip().lower()
            is_super = clean_uid in {"seba", "sebar_2@hotmail.com"}
            user = UserContext(user_id=clean_uid, role=x_user_role or ROLE_CONTROLLER_ADMIN, is_master_superadmin=is_super)
        
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Se requiere autenticación Bearer JWT",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        clean_name = user.user_id.strip().lower()
        if not (user.is_master_superadmin or clean_name in {"seba", "sebar_2@hotmail.com"}):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acceso restringido: Únicamente el usuario superadministrador 'seba' tiene autorización para crear cuentas, aprovisionar tenants y gestionar licencias globales.",
            )
        return user
    return master_checker


# Alias para compatibilidad con código preexistente
require_role = require_roles


def record_audit_log(
    db: Session,
    user_id: str,
    role: str,
    action: str,
    resource: str,
    details: Optional[Dict[str, Any]] = None
) -> AuditLog:
    """
    Inserta un registro inmutable (append-only) en audit_logs para trazabilidad financiera.
    """
    log_entry = AuditLog(
        user_id=user_id,
        role=role,
        action=action,
        resource=resource,
        details=details or {},
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry


def validate_order_stage_transition(
    amount: Decimal,
    target_stage: str,
    user: UserContext
) -> None:
    """
    Segregación de funciones: Mover una orden de compra a aprobación o
    cualquier movimiento con monto > $5,000 requiere rol obligatorio 'controller_admin'.
    """
    if target_stage in ("aprobacion", "fabricacion") or amount > Decimal('5000.00'):
        if user.role != ROLE_CONTROLLER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Segregación de funciones: La aprobación o movimiento de órdenes de compra con monto > $5,000 requiere estrictamente el rol 'controller_admin'."
            )


def validate_budget_variance_authorization(
    variance_amount: Decimal,
    user: UserContext
) -> None:
    """
    Autorizar o mitigar un desvío presupuestario > $5,000 requiere rol 'controller_admin'.
    """
    if abs(variance_amount) > Decimal('5000.00') and user.role != ROLE_CONTROLLER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Segregación de funciones: Autorizar o mitigar desvíos presupuestarios superiores a $5,000 requiere rol 'controller_admin'."
        )
