import pytest
from decimal import Decimal, ROUND_HALF_UP
from starlette.testclient import TestClient

from app.database.session import SessionLocal
from app.models.entities import Warehouse, WarehouseSlot
from app.services.digital_twin_service import DigitalTwinService
from app.main import app

client = TestClient(app)

WH_TEST_ID = "WH-TEST-COORDS"


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    # Limpieza previa
    db.query(WarehouseSlot).filter(WarehouseSlot.warehouse_id == WH_TEST_ID).delete()
    db.query(Warehouse).filter(Warehouse.id == WH_TEST_ID).delete()
    db.commit()

    # Depósito de pruebas
    wh = Warehouse(
        id=WH_TEST_ID,
        nombre="Depósito Central Test Coordenadas",
        tipo="CENTRAL",
        module_scope="SUPPLY_CHAIN",
        ubicacion="Montevideo, Uruguay",
        capacidad_unidades=5000,
        superficie_m2=Decimal("1200.0000"),
        volumen_max_m3=Decimal("8000.0000"),
        capacidad_peso_kg=Decimal("500000.0000"),
        altura_max_m=Decimal("8.5000"),
        activo=True,
    )
    db.add(wh)
    db.commit()

    # Crear slots de prueba: A-01-01 (OCUPADA), A-01-02 (VACIA), B-01-01 (VACIA)
    slot_a1 = WarehouseSlot(
        id=f"{WH_TEST_ID}:A-01-01",
        warehouse_id=WH_TEST_ID,
        module_scope="SUPPLY_CHAIN",
        slot_code="A-01-01",
        cuerpo="A",
        rack="01",
        nivel=1,
        posicion=1,
        estado="OCUPADA",
        sku="SKU-COORDS-001",
        lote="LOTE-2026-X",
        descripcion="Pintura Vial Reflectiva",
        cantidad=Decimal("50.0000"),
        peso_actual_kg=Decimal("250.0000"),
        peso_max_kg=Decimal("1200.0000"),
        volumen_actual_m3=Decimal("1.2000"),
        volumen_max_m3=Decimal("1.8000"),
        altura_m=Decimal("1.6500"),
        valor_estimado=Decimal("2500.0000"),
        pallets_count=1,
        cajas_count=20,
        units_count=20,
        position_x=Decimal("2.5000"),
        position_y=Decimal("1.0000"),
        position_z=Decimal("3.0000"),
    )

    slot_a2 = WarehouseSlot(
        id=f"{WH_TEST_ID}:A-01-02",
        warehouse_id=WH_TEST_ID,
        module_scope="SUPPLY_CHAIN",
        slot_code="A-01-02",
        cuerpo="A",
        rack="01",
        nivel=1,
        posicion=2,
        estado="VACIA",
        sku=None,
        lote=None,
        descripcion=None,
        cantidad=Decimal("0.0000"),
        peso_actual_kg=Decimal("0.0000"),
        peso_max_kg=Decimal("1200.0000"),
        volumen_actual_m3=Decimal("0.0000"),
        volumen_max_m3=Decimal("1.8000"),
        altura_m=Decimal("1.6500"),
        valor_estimado=Decimal("0.0000"),
        pallets_count=0,
        cajas_count=0,
        units_count=0,
        position_x=Decimal("5.0000"),
        position_y=Decimal("1.0000"),
        position_z=Decimal("3.0000"),
    )

    slot_b1 = WarehouseSlot(
        id=f"{WH_TEST_ID}:B-01-01",
        warehouse_id=WH_TEST_ID,
        module_scope="SUPPLY_CHAIN",
        slot_code="B-01-01",
        cuerpo="B",
        rack="01",
        nivel=1,
        posicion=1,
        estado="VACIA",
        sku=None,
        lote=None,
        descripcion=None,
        cantidad=Decimal("0.0000"),
        peso_actual_kg=Decimal("0.0000"),
        peso_max_kg=Decimal("1200.0000"),
        volumen_actual_m3=Decimal("0.0000"),
        volumen_max_m3=Decimal("1.8000"),
        altura_m=Decimal("1.6500"),
        valor_estimado=Decimal("0.0000"),
        pallets_count=0,
        cajas_count=0,
        units_count=0,
        position_x=Decimal("2.5000"),
        position_y=Decimal("1.0000"),
        position_z=Decimal("8.0000"),
    )

    db.add_all([slot_a1, slot_a2, slot_b1])
    db.commit()

    yield db

    # Limpieza posterior
    db.query(WarehouseSlot).filter(WarehouseSlot.warehouse_id == WH_TEST_ID).delete()
    db.query(Warehouse).filter(Warehouse.id == WH_TEST_ID).delete()
    db.commit()
    db.close()


def test_get_slots_empty_filter(db_session):
    """
    Verifica que el filtro de slots vacíos retorne únicamente posiciones con estado VACIA.
    """
    response = client.get(f"/api/v1/digital-twin/slots?warehouse_id={WH_TEST_ID}&estado=VACIA")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    for slot in data:
        assert slot["estado"] == "VACIA"
        assert slot["warehouse_id"] == WH_TEST_ID


def test_transfer_to_free_coordinate_no_duplicates(db_session):
    """
    Verifica que al reubicar la carga completa a una coordenada libre:
    1. El slot origen pase a estado 'VACIA', con cantidad = 0 y sin SKU.
    2. El slot destino pase a estado 'OCUPADA', con la cantidad y SKU transferidos.
    3. No existan posiciones duplicadas ocupadas con el mismo lote/SKU.
    """
    result = DigitalTwinService.transfer_stock(
        db=db_session,
        source_warehouse_id=WH_TEST_ID,
        source_slot_code="A-01-01",
        target_warehouse_id=WH_TEST_ID,
        target_slot_code="A-01-02",
        mover_lote_completo=True,
    )

    assert result["success"] is True
    assert result["target_slot"] == "A-01-02"

    src = db_session.query(WarehouseSlot).filter(WarehouseSlot.id == f"{WH_TEST_ID}:A-01-01").first()
    tgt = db_session.query(WarehouseSlot).filter(WarehouseSlot.id == f"{WH_TEST_ID}:A-01-02").first()

    # Origen debe estar libre
    assert src.estado == "VACIA"
    assert src.sku is None
    assert src.cantidad == Decimal("0.0000")
    assert src.cajas_count == 0

    # Destino debe estar ocupado
    assert tgt.estado == "OCUPADA"
    assert tgt.sku == "SKU-COORDS-001"
    assert tgt.cantidad == Decimal("50.0000")
    assert tgt.cajas_count == 20

    # Total de slots ocupados entre A-01-01 y A-01-02 debe ser estrictamente 1
    occupied_count = (
        db_session.query(WarehouseSlot)
        .filter(
            WarehouseSlot.warehouse_id == WH_TEST_ID,
            WarehouseSlot.slot_code.in_(["A-01-01", "A-01-02"]),
            WarehouseSlot.estado == "OCUPADA",
        )
        .count()
    )
    assert occupied_count == 1


def test_transfer_partial_quantity_decimal_precision(db_session):
    """
    Verifica transferencia parcial con precisión Decimal y ROUND_HALF_UP.
    """
    # Mover 20.5000 unidades de A-01-02 (que tiene 50.0000) a B-01-01
    result = DigitalTwinService.transfer_stock(
        db=db_session,
        source_warehouse_id=WH_TEST_ID,
        source_slot_code="A-01-02",
        target_warehouse_id=WH_TEST_ID,
        target_slot_code="B-01-01",
        cantidad_a_mover=Decimal("20.5000"),
        mover_lote_completo=False,
    )

    assert result["success"] is True

    src = db_session.query(WarehouseSlot).filter(WarehouseSlot.id == f"{WH_TEST_ID}:A-01-02").first()
    tgt = db_session.query(WarehouseSlot).filter(WarehouseSlot.id == f"{WH_TEST_ID}:B-01-01").first()

    assert src.estado == "OCUPADA"
    assert src.cantidad == Decimal("29.5000")

    assert tgt.estado == "OCUPADA"
    assert tgt.cantidad == Decimal("20.5000")
    assert tgt.sku == "SKU-COORDS-001"

    total_qty = (src.cantidad + tgt.cantidad).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    assert total_qty == Decimal("50.0000")


def test_transfer_locked_hard_reserved(db_session):
    """
    Verifica que una posición con reserva dura (HARD_RESERVED) no pueda transferirse
    y arroje error de candado (HTTP 423 Locked).
    """
    slot = db_session.query(WarehouseSlot).filter(WarehouseSlot.id == f"{WH_TEST_ID}:B-01-01").first()
    slot.reservation_type = "HARD_RESERVED"
    slot.reserved_organism = "Intendencia de Montevideo"
    slot.reservation_order_id = "LIC-IM-2026-99"
    db_session.commit()

    with pytest.raises(ValueError) as excinfo:
        DigitalTwinService.transfer_stock(
            db=db_session,
            source_warehouse_id=WH_TEST_ID,
            source_slot_code="B-01-01",
            target_warehouse_id=WH_TEST_ID,
            target_slot_code="A-01-01",
            mover_lote_completo=True,
        )

    assert "HTTP 423 Locked" in str(excinfo.value)
    assert "HARD_RESERVED" in str(excinfo.value)


def test_transfer_api_endpoint_validation(db_session):
    """
    Verifica que el endpoint /transfer valide los campos Pydantic y rechace cantidades <= 0.
    """
    # Intentar enviar cantidad negativa
    payload = {
        "source_warehouse_id": WH_TEST_ID,
        "source_slot_code": "A-01-02",
        "target_warehouse_id": WH_TEST_ID,
        "target_slot_code": "A-01-01",
        "mover_lote_completo": False,
        "cantidad_a_mover": -10.0,
    }
    response = client.post("/api/v1/digital-twin/transfer", json=payload)
    assert response.status_code == 422
