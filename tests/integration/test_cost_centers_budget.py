import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal, init_db
from app.models.entities import CentroCosto, PresupuestoCentroCosto

# Inicializar esquema y migraciones
init_db()

client = TestClient(app)

def test_get_cost_centers_seeded():
    """
    Test 1: Verifica que el endpoint retorne los centros de costo corporativos sembrados
    (CC-LOG, CC-MKT, CC-OPS, CC-ADM, CC-COM).
    """
    res = client.get("/api/v1/cost-centers")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 5

    codigos = [c["codigo"] for c in data]
    for expected in ["CC-LOG", "CC-MKT", "CC-OPS", "CC-ADM", "CC-COM"]:
        assert expected in codigos, f"Código esperado {expected} no encontrado en centros de costo"

    # Verificar estructura de respuesta
    primer_cc = data[0]
    assert "id" in primer_cc
    assert "codigo" in primer_cc
    assert "nombre" in primer_cc
    assert "responsable" in primer_cc
    assert "activo" in primer_cc


def test_create_cost_center_and_idempotency():
    """
    Test 2: Crear un nuevo centro de costo y verificar idempotencia por código.
    """
    payload = {
        "codigo": "CC-FINTECH",
        "nombre": "Fintech & Data Intelligence",
        "responsable": "Dra. Sofía Rivas",
        "activo": True
    }
    # Creación inicial
    res = client.post("/api/v1/cost-centers", json=payload)
    assert res.status_code == 200
    created = res.json()
    assert created["codigo"] == "CC-FINTECH"
    assert created["nombre"] == "Fintech & Data Intelligence"
    assert created["responsable"] == "Dra. Sofía Rivas"

    # Reenvío con mismo código debe retornar el registro existente sin duplicar
    res_dup = client.post("/api/v1/cost-centers", json=payload)
    assert res_dup.status_code == 200
    data_dup = res_dup.json()
    assert data_dup["id"] == created["id"]


def test_get_cost_center_budget_report_calculations():
    """
    Test 3: Evalúa el reporte de OPEX por centros de costo para el período sembrado '2025-09'.
    Verifica que las variaciones monetarias y porcentuales sean correctas y los estados cuadren.
    """
    res = client.get("/api/v1/budget/cost-centers?periodo=2025-09")
    assert res.status_code == 200
    report = res.json()

    assert report["periodo"] == "2025-09"
    assert float(report["total_opex_presupuestado"]) > 0
    assert float(report["total_opex_real"]) > 0
    
    # variacion_total = presupuestado - real (negativo indica sobregiro/exceso)
    expected_var = float(report["total_opex_presupuestado"]) - float(report["total_opex_real"])
    assert abs(float(report["variacion_total"]) - expected_var) < 0.05

    centros = report["centros_costo"]
    assert len(centros) > 0

    for cc in centros:
        assert "codigo" in cc
        assert "nombre" in cc
        assert isinstance(cc["total_presupuestado"], (int, float))
        assert not isinstance(cc["total_presupuestado"], str)
        assert isinstance(cc["total_real"], (int, float))
        assert not isinstance(cc["total_real"], str)
        assert isinstance(cc["variacion_neta"], (int, float))
        assert not isinstance(cc["variacion_neta"], str)
        assert isinstance(cc["variacion_pct"], (int, float))
        assert cc["estado"] in ["AHORRO", "EXCESO_GASTO", "EN_PRESUPUESTO"]
        
        # Validar sub-partidas
        for p in cc["partidas"]:
            assert "concepto_opex" in p
            assert isinstance(p["monto_presupuestado"], (int, float))
            assert not isinstance(p["monto_presupuestado"], str)
            assert isinstance(p["monto_real"], (int, float))
            assert not isinstance(p["monto_real"], str)
            assert isinstance(p["variacion_monto"], (int, float))
            assert not isinstance(p["variacion_monto"], str)
            assert p["estado"] in ["AHORRO", "EXCESO_GASTO", "EN_PRESUPUESTO"]


def test_save_cost_center_budget_batch():
    """
    Test 4: Carga por lote de partidas OPEX para un nuevo período presupuestario.
    """
    # 1. Obtener id de CC-LOG
    cc_res = client.get("/api/v1/cost-centers")
    assert cc_res.status_code == 200
    cc_list = cc_res.json()
    cc_log = next((c for c in cc_list if c["codigo"] == "CC-LOG"), None)
    assert cc_log is not None

    periodo_test = "2025-11"
    batch_payload = {
        "periodo": periodo_test,
        "items": [
            {
                "centro_costo_id": cc_log["id"],
                "concepto_opex": "Almacenamiento en Frío Tercerizado",
                "monto_presupuestado": 4500.0,
                "monto_real": 4200.0
            },
            {
                "centro_costo_id": cc_log["id"],
                "concepto_opex": "Seguro de Cargas de Alto Valor",
                "monto_presupuestado": 1800.0,
                "monto_real": 2100.0
            }
        ]
    }

    save_res = client.post("/api/v1/budget/cost-centers/batch", json=batch_payload)
    assert save_res.status_code == 200
    saved_data = save_res.json()
    assert saved_data["status"] == "success"
    assert saved_data["records_saved"] == 2
    assert float(saved_data["total_opex_presupuestado"]) == 6300.0

    # 2. Consultar reporte para el período nuevo
    rep_res = client.get(f"/api/v1/budget/cost-centers?periodo={periodo_test}")
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    assert float(rep_data["total_opex_presupuestado"]) == 6300.0
    assert float(rep_data["total_opex_real"]) == 6300.0  # 4200 + 2100


def test_get_total_monthly_opex():
    """
    Test 5: Endpoint resumen rápido de OPEX mensual para puente directo
    con el Cockpit de Inversiones / Nuevos Proyectos.
    """
    res = client.get("/api/v1/budget/cost-centers/total-opex?periodo=2025-09")
    assert res.status_code == 200
    data = res.json()
    assert data["periodo"] == "2025-09"
    assert isinstance(data["total_opex_presupuestado"], (int, float))
    assert not isinstance(data["total_opex_presupuestado"], str)
    assert isinstance(data["total_opex_real"], (int, float))
    assert not isinstance(data["total_opex_real"], str)
    assert data["centros_contabilizados"] >= 5
    assert data["partidas_contabilizadas"] >= 5


def test_get_budgets_numeric_types():
    """
    Test 6: Validación de contrato estricto numérico para /api/v1/budgets.
    Garantiza que variacion_neta, saldo_disponible, presupuesto_asignado y ejecutado
    sean siempre tipos primitivos numéricos (int/float) y jamás strings serializados.
    """
    response = client.get("/api/v1/budgets?periodo=2026-Q1")
    assert response.status_code == 200
    data = response.json()

    assert "centros_costo" in data
    assert len(data["centros_costo"]) >= 5
    for cc in data.get("centros_costo", []):
        assert isinstance(cc["variacion_neta"], (int, float))
        assert not isinstance(cc["variacion_neta"], str)
        assert isinstance(cc["presupuesto_asignado"], (int, float))
        assert not isinstance(cc["presupuesto_asignado"], str)
        assert isinstance(cc["ejecutado"], (int, float))
        assert not isinstance(cc["ejecutado"], str)
        assert isinstance(cc["saldo_disponible"], (int, float))
        assert not isinstance(cc["saldo_disponible"], str)

