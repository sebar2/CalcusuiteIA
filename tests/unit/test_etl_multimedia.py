import pytest
import pandas as pd
from starlette.testclient import TestClient
from app.main import app
from app.services.etl_service import ETLService
from app.database.session import SessionLocal

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_normalize_df_columns_multimedia():
    df = pd.DataFrame(columns=["SKU", "Nombre", "Foto", "Numero PO", "Numero OV"])
    normalized = ETLService._normalize_df_columns(df)
    cols = normalized.columns.tolist()
    assert "sku" in cols
    assert "nombre" in cols
    assert "image_url" in cols
    assert "numero_po" in cols
    assert "numero_ov" in cols

def test_template_download_endpoint(client):
    for template_type in ["inventario", "ordenes_compra", "ordenes_venta", "opex", "crm"]:
        response = client.get(f"/api/v1/etl/template?tipo_archivo={template_type}")
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["content-type"]
        assert len(response.content) > 0

def test_ingest_all_downloaded_templates(client):
    db = SessionLocal()
    try:
        for template_type in ["inventario", "ordenes_compra", "ordenes_venta", "opex", "crm"]:
            # Descargar plantilla modelo
            resp = client.get(f"/api/v1/etl/template?tipo={template_type}")
            assert resp.status_code == 200
            content = resp.content
            
            # Ingestar vía ETLService
            result = ETLService.ingest_spreadsheet(content, f"plantilla_{template_type}.xlsx", db)
            assert result["status"] == "success"
            assert result["records_processed"] > 0, f"Template {template_type} processed 0 records"
            assert len(result["errors"]) == 0
    finally:
        db.close()
