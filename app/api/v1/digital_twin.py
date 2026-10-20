from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.services.digital_twin_service import DigitalTwinService
from app.models.entities import Warehouse
from app.domain.schemas import (
    WarehouseDimensionsUpdate,
    RackDimensionsUpdate,
    SlotItemSpecsUpdate,
)

router = APIRouter(prefix="/digital-twin", tags=["Digital Twin 3D Universal"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class CreateWarehousePayload(BaseModel):
    id: str
    nombre: str
    tipo: str = "SUCURSAL" # 'CENTRAL', 'SUCURSAL', 'TRANSITO', 'FABRICA', 'INTERNACIONAL', 'URUGUAY'
    module_scope: str = "SUPPLY_CHAIN" # '3PL' o 'SUPPLY_CHAIN'
    ubicacion: str
    pais: str = "Uruguay"
    capacidad_unidades: int = 20000
    superficie_m2: float = 1200.0
    volumen_max_m3: float = 7200.0
    capacidad_peso_kg: float = 500000.0
    altura_max_m: float = 8.5


class TransferStockPayload(BaseModel):
    source_warehouse_id: str
    source_slot_code: str
    target_warehouse_id: str
    target_slot_code: str
    cantidad_a_mover: Optional[float] = None
    mover_lote_completo: bool = True


class OptimizeSlottingPayload(BaseModel):
    warehouse_id: str


class SyncRealInventoryPayload(BaseModel):
    warehouse_id: Optional[str] = None
    all_warehouses: bool = False
    module_scope: Optional[str] = None


@router.get("/warehouses")
def get_digital_twin_warehouses(
    module_scope: Optional[str] = Query(None, description="Filtra por '3PL' o 'SUPPLY_CHAIN'"),
    db: Session = Depends(get_db),
):
    """
    Retorna el listado de depósitos y almacenes para el Gemelo Digital 3D,
    filtrado por módulo (3PL vs Supply Chain).
    """
    # Asegurar inicialización de almacenes por defecto
    DigitalTwinService.ensure_default_warehouses_and_slots(db, module_scope=module_scope)
    return DigitalTwinService.get_warehouses(db, module_scope=module_scope)


@router.post("/warehouses", status_code=status.HTTP_201_CREATED)
def create_digital_twin_warehouse(
    payload: CreateWarehousePayload,
    db: Session = Depends(get_db),
):
    """
    Crea un nuevo depósito en el módulo correspondiente ('3PL' o 'SUPPLY_CHAIN')
    y genera automáticamente su grilla tridimensional de racks.
    """
    existing = db.query(Warehouse).filter(Warehouse.id == payload.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El depósito con código '{payload.id}' ya existe.",
        )

    wh = Warehouse(
        id=payload.id,
        nombre=payload.nombre,
        tipo=payload.tipo,
        module_scope=payload.module_scope,
        ubicacion=payload.ubicacion,
        pais=payload.pais,
        capacidad_unidades=payload.capacidad_unidades,
        superficie_m2=Decimal(str(payload.superficie_m2)),
        volumen_max_m3=Decimal(str(payload.volumen_max_m3)),
        capacidad_peso_kg=Decimal(str(payload.capacidad_peso_kg)),
        altura_max_m=Decimal(str(payload.altura_max_m)),
        activo=True,
    )
    db.add(wh)
    db.flush()

    if payload.tipo == "TRANSITO":
        DigitalTwinService._seed_maritime_slots(db, payload.id)
    else:
        DigitalTwinService._seed_terrestrial_slots(db, payload.id, payload.module_scope, is_large=True)

    db.commit()

    return {
        "id": wh.id,
        "nombre": wh.nombre,
        "tipo": wh.tipo,
        "module_scope": wh.module_scope,
        "message": "Depósito y grilla 3D creados exitosamente.",
    }


@router.patch("/warehouses/{warehouse_id}/dimensions")
def update_warehouse_dimensions_endpoint(
    warehouse_id: str,
    payload: WarehouseDimensionsUpdate,
    db: Session = Depends(get_db),
):
    """
    Actualiza las dimensiones paramétricas del edificio/nave del depósito (ancho, largo, altura libre)
    y recalcula la superficie m² y volumen máximo m³ con Decimal.
    """
    try:
        return DigitalTwinService.update_warehouse_dimensions(
            db=db,
            warehouse_id=warehouse_id,
            width_m=payload.width_m,
            length_m=payload.length_m,
            clear_height_m=payload.clear_height_m,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.patch("/racks/{warehouse_id}/{cuerpo}/dimensions")
def update_rack_dimensions_endpoint(
    warehouse_id: str,
    cuerpo: str,
    payload: RackDimensionsUpdate,
    db: Session = Depends(get_db),
):
    """
    Actualiza la geometría paramétrica estructural de una estantería / cuerpo
    (ancho, alto, profundidad, cantidad de niveles, carga máx) y recalcula desvíos en vivo.
    """
    try:
        return DigitalTwinService.update_rack_dimensions(
            db=db,
            warehouse_id=warehouse_id,
            cuerpo=cuerpo,
            rack_width_m=payload.rack_width_m,
            rack_height_m=payload.rack_height_m,
            rack_depth_m=payload.rack_depth_m,
            levels_count=payload.levels_count,
            max_rack_weight_kg=payload.max_rack_weight_kg,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.patch("/slots/{slot_id}/item-specs")
def update_slot_item_specs_endpoint(
    slot_id: str,
    payload: SlotItemSpecsUpdate,
    db: Session = Depends(get_db),
):
    """
    Actualiza dimensiones reales de caja/bulto (ancho, alto, largo, peso unitario, unidades)
    y vincula opcionalmente con un SKU real del catálogo de Calcu con detección de desvíos físicos.
    """
    try:
        return DigitalTwinService.update_slot_item_specs(
            db=db,
            slot_id=slot_id,
            box_width_m=payload.box_width_m,
            box_height_m=payload.box_height_m,
            box_length_m=payload.box_length_m,
            unit_weight_kg=payload.unit_weight_kg,
            units_count=payload.units_count,
            real_product_id=payload.real_product_id,
            lote=payload.lote,
            descripcion=payload.descripcion,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/products")
def get_digital_twin_products(
    db: Session = Depends(get_db),
):
    """
    Retorna el catálogo real de productos de Calcu para el selector de inventario en el 3D.
    """
    return DigitalTwinService.get_real_products_catalog(db)


@router.post("/sync-real-inventory")
def sync_real_inventory_endpoint(
    payload: SyncRealInventoryPayload,
    db: Session = Depends(get_db),
):
    """
    Sincroniza en 1 clic el catálogo e inventario real de Calcu (PostgreSQL 16)
    con las posiciones 3D del Gemelo Digital, aplicando algoritmo de cubicaje
    y reglas de auto-slotting físico con Decimal (ROUND_HALF_UP).
    """
    try:
        return DigitalTwinService.sync_real_inventory(
            db=db,
            warehouse_id=payload.warehouse_id,
            all_warehouses=payload.all_warehouses,
            module_scope=payload.module_scope,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/slots")
def get_digital_twin_slots(
    warehouse_id: str = Query(..., description="ID del depósito"),
    cuerpo: Optional[str] = Query(None, description="Filtro por cuerpo de rack (ej. 'A', 'F', 'BAY-01')"),
    estado: Optional[str] = Query(None, description="Filtro de estado ('VACIA', 'OCUPADA', 'BLOQUEADA')"),
    rop_status: Optional[str] = Query(None, description="Filtro Kanban ('CRITICO_ROP', 'ALERTA_DOH', 'OPTIMO')"),
    search: Optional[str] = Query(None, description="Búsqueda por código, SKU o lote"),
    db: Session = Depends(get_db),
):
    """
    Obtiene las coordenadas y estados de todas las posiciones 3D para el visor Three.js.
    """
    # Garantizar presencia de datos
    DigitalTwinService.ensure_default_warehouses_and_slots(db)
    return DigitalTwinService.get_slots(
        db,
        warehouse_id=warehouse_id,
        cuerpo=cuerpo,
        estado=estado,
        rop_status=rop_status,
        search=search,
    )


@router.get("/intelligence-summary")
def get_warehouse_intelligence_summary(
    warehouse_id: str = Query(..., description="ID del depósito"),
    db: Session = Depends(get_db),
):
    """
    Centro de control WAREHOUSE INTELLIGENCE:
    1. [📦 Operativo]
    2. [⚠️ Riesgos]
    3. [📐 Capacidad real]
    """
    DigitalTwinService.ensure_default_warehouses_and_slots(db)
    return DigitalTwinService.calculate_intelligence_summary(db, warehouse_id=warehouse_id)


@router.post("/transfer")
def transfer_stock_between_slots(
    payload: TransferStockPayload,
    db: Session = Depends(get_db),
):
    """
    Mueve pallets, cajas o lotes de una posición a otra (intra-depósito)
    o de un depósito a otro (inter-depósito, ej: Alta Mar ➔ Montevideo).
    """
    try:
        result = DigitalTwinService.transfer_stock(
            db,
            source_warehouse_id=payload.source_warehouse_id,
            source_slot_code=payload.source_slot_code,
            target_warehouse_id=payload.target_warehouse_id,
            target_slot_code=payload.target_slot_code,
            cantidad_a_mover=payload.cantidad_a_mover,
            mover_lote_completo=payload.mover_lote_completo,
        )
        return result
    except ValueError as e:
        if "423" in str(e):
            raise HTTPException(status_code=status.HTTP_423_LOCKED, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en transferencia: {str(e)}",
        )


@router.post("/optimize-slotting")
async def optimize_warehouse_slotting(
    payload: OptimizeSlottingPayload,
    db: Session = Depends(get_db),
):
    """
    Ejecuta el motor de optimización de Slotting con IA Local ('qwen2.5:3b') y heurística BCNF.
    """
    return await DigitalTwinService.optimize_slotting_with_ai(db, warehouse_id=payload.warehouse_id)


@router.post("/seed-demo")
def seed_demo_digital_twin(db: Session = Depends(get_db)):
    """
    Regenera y asegura los depósitos y grilla de slots 3D de prueba.
    """
    DigitalTwinService.ensure_default_warehouses_and_slots(db)
    return {"message": "Datos de Gemelo Digital 3D inicializados correctamente."}

from fastapi import WebSocket, WebSocketDisconnect
from app.engine.inventory import calculate_3d_load_plan, recommend_container_filler_skus


# ============================================================================
# WEBSOCKET CONNECTION MANAGER PARA RECEPCIÓN EN VIVO 3D
# ============================================================================

class DigitalTwinConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

ws_manager = DigitalTwinConnectionManager()


@router.websocket("/ws")
async def digital_twin_websocket(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


# ============================================================================
# SIMULADOR 3D DE CUBICAJE (LOAD PLANNER) & BOTÓN IA 98%
# ============================================================================

class LoadPlanRequest(BaseModel):
    container_type: str = "40HQ"
    items: List[Dict[str, Any]]
    enforce_lifo: bool = False


class FillAIRequest(BaseModel):
    container_type: str = "40HQ"
    current_load_plan: Dict[str, Any]
    candidate_skus: Optional[List[Dict[str, Any]]] = None
    target_occupancy_pct: float = 98.0


@router.post("/container-load-planner")
def plan_container_load(payload: LoadPlanRequest):
    return calculate_3d_load_plan(
        container_type=payload.container_type,
        items=payload.items,
        enforce_lifo=payload.enforce_lifo,
    )


@router.post("/container-load-planner/fill-ai")
def fill_container_with_ai(
    payload: FillAIRequest,
    db: Session = Depends(get_db),
):
    candidates = payload.candidate_skus
    if not candidates:
        prods = DigitalTwinService.get_real_products_catalog(db)
        candidates = [
            {
                "sku": p["sku"],
                "description": p["nombre"],
                "box_width_m": 0.40,
                "box_height_m": 0.30,
                "box_length_m": 0.40,
                "unit_weight_kg": 6.0,
                "unit_cost_usd": p["costo_base"],
                "unit_price_usd": p["precio_lista"],
                "rop_status": "CRITICO_ROP",
                "rotation_class": "A",
            }
            for p in prods[:10]
        ]

    return recommend_container_filler_skus(
        container_type=payload.container_type,
        current_load_plan=payload.current_load_plan,
        candidate_skus=candidates,
        target_occupancy_pct=Decimal(str(payload.target_occupancy_pct)),
    )


# ============================================================================
# RESERVA FÍSICA 3D: DOBLE CANDADO SICE / COTIZADOR B2B
# ============================================================================

class ReserveSlotRequest(BaseModel):
    warehouse_id: str
    slot_code: str
    reservation_type: str = "HARD_RESERVED"
    order_id: str
    organism: str
    user_name: str = "Sebastian Rodriguez"
    duration_days: int = 7


class ReleaseSlotRequest(BaseModel):
    warehouse_id: str
    slot_code: str
    is_controller_admin: bool = False
    order_id: Optional[str] = None


@router.post("/reserve-slot")
async def reserve_warehouse_slot(
    payload: ReserveSlotRequest,
    db: Session = Depends(get_db),
):
    try:
        res = DigitalTwinService.reserve_slot(
            db,
            warehouse_id=payload.warehouse_id,
            slot_code=payload.slot_code,
            reservation_type=payload.reservation_type,
            order_id=payload.order_id,
            organism=payload.organism,
            user_name=payload.user_name,
            duration_days=payload.duration_days,
        )
        await ws_manager.broadcast({
            "event": "SLOT_RESERVED",
            "warehouse_id": payload.warehouse_id,
            "slot_code": payload.slot_code,
            "reservation_type": payload.reservation_type,
            "organism": payload.organism,
            "order_id": payload.order_id,
        })
        return res
    except ValueError as e:
        if "423" in str(e):
            raise HTTPException(status_code=status.HTTP_423_LOCKED, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/release-slot")
async def release_warehouse_slot(
    payload: ReleaseSlotRequest,
    db: Session = Depends(get_db),
):
    try:
        res = DigitalTwinService.release_slot_reservation(
            db,
            warehouse_id=payload.warehouse_id,
            slot_code=payload.slot_code,
            is_controller_admin=payload.is_controller_admin,
            order_id=payload.order_id,
        )
        await ws_manager.broadcast({
            "event": "SLOT_RELEASED",
            "warehouse_id": payload.warehouse_id,
            "slot_code": payload.slot_code,
        })
        return res
    except ValueError as e:
        if "423" in str(e):
            raise HTTPException(status_code=status.HTTP_423_LOCKED, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============================================================================
# RECEPCIÓN INTELIGENTE CON QR FIRMADO HMAC-SHA256 & WEBSOCKETS EN VIVO
# ============================================================================

class GenerateQRRequest(BaseModel):
    warehouse_id: str
    slot_code: str
    sku: str
    lote: str
    units_count: int = 24


class ScanQRRequest(BaseModel):
    qr_token: str


@router.post("/generate-qr-label")
def generate_qr_label(payload: GenerateQRRequest):
    return DigitalTwinService.generate_signed_qr_label(
        warehouse_id=payload.warehouse_id,
        slot_code=payload.slot_code,
        sku=payload.sku,
        lote=payload.lote,
        units_count=payload.units_count,
    )


@router.post("/scan-qr-receive")
async def scan_qr_and_receive(
    payload: ScanQRRequest,
    db: Session = Depends(get_db),
):
    try:
        result = DigitalTwinService.verify_and_receive_qr(db, qr_token=payload.qr_token)
        await ws_manager.broadcast({
            "event": "BOX_RECEIVED_LIVE",
            "warehouse_id": result["warehouse_id"],
            "slot_code": result["slot_code"],
            "sku": result["sku"],
            "lote": result["lote"],
            "units_count": result["units_count"],
            "cajas_count": result["cajas_count"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
