import pytest
from starlette.testclient import TestClient

from app.main import app
from app.database.session import SessionLocal
from app.models.entities import CentroCosto, Client, Supplier
from app.core.security import create_access_token, ROLE_CONTROLLER_ADMIN

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def auth_headers():
    token = create_access_token({"sub": "controller@calcu.com", "role": ROLE_CONTROLLER_ADMIN})
    return {"Authorization": f"Bearer {token}"}

def test_list_and_create_client(client: TestClient, auth_headers: dict):
    # Crear cliente mediante API
    payload = {
        "nombre": "Test Cliente Alpha SpA",
        "rut": "76.999.888-1",
        "email": "contacto@alpha.cl",
        "phone": "+56 9 1122 3344",
        "address": "Av. Vitacura 5000",
        "logo_url": "https://example.com/logo.png"
    }
    create_res = client.post("/api/v1/crm/clients", json=payload, headers=auth_headers)
    assert create_res.status_code in [201, 400]
    
    # Listar clientes
    list_res = client.get("/api/v1/crm/clients?q=Alpha", headers=auth_headers)
    assert list_res.status_code == 200
    clients_list = list_res.json()
    assert len(clients_list) > 0
    client_id = clients_list[0]["id"]

    # Actualizar cliente
    update_payload = {"phone": "+56 9 9999 8888"}
    update_res = client.put(f"/api/v1/crm/clients/{client_id}", json=update_payload, headers=auth_headers)
    assert update_res.status_code == 200
    assert update_res.json()["phone"] == "+56 9 9999 8888"


def test_list_and_create_supplier(client: TestClient, auth_headers: dict):
    # Crear proveedor mediante API
    payload = {
        "nombre": "Test Proveedor Beta SA",
        "rut": "77.888.999-2",
        "email": "ventas@beta.cl",
        "phone": "+56 2 2233 4455",
        "address": "Camino Melipilla 1000",
        "logo_url": "https://example.com/beta.png"
    }
    create_res = client.post("/api/v1/suppliers", json=payload, headers=auth_headers)
    assert create_res.status_code in [201, 400]

    # Listar proveedores
    list_res = client.get("/api/v1/suppliers?q=Beta", headers=auth_headers)
    assert list_res.status_code == 200
    suppliers_list = list_res.json()
    assert len(suppliers_list) > 0
    supplier_id = suppliers_list[0]["id"]

    # Actualizar proveedor
    update_res = client.put(f"/api/v1/suppliers/{supplier_id}", json={"address": "Nueva Dirección 123"}, headers=auth_headers)
    assert update_res.status_code == 200
    assert update_res.json()["address"] == "Nueva Dirección 123"


def test_cost_center_budget_line_crud(client: TestClient, auth_headers: dict):
    db = SessionLocal()
    try:
        cc = db.query(CentroCosto).first()
        if not cc:
            cc = CentroCosto(codigo="CC-TEST-01", nombre="Centro Prueba", responsable="Test Lead")
            db.add(cc)
            db.commit()
            db.refresh(cc)
        cc_id = cc.id
    finally:
        db.close()

    payload = {
        "periodo": "2026-05",
        "centro_costo_id": cc_id,
        "concepto_opex": "Prueba Licencias Cloud & Servidores",
        "monto_presupuestado": 12500.0,
        "monto_real": 11000.0
    }
    res = client.post("/api/v1/budget/cost-centers", json=payload, headers=auth_headers)
    assert res.status_code in [201, 400]
    
    if res.status_code == 201:
        data = res.json()
        assert data["concepto_opex"] == payload["concepto_opex"]
        assert data["variacion_monto"] == 1500.0
        assert data["estado"] == "OK"
        partida_id = data["id"]

        # Actualizar partida
        upd_res = client.put(f"/api/v1/budget/cost-centers/{partida_id}", json={"monto_real": 13500.0}, headers=auth_headers)
        assert upd_res.status_code == 200
        upd_data = upd_res.json()
        assert upd_data["monto_real"] == 13500.0
        assert upd_data["variacion_monto"] == -1000.0
        assert upd_data["estado"] == "EXCEDIDO"


def test_ollama_models_list_and_active(client: TestClient, auth_headers: dict):
    # Obtener listado de modelos (fallback o tags reales)
    res = client.get("/api/v1/advisor/models")
    assert res.status_code == 200
    data = res.json()
    assert "models" in data
    assert len(data["models"]) >= 11
    assert "active_model" in data

    # Conmutar modelo activo
    target_model = "deepseek-r1:8b"
    set_res = client.post("/api/v1/advisor/active-model", json={"model": target_model}, headers=auth_headers)
    assert set_res.status_code == 200
    set_data = set_res.json()
    assert set_data["status"] == "success"
    assert set_data["active_model"] == target_model
