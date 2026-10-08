from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_warehouses_crud():
    # 1. Listar depósitos semilla
    res = client.get("/api/v1/warehouses")
    assert res.status_code == 200
    warehouses = res.json()
    assert len(warehouses) >= 4
    wh_ids = [w["id"] for w in warehouses]
    assert "dep-central" in wh_ids

    # 2. Crear un nuevo depósito
    unique_id = f"dep-salto-{int(datetime.now(timezone.utc).timestamp())}"
    new_wh = {
        "id": unique_id,
        "nombre": "Centro de Distribución Salto",
        "tipo": "SUCURSAL",
        "ubicacion": "Salto, Uruguay",
        "capacidad_unidades": 5000,
        "activo": True
    }
    res_create = client.post("/api/v1/warehouses", json=new_wh)
    assert res_create.status_code == 201
    created_data = res_create.json()
    assert created_data["id"] == unique_id
    assert created_data["nombre"] == "Centro de Distribución Salto"

    # 3. Actualizar depósito
    update_payload = {
        "nombre": "Hub Logístico Regional Salto",
        "capacidad_unidades": 7500
    }
    res_update = client.put(f"/api/v1/warehouses/{unique_id}", json=update_payload)
    assert res_update.status_code == 200
    updated_data = res_update.json()
    assert updated_data["nombre"] == "Hub Logístico Regional Salto"
    assert updated_data["capacidad_unidades"] == 7500


def test_areas_and_users_update():
    # 1. Listar áreas existentes y actualizar una
    res_areas = client.get("/api/v1/areas")
    assert res_areas.status_code == 200
    areas = res_areas.json()
    assert len(areas) > 0
    target_area = areas[0]
    area_id = target_area["id"]

    res_up_area = client.put(f"/api/v1/areas/{area_id}", json={
        "descripcion": "Área auditada y certificada bajo gobernanza corporativa"
    })
    assert res_up_area.status_code == 200
    assert res_up_area.json()["descripcion"] == "Área auditada y certificada bajo gobernanza corporativa"

    # 2. Listar usuarios y actualizar uno
    res_users = client.get("/api/v1/users")
    assert res_users.status_code == 200
    users = res_users.json()
    assert len(users) > 0
    target_user = users[0]
    user_id = target_user["id"]

    res_up_user = client.put(f"/api/v1/users/{user_id}", json={
        "cargo": "Director Ejecutivo de Operaciones"
    })
    assert res_up_user.status_code == 200
    assert res_up_user.json()["cargo"] == "Director Ejecutivo de Operaciones"


def test_commitments_crud_and_ai_audit():
    # 1. Listar compromisos
    res = client.get("/api/v1/commitments")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)

    # 2. Crear un compromiso nuevo
    due_date = (datetime.now(timezone.utc) + timedelta(days=15)).strftime("%Y-%m-%d")
    new_com = {
        "tarea": "Renegociación de tarifa de flete aéreo urgente",
        "area": "Comercio Exterior",
        "responsable": "Lic. Sebastián Silva",
        "monto": 2500.0,
        "fecha_limite": due_date,
        "urgencia": "ALTA",
        "estado": "PENDIENTE",
        "origen": "Comité de Compras"
    }
    res_create = client.post("/api/v1/commitments", json=new_com)
    assert res_create.status_code == 201
    created_com = res_create.json()
    com_id = created_com["id"]
    assert created_com["tarea"] == new_com["tarea"]
    assert created_com["urgencia"] == "ALTA"

    # 3. Actualizar el compromiso
    res_update = client.put(f"/api/v1/commitments/{com_id}", json={
        "estado": "EN_CURSO",
        "monto": 2200.0
    })
    assert res_update.status_code == 200
    assert res_update.json()["estado"] == "EN_CURSO"
    assert res_update.json()["monto"] == 2200.0

    # 4. Auditoría IA de compromisos
    res_audit = client.post("/api/v1/commitments/ai-audit?periodo=2026-Q1")
    assert res_audit.status_code == 200
    audit_data = res_audit.json()
    assert audit_data["status"] == "success"
    assert len(audit_data["compromisos_urgentes_sugeridos"]) == 3
    assert "Auditoría ejecutiva" in audit_data["diagnostico_ia"]


def test_purchase_order_suggestions():
    # Probar endpoint de sugerencias cruzando Stock x CRM
    res = client.post("/api/v1/purchase-orders/suggestions")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "total_skus_evaluados" in data
    assert "total_skus_deficit" in data
    assert "inversion_total_sugerida_usd" in data
    assert isinstance(data["sugerencias"], list)

    if len(data["sugerencias"]) > 0:
        sug = data["sugerencias"][0]
        assert "sku" in sug
        assert "cantidad_sugerida_compra" in sug
        assert "lote_sugerido" in sug
        assert sug["lote_sugerido"].startswith("LOT-")


def test_etl_templates_download():
    for tipo in ["inventario", "opex", "crm"]:
        res = client.get(f"/api/v1/etl/template?tipo={tipo}")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert len(res.content) > 1000  # Archivo binario Excel válido
