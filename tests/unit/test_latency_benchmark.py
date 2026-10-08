import pytest
import time
from decimal import Decimal
from unittest.mock import patch, AsyncMock
from app.services.ai_advisor_service import AIAdvisorService
from app.domain.schemas import (
    VarianceInsightRequest, 
    VarianceLineItem,
    InventoryInsightRequest,
    InventorySkuItem
)

@pytest.mark.anyio
async def test_offline_fallback_latency_variance():
    """Benchmark: analyze_variance en offline/fallback garantizado en <100ms."""
    req = VarianceInsightRequest(
        periodo="2026-Q1",
        lines=[
            VarianceLineItem(
                categoria="Cat1", tipo="VENTAS", 
                monto_presupuestado=Decimal('100'), monto_real=Decimal('50')
            )
        ] * 10
    )

    with patch.object(AIAdvisorService, "_call_local_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = None
        
        t0 = time.perf_counter()
        result = await AIAdvisorService.analyze_variance(req)
        t1 = time.perf_counter()
        
        duration_ms = (t1 - t0) * 1000
        
        assert result.provider == "deterministic_heuristic"
        assert duration_ms < 100.0, f"Latencia {duration_ms} ms excedio 100ms"
        assert result.latency_ms < 100.0
        
        assert len(result.diagnosis) > 0
        assert len(result.cash_service_impact) > 0
        assert len(result.action_plan) == 3

@pytest.mark.anyio
async def test_offline_fallback_latency_inventory():
    """Benchmark: analyze_inventory en offline/fallback garantizado en <100ms."""
    req = InventoryInsightRequest(
        items=[
            InventorySkuItem(
                sku="SKU-TEST", stock_actual=10, rop=Decimal('50'), 
                doh=Decimal('5.0'), lead_time_dias=Decimal('20.0'), is_alert=True
            )
        ] * 10
    )

    with patch.object(AIAdvisorService, "_call_local_llm", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = None
        
        t0 = time.perf_counter()
        result = await AIAdvisorService.analyze_inventory(req)
        t1 = time.perf_counter()
        
        duration_ms = (t1 - t0) * 1000
        
        assert result.provider == "deterministic_heuristic"
        assert duration_ms < 100.0, f"Latencia {duration_ms} ms excedio 100ms"
        assert result.latency_ms < 100.0
        
        assert len(result.diagnosis) > 0
        assert len(result.cash_service_impact) > 0
        assert len(result.action_plan) == 3
