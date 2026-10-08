import pytest
from datetime import date, timedelta
from starlette.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.entities import Product, Inventory, CommercialDeal, StockLocationBatch


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_crm_seeded_deals_and_martin_gomez(client):
    """Verifica que los tratos comerciales sembrados existan, incluyendo el de Martín Gómez en Edificio Pocitos."""
    res = client.get("/api/v1/deals")
    assert res.status_code == 200
    deals = res.json()
    assert len(deals) >= 4

    # Buscar trato de Martín Gómez en Edificio Pocitos
    martin_deal = next((d for d in deals if d["proyecto_nombre"] == "Edificio Pocitos"), None)
    assert martin_deal is not None
    assert martin_deal["vendedor"] == "Martín Gómez"
    assert float(martin_deal["monto_total"]) == 15000.00
    assert martin_deal["moneda"] == "USD"
    assert martin_deal["etapa"] in ["negociacion", "ganada"]
    assert len(martin_deal["items"]) >= 1
    assert martin_deal["items"][0]["sku"] == "LUM-6060"
    assert martin_deal["items"][0]["cantidad"] == 500


def test_crm_create_deal_and_auto_total(client):
    """Crea un nuevo trato comercial y verifica el cálculo automático del monto si no se especifica."""
    payload = {
        "proyecto_nombre": "Torre Bahía Solymar",
        "cliente": "Constructora del Plata SA",
        "vendedor": "Martín Gómez",
        "moneda": "USD",
        "etapa": "prospeccion",
        "observaciones": "Luminarias para accesos exteriores y halls",
        "items": [
            {
                "sku": "LUM-6060",
                "cantidad": 50,
                "precio_unitario": 30.0
            },
            {
                "sku": "DRV-DALI",
                "cantidad": 20,
                "precio_unitario": 25.0
            }
        ]
    }
    res = client.post("/api/v1/deals", json=payload)
    assert res.status_code == 201
    created = res.json()

    assert created["proyecto_nombre"] == "Torre Bahía Solymar"
    assert created["cliente"] == "Constructora del Plata SA"
    # Monto total calculado automáticamente: (50 * 30) + (20 * 25) = 1500 + 500 = 2000
    assert float(created["monto_total"]) == 2000.0
    assert len(created["items"]) == 2


def test_crm_stage_transitions_and_stock_reservation(client):
    """Verifica la transición de etapas y la reserva/descuento de stock en depósito central al ganar."""
    db = SessionLocal()
    try:
        # Asegurar producto e inventario previo
        prod = db.query(Product).filter(Product.sku == "LUM-6060").first()
        inv = db.query(Inventory).filter(Inventory.producto_id == prod.id).first()
        initial_stock = inv.deposito_central
    finally:
        db.close()

    # Crear trato para ganar
    payload = {
        "proyecto_nombre": "Hotel Rambla Suites",
        "cliente": "Grupo Hotelero del Sur",
        "vendedor": "Martín Gómez",
        "monto_total": 300.0,
        "moneda": "USD",
        "etapa": "negociacion",
        "items": [
            {
                "sku": "LUM-6060",
                "cantidad": 10,
                "precio_unitario": 30.0
            }
        ]
    }
    res = client.post("/api/v1/deals", json=payload)
    assert res.status_code == 201
    deal = res.json()
    deal_id = deal["id"]

    # Cambiar a ganada
    stage_res = client.put(f"/api/v1/deals/{deal_id}/stage", json={"etapa": "ganada"})
    assert stage_res.status_code == 200
    updated = stage_res.json()
    assert updated["etapa"] == "ganada"

    # Verificar stock en BD
    db2 = SessionLocal()
    try:
        inv2 = db2.query(Inventory).filter(Inventory.producto_id == prod.id).first()
        # Se descontaron 10 unidades
        assert inv2.deposito_central == max(0, initial_stock - 10)
    finally:
        db2.close()

    # Eliminar trato de prueba y restaurar stock para aislamiento
    del_res = client.delete(f"/api/v1/deals/{deal_id}")
    assert del_res.status_code == 200

    db_clean = SessionLocal()
    try:
        inv_clean = db_clean.query(Inventory).filter(Inventory.producto_id == prod.id).first()
        inv_clean.deposito_central = initial_stock
        db_clean.commit()
    finally:
        db_clean.close()


def test_stock_trace_summary_and_batches(client):
    """Verifica el resumen de ubicaciones y el cálculo del countdown de ETA."""
    sum_res = client.get("/api/v1/stock-locations/summary")
    assert sum_res.status_code == 200
    summary = sum_res.json()
    assert summary["total_lotes"] >= 4
    assert summary["total_unidades"] > 0
    assert "transito_maritimo_unidades" in summary
    assert "deposito_central_unidades" in summary

    batches_res = client.get("/api/v1/stock-locations/batches")
    assert batches_res.status_code == 200
    batches = batches_res.json()
    assert len(batches) >= 4

    # Verificar cálculo dinámico de días restantes ETA
    maritime_batch = next((b for b in batches if b["ubicacion"] == "transito_maritimo" and b["fecha_eta"]), None)
    if maritime_batch:
        assert maritime_batch["dias_restantes_eta"] is not None
        assert isinstance(maritime_batch["arribado"], bool)


def test_stock_trace_transfer_200_led_panels(client):
    """
    CRITERIO DE VALIDACIÓN OBLIGATORIO:
    Transferencia de 200 paneles LED (LUM-6060) desde Tránsito Marítimo a Depósito Central
    actualizando stock disponible en SQLite/PostgreSQL.
    """
    db = SessionLocal()
    try:
        prod = db.query(Product).filter(Product.sku == "LUM-6060").first()
        prod_id = prod.id
        inv_before = db.query(Inventory).filter(Inventory.producto_id == prod_id).first()
        dep_before = inv_before.deposito_central
        trans_before = inv_before.transito_maritimo

        # Crear lote específico y limpio para el test de transferencia de 200 paneles
        import uuid
        test_batch_id = f"LOT-T200-{uuid.uuid4().hex[:8]}"
        today = date.today()
        batch = StockLocationBatch(
            id=test_batch_id,
            sku="LUM-6060",
            cantidad=200,
            ubicacion="transito_maritimo",
            pais_origen="CN",
            buque_o_tracking="Ever Given / BL-EG-9901",
            fecha_despacho=today - timedelta(days=20),
            fecha_eta=today + timedelta(days=2),
            estado="EN_TRANSITO"
        )
        db.add(batch)
        inv_before.transito_maritimo += 200
        db.commit()
        db.refresh(batch)
        trans_before = inv_before.transito_maritimo

        target_batch_id = batch.id
    finally:
        db.close()

    try:
        # Ejecutar transferencia vía endpoint REST
        transfer_payload = {
            "batch_id": target_batch_id,
            "destino": "deposito_central",
            "cantidad": 200,
            "observaciones": "Recepción de 200 paneles LED nacionalizados en Puerto de Montevideo"
        }
        res = client.post("/api/v1/stock-locations/transfer", json=transfer_payload)
        assert res.status_code == 200
        res_batch = res.json()
        assert res_batch["ubicacion"] == "deposito_central"
        assert res_batch["cantidad"] == 200

        # Verificar consistencia en la base de datos
        db_after = SessionLocal()
        try:
            inv_after = db_after.query(Inventory).filter(Inventory.producto_id == prod_id).first()
            # Depósito Central debe haber aumentado en 200
            assert inv_after.deposito_central == dep_before + 200
            # Tránsito Marítimo debe haber disminuido en 200
            assert inv_after.transito_maritimo == max(0, trans_before - 200)

            # Verificar estado del lote
            b_after = db_after.query(StockLocationBatch).filter(StockLocationBatch.id == res_batch["id"]).first()
            assert b_after.ubicacion == "deposito_central"
            assert b_after.estado == "DISPONIBLE"
        finally:
            db_after.close()
    finally:
        # Garantizar restauración del inventario para no afectar otros tests
        db_restore = SessionLocal()
        try:
            inv_res = db_restore.query(Inventory).filter(Inventory.producto_id == prod_id).first()
            inv_res.deposito_central = dep_before
            inv_res.transito_maritimo = trans_before
            db_restore.query(StockLocationBatch).filter(StockLocationBatch.id == target_batch_id).delete()
            db_restore.commit()
        finally:
            db_restore.close()


def test_stock_trace_auto_arrive(client):
    """Verifica el endpoint de arribo automático por fecha ETA cumplida."""
    # Crear lote vencido en transito marítimo
    db = SessionLocal()
    today = date.today()
    batch_vencido_id = "LOT-AUTO-ARRIVE-999"
    try:
        # Asegurar que no exista
        db.query(StockLocationBatch).filter(StockLocationBatch.id == batch_vencido_id).delete()
        b_vencido = StockLocationBatch(
            id=batch_vencido_id,
            sku="UFO-150W",
            cantidad=30,
            ubicacion="transito_maritimo",
            pais_origen="CN",
            buque_o_tracking="Maersk Line Auto",
            fecha_despacho=today - timedelta(days=30),
            fecha_eta=today - timedelta(days=1), # Vencido (ayer)
            estado="EN_TRANSITO"
        )
        db.add(b_vencido)
        db.commit()
    finally:
        db.close()

    # Ejecutar arribo automático
    arrive_res = client.post("/api/v1/stock-locations/auto-arrive")
    assert arrive_res.status_code == 200
    data = arrive_res.json()
    assert data["status"] == "success"
    assert data["batches_processed"] >= 1

    # Verificar que el lote pasó a deposito_central
    db2 = SessionLocal()
    try:
        b_arrived = db2.query(StockLocationBatch).filter(StockLocationBatch.id == batch_vencido_id).first()
        assert b_arrived.ubicacion == "deposito_central"
    finally:
        db2.close()
