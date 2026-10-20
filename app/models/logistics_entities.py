from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Date,
    Numeric,
    ForeignKey,
    Float,
    Text,
)
from sqlalchemy.orm import relationship
from app.models.base import Base


class LogisticsClient(Base):
    """
    Empresas clientes del operador 3PL (Supermercados, Retailers y PyMEs).
    Aislamiento total: no son clientes del catálogo propio de Calcu.
    """
    __tablename__ = "logistics_clients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rut = Column(String(20), unique=True, nullable=False, index=True)
    razon_social = Column(String(200), nullable=False)
    nombre_comercial = Column(String(200), nullable=False)
    tipo = Column(String(50), default="SUPERMERCADO")  # 'SUPERMERCADO', 'PYME', 'DISTRIBUIDOR'
    contacto_logistica = Column(String(150), nullable=True)
    telefono = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    direccion_central = Column(String(255), nullable=True)
    condiciones_pago = Column(String(100), default="30_DIAS")
    activo = Column(Boolean, default=True)
    moneda_contrato = Column(String(10), default="USD", nullable=False)
    tarifa_m3_dia = Column(Numeric(14, 4), default=Decimal("0.8500"), nullable=False)
    tarifa_pallet_dia = Column(Numeric(14, 4), default=Decimal("1.2000"), nullable=False)
    tarifa_picking_movimiento = Column(Numeric(14, 4), default=Decimal("2.5000"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    inventory = relationship("LogisticsClientInventory", back_populates="client", cascade="all, delete-orphan")
    orders = relationship("LogisticsDispatchOrder", back_populates="client")
    pricing = relationship("LogisticsServicePricing", back_populates="client", uselist=False, cascade="all, delete-orphan")
    branches = relationship("LogisticsClientBranch", back_populates="client", cascade="all, delete-orphan")


class LogisticsClientBranch(Base):
    """
    Sucursales y puntos de entrega asociados a una empresa cliente 3PL.
    Permite registrar múltiples direcciones por cliente para despachos y ruteo.
    """
    __tablename__ = "logistics_client_branches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("logistics_clients.id"), nullable=False, index=True)
    nombre_sucursal = Column(String(150), nullable=False)
    direccion = Column(String(255), nullable=False)
    contacto_receptor = Column(String(150), nullable=True)
    telefono_receptor = Column(String(50), nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    distancia_km_base = Column(Numeric(14, 4), default=Decimal("0.0000"))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    client = relationship("LogisticsClient", back_populates="branches")
    orders = relationship("LogisticsDispatchOrder", back_populates="branch")



class LogisticsDriver(Base):
    """
    Choferes, fleteros tercerizados y operarios de depósito 3PL.
    """
    __tablename__ = "logistics_drivers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(150), nullable=False)
    documento = Column(String(30), unique=True, nullable=False)
    telefono = Column(String(50), nullable=False)
    tipo_licencia = Column(String(20), nullable=False, default="CAT_B")  # CAT_B, CAT_C, CAT_F
    tipo_relacion = Column(String(50), default="FLETERO_TERCERIZADO")    # FLETERO_TERCERIZADO, CADETE, OPERARIO_DEPOSITO
    modalidad_pago = Column(String(30), default="VIAJE_KM")               # VIAJE_KM, POR_HORA, POR_JORNAL
    tarifa_base_viaje = Column(Numeric(14, 4), default=Decimal("0.0"))
    tarifa_km = Column(Numeric(14, 4), default=Decimal("0.0"))
    tarifa_hora = Column(Numeric(14, 4), default=Decimal("0.0"))
    tarifa_jornal = Column(Numeric(14, 4), default=Decimal("0.0"))
    disponibilidad_semanal = Column(Text, nullable=True)  # JSON: disponibilidad semanal Lun-Dom y turnos
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    vehicles = relationship("LogisticsVehicle", back_populates="driver")
    orders = relationship("LogisticsDispatchOrder", back_populates="driver")


class LogisticsVehicle(Base):
    """
    Vehículos de flota propia o tercerizada para distribución 3PL.
    """
    __tablename__ = "logistics_vehicles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    driver_id = Column(Integer, ForeignKey("logistics_drivers.id"), nullable=True)
    matricula = Column(String(20), unique=True, nullable=False, index=True)
    tipo_vehiculo = Column(String(50), nullable=False, default="FURGON")  # UTILITARIO, FURGON, CAMION_PLATAFORMA, SEMI_REMOLQUE
    capacidad_kg = Column(Numeric(14, 4), nullable=False, default=Decimal("1500.0000"))
    volumen_m3 = Column(Numeric(14, 4), nullable=False, default=Decimal("12.0000"))
    capacidad_pallets = Column(Integer, default=4)
    activo = Column(Boolean, default=True)

    # Relaciones
    driver = relationship("LogisticsDriver", back_populates="vehicles")
    orders = relationship("LogisticsDispatchOrder", back_populates="vehicle")


class LogisticsClientInventory(Base):
    """
    Inventario físico de terceros en el almacén 3PL.
    Conceptualmente desacoplado de las tablas de productos propios de Calcu.
    """
    __tablename__ = "logistics_client_inventory"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("logistics_clients.id"), nullable=False, index=True)
    sku_cliente = Column(String(100), nullable=False, index=True)
    descripcion = Column(String(255), nullable=False)
    categoria = Column(String(100), default="GENERAL")
    cantidad_bultos = Column(Integer, default=0)
    unidades_por_bulto = Column(Integer, default=1)
    volumen_unitario_m3 = Column(Numeric(14, 4), default=Decimal("0.0200"))
    peso_unitario_kg = Column(Numeric(14, 4), default=Decimal("2.5000"))
    ubicacion_rack = Column(String(50), default="PISO-RECEPCION")
    codigo_qr_lote = Column(String(100), unique=True, index=True)
    lote = Column(String(50), nullable=True)
    fecha_vencimiento = Column(Date, nullable=True)
    fecha_ingreso = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    client = relationship("LogisticsClient", back_populates="inventory")
    dispatch_items = relationship("LogisticsDispatchItem", back_populates="inventory")


class LogisticsDispatchOrder(Base):
    """
    Órdenes de preparación, acondicionamiento y despacho 3PL (Kanban Operativo).
    """
    __tablename__ = "logistics_dispatch_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    numero_orden = Column(String(50), unique=True, nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("logistics_clients.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("logistics_client_branches.id"), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("logistics_vehicles.id"), nullable=True)
    driver_id = Column(Integer, ForeignKey("logistics_drivers.id"), nullable=True)
    etapa_kanban = Column(String(50), default="INGRESO")  # INGRESO, ETIQUETADO_VAS, LISTO_DESPACHO, EN_DISTRIBUCION, ENTREGADO
    remito_numero = Column(String(100), nullable=True)
    destino_direccion = Column(String(255), nullable=False)
    destino_coordenadas = Column(String(100), nullable=True)  # "lat,lng"
    responsable_armado = Column(String(150), nullable=True)   # Responsable del picking y embalaje
    contacto_receptor_nombre = Column(String(150), nullable=True)
    contacto_receptor_telefono = Column(String(50), nullable=True)
    ventana_horaria = Column(String(100), nullable=True)      # Ej: "08:00 - 12:00"
    kilometros_recorrido = Column(Numeric(14, 4), default=Decimal("0.0000"))
    tipo_despacho = Column(String(50), default="ESTANDAR")    # ESTANDAR, URGENTE, RETIRO_SUCURSAL
    total_bultos = Column(Integer, default=0)
    total_kg = Column(Numeric(14, 4), default=Decimal("0.0000"))
    total_m3 = Column(Numeric(14, 4), default=Decimal("0.0000"))
    tarifa_flete_cliente = Column(Numeric(14, 4), default=Decimal("0.0000"))
    costo_chofer_acordado = Column(Numeric(14, 4), default=Decimal("0.0000"))
    gastos_variables_ruta = Column(Numeric(14, 4), default=Decimal("0.0000"))
    margen_neto_estimado = Column(Numeric(14, 4), default=Decimal("0.0000"))
    firma_digital_receptor = Column(Text, nullable=True)      # Data URL Base64 de la firma táctil
    firma_fecha_hora = Column(DateTime, nullable=True)
    firma_aclaracion = Column(String(150), nullable=True)
    estado_pago = Column(String(50), default="PENDIENTE")    # PENDIENTE, FACTURADO, COBRADO
    observaciones = Column(Text, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_entrega_estimada = Column(DateTime, nullable=True)
    fecha_entrega_real = Column(DateTime, nullable=True)

    # Relaciones
    client = relationship("LogisticsClient", back_populates="orders")
    branch = relationship("LogisticsClientBranch", back_populates="orders")
    vehicle = relationship("LogisticsVehicle", back_populates="orders")
    driver = relationship("LogisticsDriver", back_populates="orders")
    items = relationship("LogisticsDispatchItem", back_populates="order", cascade="all, delete-orphan")
    telemetry_pings = relationship("LogisticsTelemetryPing", back_populates="order", cascade="all, delete-orphan")


class LogisticsDispatchItem(Base):
    """
    Líneas de bultos asociados a una orden de despacho 3PL.
    """
    __tablename__ = "logistics_dispatch_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("logistics_dispatch_orders.id"), nullable=False, index=True)
    inventory_id = Column(Integer, ForeignKey("logistics_client_inventory.id"), nullable=True)
    sku_cliente = Column(String(100), nullable=False)
    descripcion = Column(String(255), nullable=False)
    bultos_despacho = Column(Integer, default=1)
    kg_subtotal = Column(Numeric(14, 4), default=Decimal("0.0000"))
    m3_subtotal = Column(Numeric(14, 4), default=Decimal("0.0000"))

    # Relaciones
    order = relationship("LogisticsDispatchOrder", back_populates="items")
    inventory = relationship("LogisticsClientInventory", back_populates="dispatch_items")


class LogisticsServicePricing(Base):
    """
    Tarifario acordado por cliente para facturación de servicios 3PL.
    """
    __tablename__ = "logistics_service_pricings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("logistics_clients.id"), unique=True, nullable=False)
    tarifa_almacenaje_pallet_dia = Column(Numeric(14, 4), default=Decimal("0.4500"))
    tarifa_handling_bulto = Column(Numeric(14, 4), default=Decimal("0.1500"))
    tarifa_etiquetado_unidad = Column(Numeric(14, 4), default=Decimal("0.0500"))
    tarifa_flete_base = Column(Numeric(14, 4), default=Decimal("45.0000"))
    tarifa_flete_km_adicional = Column(Numeric(14, 4), default=Decimal("1.2000"))

    # Relaciones
    client = relationship("LogisticsClient", back_populates="pricing")


class LogisticsTelemetryPing(Base):
    """
    Registro cronológico de telemetría GPS para seguimiento en vivo y cálculo de ETA.
    """
    __tablename__ = "logistics_telemetry_pings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("logistics_dispatch_orders.id"), nullable=False, index=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    velocidad_kmh = Column(Float, default=0.0)
    bateria_pct = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    order = relationship("LogisticsDispatchOrder", back_populates="telemetry_pings")


class LogisticsCostItem(Base):
    """
    Costos fijos y variables del centro de operaciones logísticas 3PL.
    Permite el control de gastos de depósito y cálculo del punto de equilibrio (Break-Even) y EBITDA.
    """
    __tablename__ = "logistics_cost_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tipo = Column(String(20), nullable=False, default="FIJO")  # 'FIJO', 'VARIABLE'
    categoria = Column(String(50), nullable=False)             # 'ALQUILER', 'ELECTRICIDAD_UTE', 'AGUA', 'COMUNICACIONES', 'PAPELERIA', 'EMBALAJE', 'MANTENIMIENTO', 'SUELDOS_OPERATIVOS', 'OTROS'
    nombre = Column(String(150), nullable=False)
    monto_mensual = Column(Numeric(14, 4), nullable=False, default=Decimal("0.0000"))
    moneda = Column(String(10), default="UYU")                 # 'UYU', 'USD'
    descripcion = Column(Text, nullable=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class LogisticsHub(Base):
    """
    Configuración central del Centro de Distribución / Depósito Base 3PL.
    Guarda nombre, dirección física, ciudad, coordenadas geográficas (lat, lng),
    responsable, teléfono de contacto, superficie y costo de alquiler mensual.
    """
    __tablename__ = "logistics_hubs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(150), nullable=False, default="Centro de Distribución Base Calcu 3PL")
    direccion = Column(String(255), nullable=False, default="Ruta 101 Km 24.200")
    ciudad = Column(String(100), default="Canelones")
    pais = Column(String(50), default="Uruguay")
    lat = Column(Float, default=-34.8350)
    lng = Column(Float, default=-56.0350)
    superficie_m2 = Column(Numeric(14, 4), default=Decimal("1500.0000"))
    capacidad_pallets_max = Column(Integer, default=600)
    responsable_deposito = Column(String(150), default="Supervisor General 3PL")
    telefono_contacto = Column(String(50), default="+598 99 123 456")
    costo_alquiler_mensual = Column(Numeric(14, 4), default=Decimal("145000.0000"))
    moneda_alquiler = Column(String(10), default="UYU")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


