from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.core.config import settings
from app.domain.models import UserPreference
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
    OllamaModelItem,
    OllamaModelsResponse,
    ActiveModelRequest,
    ActiveModelResponse,
)
from app.services.ai_advisor_service import AIAdvisorService
from app.services.budget_planner_service import BudgetPlannerService

router = APIRouter(prefix="/api/v1/advisor", tags=["Copiloto Asesor IA & Performance"])

OFFICIAL_11_OLLAMA_LOCAL_MODELS = [
    {"name": "qwen2.5:3b", "size": 1900000000, "size_formatted": "1.9 GB", "digest": "sha256:7b243a41"},
    {"name": "qwen2.5:7b", "size": 4700000000, "size_formatted": "4.7 GB", "digest": "sha256:843513b8"},
    {"name": "gemma4:26b", "size": 16500000000, "size_formatted": "16.5 GB", "digest": "sha256:26c04f11"},
    {"name": "gemma4:31b", "size": 19800000000, "size_formatted": "19.8 GB", "digest": "sha256:31b08a99"},
    {"name": "gemma4:latest", "size": 5400000000, "size_formatted": "5.4 GB", "digest": "sha256:44a0bb22"},
    {"name": "muse-glimmer:latest", "size": 4900000000, "size_formatted": "4.9 GB", "digest": "sha256:92f0dd33"},
    {"name": "devstral:latest", "size": 14200000000, "size_formatted": "14.2 GB", "digest": "sha256:de7718aa"},
    {"name": "olmo-3.1:32b-instruct", "size": 20400000000, "size_formatted": "20.4 GB", "digest": "sha256:32e18b77"},
    {"name": "ornith:35b", "size": 22100000000, "size_formatted": "22.1 GB", "digest": "sha256:35bb9910"},
    {"name": "nemotron-3.5-lightning:latest", "size": 11800000000, "size_formatted": "11.8 GB", "digest": "sha256:35aa77ff"},
    {"name": "qwen3.8:27b", "size": 18000000000, "size_formatted": "18.0 GB", "digest": "sha256:27bb88ee"}
]


@router.get(
    "/models",
    response_model=OllamaModelsResponse,
    summary="Listado dinámico de los 11 modelos Ollama locales disponibles con fallback"
)
def list_ollama_models(db: Session = Depends(get_db)):
    """
    Consulta los modelos registrados en Ollama local (localhost:11434).
    Si Ollama está apagado o da timeout (3.0s), retorna la lista de fallback
    con los 11 modelos locales registrados por el usuario.
    """
    pref = db.query(UserPreference).filter(UserPreference.user_id == "default_user").first()
    saved_model = None
    if pref and pref.saved_filters and isinstance(pref.saved_filters, dict):
        saved_model = pref.saved_filters.get("ollama_active_model")

    current_active = saved_model or AIAdvisorService.get_active_model()
    models_list = []
    ollama_running = False

    try:
        ollama_url = getattr(settings, "ollama_base_url", "http://localhost:11434").rstrip("/")
        tags_url = f"{ollama_url}/api/tags"
        resp = httpx.get(tags_url, timeout=3.0)
        if resp.status_code == 200:
            data = resp.json()
            raw_models = data.get("models", [])
            if raw_models:
                ollama_running = True
                for rm in raw_models:
                    m_name = rm.get("name", "")
                    m_size = rm.get("size", 0)
                    m_sz_gb = f"{round(m_size / (1024**3), 1)} GB" if m_size else "N/A"
                    models_list.append(OllamaModelItem(
                        name=m_name,
                        size=m_size,
                        size_formatted=m_sz_gb,
                        modified_at=rm.get("modified_at"),
                        digest=rm.get("digest"),
                        is_active=(m_name == current_active)
                    ))
    except Exception:
        ollama_running = False

    if not models_list:
        for fm in OFFICIAL_11_OLLAMA_LOCAL_MODELS:
            models_list.append(OllamaModelItem(
                name=fm["name"],
                size=fm["size"],
                size_formatted=fm["size_formatted"],
                modified_at=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                digest=fm["digest"],
                is_active=(fm["name"] == current_active)
            ))

    return OllamaModelsResponse(
        models=models_list,
        active_model=current_active,
        total=len(models_list),
        ollama_running=ollama_running
    )


@router.post(
    "/active-model",
    response_model=ActiveModelResponse,
    summary="Conmutador en caliente del modelo Ollama activo para análisis predictivo"
)
def set_active_ollama_model(
    payload: ActiveModelRequest,
    db: Session = Depends(get_db)
):
    selected = payload.model.strip()
    AIAdvisorService.set_active_model(selected)
    settings.ollama_model = selected
    settings.local_llm_model = selected

    pref = db.query(UserPreference).filter(UserPreference.user_id == "default_user").first()
    if not pref:
        pref = UserPreference(
            user_id="default_user",
            saved_filters={"ollama_active_model": selected}
        )
        db.add(pref)
    else:
        filters = dict(pref.saved_filters or {})
        filters["ollama_active_model"] = selected
        pref.saved_filters = filters
        pref.updated_at = datetime.now(timezone.utc)
    db.commit()

    return ActiveModelResponse(
        status="success",
        active_model=selected,
        message=f"Modelo activo de IA conmutado exitosamente a '{selected}'."
    )


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
