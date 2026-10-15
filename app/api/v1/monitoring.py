from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database.session import get_db
from app.services.monitoring_service import MonitoringService, POSITION_PRESETS

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
    restricted_modules: Optional[List[str]] = None
    activo: bool = True

class UserUpdatePermissionsSchema(BaseModel):
    puesto: Optional[str] = None
    role: Optional[str] = None
    restricted_modules: Optional[List[str]] = None
    activo: Optional[bool] = None

@router.get("/audit-logs", response_model=List[Dict[str, Any]])
def list_audit_logs(
    severidad: Optional[str] = Query(None, description="INFO, WARNING, CRITICAL"),
    search: Optional[str] = Query(None, description="Búsqueda por usuario, evento o ubicación"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Obtiene el registro cronológico de actividad, ubicación y eventos de los usuarios."""
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
def record_audit_log(payload: AuditLogCreateSchema, db: Session = Depends(get_db)):
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
def list_users(db: Session = Depends(get_db)):
    """Lista todos los usuarios del sistema con sus roles y lista negra de módulos."""
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
def get_position_presets():
    """Retorna los presets predeterminados de puestos y sus módulos restringidos sugeridos."""
    return POSITION_PRESETS

@router.post("/users", response_model=Dict[str, Any])
def create_system_user(payload: UserCreateSchema, db: Session = Depends(get_db)):
    """Crea un nuevo usuario con permisos según su puesto o personalizados."""
    try:
        user = MonitoringService.create_user(db, payload.model_dump())
        return {
            "success": True,
            "message": f"Usuario '{user.username}' creado exitosamente",
            "user_id": user.id,
            "restricted_modules": user.restricted_modules
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al crear usuario: {str(e)}")

@router.put("/users/{user_id}/permissions", response_model=Dict[str, Any])
def update_user_permissions(user_id: int, payload: UserUpdatePermissionsSchema, db: Session = Depends(get_db)):
    """Actualiza los módulos restringidos o el puesto de un usuario."""
    user = MonitoringService.update_user_permissions(db, user_id, payload.model_dump(exclude_unset=True))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {
        "success": True,
        "message": f"Permisos de '{user.username}' actualizados",
        "restricted_modules": user.restricted_modules
    }

@router.delete("/users/{user_id}", response_model=Dict[str, Any])
def toggle_user_active(user_id: int, db: Session = Depends(get_db)):
    """Desactiva o activa un usuario en el sistema."""
    from app.models.accounting_entities import SystemUser
    user = db.query(SystemUser).filter(SystemUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.activo = not user.activo
    db.commit()
    return {"success": True, "activo": user.activo, "message": f"Usuario '{user.username}' {'activado' if user.activo else 'desactivado'}"}
