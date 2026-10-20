import pytest
from decimal import Decimal
from starlette.testclient import TestClient

from app.database.session import SessionLocal
from app.models.entities import Warehouse, WarehouseSlot, WarehouseRack
from app.services.digital_twin_service import DigitalTwinService
from app.main import app

client = TestClient(app)


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    wh_id = "WH-TEST-SPATIAL-RACK"
    db.query(WarehouseSlot).filter(WarehouseSlot.warehouse_id == wh_id).delete()
    db.query(WarehouseRack).filter(WarehouseRack.warehouse_id == wh_id).delete()
    db.query(Warehouse).filter(Warehouse.id == wh_id).delete()
    db.commit()

    wh = Warehouse(
        id=wh_id,
        nombre="Depósito de Prueba Movimiento Espacial 3D",
        tipo="CENTRAL",
        module_scope="SUPPLY_CHAIN",
        ubicacion="Montevideo, Uruguay",
        capacidad_unidades=10000,
        superficie_m2=Decimal("2000.0000"),
        volumen_max_m3=Decimal("12000.0000"),
        capacidad_peso_kg=Decimal("1000000.0000"),
        altura_max_m=Decimal("10.0000"),
        width_m=Decimal("40.0000"),
        length_m=Decimal("60.0000"),
        clear_height_m=Decimal("10.0000"),
        activo=True,
    )
    db.add(wh)
    db.commit()

    # Rack 1: "Cuerpo A" en X=-10.0m, Z=0.0m
    DigitalTwinService.create_rack(
        db=db,
        warehouse_id=wh_id,
        rack_code="Cuerpo A",
        rack_width_m=Decimal("2.4000"),
        rack_height_m=Decimal("6.0000"),
        rack_depth_m=Decimal("1.2000"),
        levels_count=4,
        max_weight_kg=Decimal("3000.0000"),
        zone_code="ZONA-NORTE",
        racks_count=2,
        positions_per_level=3,
        pos_x_m=Decimal("-10.0000"),
        pos_z_m=Decimal("0.0000"),
        rotation_y_deg=Decimal("0.0000"),
        bays_count=2,
    )

    # Rack 2: "Cuerpo B" en X=10.0m, Z=0.0m
    DigitalTwinService.create_rack(
        db=db,
        warehouse_id=wh_id,
        rack_code="Cuerpo B",
        rack_width_m=Decimal("2.4000"),
        rack_height_m=Decimal("6.0000"),
        rack_depth_m=Decimal("1.2000"),
        levels_count=4,
        max_weight_kg=Decimal("3000.0000"),
        zone_code="ZONA-SUR",
        racks_count=2,
        positions_per_level=3,
        pos_x_m=Decimal("10.0000"),
        pos_z_m=Decimal("0.0000"),
        rotation_y_deg=Decimal("0.0000"),
        bays_count=2,
    )

    yield db

    # Limpieza
    db.query(WarehouseSlot).filter(WarehouseSlot.warehouse_id == wh_id).delete()
    db.query(WarehouseRack).filter(WarehouseRack.warehouse_id == wh_id).delete()
    db.query(Warehouse).filter(Warehouse.id == wh_id).delete()
    db.commit()
    db.close()


def test_create_rack_persists_spatial_coordinates_with_numeric_precision(db_session):
    """
    Verifica que la creación de un nuevo rack guarde pos_x_m, pos_z_m, rotation_y_deg y bays_count
    tanto en la entidad WarehouseRack como en cada uno de sus WarehouseSlot con precisión Numeric(14, 4).
    """
    wh_id = "WH-TEST-SPATIAL-RACK"
    slots_a = db_session.query(WarehouseSlot).filter(
        WarehouseSlot.warehouse_id == wh_id,
        WarehouseSlot.cuerpo == "A"
    ).all()

    assert len(slots_a) == 24  # 4 niveles * 3 posiciones * 2 racks/bastidores
    for s in slots_a:
        assert s.pos_x_m == Decimal("-10.0000")
        assert s.pos_z_m == Decimal("0.0000")
        assert s.rotation_y_deg == Decimal("0.0000")
        assert s.bays_count == 2
        assert isinstance(s.pos_x_m, Decimal)
        assert isinstance(s.pos_z_m, Decimal)


def test_patch_rack_transform_moves_entire_rack_in_block(db_session):
    """
    Verifica que PATCH /api/v1/digital-twin/racks/{rack_id}/transform
    traslade la estructura completa y todos sus slots en bloque a nuevas coordenadas (X, Z) y rotación.
    """
    wh_id = "WH-TEST-SPATIAL-RACK"
    rack_id = "A"

    # Trasladar Cuerpo A a X=-5.0m, Z=8.0m con rotación 90°
    payload = {
        "warehouse_id": wh_id,
        "pos_x_m": -5.0,
        "pos_z_m": 8.0,
        "rotation_y_deg": 90.0,
        "rack_width_m": 2.5,
        "rack_height_m": 6.0,
        "rack_depth_m": 1.2,
        "levels_count": 4,
        "max_weight_kg": 3000.0,
    }

    res = client.patch(f"/api/v1/digital-twin/racks/{rack_id}/transform", json=payload)
    assert res.status_code == 200, f"Error en PATCH transform: {res.text}"
    data = res.json()
    assert data["success"] is True
    assert data["rack_id"] == "A"
    assert data["total_slots_actualizados"] == 24
    assert Decimal(str(data["pos_x_m"])) == Decimal("-5.0000")
    assert Decimal(str(data["pos_z_m"])) == Decimal("8.0000")
    assert Decimal(str(data["rotation_y_deg"])) == Decimal("90.0000")

    # Verificar persistencia en base de datos de todos los slots asociados
    slots_updated = db_session.query(WarehouseSlot).filter(
        WarehouseSlot.warehouse_id == wh_id,
        WarehouseSlot.cuerpo == "A"
    ).all()

    for s in slots_updated:
        assert s.pos_x_m == Decimal("-5.0000")
        assert s.pos_z_m == Decimal("8.0000")
        assert s.rotation_y_deg == Decimal("90.0000")
        assert s.rack_width_m == Decimal("2.5000")


def test_patch_rack_transform_rejects_boundary_violation(db_session):
    """
    Verifica que si se intenta trasladar el rack fuera de las paredes del depósito
    (width=40m => [-20m, +20m], length=60m => [-30m, +30m]), la API devuelva HTTP 400.
    """
    wh_id = "WH-TEST-SPATIAL-RACK"
    rack_id = "A"

    # Posición X = 50.0m excede el límite del galpón (+20m)
    payload = {
        "warehouse_id": wh_id,
        "pos_x_m": 50.0,
        "pos_z_m": 0.0,
        "rotation_y_deg": 0.0,
    }

    res = client.patch(f"/api/v1/digital-twin/racks/{rack_id}/transform", json=payload)
    assert res.status_code == 400
    assert "Límites del depósito excedidos" in res.json()["detail"]


def test_patch_rack_transform_rejects_collision_with_other_rack(db_session):
    """
    Verifica que si se intenta trasladar un rack a una posición donde ya existe otra estantería,
    el detector de colisiones 2D AABB lo rechace con código HTTP 409 y detalle explicativo.
    """
    wh_id = "WH-TEST-SPATIAL-RACK"
    rack_id = "A"

    # Cuerpo B está ubicado en X=10.0m, Z=0.0m. Intentamos mover Cuerpo A exactamente a esa coordenada.
    payload = {
        "warehouse_id": wh_id,
        "pos_x_m": 10.0,
        "pos_z_m": 0.0,
        "rotation_y_deg": 0.0,
        "rack_width_m": 2.4,
        "rack_depth_m": 1.2,
    }

    res = client.patch(f"/api/v1/digital-twin/racks/{rack_id}/transform", json=payload)
    assert res.status_code == 409
    detail = res.json()["detail"]
    assert "Colisión detectada" in detail
    assert "Cuerpo B" in detail or "B" in detail


def test_get_racks_endpoint_returns_spatial_metadata(db_session):
    """
    Verifica que GET /api/v1/digital-twin/racks retorne la lista de estanterías completas
    con sus coordenadas pos_x_m, pos_z_m, rotation_y_deg y métricas de ocupación.
    """
    wh_id = "WH-TEST-SPATIAL-RACK"
    res = client.get(f"/api/v1/digital-twin/racks?warehouse_id={wh_id}")
    assert res.status_code == 200
    racks = res.json()
    assert len(racks) >= 2

    cuerpo_b = next((r for r in racks if r["cuerpo"] == "B"), None)
    assert cuerpo_b is not None
    assert Decimal(str(cuerpo_b["pos_x_m"])) == Decimal("10.0000")
    assert Decimal(str(cuerpo_b["pos_z_m"])) == Decimal("0.0000")
    assert cuerpo_b["total_slots"] == 24
