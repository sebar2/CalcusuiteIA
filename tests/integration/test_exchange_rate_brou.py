import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.exchange_rate_service import ExchangeRateService, FALLBACK_BUY, FALLBACK_SELL, FALLBACK_RATE_USED

client = TestClient(app)

def test_get_brou_exchange_rate_endpoint_success():
    """
    Verifica que el endpoint GET /api/v1/finance/exchange-rate/brou
    retorne los datos de cotización oficial del BROU con status 200.
    """
    res = client.get("/api/v1/finance/exchange-rate/brou")
    assert res.status_code == 200
    data = res.json()
    assert "BROU" in data["source"]
    assert data["currency_pair"] == "USD/UYU"
    assert data["buy"] > 0
    assert data["sell"] > 0
    assert data["rate_used"] > 0
    assert "updated_at" in data


def test_brou_exchange_rate_fallback_resilience():
    """
    Verifica que si la conexión con el portal del BROU falla,
    el servicio active automáticamente la contingencia sin lanzar excepciones.
    """
    ExchangeRateService._cached_response = None
    ExchangeRateService._cached_timestamp = 0.0

    with patch("httpx.AsyncClient.get", side_effect=Exception("Connection refused")):
        res = client.get("/api/v1/finance/exchange-rate/brou?force_refresh=true")
        assert res.status_code == 200
        data = res.json()
        assert "BROU" in data["source"]
        assert data["rate_used"] == FALLBACK_RATE_USED
        assert data["buy"] == FALLBACK_BUY
        assert data["sell"] == FALLBACK_SELL


def test_brou_html_parser():
    """
    Verifica que el método parse_brou_html extraiga correctamente los valores
    de compra y venta desde un extracto HTML del BROU.
    """
    sample_html = """
    <p class="moneda">Dólar</p>
    </td>
    <td>&nbsp;&nbsp;</td>
    <td><div class="linea"><p class="valor">40,15000</p></div></td>
    <td><div class="linea"><p class="valor">42,65000</p></div></td>
    """
    rates = ExchangeRateService.parse_brou_html(sample_html)
    assert rates is not None
    assert rates["buy"] == 40.15
    assert rates["sell"] == 42.65
    assert rates["rate_used"] == 41.40
