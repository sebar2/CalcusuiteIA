import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_get_seeded_areas():
    """Verifica que las áreas sembradas se devuelven correctamente con centros_count."""
    response = client.get("/api/v1/areas")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 5

    codigos = [a["codigo"] for a in data]
    assert "SEC-LOG" in codigos
    assert "SEC-MKT" in codigos
    assert "SEC-OPS" in codigos

    # Verificar estructura
    for area in data:
        assert "id" in area
        assert "codigo" in area
        assert "nombre" in area
        assert "centros_count" in area
        assert isinstance(area["centros_count"], int)

def test_create_and_fetch_area():
    """Verifica la creación de una nueva área y validación de unicidad."""
    import uuid
    unique_code = f"SEC-{uuid.uuid4().hex[:4].upper()}"
    payload = {
        "codigo": unique_code,
        "nombre": f"Área de Innovación {unique_code}",
        "descripcion": "Gestión de modelos predictivos y pricing algorítmico",
    }
    create_res = client.post("/api/v1/areas", json=payload)
    assert create_res.status_code == 200
    new_area = create_res.json()
    assert new_area["codigo"] == unique_code
    assert new_area["nombre"] == payload["nombre"]
    assert new_area["centros_count"] == 0

    # Idempotencia: si ya existe, devuelve el registro existente con 200
    dup_res = client.post("/api/v1/areas", json=payload)
    assert dup_res.status_code == 200
    assert dup_res.json()["id"] == new_area["id"]
    assert dup_res.json()["codigo"] == unique_code

def test_get_seeded_users():
    """Verifica que los usuarios sembrados se devuelven con area_nombre."""
    response = client.get("/api/v1/users")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 5

    emails = [u["email"] for u in data]
    assert "logistica@calcu.com" in emails
    assert "growth@calcu.com" in emails

    for u in data:
        assert "id" in u
        assert "nombre" in u
        assert "email" in u
        if u.get("area_id"):
            assert u.get("area_nombre") is not None

def test_create_user_with_area():
    """Verifica el alta de un responsable vinculado a un área existente."""
    import uuid
    # Obtener un área
    areas = client.get("/api/v1/areas").json()
    target_area = areas[0]

    unique_email = f"gestor_{uuid.uuid4().hex[:6]}@calcu.com"
    payload = {
        "nombre": "Ing. Martín Fierro",
        "email": unique_email,
        "cargo": "Líder de Control Presupuestario",
        "area_id": target_area["id"],
    }
    res = client.post("/api/v1/users", json=payload)
    assert res.status_code == 200
    new_user = res.json()
    assert new_user["nombre"] == payload["nombre"]
    assert new_user["email"] == unique_email
    assert new_user["area_id"] == target_area["id"]
    assert new_user["area_nombre"] == target_area["nombre"]

def test_cost_center_enrichment_with_area_and_user():
    """Verifica que un centro de costo creado con area_id y responsable_id enriquece sus datos."""
    import uuid
    areas = client.get("/api/v1/areas").json()
    target_area = areas[0]

    users = client.get(f"/api/v1/users?area_id={target_area['id']}").json()
    assert len(users) > 0
    target_user = users[0]

    unique_code = f"CC-TEST-{uuid.uuid4().hex[:4].upper()}"
    cc_payload = {
        "codigo": unique_code,
        "nombre": f"Centro de Prueba {unique_code}",
        "responsable": target_user["nombre"],
        "area_id": target_area["id"],
        "responsable_id": target_user["id"],
    }
    cc_res = client.post("/api/v1/cost-centers", json=cc_payload)
    assert cc_res.status_code == 200
    created_cc = cc_res.json()
    assert created_cc["codigo"] == unique_code
    assert created_cc["area_id"] == target_area["id"]
    assert created_cc["area_nombre"] == target_area["nombre"]
    assert created_cc["responsable_id"] == target_user["id"]
    assert created_cc["responsable_nombre"] == target_user["nombre"]

    # Verificar en reporte presupuestario de centros de costo
    rep_res = client.get("/api/v1/budget/cost-centers?periodo=2026-03")
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    cc_item = next((c for c in rep_data["centros_costo"] if c["codigo"] == unique_code), None)
    assert cc_item is not None
    assert cc_item["area_nombre"] == target_area["nombre"]
    assert cc_item["responsable_nombre"] == target_user["nombre"]
