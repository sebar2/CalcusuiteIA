import pytest
from starlette.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_get_available_periods(client):
    res = client.get("/api/v1/budget/available-periods")
    assert res.status_code == 200
    data = res.json()
    assert "periods" in data
    assert "default_period" in data
    assert isinstance(data["periods"], list)
    assert len(data["periods"]) > 0
    assert data["default_period"] in data["periods"]
    # Verificar formato YYYY-MM
    for p in data["periods"]:
        parts = p.split("-")
        assert len(parts) == 2
        assert len(parts[0]) == 4
        assert len(parts[1]) == 2

def test_seed_budget_from_actuals(client):
    target_period = "2026-06"
    res = client.post(f"/api/v1/budget/seed-from-actuals?periodo={target_period}")
    assert res.status_code == 200
    data = res.json()
    assert data["periodo"] == target_period
    assert data["records_seeded"] > 0
    assert float(data["total_budgeted"]) > 0
    assert data["status"] in ["success", "already_exists"]

    # Llamada consecutiva para validar idempotencia / ya existente
    res_repeat = client.post(f"/api/v1/budget/seed-from-actuals?periodo={target_period}")
    assert res_repeat.status_code == 200
    data_repeat = res_repeat.json()
    assert data_repeat["status"] == "already_exists"

def test_multilevel_variance_and_scenarios_safe(client):
    # Probar que variance multilevel no arroje 500 para un período no sembrado previamente
    res_multi = client.get(
        "/api/v1/variance/multilevel?periodo=2030-01",
        headers={"X-User-Role": "controller_admin", "X-User-Id": "admin"}
    )
    assert res_multi.status_code == 200
    data_multi = res_multi.json()
    assert "total_budget" in data_multi
    assert "lines" in data_multi

    # Probar escenarios de presupuesto con modo heurístico para respuesta inmediata
    res_scenarios = client.post(
        "/api/v1/budget/scenarios",
        json={
            "periodo": "2030-01",
            "historical_sales": 300000.0,
            "historical_cogs": 150000.0,
            "engine_mode": "heuristic"
        },
        headers={"X-User-Role": "controller_admin", "X-User-Id": "admin"}
    )
    assert res_scenarios.status_code == 200
    data_scenarios = res_scenarios.json()
    assert "conservative" in data_scenarios
    assert "base" in data_scenarios
    assert "aggressive" in data_scenarios
    assert "historical" in data_scenarios
