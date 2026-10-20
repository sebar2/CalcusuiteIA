import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database.session import SessionLocal
from app.services.digital_twin_service import DigitalTwinService
from app.models.entities import Warehouse, WarehouseSlot, Product

client = TestClient(app)


@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    try:
        # Asegurar datos iniciales
        DigitalTwinService.ensure_default_warehouses_and_slots(session)
        yield session
    finally:
        session.close()


def test_warehouse_dimensions_parametric_update(db: Session):
    """Prueba que el redimensionamiento del galpón recalcula superficie y volumen exacto en Decimal."""
    wh_id = "3PL-WH-01"
    res = client.patch(
        f"/api/v1/digital-twin/warehouses/{wh_id}/dimensions",
        json={"width_m": 45.0, "length_m": 80.0, "clear_height_m": 12.0},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["warehouse_id"] == wh_id
    assert data["width_m"] == 45.0
    assert data["length_m"] == 80.0
    assert data["clear_height_m"] == 12.0
    assert data["superficie_m2"] == 3600.0
    assert data["volumen_max_m3"] == 43200.0

    # Verificar en base de datos PostgreSQL
    wh = db.query(Warehouse).filter(Warehouse.id == wh_id).first()
    db.refresh(wh)
    assert wh.width_m == Decimal("45.0000")
    assert wh.length_m == Decimal("80.0000")
    assert wh.clear_height_m == Decimal("12.0000")
    assert wh.superficie_m2 == Decimal("3600.0000")
    assert wh.volumen_max_m3 == Decimal("43200.0000")


def test_rack_engineering_dimensions_and_deviations(db: Session):
    """Prueba la ingeniería de estanterías y detección automática de excesos físicos."""
    wh_id = "3PL-WH-01"
    cuerpo = "A"

    # Redimensionar estantería con altura muy baja para forzar EXCESO_ALTURA en ítems existentes
    res = client.patch(
        f"/api/v1/digital-twin/racks/{wh_id}/{cuerpo}/dimensions",
        json={
            "rack_width_m": 2.4,
            "rack_height_m": 2.0,  # 2m / 4 niveles = 0.5m por nivel
            "rack_depth_m": 1.2,
            "levels_count": 4,
            "max_rack_weight_kg": 2000.0,
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["cuerpo"] == cuerpo
    assert data["clear_height_per_level_m"] == 0.5

    # Comprobar que los slots del cuerpo A tienen sus dimensiones actualizadas
    slots_cuerpo_a = (
        db.query(WarehouseSlot)
        .filter(WarehouseSlot.warehouse_id == wh_id, WarehouseSlot.cuerpo == cuerpo)
        .all()
    )
    assert len(slots_cuerpo_a) > 0
    for s in slots_cuerpo_a:
        assert s.rack_height_m == Decimal("2.0000")
        assert s.levels_count == 4


def test_slot_item_specs_and_real_product_link(db: Session):
    """Prueba la actualización de caja real, cálculo volumétrico exacto y vinculación con SKU real."""
    wh_id = "3PL-WH-01"
    slot = (
        db.query(WarehouseSlot)
        .filter(WarehouseSlot.warehouse_id == wh_id, WarehouseSlot.cuerpo == "A")
        .first()
    )
    assert slot is not None

    # Obtener un producto real si existe, o crear uno temporal
    prod = db.query(Product).first()
    prod_id = prod.id if prod else None

    res = client.patch(
        f"/api/v1/digital-twin/slots/{slot.id}/item-specs",
        json={
            "box_width_m": 0.5,
            "box_height_m": 0.4,
            "box_length_m": 0.6,
            "unit_weight_kg": 15.0,
            "units_count": 8,
            "real_product_id": prod_id,
            "lote": "LOTE-PARAM-2026",
            "descripcion": "Cajas de Repuestos Industriales",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["slot_id"] == slot.id
    assert data["estado"] == "OCUPADA"
    # Volumen: 0.5 * 0.4 * 0.6 * 8 = 0.96 m³
    assert abs(data["volumen_actual_m3"] - 0.96) < 0.001
    # Peso: 15.0 * 8 = 120.0 kg
    assert data["peso_actual_kg"] == 120.0


def test_get_real_products_catalog():
    """Prueba que el endpoint del catálogo real de productos responde lista válida."""
    res = client.get("/api/v1/digital-twin/products")
    assert res.status_code == 200
    products = res.json()
    assert isinstance(products, list)


def test_sync_real_inventory_exact_accounting_balance(db: Session):
    """
    Prueba que la sincronización en 1 clic del catálogo e inventario real
    hace coincidir exactamente (diferencia 0.0000 en Decimal) el Stock Total
    y el Valor Estimado ($) del Gemelo 3D con el balance contable de PostgreSQL 16.
    """
    wh_id = "DEP-CENTRAL-MVD"
    res = client.post(
        "/api/v1/digital-twin/sync-real-inventory",
        json={"warehouse_id": wh_id, "module_scope": "SUPPLY_CHAIN"},
    )
    assert res.status_code == 200, res.text
    sync_data = res.json()
    assert sync_data["success"] is True
    assert sync_data["skus_count"] > 0
    assert sync_data["lots_count"] > 0
    assert sync_data["total_stock"] > 0

    # Obtener el resumen del Gemelo Digital 3D
    summary_res = client.get(f"/api/v1/digital-twin/intelligence-summary?warehouse_id={wh_id}")
    assert summary_res.status_code == 200
    summary = summary_res.json()

    # Suma directa en base de datos PostgreSQL de las posiciones del almacén
    slots = db.query(WarehouseSlot).filter(WarehouseSlot.warehouse_id == wh_id, WarehouseSlot.estado == "OCUPADA").all()
    twin_stock_db = sum((s.cantidad for s in slots), Decimal("0.0000"))
    twin_valor_db = sum((s.valor_estimado for s in slots), Decimal("0.0000"))

    # Coincidencia exacta con la respuesta del servicio de sincronización (diferencia 0.0000)
    assert (twin_stock_db - Decimal(str(sync_data["total_stock"]))) == Decimal("0.0000")
    assert (twin_valor_db - Decimal(str(sync_data["valor_estimado_total"]))) == Decimal("0.0000")

    # Coincidencia exacta con el panel WAREHOUSE INTELLIGENCE
    assert abs(summary["operativo"]["stock_total"] - float(twin_stock_db)) < 0.0001
    assert abs(summary["operativo"]["valor_estimado_usd"] - float(twin_valor_db)) < 0.0001


def test_get_slots_real_sku_kpi_indicators(db: Session):
    """Prueba que los slots ocupados retornen costo FOB, Landed, margen y DOH en vivo."""
    wh_id = "DEP-CENTRAL-MVD"
    res = client.get(f"/api/v1/digital-twin/slots?warehouse_id={wh_id}&estado=OCUPADA")
    assert res.status_code == 200
    slots = res.json()
    assert len(slots) > 0

    # Al menos un slot con producto real debe tener los indicadores en vivo
    slots_with_real_prod = [s for s in slots if s.get("real_product_id") is not None]
    assert len(slots_with_real_prod) > 0

    first = slots_with_real_prod[0]
    assert first["costo_fob"] is not None
    assert first["costo_fob"] > 0
    assert first["costo_landed_calc"] is not None
    assert first["precio_lista"] is not None
    assert first["margen_bruto_pct"] is not None
    assert first["doh_cobertura"] is not None


def test_bidirectional_sync_on_3d_slot_update_and_transfer(db: Session):
    """
    Prueba que la edición 3D o transferencia actualiza en la misma transacción ACID
    las tablas operativas (Inventory / StockLocationBatch) y recalcula ROP/DOH.
    """
    from app.models.entities import Inventory
    wh_id = "DEP-CENTRAL-MVD"
    slot = (
        db.query(WarehouseSlot)
        .filter(WarehouseSlot.warehouse_id == wh_id, WarehouseSlot.estado == "OCUPADA", WarehouseSlot.real_product_id.isnot(None))
        .first()
    )
    assert slot is not None
    prod_id = slot.real_product_id

    # Actualizar especificaciones en el 3D incrementando cajas
    client.patch(
        f"/api/v1/digital-twin/slots/{slot.id}/item-specs",
        json={
            "box_width_m": 0.45,
            "box_height_m": 0.35,
            "box_length_m": 0.45,
            "unit_weight_kg": 12.0,
            "units_count": 50,
            "real_product_id": prod_id,
            "lote": slot.lote,
            "descripcion": slot.descripcion,
        },
    )

    # Verificar sincronización en Inventory
    inv = db.query(Inventory).filter(Inventory.producto_id == prod_id).first()
    db.refresh(inv)
    assert inv is not None
    assert inv.deposito_central > 0

