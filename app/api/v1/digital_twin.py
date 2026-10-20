from typing import List, Optional, Dict, Any
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.services.digital_twin_service import DigitalTwinService
from app.models.entities import Warehouse

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
