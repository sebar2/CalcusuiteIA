import pytest
from decimal import Decimal
from starlette.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

# --- Test Root & Health ---
def test_root_and_health(client):
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert r_root.json()["status"] == "online"

    r_health = client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "healthy"

# --- Test CORS & Error Handlers ---
def test_cors_headers(client):
    headers = {
        "Origin": "http://localhost:8501",
        "Access-Control-Request-Method": "GET"
    }
    r = client.options("/health", headers=headers)
    assert r.status_code == 200
    assert "access-control-allow-origin" in r.headers
    assert r.headers["access-control-allow-origin"] == "http://localhost:8501"
    assert r.headers.get("access-control-allow-credentials") == "true"

def test_404_handler(client):
    r = client.get("/api/v1/ruta_inexistente")
    assert r.status_code == 404
    data = r.json()
    assert data["error"] == "HTTPException"
    assert "Not Found" in data["detail"]

def test_validation_error_handler(client):
    r = client.post("/api/v1/pricing/simulate", json={"discount_pct": "not_a_number"})
    assert r.status_code == 422
    data = r.json()
    assert data["error"] == "ValidationError"
    assert "detail" in data

# --- Test Inventory Alerts & DOH ---
def test_get_inventory_alerts(client):
    r = client.get("/api/v1/inventory/alerts")
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 5

    sample = items[0]
    for field in ["sku", "nombre", "categoria", "stock_actual", "rop", "doh", "is_alert", "stock_seguridad", "lead_time_dias"]:
        assert field in sample

    # Validar filtro only_alerts=true
    r_alerts = client.get("/api/v1/inventory/alerts?only_alerts=true")
    assert r_alerts.status_code == 200
    alert_items = r_alerts.json()
    assert len(alert_items) > 0
    assert all(item["is_alert"] is True for item in alert_items)

    # Validar filtro por categoría
    r_cat = client.get("/api/v1/inventory/alerts?categoria=Industrial")
    assert r_cat.status_code == 200
    assert all("Industrial" in item["categoria"] for item in r_cat.json())

# --- Test Pricing Margins ---
def test_get_pricing_margins(client):
    r = client.get("/api/v1/pricing/margins")
    assert r.status_code == 200
    margins = r.json()
    assert len(margins) >= 5

    sample = margins[0]
    for field in ["sku", "nombre", "categoria", "precio_venta", "costo_unitario", "gross_margin_pct", "markup_pct", "unit_contribution_margin", "marginal_ratio"]:
        assert field in sample

    # Validar consistencia matemática
    precio = Decimal(sample["precio_venta"])
    costo = Decimal(sample["costo_unitario"])
    expected_margin = ((precio - costo) / precio).quantize(Decimal("0.0001"))
    assert Decimal(sample["gross_margin_pct"]) == expected_margin

    # Filtro por SKU
    r_sku = client.get("/api/v1/pricing/margins?sku=SKU-1001")
    assert r_sku.status_code == 200
    assert len(r_sku.json()) == 1
    assert r_sku.json()[0]["sku"] == "SKU-1001"

# --- Test Pricing Simulation ---
def test_pricing_simulate_custom_values(client):
    payload = {
        "base_price": "150.00",
        "cost": "100.00",
        "discount_pct": "0.10",
        "commission_pct": "0.05",
        "freight": "5.00"
    }
    r = client.post("/api/v1/pricing/simulate", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["discounted_price"] == "135.00"
    assert data["is_negative_margin"] is False
    assert Decimal(data["unit_contribution_margin"]) > 0

def test_pricing_simulate_by_sku(client):
    payload = {
        "sku": "SKU-1001",
        "discount_pct": "0.10"
    }
    r = client.post("/api/v1/pricing/simulate", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["base_price"] == "150.0000"
    assert data["cost"] == "100.0000"
    assert data["discounted_price"] == "135.00"

def test_pricing_simulate_negative_margin(client):
    # Descuento del 40% sobre 150 con costo 100 deja precio 90 < 100
    payload = {
        "base_price": "150.00",
        "cost": "100.00",
        "discount_pct": "0.40"
    }
    r = client.post("/api/v1/pricing/simulate", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["is_negative_margin"] is True
    assert Decimal(data["gross_margin"]) < 0

def test_pricing_simulate_missing_sku_or_price(client):
    payload = {
        "discount_pct": "0.10"
    }
    r = client.post("/api/v1/pricing/simulate", json=payload)
    assert r.status_code == 400

    r_bad_sku = client.post("/api/v1/pricing/simulate", json={"sku": "SKU-NO-EXISTE", "discount_pct": "0.10"})
    assert r_bad_sku.status_code == 404

# --- Test Budget Variance ---
def test_budget_variance_report(client):
    r = client.get("/api/v1/budget/variance")
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 5

    sample = items[0]
    for field in ["id", "periodo", "categoria", "tipo", "monto_presupuestado", "monto_real", "variacion_absoluta", "variacion_porcentual", "status"]:
        assert field in sample
    assert sample["status"] in ["Green", "Yellow", "Red"]

    # Filtros
    r_filt = client.get("/api/v1/budget/variance?periodo=2026-Q1&tipo=VENTAS")
    assert r_filt.status_code == 200
    assert all(b["tipo"] == "VENTAS" for b in r_filt.json())

# --- Test ETL Upload & Idempotency ---
def test_etl_upload_bad_extension(client):
    files = {"file": ("reporte.pdf", b"%PDF-1.4 dummy", "application/pdf")}
    r = client.post("/api/v1/etl/upload", files=files)
    assert r.status_code == 400
    assert "Formato de archivo" in r.json()["detail"]

def test_etl_upload_csv_idempotent(client):
    csv_content = """sku,nombre,categoria,costo_unitario,precio_venta
SKU-TEST-900,Producto ETL Test,TestCat,40.00,80.00
"""
    files = {"file": ("test_prods.csv", csv_content.encode("utf-8"), "text/csv")}
    
    # Ingesta 1
    r1 = client.post("/api/v1/etl/upload", files=files)
    assert r1.status_code == 200
    assert r1.json()["status"] == "success"
    assert r1.json()["records_processed"] == 1

    # Ingesta 2 (idempotente)
    files2 = {"file": ("test_prods.csv", csv_content.encode("utf-8"), "text/csv")}
    r2 = client.post("/api/v1/etl/upload", files=files2)
    assert r2.status_code == 200
    assert r2.json()["status"] == "success"
    assert r2.json()["records_processed"] == 1

    # Verificar que el producto existe en el catálogo
    r_prod = client.get("/api/v1/pricing/margins?sku=SKU-TEST-900")
    assert r_prod.status_code == 200
    assert len(r_prod.json()) == 1
    assert r_prod.json()[0]["nombre"] == "Producto ETL Test"

# --- Test Global 500 Handler & Excel Upload ---
def test_global_500_exception_handler():
    from unittest.mock import patch
    with TestClient(app, raise_server_exceptions=False) as c:
        with patch("app.api.v1.endpoints.calculate_rop", side_effect=RuntimeError("Simulated critical error")):
            r = c.get("/api/v1/inventory/alerts")
            assert r.status_code == 500
            data = r.json()
            assert data["error"] == "InternalServerError"
            assert data["status_code"] == 500
            assert "Simulated critical error" in data["message"]

def test_etl_upload_excel_xlsx(client):
    import io
    import pandas as pd
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df_prod = pd.DataFrame([{
            "sku": "SKU-EXCEL-99",
            "nombre": "Valvula Maritima Excel",
            "categoria": "Industrial",
            "costo_unitario": 110.0,
            "precio_venta": 210.0
        }])
        df_prod.to_excel(writer, sheet_name="Productos", index=False)
    buffer.seek(0)

    files = {"file": ("demo.xlsx", buffer.read(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    r = client.post("/api/v1/etl/upload", files=files)
    assert r.status_code == 200
    assert r.json()["status"] == "success"
    assert r.json()["records_processed"] == 1

    r_chk = client.get("/api/v1/pricing/margins?sku=SKU-EXCEL-99")
    assert r_chk.status_code == 200
    assert len(r_chk.json()) == 1
