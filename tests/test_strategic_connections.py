import pytest
from decimal import Decimal
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.entities import WarehouseSlot, Warehouse, Product
from app.models.logistics_entities import LogisticsClient
from app.engine.inventory import calculate_3d_load_plan, recommend_container_filler_skus
from app.engine.logistics_engine import LogisticsEngine
from app.services.digital_twin_service import DigitalTwinService
from app.services.settings_service import SettingsService

client = TestClient(app)


def test_3d_bin_packing_deterministic_decimal():
    """Valida el cálculo volumétrico exacto y distribución de pesos en 40HQ y Camión 3PL."""
    items = [
        {
            "sku": "VALV-200",
            "description": "Válvula de bola 2 pulgadas",
            "box_width_m": 0.40,
            "box_height_m": 0.30,
            "box_length_m": 0.40,
            "unit_weight_kg": 10.0,
            "units_count": 50,
        }
    ]
    plan = calculate_3d_load_plan("40HQ", items)
    assert plan["placed_boxes_count"] == 50
    assert plan["total_volume_m3"] == pytest.approx(50 * 0.4 * 0.3 * 0.4, 0.001)
    assert plan["total_weight_kg"] == 500.0
    assert plan["occupied_volume_pct"] > 0
    assert plan["unfitted_boxes_count"] == 0

    # Camión 3PL con distribución por eje
    truck_plan = calculate_3d_load_plan("TRUCK_3PL", items, enforce_lifo=True)
    assert truck_plan["placed_boxes_count"] == 50
    assert "axle_distribution" in truck_plan
    assert truck_plan["axle_distribution"]["balanced"] is True


def test_ai_container_filler_98_percent():
    """Valida que el algoritmo IA rellene el hueco ocioso de contenedores hasta ~98%."""
    items = [
        {
            "sku": "VALV-200",
            "description": "Válvula 2 pulgadas",
            "box_width_m": 0.40,
            "box_height_m": 0.30,
            "box_length_m": 0.40,
            "unit_weight_kg": 8.0,
            "units_count": 80,
        }
    ]
    base_plan = calculate_3d_load_plan("20ST", items)
    fill_res = recommend_container_filler_skus("20ST", base_plan, [], target_occupancy_pct=Decimal("98.0"))

    assert fill_res["success"] is True
    assert fill_res["filler_boxes_count"] > 0
    assert fill_res["projected_volume_pct"] > base_plan["occupied_volume_pct"]
    assert fill_res["filler_boxes"][0]["color"] == "#10b981"
    assert fill_res["filler_boxes"][0]["status"] == "SUGGESTED_AI_FILL"


def test_double_lock_reservations_and_http_423():
    """Valida la reserva dura intocable (HARD_RESERVED) y el rechazo con HTTP 423 Locked."""
    db = SessionLocal()
    try:
        # Asegurar slots
        DigitalTwinService.ensure_default_warehouses_and_slots(db, "SUPPLY_CHAIN")
        slot = db.query(WarehouseSlot).filter(WarehouseSlot.warehouse_id == "DEP-CENTRAL-MVD", WarehouseSlot.estado == "OCUPADA").first()
        assert slot is not None

        # 1. Establecer HARD_RESERVED
        reserve_payload = {
            "warehouse_id": slot.warehouse_id,
            "slot_code": slot.slot_code,
            "reservation_type": "HARD_RESERVED",
            "order_id": "SICE-LICITACION-2026-991",
            "organism": "Intendencia de Montevideo",
            "user_name": "Sebastian Rodriguez",
            "duration_days": 10,
        }
        res_reserve = client.post("/api/v1/digital-twin/reserve-slot", json=reserve_payload)
        assert res_reserve.status_code == 200
        assert res_reserve.json()["reservation_type"] == "HARD_RESERVED"

        # 2. Intentar transferir / despachar mercadería de este slot ➔ debe responder HTTP 423 Locked
        transfer_payload = {
            "source_warehouse_id": slot.warehouse_id,
            "source_slot_code": slot.slot_code,
            "target_warehouse_id": "SUC-SALTO",
            "target_slot_code": "A-01-01-01",
            "cantidad_a_mover": 1.0,
            "mover_lote_completo": False,
        }
        res_transfer = client.post("/api/v1/digital-twin/transfer", json=transfer_payload)
        assert res_transfer.status_code == 423
        assert "HTTP 423 Locked" in res_transfer.json()["detail"]

        # 3. Liberar reserva
        res_release = client.post("/api/v1/digital-twin/release-slot", json={
            "warehouse_id": slot.warehouse_id,
            "slot_code": slot.slot_code,
            "is_controller_admin": True,
        })
        assert res_release.status_code == 200
    finally:
        db.close()


def test_bimonetary_3pl_billing_and_brou_rate():
    """Valida el cálculo de liquidación bimonetaria USD/UYU y la emisión contable con BROU."""
    db = SessionLocal()
    try:
        # Configurar tasa BROU
        res_fx = client.post("/api/v1/settings/exchange-rate", json={"manual_rate_uyu": 43.50, "use_manual": True})
        assert res_fx.status_code == 200
        assert res_fx.json()["effective_rate_uyu"] == 43.50

        # Crear o buscar cliente 3PL
        c = db.query(LogisticsClient).first()
        if not c:
            c = LogisticsClient(
                rut="219991110022",
                razon_social="Retail Central S.A.",
                nombre_comercial="Retail Central",
                moneda_contrato="USD",
                tarifa_pallet_dia=Decimal("1.2000"),
                tarifa_m3_dia=Decimal("0.8500"),
                tarifa_picking_movimiento=Decimal("2.5000"),
            )
            db.add(c)
            db.commit()
            db.refresh(c)

        calc_payload = {
            "client_id": c.id,
            "dias_almacenaje": 30,
            "pallets": 10,
            "m3": 0.0,
            "picking_movements": 20,
            "manual_exchange_rate": 43.50,
        }
        res_calc = client.post("/api/v1/logistics/billing/calculate-bimonetary", json=calc_payload)
        assert res_calc.status_code == 200
        data = res_calc.json()
        assert data["total_facturar_usd"] == 500.20
        assert data["total_facturar_uyu"] == pytest.approx(500.20 * 43.50, 0.01)

        # Emisión de factura y asiento
        issue_payload = {
            "client_id": c.id,
            "dias_almacenaje": 30,
            "pallets": 10,
            "m3": 0.0,
            "picking_movements": 20,
            "moneda_facturacion": "USD",
        }
        res_issue = client.post("/api/v1/logistics/billing/issue-bimonetary-invoice", json=issue_payload)
        assert res_issue.status_code == 200
        inv_data = res_issue.json()
        assert inv_data["success"] is True
        assert "3PL-FAC-" in inv_data["numero_factura"]
        assert "AS-3PL-" in inv_data["numero_asiento"]
    finally:
        db.close()


def test_hmac_qr_label_and_live_scan():
    """Valida la generación de QR firmado con HMAC-SHA256 y la verificación criptográfica."""
    # 1. Generar etiqueta firmada
    gen_payload = {
        "warehouse_id": "DEP-CENTRAL-MVD",
        "slot_code": "F-02-02-02",
        "sku": "VALV-IND-A1",
        "lote": "LOT-2026-X1",
        "units_count": 48,
    }
    res_gen = client.post("/api/v1/digital-twin/generate-qr-label", json=gen_payload)
    assert res_gen.status_code == 200
    qr_token = res_gen.json()["qr_token"]
    assert qr_token.startswith("CALCU-QR:v1:")

    # 2. Escanear y recibir con token válido
    res_scan = client.post("/api/v1/digital-twin/scan-qr-receive", json={"qr_token": qr_token})
    assert res_scan.status_code == 200
    assert res_scan.json()["success"] is True
    assert res_scan.json()["units_count"] == 48

    # 3. Token adulterado debe ser rechazado
    tampered_token = qr_token[:-4] + "FFFF"
    res_tampered = client.post("/api/v1/digital-twin/scan-qr-receive", json={"qr_token": tampered_token})
    assert res_tampered.status_code == 400
    assert "Firma criptográfica" in res_tampered.json()["detail"]
