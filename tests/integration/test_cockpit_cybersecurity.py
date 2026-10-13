import pytest
from decimal import Decimal
from starlette.testclient import TestClient
from app.main import app
from app.services.etl_service import ETLService

@pytest.fixture(scope="module")
def client():
    # Asegurar que los datos iniciales de demo estén en estado pristine
    from app.database import SessionLocal
    from app.domain.models import OrdenReposicion
    db = SessionLocal()
    order1 = db.query(OrdenReposicion).filter(OrdenReposicion.id == 1).first()
    if order1:
        order1.etapa = "sugerido"
        db.commit()
    db.close()
    with TestClient(app) as c:
        yield c


def test_multilevel_variance_endpoint(client):
    headers = {"X-User-Role": "controller_admin", "X-User-Id": "test_controller"}
    response = client.get("/api/v1/variance/multilevel?periodo=2025-09", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_price_variance" in data
    assert "total_volume_variance" in data
    assert "total_mix_variance" in data
    assert "lines" in data
    assert len(data["lines"]) > 0
    if data["requires_mitigation"]:
        assert len(data["mitigation_plan_3_steps"]) == 3


def test_supply_kanban_stages_and_totals(client):
    headers = {"X-User-Role": "analista_operaciones"}
    response = client.get("/api/v1/supply/kanban", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["stages"]) == 6
    
    # Validar Etapa 1: Sugerido con acumulado exacto de $127,930
    stage_sugerido = next((s for s in data["stages"] if s["id"] == "sugerido"), None)
    assert stage_sugerido is not None
    assert Decimal(str(stage_sugerido["total_capital"])) == Decimal('127930.0000')

    # Validar Etapa 5: Proveedores Uy presente
    stage_proveedor_uy = next((s for s in data["stages"] if s["id"] == "proveedor_uy"), None)
    assert stage_proveedor_uy is not None


def test_rbac_segregation_of_duties_forbidden(client):
    """Un analista comercial NO puede mover una orden > $5,000 (requiere controller_admin)"""
    headers = {"X-User-Role": "analista_comercial", "X-User-Id": "vendedor_1"}
    # Orden #1 (SKU-1001, monto $50,000)
    response = client.patch(
        "/api/v1/supply/orders/1/stage",
        json={"target_stage": "aprobacion"},
        headers=headers
    )
    assert response.status_code == 403
    assert "controller_admin" in response.json()["detail"]


def test_rbac_controller_admin_authorized_and_audited(client):
    """El controller_admin SÍ puede mover la orden y genera un registro inmutable en audit_logs"""
    headers = {"X-User-Role": "controller_admin", "X-User-Id": "controller_chief"}
    try:
        response = client.patch(
            "/api/v1/supply/orders/1/stage",
            json={"target_stage": "aprobacion"},
            headers=headers
        )
        assert response.status_code == 200
        assert response.json()["etapa"] == "aprobacion"

        # Verificar registro en audit_logs
        audit_res = client.get("/api/v1/audit/logs?limit=5", headers=headers)
        assert audit_res.status_code == 200
        logs = audit_res.json()
        assert any(l["action"] == "MOVE_ORDER_STAGE" and l["user_id"] == "controller_chief" for l in logs)
    finally:
        # Restaurar orden 1 a sugerido para idempotencia
        from app.database.session import SessionLocal
        from app.models.entities import OrdenReposicion
        db = SessionLocal()
        o1 = db.query(OrdenReposicion).filter(OrdenReposicion.id == 1).first()
        if o1:
            o1.etapa = "sugerido"
            db.commit()
        db.close()


def test_initiative_evaluation_financial_metrics(client):
    payload = {
        "initiative_name": "Lanzamiento Nueva Línea de Colchones Híbridos",
        "initial_investment": 50000.0,
        "estimated_unit_cost": 120.0,
        "estimated_unit_price": 250.0,
        "expected_demand": 600,
        "fixed_costs": 8000.0
    }
    response = client.post("/api/v1/initiatives/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["break_even_units"] > 0
    assert float(data["break_even_revenue"]) > 0
    assert float(data["unit_contribution_margin"]) == 130.0
    assert data["viability"] in ("Factible", "Marginal", "Inviable")


def test_advisor_executive_summary_cross_area(client):
    payload = {
        "audience": "Directorio / Gerencia General",
        "periodo": "2025-09",
        "extra_context": "Evaluación cierre Q3"
    }
    response = client.post("/api/v1/advisor/executive-summary", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "Directorio" in data["audience"] or "Gerencia" in data["audience"]
    assert len(data["executive_summary"]) > 0


def test_anti_csv_injection_sanitization():
    """Valida neutralización de fórmulas peligrosas anteponiendo comilla simple"""
    malicious_inputs = [
        ("=1+1", "'=1+1"),
        ("+cmd|' /C calc'!A0", "'+cmd|' /C calc'!A0"),
        ("@SUM(A1:A10)", "'@SUM(A1:A10)"),
        ("-HYPERLINK('http://attacker.com')", "'-HYPERLINK('http://attacker.com')"),
        ("-150.50", "-150.50"), # Número legítimo negativo no se altera
        ("Normal Text", "Normal Text")
    ]
    for inp, expected in malicious_inputs:
        sanitized = ETLService._sanitize_anti_injection(inp)
        assert sanitized == expected


def test_file_size_limit_10mb_protection(client):
    """Archivos mayores a 10 MB son rechazados por ciberseguridad financiera"""
    oversized_bytes = b"0" * (10 * 1024 * 1024 + 1024) # 10MB + 1KB
    files = {"file": ("huge_attack.csv", oversized_bytes, "text/csv")}
    response = client.post("/api/v1/etl/upload", files=files)
    assert response.status_code == 422
    assert "10 MB" in response.json()["detail"]
