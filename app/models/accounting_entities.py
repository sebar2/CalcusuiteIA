from typing import Optional, List, Any
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import String, Integer, Numeric, ForeignKey, Date, DateTime, Boolean, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Invoice(Base):
    """
    Factura Comercial B2B / Comprobante Fiscal Electrónico (CFE DGI Uruguay).
    Representa e-Facturas (111) y e-Tickets (101) con discriminación de tasas de IVA (22%, 10%, 0%).
    """
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    numero_factura: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    serie: Mapped[str] = mapped_column(String(10), default="A", nullable=False)
    tipo_cfe: Mapped[str] = mapped_column(String(50), default="111_E_FACTURA", nullable=False)
    fecha_emision: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    fecha_vencimiento: Mapped[date] = mapped_column(Date, nullable=False)
    
    cliente_nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    cliente_rut: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    cliente_documento: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    tipo_documento_receptor: Mapped[str] = mapped_column(String(20), default="RUT", nullable=False)
    es_consumidor_final: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    orden_compra_ref: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    factura_referencia_id: Mapped[Optional[int]] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    cliente_direccion: Mapped[Optional[str]] = mapped_column(String(250), nullable=True)
    
    moneda: Mapped[str] = mapped_column(String(10), default="UYU", nullable=False)
    tipo_cambio: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("1.0000"), nullable=False)
    
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.00"), nullable=False)
    monto_iva_basico: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.00"), nullable=False)
    monto_iva_minimo: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.00"), nullable=False)
    monto_iva_exento: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.00"), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.00"), nullable=False)
    
    estado: Mapped[str] = mapped_column(String(30), default="EMITIDA", nullable=False, index=True)
    forma_pago: Mapped[str] = mapped_column(String(50), default="CREDITO_30_DIAS", nullable=False)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    items: Mapped[List["InvoiceItem"]] = relationship(back_populates="invoice_rel", cascade="all, delete-orphan", foreign_keys="InvoiceItem.invoice_id")
    factura_referencia_rel: Mapped[Optional["Invoice"]] = relationship(remote_side="Invoice.id")


class InvoiceItem(Base):
    """
    Línea de ítem en Factura B2B con alícuota impositiva explícita.
    """
    __tablename__ = "invoice_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), nullable=False, index=True)
    sku_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    descripcion: Mapped[str] = mapped_column(String(250), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    tasa_iva_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("22.00"), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    monto_iva: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)

    invoice_rel: Mapped["Invoice"] = relationship(back_populates="items")


class Expense(Base):
    """
    Gasto Operativo y Administrativo de la Empresa.
    Vinculado a Centros de Costo y clasificado con alícuotas impositivas para liquidación de IVA Compras.
    """
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fecha: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    proveedor_beneficiario: Mapped[str] = mapped_column(String(200), nullable=False)
    rut_proveedor: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    concepto: Mapped[str] = mapped_column(String(250), nullable=False)
    categoria_gasto: Mapped[str] = mapped_column(String(50), nullable=False, index=True) 
    centro_costo_id: Mapped[Optional[int]] = mapped_column(ForeignKey("centros_costo.id"), nullable=True, index=True)
    
    subtotal_neto: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    tasa_iva_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("22.00"), nullable=False)
    monto_iva: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.00"), nullable=False)
    monto_total: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    
    moneda: Mapped[str] = mapped_column(String(10), default="UYU", nullable=False)
    numero_comprobante: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    forma_pago: Mapped[str] = mapped_column(String(50), default="TRANSFERENCIA", nullable=False)
    estado: Mapped[str] = mapped_column(String(30), default="PAGADO", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    centro_costo_rel: Mapped[Optional["CentroCosto"]] = relationship()


class JournalEntry(Base):
    """
    Asiento Contable en Libro Diario Principal.
    Garantiza el principio universal de partida doble: Sum(Debe) == Sum(Haber).
    """
    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    numero_asiento: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    fecha: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    glosa: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo_operacion: Mapped[str] = mapped_column(String(50), nullable=False)
    referencia_doc: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    total_debe: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    total_haber: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    balanceado: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    lines: Mapped[List["JournalLine"]] = relationship(back_populates="entry_rel", cascade="all, delete-orphan")


class JournalLine(Base):
    """
    Línea individual de imputación contable (Cuenta, Debe, Haber).
    """
    __tablename__ = "journal_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id"), nullable=False, index=True)
    cuenta_codigo: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    cuenta_nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    debe: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.00"), nullable=False)
    haber: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.00"), nullable=False)

    entry_rel: Mapped["JournalEntry"] = relationship(back_populates="lines")


class SystemUser(Base):
    """
    Usuario del Sistema Calcu con Gestión Granular de Permisos y Módulos Restringidos.
    Soporta lista negra de módulos personalizada (restricted_modules) y roles corporativos.
    """
    __tablename__ = "system_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    nombre_completo: Mapped[str] = mapped_column(String(150), nullable=False)
    puesto: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="operaciones", nullable=False)
    restricted_modules: Mapped[Optional[Any]] = mapped_column(JSON, default=list, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class CollectionCase(Base):
    """
    Expediente de Cobranzas y Gestión de Deudores (Kanban 5 Etapas)
    1_NUEVO_DEUDOR (1-29d vencido)
    2_CONTACTADO (30-44d vencido)
    3_ADVERTIDO (45-59d vencido)
    4_COMPLICADO (60-62d vencido - Intimación Legal)
    5_JURIDICO (63d+ vencido - Estudio Jurídico)
    """
    __tablename__ = "collection_cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[Optional[int]] = mapped_column(ForeignKey("clients.id"), nullable=True, index=True)
    cliente_nombre: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    cliente_rut: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    etapa: Mapped[str] = mapped_column(String(50), default="1_NUEVO_DEUDOR", nullable=False, index=True)
    dias_max_vencido: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    monto_total_deuda: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0.00"), nullable=False)
    facturas_ids: Mapped[Optional[Any]] = mapped_column(JSON, default=list, nullable=True)
    ultimo_contacto: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    intimacion_enviada: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    estudio_juridico: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

