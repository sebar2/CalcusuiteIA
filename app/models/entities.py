from typing import Optional, List, Dict, Any
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import String, Integer, Numeric, ForeignKey, Date, DateTime, CheckConstraint, Boolean, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Category(Base):
    """
    Entidad Categoría (1NF, 2NF, 3NF, BCNF)
    """
    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    margen_target_pct: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.30'), nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    productos: Mapped[List["Product"]] = relationship(back_populates="categoria_rel")
    presupuestos_metas: Mapped[List["PresupuestoMeta"]] = relationship(back_populates="categoria_rel")


class Product(Base):
    """
    Entidad Producto (Normalizado en BCNF)
    Sin campos derivados; cada determinante es clave candidata.
    """
    __tablename__ = "productos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    categoria_id: Mapped[int] = mapped_column(ForeignKey("categorias.id"), nullable=False, index=True)
    costo_base: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    precio_lista: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    doh_seguridad: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    categoria_rel: Mapped["Category"] = relationship(back_populates="productos")
    inventario: Mapped[Optional["Inventory"]] = relationship(back_populates="producto", uselist=False, cascade="all, delete-orphan")
    ventas: Mapped[List["Sale"]] = relationship(back_populates="producto")
    presupuestos_metas: Mapped[List["PresupuestoMeta"]] = relationship(back_populates="producto")

    __table_args__ = (
        CheckConstraint('costo_base >= 0', name='chk_prod_costo_base'),
        CheckConstraint('precio_lista >= 0', name='chk_prod_precio_lista'),
        CheckConstraint('doh_seguridad >= 0', name='chk_prod_doh_seg'),
    )

    # Propiedades de compatibilidad para capas de servicio y controladores existentes
    @property
    def category_id(self) -> int:
        return self.categoria_id

    @category_id.setter
    def category_id(self, val: int):
        self.categoria_id = val

    @property
    def costo_unitario(self) -> Decimal:
        return self.costo_base

    @costo_unitario.setter
    def costo_unitario(self, val: Decimal):
        self.costo_base = val

    @property
    def precio_venta(self) -> Decimal:
        return self.precio_lista

    @precio_venta.setter
    def precio_venta(self, val: Decimal):
        self.precio_lista = val

    @property
    def categoria(self) -> str:
        return self.categoria_rel.nombre if self.categoria_rel else ""


class CanalComercial(Base):
    """
    Entidad Canales Comerciales (BCNF)
    """
    __tablename__ = "canales_comerciales"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    comision_pct: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.00'), nullable=False)
    flete_estimado: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.00'), nullable=False)

    ventas: Mapped[List["Sale"]] = relationship(back_populates="canal_rel")


class Inventory(Base):
    """
    Entidad Inventario con depósitos centrales, tránsito marítimo y aduana
    """
    __tablename__ = "inventarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"), unique=True, nullable=False)

    deposito_central: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    transito_maritimo: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    aduana: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    stock_seguridad: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lead_time_dias: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0'), nullable=False)
    demanda_diaria_promedio: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0'), nullable=False)

    producto: Mapped["Product"] = relationship(back_populates="inventario")

    __table_args__ = (
        CheckConstraint('deposito_central >= 0', name='chk_inv_dep'),
        CheckConstraint('transito_maritimo >= 0', name='chk_inv_trans'),
        CheckConstraint('aduana >= 0', name='chk_inv_adu'),
        CheckConstraint('stock_seguridad >= 0', name='chk_inv_sec'),
        CheckConstraint('lead_time_dias >= 0', name='chk_inv_lt'),
        CheckConstraint('demanda_diaria_promedio >= 0', name='chk_inv_dem'),
    )

    @property
    def product_sku(self) -> str:
        return self.producto.sku if self.producto else ""

    @property
    def stock_actual(self) -> int:
        """Suma total de inventario disponible en depósitos, tránsito marítimo y aduana"""
        return self.deposito_central + self.transito_maritimo + self.aduana


class Sale(Base):
    """
    Entidad Transacciones de Ventas (Event Fact Table en BCNF)
    Elimina cualquier redundancia o atributo dependiente funcionalmente de la dimensión producto.
    """
    __tablename__ = "transacciones_ventas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transaction_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    fecha: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    periodo: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # ej. '2025-09', '2026-Q1'
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"), nullable=False, index=True)
    canal_id: Mapped[Optional[int]] = mapped_column(ForeignKey("canales_comerciales.id"), nullable=True, index=True)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    precio_unitario_real: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    costo_unitario_real: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)

    producto: Mapped["Product"] = relationship(back_populates="ventas")
    canal_rel: Mapped[Optional["CanalComercial"]] = relationship(back_populates="ventas")

    __table_args__ = (
        CheckConstraint('cantidad > 0', name='chk_sale_cant'),
        CheckConstraint('precio_unitario_real >= 0', name='chk_sale_precio_real'),
        CheckConstraint('costo_unitario_real >= 0', name='chk_sale_costo_real'),
    )

    @property
    def product_sku(self) -> str:
        return self.producto.sku if self.producto else ""

    @property
    def precio_unitario(self) -> Decimal:
        return self.precio_unitario_real

    @property
    def costo_unitario(self) -> Decimal:
        return self.costo_unitario_real

    @property
    def comision_pct(self) -> Decimal:
        return self.canal_rel.comision_pct if self.canal_rel else Decimal('0.00')

    @property
    def flete_unitario(self) -> Decimal:
        return self.canal_rel.flete_estimado if self.canal_rel else Decimal('0.00')


class PresupuestoMeta(Base):
    """
    Entidad Presupuestos Metas (ESTRICTO 3NF / BCNF)
    PROHIBIDO almacenar monto_real, desvio_absoluto, desvio_pct o semaforo.
    Todos los desvíos y ratios de ejecución se calculan estrictamente en runtime
    cruzando presupuestos_metas con SUM(transacciones_ventas.cantidad * precio_unitario_real).
    """
    __tablename__ = "presupuestos_metas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[str] = mapped_column(String(50), default="V0", nullable=False, index=True)
    periodo: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    categoria_id: Mapped[int] = mapped_column(ForeignKey("categorias.id"), nullable=False, index=True)
    producto_id: Mapped[Optional[int]] = mapped_column(ForeignKey("productos.id"), nullable=True, index=True)
    monto_presupuestado: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    unidades_presupuestadas: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    categoria_rel: Mapped["Category"] = relationship(back_populates="presupuestos_metas")
    producto: Mapped[Optional["Product"]] = relationship(back_populates="presupuestos_metas")

    __table_args__ = (
        CheckConstraint('monto_presupuestado >= 0', name='chk_meta_monto_presup'),
        CheckConstraint('unidades_presupuestadas >= 0', name='chk_meta_unid_presup'),
    )

    @property
    def categoria(self) -> str:
        return self.categoria_rel.nombre if self.categoria_rel else ""

    @property
    def tipo(self) -> str:
        return "VENTAS"

    @property
    def monto_real(self) -> Decimal:
        return self.monto_presupuestado


# Alias para retrocompatibilidad con interfaces previas que importan Budget
Budget = PresupuestoMeta


class OrdenCompra(Base):
    """
    Cabecera Normalizada de Órdenes de Compra (BCNF)
    """
    __tablename__ = "ordenes_compra"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    numero_po: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    proveedor: Mapped[str] = mapped_column(String(150), nullable=False)
    etapa: Mapped[str] = mapped_column(String(50), default="sugerido", nullable=False, index=True)
    responsable: Mapped[str] = mapped_column(String(100), nullable=False)
    fecha_emision: Mapped[date] = mapped_column(Date, default=lambda: datetime.now(timezone.utc).date(), nullable=False)
    fecha_arribo_estimada: Mapped[date] = mapped_column(Date, nullable=False)
    tipo_orden: Mapped[str] = mapped_column(String(30), default="IMPORTACION", nullable=False) # IMPORTACION, LOCAL_REVENTA
    fecha_disponible: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    monto_total: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.00'), nullable=False)

    detalles: Mapped[List["OrdenCompraDetalle"]] = relationship(back_populates="orden", cascade="all, delete-orphan")


class OrdenCompraDetalle(Base):
    """
    Detalle Normalizado de Órdenes de Compra (BCNF)
    """
    __tablename__ = "ordenes_compra_detalles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    orden_id: Mapped[int] = mapped_column(ForeignKey("ordenes_compra.id"), nullable=False, index=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"), nullable=False, index=True)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    costo_unitario_pactado: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)

    orden: Mapped["OrdenCompra"] = relationship(back_populates="detalles")
    producto: Mapped["Product"] = relationship()

    __table_args__ = (
        CheckConstraint('cantidad > 0', name='chk_det_cant'),
        CheckConstraint('costo_unitario_pactado >= 0', name='chk_det_costo'),
    )


class Area(Base):
    """
    Entidad Área / Sector Organizacional (BCNF)
    Representa las divisiones corporativas (Operaciones, Finanzas, Comercial, etc.)
    """
    __tablename__ = "areas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    usuarios: Mapped[List["ResponsableUser"]] = relationship(back_populates="area", cascade="all, delete-orphan")
    centros_costo: Mapped[List["CentroCosto"]] = relationship(back_populates="area")


class ResponsableUser(Base):
    """
    Entidad Usuario / Responsable de Gasto (BCNF)
    Persona asignada a un área con cargo y correo corporativo.
    """
    __tablename__ = "responsables_organizacion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    cargo: Mapped[str] = mapped_column(String(100), nullable=False)
    area_id: Mapped[Optional[int]] = mapped_column(ForeignKey("areas.id"), nullable=True, index=True)

    area: Mapped[Optional["Area"]] = relationship(back_populates="usuarios")
    centros_costo: Mapped[List["CentroCosto"]] = relationship(back_populates="responsable_user")


class CentroCosto(Base):
    """
    Entidad Centro de Costo (BCNF)
    Representa áreas o departamentos de gasto operativo (Marketing, Logística, IT, etc.)
    """
    __tablename__ = "centros_costo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    responsable: Mapped[str] = mapped_column(String(100), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    area_id: Mapped[Optional[int]] = mapped_column(ForeignKey("areas.id"), nullable=True, index=True)
    responsable_id: Mapped[Optional[int]] = mapped_column(ForeignKey("responsables_organizacion.id"), nullable=True, index=True)
    alerta_85_activa: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    alerta_100_activa: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_notificacion: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)

    area: Mapped[Optional["Area"]] = relationship(back_populates="centros_costo")
    responsable_user: Mapped[Optional["ResponsableUser"]] = relationship(back_populates="centros_costo")
    presupuestos: Mapped[List["PresupuestoCentroCosto"]] = relationship(back_populates="centro_costo", cascade="all, delete-orphan")


class PresupuestoCentroCosto(Base):
    """
    Partidas de Gasto Operativo (OPEX) por Centro de Costo y Período
    """
    __tablename__ = "presupuestos_centros_costo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    periodo: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # ej. '2025-09', '2026-Q1'
    centro_costo_id: Mapped[int] = mapped_column(ForeignKey("centros_costo.id"), nullable=False, index=True)
    concepto_opex: Mapped[str] = mapped_column(String(150), nullable=False)
    monto_presupuestado: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.00'), nullable=False)
    monto_real: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.00'), nullable=False)

    centro_costo: Mapped["CentroCosto"] = relationship(back_populates="presupuestos")

    __table_args__ = (
        CheckConstraint('monto_presupuestado >= 0', name='chk_pcc_monto_presup'),
        CheckConstraint('monto_real >= 0', name='chk_pcc_monto_real'),
    )


class Tender(Base):
    """
    Licitaciones y Proyectos B2B (Fusión Luminar -> Calcu)
    """
    __tablename__ = "tenders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # UUIDv4
    proyecto_nombre: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    cliente_licitacion: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    nicho: Mapped[str] = mapped_column(String(50), default="industria", nullable=False)
    fecha_apertura: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    plazo_entrega_dias: Mapped[int] = mapped_column(Integer, nullable=False)
    moneda: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    tipo_cambio_brou: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal('40.40'), nullable=False)
    estado: Mapped[str] = mapped_column(String(30), default="BORRADOR", nullable=False)  # BORRADOR, EVALUADO, ADJUDICADO
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dictamen_david: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dictamen_aristoteles: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    items: Mapped[List["TenderItem"]] = relationship(back_populates="tender", cascade="all, delete-orphan")


class TenderItem(Base):
    """
    Partidas de Luminarias / Productos en Licitación B2B
    """
    __tablename__ = "tender_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tender_id: Mapped[str] = mapped_column(ForeignKey("tenders.id"), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(ForeignKey("productos.sku"), nullable=False, index=True)
    cantidad_solicitada: Mapped[int] = mapped_column(Integer, nullable=False)
    costo_unitario_historico: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), nullable=True)
    precio_unitario_ofertado: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    margen_estimado: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    viabilidad_logistica: Mapped[str] = mapped_column(String(50), default="VIABLE_STOCK_INMEDIATO", nullable=False)
    unidades_faltantes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    dias_retraso_estimado: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    tender: Mapped["Tender"] = relationship(back_populates="items")
    producto_rel: Mapped["Product"] = relationship(foreign_keys=[sku])


class CommercialDeal(Base):
    """
    Trato Comercial en Pipeline B2B (CRM)
    """
    __tablename__ = "commercial_deals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # UUIDv4
    proyecto_nombre: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    cliente: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    rut: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    vendedor: Mapped[str] = mapped_column(String(100), default="Martín Gómez", nullable=False)
    monto_total: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.00'), nullable=False)
    moneda: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    etapa: Mapped[str] = mapped_column(String(30), default="prospeccion", nullable=False, index=True)
    # Etapas válidas: 'prospeccion', 'cotizacion', 'propuesta_enviada', 'negociacion', 'ganada', 'perdida'
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    canal_origen: Mapped[Optional[str]] = mapped_column(String(50), default="MANUAL", nullable=True, index=True)
    utm_source: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    utm_medium: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    utm_campaign: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    external_lead_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    costo_adquisicion_estimado: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), default=Decimal('0.00'), nullable=True)
    ai_score: Mapped[Optional[int]] = mapped_column(Integer, default=75, nullable=True)
    ai_classification: Mapped[Optional[str]] = mapped_column(String(50), default="WARM", nullable=True)
    client_id: Mapped[Optional[int]] = mapped_column(ForeignKey("clients.id"), nullable=True, index=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    items: Mapped[List["CommercialDealItem"]] = relationship(back_populates="deal", cascade="all, delete-orphan")
    client_rel: Mapped[Optional["Client"]] = relationship("Client", foreign_keys=[client_id])



class CommercialDealItem(Base):
    """
    Ítems o SKUs vinculados a un Trato Comercial
    """
    __tablename__ = "commercial_deal_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    deal_id: Mapped[str] = mapped_column(ForeignKey("commercial_deals.id"), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(ForeignKey("productos.sku"), nullable=False, index=True)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.00'), nullable=False)

    deal: Mapped["CommercialDeal"] = relationship(back_populates="items")
    producto_rel: Mapped["Product"] = relationship(foreign_keys=[sku])


class SalesOrder(Base):
    """
    Orden de Venta Formal (OV) emitida desde el CRM
    """
    __tablename__ = "sales_orders"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # OV-2026-XXXX
    deal_id: Mapped[str] = mapped_column(ForeignKey("commercial_deals.id"), nullable=False, index=True)
    numero_ov: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    cliente: Mapped[str] = mapped_column(String(150), nullable=False)
    rut: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    vendedor: Mapped[str] = mapped_column(String(100), default="Martín Gómez", nullable=False)
    warehouse_id: Mapped[str] = mapped_column(String(50), default="DEP-CENTRAL-MVD", nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    iva_monto: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)  # 22% IVA
    total: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    moneda: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    tipo_cambio: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4), nullable=True)
    estado: Mapped[str] = mapped_column(String(30), default="EMITIDA", nullable=False)  # EMITIDA, EN_DESPACHO, CUMPLIDA
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    fecha_emision: Mapped[date] = mapped_column(Date, default=lambda: datetime.now(timezone.utc).date(), nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    deal: Mapped["CommercialDeal"] = relationship()
    items: Mapped[List["SalesOrderItem"]] = relationship(back_populates="sales_order", cascade="all, delete-orphan")


class SalesOrderItem(Base):
    """
    Partidas detalladas de una Orden de Venta Formal
    """
    __tablename__ = "sales_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sales_order_id: Mapped[str] = mapped_column(ForeignKey("sales_orders.id"), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(ForeignKey("productos.sku"), nullable=False, index=True)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)

    sales_order: Mapped["SalesOrder"] = relationship(back_populates="items")
    producto_rel: Mapped["Product"] = relationship(foreign_keys=[sku])


class StockLocationBatch(Base):
    """
    Lote / Bulto de Inventario en Trazabilidad Multi-Ubicación y Tránsito
    Estadios:
      - 'fabrica_origen': Producción / Despacho en origen (ej. China/Alemania)
      - 'transito_maritimo': En buque mercante o puerto aduanero con cuenta regresiva ETA
      - 'deposito_central': Montevideo (Stock físico disponible)
      - 'showrooms_locales': Salones de venta / exhibición / reservas
    """
    __tablename__ = "stock_location_batches"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # Código de lote ej: 'LOT-2026-001'
    sku: Mapped[str] = mapped_column(ForeignKey("productos.sku"), nullable=False, index=True)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False)
    ubicacion: Mapped[str] = mapped_column(String(50), default="transito_maritimo", nullable=False, index=True)
    pais_origen: Mapped[str] = mapped_column(String(10), default="CN", nullable=False) # CN, DE, UY, etc.
    buque_o_tracking: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fecha_despacho: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_eta: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_terminado: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    sku_fabrica: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    lote_fabrica: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    supplier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("suppliers.id"), nullable=True, index=True)
    warehouse_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    estado: Mapped[str] = mapped_column(String(30), default="EN_TRANSITO", nullable=False) # EN_PRODUCCION, EN_TRANSITO, DISPONIBLE, TRANSFERIDO
    estado_aprobacion: Mapped[str] = mapped_column(String(30), default="APROBADO", nullable=False) # APROBADO, PENDIENTE_APROBACION, RECHAZADO
    costo_compra: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), nullable=True)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    producto_rel: Mapped["Product"] = relationship(foreign_keys=[sku])
    supplier_rel: Mapped[Optional["Supplier"]] = relationship(foreign_keys=[supplier_id])


class Warehouse(Base):
    """
    Entidad Depósito / Almacén / Ubicación Logística
    Tipos: 'CENTRAL', 'SUCURSAL', 'TRANSITO', 'FABRICA', 'INTERNACIONAL', 'URUGUAY'
    """
    __tablename__ = "warehouses"

    id: Mapped[str] = mapped_column(String(50), primary_key=True) # ej. 'dep-central', 'loc-pocitos'
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[str] = mapped_column(String(30), default="SUCURSAL", nullable=False)
    module_scope: Mapped[str] = mapped_column(String(30), default="SUPPLY_CHAIN", nullable=False, index=True) # '3PL' o 'SUPPLY_CHAIN'
    ubicacion: Mapped[str] = mapped_column(String(150), nullable=False)
    pais: Mapped[Optional[str]] = mapped_column(String(100), default="Uruguay", nullable=True)
    capacidad_unidades: Mapped[int] = mapped_column(Integer, default=10000, nullable=False)
    superficie_m2: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('1200.0000'), nullable=False)
    volumen_max_m3: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('7200.0000'), nullable=False)
    capacidad_peso_kg: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('500000.0000'), nullable=False)
    altura_max_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('8.5000'), nullable=False)
    # Geometría Paramétrica Real del Galpón / Nodo
    width_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('50.0000'), nullable=False)
    length_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('100.0000'), nullable=False)
    clear_height_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('12.0000'), nullable=False)

    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    slots: Mapped[List["WarehouseSlot"]] = relationship(back_populates="warehouse_rel", cascade="all, delete-orphan")
    racks: Mapped[List["WarehouseRack"]] = relationship(back_populates="warehouse_rel", cascade="all, delete-orphan")


class WarehouseRack(Base):
    """
    Entidad Estructura / Cuerpo de Rack (Gemelo Digital Universal 3D)
    Almacena las coordenadas reales de planta (pos_x_m, pos_z_m, rotation_y_deg)
    y dimensiones paramétricas del cuerpo completo en PostgreSQL 16 con Numeric(14, 4).
    """
    __tablename__ = "warehouse_racks"

    id: Mapped[str] = mapped_column(String(100), primary_key=True) # ej. 'WH-001:CUERPO-A'
    warehouse_id: Mapped[str] = mapped_column(String(50), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    rack_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # ej. 'Cuerpo A', 'RACK-001'
    zone_code: Mapped[str] = mapped_column(String(50), default="GENERAL", nullable=False)
    pos_x_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.0000'), nullable=False)
    pos_z_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.0000'), nullable=False)
    rotation_y_deg: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.0000'), nullable=False)
    rack_width_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('2.4000'), nullable=False)
    rack_height_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('6.0000'), nullable=False)
    rack_depth_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('1.2000'), nullable=False)
    levels_count: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    bays_count: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    max_weight_kg: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('3000.0000'), nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    warehouse_rel: Mapped["Warehouse"] = relationship(back_populates="racks")


class WarehouseSlot(Base):
    """
    Entidad Posición 3D / Slot de Depósito (Gemelo Digital Universal)
    Soporta racks en tierra (ej. F-01-01-01) y contenedores marítimos (Buque-Bahía-Fila-Nivel)
    Geometría Paramétrica Real: Racks, Cajas y Vínculo con Catálogo Real
    """
    __tablename__ = "warehouse_slots"

    id: Mapped[str] = mapped_column(String(100), primary_key=True) # ej. 'DEP-CENTRAL-MVD:F-01-01-01'
    warehouse_id: Mapped[str] = mapped_column(String(50), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)
    module_scope: Mapped[str] = mapped_column(String(30), default="SUPPLY_CHAIN", nullable=False, index=True) # '3PL' o 'SUPPLY_CHAIN'
    slot_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # ej. 'F-01-01-01' o 'VESSEL-BAY01-R02-T03'
    cuerpo: Mapped[str] = mapped_column(String(30), nullable=False, index=True) # 'A', 'B', 'F', 'BAY-01'
    rack: Mapped[str] = mapped_column(String(30), nullable=False) # '01', '02', 'ROW-01'
    nivel: Mapped[int] = mapped_column(Integer, nullable=False) # 1, 2, 3, 4
    posicion: Mapped[int] = mapped_column(Integer, nullable=False) # 1, 2, 3, 4
    estado: Mapped[str] = mapped_column(String(30), default="VACIA", nullable=False, index=True) # 'VACIA', 'OCUPADA', 'BLOQUEADA', 'RESERVADA'
    sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    lote: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    descripcion: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.0000'), nullable=False)
    peso_actual_kg: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.0000'), nullable=False)
    peso_max_kg: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('1000.0000'), nullable=False)
    volumen_actual_m3: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.0000'), nullable=False)
    volumen_max_m3: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('1.8000'), nullable=False)
    altura_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('1.6000'), nullable=False)
    valor_estimado: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.0000'), nullable=False)
    pallets_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cajas_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 1. Geometría Paramétrica de Estantería / Rack
    rack_width_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('2.4000'), nullable=False)
    rack_height_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('6.0000'), nullable=False)
    rack_depth_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('1.2000'), nullable=False)
    levels_count: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    max_rack_weight_kg: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('3000.0000'), nullable=False)
    position_x: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), nullable=True)
    position_y: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), nullable=True)
    position_z: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), nullable=True)
    pos_x_m: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), nullable=True)
    pos_z_m: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 4), nullable=True)
    rotation_y_deg: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.0000'), nullable=False)
    bays_count: Mapped[int] = mapped_column(Integer, default=2, nullable=False)

    # 2. Medidas Reales de Caja / Bulto y Vínculo con Catálogo Real
    box_width_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.4000'), nullable=False)
    box_height_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.3000'), nullable=False)
    box_length_m: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.4000'), nullable=False)
    unit_weight_kg: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('5.0000'), nullable=False)
    units_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    real_product_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("productos.id", ondelete="SET NULL"), nullable=True, index=True)

    # Atributos de nodo marítimo (Alta Mar)
    tipo_contenedor: Mapped[Optional[str]] = mapped_column(String(30), nullable=True) # '40HQ', '20ST', 'LCL'
    eta_arribo: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    costo_landed: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.0000'), nullable=False)

    # Control de Calidad y Riesgos Físicos
    desvios: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # 'EXCESO_PESO', 'EXCESO_VOLUMEN', 'EXCESO_ALTURA'
    material_retenido: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    material_calidad: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fecha_vencimiento: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Sincronización Kanban ROP/DOH
    rop_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, index=True) # 'CRITICO_ROP', 'ALERTA_DOH', 'OPTIMO'

    # Doble Candado SICE / B2B (Reserva Física 3D) & Trazabilidad QR
    reservation_type: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, index=True) # None, 'SOFT_RESERVED', 'HARD_RESERVED'
    reservation_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True) # ID SICE o Cotización B2B
    reserved_organism: Mapped[Optional[str]] = mapped_column(String(200), nullable=True) # Organismo estatal o cliente
    reserved_by_user: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # Usuario reservante
    reserved_until: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    qr_signed_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True) # HMAC-SHA256 Token de Recepción

    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=True)

    warehouse_rel: Mapped["Warehouse"] = relationship(back_populates="slots")
    product_rel: Mapped[Optional["Product"]] = relationship(foreign_keys=[real_product_id])


class Client(Base):
    """
    Directorio B2B de Clientes y Empresas Contratistas
    """
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    razon_social: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    nombre_fantasia: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    rut: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    documento: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    tipo_documento: Mapped[str] = mapped_column(String(20), default="RUT", nullable=False)
    es_consumidor_final: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    limite_credito: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('200.00'), nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)


class Company(Base):
    """
    Empresas vinculadas y clientes corporativos
    """
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    rut: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)


class Supplier(Base):
    """
    Directorio de Proveedores y Fabricantes
    """
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    razon_social: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    rut: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    tipo_proveedor: Mapped[str] = mapped_column(String(50), default="FABRICA", nullable=False, index=True) # FABRICA, NAVIERA_BUQUE, LOGISTICA, GENERAL
    pais: Mapped[Optional[str]] = mapped_column(String(100), default="China", nullable=True)
    contacto_nombre: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    contacto_cargo: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    rubro: Mapped[Optional[str]] = mapped_column(String(100), default="Iluminación", nullable=True, index=True)
    condicion_pago: Mapped[Optional[str]] = mapped_column(String(50), default="30 días", nullable=True, index=True) # Contado, 30 días, 60 días, Crédito Abierto
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    catalog_items: Mapped[List["SupplierCatalogItem"]] = relationship(back_populates="supplier", cascade="all, delete-orphan")


class SupplierCatalogItem(Base):
    """
    Catálogo de Productos de Proveedores (Plaza / Reventa / Mayorista).
    Permite comparar costo de compra vs. precio de venta a comercios (PVM) y al público (PVP).
    Rigor contable: Decimal y Numeric(14, 4) sin tipos float.
    """
    __tablename__ = "supplier_catalog_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True)
    sku_proveedor: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    sku_calcu: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    rubro: Mapped[str] = mapped_column(String(100), default="Iluminación", nullable=False, index=True)
    costo_compra: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.0000'), nullable=False)
    precio_venta_comercios: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.0000'), nullable=False) # PVM / Mayorista
    precio_venta_publico: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.0000'), nullable=False) # PVP / Público
    stock_estimado: Mapped[str] = mapped_column(String(50), default="En Stock MVD", nullable=False) # ej. "En Stock MVD", "24-48 hs", "Agotado"
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    supplier: Mapped["Supplier"] = relationship(back_populates="catalog_items")


class ImplicitServiceCatalog(Base):
    """
    Catálogo de Servicios Logísticos e Implícitos de Importación (Landed Cost).
    Rubros: 'MARITIMO', 'SEGURO', 'ADUANA', 'TRANSPORTE_CAMION'
    """
    __tablename__ = "implicit_service_catalog"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    rubro: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # MARITIMO, SEGURO, ADUANA, TRANSPORTE_CAMION
    codigo: Mapped[str] = mapped_column(String(50), unique=True, nullable=False) # ej: 'SRV-MAR-40HQ', 'SRV-SEG-INT'
    nombre_servicio: Mapped[str] = mapped_column(String(150), nullable=False)
    proveedor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("suppliers.id"), nullable=True, index=True)
    costo_unitario_base: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.00'), nullable=False)
    moneda: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    proveedor_rel: Mapped[Optional["Supplier"]] = relationship()


class ImplicitBudgetOrder(Base):
    """
    Orden de Presupuesto Implícito / Gastos de Despacho & Servicios (Landed Costs).
    Agrupa ítems de marítimo, seguros, aduana y camiones aprobables por Directorio.
    """
    __tablename__ = "implicit_budget_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    numero_orden: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True) # ej: 'PRE-IMP-2026-001'
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    monto_total: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.00'), nullable=False)
    moneda: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    estado: Mapped[str] = mapped_column(String(30), default="PENDIENTE_APROBACION", nullable=False, index=True) # PENDIENTE_APROBACION, APROBADO, RECHAZADO
    aprobado_por: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fecha_aprobacion: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    items: Mapped[List["ImplicitBudgetItem"]] = relationship(back_populates="budget", cascade="all, delete-orphan")


class ImplicitBudgetItem(Base):
    """
    Ítems o servicios individuales dentro de un Presupuesto Implícito.
    """
    __tablename__ = "implicit_budget_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    budget_id: Mapped[int] = mapped_column(ForeignKey("implicit_budget_orders.id"), nullable=False, index=True)
    rubro: Mapped[str] = mapped_column(String(50), nullable=False) # MARITIMO, SEGURO, ADUANA, TRANSPORTE_CAMION
    service_id: Mapped[Optional[int]] = mapped_column(ForeignKey("implicit_service_catalog.id"), nullable=True)
    supplier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("suppliers.id"), nullable=True)
    descripcion: Mapped[str] = mapped_column(String(200), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    costo_unitario: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    costo_total: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)

    budget: Mapped["ImplicitBudgetOrder"] = relationship(back_populates="items")
    service_rel: Mapped[Optional["ImplicitServiceCatalog"]] = relationship()
    supplier_rel: Mapped[Optional["Supplier"]] = relationship()


# Re-export de entidades del dominio complementarias
from app.domain.models import (
    UserPreference,
    PresupuestoVersion,
    OrdenReposicion,
    AuditLog,
    AccionCompromiso,
)


class BiddingVertical(Base):
    """
    Rubro Comercial para Licitaciones B2B (Multi-Rubro Agnóstico).
    Desacopla la plataforma de marcas fijas permitiendo gestionar
    Iluminación, Mobiliario, Obra Civil, Electromecánica, Salud, Redes y Servicios.
    """
    __tablename__ = "bidding_verticals"

    id: Mapped[str] = mapped_column(String(50), primary_key=True) # ej: 'ILUMINACION_EFICIENCIA', 'OBRA_CIVIL'
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[str] = mapped_column(String(20), default="📋", nullable=False)
    color_badge: Mapped[str] = mapped_column(String(30), default="blue", nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    keywords: Mapped[List["BiddingKeyword"]] = relationship(
        back_populates="vertical_rel", cascade="all, delete-orphan"
    )


class BiddingKeyword(Base):
    """
    Palabras Clave de Inclusión y Exclusión por Rubro Comercial.
    Alimenta los filtros de pliegos de compras públicas (ARCE/UY)
    y el motor asistido por Agente Ollama Local.
    """
    __tablename__ = "bidding_keywords"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vertical_id: Mapped[str] = mapped_column(ForeignKey("bidding_verticals.id"), nullable=False, index=True)
    keyword: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(20), default="INCLUSION", nullable=False) # 'INCLUSION' | 'EXCLUSION'
    peso: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("1.00"), nullable=False)
    fuente: Mapped[str] = mapped_column(String(30), default="MANUAL", nullable=False) # 'MANUAL' | 'AI_SUGGESTED'
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    vertical_rel: Mapped["BiddingVertical"] = relationship(back_populates="keywords")


class ProcurementIndexedCall(Base):
    """
    Indexación profunda de Convocatorias y Licitaciones Estatales OCDS (ARCE / SICE / Con la Tuya).
    Almacena objeto de contratación, items solicitados desglosados, links directos a pliego web y PDF.
    Rigor financiero: Numeric(14, 4) y Decimal.
    """
    __tablename__ = "procurement_indexed_calls"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # compra_id
    compra_id: Mapped[str] = mapped_column(String(64), index=True)
    ocid: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    titulo: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    organismo: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    objeto_contratacion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vertical_id: Mapped[str] = mapped_column(String(50), default="ILUMINACION_EFICIENCIA", nullable=False, index=True)
    items_solicitados: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, default=list, nullable=True)
    url_pliego_arce: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    url_pliego_pdf: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    tipo_compra: Mapped[Optional[str]] = mapped_column(String(100), default="Licitación Pública", nullable=True)
    fecha_apertura: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_cierre: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    monto_estimado: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal('0.0000'), nullable=False)
    moneda: Mapped[str] = mapped_column(String(10), default="UYU", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False)
    dso_estimado_dias: Mapped[Optional[int]] = mapped_column(Integer, default=45, nullable=True)
    raw_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    last_synced_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


# Re-export de entidades contables, facturación B2B y usuarios con RBAC
from app.models.accounting_entities import (
    Invoice,
    InvoiceItem,
    Expense,
    JournalEntry,
    JournalLine,
    SystemUser,
    CollectionCase,
)




