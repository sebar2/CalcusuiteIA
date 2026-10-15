import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.domain.models import AuditLog
from app.models.accounting_entities import SystemUser

logger = logging.getLogger(__name__)

# Presets de puestos corporativos con módulos restringidos sugeridos
POSITION_PRESETS = {
    "CEO / Directora General": {
        "role": "controller_admin",
        "restricted_modules": []
    },
    "CFO / Director de Finanzas": {
        "role": "controller_admin",
        "restricted_modules": []
    },
    "Gerente Comercial B2B": {
        "role": "comercial",
        "restricted_modules": ["monitoring", "accounting", "initiatives"]
    },
    "Ejecutivo de Cuentas B2B": {
        "role": "analista_comercial",
        "restricted_modules": ["monitoring", "accounting", "variance", "initiatives", "reports"]
    },
    "Jefe de Depósito & WMS": {
        "role": "operaciones",
        "restricted_modules": ["monitoring", "accounting", "variance", "pricing", "crm"]
    },
    "Supervisor Logístico 3PL": {
        "role": "admin_3pl",
        "restricted_modules": ["monitoring", "accounting", "variance", "crm", "initiatives"]
    },
    "Chofer / Conductor de Flota": {
        "role": "conductor_3pl",
        "restricted_modules": [
            "monitoring", "accounting", "variance", "initiatives", "reports",
            "crm", "pricing", "clients", "suppliers", "control_room", "kanban",
            "stock_trace", "supplier-catalogs", "logistics-finance", "etl"
        ]
    },
    "Auditor de Seguridad ISO 27001": {
        "role": "controller_admin",
        "restricted_modules": ["crm", "pricing"]
    }
}

class MonitoringService:
    @staticmethod
    def get_audit_logs(
        db: Session,
        severidad: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100
    ) -> List[AuditLog]:
        """Recupera el historial de auditoría y trazabilidad en orden cronológico inverso."""
        query = db.query(AuditLog).order_by(desc(AuditLog.timestamp))
        if severidad:
            query = query.filter(AuditLog.severidad == severidad.upper())
        if search:
            like_pat = f"%{search}%"
            query = query.filter(
                (AuditLog.action.ilike(like_pat)) |
                (AuditLog.user_id.ilike(like_pat)) |
                (AuditLog.resource.ilike(like_pat)) |
                (AuditLog.evento_realizado.ilike(like_pat)) |
                (AuditLog.ubicacion.ilike(like_pat))
            )
        return query.limit(limit).all()

    @staticmethod
    def log_activity(
        db: Session,
        user_id: str,
        role: str,
        action: str,
        resource: str,
        evento_realizado: str,
        severidad: str = "INFO",
        ip_address: str = "100.64.0.1",
        ubicacion: str = "Montevideo (Nodo Tailscale Central)",
        details: Optional[Dict[str, Any]] = None
    ) -> AuditLog:
        """Registra un evento append-only en el log de auditoría del sistema."""
        log = AuditLog(
            user_id=user_id,
            role=role,
            action=action,
            resource=resource,
            ip_address=ip_address,
            ubicacion=ubicacion,
            evento_realizado=evento_realizado,
            severidad=severidad,
            details=details or {},
            timestamp=datetime.now(timezone.utc)
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def get_users(db: Session) -> List[SystemUser]:
        """Obtiene la lista de usuarios del sistema con sus permisos y restricciones."""
        users = db.query(SystemUser).order_by(SystemUser.id).all()
        if not users:
            MonitoringService.seed_default_users(db)
            users = db.query(SystemUser).order_by(SystemUser.id).all()
        return users

    @staticmethod
    def create_user(db: Session, data: Dict[str, Any], created_by: str = "controller_admin") -> SystemUser:
        """Crea un nuevo usuario del sistema con su rol y módulos restringidos."""
        username = data.get("username", "").strip()
        email = data.get("email", "").strip()
        nombre = data.get("nombre_completo", "").strip()
        puesto = data.get("puesto", "Operador de Sistema").strip()
        
        # Si no se definieron módulos restringidos manualmente, aplicar preset según puesto
        restricted = data.get("restricted_modules")
        if restricted is None and puesto in POSITION_PRESETS:
            restricted = POSITION_PRESETS[puesto]["restricted_modules"]
            role = data.get("role") or POSITION_PRESETS[puesto]["role"]
        else:
            role = data.get("role", "operaciones")
            restricted = restricted or []

        user = SystemUser(
            username=username,
            email=email,
            nombre_completo=nombre,
            puesto=puesto,
            role=role,
            restricted_modules=restricted,
            activo=data.get("activo", True),
            created_at=datetime.now(timezone.utc)
        )
        db.add(user)
        db.flush()

        # Registrar en auditoría
        MonitoringService.log_activity(
            db,
            user_id=created_by,
            role="controller_admin",
            action="CREAR_USUARIO",
            resource=f"system_users/{user.id}",
            evento_realizado=f"Creación del usuario '{user.username}' ({user.puesto}) con {len(restricted)} módulos restringidos",
            severidad="INFO",
            details={
                "username": user.username,
                "email": user.email,
                "puesto": user.puesto,
                "role": user.role,
                "restricted_modules": restricted
            }
        )
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def update_user_permissions(db: Session, user_id: int, data: Dict[str, Any], updated_by: str = "controller_admin") -> Optional[SystemUser]:
        """Modifica los permisos, puesto o módulos restringidos de un usuario."""
        user = db.query(SystemUser).filter(SystemUser.id == user_id).first()
        if not user:
            return None

        old_restricted = list(user.restricted_modules or [])
        if "restricted_modules" in data:
            user.restricted_modules = data["restricted_modules"]
        if "puesto" in data:
            user.puesto = data["puesto"]
        if "role" in data:
            user.role = data["role"]
        if "activo" in data:
            user.activo = data["activo"]

        # Auditoría de cambio de permisos
        MonitoringService.log_activity(
            db,
            user_id=updated_by,
            role="controller_admin",
            action="ACTUALIZAR_PERMISOS",
            resource=f"system_users/{user.id}",
            evento_realizado=f"Actualización de permisos y módulos de '{user.username}'",
            severidad="WARNING",
            details={
                "username": user.username,
                "puesto": user.puesto,
                "módulos_anteriores": old_restricted,
                "módulos_nuevos": user.restricted_modules
            }
        )
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def seed_default_users(db: Session):
        """Siembra la plantilla inicial de usuarios corporativos con sus roles y restricciones."""
        initial_users = [
            ("valentina.rossi", "vrossi@calcu.com.uy", "Lic. Valentina Rossi", "CEO / Directora General", "controller_admin", []),
            ("matias.fernandez", "mfernandez@calcu.com.uy", "Cr. Matías Fernández", "CFO / Director de Finanzas", "controller_admin", []),
            ("lucia.benitez", "lbenitez@calcu.com.uy", "Ing. Lucía Benítez", "Gerente Comercial B2B", "comercial", ["monitoring", "accounting"]),
            ("rodrigo.mendez", "rmendez@calcu.com.uy", "Rodrigo Méndez", "Jefe de Depósito & WMS", "operaciones", ["monitoring", "accounting", "variance", "pricing"]),
            ("carlos.techera", "ctechera@calcu.com.uy", "Carlos Techera", "Supervisor Logístico 3PL", "admin_3pl", ["monitoring", "accounting", "variance", "crm"]),
            ("gabriel.silva", "gsilva@calcu.com.uy", "Ing. Gabriel Silva", "Auditor de Seguridad ISO 27001", "controller_admin", []),
        ]

        for u, em, nom, pst, rol, rest in initial_users:
            exists = db.query(SystemUser).filter(SystemUser.username == u).first()
            if not exists:
                db.add(SystemUser(
                    username=u,
                    email=em,
                    nombre_completo=nom,
                    puesto=pst,
                    role=rol,
                    restricted_modules=rest,
                    activo=True,
                    created_at=datetime.now(timezone.utc)
                ))

        # Si no hay logs de auditoría, sembrar eventos de inicio
        logs_count = db.query(func.count(AuditLog.id)).scalar() or 0
        if logs_count == 0:
            sample_logs = [
                ("sistema", "seguridad", "AUDITORIA_PERIMETRAL", "firewall/tailscale", "Escaneo perimetral ISO 27001 completado: Puertos 8000 y 5173 validados", "INFO", "100.64.0.1", "Montevideo (Nodo Central Tailscale)"),
                ("matias.fernandez", "controller_admin", "APROBAR_PRESUPUESTO", "presupuestos/2026-07", "Aprobación oficial de metas presupuestarias M7 - Julio 2026 (Demo)", "INFO", "100.64.0.2", "Montevideo (Nodo Tailscale Central)"),
                ("lucia.benitez", "comercial", "CREAR_COTIZACION", "deals/deal-001", "Envío de cotización B2B licitación luminarias intendencia por $18,500.00", "INFO", "100.64.0.3", "Montevideo (Nodo Tailscale Comercial)"),
                ("rodrigo.mendez", "operaciones", "AJUSTE_STOCK_WMS", "warehouses/DEP-SALTO", "Recepción y control de lote de luminarias en Depósito Salto", "INFO", "100.64.0.4", "Salto (Depósito Regional Tailscale)"),
                ("carlos.techera", "admin_3pl", "ASIGNAR_DESPACHO", "logistics_orders/ORD-3PL-101", "Asignación de ruta urbana y chofer para entrega en Shopping Montevideo", "INFO", "100.64.0.5", "Montevideo (Centro Logístico 3PL)"),
            ]
            for u, r, a, res, ev, sev, ip, ub in sample_logs:
                db.add(AuditLog(
                    user_id=u,
                    role=r,
                    action=a,
                    resource=res,
                    evento_realizado=ev,
                    severidad=sev,
                    ip_address=ip,
                    ubicacion=ub,
                    details={"seed": True},
                    timestamp=datetime.now(timezone.utc)
                ))

        db.commit()
