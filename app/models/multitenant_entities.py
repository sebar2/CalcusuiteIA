from typing import Optional, Any
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import String, Integer, Numeric, ForeignKey, DateTime, Boolean, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class TenantAccount(Base):
    """
    Cuenta Corporativa Multi-Tenant (SaaS Control Plane).
    Gobierna el aislamiento de base de datos/esquema PostgreSQL, el estado de la licencia
    de 14 días de prueba (por defecto ENTERPRISE_3PL) y el simulador de planes.
    """
    __tablename__ = "tenant_accounts"

    id: Mapped[str] = mapped_column(String(60), primary_key=True)  # e.g. tenant_calcu_corp
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False, index=True)
    nombre_empresa: Mapped[str] = mapped_column(String(150), nullable=False)
    rut: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    schema_name: Mapped[str] = mapped_column(String(80), nullable=False)  # PostgreSQL schema / Isolated DB name
    db_strategy: Mapped[str] = mapped_column(String(30), default="POSTGRES_SCHEMA", nullable=False)
    
    # Licenciamiento SaaS: 'STARTER', 'PRO', 'ENTERPRISE_3PL'
    license_tier: Mapped[str] = mapped_column(String(30), default="ENTERPRISE_3PL", nullable=False)
    # Permite al controller_admin cambiar de licencia durante los 14 días de prueba para explorar cada plan
    simulated_tier: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    
    # Estados: 'TRIAL_14_DAYS', 'ACTIVE_PAID', 'SUSPENDED', 'EXPIRED'
    subscription_status: Mapped[str] = mapped_column(String(30), default="TRIAL_14_DAYS", nullable=False)
    trial_starts_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    trial_ends_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc) + timedelta(days=14), nullable=False
    )
    max_users: Mapped[int] = mapped_column(Integer, default=999, nullable=False)
    admin_email: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    admin_username: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    mrr_usd: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.00"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class IntegrationConfig(Base):
    """
    Bóveda Segura de Integraciones Multicanal (ISO 27001 — Prevención CWE-312 / CWE-532).
    Almacena credenciales cifradas con AES-CTR + HMAC-SHA256 para:
    - GOOGLE_ADS
    - META_ADS
    - WHATSAPP
    - EMAIL
    - WEB_FORM
    """
    __tablename__ = "integration_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(60), default="tenant_calcu_corp", nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Estados estrictos: 'DISCONNECTED', 'PENDING_CREDENTIALS', 'CONNECTED', 'AUTH_ERROR'
    status: Mapped[str] = mapped_column(String(40), default="PENDING_CREDENTIALS", nullable=False)
    encrypted_credentials: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    masked_summary: Mapped[Optional[Any]] = mapped_column(JSON, default=dict, nullable=True)
    webhook_token: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    auto_reply_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    assigned_seller_strategy: Mapped[str] = mapped_column(String(30), default="ROUND_ROBIN", nullable=False)
    default_seller: Mapped[str] = mapped_column(String(100), default="Martín Gómez", nullable=False)
    cost_per_lead_usd: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.00"), nullable=False)
    leads_captured_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_tested_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class OmnichannelMessage(Base):
    """
    Historial Unificado de Mensajería Omnicanal vinculado a cada Trato / Prospecto del CRM.
    Soporta canales: WHATSAPP, META_ADS, GOOGLE_ADS, EMAIL, WEB_FORM.
    """
    __tablename__ = "omnichannel_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(60), default="tenant_calcu_corp", nullable=False, index=True)
    deal_id: Mapped[str] = mapped_column(ForeignKey("commercial_deals.id", ondelete="CASCADE"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(15), default="INBOUND", nullable=False)  # INBOUND | OUTBOUND
    sender_name: Mapped[str] = mapped_column(String(150), nullable=False)
    sender_address: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    # Estados: 'RECEIVED', 'SENT', 'DELIVERED', 'READ', 'FAILED_NO_CREDENTIALS'
    delivery_status: Mapped[str] = mapped_column(String(40), default="RECEIVED", nullable=False)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    metadata_json: Mapped[Optional[Any]] = mapped_column(JSON, default=dict, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
