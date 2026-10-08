import pytest
import asyncio
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.domain.schemas import CompetitorItemResponse
from decimal import Decimal

client = TestClient(app)

def test_endpoint_search_competitors_global_timeout_safety():
    """
    Verifica que si la búsqueda profunda excede el tiempo límite o genera un asyncio.TimeoutError,
    el endpoint jamás colapsa con 500, sino que devuelve HTTP 200 con status 'success' y mensaje amigable.
    """
    with patch("app.services.ai_advisor_service.AIAdvisorService.search_competitors", new_callable=AsyncMock) as mock_search:
        mock_search.side_effect = asyncio.TimeoutError()

        res = client.post(
            "/api/v1/initiatives/search-competitors",
            json={
                "product_name": "Sommier King Size",
                "platform": "Google Search (Regionalizado)",
                "country": "Uruguay",
                "department": "Todo el país",
                "proposed_price": 450.0
            },
            headers={"X-User-Role": "controller_admin", "X-User-Id": "test_user"}
        )

        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["competitors"] == []
        assert "ventana de seguridad" in data["message"] or "tiempo" in data["message"].lower()


def test_endpoint_search_competitors_success_payload():
    """
    Verifica el flujo estándar de búsqueda retornando competidores con HTTP 200.
    """
    mock_items = [
        CompetitorItemResponse(
            id="google-tienda-uy",
            titulo="Sommier 2 Plazas Ortopedico",
            vendedor="Tienda Test UY",
            canal="Google Search (Uruguay)",
            precio_original=Decimal("18000.00"),
            moneda="UYU",
            precio_usd=Decimal("450.00"),
            ubicacion="Uruguay",
            url="https://tiendatest.com.uy/sommier"
        )
    ]
    with patch("app.services.ai_advisor_service.AIAdvisorService.search_competitors", new_callable=AsyncMock) as mock_search:
        mock_search.return_value = mock_items

        res = client.post(
            "/api/v1/initiatives/search-competitors",
            json={
                "product_name": "Sommier 2 Plazas",
                "platform": "google",
                "proposed_price": 450.0
            },
            headers={"X-User-Role": "controller_admin", "X-User-Id": "test_user"}
        )

        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert len(data["competitors"]) == 1
        assert data["competitors"][0]["vendedor"] == "Tienda Test UY"


def test_google_discovery_resilience_on_store_timeout():
    """
    Verifica que GoogleDiscoveryService procese concurrentemente y continúe
    sin abortar cuando una tienda individual falla o arroja timeout.
    """
    from app.services.google_discovery_service import GoogleDiscoveryService
    
    async def _run_test():
        with patch("app.services.google_discovery_service.search_google_competitors", new_callable=AsyncMock) as mock_google:
            mock_google.return_value = [
                {
                    "href": "https://tienda-rapida.com.uy/colchon",
                    "title": "Colchon Espuma Alta Densidad $ 12000 UYU",
                    "body": "Excelente colchon de espuma"
                },
                {
                    "href": "https://tienda-lenta.com.uy/colchon",
                    "title": "Colchon Lento Envio Gratis",
                    "body": "Colchon para el hogar"
                }
            ]

            # Descubrimiento
            results = await GoogleDiscoveryService.discover_uruguay_retail(
                search_query="colchon espuma",
                proposed_price=300.0,
                country="Uruguay",
                limit=20
            )

            assert len(results) >= 2
            # La tienda rápida debe tener precio parsed usando la cotización oficial del BROU
            rapida = next((r for r in results if "tienda-rapida" in r.id), None)
            assert rapida is not None
            from app.services.exchange_rate_service import ExchangeRateService
            fx = ExchangeRateService.get_cached_rate_used_sync()
            expected_usd = Decimal(str(round(12000.0 / fx, 2)))
            assert rapida.precio_usd == expected_usd

    asyncio.run(_run_test())
