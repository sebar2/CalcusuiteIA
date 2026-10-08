import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.entities import Product, Inventory, OrdenReposicion

client = TestClient(app)

@pytest.fixture(autouse=True)
def preserve_db_state():
    db = SessionLocal()
    p = db.query(Product).filter(Product.sku == "SKU-1001").first()
    p_costo = p.costo_base if p else None
    inv = p.inventario if p else None
    inv_data = {
        "deposito_central": inv.deposito_central,
        "transito_maritimo": inv.transito_maritimo,
        "aduana": inv.aduana,
        "stock_seguridad": inv.stock_seguridad,
        "lead_time_dias": inv.lead_time_dias,
        "demanda_diaria_promedio": inv.demanda_diaria_promedio,
    } if inv else None
    orders_data = [
        (o.id, o.sku_id, o.cantidad, o.monto_total, o.proveedor, o.etapa, o.responsable, o.fecha_arribo_estimada)
        for o in db.query(OrdenReposicion).all()
    ]
    db.close()

    yield

    db = SessionLocal()
    if p_costo is not None:
        p = db.query(Product).filter(Product.sku == "SKU-1001").first()
        if p:
            p.costo_base = p_costo
            if inv_data and p.inventario:
                for k, v in inv_data.items():
                    setattr(p.inventario, k, v)
    db.query(OrdenReposicion).delete()
    for oid, s, c, m, pr, e, r, f in orders_data:
        db.add(OrdenReposicion(id=oid, sku_id=s, cantidad=c, monto_total=m, proveedor=pr, etapa=e, responsable=r, fecha_arribo_estimada=f))
    db.commit()
    db.close()

def test_inventory_quick_update_success_and_metrics_recalc():
    """
    Test 1: Actualización express de stock y costos:
    - Incrementa el stock de un producto para sacarlo del quiebre.
    - Valida que ROP y DOH se recalculen en caliente.
    - Valida que is_alert pase a False y la orden sugerida se limpie.
    """
    # 1. Obtener listado de inventario para seleccionar un SKU real
    res_list = client.get("/api/v1/inventory/alerts")
    assert res_list.status_code == 200
    items = res_list.json()
    assert len(items) > 0

    target_sku = items[0]["sku"]
    old_stock = items[0]["stock_actual"]

    # 2. Enviar actualización atómica con stock alto para asegurar stock > ROP
    payload = {
        "stock_actual": 500,
        "costo_unitario": 125.50,
        "lead_time_dias": 15.0,
        "stock_seguridad": 20,
        "demanda_diaria_promedio": 4.0
    }
    update_res = client.patch(
        f"/api/v1/inventory/{target_sku}",
        json=payload,
        headers={"X-User-Role": "controller_admin", "X-User-Id": "test_controller"}
    )
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["status"] == "success"
    
    item = data["item"]
    assert item["sku"] == target_sku
    assert item["stock_actual"] == 500
    # ROP esperado = (4.0 * 15.0) + 20 = 80.0
    assert float(item["rop"]) == 80.0
    # Como stock_actual (500) > rop (80.0) -> is_alert debe ser False
    assert item["is_alert"] is False
    # DOH esperado = 500 / 4.0 = 125.0 días
    assert float(item["doh"]) == 125.0
    assert float(item["costo_unitario"]) == 125.50

    # 3. Validar en base de datos la persistencia directa
    db = SessionLocal()
    try:
        p = db.query(Product).filter(Product.sku == target_sku).first()
        assert p is not None
        assert float(p.costo_unitario) == 125.50
        assert p.inventario.stock_actual == 500
        # No debe haber orden en 'sugerido' para este SKU ya que stock > ROP
        sug_order = db.query(OrdenReposicion).filter(
            OrdenReposicion.sku_id == target_sku,
            OrdenReposicion.etapa == "sugerido"
        ).first()
        assert sug_order is None
    finally:
        db.close()


def test_inventory_quick_update_triggers_kanban_on_break():
    """
    Test 2: Si el stock se ajusta por debajo del ROP (quiebre):
    - is_alert debe ser True.
    - Se debe sincronizar/generar automáticamente una tarjeta en 'sugerido' en el Kanban.
    """
    res_list = client.get("/api/v1/inventory/alerts")
    assert res_list.status_code == 200
    target_sku = res_list.json()[0]["sku"]

    # Reducir stock por debajo de ROP: demanda 10, lead time 20, seguridad 15 -> ROP = 215. Stock = 10.
    payload = {
        "stock_actual": 10,
        "lead_time_dias": 20.0,
        "stock_seguridad": 15,
        "demanda_diaria_promedio": 10.0
    }
    update_res = client.patch(
        f"/api/v1/inventory/{target_sku}",
        json=payload,
        headers={"X-User-Role": "controller_admin", "X-User-Id": "test_controller"}
    )
    assert update_res.status_code == 200
    item = update_res.json()["item"]
    assert item["is_alert"] is True
    # ROP = 10 * 20 + 15 = 215
    assert float(item["rop"]) == 215.0

    # Verificar que se creó la orden sugerida en Kanban
    kanban_res = client.get(
        "/api/v1/supply/kanban",
        headers={"X-User-Role": "controller_admin", "X-User-Id": "test_controller"}
    )
    assert kanban_res.status_code == 200
    kanban_data = kanban_res.json()
    suggested_stage = next(s for s in kanban_data["stages"] if s["id"] == "sugerido")
    matching_orders = [o for o in suggested_stage["orders"] if o["sku_id"] == target_sku]
    assert len(matching_orders) > 0
    assert matching_orders[0]["cantidad"] > 0


def test_inventory_quick_update_validation_and_not_found():
    """
    Test 3: Validación defensiva:
    - Valores negativos devuelven HTTP 422.
    - SKU inexistente devuelve HTTP 404.
    """
    # 1. Stock negativo -> 422
    neg_res = client.patch(
        "/api/v1/inventory/NON_EXISTENT_SKU",
        json={"stock_actual": -10},
        headers={"X-User-Role": "controller_admin", "X-User-Id": "test_controller"}
    )
    assert neg_res.status_code == 422

    # 2. SKU inexistente -> 404
    not_found_res = client.patch(
        "/api/v1/inventory/SKU_INEXISTENTE_9999",
        json={"stock_actual": 50},
        headers={"X-User-Role": "controller_admin", "X-User-Id": "test_controller"}
    )
    assert not_found_res.status_code == 404
    assert "no encontrado" in not_found_res.json()["detail"].lower()
