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
    # Asegurar un depósito de prueba limpio
    wh = db.query(Warehouse).filter(Warehouse.id == "WH-TEST-RACKS").first()
    if not wh:
        wh = Warehouse(
            id="WH-TEST-RACKS",
            nombre="Almacén de Pruebas Unitarias Racks 3D",
            tipo="CENTRAL",
            module_scope="SUPPLY_CHAIN",
            ubicacion="Montevideo, Uruguay",
            capacidad_unidades=10000,
            superficie_m2=Decimal("2000.0000"),
            volumen_max_m3=Decimal("12000.0000"),
            capacidad_peso_kg=Decimal("1000000.0000"),
            altura_max_m=Decimal("10.0000"),
            activo=True,
        )
        db.add(wh)
        db.commit()

    yield db

    # Limpieza
    db.query(WarehouseSlot).filter(WarehouseSlot.warehouse_id == "WH-TEST-RACKS").delete()
    db.query(Warehouse).filter(Warehouse.id == "WH-TEST-RACKS").delete()
    db.commit()
    db.close()


def test_create_rack_acid_and_zero_volumetric_difference(db_session):
    """
    Verifica que la creación de un nuevo rack conserve la integridad volumétrica
    y contable con diferencia cero ('0.0000') en Decimal.
    """
    wh_id = "WH-TEST-RACKS"
    rack_code = "Cuerpo I"
    rw = Decimal("2.4000")
    rh = Decimal("6.0000")
    rd = Decimal("1.2000")
    levels = 4
    max_weight = Decimal("3000.0000")
    racks_count = 2
    pos_per_level = 3

    # Volumen teórico exacto: 2.4 * 6.0 * 1.2 * 2 = 34.5600 m3
    expected_total_volume = (rw * rh * rd * Decimal(str(racks_count))).quantize(Decimal("0.0001"))
    expected_total_weight = (max_weight * Decimal(str(racks_count))).quantize(Decimal("0.0001"))
    total_slots_expected = racks_count * levels * pos_per_level # 24 slots

    res = DigitalTwinService.create_rack(
        db=db_session,
        warehouse_id=wh_id,
        rack_code=rack_code,
        rack_width_m=rw,
        rack_height_m=rh,
        rack_depth_m=rd,
        levels_count=levels,
        max_weight_kg=max_weight,
        zone_code="ZONA-TEST",
        racks_count=racks_count,
        positions_per_level=pos_per_level,
    )

    assert res["success"] is True
    assert res["slots_created"] == total_slots_expected
    assert Decimal(str(res["volumen_total_rack_m3"])) == expected_total_volume

    # Verificar slots en la base de datos
    slots = (
        db_session.query(WarehouseSlot)
        .filter(
            WarehouseSlot.warehouse_id == wh_id,
            WarehouseSlot.cuerpo == "I",
        )
        .all()
    )
    assert len(slots) == total_slots_expected

    # Verificar conservación volumétrica exacta (Diferencia cero: 0.0000)
    sum_slot_volumes = sum((s.volumen_max_m3 for s in slots), Decimal("0.0000"))
    volumetric_diff = abs(sum_slot_volumes - expected_total_volume)
    assert volumetric_diff == Decimal("0.0000"), f"Diferencia volumétrica detectada: {volumetric_diff}"

    # Verificar conservación de capacidad de carga exacta (Diferencia cero: 0.0000)
    sum_slot_weights = sum((s.peso_max_kg for s in slots), Decimal("0.0000"))
    weight_diff = abs(sum_slot_weights - expected_total_weight)
    assert weight_diff == Decimal("0.0000"), f"Diferencia de peso detectada: {weight_diff}"


def test_create_rack_strict_positive_validations(db_session):
    """
    Verifica que dimensiones negativas o nulas sean rechazadas inmediatamente
    evitando desbordamientos o corrupción física de datos.
    """
    wh_id = "WH-TEST-RACKS"

    # Ancho negativo
    with pytest.raises(ValueError, match="estrictamente positivas"):
        DigitalTwinService.create_rack(
            db=db_session,
            warehouse_id=wh_id,
            rack_code="Cuerpo NEG",
            rack_width_m=Decimal("-2.4000"),
            rack_height_m=Decimal("6.0000"),
            rack_depth_m=Decimal("1.2000"),
            levels_count=4,
            max_weight_kg=Decimal("3000.0000"),
        )

    # Altura cero
    with pytest.raises(ValueError, match="estrictamente positivas"):
        DigitalTwinService.create_rack(
            db=db_session,
            warehouse_id=wh_id,
            rack_code="Cuerpo ZERO",
            rack_width_m=Decimal("2.4000"),
            rack_height_m=Decimal("0.0000"),
            rack_depth_m=Decimal("1.2000"),
            levels_count=4,
            max_weight_kg=Decimal("3000.0000"),
        )


def test_create_rack_duplicate_prevention(db_session):
    """
    Verifica que no se permita duplicar un cuerpo o rack existente.
    """
    wh_id = "WH-TEST-RACKS"
    with pytest.raises(ValueError, match="Ya existe una estanteria"):
        DigitalTwinService.create_rack(
            db=db_session,
            warehouse_id=wh_id,
            rack_code="Cuerpo I", # Ya creado en el test anterior
            rack_width_m=Decimal("2.4000"),
            rack_height_m=Decimal("6.0000"),
            rack_depth_m=Decimal("1.2000"),
            levels_count=4,
            max_weight_kg=Decimal("3000.0000"),
        )


def test_update_rack_dimensions_and_live_risk_alerts(db_session):
    """
    Verifica la actualización de geometría de estanterías y recálculo transaccional
    de alertas de riesgo físico (altura, volumen y peso).
    """
    wh_id = "WH-TEST-RACKS"
    cuerpo = "I"

    # 1. Ocupar un slot con una carga que supera los límites nuevos
    slot = (
        db_session.query(WarehouseSlot)
        .filter(WarehouseSlot.warehouse_id == wh_id, WarehouseSlot.cuerpo == cuerpo)
        .first()
    )
    assert slot is not None

    slot.estado = "OCUPADA"
    slot.sku = "SKU-PESADO"
    slot.box_height_m = Decimal("2.5000") # Muy alto
    slot.altura_m = Decimal("2.5000")
    slot.peso_actual_kg = Decimal("800.0000") # Muy pesado
    slot.volumen_actual_m3 = Decimal("2.0000") # Muy voluminoso
    db_session.commit()

    # 2. Redimensionar el rack a medidas más pequeñas
    update_res = DigitalTwinService.update_rack_dimensions(
        db=db_session,
        warehouse_id=wh_id,
        cuerpo=cuerpo,
        rack_width_m=1.8000,
        rack_height_m=4.0000, # 4m / 4 niveles = 1.0m por nivel -> la caja de 2.5m generará EXCESO_ALTURA
        rack_depth_m=1.0000,
        levels_count=4,
        max_rack_weight_kg=1200.0000, # 1200 / 4 / 3 = 100kg max por slot -> 800kg generará EXCESO_PESO
    )

    assert update_res["total_slots_actualizados"] == 24
    assert update_res["desvios_detectados"] >= 1

    # Verificar que el slot ocupado ahora tenga alertas de desvío físico
    db_session.refresh(slot)
    assert slot.desvios is not None
    assert "EXCESO_ALTURA" in slot.desvios
    assert "EXCESO_PESO" in slot.desvios


def test_fastapi_endpoints_post_and_put_racks():
    """
    Verifica la paridad de contrato HTTP en FastAPI para POST /racks y PUT/PATCH /racks/{wh}/{cuerpo}/dimensions.
    """
    # 1. POST /api/v1/digital-twin/racks
    payload = {
        "warehouse_id": "WH-TEST-RACKS",
        "zone_code": "GENERAL",
        "rack_code": "Cuerpo J",
        "rack_width_m": 2.5,
        "rack_height_m": 6.5,
        "rack_depth_m": 1.2,
        "levels_count": 4,
        "max_weight_kg": 3500.0,
        "racks_count": 2,
        "positions_per_level": 3,
    }
    response = client.post("/api/v1/digital-twin/racks", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert data["cuerpo"] == "J"
    assert data["slots_created"] == 24

    # 2. PUT /api/v1/digital-twin/racks/WH-TEST-RACKS/J/dimensions
    put_payload = {
        "rack_width_m": 2.6,
        "rack_height_m": 6.8,
        "rack_depth_m": 1.3,
        "levels_count": 4,
        "max_rack_weight_kg": 3800.0,
    }
    put_response = client.put("/api/v1/digital-twin/racks/WH-TEST-RACKS/J/dimensions", json=put_payload)
    assert put_response.status_code == 200
    put_data = put_response.json()
    assert put_data["cuerpo"] == "J"
    assert put_data["total_slots_actualizados"] == 24
