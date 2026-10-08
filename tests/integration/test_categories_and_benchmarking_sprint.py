import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.ai_advisor_service import AIAdvisorService
from app.database.session import SessionLocal
from app.models.entities import Category, PresupuestoMeta

client = TestClient(app)

def test_get_categories_list():
    res = client.get("/api/v1/categories")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 7
    names = [c["nombre"].lower() for c in data]
    assert "electrónica" in names or "electronica" in names
    assert "dormitorio" in names or "living" in names


def test_create_category_dynamic_and_idempotence():
    import uuid
    unique_suffix = uuid.uuid4().hex[:6]
    test_cat_name = f"TestCat_{unique_suffix}"
    
    # 1. Crear categoría nueva
    res = client.post(
        "/api/v1/categories",
        json={"nombre": test_cat_name, "margen_target_pct": 35.0},
        headers={"X-User-Role": "controller_admin", "X-User-Id": "admin_test"}
    )
    assert res.status_code == 200
    cat_data = res.json()
    assert cat_data["nombre"] == test_cat_name
    assert cat_data["margen_target_pct"] == 35.0
    assert cat_data["id"] > 0

    # 2. Re-crear con diferente casing -> Debe ser idempotente y devolver la misma
    res2 = client.post(
        "/api/v1/categories",
        json={"nombre": test_cat_name.lower(), "margen_target_pct": 40.0},
        headers={"X-User-Role": "controller_admin", "X-User-Id": "admin_test"}
    )
    assert res2.status_code == 200
    cat_data2 = res2.json()
    assert cat_data2["id"] == cat_data["id"]
    assert cat_data2["nombre"] == test_cat_name


def test_competitor_search_antirruido_and_blacklist():
    """
    Verifica que el rastreo de competidores:
    1. Sanitiza la región/departamento removiendo las palabras literales 'departamento' o 'estado'.
    2. Descarta dominios o textos de la blacklist inmobiliaria (infocasas, inmuebles, alquiler, etc.).
    3. Retorna competidores con precios verificables y URLs válidas.
    """
    fake_ml_results = [
        {
            "id": "MLU1",
            "title": "Sillón Relax Cuero Reclinable 1 Cuerpo",
            "price": 8500.0,
            "currency_id": "UYU",
            "permalink": "https://articulo.mercadolibre.com.uy/MLU-1",
            "seller": {"nickname": "MUEBLERIA_SUR"},
            "address": {"state_name": "Canelones"}
        },
        {
            "id": "MLU2_INMOBILIARIA",
            "title": "Alquiler Apartamento 2 Dormitorios Canelones",
            "price": 25000.0,
            "currency_id": "UYU",
            "permalink": "https://inmuebles.mercadolibre.com.uy/MLU-2",
            "seller": {"nickname": "INMOBILIARIA_CENTRO"},
            "address": {"state_name": "Canelones"}
        },
        {
            "id": "MLU3",
            "title": "Sillón Individual Nórdico Madera",
            "price": 6200.0,
            "currency_id": "UYU",
            "permalink": "https://articulo.mercadolibre.com.uy/MLU-3",
            "seller": {"nickname": "DECO_HOME"},
            "address": {"state_name": "Montevideo"}
        }
    ]

    mock_client = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"results": fake_ml_results}
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    with patch("httpx.AsyncClient", return_value=mock_client):
        payload = {
            "product_name": "Sillón Reclinable",
            "category": "Living",
            "proposed_price": 220.0,
            "search_query": "sillon reclinable",
            "platform": "mercadolibre",
            "country": "Uruguay",
            "department": "Departamento de Canelones"
        }
        res = client.post(
            "/api/v1/initiatives/search-competitors",
            json=payload,
            headers={"X-User-Role": "controller_admin", "X-User-Id": "controller_admin_user"}
        )
        assert res.status_code == 200
        raw_data = res.json()
        results = raw_data.get("competitors", []) if isinstance(raw_data, dict) else raw_data
        assert isinstance(results, list)
        assert len(results) > 0
        # Verificar que el ítem inmobiliario fue descartado por la blacklist
        titles = [r["titulo"].lower() for r in results]
        assert not any("alquiler" in t or "apartamento" in t for t in titles)
        # Verificar que los ítems válidos fueron incluidos con precio > 0 y enlace real
        for r in results:
            assert float(r["precio_usd"]) > 0
            assert r["url"].startswith("http")
            assert not any(bl in r["url"].lower() for bl in ["infocasas", "inmuebles"])


def test_ollama_call_options_and_token_config():
    """
    Verifica que las llamadas a Ollama se configuren con num_ctx: 8192 y num_predict: 4096.
    """
    mock_client = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Análisis completado exitosamente."}}]
    }

    async def mock_post(*args, **kwargs):
        json_body = kwargs.get("json", {})
        assert "options" in json_body
        assert json_body["options"].get("num_ctx") == 8192
        assert json_body["options"].get("num_predict") == 4096
        return mock_resp

    mock_client.post = mock_post
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None

    with patch("httpx.AsyncClient", return_value=mock_client):
        import asyncio
        res = asyncio.run(AIAdvisorService._call_local_llm("Evalúa este proyecto", engine_mode="force_llm"))
        assert res is not None
        assert "Análisis completado" in res[0]


def test_budget_manual_batch_and_reset_period():
    """
    Verifica la persistencia de grilla manual V0 y el reseteo seguro con rol controller_admin.
    """
    test_period = "2026-TEST"
    batch_payload = {
        "periodo": test_period,
        "version": "V0_Manual",
        "items": [
            {
                "categoria_id": 1,
                "categoria_nombre": "Electrónica",
                "monto_presupuestado": 15000.0,
                "unidades_presupuestadas": 150
            },
            {
                "categoria_id": 2,
                "categoria_nombre": "Accesorios",
                "monto_presupuestado": 8000.0,
                "unidades_presupuestadas": 200
            }
        ]
    }

    # 1. Guardar manual batch
    save_res = client.post(
        "/api/v1/budget/manual-batch",
        json=batch_payload,
        headers={"X-User-Role": "controller_admin", "X-User-Id": "controller_admin_user"}
    )
    assert save_res.status_code == 200
    save_data = save_res.json()
    assert save_data["status"] == "success"
    assert save_data["records_saved"] == 2
    assert float(save_data["total_budgeted"]) == 23000.0

    # 2. Intento de reseteo por rol no autorizado -> 403
    del_forbidden = client.delete(
        f"/api/v1/budget/period/{test_period}",
        headers={"X-User-Role": "comercial", "X-User-Id": "comercial_user"}
    )
    assert del_forbidden.status_code == 403

    # 3. Reseteo por controller_admin -> 200
    del_ok = client.delete(
        f"/api/v1/budget/period/{test_period}",
        headers={"X-User-Role": "controller_admin", "X-User-Id": "controller_admin_user"}
    )
    assert del_ok.status_code == 200
    del_data = del_ok.json()
    assert del_data["status"] == "success"
    assert del_data["records_deleted"] >= 2


def test_google_discovery_service_uruguay_retail():
    """
    Valida que el motor GoogleDiscoveryService:
    1. Retorne 50+ empresas uruguayas independientes (1 empresa = 1 fila).
    2. Excluya absolutamente mercadolibre.com.uy.
    3. Asegure deduplicación estricta por dominio raíz.
    4. Entregue precios de mercado racionales (USD 60 - 2200).
    """
    import asyncio
    from app.services.google_discovery_service import GoogleDiscoveryService
    
    results = asyncio.run(GoogleDiscoveryService.discover_uruguay_retail(
        query="colchon 2 plazas",
        department="Montevideo",
        limit=100
    ))
    
    assert len(results) >= 50, f"Se esperaban al menos 50 empresas y se obtuvieron {len(results)}"
    
    domains = set()
    for item in results:
        # 1. No mercadolibre
        assert "mercadolibre.com.uy" not in item.url.lower(), f"Mercado Libre detectado en Google Search: {item.url}"
        assert "mercadolibre" not in item.vendedor.lower()
        
        # 2. Precios en rango de mercado
        assert 60.0 <= item.precio_usd <= 2200.0, f"Precio fuera de rango racional: {item.precio_usd}"
        
        # 3. Deduplicación por dominio raíz (1 empresa = 1 fila)
        domain = GoogleDiscoveryService.extract_root_domain(item.url)
        assert domain not in domains, f"Dominio duplicado: {domain}"
        domains.add(domain)


def test_api_search_competitors_google_channel():
    """
    Valida el endpoint /api/v1/initiatives/search-competitors con platform='google'.
    """
    payload = {
        "product_name": "Sommier y Colchón 2 Plazas",
        "category": "Dormitorio",
        "proposed_price": 320.0,
        "search_query": "sommier colchon 2 plazas",
        "platform": "google",
        "country": "Uruguay",
        "department": "Montevideo"
    }
    res = client.post(
        "/api/v1/initiatives/search-competitors",
        json=payload,
        headers={"X-User-Role": "controller_admin", "X-User-Id": "controller_admin_user"}
    )
    assert res.status_code == 200
    raw_data = res.json()
    data = raw_data.get("competitors", []) if isinstance(raw_data, dict) else raw_data
    assert isinstance(data, list)
    assert len(data) >= 50, f"Endpoint devolvió {len(data)} competidores, se esperaban >= 50"
    
    for item in data:
        assert "mercadolibre.com.uy" not in item["url"].lower()
        assert float(item["precio_usd"]) > 0
        assert "google" in item["canal"].lower()


def test_resilient_google_search_lampara_decorativo():
    """
    Prueba crítica con 'Lampara decorativo':
    - Envía select con 'Google Search (Regionalizado)' y departamento 'Todo el país'.
    - Verifica que JAMÁS arroja HTTP 500 ni HTTP 422.
    - Si DuckDuckGo responde, entrega competidores; si no hay coincidencias o hay microbloqueo,
      retorna HTTP 200 con competitors=[] y mensaje explicativo claro.
    """
    payload = {
        "product_name": "Lampara decorativo",
        "category": "General",
        "price": 45.0,
        "platform": "Google Search (Regionalizado)",
        "country": "Uruguay",
        "region": "Todo el país"
    }
    res = client.post(
        "/api/v1/initiatives/search-competitors",
        json=payload,
        headers={"X-User-Role": "controller_admin", "X-User-Id": "controller_admin_user"}
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, dict)
    assert "status" in data
    assert "competitors" in data
    assert "total_empresas" in data
    assert isinstance(data["competitors"], list)

    if len(data["competitors"]) == 0:
        assert data.get("message") is not None
        assert "tiendas locales" in data["message"].lower() or "aviso" in data["message"].lower()
    else:
        for item in data["competitors"]:
            assert float(item["precio_usd"]) > 0
            assert "mercadolibre.com.uy" not in item["url"].lower()


def test_evaluate_selection_currency_consistency_uyu():
    """
    Auditoría técnica de coherencia monetaria en Fase 3 (UYU):
    - Envía target_currency='UYU', precio propuesto 3000 UYU.
    - Los competidores tienen precio_usd ~ 73.53 y precio_uyu ~ 2970.61.
    - Valida que avg_price esté en rango representativo (~2970 UYU) y no en 73 pesos.
    - Valida que el diferencial no sufra la distorsión de +3980.0%.
    - Valida que en raw_markdown no figuren menciones a USD cuando la moneda es UYU.
    """
    payload = {
        "product_name": "Mueble de Cocina Bajo Mesada",
        "category": "Cocina",
        "target_currency": "UYU",
        "proposed_price": 3000.0,
        "proposed_cost": 1500.0,
        "expected_demand": 40,
        "initial_investment": 20000.0,
        "engine_mode": "heuristic",
        "selected_competitors": [
            {
                "id": "comp_1",
                "titulo": "Bajo Mesada 1.20m",
                "vendedor": "Divino",
                "canal": "Google Search (Directo)",
                "precio_usd": 73.53,
                "precio_uyu": 2970.61,
                "moneda": "USD"
            },
            {
                "id": "comp_2",
                "titulo": "Mueble 2 Puertas Melamina",
                "vendedor": "Sodimac",
                "canal": "Google Search (Directo)",
                "precio_usd": 74.25,
                "precio_uyu": 3000.00,
                "moneda": "USD"
            }
        ]
    }
    res = client.post(
        "/api/v1/initiatives/evaluate-selection",
        json=payload,
        headers={"X-User-Role": "controller_admin", "X-User-Id": "controller_admin_user"}
    )
    assert res.status_code == 200
    data = res.json()
    assert float(data["avg_price"]) > 2500.0, f"Promedio en UYU no debe ser 73 pesos: {data['avg_price']}"
    assert abs(float(data["price_competitiveness_pct"])) < 15.0, f"Diferencial distorsionado: {data['price_competitiveness_pct']}"
    assert "USD" not in data["raw_markdown"], "raw_markdown no debe contener 'USD' cuando la moneda es UYU"
    assert "UYU" in data["raw_markdown"], "raw_markdown debe contener 'UYU' explícitamente"


def test_financial_metrics_edge_cases():
    """
    Valida mitigación rigurosa de casos límite financieros:
    1. CAPEX = 0 -> Payback inmediato sin división por cero ni error.
    2. MCU <= 0 (Precio <= Costo) -> break_even_units is None, cobertura is None.
    3. FON <= 0 con CAPEX > 0 -> Payback no amortizable por flujo deficitario.
    4. Escenario del brief: Precio 3000 UYU, Costo 800 UYU, CAPEX 0 UYU, OPEX 120000 UYU, Demanda 400 u.
    """
    from app.services.initiatives_service import calculate_financial_metrics

    # Caso 1: CAPEX = 0
    m1 = calculate_financial_metrics(
        price=100.0,
        direct_cost=50.0,
        demand=200,
        capex=0.0,
        monthly_opex=1000.0
    )
    assert m1["payback_status"] == "Inmediato (Sin CAPEX previo)"
    assert m1["payback_cycles"] == 0.0
    assert m1["break_even_units"] == 20.0  # 1000 / 50 = 20

    # Caso 2: MCU <= 0 (Precio <= Costo)
    m2 = calculate_financial_metrics(
        price=50.0,
        direct_cost=60.0,
        demand=100,
        capex=5000.0,
        monthly_opex=2000.0
    )
    assert m2["break_even_units"] is None
    assert m2["break_even_coverage_pct"] is None
    assert m2["unit_contribution_margin"] == -10.0
    assert m2["net_operating_cashflow"] < 0
    assert "No amortizable" in m2["payback_status"]

    # Caso 3: FON <= 0 con CAPEX > 0
    m3 = calculate_financial_metrics(
        price=100.0,
        direct_cost=80.0,
        demand=50,
        capex=10000.0,
        monthly_opex=2000.0  # Margen bruto: 20 * 50 = 1000 < 2000 OPEX -> FON = -1000
    )
    assert m3["net_operating_cashflow"] == -1000.0
    assert m3["payback_status"] == "No amortizable (Flujo operativo deficitario)"
    assert m3["payback_cycles"] is None

    # Caso 4: Escenario del brief (3000 UYU / 800 costo / 0 capex / 120.000 opex / 400 u)
    m4 = calculate_financial_metrics(
        price=3000.0,
        direct_cost=800.0,
        demand=400,
        capex=0.0,
        monthly_opex=120000.0
    )
    assert m4["unit_contribution_margin"] == 2200.0
    assert m4["gross_margin_monthly"] == 880000.0
    assert m4["net_operating_cashflow"] == 760000.0
    assert m4["break_even_units"] == 54.5
    assert m4["break_even_coverage_pct"] == 13.6
    assert m4["payback_status"] == "Inmediato (Sin CAPEX previo)"


def test_business_case_endpoint():
    """
    Valida el endpoint POST /api/v1/initiatives/business-case con desglose de CAPEX y OPEX.
    """
    payload = {
        "product_name": "Línea de Muebles Modulares",
        "category": "Living",
        "target_currency": "UYU",
        "proposed_price": 3000.0,
        "proposed_cost": 800.0,
        "expected_demand": 400,
        "initial_investment": 0.0,
        "monthly_opex": 120000.0,
        "capex_breakdown": {
            "maquinaria_equipos": 0.0,
            "adecuacion_local": 0.0,
            "marketing_lanzamiento": 0.0,
            "habilitaciones_marcas": 0.0,
            "otros_capex": 0.0
        },
        "opex_breakdown": {
            "sueldos_personal": 70000.0,
            "alquiler_deposito": 30000.0,
            "publicidad_mensual": 10000.0,
            "seguros_servicios": 6000.0,
            "otros_opex": 4000.0
        }
    }
    res = client.post(
        "/api/v1/initiatives/business-case",
        json=payload,
        headers={"X-User-Role": "controller_admin", "X-User-Id": "controller_admin_user"}
    )
    assert res.status_code == 200
    data = res.json()
    assert float(data["unit_contribution_margin"]) == 2200.0
    assert float(data["gross_margin_monthly"]) == 880000.0
    assert float(data["net_operating_cashflow"]) == 760000.0
    assert float(data["break_even_units"]) == 54.5
    assert float(data["break_even_coverage_pct"]) == 13.6
    assert data["payback_status"] == "Inmediato (Sin CAPEX previo)"




