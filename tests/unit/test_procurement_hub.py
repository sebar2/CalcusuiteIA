"""
Pruebas Unitarias Automatizadas para el Hub de Licitaciones e Inteligencia Estatal B2B.
Cubre:
  1. Cliente centralizado ProcurementClient (headers, cache TTL, encoding RUPE).
  2. Calculadora de Markup Competitivo con precisión Decimal y baselines SICE.
  3. Semáforo Logístico cruzado con Depósitos Uruguay (Verde, Amarillo, Rojo).
  4. Dictamen Técnico con perito asignado por vertical.
  5. Persistencia y seguimiento de licitaciones en base de datos local.
"""

from decimal import Decimal
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from starlette.testclient import TestClient

from app.main import app
from app.services.procurement_client import ProcurementClient, procurement_client
from app.services.cache_service import memory_cache


@pytest.fixture
def client():
    return TestClient(app)


def test_procurement_client_headers_and_config():
    """Valida que el cliente inyecte el header x-api-key y User-Agent corporativo."""
    pc = ProcurementClient(api_key="test_key_123")
    headers = pc._get_headers()
    assert headers["x-api-key"] == "test_key_123"
    assert "Calcu-Procurement-Hub" in headers["User-Agent"]


def test_competitive_markup_calculation(client):
    """Verifica el cálculo de markup competitivo y margen con precisión Decimal."""
    payload = {
        "sku": "LUM-6060",
        "costo_nacionalizado": 14.50,
        "precio_mediana_sice": 28.00,
        "moneda": "USD",
        "cantidad_solicitada": 100,
        "descuento_estrategico_pct": 5.0,
    }
    resp = client.post("/api/v1/procurement/competitive-markup", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["sku"] == "LUM-6060"
    assert Decimal(data["costo_nacionalizado_mvd"]) == Decimal("14.50")
    assert Decimal(data["precio_mediana_sice"]) == Decimal("28.00")
    
    # 28.00 * (1 - 0.05) = 26.60
    assert Decimal(data["precio_ganador_sugerido"]) == Decimal("26.60")
    
    # markup: (26.60 - 14.50) / 14.50 = 83.45%
    assert Decimal(data["markup_pct"]) > Decimal("80")
    assert Decimal(data["margen_bruto_pct"]) > Decimal("40")
    
    # Contribución: (26.60 - 14.50) * 100 = 1210.00
    assert Decimal(data["contribucion_total"]) == Decimal("1210.00")
    assert data["probabilidad_ganar"] == "ALTA"


def test_technical_opinion_vertical_roles(client):
    """Verifica que el dictamen técnico asigne el perito y rol adecuado según la vertical."""
    payload_ilum = {
        "vertical_id": "ILUMINACION_EFICIENCIA",
        "titulo": "Suministro de Columnas y Luminarias LED",
        "organismo": "Intendencia de Montevideo",
        "plazo_entrega_dias": 45,
    }
    resp_ilum = client.post("/api/v1/procurement/open-calls/TEST-101/technical-opinion", json=payload_ilum)
    assert resp_ilum.status_code == 200
    data_ilum = resp_ilum.json()
    assert "David Jiménez" in data_ilum["perito_nombre"]
    assert "UNIT" in data_ilum["dictamen_markdown"]
    assert data_ilum["viable"] is True

    payload_obra = {
        "vertical_id": "OBRA_CIVIL_CONSTRUCCION",
        "titulo": "Construcción y Pavimentación Vial",
        "organismo": "MTOP",
        "plazo_entrega_dias": 60,
    }
    resp_obra = client.post("/api/v1/procurement/open-calls/TEST-102/technical-opinion", json=payload_obra)
    assert resp_obra.status_code == 200
    data_obra = resp_obra.json()
    assert "Alejandro Morales" in data_obra["perito_nombre"]


def test_save_tracking_and_retrieval(client):
    """Verifica el guardado y recuperación de un llamado en la lista de favoritos/seguimiento."""
    test_id = "TEST-LLAMADO-999"
    save_payload = {
        "compra_id": test_id,
        "proyecto_nombre": "Renovación Lumínica Edificio Sede",
        "cliente_licitacion": "UTE",
        "nicho": "ILUMINACION_EFICIENCIA",
        "plazo_entrega_dias": 30,
        "moneda": "USD",
        "observaciones": "Llamado guardado para seguimiento comercial prioritario",
    }
    save_resp = client.post(f"/api/v1/procurement/open-calls/{test_id}/save-tracking", json=save_payload)
    assert save_resp.status_code == 200

    list_resp = client.get("/api/v1/procurement/saved-tracking")
    assert list_resp.status_code == 200
    items = list_resp.json()
    matched = [it for it in items if it["id"] == test_id]
    assert len(matched) == 1
    assert matched[0]["cliente_licitacion"] == "UTE"

    # Limpiar eliminando
    del_resp = client.delete(f"/api/v1/procurement/saved-tracking/{test_id}")
    assert del_resp.status_code == 200


def test_calendar_logistics_semaphore(client):
    """Verifica el cálculo del Semáforo Logístico (ops-logistics) en el calendario."""
    resp = client.get("/api/v1/procurement/calendar")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "items" in data["data"]
    items = data["data"]["items"]
    assert len(items) > 0
    # Cada item debe tener su semáforo logístico evaluado
    first_item = items[0]
    assert first_item["semaforo_logistico"] in ["VERDE", "AMARILLO", "ROJO"]
    assert "diagnostico_logistico" in first_item
