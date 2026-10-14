import io
import math
import uuid
import urllib.parse
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.database.session import get_db
from app.models.logistics_entities import (
    LogisticsClient,
    LogisticsClientBranch,
    LogisticsDriver,
    LogisticsVehicle,
    LogisticsClientInventory,
    LogisticsDispatchOrder,
    LogisticsDispatchItem,
    LogisticsServicePricing,
    LogisticsTelemetryPing,
    LogisticsCostItem,
)
from app.engine.logistics_engine import (
    LogisticsEngine,
    CapacityCheckResult,
    ServiceSettlementResult,
    RouteProfitabilityResult,
    EbitdaAnalysisResult,
)

# ReportLab para generación de rótulos con Barcode 128 y QR
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode import code128
from reportlab.graphics.barcode.qr import QrCodeWidget

router = APIRouter(prefix="/api/v1/logistics", tags=["3PL Logística & Distribución"])


# ==========================================
# SCHEMAS PYDANTIC
# ==========================================

class LogisticsPricingSchema(BaseModel):
    tarifa_almacenaje_pallet_dia: float = 0.45
    tarifa_handling_bulto: float = 0.15
    tarifa_etiquetado_unidad: float = 0.05
    tarifa_flete_base: float = 45.00
    tarifa_flete_km_adicional: float = 1.20


class LogisticsClientCreate(BaseModel):
    rut: str
    razon_social: str
    nombre_comercial: str
    tipo: str = "SUPERMERCADO"  # SUPERMERCADO, PYME, DISTRIBUIDOR
    contacto_logistica: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    direccion_central: Optional[str] = None
    condiciones_pago: str = "30_DIAS"
    pricing: Optional[LogisticsPricingSchema] = None


class LogisticsDriverCreate(BaseModel):
    nombre: str
    documento: str
    telefono: str
    tipo_licencia: str = "CAT_B"
    tipo_relacion: str = "FLETERO_TERCERIZADO"
    modalidad_pago: Optional[str] = "VIAJE_KM"  # VIAJE_KM, POR_HORA, POR_JORNAL
    tarifa_base_viaje: Optional[float] = 35.0
    tarifa_km: Optional[float] = 0.85
    tarifa_hora: Optional[float] = 0.0
    tarifa_jornal: Optional[float] = 0.0
    disponibilidad_semanal: Optional[str] = None
    activo: bool = True


class LogisticsVehicleCreate(BaseModel):
    matricula: str
    tipo_vehiculo: str = "FURGON"
    capacidad_kg: float = 1500.0
    volumen_m3: float = 12.0
    capacidad_pallets: int = 4
    driver_id: Optional[int] = None
    activo: bool = True


class LogisticsInventoryCreate(BaseModel):
    client_id: int
    sku_cliente: str
    descripcion: str
    categoria: str = "GENERAL"
    cantidad_bultos: int = 1
    unidades_por_bulto: int = 12
    volumen_unitario_m3: float = 0.02
    peso_unitario_kg: float = 2.5
    ubicacion_rack: str = "RECEPCION-01"
    lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None


class DispatchItemCreate(BaseModel):
    inventory_id: Optional[int] = None
    sku_cliente: str
    descripcion: str
    bultos_despacho: int = 1
    kg_subtotal: float = 0.0
    m3_subtotal: float = 0.0


class LogisticsOrderCreate(BaseModel):
    client_id: int
    numero_orden: Optional[str] = None
    destino_direccion: str
    destino_coordenadas: Optional[str] = None
    ventana_horaria: Optional[str] = "09:00 - 13:00"
    remito_numero: Optional[str] = None
    vehicle_id: Optional[int] = None
    driver_id: Optional[int] = None
    items: List[DispatchItemCreate] = []
    tarifa_flete_cliente: Optional[float] = None
    costo_chofer_acordado: Optional[float] = None
    gastos_variables_ruta: Optional[float] = 0.0
    observaciones: Optional[str] = None


class OrderStageUpdate(BaseModel):
    etapa_kanban: str  # INGRESO, ETIQUETADO_VAS, LISTO_DESPACHO, EN_DISTRIBUCION, ENTREGADO


class OrderAssignRequest(BaseModel):
    vehicle_id: int
    driver_id: Optional[int] = None
    costo_chofer_acordado: Optional[float] = None
    gastos_variables_ruta: Optional[float] = 0.0


class TelemetryPingCreate(BaseModel):
    lat: float
    lng: float
    velocidad_kmh: float = 0.0
    bateria_pct: Optional[int] = 100


class QuoteCalculationRequest(BaseModel):
    client_id: int
    dias_almacenaje: int = 15
    pallets: int = 4
    total_bultos: int = 120
    total_unidades: int = 1440
    distancia_km: float = 18.5
    iva_pct: float = 22.0


class LogisticsBranchCreate(BaseModel):
    nombre_sucursal: str
    direccion: str
    contacto_receptor: Optional[str] = None
    telefono_receptor: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    distancia_km_base: float = 0.0
    activo: bool = True


class LogisticsBranchUpdate(BaseModel):
    nombre_sucursal: Optional[str] = None
    direccion: Optional[str] = None
    contacto_receptor: Optional[str] = None
    telefono_receptor: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    distancia_km_base: Optional[float] = None
    activo: Optional[bool] = None


class LogisticsDriverUpdate(BaseModel):
    nombre: Optional[str] = None
    documento: Optional[str] = None
    telefono: Optional[str] = None
    tipo_licencia: Optional[str] = None
    tipo_relacion: Optional[str] = None
    modalidad_pago: Optional[str] = None
    tarifa_base_viaje: Optional[float] = None
    tarifa_km: Optional[float] = None
    tarifa_hora: Optional[float] = None
    tarifa_jornal: Optional[float] = None
    disponibilidad_semanal: Optional[str] = None  # JSON string con Lunes a Domingo y turnos
    activo: Optional[bool] = None


class LogisticsVehicleUpdate(BaseModel):
    matricula: Optional[str] = None
    tipo_vehiculo: Optional[str] = None
    capacidad_kg: Optional[float] = None
    volumen_m3: Optional[float] = None
    capacidad_pallets: Optional[int] = None
    driver_id: Optional[int] = None
    activo: Optional[bool] = None


class PickingItemRequest(BaseModel):
    inventory_id: int
    cantidad: Optional[int] = None
    bultos_solicitados: Optional[int] = None
    unidades_solicitadas: Optional[int] = None
    es_unidades: bool = False  # False: bultos/cajas, True: unidades sueltas


class PickingOrderCreate(BaseModel):
    client_id: int
    branch_id: Optional[int] = None
    responsable_armado: Optional[str] = "Supervisor Depósito"
    contacto_receptor_nombre: Optional[str] = "Contacto Entrega"
    contacto_receptor_telefono: Optional[str] = "S/D"
    destino_direccion: Optional[str] = None
    destino_coordenadas: Optional[str] = None
    ventana_horaria: Optional[str] = "09:00 - 13:00"
    fecha_entrega_estimada: Optional[str] = None
    kilometros_recorrido: Optional[float] = 10.0
    tipo_despacho: str = "ESTANDAR"
    observaciones: Optional[str] = None
    items: List[PickingItemRequest]


class SignDeliveryRequest(BaseModel):
    firma_digital: str  # Data URL Base64 de la firma táctil
    aclaracion: Optional[str] = None
    documento: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class CostItemCreate(BaseModel):
    tipo: str = "FIJO"  # FIJO, VARIABLE
    categoria: str = "ALQUILER"
    nombre: str
    monto_mensual: float
    moneda: str = "UYU"
    descripcion: Optional[str] = None
    activo: bool = True


class CostItemUpdate(BaseModel):
    tipo: Optional[str] = None
    categoria: Optional[str] = None
    nombre: Optional[str] = None
    monto_mensual: Optional[float] = None
    moneda: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None


# ==========================================
# RUTAS: CLIENTES 3PL
# ==========================================

@router.get("/clients")
def list_clients(db: Session = Depends(get_db)):
    """Obtiene la lista de clientes 3PL con métricas agregadas de stock y órdenes."""
    clients = db.query(LogisticsClient).filter(LogisticsClient.activo == True).order_by(LogisticsClient.id).all()
    results = []
    for c in clients:
        # Stock acumulado
        total_bultos = db.query(func.sum(LogisticsClientInventory.cantidad_bultos)).filter(
            LogisticsClientInventory.client_id == c.id
        ).scalar() or 0
        total_skus = db.query(func.count(LogisticsClientInventory.id)).filter(
            LogisticsClientInventory.client_id == c.id
        ).scalar() or 0
        # Órdenes activas
        active_orders = db.query(func.count(LogisticsDispatchOrder.id)).filter(
            LogisticsDispatchOrder.client_id == c.id,
            LogisticsDispatchOrder.etapa_kanban != "ENTREGADO"
        ).scalar() or 0

        pricing_data = None
        if c.pricing:
            pricing_data = {
                "tarifa_almacenaje_pallet_dia": float(c.pricing.tarifa_almacenaje_pallet_dia),
                "tarifa_handling_bulto": float(c.pricing.tarifa_handling_bulto),
                "tarifa_etiquetado_unidad": float(c.pricing.tarifa_etiquetado_unidad),
                "tarifa_flete_base": float(c.pricing.tarifa_flete_base),
                "tarifa_flete_km_adicional": float(c.pricing.tarifa_flete_km_adicional),
            }

        results.append({
            "id": c.id,
            "rut": c.rut,
            "razon_social": c.razon_social,
            "nombre_comercial": c.nombre_comercial,
            "tipo": c.tipo,
            "contacto_logistica": c.contacto_logistica,
            "telefono": c.telefono,
            "email": c.email,
            "direccion_central": c.direccion_central,
            "condiciones_pago": c.condiciones_pago,
            "activo": c.activo,
            "total_bultos": int(total_bultos),
            "total_skus": int(total_skus),
            "ordenes_activas": int(active_orders),
            "pricing": pricing_data,
            "branches": [
                {
                    "id": b.id,
                    "nombre_sucursal": b.nombre_sucursal,
                    "direccion": b.direccion,
                    "contacto_receptor": b.contacto_receptor,
                    "telefono_receptor": b.telefono_receptor,
                    "lat": b.lat,
                    "lng": b.lng,
                    "distancia_km_base": float(b.distancia_km_base),
                    "activo": b.activo,
                }
                for b in c.branches if b.activo
            ],
        })
    return results


@router.post("/clients")
def create_client(payload: LogisticsClientCreate, db: Session = Depends(get_db)):
    """Crea o actualiza un cliente 3PL con su tarifario inicial."""
    existing = db.query(LogisticsClient).filter(LogisticsClient.rut == payload.rut).first()
    if existing:
        existing.razon_social = payload.razon_social
        existing.nombre_comercial = payload.nombre_comercial
        existing.tipo = payload.tipo
        existing.contacto_logistica = payload.contacto_logistica
        existing.telefono = payload.telefono
        existing.email = payload.email
        existing.direccion_central = payload.direccion_central
        existing.condiciones_pago = payload.condiciones_pago
        client = existing
    else:
        client = LogisticsClient(
            rut=payload.rut,
            razon_social=payload.razon_social,
            nombre_comercial=payload.nombre_comercial,
            tipo=payload.tipo,
            contacto_logistica=payload.contacto_logistica,
            telefono=payload.telefono,
            email=payload.email,
            direccion_central=payload.direccion_central,
            condiciones_pago=payload.condiciones_pago,
        )
        db.add(client)
        db.flush()

    if payload.pricing:
        pricing = db.query(LogisticsServicePricing).filter(LogisticsServicePricing.client_id == client.id).first()
        if not pricing:
            pricing = LogisticsServicePricing(client_id=client.id)
            db.add(pricing)
        pricing.tarifa_almacenaje_pallet_dia = Decimal(str(payload.pricing.tarifa_almacenaje_pallet_dia))
        pricing.tarifa_handling_bulto = Decimal(str(payload.pricing.tarifa_handling_bulto))
        pricing.tarifa_etiquetado_unidad = Decimal(str(payload.pricing.tarifa_etiquetado_unidad))
        pricing.tarifa_flete_base = Decimal(str(payload.pricing.tarifa_flete_base))
        pricing.tarifa_flete_km_adicional = Decimal(str(payload.pricing.tarifa_flete_km_adicional))

    db.commit()
    db.refresh(client)
    return {"message": "Cliente 3PL registrado con éxito", "id": client.id}


@router.put("/clients/{client_id}/pricing")
def update_client_pricing(client_id: int, payload: LogisticsPricingSchema, db: Session = Depends(get_db)):
    """Actualiza las tarifas de servicio acordadas con el cliente."""
    client = db.query(LogisticsClient).filter(LogisticsClient.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente 3PL no encontrado")
    
    pricing = db.query(LogisticsServicePricing).filter(LogisticsServicePricing.client_id == client_id).first()
    if not pricing:
        pricing = LogisticsServicePricing(client_id=client_id)
        db.add(pricing)
    
    pricing.tarifa_almacenaje_pallet_dia = Decimal(str(payload.tarifa_almacenaje_pallet_dia))
    pricing.tarifa_handling_bulto = Decimal(str(payload.tarifa_handling_bulto))
    pricing.tarifa_etiquetado_unidad = Decimal(str(payload.tarifa_etiquetado_unidad))
    pricing.tarifa_flete_base = Decimal(str(payload.tarifa_flete_base))
    pricing.tarifa_flete_km_adicional = Decimal(str(payload.tarifa_flete_km_adicional))

    db.commit()
    return {"message": "Tarifas 3PL actualizadas con éxito"}


# ==========================================
# RUTAS: SUCURSALES / DIRECCIONES 3PL
# ==========================================

@router.get("/clients/{client_id}/branches")
def list_client_branches(client_id: int, db: Session = Depends(get_db)):
    """Lista las sucursales y puntos de entrega activos de un cliente 3PL."""
    branches = db.query(LogisticsClientBranch).filter(
        LogisticsClientBranch.client_id == client_id,
        LogisticsClientBranch.activo == True
    ).order_by(LogisticsClientBranch.id).all()
    return [
        {
            "id": b.id,
            "client_id": b.client_id,
            "nombre_sucursal": b.nombre_sucursal,
            "direccion": b.direccion,
            "contacto_receptor": b.contacto_receptor,
            "telefono_receptor": b.telefono_receptor,
            "lat": b.lat,
            "lng": b.lng,
            "distancia_km_base": float(b.distancia_km_base),
            "activo": b.activo,
        }
        for b in branches
    ]


@router.post("/clients/{client_id}/branches")
def create_client_branch(client_id: int, payload: LogisticsBranchCreate, db: Session = Depends(get_db)):
    """Crea una sucursal o punto de entrega para un cliente 3PL."""
    client = db.query(LogisticsClient).filter(LogisticsClient.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente 3PL no encontrado")
    
    branch = LogisticsClientBranch(
        client_id=client_id,
        nombre_sucursal=payload.nombre_sucursal.strip(),
        direccion=payload.direccion.strip(),
        contacto_receptor=payload.contacto_receptor.strip() if payload.contacto_receptor else None,
        telefono_receptor=payload.telefono_receptor.strip() if payload.telefono_receptor else None,
        lat=payload.lat,
        lng=payload.lng,
        distancia_km_base=Decimal(str(payload.distancia_km_base or 0.0)),
        activo=payload.activo,
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return {"message": "Sucursal registrada con éxito", "id": branch.id}


@router.put("/branches/{branch_id}")
def update_branch(branch_id: int, payload: LogisticsBranchUpdate, db: Session = Depends(get_db)):
    """Edita los datos de una sucursal de entrega."""
    branch = db.query(LogisticsClientBranch).filter(LogisticsClientBranch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")
    
    if payload.nombre_sucursal is not None:
        branch.nombre_sucursal = payload.nombre_sucursal.strip()
    if payload.direccion is not None:
        branch.direccion = payload.direccion.strip()
    if payload.contacto_receptor is not None:
        branch.contacto_receptor = payload.contacto_receptor.strip()
    if payload.telefono_receptor is not None:
        branch.telefono_receptor = payload.telefono_receptor.strip()
    if payload.lat is not None:
        branch.lat = payload.lat
    if payload.lng is not None:
        branch.lng = payload.lng
    if payload.distancia_km_base is not None:
        branch.distancia_km_base = Decimal(str(payload.distancia_km_base))
    if payload.activo is not None:
        branch.activo = payload.activo
    
    db.commit()
    db.refresh(branch)
    return {"message": "Sucursal actualizada con éxito", "id": branch.id}


@router.delete("/branches/{branch_id}")
def delete_branch(branch_id: int, db: Session = Depends(get_db)):
    """Desactiva una sucursal."""
    branch = db.query(LogisticsClientBranch).filter(LogisticsClientBranch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")
    branch.activo = False
    db.commit()
    return {"message": "Sucursal desactivada con éxito"}



# ==========================================
# RUTAS: FLOTA & CHOFERES TERCERIZADOS
# ==========================================

@router.get("/fleet/drivers")
def list_drivers(db: Session = Depends(get_db)):
    """Lista choferes, cadetes y operarios de logística 3PL."""
    drivers = db.query(LogisticsDriver).filter(LogisticsDriver.activo == True).order_by(LogisticsDriver.id).all()
    out = []
    for d in drivers:
        # Cantidad de viajes completados
        viajes_hechos = db.query(func.count(LogisticsDispatchOrder.id)).filter(
            LogisticsDispatchOrder.driver_id == d.id,
            LogisticsDispatchOrder.etapa_kanban == "ENTREGADO"
        ).scalar() or 0
        viajes_activos = db.query(func.count(LogisticsDispatchOrder.id)).filter(
            LogisticsDispatchOrder.driver_id == d.id,
            LogisticsDispatchOrder.etapa_kanban == "EN_DISTRIBUCION"
        ).scalar() or 0

        out.append({
            "id": d.id,
            "nombre": d.nombre,
            "documento": d.documento,
            "telefono": d.telefono,
            "tipo_licencia": d.tipo_licencia,
            "tipo_relacion": d.tipo_relacion,
            "modalidad_pago": getattr(d, "modalidad_pago", "VIAJE_KM") or "VIAJE_KM",
            "tarifa_base_viaje": float(d.tarifa_base_viaje or 0.0),
            "tarifa_km": float(d.tarifa_km or 0.0),
            "tarifa_hora": float(getattr(d, "tarifa_hora", 0.0) or 0.0),
            "tarifa_jornal": float(getattr(d, "tarifa_jornal", 0.0) or 0.0),
            "disponibilidad_semanal": d.disponibilidad_semanal,
            "activo": d.activo,
            "viajes_hechos": int(viajes_hechos),
            "viajes_activos": int(viajes_activos),
            "vehiculos": [{"id": v.id, "matricula": v.matricula, "tipo": v.tipo_vehiculo} for v in d.vehicles]
        })
    return out


@router.post("/fleet/drivers")
def create_driver(payload: LogisticsDriverCreate, db: Session = Depends(get_db)):
    """Registra o edita un chofer / fletero tercerizado / operario de logística."""
    existing = db.query(LogisticsDriver).filter(LogisticsDriver.documento == payload.documento).first()
    if existing:
        existing.nombre = payload.nombre.strip()
        existing.telefono = payload.telefono.strip()
        existing.tipo_licencia = payload.tipo_licencia.strip()
        existing.tipo_relacion = payload.tipo_relacion.strip()
        existing.modalidad_pago = payload.modalidad_pago or "VIAJE_KM"
        existing.tarifa_base_viaje = Decimal(str(payload.tarifa_base_viaje or 0.0))
        existing.tarifa_km = Decimal(str(payload.tarifa_km or 0.0))
        existing.tarifa_hora = Decimal(str(payload.tarifa_hora or 0.0))
        existing.tarifa_jornal = Decimal(str(payload.tarifa_jornal or 0.0))
        if payload.disponibilidad_semanal is not None:
            existing.disponibilidad_semanal = payload.disponibilidad_semanal
        existing.activo = payload.activo
        driver = existing
    else:
        driver = LogisticsDriver(
            nombre=payload.nombre.strip(),
            documento=payload.documento.strip(),
            telefono=payload.telefono.strip(),
            tipo_licencia=payload.tipo_licencia.strip(),
            tipo_relacion=payload.tipo_relacion.strip(),
            modalidad_pago=payload.modalidad_pago or "VIAJE_KM",
            tarifa_base_viaje=Decimal(str(payload.tarifa_base_viaje or 0.0)),
            tarifa_km=Decimal(str(payload.tarifa_km or 0.0)),
            tarifa_hora=Decimal(str(payload.tarifa_hora or 0.0)),
            tarifa_jornal=Decimal(str(payload.tarifa_jornal or 0.0)),
            disponibilidad_semanal=payload.disponibilidad_semanal,
            activo=payload.activo,
        )
        db.add(driver)
    db.commit()
    db.refresh(driver)
    return {"message": "Personal/Chofer guardado con éxito", "id": driver.id}


@router.put("/fleet/drivers/{driver_id}")
def update_driver(driver_id: int, payload: LogisticsDriverUpdate, db: Session = Depends(get_db)):
    """Edita los datos de un chofer/operario incluyendo su matriz de disponibilidad semanal y esquemas de pago."""
    driver = db.query(LogisticsDriver).filter(LogisticsDriver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Chofer/Operario no encontrado")

    if payload.nombre is not None:
        driver.nombre = payload.nombre.strip()
    if payload.documento is not None:
        driver.documento = payload.documento.strip()
    if payload.telefono is not None:
        driver.telefono = payload.telefono.strip()
    if payload.tipo_licencia is not None:
        driver.tipo_licencia = payload.tipo_licencia.strip()
    if payload.tipo_relacion is not None:
        driver.tipo_relacion = payload.tipo_relacion.strip()
    if payload.modalidad_pago is not None:
        driver.modalidad_pago = payload.modalidad_pago.strip()
    if payload.tarifa_base_viaje is not None:
        driver.tarifa_base_viaje = Decimal(str(payload.tarifa_base_viaje))
    if payload.tarifa_km is not None:
        driver.tarifa_km = Decimal(str(payload.tarifa_km))
    if payload.tarifa_hora is not None:
        driver.tarifa_hora = Decimal(str(payload.tarifa_hora))
    if payload.tarifa_jornal is not None:
        driver.tarifa_jornal = Decimal(str(payload.tarifa_jornal))
    if payload.disponibilidad_semanal is not None:
        driver.disponibilidad_semanal = payload.disponibilidad_semanal
    if payload.activo is not None:
        driver.activo = payload.activo

    db.commit()
    db.refresh(driver)
    return {"message": "Personal/Chofer actualizado con éxito", "id": driver.id}


@router.get("/fleet/vehicles")
def list_vehicles(db: Session = Depends(get_db)):
    """Lista vehículos de flota tercerizada y propia con capacidades volumétricas."""
    vehicles = db.query(LogisticsVehicle).filter(LogisticsVehicle.activo == True).order_by(LogisticsVehicle.id).all()
    out = []
    for v in vehicles:
        # Estado actual: ¿está en viaje?
        active_order = db.query(LogisticsDispatchOrder).filter(
            LogisticsDispatchOrder.vehicle_id == v.id,
            LogisticsDispatchOrder.etapa_kanban == "EN_DISTRIBUCION"
        ).first()

        out.append({
            "id": v.id,
            "driver_id": v.driver_id,
            "driver_nombre": v.driver.nombre if v.driver else "Sin Conductor Asignado",
            "driver_telefono": v.driver.telefono if v.driver else None,
            "matricula": v.matricula,
            "tipo_vehiculo": v.tipo_vehiculo,
            "capacidad_kg": float(v.capacidad_kg),
            "volumen_m3": float(v.volumen_m3),
            "capacidad_pallets": v.capacidad_pallets,
            "activo": v.activo,
            "en_transito": active_order is not None,
            "orden_activa": active_order.numero_orden if active_order else None,
        })
    return out


@router.post("/fleet/vehicles")
def create_vehicle(payload: LogisticsVehicleCreate, db: Session = Depends(get_db)):
    """Registra o edita una unidad vehicular de reparto."""
    existing = db.query(LogisticsVehicle).filter(LogisticsVehicle.matricula == payload.matricula.strip().upper()).first()
    if existing:
        existing.tipo_vehiculo = payload.tipo_vehiculo
        existing.capacidad_kg = Decimal(str(payload.capacidad_kg))
        existing.volumen_m3 = Decimal(str(payload.volumen_m3))
        existing.capacidad_pallets = payload.capacidad_pallets
        existing.driver_id = payload.driver_id
        existing.activo = payload.activo
        vehicle = existing
    else:
        vehicle = LogisticsVehicle(
            matricula=payload.matricula.strip().upper(),
            tipo_vehiculo=payload.tipo_vehiculo,
            capacidad_kg=Decimal(str(payload.capacidad_kg)),
            volumen_m3=Decimal(str(payload.volumen_m3)),
            capacidad_pallets=payload.capacidad_pallets,
            driver_id=payload.driver_id,
            activo=payload.activo,
        )
        db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return {"message": "Vehículo guardado con éxito", "id": vehicle.id}


@router.put("/fleet/vehicles/{vehicle_id}")
def update_vehicle(vehicle_id: int, payload: LogisticsVehicleUpdate, db: Session = Depends(get_db)):
    """Edita las especificaciones y asignación de un vehículo."""
    vehicle = db.query(LogisticsVehicle).filter(LogisticsVehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")

    if payload.matricula is not None:
        vehicle.matricula = payload.matricula.strip().upper()
    if payload.tipo_vehiculo is not None:
        vehicle.tipo_vehiculo = payload.tipo_vehiculo.strip()
    if payload.capacidad_kg is not None:
        vehicle.capacidad_kg = Decimal(str(payload.capacidad_kg))
    if payload.volumen_m3 is not None:
        vehicle.volumen_m3 = Decimal(str(payload.volumen_m3))
    if payload.capacidad_pallets is not None:
        vehicle.capacidad_pallets = payload.capacidad_pallets
    if payload.driver_id is not None:
        vehicle.driver_id = payload.driver_id if payload.driver_id > 0 else None
    if payload.activo is not None:
        vehicle.activo = payload.activo

    db.commit()
    db.refresh(vehicle)
    return {"message": "Vehículo actualizado con éxito", "id": vehicle.id}



# ==========================================
# RUTAS: INVENTARIO & DEPÓSITO 3PL (WMS)
# ==========================================

@router.get("/inventory")
def list_inventory(
    client_id: Optional[int] = None,
    search: Optional[str] = None,
    rack: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Matriz de inventario 3PL con filtros por cliente, SKU, descripción y rack."""
    query = db.query(LogisticsClientInventory).join(LogisticsClient)

    if client_id:
        query = query.filter(LogisticsClientInventory.client_id == client_id)
    if rack:
        query = query.filter(LogisticsClientInventory.ubicacion_rack.ilike(f"%{rack}%"))
    if search:
        s = f"%{search}%"
        query = query.filter(
            (LogisticsClientInventory.sku_cliente.ilike(s)) |
            (LogisticsClientInventory.descripcion.ilike(s)) |
            (LogisticsClientInventory.codigo_qr_lote.ilike(s))
        )

    items = query.order_by(desc(LogisticsClientInventory.fecha_ingreso)).all()
    out = []
    for i in items:
        vol_total = float(i.volumen_unitario_m3) * i.cantidad_bultos
        peso_total = float(i.peso_unitario_kg) * i.cantidad_bultos
        out.append({
            "id": i.id,
            "client_id": i.client_id,
            "client_nombre": i.client.nombre_comercial,
            "sku_cliente": i.sku_cliente,
            "descripcion": i.descripcion,
            "categoria": i.categoria,
            "cantidad_bultos": i.cantidad_bultos,
            "unidades_por_bulto": i.unidades_por_bulto,
            "total_unidades": i.cantidad_bultos * i.unidades_por_bulto,
            "volumen_unitario_m3": float(i.volumen_unitario_m3),
            "volumen_total_m3": round(vol_total, 3),
            "peso_unitario_kg": float(i.peso_unitario_kg),
            "peso_total_kg": round(peso_total, 2),
            "ubicacion_rack": i.ubicacion_rack,
            "codigo_qr_lote": i.codigo_qr_lote,
            "lote": i.lote,
            "fecha_vencimiento": i.fecha_vencimiento.isoformat() if i.fecha_vencimiento else None,
            "fecha_ingreso": i.fecha_ingreso.isoformat() if i.fecha_ingreso else None,
        })
    return out


@router.post("/inventory")
def create_inventory_item(payload: LogisticsInventoryCreate, db: Session = Depends(get_db)):
    """Alta manual de lote en el depósito 3PL con autogeneración de Código QR/Code128."""
    client = db.query(LogisticsClient).filter(LogisticsClient.id == payload.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente 3PL no encontrado")

    qr_code = f"3PL-{client.rut[:4]}-{payload.sku_cliente}-{uuid.uuid4().hex[:6].upper()}"
    
    item = LogisticsClientInventory(
        client_id=payload.client_id,
        sku_cliente=payload.sku_cliente.strip(),
        descripcion=payload.descripcion.strip(),
        categoria=payload.categoria,
        cantidad_bultos=payload.cantidad_bultos,
        unidades_por_bulto=payload.unidades_por_bulto,
        volumen_unitario_m3=Decimal(str(payload.volumen_unitario_m3)),
        peso_unitario_kg=Decimal(str(payload.peso_unitario_kg)),
        ubicacion_rack=payload.ubicacion_rack.strip().upper(),
        codigo_qr_lote=qr_code,
        lote=payload.lote,
        fecha_vencimiento=payload.fecha_vencimiento,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"message": "Inventario ingresado exitosamente", "id": item.id, "codigo_qr_lote": item.codigo_qr_lote}


@router.post("/inventory/upload-excel")
async def upload_inventory_excel(
    client_id: int = Query(..., description="ID del cliente 3PL"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Ingesta masiva e idempotente de planillas de stock de clientes (Excel .xlsx / CSV).
    Parsea columnas: SKU, Descripción, Bultos, Unidades/Bulto, Peso (kg), Volumen (m³), Rack, Lote.
    """
    client = db.query(LogisticsClient).filter(LogisticsClient.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente 3PL especificado no existe")

    import pandas as pd
    try:
        content = await file.read()
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al procesar la planilla: {str(e)}")

    # Mapeo flexible de columnas
    col_map = {}
    for col in df.columns:
        c_clean = str(col).strip().lower()
        if "sku" in c_clean or "codigo" in c_clean:
            col_map["sku"] = col
        elif "desc" in c_clean or "producto" in c_clean or "nombre" in c_clean:
            col_map["descripcion"] = col
        elif "bulto" in c_clean or "caja" in c_clean or "cantidad" in c_clean:
            col_map["bultos"] = col
        elif "unid" in c_clean or "pack" in c_clean:
            col_map["unidades"] = col
        elif "peso" in c_clean or "kg" in c_clean:
            col_map["peso"] = col
        elif "vol" in c_clean or "m3" in c_clean:
            col_map["volumen"] = col
        elif "rack" in c_clean or "ubic" in c_clean or "posicion" in c_clean:
            col_map["rack"] = col
        elif "lote" in c_clean or "batch" in c_clean:
            col_map["lote"] = col

    if "sku" not in col_map or "descripcion" not in col_map:
        raise HTTPException(
            status_code=422,
            detail=f"La planilla debe contener columnas reconocibles de SKU y Descripción. Encontradas: {list(df.columns)}"
        )

    imported_count = 0
    updated_count = 0

    for _, row in df.iterrows():
        sku = str(row[col_map["sku"]]).strip()
        if not sku or sku.lower() == "nan":
            continue
        desc = str(row[col_map["descripcion"]]).strip()
        bultos = int(row[col_map["bultos"]]) if "bultos" in col_map and not pd.isna(row[col_map["bultos"]]) else 10
        unidades = int(row[col_map["unidades"]]) if "unidades" in col_map and not pd.isna(row[col_map["unidades"]]) else 12
        peso = float(row[col_map["peso"]]) if "peso" in col_map and not pd.isna(row[col_map["peso"]]) else 2.5
        volumen = float(row[col_map["volumen"]]) if "volumen" in col_map and not pd.isna(row[col_map["volumen"]]) else 0.02
        rack = str(row[col_map["rack"]]).strip().upper() if "rack" in col_map and not pd.isna(row[col_map["rack"]]) else "RECEPCION-PISO"
        lote = str(row[col_map["lote"]]).strip() if "lote" in col_map and not pd.isna(row[col_map["lote"]]) else f"LOTE-{datetime.utcnow().strftime('%Y%m')}"

        # Idempotencia: si ya existe para este cliente y SKU, actualiza bultos
        existing = db.query(LogisticsClientInventory).filter(
            LogisticsClientInventory.client_id == client_id,
            LogisticsClientInventory.sku_cliente == sku
        ).first()

        if existing:
            existing.cantidad_bultos += bultos
            existing.ubicacion_rack = rack
            existing.unidades_por_bulto = unidades
            existing.peso_unitario_kg = Decimal(str(peso))
            existing.volumen_unitario_m3 = Decimal(str(volumen))
            updated_count += 1
        else:
            qr = f"3PL-{client.rut[:4]}-{sku}-{uuid.uuid4().hex[:6].upper()}"
            item = LogisticsClientInventory(
                client_id=client_id,
                sku_cliente=sku,
                descripcion=desc,
                cantidad_bultos=bultos,
                unidades_por_bulto=unidades,
                volumen_unitario_m3=Decimal(str(volumen)),
                peso_unitario_kg=Decimal(str(peso)),
                ubicacion_rack=rack,
                codigo_qr_lote=qr,
                lote=lote,
            )
            db.add(item)
            imported_count += 1

    db.commit()
    return {
        "message": f"Procesamiento finalizado con éxito para '{client.nombre_comercial}'",
        "nuevos_ingresados": imported_count,
        "actualizados": updated_count,
        "total_procesados": imported_count + updated_count,
    }


@router.get("/inventory/generate-labels")
def generate_inventory_labels(
    inventory_id: Optional[int] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Genera una hoja de rótulos oficial en formato PDF lista para imprimir y pegar en pallets/bultos.
    Incluye:
    - Código de Barras estándar Code128 de alta lectura óptica
    - Código QR 2D con información de lote, cliente y trazabilidad
    - Identificación de rack, bultos y fecha
    """
    query = db.query(LogisticsClientInventory).join(LogisticsClient)
    if inventory_id:
        query = query.filter(LogisticsClientInventory.id == inventory_id)
    elif client_id:
        query = query.filter(LogisticsClientInventory.client_id == client_id)
    
    items = query.limit(30).all()
    if not items:
        raise HTTPException(status_code=404, detail="No se encontraron artículos para rotular")

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter

    # Diseño de grilla de 2 columnas x 3 filas por página (6 etiquetas por hoja)
    label_w = 260
    label_h = 220
    x_offsets = [35, 315]
    y_offsets = [page_h - 250, page_h - 490, page_h - 730]

    item_idx = 0
    for it in items:
        slot = item_idx % 6
        if item_idx > 0 and slot == 0:
            c.showPage()

        col = slot % 2
        row = slot // 2
        x = x_offsets[col]
        y = y_offsets[row]

        # Marco de etiqueta con bordes redondeados sutiles
        c.setStrokeColorRGB(0.75, 0.75, 0.75)
        c.setLineWidth(1)
        c.roundRect(x, y, label_w, label_h, 4, stroke=1, fill=0)

        # Header de etiqueta (Franja Azul Corporativa)
        c.setFillColorRGB(0.0, 0.35, 0.65)
        c.rect(x, y + label_h - 24, label_w, 24, fill=1, stroke=0)
        c.setFillColorRGB(1, 1, 1)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(x + 10, y + label_h - 16, f"CALCU 3PL LOGISTICS | {it.client.nombre_comercial[:24]}")

        # Contenido textual del producto y ubicación
        c.setFillColorRGB(0.1, 0.1, 0.1)
        c.setFont("Helvetica-Bold", 10.5)
        c.drawString(x + 10, y + label_h - 42, f"SKU: {it.sku_cliente}")

        c.setFont("Helvetica", 8.5)
        desc_clean = it.descripcion[:40] + "..." if len(it.descripcion) > 40 else it.descripcion
        c.drawString(x + 10, y + label_h - 56, desc_clean)

        c.drawString(x + 10, y + label_h - 70, f"Lote: {it.lote or 'S/L'} | Bultos: {it.cantidad_bultos} ({it.unidades_por_bulto} u/c)")

        c.setFont("Helvetica-Bold", 9.5)
        c.setFillColorRGB(0.0, 0.45, 0.2)
        c.drawString(x + 10, y + label_h - 84, f"RACK: {it.ubicacion_rack}")

        # Barcode Code128 (Escalado matemáticamente para nunca desbordar y centrado)
        barcode_val = it.codigo_qr_lote or f"SKU-{it.sku_cliente}"
        try:
            total_modules = (len(barcode_val) * 11) + 35
            max_bc_w = label_w - 36
            bar_w = max(0.35, min(0.65, max_bc_w / total_modules))
            actual_bc_w = total_modules * bar_w
            bc = code128.Code128(barcode_val, barHeight=18, barWidth=bar_w)
            bc_x = x + (label_w - actual_bc_w) / 2
            bc.drawOn(c, bc_x, y + 92)

            # Texto ID legible debajo del código de barras
            c.setFont("Helvetica", 7)
            c.setFillColorRGB(0.4, 0.4, 0.4)
            c.drawCentredString(x + (label_w / 2), y + 83, f"ID: {barcode_val}")
        except Exception:
            c.setFont("Helvetica", 7.5)
            c.drawString(x + 10, y + 92, f"[{barcode_val}]")

        # Línea divisoria sutil
        c.setStrokeColorRGB(0.88, 0.88, 0.88)
        c.line(x + 20, y + 78, x + label_w - 20, y + 78)

        # Código QR 2D - PERFECTAMENTE CENTRADO EN LA ZONA INFERIOR (SIN SUPERPOSICIÓN)
        try:
            qr_content = f"CALCU-3PL|CLIENT:{it.client_id}|SKU:{it.sku_cliente}|LOT:{it.lote}|RACK:{it.ubicacion_rack}|CODE:{it.codigo_qr_lote}"
            qr = QrCodeWidget(qr_content)
            qr_size = 56
            d = Drawing(qr_size, qr_size)
            d.add(qr)
            qr_x = x + (label_w - qr_size) / 2
            qr_y = y + 14
            d.drawOn(c, qr_x, qr_y)

            # Leyenda inferior centrada
            c.setFont("Helvetica-Bold", 6.5)
            c.setFillColorRGB(0.3, 0.3, 0.3)
            c.drawCentredString(x + (label_w / 2), y + 5, "ESCANEAR PARA TRAZABILIDAD WMS 3PL")
        except Exception:
            pass

        item_idx += 1

    c.save()
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=Rotulos_3PL_Calcu.pdf"}
    )


# ==========================================
# RUTAS: KANBAN OPERATIVO, PICKING & DESPACHOS
# ==========================================

@router.post("/inventory/picking-order")
def create_picking_order(payload: PickingOrderCreate, db: Session = Depends(get_db)):
    """
    Arma un pedido de preparación (Picking Parcial) descontando atómicamente el stock en custodia del cliente.
    Crea la orden de servicio directamente en etapa 'ETIQUETADO_VAS' (Acondicionamiento / Etiquetado)
    para que pase luego a asignación de chofer y vehículo en 'LISTO_DESPACHO'.
    """
    client = db.query(LogisticsClient).filter(LogisticsClient.id == payload.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente 3PL no encontrado")

    if not payload.items:
        raise HTTPException(status_code=400, detail="Debe especificar al menos un producto para armar el pedido")

    direccion = payload.destino_direccion
    coords = payload.destino_coordenadas
    contacto_nombre = payload.contacto_receptor_nombre
    contacto_tel = payload.contacto_receptor_telefono
    km = float(payload.kilometros_recorrido or 0.0)

    if payload.branch_id:
        branch = db.query(LogisticsClientBranch).filter(
            LogisticsClientBranch.id == payload.branch_id,
            LogisticsClientBranch.client_id == payload.client_id
        ).first()
        if branch:
            if not direccion:
                direccion = f"{branch.nombre_sucursal} - {branch.direccion}"
            if not contacto_nombre and branch.contacto_receptor:
                contacto_nombre = branch.contacto_receptor
            if not contacto_tel and branch.telefono_receptor:
                contacto_tel = branch.telefono_receptor
            if branch.lat and branch.lng and not coords:
                coords = f"{branch.lat},{branch.lng}"
            if float(branch.distancia_km_base) > 0 and km == 0.0:
                km = float(branch.distancia_km_base)

    if not direccion:
        direccion = client.direccion_central or "Depósito Cliente"

    # Procesar y descontar stock
    items_to_create = []
    tot_bultos = 0
    tot_kg = Decimal("0.0")
    tot_m3 = Decimal("0.0")

    for p_item in payload.items:
        inv = db.query(LogisticsClientInventory).filter(
            LogisticsClientInventory.id == p_item.inventory_id,
            LogisticsClientInventory.client_id == payload.client_id
        ).first()

        if not inv:
            raise HTTPException(status_code=404, detail=f"Ítem de inventario ID {p_item.inventory_id} no pertenece al cliente")

        effective_qty = p_item.cantidad
        if effective_qty is None:
            effective_qty = p_item.bultos_solicitados or p_item.unidades_solicitadas or 0

        if effective_qty <= 0:
            raise HTTPException(status_code=400, detail=f"Cantidad debe ser mayor a 0 para {inv.sku_cliente}")

        if p_item.es_unidades or (p_item.unidades_solicitadas is not None and p_item.bultos_solicitados is None):
            unid_pack = inv.unidades_por_bulto or 1
            bultos_deducir = math.ceil(effective_qty / unid_pack)
            if inv.cantidad_bultos < bultos_deducir:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para {inv.sku_cliente}. Solicitadas: {effective_qty} unidades ({bultos_deducir} bultos equivalentes). Stock disponible: {inv.cantidad_bultos} bultos."
                )
            inv.cantidad_bultos -= bultos_deducir
            bultos_linea = bultos_deducir
            kg_linea = Decimal(str(inv.peso_unitario_kg)) * Decimal(str(bultos_deducir))
            m3_linea = Decimal(str(inv.volumen_unitario_m3)) * Decimal(str(bultos_deducir))
        else:
            if inv.cantidad_bultos < effective_qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para {inv.sku_cliente}. Solicitados: {effective_qty} bultos. Stock disponible: {inv.cantidad_bultos} bultos."
                )
            inv.cantidad_bultos -= effective_qty
            bultos_linea = effective_qty
            kg_linea = Decimal(str(inv.peso_unitario_kg)) * Decimal(str(effective_qty))
            m3_linea = Decimal(str(inv.volumen_unitario_m3)) * Decimal(str(effective_qty))

        tot_bultos += bultos_linea
        tot_kg += kg_linea
        tot_m3 += m3_linea

        items_to_create.append({
            "inventory_id": inv.id,
            "sku_cliente": inv.sku_cliente,
            "descripcion": inv.descripcion,
            "bultos": bultos_linea,
            "kg": kg_linea,
            "m3": m3_linea,
        })

    # Calcular tarifa con base y kilometraje
    pricing = client.pricing
    t_flete_base = pricing.tarifa_flete_base if pricing else Decimal("45.00")
    t_flete_km = pricing.tarifa_flete_km_adicional if pricing else Decimal("1.20")
    km_dec = Decimal(str(km))
    km_excedente = max(Decimal("0.0"), km_dec - Decimal("15.0"))
    tarifa_flete = t_flete_base + (km_excedente * t_flete_km)

    numero_orden = f"3PL-PICK-{datetime.utcnow().strftime('%y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

    order = LogisticsDispatchOrder(
        numero_orden=numero_orden,
        client_id=client.id,
        branch_id=payload.branch_id,
        etapa_kanban="ETIQUETADO_VAS",  # Sincronizado en Etapa 2: Acondicionamiento / Etiquetado
        destino_direccion=direccion,
        destino_coordenadas=coords or "-34.9011,-56.1645",
        responsable_armado=(payload.responsable_armado or "Supervisor Depósito").strip(),
        contacto_receptor_nombre=contacto_nombre.strip() if contacto_nombre else None,
        contacto_receptor_telefono=contacto_tel.strip() if contacto_tel else None,
        ventana_horaria=payload.ventana_horaria,
        kilometros_recorrido=km_dec,
        tipo_despacho=payload.tipo_despacho,
        remito_numero=f"REM-PICK-{uuid.uuid4().hex[:6].upper()}",
        total_bultos=tot_bultos,
        total_kg=tot_kg,
        total_m3=tot_m3,
        tarifa_flete_cliente=tarifa_flete,
        costo_chofer_acordado=Decimal("0.0"),
        gastos_variables_ruta=Decimal("0.0"),
        margen_neto_estimado=tarifa_flete,
        observaciones=payload.observaciones,
    )
    db.add(order)
    db.flush()

    for item_data in items_to_create:
        d_item = LogisticsDispatchItem(
            order_id=order.id,
            inventory_id=item_data["inventory_id"],
            sku_cliente=item_data["sku_cliente"],
            descripcion=item_data["descripcion"],
            bultos_despacho=item_data["bultos"],
            kg_subtotal=item_data["kg"],
            m3_subtotal=item_data["m3"],
        )
        db.add(d_item)

    db.commit()
    db.refresh(order)

    return {
        "message": f"Orden de picking {order.numero_orden} armada con éxito y enviada a 'Acondicionamiento / Etiquetado'",
        "id": order.id,
        "numero_orden": order.numero_orden,
        "codigo_qr": f"ORDER-{order.numero_orden}",
        "etapa_kanban": order.etapa_kanban,
        "total_bultos": order.total_bultos,
        "total_kg": float(order.total_kg),
        "total_m3": float(order.total_m3),
        "kilometros_recorrido": float(order.kilometros_recorrido),
        "tarifa_flete_cliente": float(order.tarifa_flete_cliente),
    }


@router.get("/orders")
def list_orders(
    client_id: Optional[int] = None,
    etapa: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Lista las órdenes de servicio del Kanban 3PL con cubicaje y datos de asignación."""
    query = db.query(LogisticsDispatchOrder).join(LogisticsClient)

    if client_id:
        query = query.filter(LogisticsDispatchOrder.client_id == client_id)
    if etapa:
        query = query.filter(LogisticsDispatchOrder.etapa_kanban == etapa)

    orders = query.order_by(desc(LogisticsDispatchOrder.fecha_creacion)).all()
    out = []
    for o in orders:
        items_summary = [
            {
                "sku": it.sku_cliente,
                "descripcion": it.descripcion,
                "bultos": it.bultos_despacho,
                "kg": float(it.kg_subtotal),
                "m3": float(it.m3_subtotal),
            }
            for it in o.items
        ]

        # Validación volumétrica si tiene vehículo asignado
        capacity_status = None
        if o.vehicle:
            cap_res = LogisticsEngine.validate_capacity(
                capacidad_max_kg=o.vehicle.capacidad_kg,
                capacidad_max_m3=o.vehicle.volumen_m3,
                peso_total_kg=o.total_kg,
                volumen_total_m3=o.total_m3,
            )
            capacity_status = cap_res.model_dump()

        out.append({
            "id": o.id,
            "numero_orden": o.numero_orden,
            "client_id": o.client_id,
            "client_nombre": o.client.nombre_comercial,
            "branch_id": o.branch_id,
            "branch_nombre": o.branch.nombre_sucursal if o.branch else None,
            "responsable_armado": o.responsable_armado,
            "contacto_receptor_nombre": o.contacto_receptor_nombre,
            "contacto_receptor_telefono": o.contacto_receptor_telefono,
            "etapa_kanban": o.etapa_kanban,
            "destino_direccion": o.destino_direccion,
            "destino_coordenadas": o.destino_coordenadas,
            "ventana_horaria": o.ventana_horaria,
            "remito_numero": o.remito_numero,
            "kilometros_recorrido": float(o.kilometros_recorrido or 0.0),
            "tipo_despacho": o.tipo_despacho or "ESTANDAR",
            "total_bultos": o.total_bultos,
            "total_kg": float(o.total_kg),
            "total_m3": float(o.total_m3),
            "tarifa_flete_cliente": float(o.tarifa_flete_cliente),
            "costo_chofer_acordado": float(o.costo_chofer_acordado),
            "gastos_variables_ruta": float(o.gastos_variables_ruta),
            "margen_neto_estimado": float(o.margen_neto_estimado),
            "firma_digital_receptor": o.firma_digital_receptor,
            "firma_fecha_hora": o.firma_fecha_hora.isoformat() if o.firma_fecha_hora else None,
            "firma_aclaracion": o.firma_aclaracion,
            "fecha_entrega_real": o.fecha_entrega_real.isoformat() if o.fecha_entrega_real else None,
            "estado_pago": o.estado_pago,
            "observaciones": o.observaciones,
            "fecha_creacion": o.fecha_creacion.isoformat() if o.fecha_creacion else None,
            "vehicle": {
                "id": o.vehicle.id,
                "matricula": o.vehicle.matricula,
                "tipo": o.vehicle.tipo_vehiculo,
                "capacidad_kg": float(o.vehicle.capacidad_kg),
                "volumen_m3": float(o.vehicle.volumen_m3),
            } if o.vehicle else None,
            "driver": {
                "id": o.driver.id,
                "nombre": o.driver.nombre,
                "telefono": o.driver.telefono,
                "tipo_relacion": o.driver.tipo_relacion,
            } if o.driver else None,
            "items": items_summary,
            "capacity_status": capacity_status,
        })
    return out



@router.post("/orders")
def create_order(payload: LogisticsOrderCreate, db: Session = Depends(get_db)):
    """Crea una nueva orden de despacho en el tablero Kanban 3PL."""
    client = db.query(LogisticsClient).filter(LogisticsClient.id == payload.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente 3PL no encontrado")

    numero_orden = payload.numero_orden or f"3PL-ORD-{datetime.utcnow().strftime('%y%m')}-{uuid.uuid4().hex[:5].upper()}"

    # Calcular totales
    tot_bultos = sum(i.bultos_despacho for i in payload.items) if payload.items else 0
    tot_kg = sum(Decimal(str(i.kg_subtotal)) for i in payload.items) if payload.items else Decimal("0.0")
    tot_m3 = sum(Decimal(str(i.m3_subtotal)) for i in payload.items) if payload.items else Decimal("0.0")

    # Tarifas iniciales
    flete_cli = Decimal(str(payload.tarifa_flete_cliente)) if payload.tarifa_flete_cliente is not None else (
        client.pricing.tarifa_flete_base if client.pricing else Decimal("50.0")
    )
    costo_chofer = Decimal(str(payload.costo_chofer_acordado or 0.0))
    gastos_var = Decimal(str(payload.gastos_variables_ruta or 0.0))
    margen = flete_cli - (costo_chofer + gastos_var)

    order = LogisticsDispatchOrder(
        numero_orden=numero_orden,
        client_id=payload.client_id,
        vehicle_id=payload.vehicle_id,
        driver_id=payload.driver_id,
        etapa_kanban="INGRESO",
        destino_direccion=payload.destino_direccion,
        destino_coordenadas=payload.destino_coordenadas or "-34.9011,-56.1645",
        ventana_horaria=payload.ventana_horaria,
        remito_numero=payload.remito_numero or f"REM-{uuid.uuid4().hex[:6].upper()}",
        total_bultos=tot_bultos,
        total_kg=tot_kg,
        total_m3=tot_m3,
        tarifa_flete_cliente=flete_cli,
        costo_chofer_acordado=costo_chofer,
        gastos_variables_ruta=gastos_var,
        margen_neto_estimado=margen,
        observaciones=payload.observaciones,
    )
    db.add(order)
    db.flush()

    for it in payload.items:
        d_item = LogisticsDispatchItem(
            order_id=order.id,
            inventory_id=it.inventory_id,
            sku_cliente=it.sku_cliente,
            descripcion=it.descripcion,
            bultos_despacho=it.bultos_despacho,
            kg_subtotal=Decimal(str(it.kg_subtotal)),
            m3_subtotal=Decimal(str(it.m3_subtotal)),
        )
        db.add(d_item)

    db.commit()
    db.refresh(order)
    return {"message": "Orden de despacho creada con éxito", "id": order.id, "numero_orden": order.numero_orden}


@router.patch("/orders/{order_id}/stage")
def update_order_stage(order_id: int, payload: OrderStageUpdate, db: Session = Depends(get_db)):
    """Avanza o retrocede de etapa una orden en el Kanban Operativo."""
    order = db.query(LogisticsDispatchOrder).filter(LogisticsDispatchOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden de despacho no encontrada")

    valid_stages = ["INGRESO", "ETIQUETADO_VAS", "LISTO_DESPACHO", "EN_DISTRIBUCION", "ENTREGADO"]
    if payload.etapa_kanban not in valid_stages:
        raise HTTPException(status_code=400, detail=f"Etapa inválida. Opciones: {valid_stages}")

    # Validar que si pasa a EN_DISTRIBUCION tenga chofer y vehículo
    if payload.etapa_kanban == "EN_DISTRIBUCION":
        if not order.vehicle_id or not order.driver_id:
            raise HTTPException(
                status_code=422,
                detail="Para despachar a 'En Distribución' debe asignar previamente un Chofer y un Vehículo."
            )

    order.etapa_kanban = payload.etapa_kanban
    if payload.etapa_kanban == "ENTREGADO":
        order.fecha_entrega_real = datetime.utcnow()

    db.commit()
    return {"message": f"Orden {order.numero_orden} movida a etapa {payload.etapa_kanban}"}


@router.post("/orders/{order_id}/assign")
def assign_order_fleet(order_id: int, payload: OrderAssignRequest, db: Session = Depends(get_db)):
    """
    Asignación inteligente de chofer y vehículo a una orden 3PL con validación de cubitaje.
    Verifica peso ($kg$) y volumen ($m^3$) contra la capacidad de la unidad seleccionada.
    """
    order = db.query(LogisticsDispatchOrder).filter(LogisticsDispatchOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    vehicle = db.query(LogisticsVehicle).filter(LogisticsVehicle.id == payload.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")

    driver_id = payload.driver_id or vehicle.driver_id
    if not driver_id:
        raise HTTPException(status_code=400, detail="Debe especificar un chofer o asignar uno que ya esté vinculado al vehículo")

    driver = db.query(LogisticsDriver).filter(LogisticsDriver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Chofer no encontrado")

    # Validación de cubicaje y tara con el LogisticsEngine
    cap_check = LogisticsEngine.validate_capacity(
        capacidad_max_kg=vehicle.capacidad_kg,
        capacidad_max_m3=vehicle.volumen_m3,
        peso_total_kg=order.total_kg,
        volumen_total_m3=order.total_m3,
    )

    # Costo del chofer: acordado o tarifa base
    costo_chofer = Decimal(str(payload.costo_chofer_acordado)) if payload.costo_chofer_acordado is not None else driver.tarifa_base_viaje
    gastos_var = Decimal(str(payload.gastos_variables_ruta or 0.0))

    order.vehicle_id = vehicle.id
    order.driver_id = driver.id
    order.costo_chofer_acordado = costo_chofer
    order.gastos_variables_ruta = gastos_var
    order.margen_neto_estimado = order.tarifa_flete_cliente - (costo_chofer + gastos_var)

    # Si la orden estaba en INGRESO o ETIQUETADO_VAS y ya está asignada, puede pasar a LISTO_DESPACHO
    if order.etapa_kanban in ["INGRESO", "ETIQUETADO_VAS"]:
        order.etapa_kanban = "LISTO_DESPACHO"

    db.commit()

    return {
        "message": f"Vehículo {vehicle.matricula} y Chofer {driver.nombre} asignados a orden {order.numero_orden}",
        "capacity_validation": cap_check.model_dump(),
        "margen_neto_estimado": float(order.margen_neto_estimado),
    }


# ==========================================
# RUTAS: TRACKING GPS EN VIVO & TELEMETRÍA
# ==========================================

@router.post("/tracking/{order_id}/ping")
def receive_telemetry_ping(order_id: int, payload: TelemetryPingCreate, db: Session = Depends(get_db)):
    """Recepción de coordenadas GPS reales del chofer móvil para actualización en vivo."""
    order = db.query(LogisticsDispatchOrder).filter(LogisticsDispatchOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    ping = LogisticsTelemetryPing(
        order_id=order_id,
        lat=payload.lat,
        lng=payload.lng,
        velocidad_kmh=payload.velocidad_kmh,
        bateria_pct=payload.bateria_pct,
    )
    db.add(ping)
    db.commit()
    return {"message": "Coordenadas GPS recibidas en tiempo real", "timestamp": ping.timestamp.isoformat()}


@router.get("/tracking/live")
def get_live_tracking(db: Session = Depends(get_db)):
    """
    Retorna la flota en distribución con su última posición GPS, velocidad y tiempo estimado de llegada (ETA).
    """
    active_orders = db.query(LogisticsDispatchOrder).filter(
        LogisticsDispatchOrder.etapa_kanban == "EN_DISTRIBUCION"
    ).all()

    fleet_markers = []
    for o in active_orders:
        last_ping = db.query(LogisticsTelemetryPing).filter(
            LogisticsTelemetryPing.order_id == o.id
        ).order_by(desc(LogisticsTelemetryPing.timestamp)).first()

        lat = last_ping.lat if last_ping else -34.8833
        lng = last_ping.lng if last_ping else -56.1667
        speed = last_ping.velocidad_kmh if last_ping else 38.5

        # Google Maps navigation link gratuito
        if o.destino_coordenadas and "," in o.destino_coordenadas:
            gmaps_nav = f"https://www.google.com/maps/dir/?api=1&destination={o.destino_coordenadas}"
        else:
            gmaps_nav = f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote(o.destino_direccion)}"

        fleet_markers.append({
            "order_id": o.id,
            "numero_orden": o.numero_orden,
            "client_nombre": o.client.nombre_comercial,
            "branch_nombre": o.branch.nombre_sucursal if o.branch else None,
            "driver_nombre": o.driver.nombre if o.driver else "Conductor",
            "driver_telefono": o.driver.telefono if o.driver else "",
            "vehicle_matricula": o.vehicle.matricula if o.vehicle else "S/M",
            "vehicle_tipo": o.vehicle.tipo_vehiculo if o.vehicle else "Furgón",
            "contacto_receptor_nombre": o.contacto_receptor_nombre or o.client.contacto_logistica,
            "contacto_receptor_telefono": o.contacto_receptor_telefono or o.client.telefono,
            "destino_direccion": o.destino_direccion,
            "destino_coordenadas": o.destino_coordenadas,
            "google_maps_url": gmaps_nav,
            "ventana_horaria": o.ventana_horaria,
            "total_bultos": o.total_bultos,
            "total_kg": float(o.total_kg),
            "kilometros_recorrido": float(o.kilometros_recorrido or 0.0),
            "tipo_despacho": o.tipo_despacho or "ESTANDAR",
            "lat": lat,
            "lng": lng,
            "velocidad_kmh": speed,
            "bateria_pct": last_ping.bateria_pct if last_ping else 88,
            "eta_minutos": 25,
            "last_update": last_ping.timestamp.isoformat() if last_ping else datetime.utcnow().isoformat(),
        })

    return fleet_markers


@router.post("/orders/{order_id}/sign-delivery")
def sign_order_delivery(order_id: int, payload: SignDeliveryRequest, db: Session = Depends(get_db)):
    """
    Registra la firma digital táctil del receptor en la entrega móvil y finaliza la orden en Kanban.
    Actualiza la fecha y hora de entrega real.
    """
    order = db.query(LogisticsDispatchOrder).filter(LogisticsDispatchOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    order.firma_digital_receptor = payload.firma_digital
    order.firma_fecha_hora = datetime.utcnow()
    order.firma_aclaracion = payload.aclaracion or payload.documento or order.contacto_receptor_nombre or "Receptor Conforme"
    order.etapa_kanban = "ENTREGADO"
    order.fecha_entrega_real = datetime.utcnow()

    # Si se enviaron coordenadas del momento de la firma, guardamos un ping de telemetría final
    if payload.lat is not None and payload.lng is not None:
        ping = LogisticsTelemetryPing(
            order_id=order.id,
            lat=payload.lat,
            lng=payload.lng,
            velocidad_kmh=0.0,
            bateria_pct=100,
        )
        db.add(ping)

    db.commit()
    db.refresh(order)
    return {
        "message": f"Entrega de orden {order.numero_orden} confirmada con firma digital",
        "id": order.id,
        "etapa_kanban": order.etapa_kanban,
        "firma_fecha_hora": order.firma_fecha_hora.isoformat(),
        "firma_aclaracion": order.firma_aclaracion,
    }


@router.get("/orders/{order_id}/driver-sheet")
def get_driver_delivery_sheet(order_id: int, db: Session = Depends(get_db)):
    """
    Ficha de reparto móvil optimizada para la pantalla del conductor / cadete en su celular:
    Cliente, sucursal, contacto con llamada directa, dirección con enlace a Google Maps y panel de firma.
    """
    order = db.query(LogisticsDispatchOrder).filter(LogisticsDispatchOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    # Deep-link gratuito a Google Maps Navigation
    if order.destino_coordenadas and "," in order.destino_coordenadas:
        gmaps_url = f"https://www.google.com/maps/dir/?api=1&destination={order.destino_coordenadas}"
    else:
        dest_enc = urllib.parse.quote(order.destino_direccion)
        gmaps_url = f"https://www.google.com/maps/dir/?api=1&destination={dest_enc}"

    items_list = [
        {
            "sku": it.sku_cliente,
            "descripcion": it.descripcion,
            "bultos": it.bultos_despacho,
            "kg": float(it.kg_subtotal),
            "m3": float(it.m3_subtotal),
        }
        for it in order.items
    ]

    return {
        "order_id": order.id,
        "numero_orden": order.numero_orden,
        "remito_numero": order.remito_numero,
        "client_nombre": order.client.nombre_comercial,
        "branch_nombre": order.branch.nombre_sucursal if order.branch else None,
        "contacto_receptor_nombre": order.contacto_receptor_nombre or order.client.contacto_logistica,
        "contacto_receptor_telefono": order.contacto_receptor_telefono or order.client.telefono,
        "destino_direccion": order.destino_direccion,
        "destino_coordenadas": order.destino_coordenadas,
        "google_maps_url": gmaps_url,
        "ventana_horaria": order.ventana_horaria,
        "total_bultos": order.total_bultos,
        "total_kg": float(order.total_kg),
        "total_m3": float(order.total_m3),
        "kilometros_recorrido": float(order.kilometros_recorrido or 0.0),
        "etapa_kanban": order.etapa_kanban,
        "responsable_armado": order.responsable_armado,
        "observaciones": order.observaciones,
        "items": items_list,
        "firma_digital_receptor": order.firma_digital_receptor,
        "firma_fecha_hora": order.firma_fecha_hora.isoformat() if order.firma_fecha_hora else None,
        "firma_aclaracion": order.firma_aclaracion,
    }


@router.get("/orders/{order_id}/remito-pdf")
def get_order_remito_pdf(order_id: int, db: Session = Depends(get_db)):
    """
    Genera el Remito Oficial de Entrega 3PL en PDF con trazabilidad QR, desglose de bultos y casillero de firma.
    """
    order = db.query(LogisticsDispatchOrder).filter(LogisticsDispatchOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden de despacho no encontrada")

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    page_w, page_h = letter

    # 1. Cabezal Corporativo
    c.setFillColorRGB(0.0, 0.35, 0.65)
    c.rect(30, page_h - 60, page_w - 60, 40, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(45, page_h - 38, "CALCU 3PL LOGISTICS | REMITO OFICIAL DE ENTREGA")
    c.setFont("Helvetica", 9)
    c.drawString(45, page_h - 52, "Custodia, Acondicionamiento y Distribución Multi-Cliente B2B")

    # 2. Datos de Orden y Remito
    c.setFillColorRGB(0.1, 0.1, 0.1)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(page_w - 230, page_h - 38, f"REMITO Nº: {order.remito_numero}")
    c.setFont("Helvetica", 9)
    c.drawString(page_w - 230, page_h - 50, f"Orden: {order.numero_orden}")

    # 3. Bloques de Información (Cliente / Destino / Transporte)
    c.setStrokeColorRGB(0.8, 0.8, 0.8)
    c.setLineWidth(1)
    c.roundRect(30, page_h - 170, page_w - 60, 95, 6, fill=0, stroke=1)

    c.setFont("Helvetica-Bold", 10)
    c.setFillColorRGB(0.0, 0.35, 0.65)
    c.drawString(45, page_h - 90, "DATOS DEL CLIENTE Y DESTINO")
    c.drawString(page_w / 2 + 10, page_h - 90, "TRANSPORTE Y LOGÍSTICA")

    c.setFont("Helvetica", 9)
    c.setFillColorRGB(0.2, 0.2, 0.2)
    # Columna Izquierda
    c.drawString(45, page_h - 108, f"Cliente: {order.client.razon_social}")
    c.drawString(45, page_h - 122, f"RUT: {order.client.rut} | Tipo: {order.client.tipo}")
    dest_str = f"Destino: {order.destino_direccion[:45]}"
    c.drawString(45, page_h - 136, dest_str)
    rec_str = f"Receptor: {order.contacto_receptor_nombre or 'Recepción'} | Tel: {order.contacto_receptor_telefono or 'S/D'}"
    c.drawString(45, page_h - 150, rec_str)
    c.drawString(45, page_h - 164, f"Armado / Picking: {order.responsable_armado or 'Supervisor Depósito'}")

    # Columna Derecha
    drv_nom = order.driver.nombre if order.driver else "Conductor Tercerizado"
    drv_tel = order.driver.telefono if order.driver else "S/D"
    veh_mat = order.vehicle.matricula if order.vehicle else "S/M"
    veh_tip = order.vehicle.tipo_vehiculo if order.vehicle else "Furgón"

    c.drawString(page_w / 2 + 10, page_h - 108, f"Conductor: {drv_nom} (Tel: {drv_tel})")
    c.drawString(page_w / 2 + 10, page_h - 122, f"Unidad: {veh_mat} ({veh_tip})")
    c.drawString(page_w / 2 + 10, page_h - 136, f"Distancia / Km: {float(order.kilometros_recorrido):.1f} km")
    c.drawString(page_w / 2 + 10, page_h - 150, f"Ventana Horaria: {order.ventana_horaria or '08:00 - 13:00'}")
    c.drawString(page_w / 2 + 10, page_h - 164, f"Estado Actual: {order.etapa_kanban}")

    # 4. Tabla de Ítems Despachados
    y_table = page_h - 195
    c.setFillColorRGB(0.93, 0.95, 0.98)
    c.rect(30, y_table - 18, page_w - 60, 18, fill=1, stroke=0)
    c.setFillColorRGB(0.1, 0.1, 0.1)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(40, y_table - 12, "SKU CLIENTE")
    c.drawString(150, y_table - 12, "DESCRIPCIÓN DEL PRODUCTO")
    c.drawString(360, y_table - 12, "BULTOS")
    c.drawString(430, y_table - 12, "PESO (KG)")
    c.drawString(500, y_table - 12, "VOLUMEN (M³)")

    c.setFont("Helvetica", 8.5)
    cur_y = y_table - 32
    for it in order.items:
        c.drawString(40, cur_y, str(it.sku_cliente))
        c.drawString(150, cur_y, str(it.descripcion[:38]))
        c.drawString(370, cur_y, str(it.bultos_despacho))
        c.drawString(440, cur_y, f"{float(it.kg_subtotal):.1f}")
        c.drawString(510, cur_y, f"{float(it.m3_subtotal):.2f}")
        cur_y -= 18

    # Totales
    c.setStrokeColorRGB(0.7, 0.7, 0.7)
    c.line(30, cur_y + 10, page_w - 30, cur_y + 10)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(150, cur_y - 2, "TOTALES DE CARGA DESPACHADA:")
    c.drawString(370, cur_y - 2, f"{order.total_bultos} bultos")
    c.drawString(440, cur_y - 2, f"{float(order.total_kg):.1f} kg")
    c.drawString(510, cur_y - 2, f"{float(order.total_m3):.2f} m³")

    # 5. Código QR de Verificación y Bloque de Firma
    box_y = 65
    # Recuadro de QR
    c.roundRect(30, box_y, 140, 120, 6, fill=0, stroke=1)
    try:
        qr_content = f"CALCU-REMITO|ORD:{order.numero_orden}|REM:{order.remito_numero}|CLI:{order.client.rut}|BULTOS:{order.total_bultos}|ESTADO:{order.etapa_kanban}"
        qr = QrCodeWidget(qr_content)
        d = Drawing(75, 75)
        d.add(qr)
        d.drawOn(c, 62, box_y + 30)
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColorRGB(0.3, 0.3, 0.3)
        c.drawCentredString(100, box_y + 14, "ESCANEAR VERIFICACIÓN")
    except Exception:
        pass

    # Recuadro de Firma Conforme
    c.roundRect(185, box_y, page_w - 215, 120, 6, fill=0, stroke=1)
    c.setFont("Helvetica-Bold", 10)
    c.setFillColorRGB(0.0, 0.35, 0.65)
    c.drawString(200, box_y + 100, "CONSTANCIA DE RECEPCIÓN Y CONFORMIDAD")

    if order.firma_digital_receptor:
        c.setFont("Helvetica-Bold", 9)
        c.setFillColorRGB(0.0, 0.5, 0.2)
        c.drawString(200, box_y + 75, "✓ ENTREGADO CON CONFORMIDAD Y FIRMA DIGITAL")
        c.setFont("Helvetica", 8.5)
        c.setFillColorRGB(0.3, 0.3, 0.3)
        c.drawString(200, box_y + 55, f"Aclaración: {order.firma_aclaracion or order.contacto_receptor_nombre}")
        f_dt = order.firma_fecha_hora.strftime('%d/%m/%Y %H:%M hs') if order.firma_fecha_hora else 'Registrada'
        c.drawString(200, box_y + 40, f"Fecha y Hora: {f_dt}")
        c.drawString(200, box_y + 25, "Certificado digital verificado por sistema de telemetría Calcu 3PL.")
    else:
        c.setFont("Helvetica", 8.5)
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.drawString(200, box_y + 78, "Firma del Receptor:")
        c.line(200, box_y + 40, 360, box_y + 40)
        c.drawString(200, box_y + 28, "Firma / Rótulo")
        c.drawString(390, box_y + 78, "Aclaración & C.I.:")
        c.line(390, box_y + 40, 540, box_y + 40)
        c.drawString(390, box_y + 28, "Nombre y Documento")

    # Pie de página
    c.setFont("Helvetica", 7.5)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawCentredString(page_w / 2, 25, f"Calcu 3PL Logística & Distribución • Documento oficial no negociable • Generado el {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC")

    c.save()
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Remito_{order.numero_orden}.pdf"}
    )


# ==========================================
# RUTAS: ÓRDENES DE SERVICIO & LIQUIDACIÓN
# ==========================================

@router.post("/billing/quote")
def calculate_service_quote(payload: QuoteCalculationRequest, db: Session = Depends(get_db)):
    """Calcula la liquidación y factura de servicios 3PL para un cliente."""
    client = db.query(LogisticsClient).filter(LogisticsClient.id == payload.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    pricing = client.pricing or db.query(LogisticsServicePricing).filter(
        LogisticsServicePricing.client_id == payload.client_id
    ).first()

    t_alm = pricing.tarifa_almacenaje_pallet_dia if pricing else Decimal("0.45")
    t_hnd = pricing.tarifa_handling_bulto if pricing else Decimal("0.15")
    t_vas = pricing.tarifa_etiquetado_unidad if pricing else Decimal("0.05")
    t_flt_base = pricing.tarifa_flete_base if pricing else Decimal("45.00")
    t_flt_km = pricing.tarifa_flete_km_adicional if pricing else Decimal("1.20")

    result = LogisticsEngine.calculate_service_settlement(
        client_id=payload.client_id,
        dias_almacenaje=payload.dias_almacenaje,
        pallets=payload.pallets,
        total_bultos=payload.total_bultos,
        total_unidades=payload.total_unidades,
        tarifa_almacenaje_pallet_dia=t_alm,
        tarifa_handling_bulto=t_hnd,
        tarifa_etiquetado_unidad=t_vas,
        tarifa_flete_base=t_flt_base,
        distancia_km=payload.distancia_km,
        tarifa_flete_km_adicional=t_flt_km,
        iva_pct=payload.iva_pct,
    )
    return result


@router.get("/finance/summary")
def get_finance_summary(db: Session = Depends(get_db)):
    """
    Resumen financiero de rentabilidad 3PL: facturación por fletes, pagos a conductores y margen bruto acumulado.
    """
    orders = db.query(LogisticsDispatchOrder).all()

    facturacion_total = sum(float(o.tarifa_flete_cliente) for o in orders)
    costo_choferes_total = sum(float(o.costo_chofer_acordado) for o in orders)
    gastos_ruta_total = sum(float(o.gastos_variables_ruta) for o in orders)
    margen_bruto_total = facturacion_total - (costo_choferes_total + gastos_ruta_total)
    margen_pct = (margen_bruto_total / facturacion_total * 100.0) if facturacion_total > 0 else 0.0

    rutas_rentabilidad = []
    for o in orders[:15]:
        p = LogisticsEngine.calculate_route_profitability(
            orden_id=o.id,
            numero_orden=o.numero_orden,
            tarifa_flete_cliente=o.tarifa_flete_cliente,
            pago_conductor=o.costo_chofer_acordado,
            peajes_variables=o.gastos_variables_ruta,
        )
        rutas_rentabilidad.append(p.model_dump())

    return {
        "facturacion_fletes_total": round(facturacion_total, 2),
        "costo_choferes_total": round(costo_choferes_total, 2),
        "gastos_variables_total": round(gastos_ruta_total, 2),
        "margen_bruto_total": round(margen_bruto_total, 2),
        "margen_pct": round(margen_pct, 1),
        "total_ordenes": len(orders),
        "rutas_detalle": rutas_rentabilidad,
    }


# ==========================================
# RUTAS: GESTIÓN DE COSTOS & ANÁLISIS EBITDA 3PL
# ==========================================

@router.get("/finance/costs")
def list_cost_items(tipo: Optional[str] = None, db: Session = Depends(get_db)):
    """Lista los costos fijos y variables del depósito y logística 3PL."""
    query = db.query(LogisticsCostItem).filter(LogisticsCostItem.activo == True)
    if tipo:
        query = query.filter(LogisticsCostItem.tipo == tipo.upper())
    costs = query.order_by(LogisticsCostItem.tipo, LogisticsCostItem.id).all()
    return [
        {
            "id": c.id,
            "tipo": c.tipo,
            "categoria": c.categoria,
            "nombre": c.nombre,
            "monto_mensual": float(c.monto_mensual),
            "moneda": c.moneda,
            "descripcion": c.descripcion,
            "activo": c.activo,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in costs
    ]


@router.post("/finance/costs")
def create_cost_item(payload: CostItemCreate, db: Session = Depends(get_db)):
    """Registra un nuevo costo fijo o variable del depósito."""
    cost = LogisticsCostItem(
        tipo=payload.tipo.upper(),
        categoria=payload.categoria.upper(),
        nombre=payload.nombre.strip(),
        monto_mensual=Decimal(str(payload.monto_mensual)),
        moneda=payload.moneda.upper(),
        descripcion=payload.descripcion.strip() if payload.descripcion else None,
        activo=payload.activo,
    )
    db.add(cost)
    db.commit()
    db.refresh(cost)
    return {"message": "Costo logístico registrado con éxito", "id": cost.id}


@router.put("/finance/costs/{cost_id}")
def update_cost_item(cost_id: int, payload: CostItemUpdate, db: Session = Depends(get_db)):
    """Edita un costo fijo o variable existente."""
    cost = db.query(LogisticsCostItem).filter(LogisticsCostItem.id == cost_id).first()
    if not cost:
        raise HTTPException(status_code=404, detail="Costo no encontrado")

    if payload.tipo is not None:
        cost.tipo = payload.tipo.upper()
    if payload.categoria is not None:
        cost.categoria = payload.categoria.upper()
    if payload.nombre is not None:
        cost.nombre = payload.nombre.strip()
    if payload.monto_mensual is not None:
        cost.monto_mensual = Decimal(str(payload.monto_mensual))
    if payload.moneda is not None:
        cost.moneda = payload.moneda.upper()
    if payload.descripcion is not None:
        cost.descripcion = payload.descripcion.strip()
    if payload.activo is not None:
        cost.activo = payload.activo

    db.commit()
    db.refresh(cost)
    return {"message": "Costo actualizado con éxito", "id": cost.id}


@router.delete("/finance/costs/{cost_id}")
def delete_cost_item(cost_id: int, db: Session = Depends(get_db)):
    """Desactiva un costo logístico."""
    cost = db.query(LogisticsCostItem).filter(LogisticsCostItem.id == cost_id).first()
    if not cost:
        raise HTTPException(status_code=404, detail="Costo no encontrado")
    cost.activo = False
    db.commit()
    return {"message": "Costo desactivado con éxito"}


@router.get("/finance/ebitda")
def get_ebitda_analysis(db: Session = Depends(get_db)):
    """
    Cálculo de EBITDA Neto, Punto de Equilibrio (Break-Even) y acumulador de viajes y kilómetros.
    """
    # 1. Costos fijos y variables del depósito
    fixed_costs = db.query(func.sum(LogisticsCostItem.monto_mensual)).filter(
        LogisticsCostItem.tipo == "FIJO",
        LogisticsCostItem.activo == True
    ).scalar() or Decimal("0.0")

    var_costs_table = db.query(func.sum(LogisticsCostItem.monto_mensual)).filter(
        LogisticsCostItem.tipo == "VARIABLE",
        LogisticsCostItem.activo == True
    ).scalar() or Decimal("0.0")

    # 2. Órdenes y acumulación de viajes y kilómetros
    orders = db.query(LogisticsDispatchOrder).all()
    completed_orders = [o for o in orders if o.etapa_kanban == "ENTREGADO"]

    total_viajes = len(completed_orders)
    total_km = sum(float(o.kilometros_recorrido or 0.0) for o in completed_orders)

    ingresos_flete = sum(o.tarifa_flete_cliente for o in orders)
    costos_choferes = sum(o.costo_chofer_acordado for o in orders)
    gastos_ruta = sum(o.gastos_variables_ruta for o in orders)

    # Costos variables totales = insumos/toner/film del depósito + peajes de ruta
    costos_variables_totales = var_costs_table + gastos_ruta

    analysis = LogisticsEngine.calculate_ebitda_and_breakeven(
        ingresos_totales=ingresos_flete,
        costos_choferes=costos_choferes,
        costos_variables_extras=costos_variables_totales,
        costos_fijos_totales=fixed_costs,
        total_viajes=total_viajes,
        total_km=Decimal(str(total_km)),
    )

    res = analysis.model_dump()
    res["costos_fijos_desglose"] = [
        {"nombre": c.nombre, "categoria": c.categoria, "monto": float(c.monto_mensual)}
        for c in db.query(LogisticsCostItem).filter(LogisticsCostItem.tipo == "FIJO", LogisticsCostItem.activo == True).all()
    ]
    res["costos_variables_desglose"] = [
        {"nombre": c.nombre, "categoria": c.categoria, "monto": float(c.monto_mensual)}
        for c in db.query(LogisticsCostItem).filter(LogisticsCostItem.tipo == "VARIABLE", LogisticsCostItem.activo == True).all()
    ]
    return res



# ==========================================
# INICIALIZADOR DE DATOS SEMILLA (3PL DEMO)
# ==========================================

def seed_logistics_demo(db: Session):
    """Siembra clientes 3PL, sucursales, flota con disponibilidad, costos y órdenes si están vacías."""
    # 0. Si ya existen clientes, sembrar sucursales y costos si estuvieran vacíos
    if db.query(LogisticsClient).count() > 0:
        # Sembrar costos si está vacía
        if db.query(LogisticsCostItem).count() == 0:
            fixed_costs = [
                LogisticsCostItem(tipo="FIJO", categoria="ALQUILER", nombre="Alquiler Depósito Central Nave A (1200 m²)", monto_mensual=Decimal("145000.00"), moneda="UYU", descripcion="Contrato arrendamiento galpón logístico principal con 4 docks de carga."),
                LogisticsCostItem(tipo="FIJO", categoria="ELECTRICIDAD_UTE", nombre="Energía Eléctrica UTE (Tarifa Doble Horario)", monto_mensual=Decimal("38500.00"), moneda="UYU", descripcion="Iluminación LED nave de estiba y fuerza motriz."),
                LogisticsCostItem(tipo="FIJO", categoria="SUELDOS_OPERATIVOS", nombre="Sueldos Fijos Encargado de Depósito & Capataces", monto_mensual=Decimal("110000.00"), moneda="UYU", descripcion="Salario fijo 2 supervisores de turno y seguridad."),
                LogisticsCostItem(tipo="FIJO", categoria="COMUNICACIONES", nombre="Fibra Óptica Dedicada + WiFi Depósito + SIMs GPS", monto_mensual=Decimal("8900.00"), moneda="UYU", descripcion="Conectividad de antenas de escáneres y telemetría móvil."),
            ]
            var_costs = [
                LogisticsCostItem(tipo="VARIABLE", categoria="EMBALAJE", nombre="Film Stretch Triple Capa & Esquineros", monto_mensual=Decimal("12800.00"), moneda="UYU", descripcion="Consumo mensual para paletizado y consolidación."),
                LogisticsCostItem(tipo="VARIABLE", categoria="PAPELERIA", nombre="Etiquetas Térmicas Autoadhesivas & Tóner", monto_mensual=Decimal("6500.00"), moneda="UYU", descripcion="Rollo de etiquetas para rotulado de bultos y remitos impresos."),
                LogisticsCostItem(tipo="VARIABLE", categoria="OTROS", nombre="Precintos de Seguridad Numéricos", monto_mensual=Decimal("4200.00"), moneda="UYU", descripcion="Precintado de furgones y camiones en despacho."),
            ]
            db.add_all(fixed_costs + var_costs)
            db.commit()

        # Sembrar sucursales si está vacía
        if db.query(LogisticsClientBranch).count() == 0:
            c_first = db.query(LogisticsClient).first()
            if c_first:
                b1 = LogisticsClientBranch(client_id=c_first.id, nombre_sucursal="Sucursal 01 - Centro", direccion="18 de Julio 1420, Montevideo", contacto_receptor="Mariano García", telefono_receptor="+598 99 222 333", lat=-34.9056, lng=-56.1892, distancia_km_base=Decimal("12.5"))
                b2 = LogisticsClientBranch(client_id=c_first.id, nombre_sucursal="Sucursal 02 - Carrasco", direccion="Av. Giannattasio km 16, Canelones", contacto_receptor="Lucía Ramos", telefono_receptor="+598 98 111 222", lat=-34.8622, lng=-56.0210, distancia_km_base=Decimal("24.0"))
                db.add_all([b1, b2])
                db.commit()

        # Sembrar disponibilidad semanal para choferes existentes si no la tienen
        default_avail = '{"lunes":{"activo":true,"desde":"07:00","hasta":"18:00","turnos":"Jornada Completa"},"martes":{"activo":true,"desde":"07:00","hasta":"18:00","turnos":"Jornada Completa"},"miercoles":{"activo":true,"desde":"07:00","hasta":"18:00","turnos":"Jornada Completa"},"jueves":{"activo":true,"desde":"07:00","hasta":"18:00","turnos":"Jornada Completa"},"viernes":{"activo":true,"desde":"07:00","hasta":"18:00","turnos":"Jornada Completa"},"sabado":{"activo":true,"desde":"08:00","hasta":"13:00","turnos":"Medio Día"},"domingo":{"activo":false,"desde":"","hasta":"","turnos":"Franco"}}'
        for drv in db.query(LogisticsDriver).all():
            if not drv.disponibilidad_semanal:
                drv.disponibilidad_semanal = default_avail
        db.commit()
        return

    # 1. Clientes 3PL
    c1 = LogisticsClient(
        rut="215489720018",
        razon_social="Cadena Supermercados del Plata S.A.",
        nombre_comercial="Supermercados El Plata",
        tipo="SUPERMERCADO",
        contacto_logistica="Martín Bianchi (Jefe de Abastecimiento)",
        telefono="+598 2901 8844",
        email="logistica@supermercadoselplata.com.uy",
        direccion_central="Av. Italia 3800, Montevideo",
        condiciones_pago="45_DIAS",
    )
    c2 = LogisticsClient(
        rut="218945610014",
        razon_social="Distribuidora Alimentos y Bebidas Gourmet Ltda.",
        nombre_comercial="Alimentos Gourmet UY",
        tipo="PYME",
        contacto_logistica="Valeria Silva (Operaciones)",
        telefono="+598 2400 9911",
        email="contacto@gourmetuy.com.uy",
        direccion_central="Cno. Maldonado 5200, Montevideo",
        condiciones_pago="30_DIAS",
    )
    c3 = LogisticsClient(
        rut="213388990011",
        razon_social="Consorcio Retail & Hogar Uruguay S.A.",
        nombre_comercial="Hogar & Deco Store",
        tipo="SUPERMERCADO",
        contacto_logistica="Esteban Domínguez (Coordinador de Depósito)",
        telefono="+598 2200 4545",
        email="logistica@hogardeco.uy",
        direccion_central="Bulevar Artigas 2100, Montevideo",
        condiciones_pago="30_DIAS",
    )
    db.add_all([c1, c2, c3])
    db.flush()

    # Tarifarios acordados
    p1 = LogisticsServicePricing(client_id=c1.id, tarifa_almacenaje_pallet_dia=Decimal("0.40"), tarifa_handling_bulto=Decimal("0.12"), tarifa_etiquetado_unidad=Decimal("0.04"), tarifa_flete_base=Decimal("55.00"), tarifa_flete_km_adicional=Decimal("1.10"))
    p2 = LogisticsServicePricing(client_id=c2.id, tarifa_almacenaje_pallet_dia=Decimal("0.50"), tarifa_handling_bulto=Decimal("0.18"), tarifa_etiquetado_unidad=Decimal("0.06"), tarifa_flete_base=Decimal("45.00"), tarifa_flete_km_adicional=Decimal("1.35"))
    p3 = LogisticsServicePricing(client_id=c3.id, tarifa_almacenaje_pallet_dia=Decimal("0.45"), tarifa_handling_bulto=Decimal("0.15"), tarifa_etiquetado_unidad=Decimal("0.05"), tarifa_flete_base=Decimal("60.00"), tarifa_flete_km_adicional=Decimal("1.25"))
    db.add_all([p1, p2, p3])

    # 2. Choferes
    d1 = LogisticsDriver(nombre="Carlos 'El Rápido' Méndez", documento="3.456.789-2", telefono="+598 99 123 456", tipo_licencia="CAT_C", tipo_relacion="FLETERO_TERCERIZADO", tarifa_base_viaje=Decimal("38.00"), tarifa_km=Decimal("0.90"))
    d2 = LogisticsDriver(nombre="Gonzalo Silva Larrosa", documento="4.123.890-5", telefono="+598 98 456 789", tipo_licencia="CAT_F", tipo_relacion="FLETERO_TERCERIZADO", tarifa_base_viaje=Decimal("45.00"), tarifa_km=Decimal("1.05"))
    d3 = LogisticsDriver(nombre="Martín Cabrera Techera", documento="4.876.543-1", telefono="+598 94 789 012", tipo_licencia="CAT_B", tipo_relacion="CADETE", tarifa_base_viaje=Decimal("25.00"), tarifa_km=Decimal("0.70"))
    db.add_all([d1, d2, d3])
    db.flush()

    # 3. Flota Vehicular
    v1 = LogisticsVehicle(driver_id=d1.id, matricula="STP-1842", tipo_vehiculo="FURGON", capacidad_kg=Decimal("1800.00"), volumen_m3=Decimal("14.50"), capacidad_pallets=4)
    v2 = LogisticsVehicle(driver_id=d2.id, matricula="SRA-9034", tipo_vehiculo="CAMION_PLATAFORMA", capacidad_kg=Decimal("6500.00"), volumen_m3=Decimal("32.00"), capacidad_pallets=10)
    v3 = LogisticsVehicle(driver_id=d3.id, matricula="SAA-4411", tipo_vehiculo="UTILITARIO", capacidad_kg=Decimal("750.00"), volumen_m3=Decimal("4.20"), capacidad_pallets=1)
    db.add_all([v1, v2, v3])
    db.flush()

    # 4. Inventario de Terceros
    inv1 = LogisticsClientInventory(client_id=c1.id, sku_cliente="ELP-ACEITE-1L", descripcion="Aceite de Girasol Alto Oleico 1L x 12", categoria="COMESTIBLES", cantidad_bultos=120, unidades_por_bulto=12, volumen_unitario_m3=Decimal("0.024"), peso_unitario_kg=Decimal("11.5"), ubicacion_rack="RACK-A-01-01", codigo_qr_lote="3PL-2154-ELP-ACEITE-001", lote="L-2026-03")
    inv2 = LogisticsClientInventory(client_id=c1.id, sku_cliente="ELP-ARROZ-1KG", descripcion="Arroz Pulido Grano Largo 1kg x 20", categoria="COMESTIBLES", cantidad_bultos=200, unidades_por_bulto=20, volumen_unitario_m3=Decimal("0.028"), peso_unitario_kg=Decimal("20.2"), ubicacion_rack="RACK-A-01-02", codigo_qr_lote="3PL-2154-ELP-ARROZ-002", lote="L-2026-04")
    inv3 = LogisticsClientInventory(client_id=c2.id, sku_cliente="GOUR-PASTA-ART", descripcion="Pasta Seca Italiana Penne 500g x 16", categoria="GOURMET", cantidad_bultos=85, unidades_por_bulto=16, volumen_unitario_m3=Decimal("0.018"), peso_unitario_kg=Decimal("8.4"), ubicacion_rack="RACK-B-02-03", codigo_qr_lote="3PL-2189-GOUR-PASTA-003", lote="L-2026-02")
    inv4 = LogisticsClientInventory(client_id=c3.id, sku_cliente="HOGAR-LAMP-LED", descripcion="Lámparas LED Cálidas 9W Pack x 24", categoria="HOGAR", cantidad_bultos=150, unidades_por_bulto=24, volumen_unitario_m3=Decimal("0.035"), peso_unitario_kg=Decimal("3.2"), ubicacion_rack="RACK-C-03-01", codigo_qr_lote="3PL-2133-HOGAR-LAMP-004", lote="L-2026-01")
    db.add_all([inv1, inv2, inv3, inv4])
    db.flush()

    # 5. Órdenes en el Kanban Operativo (1 en cada etapa)
    # Etapa 1: INGRESO
    o1 = LogisticsDispatchOrder(
        numero_orden="3PL-ORD-2601-A1",
        client_id=c1.id,
        etapa_kanban="INGRESO",
        destino_direccion="Sucursal Centro - 18 de Julio 1420, Montevideo",
        destino_coordenadas="-34.9056,-56.1892",
        ventana_horaria="08:00 - 11:00",
        remito_numero="REM-99120",
        total_bultos=35,
        total_kg=Decimal("402.5"),
        total_m3=Decimal("0.84"),
        tarifa_flete_cliente=Decimal("65.00"),
        costo_chofer_acordado=Decimal("0.0"),
        margen_neto_estimado=Decimal("65.00"),
    )
    # Etapa 2: ETIQUETADO_VAS
    o2 = LogisticsDispatchOrder(
        numero_orden="3PL-ORD-2601-B2",
        client_id=c2.id,
        etapa_kanban="ETIQUETADO_VAS",
        destino_direccion="Depósito Pocitos - Av. Brasil 2800, Montevideo",
        destino_coordenadas="-34.9189,-56.1511",
        ventana_horaria="13:00 - 16:00",
        remito_numero="REM-99121",
        total_bultos=40,
        total_kg=Decimal("336.0"),
        total_m3=Decimal("0.72"),
        tarifa_flete_cliente=Decimal("55.00"),
        costo_chofer_acordado=Decimal("0.0"),
        margen_neto_estimado=Decimal("55.00"),
    )
    # Etapa 3: LISTO_DESPACHO (Con Chofer y Vehículo asignados)
    o3 = LogisticsDispatchOrder(
        numero_orden="3PL-ORD-2601-C3",
        client_id=c3.id,
        vehicle_id=v1.id,
        driver_id=d1.id,
        etapa_kanban="LISTO_DESPACHO",
        destino_direccion="Shopping Tres Cruces - Bv. Artigas 1825, Montevideo",
        destino_coordenadas="-34.8944,-56.1664",
        ventana_horaria="09:00 - 12:00",
        remito_numero="REM-99122",
        total_bultos=60,
        total_kg=Decimal("192.0"),
        total_m3=Decimal("2.10"),
        tarifa_flete_cliente=Decimal("70.00"),
        costo_chofer_acordado=Decimal("38.00"),
        gastos_variables_ruta=Decimal("5.00"),
        margen_neto_estimado=Decimal("27.00"),
    )
    # Etapa 4: EN_DISTRIBUCION (Con telemetría activa)
    o4 = LogisticsDispatchOrder(
        numero_orden="3PL-ORD-2601-D4",
        client_id=c1.id,
        vehicle_id=v2.id,
        driver_id=d2.id,
        etapa_kanban="EN_DISTRIBUCION",
        destino_direccion="Hipermercado Carrasco - Av. Giannattasio km 16, Canelones",
        destino_coordenadas="-34.8622,-56.0210",
        ventana_horaria="11:00 - 14:00",
        remito_numero="REM-99123",
        total_bultos=110,
        total_kg=Decimal("1650.0"),
        total_m3=Decimal("4.50"),
        tarifa_flete_cliente=Decimal("110.00"),
        costo_chofer_acordado=Decimal("55.00"),
        gastos_variables_ruta=Decimal("8.00"),
        margen_neto_estimado=Decimal("47.00"),
    )
    # Etapa 5: ENTREGADO
    o5 = LogisticsDispatchOrder(
        numero_orden="3PL-ORD-2601-E5",
        client_id=c2.id,
        vehicle_id=v3.id,
        driver_id=d3.id,
        etapa_kanban="ENTREGADO",
        destino_direccion="Restaurante Gourmet Punta Carretas - Ellauri 350, Montevideo",
        destino_coordenadas="-34.9250,-56.1580",
        ventana_horaria="08:30 - 10:30",
        remito_numero="REM-99119",
        total_bultos=20,
        total_kg=Decimal("168.0"),
        total_m3=Decimal("0.36"),
        tarifa_flete_cliente=Decimal("48.00"),
        costo_chofer_acordado=Decimal("25.00"),
        gastos_variables_ruta=Decimal("3.00"),
        margen_neto_estimado=Decimal("20.00"),
        fecha_entrega_real=datetime.utcnow() - timedelta(hours=2),
    )
    db.add_all([o1, o2, o3, o4, o5])
    db.flush()

    # Telemetría para orden en tránsito (o4)
    ping1 = LogisticsTelemetryPing(order_id=o4.id, lat=-34.8810, lng=-56.1250, velocidad_kmh=42.0, bateria_pct=92, timestamp=datetime.utcnow() - timedelta(minutes=15))
    ping2 = LogisticsTelemetryPing(order_id=o4.id, lat=-34.8720, lng=-56.0820, velocidad_kmh=48.5, bateria_pct=90, timestamp=datetime.utcnow() - timedelta(minutes=5))
    ping3 = LogisticsTelemetryPing(order_id=o4.id, lat=-34.8650, lng=-56.0450, velocidad_kmh=36.0, bateria_pct=89, timestamp=datetime.utcnow())
    db.add_all([ping1, ping2, ping3])

    db.commit()
