from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_tenders_live_feed_and_import():
    # 1. Obtener feed en tiempo real
    res_feed = client.get("/api/v1/tenders/live-feed")
    assert res_feed.status_code == 200
    feed_data = res_feed.json()
    assert feed_data["status"] == "success"
    assert feed_data["total"] >= 4
    items = feed_data["items"]
    assert any("UTE" in it["organismo"] for it in items)

    # 2. Importar licitación del feed
    target_item = items[0]
    payload = {
        "feed_item_id": target_item["id"],
        "proyecto_nombre": f"Proyecto {target_item['organismo']}"
    }
    res_import = client.post("/api/v1/tenders/import-feed-item", json=payload)
    assert res_import.status_code == 200
    imp_data = res_import.json()
    assert imp_data["status"] == "success"
    assert "tender_id" in imp_data
    assert imp_data["evaluation"]["total_ofertado"] > 0


def test_warehouse_sync_and_transfers():
    # 1. Asignar stock directo
    assign_payload = {
        "warehouse_id": "DEP-CENTRAL-MVD",
        "sku": "LUM-6060",
        "cantidad": 500,
        "lote": "LOT-2026-TEST-6060",
        "observaciones": "Stock inicial de prueba para transferencias"
    }
    res_assign = client.post("/api/v1/warehouses/assign-stock", json=assign_payload)
    assert res_assign.status_code == 201
    assign_data = res_assign.json()
    assert assign_data["sku"] == "LUM-6060"
    assert assign_data["cantidad"] >= 500

    # 2. Listar lotes unificados
    res_batches = client.get("/api/v1/warehouses/batches")
    assert res_batches.status_code == 200
    batches = res_batches.json()
    assert len(batches) > 0

    # 3. Transferir 50 unidades de Central a Showroom Pocitos
    transfer_payload = {
        "lote": "LOT-2026-TEST-6060",
        "sku": "LUM-6060",
        "cantidad": 50,
        "origen_id": "DEP-CENTRAL-MVD",
        "destino_id": "SHOWROOM-POCITOS",
        "observaciones": "Envío a salón Pocitos para exhibición"
    }
    res_transfer = client.post("/api/v1/warehouses/transfer", json=transfer_payload)
    assert res_transfer.status_code == 200
    t_data = res_transfer.json()
    assert t_data["sku"] == "LUM-6060"
    assert t_data["cantidad"] == 50
    assert t_data["warehouse_id"] == "SHOWROOM-POCITOS"


def test_crm_deal_edit_and_generate_sales_order():
    # 1. Crear deal con RUT
    deal_payload = {
        "proyecto_nombre": "Iluminación Corporativa Saceem",
        "cliente": "Saceem Uruguay S.A.",
        "rut": "219876540019",
        "vendedor": "Martín Gómez",
        "moneda": "USD",
        "items": [
            {
                "sku": "LUM-6060",
                "cantidad": 100,
                "precio_unitario": 35.0
            }
        ]
    }
    res_deal = client.post("/api/v1/deals", json=deal_payload)
    assert res_deal.status_code == 201
    deal = res_deal.json()
    deal_id = deal["id"]
    assert deal["cliente"] == "Saceem Uruguay S.A."
    assert deal["rut"] == "219876540019"

    # 2. Editar deal (cambiar vendedor y cliente)
    up_payload = {
        "cliente": "Saceem Corporativo SA",
        "rut": "219876540018",
        "vendedor": "Rodrigo Silva",
        "monto_total": 3500.0
    }
    res_up = client.put(f"/api/v1/deals/{deal_id}", json=up_payload)
    assert res_up.status_code == 200
    assert res_up.json()["cliente"] == "Saceem Corporativo SA"
    assert res_up.json()["rut"] == "219876540018"
    assert res_up.json()["vendedor"] == "Rodrigo Silva"

    # 3. Emitir Orden de Venta Formal (OV)
    ov_payload = {
        "warehouse_id": "DEP-CENTRAL-MVD",
        "notas": "Despacho inmediato para obra oficinas centrales"
    }
    res_ov = client.post(f"/api/v1/deals/{deal_id}/generate-sales-order", json=ov_payload)
    assert res_ov.status_code == 201
    ov_data = res_ov.json()
    assert "OV-2026-" in ov_data["numero_ov"]
    assert ov_data["cliente"] == "Saceem Corporativo SA"
    assert ov_data["rut"] == "219876540018"
    assert ov_data["warehouse_id"] == "DEP-CENTRAL-MVD"
    assert ov_data["subtotal"] == 3500.0
    assert ov_data["iva_monto"] == round(3500.0 * 0.22, 2)
    assert ov_data["total"] == round(3500.0 * 1.22, 2)

    # 4. Verificar que el deal quedó en etapa 'ganada'
    res_deal_check = client.get("/api/v1/deals")
    assert res_deal_check.status_code == 200
    d_match = next((d for d in res_deal_check.json() if d["id"] == deal_id), None)
    assert d_match is not None
    assert d_match["etapa"] == "ganada"
