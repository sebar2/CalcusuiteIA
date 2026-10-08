"""
Tests de integración/unidad para la exportación de reportes ejecutivos a Excel y PDF (P1.3).
Verifica:
- Autorización RBAC (200 OK para controller_admin y analista_operaciones).
- Magic bytes para archivos binarios (Excel: PK\x03\x04, PDF: %PDF).
- Bloqueo para roles no autorizados (403 Forbidden para analista_comercial).
- Bloqueo para solicitudes no autenticadas (401 Unauthorized).
"""
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.core.security import (
    ROLE_CONTROLLER_ADMIN,
    ROLE_ANALISTA_OPERACIONES,
    ROLE_ANALISTA_COMERCIAL,
    create_access_token,
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_export_executive_excel_authorized_controller(client: TestClient):
    token = create_access_token({"sub": "admin@empresa.com", "role": ROLE_CONTROLLER_ADMIN})
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/reports/executive/excel", headers=headers)

    assert response.status_code == 200
    assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers.get("content-type", "")
    content_disp = response.headers.get("content-disposition", "")
    assert "attachment;" in content_disp
    assert "Reporte_Ejecutivo_Calcu_" in content_disp
    assert ".xlsx" in content_disp
    # Magic bytes de archivo ZIP/XLSX: PK\x03\x04
    assert response.content.startswith(b"PK\x03\x04")


def test_export_executive_pdf_authorized_operations(client: TestClient):
    token = create_access_token({"sub": "ops@empresa.com", "role": ROLE_ANALISTA_OPERACIONES})
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/reports/executive/pdf", headers=headers)

    assert response.status_code == 200
    assert "application/pdf" in response.headers.get("content-type", "")
    content_disp = response.headers.get("content-disposition", "")
    assert "attachment;" in content_disp
    assert "Minuta_Ejecutiva_Calcu_" in content_disp
    assert ".pdf" in content_disp
    # Magic bytes de archivo PDF: %PDF
    assert response.content.startswith(b"%PDF")


def test_export_executive_endpoints_unauthorized_anonymous(client: TestClient):
    response_excel = client.get("/api/v1/reports/executive/excel")
    assert response_excel.status_code == 401

    response_pdf = client.get("/api/v1/reports/executive/pdf")
    assert response_pdf.status_code == 401


def test_export_executive_endpoints_forbidden_commercial(client: TestClient):
    token = create_access_token({"sub": "ventas@empresa.com", "role": ROLE_ANALISTA_COMERCIAL})
    headers = {"Authorization": f"Bearer {token}"}

    response_excel = client.get("/api/v1/reports/executive/excel", headers=headers)
    assert response_excel.status_code == 403

    response_pdf = client.get("/api/v1/reports/executive/pdf", headers=headers)
    assert response_pdf.status_code == 403
