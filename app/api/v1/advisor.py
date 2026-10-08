from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.domain.schemas import (
    VarianceInsightRequest,
    InventoryInsightRequest,
    AdvisorInsightResponse,
    BudgetScenarioRequest,
    BudgetScenarioResponse,
    IntegralAuditRequest,
    IntegralAuditResponse,
    CommercialOptimizerRequest,
    CommercialOptimizerResponse,
    SupplyActionPlanRequest,
    SupplyActionPlanResponse,
    InitiativeEvaluationRequest,
    InitiativeEvaluationResponse,
    CrossReportRequest,
    CrossReportResponse,
)
from app.services.ai_advisor_service import AIAdvisorService
from app.services.budget_planner_service import BudgetPlannerService

router = APIRouter(prefix="/api/v1/advisor", tags=["Copiloto Asesor IA & Performance"])


# ------------------------------------------------------------------
# Generador de 3 Escenarios Presupuestarios (FP&A Planner)
# ------------------------------------------------------------------
@router.post(
    "/budget-scenarios",
    response_model=BudgetScenarioResponse,
    summary="Generador de 3 Escenarios Presupuestarios (Conservador, Base, Agresivo)",
    response_description="Tabla comparativa de escenarios y análisis cualitativo con Ollama qwen2.5:7b"
)
async def get_budget_scenarios(
    req: BudgetScenarioRequest,
    db: Session = Depends(get_db)
):
    """
    **Motor de Presupuestación Inteligente (3 Escenarios)**:
    - Escenario Conservador (Defensivo): Prioriza caja, volumen -3%, OPEX -5%, liquidación de sobrestock.
    - Escenario Base (Moderado / Tendencial): Crecimiento +6%, absorción inflacionaria, preservación de margen.
    - Escenario Agresivo (Expansión Comercial): Aceleración +15%, compras por volumen, marketing +10%.
    Integra inferencia con `qwen2.5:7b` (supuestos clave, riesgos, plan de contingencia) y fallback determinístico contable.
    """
    return await BudgetPlannerService.generate_scenarios(req, db)


# ------------------------------------------------------------------
# Copiloto 1: Auditor Integral de Performance & Desvíos
# ------------------------------------------------------------------
@router.post(
    "/integral-audit",
    response_model=IntegralAuditResponse,
    summary="Auditor Integral de Performance & Desvíos (Variance & Trend Copilot)",
    response_description="Desglose Efecto Precio, Efecto Volumen, Efecto Mix y Plan de Mitigación en 3 Pasos"
)
async def post_integral_audit(
    req: IntegralAuditRequest,
    db: Session = Depends(get_db)
):
    """
    **Auditor Integral de Performance & Desvíos**:
    Analiza el consolidado del mes, desglosa variaciones entre Efecto Precio, Efecto Volumen y Efecto Mix,
    identifica anomalías críticas y devuelve un 'Plan de Mitigación en 3 Pasos' para la gerencia.
    """
    return await AIAdvisorService.audit_integral_performance(req, db)


# ------------------------------------------------------------------
# Copiloto 2: Optimizador Comercial, Canales y Pricing
# ------------------------------------------------------------------
@router.post(
    "/commercial-optimizer",
    response_model=CommercialOptimizerResponse,
    summary="Optimizador Comercial, Canales y Pricing (Commercial & Pricing Advisor)",
    response_description="Dispersión de márgenes por canal, sugerencias de precios y simulación de promociones"
)
async def post_commercial_optimizer(
    req: CommercialOptimizerRequest,
    db: Session = Depends(get_db)
):
    """
    **Optimizador Comercial, Canales y Pricing**:
    Analiza la dispersión de márgenes por canal (Mercado Libre, Mayorista, Retail) y categoría.
    Sugiere aumentos o ajustes de precios donde el markup esté desfasado y simula promociones protegiendo el margen de contribución.
    """
    return await AIAdvisorService.optimize_commercial_pricing(req, db)


# ------------------------------------------------------------------
# Copiloto 3: Monitor Inteligente de Abastecimiento & Capital de Trabajo
# ------------------------------------------------------------------
@router.post(
    "/supply-action-plan",
    response_model=SupplyActionPlanResponse,
    summary="Monitor Inteligente de Abastecimiento & Capital de Trabajo (Supply Chain Copilot)",
    response_description="Orden de compra sugerida priorizada por impacto económico y cálculo de capital de trabajo"
)
async def post_supply_action_plan(
    req: SupplyActionPlanRequest,
    db: Session = Depends(get_db)
):
    """
    **Monitor Inteligente de Abastecimiento & Capital de Trabajo**:
    Toma los SKUs en quiebre/reorden (Stock <= ROP) y con DOH desalineado frente al Lead Time.
    Genera una Orden de Compra Sugerida (PO) priorizada por impacto económico, calculando el capital de trabajo requerido.
    """
    return await AIAdvisorService.generate_supply_action_plan(req, db)


# ------------------------------------------------------------------
# Copiloto 4: Evaluador de Factibilidad de Nuevas Iniciativas
# ------------------------------------------------------------------
@router.post(
    "/evaluate-initiative",
    response_model=InitiativeEvaluationResponse,
    summary="Evaluador de Factibilidad de Nuevas Iniciativas (Business Case Evaluator)",
    response_description="Break-Even Point en unidades y facturación, margen de contribución, payback y riesgos"
)
async def post_evaluate_initiative(
    req: InitiativeEvaluationRequest
):
    """
    **Evaluador de Factibilidad de Nuevas Iniciativas**:
    Calcula Break-Even Point (unidades y facturación), margen de contribución resultante, payback y ROI,
    evaluando la viabilidad económica y riesgos competitivos con IA local `qwen2.5:7b`.
    """
    return await AIAdvisorService.evaluate_initiative(req)


# ------------------------------------------------------------------
# Copiloto 5: Generador de Minutas y Reportes Cross-Área
# ------------------------------------------------------------------
@router.post(
    "/generate-cross-report",
    response_model=CrossReportResponse,
    summary="Generador de Minutas y Reportes Cross-Área",
    response_description="Minuta ejecutiva adaptada según selector de audiencia (Directorio, Comercial, Logística)"
)
async def post_generate_cross_report(
    req: CrossReportRequest,
    db: Session = Depends(get_db)
):
    """
    **Generador de Minutas y Reportes Cross-Área**:
    Genera minutas con selector de audiencia:
    - Directorio / Gerencia General: Resumen de alto nivel, EBITDA, flujo de caja, riesgos macro.
    - Gerencia Comercial: Metas de venta, mix de productos, alertas de márgenes.
    - Jefatura de Logística / Operaciones: DOH, rotación, lead time de proveedores, planes de stock.
    """
    return await AIAdvisorService.generate_cross_report(req, db)


# ------------------------------------------------------------------
# Endpoints Históricos de Retrocompatibilidad
# ------------------------------------------------------------------
@router.post(
    "/variance-insights",
    response_model=AdvisorInsightResponse,
    summary="Auditoría ejecutiva y diagnóstico de variaciones presupuestarias",
    response_description="Diagnóstico ejecutivo, impacto en caja y plan de acción de 3 puntos"
)
async def get_variance_insights(
    req: VarianceInsightRequest,
    db: Session = Depends(get_db)
):
    return await AIAdvisorService.analyze_variance(req, db)


@router.post(
    "/inventory-insights",
    response_model=AdvisorInsightResponse,
    summary="Auditoría ejecutiva y plan de contingencia de abastecimiento",
    response_description="Diagnóstico de abastecimiento, impacto en nivel de servicio y plan de contingencia de 3 puntos"
)
async def get_inventory_insights(
    req: InventoryInsightRequest,
    db: Session = Depends(get_db)
):
    return await AIAdvisorService.analyze_inventory(req, db)
