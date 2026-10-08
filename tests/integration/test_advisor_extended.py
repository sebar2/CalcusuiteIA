import pytest
from decimal import Decimal
from starlette.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_endpoint_budget_scenarios(client):
    """Prueba el endpoint de los 3 escenarios presupuestarios."""
    payload = {
        "periodo": "2026-Q1",
        "historical_sales": "100000.00",
        "historical_cogs": "60000.00",
        "historical_opex": "20000.00"
    }
    r = client.post("/api/v1/advisor/budget-scenarios", json=payload)
    assert r.status_code == 200
    data = r.json()

    assert "conservative" in data
    assert "base" in data
    assert "aggressive" in data
    assert "raw_markdown" in data

    # Validar coherencia numérica en respuestas
    con = data["conservative"]
    assert Decimal(str(con["projected_sales"])) == Decimal("97000.00")
    assert Decimal(str(con["projected_opex"])) == Decimal("19000.00")

    base = data["base"]
    assert Decimal(str(base["projected_sales"])) == Decimal("106000.00")

    agg = data["aggressive"]
    assert Decimal(str(agg["projected_sales"])) == Decimal("115000.00")

def test_endpoint_integral_audit(client):
    """Prueba el Copiloto 1: Auditor Integral de Performance & Desvíos."""
    payload = {
        "periodo": "2026-Q1",
        "lines": [
            {
                "categoria": "Maquinaria",
                "tipo": "VENTAS",
                "monto_presupuestado": "100000.00",
                "monto_real": "90000.00"
            },
            {
                "categoria": "Fletes",
                "tipo": "OPEX",
                "monto_presupuestado": "15000.00",
                "monto_real": "20000.00"
            }
        ]
    }
    r = client.post("/api/v1/advisor/integral-audit", json=payload)
    assert r.status_code == 200
    data = r.json()

    assert "price_effect" in data
    assert "volume_effect" in data
    assert "mix_effect" in data
    assert "mitigation_plan_3_steps" in data
    assert len(data["mitigation_plan_3_steps"]) == 3
    assert len(data["critical_anomalies"]) >= 1

def test_endpoint_commercial_optimizer(client):
    """Prueba el Copiloto 2: Optimizador Comercial, Canales y Pricing."""
    payload = {
        "channels": [
            {
                "channel": "Mercado Libre",
                "sales": "50000.00",
                "cost": "35000.00",
                "commission_pct": "0.15",
                "freight": "2000.00",
                "gross_margin_pct": "0.30",
                "markup_pct": "0.4286",
                "contribution_margin": "5500.00",
                "status": "Desfasado",
                "suggested_action": "Subir precios 5%"
            }
        ],
        "promo_simulation": {
            "base_price": "100.00",
            "cost": "50.00",
            "discount_pct": "0.20",
            "commission_pct": "0.10",
            "freight": "5.00"
        }
    }
    r = client.post("/api/v1/advisor/commercial-optimizer", json=payload)
    assert r.status_code == 200
    data = r.json()

    assert "channel_analysis" in data
    assert "price_adjustments_suggested" in data
    assert "promo_evaluation" in data
    assert data["promo_evaluation"] is not None

def test_endpoint_supply_action_plan(client):
    """Prueba el Copiloto 3: Monitor Inteligente de Abastecimiento & Capital de Trabajo."""
    payload = {
        "items": [
            {
                "sku": "SKU-CRITICO-X",
                "nombre": "Rodamiento Industrial",
                "stock_actual": 5,
                "rop": "50",
                "doh": "3.0",
                "lead_time_dias": "30.0",
                "is_alert": True,
                "demanda_diaria_promedio": "2.0"
            }
        ],
        "target_doh": "45.0"
    }
    r = client.post("/api/v1/advisor/supply-action-plan", json=payload)
    assert r.status_code == 200
    data = r.json()

    assert "total_working_capital_required" in data
    assert "suggested_purchase_orders" in data
    assert len(data["suggested_purchase_orders"]) >= 1
    assert data["suggested_purchase_orders"][0]["priority"] == "Crítica"
    assert len(data["action_plan_3_steps"]) == 3

def test_endpoint_evaluate_initiative(client):
    """Prueba el Copiloto 4: Evaluador de Factibilidad de Nuevas Iniciativas."""
    payload = {
        "initiative_name": "Lanzamiento Línea Premium",
        "initial_investment": "40000.00",
        "estimated_unit_cost": "70.00",
        "estimated_unit_price": "120.00",
        "expected_demand": 1500,
        "fixed_costs": "5000.00",
        "competitors_notes": "Competidor directo vende a $130"
    }
    r = client.post("/api/v1/advisor/evaluate-initiative", json=payload)
    assert r.status_code == 200
    data = r.json()

    assert data["initiative_name"] == "Lanzamiento Línea Premium"
    assert Decimal(str(data["unit_contribution_margin"])) == Decimal("50.00")
    assert data["break_even_units"] == 900
    assert data["viability"] in ["Factible", "Marginal", "Inviable"]
    assert "raw_markdown" in data

def test_endpoint_generate_cross_report(client):
    """Prueba el Copiloto 5: Generador de Minutas y Reportes Cross-Área."""
    payload = {
        "audience": "Directorio / Gerencia General",
        "periodo": "2026-Q1"
    }
    r = client.post("/api/v1/advisor/generate-cross-report", json=payload)
    assert r.status_code == 200
    data = r.json()

    assert data["audience"] == "Directorio / Gerencia General"
    assert "key_metrics" in data
    assert "executive_summary" in data
    assert "raw_markdown" in data
