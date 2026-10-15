from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.session import get_db
from app.services.monitoring_service import MonitoringService, POSITION_PRESETS
from app.core.security import (
    require_roles,
    get_current_user,
    UserContext,
    ROLE_CONTROLLER_ADMIN,
    ROLE_ANALISTA_COMERCIAL,
    ROLE_ANALISTA_OPERACIONES,
)

router = APIRouter(prefix="/monitoring", tags=["Monitoring & Security"])

class AuditLogCreateSchema(BaseModel):
    user_id: str
    role: str
    action: str
    resource: str
    evento_realizado: str
    severidad: str = "INFO"
    ip_address: Optional[str] = "100.64.0.1"
    ubicacion: Optional[str] = "Montevideo (Nodo Tailscale Central)"
    details: Optional[Dict[str, Any]] = None

class UserCreateSchema(BaseModel):
    username: str
    email: str
    nombre_completo: str
    puesto: str
    role: Optional[str] = "operaciones"
    password: Optional[str] = None
    send_email: Optional[bool] = False
    restricted_modules: Optional[List[str]] = None
    activo: bool = True

class UserUpdatePermissionsSchema(BaseModel):
    puesto: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    send_email: Optional[bool] = False
    restricted_modules: Optional[List[str]] = None
    activo: Optional[bool] = None

@router.get("/audit-logs", response_model=List[Dict[str, Any]])
def list_audit_logs(
    severidad: Optional[str] = Query(None, description="INFO, WARNING, CRITICAL"),
    search: Optional[str] = Query(None, description="Búsqueda por usuario, evento o ubicación"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN]))
):
    """Obtiene el registro cronológico de actividad, ubicación y eventos de los usuarios (Exclusivo Controller Admin)."""
    logs = MonitoringService.get_audit_logs(db, severidad=severidad, search=search, limit=limit)
    return [
        {
            "id": log.id,
            "timestamp": log.timestamp.isoformat(),
            "fecha": log.timestamp.strftime("%Y-%m-%d"),
            "hora": log.timestamp.strftime("%H:%M:%S"),
            "user_id": log.user_id,
            "role": log.role,
            "action": log.action,
            "resource": log.resource,
            "ip_address": log.ip_address,
            "ubicacion": log.ubicacion,
            "evento_realizado": log.evento_realizado or log.action,
            "severidad": log.severidad or "INFO",
            "details": log.details
        }
        for log in logs
    ]

@router.post("/audit-logs", response_model=Dict[str, Any])
def record_audit_log(
    payload: AuditLogCreateSchema, 
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """Registra manualmente un evento de actividad de usuario o auditoría de seguridad."""
    log = MonitoringService.log_activity(
        db,
        user_id=payload.user_id,
        role=payload.role,
        action=payload.action,
        resource=payload.resource,
        evento_realizado=payload.evento_realizado,
        severidad=payload.severidad,
        ip_address=payload.ip_address or "100.64.0.1",
        ubicacion=payload.ubicacion or "Montevideo (Nodo Tailscale Central)",
        details=payload.details
    )
    return {"success": True, "id": log.id, "timestamp": log.timestamp.isoformat()}

@router.get("/users", response_model=List[Dict[str, Any]])
def list_users(
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN]))
):
    """Lista todos los usuarios del sistema con sus roles y lista negra de módulos (Exclusivo Controller Admin)."""
    users = MonitoringService.get_users(db)
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "nombre_completo": u.nombre_completo,
            "puesto": u.puesto,
            "role": u.role,
            "restricted_modules": u.restricted_modules or [],
            "activo": u.activo,
            "created_at": u.created_at.isoformat(),
            "last_login": u.last_login.isoformat() if u.last_login else None
        }
        for u in users
    ]

@router.get("/presets", response_model=Dict[str, Any])
def get_position_presets(current_user: UserContext = Depends(get_current_user)):
    """Retorna los presets predeterminados de puestos y sus módulos restringidos sugeridos."""
    return POSITION_PRESETS

@router.post("/users", response_model=Dict[str, Any])
def create_system_user(
    payload: UserCreateSchema, 
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN]))
):
    """Crea un nuevo usuario con permisos según su puesto o personalizados (Exclusivo Controller Admin)."""
    try:
        user = MonitoringService.create_user(db, payload.model_dump(), created_by=current_user.user_id)
        return {
            "success": True,
            "message": f"Usuario '{user.username}' creado exitosamente",
            "user_id": user.id,
            "restricted_modules": user.restricted_modules
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al crear usuario: {str(e)}")

@router.put("/users/{user_id}/permissions", response_model=Dict[str, Any])
def update_user_permissions(
    user_id: int, 
    payload: UserUpdatePermissionsSchema, 
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN]))
):
    """Actualiza los módulos restringidos o el puesto de un usuario (Exclusivo Controller Admin)."""
    user = MonitoringService.update_user_permissions(db, user_id, payload.model_dump(exclude_unset=True), updated_by=current_user.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {
        "success": True,
        "message": f"Permisos de '{user.username}' actualizados",
        "restricted_modules": user.restricted_modules
    }

@router.delete("/users/{user_id}", response_model=Dict[str, Any])
def toggle_user_active(
    user_id: int, 
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN]))
):
    """Desactiva o activa un usuario en el sistema (Exclusivo Controller Admin)."""
    from app.models.accounting_entities import SystemUser
    user = db.query(SystemUser).filter(SystemUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.activo = not user.activo
    db.commit()
    return {"success": True, "activo": user.activo, "message": f"Usuario '{user.username}' {'activado' if user.activo else 'desactivado'}"}

@router.post("/users/{user_id}/send-credentials", response_model=Dict[str, Any])
def send_user_credentials(
    user_id: int, 
    payload: Optional[Dict[str, Any]] = None, 
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(require_roles([ROLE_CONTROLLER_ADMIN]))
):
    """
    Genera o reenvía credenciales de acceso seguras por correo al usuario corporativo.
    CIBERSEGURIDAD: Nunca expone la contraseña en la respuesta JSON para evitar fuga de credenciales.
    """
    from app.models.accounting_entities import SystemUser
    from app.services.monitoring_service import send_credentials_notification, hash_password
    import secrets

    user = db.query(SystemUser).filter(SystemUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    pwd = (payload and payload.get("password")) or f"Calcu-{secrets.token_hex(4).upper()}"
    user.password_hash = hash_password(pwd)
    db.commit()

    sent, sent_msg = send_credentials_notification(
        email=user.email,
        username=user.username,
        password=pwd,
        nombre=user.nombre_completo,
        role=user.role
    )

    return {
        "success": True,
        "email": user.email,
        "notified": sent,
        "message": sent_msg
    }

class AICopilotQuerySchema(BaseModel):
    prompt: str

@router.get("/reports/debtors", response_model=Dict[str, Any])
def get_debtors_report(
    filter_days: Optional[int] = Query(None, description="1, 30, 45, 60 días de vencimiento"),
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """
    Reporte exhaustivo de deudores con monto total, facturas asociadas y filtros de antigüedad:
    - 1 día vencido
    - 30 días vencido
    - 45 días vencido
    - 60+ días vencido
    """
    from app.services.collection_service import CollectionService
    overview = CollectionService.get_collections_overview(db, filter_days=filter_days)
    return {
        "filtro_aplicado_dias": filter_days,
        "resumen": overview["resumen"],
        "cantidad_deudores": len(overview["deudores"]),
        "deudores": [
            {
                "cliente_nombre": d["cliente_nombre"],
                "cliente_rut": d["cliente_rut"],
                "tipo_documento": d["tipo_documento"],
                "es_consumidor_final": d["es_consumidor_final"],
                "email": d["email"],
                "phone": d["phone"],
                "address": d["address"],
                "limite_credito": d["limite_credito"],
                "monto_total_deuda": d["monto_total_deuda"],
                "dias_max_vencido": d["dias_max_vencido"],
                "etapa": d["etapa"],
                "facturas_numeros": d["facturas_numeros"],
                "cantidad_facturas": len(d["facturas"]),
                "facturas_detalle": d["facturas"]
            }
            for d in overview["deudores"]
        ]
    }

@router.get("/dashboard/metrics", response_model=Dict[str, Any])
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """Consolida los 6 cuadrantes del Dashboard Ejecutivo de Monitoreo."""
    return MonitoringService.get_dashboard_metrics(db)

@router.post("/dashboard/ai-copilot", response_model=Dict[str, Any])
def ask_monitoring_copilot(
    payload: AICopilotQuerySchema, 
    db: Session = Depends(get_db),
    current_user: UserContext = Depends(get_current_user)
):
    """Consulta al Agente IA Gemini para análisis de métricas y extracción de reportes."""
    return MonitoringService.ask_monitoring_ai(db, payload.prompt)

