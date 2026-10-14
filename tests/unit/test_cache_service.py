import time
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from app.services.cache_service import InMemoryCache, memory_cache
from app.services.exchange_rate_service import ExchangeRateService, CACHE_KEY as BROU_CACHE_KEY
from app.services.tenders_feed_service import tenders_feed_service


def test_cache_set_and_get():
    """Verifica almacenamiento básico y recuperación en InMemoryCache."""
    cache = InMemoryCache()
    cache.set("test_key", {"status": "ok"}, ttl_seconds=60)
    assert cache.is_valid("test_key") is True
    val = cache.get("test_key")
    assert val == {"status": "ok"}


def test_cache_ttl_expiration():
    """Verifica que el elemento expire una vez superado el TTL."""
    cache = InMemoryCache()
    # TTL de 1 segundo
    cache.set("short_lived", "valor_temporal", ttl_seconds=1)
    assert cache.get("short_lived") == "valor_temporal"

    # Simular paso del tiempo alterando expires_at
    entry = cache._store["short_lived"]
    entry.expires_at = time.time() - 1  # Forzar expiración

    assert cache.is_valid("short_lived") is False
    assert cache.get("short_lived") is None
    # get_stale debe seguir retornando el valor para contingencia
    assert cache.get_stale("short_lived") == "valor_temporal"


def test_cache_get_or_set_avoids_redundant_calls():
    """Verifica que get_or_set no llame a la función fábrica si el dato está en caché."""
    cache = InMemoryCache()
    factory = MagicMock(return_value="resultado_pesado")

    # Primera llamada: invoca a factory
    val1 = cache.get_or_set("heavy_calc", factory, ttl_seconds=300)
    assert val1 == "resultado_pesado"
    assert factory.call_count == 1

    # Segunda llamada: retorna desde caché sin invocar factory
    val2 = cache.get_or_set("heavy_calc", factory, ttl_seconds=300)
    assert val2 == "resultado_pesado"
    assert factory.call_count == 1  # No se volvió a llamar


def test_cache_stale_fallback_on_factory_error():
    """Verifica que get_or_set devuelva el valor stale si la fábrica remota falla."""
    cache = InMemoryCache()
    cache.set("external_api", "ultimo_dato_bueno", ttl_seconds=1)
    
    # Expirar la clave
    cache._store["external_api"].expires_at = time.time() - 10

    # Fábrica que simula caída de red o timeout
    failing_factory = MagicMock(side_effect=ConnectionError("Fallo de red simulado"))

    # Con fallback_to_stale=True debe rescatar el último valor
    rescued_val = cache.get_or_set("external_api", failing_factory, ttl_seconds=60, fallback_to_stale=True)
    assert rescued_val == "ultimo_dato_bueno"


@pytest.mark.anyio
async def test_brou_exchange_rate_uses_cache():
    """Verifica que ExchangeRateService guarde en caché y no realice HTTP redundante."""
    # Limpiar caché para la clave BROU
    memory_cache.delete(BROU_CACHE_KEY)

    # Mock de httpx para simular una respuesta exitosa
    mock_html = (
        '<table><p class="moneda">Dólar</p>'
        '<p class="valor">41,20</p>'
        '<p class="valor">43,50</p></table>'
    )

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = mock_html
        mock_get.return_value = mock_resp

        # 1. Primera llamada: consume HTTP
        rate1 = await ExchangeRateService.fetch_brou_rate(force_refresh=True)
        assert rate1.buy == 41.20
        assert rate1.sell == 43.50
        assert mock_get.call_count == 1

        # 2. Segunda llamada: debe servirse de memory_cache sin invocar mock_get
        rate2 = await ExchangeRateService.fetch_brou_rate(force_refresh=False)
        assert rate2.buy == 41.20
        assert mock_get.call_count == 1  # Continúa en 1, garantizando que usó caché


def test_tenders_feed_service_uses_cache():
    """Verifica que el feed de licitaciones reutilice el feed cacheado en memoria."""
    # Invocar feed
    feed1 = tenders_feed_service.get_live_feed(nicho="TODAS", q="luminaria")
    assert feed1.status == "success"

    # Verificar presencia en memory_cache
    cache_key = "tenders:live_feed:TODAS:luminaria:default:0:20"
    assert memory_cache.is_valid(cache_key) is True

    # Segunda consulta inmediata
    feed2 = tenders_feed_service.get_live_feed(nicho="TODAS", q="luminaria")
    assert feed2.total == feed1.total
