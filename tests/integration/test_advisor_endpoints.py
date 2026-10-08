import pytest
from starlette.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_openapi_advisor_documentation(client):
    """Verifica que los endpoints del Copiloto Asesor estén registrados y documentados en OpenAPI."""
    r = client.get("/openapi.json")
    assert r.status_code == 200
    spec = r.json()
    paths = spec.get("paths", {})

    assert "/api/v1/advisor/variance-insights" in paths
    assert "post" in paths["/api/v1/advisor/variance-insights"]
    assert "/api/v1/advisor/inventory-insights" in paths
    assert "post" in paths["/api/v1/advisor/inventory-insights"]


def test_post_variance_insights_custom_lines(client):
    """Verifica el endpoint de variance insights con matriz de líneas enviada por el cliente."""
    payload = {
        "periodo": "2026-Q1",
        "lines": [
            {
                "categoria": "Maquinaria Pesada",
                "tipo": "VENTAS",
                "monto_presupuestado": "120000.00",
                "monto_real": "95000.00"
            },
            {
                "categoria": "Fletes Internacionales",
                "tipo": "OPEX",
                "monto_presupuestado": "15000.00",
                "monto_real": "22000.00"
            }
        ]
    }
    r = client.post("/api/v1/advisor/variance-insights", json=payload)
    assert r.status_code == 200
    data = r.json()

    for field in ["provider", "status", "latency_ms", "diagnosis", "cash_service_impact", "action_plan", "critical_items", "raw_markdown", "metrics_summary"]:
        assert field in data

    assert data["provider"] in ["local_llm", "deterministic_heuristic"]
    assert len(data["action_plan"]) == 3
    assert len(data["critical_items"]) >= 2
    assert "Maquinaria Pesada" in data["critical_items"]
    assert "Fletes Internacionales" in data["critical_items"]
    assert data["metrics_summary"]["unfavorable_count"] == 2
    assert data["metrics_summary"]["net_cash_impact"] < 0


def test_post_variance_insights_db_fallback(client):
    """Verifica el endpoint de variance insights cuando lines está vacío y extrae datos de la BD."""
    payload = {
        "periodo": "2026-Q1",
        "lines": []
    }
    r = client.post("/api/v1/advisor/variance-insights", json=payload)
    assert r.status_code == 200
    data = r.json()

    assert data["provider"] in ["local_llm", "deterministic_heuristic"]
    assert len(data["action_plan"]) == 3
    assert data["metrics_summary"]["total_lines"] >= 1
    assert "raw_markdown" in data


def test_post_inventory_insights_custom_items(client):
    """Verifica el endpoint de inventory insights con lista personalizada de SKUs."""
    payload = {
        "items": [
            {
                "sku": "SKU-CRITICO-01",
                "nombre": "Componente Hidráulico",
                "categoria": "Industrial",
                "stock_actual": 10,
                "rop": "80",
                "doh": "4.5",
                "lead_time_dias": "25.0",
                "is_alert": True
            },
            {
                "sku": "SKU-ESTABLE-02",
                "nombre": "Filtro Estándar",
                "categoria": "Repuestos",
                "stock_actual": 400,
                "rop": "100",
                "doh": "50.0",
                "lead_time_dias": "15.0",
                "is_alert": False
            }
        ]
    }
    r = client.post("/api/v1/advisor/inventory-insights", json=payload)
    assert r.status_code == 200
    data = r.json()

    for field in ["provider", "status", "latency_ms", "diagnosis", "cash_service_impact", "action_plan", "critical_items", "raw_markdown", "metrics_summary"]:
        assert field in data

    assert data["provider"] in ["local_llm", "deterministic_heuristic"]
    assert len(data["action_plan"]) == 3
    assert data["metrics_summary"]["ratio_quiebre_pct"] == 50.0
    assert "SKU-CRITICO-01" in data["critical_items"]


def test_post_inventory_insights_db_fallback(client):
    """Verifica el endpoint de inventory insights cuando items está vacío y extrae datos del catálogo en BD."""
    payload = {
        "items": []
    }
    r = client.post("/api/v1/advisor/inventory-insights", json=payload)
    assert r.status_code == 200
    data = r.json()

    assert data["provider"] in ["local_llm", "deterministic_heuristic"]
    assert len(data["action_plan"]) == 3
    assert data["metrics_summary"]["total_skus"] >= 1
    assert "raw_markdown" in data


def test_advisor_validation_error(client):
    """Verifica que el error de validación 422 sea capturado adecuadamente."""
    # Tipo numérico inválido en stock_actual
    payload = {
        "items": [
            {
                "sku": "SKU-ERR",
                "stock_actual": "no-es-numero",
                "rop": "50",
                "doh": "10"
            }
        ]
    }
    r = client.post("/api/v1/advisor/inventory-insights", json=payload)
    assert r.status_code == 422
    data = r.json()
    assert data["error"] == "ValidationError"
