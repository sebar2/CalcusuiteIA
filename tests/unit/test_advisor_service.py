import time
from decimal import Decimal
from unittest.mock import AsyncMock, patch
import pytest

from app.domain.schemas import (
    VarianceLineItem,
    VarianceInsightRequest,
    InventorySkuItem,
    InventoryInsightRequest,
)
from app.services.ai_advisor_service import AIAdvisorService, SYSTEM_PROMPT


def test_system_prompt_requirements():
    """Verifica que el system prompt contenga las directrices requeridas por la gerencia."""
    assert "Controller Financiero y Director de Operaciones Senior" in SYSTEM_PROMPT
    assert "1. Diagnóstico del desvío" in SYSTEM_PROMPT
    assert "2. Impacto en caja y nivel de servicio" in SYSTEM_PROMPT
    assert "3. Plan de acción inmediato en 3 puntos claros para la gerencia" in SYSTEM_PROMPT
    assert "OPEX, CAPEX, DOH, Lead Time, Rotación, Variance" in SYSTEM_PROMPT


def test_variance_heuristic_speed_and_calculations():
    """Verifica que la heurística de variaciones se ejecute en < 10ms y calcule métricas contables exactas."""
    lines = [
        VarianceLineItem(
            id=1,
            categoria="Línea Industrial",
            tipo="VENTAS",
            periodo="2026-Q1",
            monto_presupuestado=Decimal('100000.00'),
            monto_real=Decimal('90000.00'),  # -10% (desfavorable > 5%)
        ),
        VarianceLineItem(
            id=2,
            categoria="Línea Comercial",
            tipo="VENTAS",
            periodo="2026-Q1",
            monto_presupuestado=Decimal('50000.00'),
            monto_real=Decimal('52000.00'),  # +4% (favorable)
        ),
        VarianceLineItem(
            id=3,
            categoria="Logística y Fletes",
            tipo="OPEX",
            periodo="2026-Q1",
            monto_presupuestado=Decimal('20000.00'),
            monto_real=Decimal('24000.00'),  # +20% (sobrecosto desfavorable > 5%)
        ),
        VarianceLineItem(
            id=4,
            categoria="Marketing y Ventas",
            tipo="OPEX",
            periodo="2026-Q1",
            monto_presupuestado=Decimal('10000.00'),
            monto_real=Decimal('9500.00'),  # -5% (ahorro favorable)
        ),
    ]

    t0 = time.perf_counter()
    result = AIAdvisorService.generate_variance_heuristic(lines, periodo="2026-Q1")
    duration_ms = (time.perf_counter() - t0) * 1000

    # 1. Performance check: < 10ms
    assert duration_ms < 10.0
    assert result.latency_ms < 10.0

    # 2. Check metadata
    assert result.provider == "deterministic_heuristic"
    assert result.status == "success"

    # 3. Check diagnosis & content
    assert "Auditoría de Variance (2026-Q1)" in result.diagnosis
    assert len(result.action_plan) == 3
    assert len(result.critical_items) >= 2
    assert "Línea Industrial" in result.critical_items
    assert "Logística y Fletes" in result.critical_items

    # 4. Check metrics summary
    summary = result.metrics_summary
    assert summary["total_ventas_pres"] == 150000.0
    assert summary["total_ventas_real"] == 142000.0
    assert summary["desvio_ventas_abs"] == -8000.0
    assert summary["total_costos_pres"] == 30000.0
    assert summary["total_costos_real"] == 33500.0
    assert summary["desvio_costos_abs"] == 3500.0
    # Net cash impact = -8000 - 3500 = -11500
    assert summary["net_cash_impact"] == -11500.0
    assert summary["unfavorable_count"] == 2


def test_inventory_heuristic_speed_and_calculations():
    """Verifica que la heurística de abastecimiento evalúe quiebres, brecha DOH vs Lead Time y ordene por urgencia."""
    items = [
        InventorySkuItem(
            sku="SKU-OK",
            nombre="Producto Abundante",
            stock_actual=500,
            rop=Decimal('100'),
            doh=Decimal('60.0'),
            lead_time_dias=Decimal('20.0'),  # gap = +40d
            is_alert=False
        ),
        InventorySkuItem(
            sku="SKU-URGENTE-1",
            nombre="Producto Alerta Inminente",
            stock_actual=30,
            rop=Decimal('100'),
            doh=Decimal('5.0'),
            lead_time_dias=Decimal('30.0'),  # gap = -25d (crítico)
            is_alert=True
        ),
        InventorySkuItem(
            sku="SKU-URGENTE-2",
            nombre="Producto Sin Stock",
            stock_actual=0,
            rop=Decimal('50'),
            doh=Decimal('0.0'),
            lead_time_dias=Decimal('15.0'),  # gap = -15d (quiebre total)
            is_alert=True
        ),
        InventorySkuItem(
            sku="SKU-BORDERLINE",
            nombre="Producto Ajustado",
            stock_actual=120,
            rop=Decimal('100'),
            doh=Decimal('15.0'),
            lead_time_dias=Decimal('25.0'),  # gap = -10d pero stock > rop
            is_alert=False
        ),
    ]

    t0 = time.perf_counter()
    result = AIAdvisorService.generate_inventory_heuristic(items)
    duration_ms = (time.perf_counter() - t0) * 1000

    # 1. Performance check: < 10ms
    assert duration_ms < 10.0
    assert result.latency_ms < 10.0

    # 2. Ratio de quiebre (% de SKUs con stock <= ROP)
    # SKU-URGENTE-1 (30 <= 100) y SKU-URGENTE-2 (0 <= 50) -> 2 de 4 = 50%
    summary = result.metrics_summary
    assert summary["total_skus"] == 4
    assert summary["quiebre_skus_count"] == 2
    assert summary["ratio_quiebre_pct"] == 50.0
    # Brecha negativa: SKU-URGENTE-1 (-25), SKU-URGENTE-2 (-15), SKU-BORDERLINE (-10) -> 3
    assert summary["negative_gap_count"] == 3

    # 3. Urgencia de reposición (SKU en alerta con brecha más negativa primero)
    assert result.critical_items[0] == "SKU-URGENTE-1"
    assert result.critical_items[1] == "SKU-URGENTE-2"

    # 4. Check action plan
    assert len(result.action_plan) == 3
    assert "PO Express" in result.action_plan[0]
    assert "Fast-Track" in result.action_plan[1]


def test_parse_llm_sections():
    """Valida la extracción robusta de secciones a partir del texto del LLM."""
    raw_llm = """
1. Diagnóstico del desvío:
Se detecta una contracción del 12% en ingresos por volumen y un sobrecosto en OPEX logístico de $4,500.

2. Impacto en caja y nivel de servicio:
El flujo de caja libre se reduce en $16,500 afectando el capital de trabajo de los próximos 45 días.

3. Plan de acción inmediato:
- Suspender descuentos de lista para clientes de margen negativo.
- Congelar contrataciones y viajes operativos no esenciales.
- Renegociar condiciones de pago a 60 días con proveedores marítimos.
"""
    diag, impact, actions = AIAdvisorService._parse_llm_sections(
        raw_llm,
        default_diag="default d",
        default_impact="default i",
        default_actions=["d1", "d2", "d3"]
    )
    assert "contracción del 12%" in diag
    assert "flujo de caja libre se reduce" in impact
    assert len(actions) == 3
    assert "Suspender descuentos" in actions[0]
    assert "Congelar contrataciones" in actions[1]
    assert "Renegociar condiciones" in actions[2]


@pytest.mark.anyio
async def test_analyze_variance_fallback_on_llm_error():
    """Verifica que si el LLM falla, el servicio devuelva inmediatamente el fallback determinístico."""
    req = VarianceInsightRequest(
        periodo="2026-Q1",
        lines=[
            VarianceLineItem(
                categoria="Siderurgia",
                tipo="VENTAS",
                monto_presupuestado=Decimal('10000'),
                monto_real=Decimal('8000')
            )
        ]
    )

    with patch.object(AIAdvisorService, "_call_local_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = None  # Simula LLM offline/timeout
        result = await AIAdvisorService.analyze_variance(req)

        assert result.provider == "deterministic_heuristic"
        assert result.status == "fallback"
        assert len(result.action_plan) == 3
        assert "Siderurgia" in result.critical_items


@pytest.mark.anyio
async def test_analyze_variance_with_mock_llm_success():
    """Verifica que si el LLM responde exitosamente, se registre como local_llm."""
    req = VarianceInsightRequest(
        periodo="2026-Q1",
        lines=[
            VarianceLineItem(
                categoria="Siderurgia",
                tipo="VENTAS",
                monto_presupuestado=Decimal('10000'),
                monto_real=Decimal('8000')
            )
        ]
    )

    mock_content = """1. Diagnóstico del desvío:
Desbalance por volumen comercial.

2. Impacto en caja y nivel de servicio:
Presión moderada en caja.

3. Plan de acción inmediato:
1. Ajustar precios
2. Reducir costos
3. Proteger liquidez
"""
    with patch.object(AIAdvisorService, "_call_local_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = (mock_content, 120.5)
        result = await AIAdvisorService.analyze_variance(req)

        assert result.provider == "local_llm"
        assert result.status == "success"
        assert result.latency_ms == 120.5
        assert "Desbalance por volumen" in result.diagnosis
        assert len(result.action_plan) == 3


@pytest.mark.anyio
async def test_analyze_inventory_with_mock_llm_success():
    """Verifica que analyze_inventory procese adecuadamente la respuesta del LLM local."""
    req = InventoryInsightRequest(
        items=[
            InventorySkuItem(
                sku="SKU-TEST-1",
                stock_actual=5,
                rop=Decimal('50'),
                doh=Decimal('2.0'),
                lead_time_dias=Decimal('20.0'),
                is_alert=True
            )
        ]
    )

    mock_content = """1. Diagnóstico del desvío:
Riesgo crítico de rotura de inventario en SKU-TEST-1 con DOH de 2 días frente a 20 días de Lead Time.

2. Impacto en caja y nivel de servicio:
Caída inminente del Service Level a 0% para este ítem y necesidad de flete courier urgente.

3. Plan de acción inmediato:
1. Activar orden de emergencia para SKU-TEST-1
2. Coordinar flete aéreo express
3. Recalibrar stock de seguridad
"""
    with patch.object(AIAdvisorService, "_call_local_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = (mock_content, 95.0)
        result = await AIAdvisorService.analyze_inventory(req)

        assert result.provider == "local_llm"
        assert result.status == "success"
        assert result.latency_ms == 95.0
        assert "Riesgo crítico" in result.diagnosis
        assert len(result.action_plan) == 3


def test_empty_heuristic_handling():
    """Verifica el comportamiento cuando no hay líneas o ítems."""
    v_empty = AIAdvisorService.generate_variance_heuristic([])
    assert v_empty.metrics_summary["total_lines"] == 0
    assert "No se registraron" in v_empty.diagnosis

    i_empty = AIAdvisorService.generate_inventory_heuristic([])
    assert i_empty.metrics_summary["total_skus"] == 0
    assert "No se recibieron" in i_empty.diagnosis


@pytest.mark.anyio
async def test_call_local_llm_exception_handling():
    """Verifica que _call_local_llm capture excepciones de conexión sin crashear."""
    # Usar un puerto inexistente o timeout inmediato
    with patch.dict("os.environ", {"LOCAL_LLM_URL": "http://127.0.0.1:59999/v1", "LOCAL_LLM_TIMEOUT": "0.1"}):
        res = await AIAdvisorService._call_local_llm("test prompt")
        assert res is None
