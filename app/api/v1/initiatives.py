import time
import asyncio
import logging
import traceback
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, status, Response
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.domain.schemas import (
    CompetitorSearchRequest,
    CompetitorSearchResponse,
    CompetitorItemResponse,
    CompetitorSelectionEvaluationRequest,
    CompetitorSelectionEvaluationResponse,
    InitiativeBenchmarkRequest,
    InitiativeBenchmarkResponse,
    BusinessCaseRequest,
    CapexBreakdown,
    OpexBreakdown,
    MluCategoryInfo,
    ArbitrageScanRequest,
    ArbitrageScanResponse,
)
from app.services.ai_advisor_service import AIAdvisorService
from app.services.initiatives_service import calculate_financial_metrics
from app.services.exchange_rate_service import ExchangeRateService
from app.services.arbitrage_service import ArbitrageService
from app.core.security import get_current_user, UserContext, record_audit_log

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/initiatives", tags=["Nuevos Proyectos & Benchmarking"])


@router.post(
    "/search-competitors",
    response_model=CompetitorSearchResponse,
    summary="Fase 1: Búsqueda rápida y resiliente de competidores (Mercado Libre + Google, sin 500)"
)
async def search_competitors_endpoint(
    payload: CompetitorSearchRequest,
    user: UserContext = Depends(get_current_user)
):
    """
    Rastreo resiliente de competidores en tiempo real:
    - Normaliza campos defensivamente para evitar HTTP 422.
    - Soporta plataformas 'mercadolibre', 'google', 'hybrid'.
    - Jamás devuelve HTTP 500: si no hay resultados o hay micro-bloqueo,
      retorna HTTP 200 con lista vacía y mensaje informativo.
    """
    try:
        # Normalización de plataforma
        plat = (payload.platform or "").lower()
        if "mercado" in plat or "meli" in plat:
            engine = "mercadolibre"
        elif "ambos" in plat or "hibrido" in plat or "hybrid" in plat:
            engine = "hybrid"
        elif "ddgs" in plat or "gratuita" in plat or "duck" in plat:
            engine = "web_ddgs"
        else:
            engine = "google_serper"
        payload.platform = engine

        # Término de búsqueda unificado
        search_text = (
            payload.query or payload.search_query or payload.product_name or ""
        ).strip()
        payload.query = search_text
        payload.search_query = search_text
        if not payload.product_name:
            payload.product_name = search_text or "Producto"

        # Precio unificado
        target_price = (
            payload.proposed_price
            or payload.target_price
            or payload.price
            or 0.0
        )
        payload.proposed_price = target_price
        payload.target_price = target_price
        payload.price = target_price

        # Ejecutar búsqueda según motor normalizado con límite de seguridad global de 540 segundos (9 minutos)
        try:
            competitors = await asyncio.wait_for(
                AIAdvisorService.search_competitors(payload),
                timeout=540.0
            )
        except asyncio.TimeoutError:
            logger.warning("Búsqueda de competidores alcanzó timeout global de 540 segundos (9 minutos).")
            return CompetitorSearchResponse(
                status="success",
                competitors=[],
                total_empresas=0,
                message="La búsqueda en profundidad completó la ventana de seguridad (9 minutos). Se sugiere acotar el término o seleccionar Mercado Libre."
            )

        rate_info = await ExchangeRateService.fetch_brou_rate()

        if not competitors:
            return CompetitorSearchResponse(
                status="success",
                competitors=[],
                total_empresas=0,
                message="No se encontraron tiendas locales para este término exacto. Prueba con un término más general o selecciona Mercado Libre.",
                target_currency=payload.target_currency or "USD",
                exchange_rate_used=rate_info.rate_used,
                exchange_rate_source=rate_info.source
            )

        return CompetitorSearchResponse(
            status="success",
            competitors=competitors,
            total_empresas=len(competitors),
            message=None,
            target_currency=payload.target_currency or "USD",
            exchange_rate_used=rate_info.rate_used,
            exchange_rate_source=rate_info.source
        )

    except Exception as e:
        logger.error("Error crítico en search-competitors: %s", traceback.format_exc())
        # Retornar 200 con detalle amigable en lugar de colapsar con 500
        return CompetitorSearchResponse(
            status="error",
            competitors=[],
            total_empresas=0,
            message=f"Aviso de búsqueda: {str(e)}"
        )


@router.post(
    "/evaluate-selection",
    response_model=CompetitorSelectionEvaluationResponse,
    summary="Fase 3: Análisis cuantitativo e inferencia IA sobre muestra seleccionada"
)
async def evaluate_selection_endpoint(
    payload: CompetitorSelectionEvaluationRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="EVALUATE_COMPETITOR_SELECTION",
        resource=f"initiatives/selection/{payload.product_name}",
        details={
            "product_name": payload.product_name,
            "proposed_price": float(payload.proposed_price),
            "selected_count": len(payload.selected_competitors or []),
            "engine_mode": payload.engine_mode
        }
    )
    return await AIAdvisorService.evaluate_selection(payload, db)


@router.post(
    "/business-case",
    response_model=CompetitorSelectionEvaluationResponse,
    summary="Motor financiero cuantitativo y evaluación de business case con OPEX/CAPEX"
)
async def business_case_endpoint(
    payload: BusinessCaseRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    eval_req = CompetitorSelectionEvaluationRequest(
        product_name=payload.initiative_id or "Nueva Iniciativa",
        target_currency=payload.currency,
        currency=payload.currency,
        proposed_price=payload.proposed_price,
        proposed_cost=payload.direct_cost,
        direct_cost=payload.direct_cost,
        expected_demand=payload.monthly_demand,
        monthly_demand=payload.monthly_demand,
        initial_investment=payload.capex_investment,
        capex_investment=payload.capex_investment,
        monthly_opex=payload.monthly_opex,
        capex_details=payload.capex_details,
        opex_details=payload.opex_details,
        selected_competitors=[],
        engine_mode="auto"
    )
    return await AIAdvisorService.evaluate_selection(eval_req, db)


@router.post(
    "/benchmark",
    response_model=InitiativeBenchmarkResponse,
    summary="Benchmarking cruzado: DB interna + Web + Inferencia con qwen2.5:7b"
)
async def benchmark_initiative(
    payload: InitiativeBenchmarkRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="RUN_INITIATIVE_BENCHMARK",
        resource=f"initiatives/benchmark/{payload.product_name}",
        details={
            "product_name": payload.product_name,
            "proposed_price": float(payload.proposed_price),
            "engine_mode": payload.engine_mode
        }
    )
    return await AIAdvisorService.benchmark_initiative(payload, db)


# =========================================================================
# CAZADOR DE OPORTUNIDADES: MERCADO LIBRE URUGUAY VS ALIBABA B2B (ARBITRAJE)
# =========================================================================

@router.get(
    "/mlu/categories",
    response_model=List[MluCategoryInfo],
    summary="Listado oficial de las 28 categorías retail de Mercado Libre Uruguay"
)
async def get_mlu_categories_endpoint(
    user: UserContext = Depends(get_current_user)
):
    """Retorna las 28 categorías transaccionales oficiales de MLU excluyendo clasificados."""
    cats = ArbitrageService.get_categories()
    return [MluCategoryInfo(**c) for c in cats]


@router.get(
    "/arbitrage/models",
    response_model=List[str],
    summary="Listado de modelos LLM locales disponibles en Ollama"
)
async def get_arbitrage_models_endpoint(
    user: UserContext = Depends(get_current_user)
):
    """Consulta los modelos instalados en la instancia local de Ollama para traducción B2B."""
    return await ArbitrageService.get_ollama_models()


@router.post(
    "/arbitrage/scan",
    response_model=ArbitrageScanResponse,
    summary="Escaneo masivo de arbitraje: Top Sellers MLU vs Costos FOB Alibaba"
)
async def scan_arbitrage_endpoint(
    payload: ArbitrageScanRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    """
    Rastrea hasta 100 artículos líderes en Mercado Libre Uruguay,
    traduce términos con IA local a especificaciones industriales B2B en inglés,
    costea contrapartes de fábricas auditadas en Alibaba y calcula el margen neto y ROI.
    """
    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="RUN_ARBITRAGE_SCAN",
        resource=f"initiatives/arbitrage/{payload.category_id}",
        details={
            "category_id": payload.category_id,
            "article_name": payload.article_name,
            "currency": payload.currency,
            "min_price": payload.min_price,
            "max_price": payload.max_price,
            "ollama_model": payload.ollama_model,
            "limit": payload.limit
        }
    )
    result = await ArbitrageService.process_arbitrage_scan(
        category_id=payload.category_id,
        article_name=payload.article_name,
        min_price=payload.min_price,
        max_price=payload.max_price,
        currency=payload.currency,
        ollama_model=payload.ollama_model,
        limit=payload.limit or 100
    )
    return ArbitrageScanResponse(**result)


@router.post(
    "/arbitrage/export-excel",
    summary="Descarga planilla ejecutiva Excel (.xlsx) con 100 artículos y fórmulas financieras vivas"
)
async def export_arbitrage_excel_endpoint(
    payload: ArbitrageScanRequest,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user)
):
    """
    Genera y descarga un reporte .xlsx estructurado con fórmulas vivas de rentabilidad,
    Landed Cost a Montevideo y formato ejecutivo para evaluación de compras internacionales.
    """
    record_audit_log(
        db=db,
        user_id=user.user_id,
        role=user.role,
        action="EXPORT_ARBITRAGE_EXCEL",
        resource=f"initiatives/arbitrage/excel/{payload.category_id}",
        details={"category_id": payload.category_id, "limit": payload.limit}
    )
    scan_data = await ArbitrageService.process_arbitrage_scan(
        category_id=payload.category_id,
        article_name=payload.article_name,
        min_price=payload.min_price,
        max_price=payload.max_price,
        currency=payload.currency,
        ollama_model=payload.ollama_model,
        limit=payload.limit or 100
    )
    excel_bytes = ArbitrageService.generate_excel_report(scan_data)
    filename = f"Arbitraje_MLU_Alibaba_{payload.category_id or 'ALL'}_{int(time.time())}.xlsx"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
