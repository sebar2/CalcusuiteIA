"""
Tests de integración para el endpoint consolidado de las 19 Intendencias Departamentales
de Uruguay y sus aliases de procurement (/api/v1/procurement/intendencias, /competitors, /prices, /tenders).
"""

import pytest
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_procurement_intendencias_all_19_departments():
    response = client.get("/api/v1/procurement/intendencias")
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    data = payload["data"]
    assert "departments" in data
    departments = data["departments"]
    assert len(departments) == 19

    dept_names = {d["departamento"] for d in departments}
    expected_depts = {
        "Montevideo", "Canelones", "Maldonado", "Salto", "Paysandú",
        "Colonia", "Rivera", "Tacuarembó", "San José", "Rocha",
        "Cerro Largo", "Soriano", "Artigas", "Florida", "Lavalleja",
        "Durazno", "Río Negro", "Treinta y Tres", "Flores"
    }
    assert expected_depts.issubset(dept_names)

    for d in departments:
        assert "id" in d
        assert "nombre_intendencia" in d
        assert "licitaciones_activas" in d
        assert "presupuesto_estimado_uyu" in d
        assert "plazo_pago_dso_dias" in d
        assert d["plazo_pago_dso_dias"] >= 60  # Comunas tienen DSO extendido
        assert "dso_semaforo" in d
        assert "methodsBreakdown" in d
        assert "ultimos_contratos" in d
        assert isinstance(d["ultimos_contratos"], list)


def test_procurement_intendencias_filtering():
    response = client.get("/api/v1/procurement/intendencias", params={"rubro": "Iluminación"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    departments = payload["data"]["departments"]
    assert len(departments) > 0


def test_procurement_aliases_availability():
    res_comp = client.get("/api/v1/procurement/competitors")
    assert res_comp.status_code == 200

    res_price = client.get("/api/v1/procurement/prices")
    assert res_price.status_code == 200

    res_tender = client.get("/api/v1/procurement/tenders")
    assert res_tender.status_code == 200
