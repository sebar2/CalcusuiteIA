from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional, Any
from sqlalchemy import String, Integer, DateTime, Date, Numeric, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.models.entities import Category, Product, CanalComercial, Inventory, Sale, PresupuestoMeta

class UserPreference(Base):
    """
    Tabla de persistencia de preferencias de usuario,
    filtros activos, temas corporativos y presets de visualización.
    """
    __tablename__ = "user_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(100), default="default_user", nullable=False, unique=True, index=True)
    active_theme: Mapped[str] = mapped_column(String(50), default="light_bitrix", nullable=False)
    default_engine_mode: Mapped[str] = mapped_column(String(50), default="auto", nullable=False)
    saved_filters: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True, default=dict)
    visible_columns: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True, default=list)
    last_view: Mapped[str] = mapped_column(String(100), default="control_room", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


class PresupuestoVersion(Base):
    """
    Control presupuestario versionado (V0_Aprobado, Forecast_Q1, Forecast_Q2, etc.)
    """
    __tablename__ = "presupuestos_versiones"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # V0_Aprobado, Forecast_Q1
    periodo: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # 2025-09
    cuenta: Mapped[str] = mapped_column(String(100), nullable=False) # Ventas, COGS, OPEX, etc.
    categoria: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)


class OrdenReposicion(Base):
    """
    Pipeline Kanban de Reposición
    Etapas:
    1. sugerido: 'Sugerido (Stock <= ROP)'
    2. aprobacion: 'Pendiente de Aprobación'
    3. fabricacion: 'En Fabricación'
    4. transito: 'En Tránsito / Aduana'
    5. ingresado: 'Ingresado / Stock Central'
    """
    __tablename__ = "ordenes_reposicion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sku_id: Mapped[str] = mapped_column(ForeignKey("productos.sku"), nullable=False, index=True)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    monto_total: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    proveedor: Mapped[str] = mapped_column(String(150), nullable=False)
    etapa: Mapped[str] = mapped_column(String(50), default="sugerido", nullable=False, index=True)
    responsable: Mapped[str] = mapped_column(String(100), nullable=False)
    fecha_arribo_estimada: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    producto = relationship("Product", foreign_keys=[sku_id])


class AuditLog(Base):
    """
    Registro inmutable (append-only) de auditoría y ciberseguridad financiera.
    Trazabilidad de cambios en precios, aprobaciones de órdenes y ajustes presupuestarios.
    """
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True) # MOVE_STAGE, APPROVE_ORDER, AUTHORIZE_VARIANCE, etc.
    resource: Mapped[str] = mapped_column(String(150), nullable=False) # e.g. ordenes_reposicion/12
    details: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)


class AccionCompromiso(Base):
    """
    Panel de acciones y compromisos presupuestarios derivados de las minutas ejecutivas,
    auditorías IA y análisis FP&A.
    """
    __tablename__ = "acciones_compromisos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    area: Mapped[str] = mapped_column(String(100), default="Operaciones", nullable=False)
    responsable: Mapped[str] = mapped_column(String(100), default="Responsable General", nullable=False)
    fecha_limite: Mapped[date] = mapped_column(Date, nullable=False)
    estado: Mapped[str] = mapped_column(String(50), default="PENDIENTE", nullable=False)
    origen: Mapped[str] = mapped_column(String(100), default="Minuta Ejecutiva", nullable=False)
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.00'), nullable=False)
    urgencia: Mapped[str] = mapped_column(String(20), default="MEDIA", nullable=False) # ALTA, MEDIA, BAJA
    area_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    responsable_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

