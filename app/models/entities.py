from typing import Optional, List
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import String, Integer, Numeric, ForeignKey, Date, DateTime, CheckConstraint, Boolean, Text
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
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    items: Mapped[List["CommercialDealItem"]] = relationship(back_populates="deal", cascade="all, delete-orphan")


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
    estado: Mapped[str] = mapped_column(String(30), default="EN_TRANSITO", nullable=False) # EN_PRODUCCION, EN_TRANSITO, DISPONIBLE, TRANSFERIDO
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)

    producto_rel: Mapped["Product"] = relationship(foreign_keys=[sku])


class Warehouse(Base):
    """
    Entidad Depósito / Almacén / Ubicación Logística
    Tipos: 'CENTRAL', 'SUCURSAL', 'TRANSITO', 'FABRICA'
    """
    __tablename__ = "warehouses"

    id: Mapped[str] = mapped_column(String(50), primary_key=True) # ej. 'dep-central', 'loc-pocitos'
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[str] = mapped_column(String(30), default="SUCURSAL", nullable=False)
    ubicacion: Mapped[str] = mapped_column(String(150), nullable=False)
    capacidad_unidades: Mapped[int] = mapped_column(Integer, default=10000, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)


# Re-export de entidades del dominio complementarias
from app.domain.models import (
    UserPreference,
    PresupuestoVersion,
    OrdenReposicion,
    AuditLog,
    AccionCompromiso,
)


