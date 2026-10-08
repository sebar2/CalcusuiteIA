import pytest
from starlette.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_cors_vite_origin(client):
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET"
    }
    r = client.options("/api/v1/settings/preferences", headers=headers)
    assert r.status_code == 200
    assert "access-control-allow-origin" in r.headers
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert r.headers.get("access-control-allow-credentials") == "true"

def test_get_default_preferences(client):
    response = client.get("/api/v1/settings/preferences?user_id=test_fresh_user")
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "test_fresh_user"
    assert data["active_theme"] == "light_bitrix"
    assert "categoria" in data["saved_filters"]
    assert data["last_view"] == "control_room"

def test_update_and_persist_preferences(client):
    update_payload = {
        "user_id": "test_updating_user",
        "active_theme": "dark",
        "saved_filters": {
            "categoria": "Electrónica",
            "only_alerts": True,
            "lead_time_min": 15,
            "periodo": "2025-10"
        },
        "visible_columns": ["sku", "nombre", "stock_actual", "is_alert"],
        "last_view": "pricing_analytics"
    }
    
    post_res = client.post("/api/v1/settings/preferences", json=update_payload)
    assert post_res.status_code == 200
    res_data = post_res.json()
    assert res_data["active_theme"] == "dark"
    assert res_data["last_view"] == "pricing_analytics"
    assert res_data["saved_filters"]["categoria"] == "Electrónica"
    assert res_data["saved_filters"]["only_alerts"] is True

    # Verificar persistencia en consulta GET posterior
    get_res = client.get("/api/v1/settings/preferences?user_id=test_updating_user")
    assert get_res.status_code == 200
    persisted = get_res.json()
    assert persisted["active_theme"] == "dark"
    assert persisted["last_view"] == "pricing_analytics"
    assert persisted["saved_filters"]["categoria"] == "Electrónica"
