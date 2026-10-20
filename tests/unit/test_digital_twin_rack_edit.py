import pytest
from decimal import Decimal
from starlette.testclient import TestClient

from app.database.session import SessionLocal
from app.models.entities import Warehouse, WarehouseSlot
from app.services.digital_twin_service import DigitalTwinService
from app.main import app

client = TestClient(app)


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    # Depósito de prueba aislado
    wh_id = "WH-TEST-RACK-EDIT"
    db.query(WarehouseSlot).filter(WarehouseSlot.warehouse_id == wh_id).delete()
    db.query(Warehouse).filter(Warehouse.id == wh_id).delete()
    db.commit()

    wh = Warehouse(
        id=wh_id,
        nombre="Almacén de Pruebas Edición Rack 3D",
        tipo="CENTRAL",
        module_scope="SUPPLY_CHAIN",
        ubicacion="Montevideo, Uruguay",
        capacidad_unidades=10000,
        superficie_m2=Decimal("1500.0000"),
        volumen_max_m3=Decimal("10000.0000"),
        capacidad_peso_kg=Decimal("800000.0000"),
        altura_max_m=Decimal("9.0000"),
        activo=True,
    )
    db.add(wh)
    db.commit()

    # Crear rack inicial "Cuerpo K"
    DigitalTwinService.create_rack(
        db=db,
        warehouse_id=wh_id,
        rack_code="Cuerpo K",
        rack_width_m=Decimal("2.0000"),
        rack_height_m=Decimal("5.0000"),
        rack_depth_m=Decimal("1.0000"),
        levels_count=4,
        max_weight_kg=Decimal("2400.0000"),
        zone_code="ZONA-K",
        racks_count=2,
        positions_per_level=3,
    )

    yield db

    # Limpieza final
    db.query(WarehouseSlot).filter(WarehouseSlot.warehouse_id == wh_id).delete()
    db.query(Warehouse).filter(Warehouse.id == wh_id).delete()
    db.commit()
    db.close()


def test_update_rack_by_id_recalculates_warehouse_free_space(db_session):
    """
    Verifica que la modificación de las medidas de un rack recalcule de forma transaccional (ACID)
    el volumen total y el espacio libre disponible del depósito con diferencia cero ('0.0000').
    """
    wh_id = "WH-TEST-RACK-EDIT"
    rack_id = "K"

    wh_before = db_session.query(Warehouse).filter(Warehouse.id == wh_id).first()
    initial_wh_vol = wh_before.volumen_max_m3

    # Medidas anteriores: 2.0 * 5.0 * 1.0 * 2 = 20.0000 m3
    old_rack_vol = Decimal("20.0000")

    # Nuevas medidas: Ancho 3.0m, Alto 6.0m, Profundidad 1.5m, 2 bastidores
    # Nuevo volumen de rack esperado: 3.0 * 6.0 * 1.5 * 2 = 54.0000 m3
    new_rw = Decimal("3.0000")
    new_rh = Decimal("6.0000")
    new_rd = Decimal("1.5000")
    new_rack_vol = Decimal("54.0000")
    expected_delta_vol = new_rack_vol - old_rack_vol # +34.0000 m3
    expected_new_wh_vol = initial_wh_vol + expected_delta_vol

    res = DigitalTwinService.update_rack_by_id(
        db=db_session,
        rack_id=rack_id,
        warehouse_id=wh_id,
        rack_width_m=new_rw,
        rack_height_m=new_rh,
        rack_depth_m=new_rd,
        levels_count=5,
        max_weight_kg=Decimal("4000.0000"),
    )

    assert res["success"] is True
    assert res["total_slots_actualizados"] == 24
    assert Decimal(str(res["volumen_total_rack_m3"])) == new_rack_vol
    assert Decimal(str(res["warehouse_volumen_max_m3"])) == expected_new_wh_vol

    # Verificar persistencia en base de datos
    db_session.refresh(wh_before)
    assert wh_before.volumen_max_m3 == expected_new_wh_vol

    # Verificar que el espacio libre sea exacto (volumen total - ocupado)
    slots = db_session.query(WarehouseSlot).filter(WarehouseSlot.warehouse_id == wh_id).all()
    occupied = sum((s.volumen_actual_m3 for s in slots), Decimal("0.0000"))
    expected_free_space = expected_new_wh_vol - occupied

    diff = abs(Decimal(str(res["warehouse_volumen_libre_m3"])) - expected_free_space)
    assert diff == Decimal("0.0000"), f"Diferencia en recálculo de espacio libre: {diff}"


def test_update_rack_by_id_with_spatial_relocation_coordinates(db_session):
    """
    Verifica que la asignación de coordenadas de reubicación 3D (X, Y, Z) se persista
    en PostgreSQL 16 con precisión Decimal Numeric(14, 4).
    """
    wh_id = "WH-TEST-RACK-EDIT"
    rack_id = "K"

    pos_x = Decimal("12.5000")
    pos_y = Decimal("0.0000")
    pos_z = Decimal("-6.2500")

    res = DigitalTwinService.update_rack_by_id(
        db=db_session,
        rack_id=rack_id,
        warehouse_id=wh_id,
        position_x=pos_x,
        position_y=pos_y,
        position_z=pos_z,
    )

    assert res["success"] is True
    assert Decimal(str(res["position_x"])) == pos_x
    assert Decimal(str(res["position_y"])) == pos_y
    assert Decimal(str(res["position_z"])) == pos_z

    # Verificar en slots de la base de datos
    slots = db_session.query(WarehouseSlot).filter(WarehouseSlot.warehouse_id == wh_id, WarehouseSlot.cuerpo == "K").all()
    for s in slots:
        assert s.position_x == pos_x
        assert s.position_y == pos_y
        assert s.position_z == pos_z


def test_update_rack_by_id_strict_positive_validation(db_session):
    """
    Verifica que dimensiones negativas o nulas sean rechazadas inmediatamente
    con ValueError para evitar corrupción volumétrica.
    """
    wh_id = "WH-TEST-RACK-EDIT"
    rack_id = "K"

    with pytest.raises(ValueError, match="estrictamente positivo"):
        DigitalTwinService.update_rack_by_id(
            db=db_session,
            rack_id=rack_id,
            warehouse_id=wh_id,
            rack_width_m=Decimal("-1.0000"),
        )

    with pytest.raises(ValueError, match="estrictamente positiva"):
        DigitalTwinService.update_rack_by_id(
            db=db_session,
            rack_id=rack_id,
            warehouse_id=wh_id,
            rack_height_m=Decimal("0.0000"),
        )


def test_patch_endpoint_http_contract():
    """
    Verifica el endpoint HTTP PATCH /api/v1/digital-twin/racks/{rack_id} en FastAPI.
    """
    payload = {
        "warehouse_id": "WH-TEST-RACK-EDIT",
        "rack_width_m": 2.8,
        "rack_height_m": 5.5,
        "rack_depth_m": 1.3,
        "levels_count": 4,
        "max_weight_kg": 3200.0,
        "position_x": 10.0,
        "position_y": 0.0,
        "position_z": -4.0,
    }

    response = client.patch("/api/v1/digital-twin/racks/K", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["rack_id"] == "K"
    assert data["rack_width_m"] == 2.8
    assert data["warehouse_volumen_libre_m3"] > 0
