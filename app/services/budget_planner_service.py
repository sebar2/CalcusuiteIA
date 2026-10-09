import time
import logging
from decimal import Decimal
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import SYSTEM_PROMPT_BUDGET_PLANNER, get_ollama_config
from app.engine.budget_scenarios import project_budget_scenarios
from app.domain.schemas import (
    BudgetScenarioRequest,
    BudgetScenarioResponse,
    BudgetScenarioItem,
)
from app.models.entities import Budget, Sale, PresupuestoMeta

logger = logging.getLogger(__name__)


class BudgetPlannerService:
    """
    Servicio de Planificación Presupuestaria Inteligente (FP&A Engine).
    Proyecta 3 escenarios (Conservador, Base, Agresivo) basados en datos reales históricos
    y genera análisis cualitativo con Ollama qwen2.5:7b y fallback determinístico contable.
    """

    @staticmethod
    def _extract_json_payload(raw_text: str) -> dict:
        """
        Extractor seguro con regex para procesar la respuesta de cualquier modelo de Ollama
        sin romperse por bloques markdown (```json ... ```).
        """
        import re, json
        cleaned = re.sub(r'```(?:json)?', '', raw_text).strip().rstrip('`').strip()
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        return json.loads(match.group(0)) if match else json.loads(cleaned)

    @classmethod
    def _extract_historical_from_db(cls, db: Session, periodo: Optional[str] = None) -> tuple[Decimal, Decimal, Decimal]:
        # 1. Consultar ventas en transacciones_ventas para el periodo
        sales_q = db.query(
            func.sum(Sale.cantidad * Sale.precio_unitario_real).label("sales"),
            func.sum(Sale.cantidad * Sale.costo_unitario_real).label("costs")
        )
        if periodo:
            sales_q = sales_q.filter(Sale.periodo == periodo)
        res = sales_q.first()

        # Si la suma es mayor o igual a $10,000 USD
        if res and res.sales and res.sales >= Decimal('10000.00'):
            total_sales = Decimal(str(res.sales)).quantize(Decimal('0.01'))
            total_costs = Decimal(str(res.costs)).quantize(Decimal('0.01')) if res.costs else (total_sales * Decimal('0.62')).quantize(Decimal('0.01'))
            total_opex = Decimal('32000.00')
            return total_sales, total_costs, total_opex

        # 2. Si no hay para el período exacto o es < $10,000 USD, buscar histórico global de ventas
        global_res = db.query(
            func.sum(Sale.cantidad * Sale.precio_unitario_real).label("sales"),
            func.sum(Sale.cantidad * Sale.costo_unitario_real).label("costs")
        ).first()
        if global_res and global_res.sales and global_res.sales >= Decimal('10000.00'):
            total_sales = Decimal(str(global_res.sales)).quantize(Decimal('0.01'))
            total_costs = Decimal(str(global_res.costs)).quantize(Decimal('0.01')) if global_res.costs else (total_sales * Decimal('0.62')).quantize(Decimal('0.01'))
            total_opex = Decimal('32000.00')
            return total_sales, total_costs, total_opex

        # 3. Si la suma es 0 o menor a $10,000 USD, adoptar el baseline financiero del catálogo:
        baseline_revenue = Decimal('185000.00')  # USD mensuales
        baseline_cogs = Decimal('114700.00')     # 62% COGS
        baseline_opex = Decimal('32000.00')      # OPEX fijo
        return baseline_revenue, baseline_cogs, baseline_opex

    @classmethod
    def _generate_fallback_qualitative_analysis(cls, proj: Dict[str, Any]) -> str:
        con = proj['conservative']
        base = proj['base']
        agg = proj['aggressive']
        hist = proj['historical']

        return f"""### Análisis Estratégico de Escenarios Presupuestarios (FP&A Controller)

#### 1. Escenario Conservador (Defensivo / Protección de Caja)
- **Supuestos Clave:** Contracción controlada de ventas ({con['sales_growth_pct']*100:+.1f}%), reducción de OPEX ({con['opex_growth_pct']*100:+.1f}%) mediante recorte de gastos discrecionales, liquidación de sobrestock y congelamiento de órdenes para ítems con DOH > 60 días.
- **Riesgos Operativos:** Pérdida marginal de market share frente a competidores agresivos y posible desmotivación en la fuerza de ventas.
- **Plan de Contingencia:** Monitorear el Cash Flow Runway semanal. Si las ventas caen más de un 5%, activar renegociación de plazos de pago con proveedores estratégicos (DPO +15 días).

#### 2. Escenario Base (Moderado / Tendencial)
- **Supuestos Clave:** Crecimiento alineado a la tendencia histórica ({base['sales_growth_pct']*100:+.1f}%) absorbiendo inflación de costos ({base['cogs_growth_pct']*100:+.1f}%), preservación estricta del margen de contribución ({base['contribution_margin_pct']*100:.2f}%) y reposiciones en punto de reorden (ROP).
- **Riesgos Operativos:** Fluctuaciones inesperadas en fletes y volatilidad en el tipo de cambio que presionen el CMV.
- **Plan de Contingencia:** Mantener revisiones quincenales de listas de precios con cláusulas de indexación en SKUs importados de alta rotación.

#### 3. Escenario Agresivo (Expansión Comercial & Escala)
- **Supuestos Clave:** Aceleración comercial ({agg['sales_growth_pct']*100:+.1f}%), economía de escala en compras con proveedores clave (-200 bps en costo unitario relativo), expansión de OPEX en marketing digital (+10.0%) e inversión priorizada de capital de trabajo en SKUs Clase A.
- **Riesgos Operativos:** Riesgo de sobre-endeudamiento o tensión de liquidez si el sell-out no responde con la velocidad proyectada (quiebre de caja operativo).
- **Plan de Contingencia:** Establecer compuertas de gasto (milestones): habilitar tranches adicionales de inversión en pauta publicitaria únicamente tras confirmar un ratio de conversión y sell-through > 75% en las primeras 4 semanas.
"""

    @classmethod
    async def generate_scenarios(
        cls,
        req: BudgetScenarioRequest,
        db: Optional[Session] = None
    ) -> BudgetScenarioResponse:
        start_time = time.perf_counter()

        # Determinar base histórica
        if req.historical_sales and req.historical_cogs and req.historical_sales >= Decimal('10000.00'):
            hist_sales = req.historical_sales
            hist_cogs = req.historical_cogs
            hist_opex = req.historical_opex or Decimal('32000.00')
        elif db is not None:
            hist_sales, hist_cogs, hist_opex = cls._extract_historical_from_db(db, req.periodo)
        else:
            hist_sales = Decimal('185000.00')
            hist_cogs = Decimal('114700.00')
            hist_opex = Decimal('32000.00')

        # Ejecutar proyecciones matemáticas puras
        raw_proj = project_budget_scenarios(
            historical_sales=hist_sales,
            historical_cogs=hist_cogs,
            historical_opex=hist_opex
        )

        conservative_item = BudgetScenarioItem(**raw_proj['conservative'])
        base_item = BudgetScenarioItem(**raw_proj['base'])
        aggressive_item = BudgetScenarioItem(**raw_proj['aggressive'])

        # Intentar inferencia cualitativa con Ollama local (qwen2.5:7b)
        from app.services.ai_advisor_service import AIAdvisorService
        
        user_prompt = f"""EVALUACIÓN DE 3 ESCENARIOS PRESUPUESTARIOS PARA EL SIGUIENTE CICLO:
Base Histórica:
- Ventas: ${hist_sales:,.2f} | CMV: ${hist_cogs:,.2f} | OPEX: ${hist_opex:,.2f} | Margen Contribución: ${hist_sales - hist_cogs - hist_opex:,.2f}

1. Escenario Conservador (Defensivo):
- Ventas Proyectadas: ${conservative_item.projected_sales:,.2f} ({conservative_item.sales_growth_pct*100:+.1f}%)
- CMV Proyectado: ${conservative_item.projected_cogs:,.2f}
- Margen Bruto: ${conservative_item.gross_margin:,.2f} ({conservative_item.gross_margin_pct*100:.2f}%)
- OPEX Estimado: ${conservative_item.projected_opex:,.2f} ({conservative_item.opex_growth_pct*100:+.1f}%)
- Margen Contribución: ${conservative_item.contribution_margin:,.2f} ({conservative_item.contribution_margin_pct*100:.2f}%)

2. Escenario Base (Moderado / Tendencial):
- Ventas Proyectadas: ${base_item.projected_sales:,.2f} ({base_item.sales_growth_pct*100:+.1f}%)
- CMV Proyectado: ${base_item.projected_cogs:,.2f}
- Margen Bruto: ${base_item.gross_margin:,.2f} ({base_item.gross_margin_pct*100:.2f}%)
- OPEX Estimado: ${base_item.projected_opex:,.2f} ({base_item.opex_growth_pct*100:+.1f}%)
- Margen Contribución: ${base_item.contribution_margin:,.2f} ({base_item.contribution_margin_pct*100:.2f}%)

3. Escenario Agresivo (Expansión Comercial):
- Ventas Proyectadas: ${aggressive_item.projected_sales:,.2f} ({aggressive_item.sales_growth_pct*100:+.1f}%)
- CMV Proyectado: ${aggressive_item.projected_cogs:,.2f}
- Margen Bruto: ${aggressive_item.gross_margin:,.2f} ({aggressive_item.gross_margin_pct*100:.2f}%)
- OPEX Estimado: ${aggressive_item.projected_opex:,.2f} ({aggressive_item.opex_growth_pct*100:+.1f}%)
- Margen Contribución: ${aggressive_item.contribution_margin:,.2f} ({aggressive_item.contribution_margin_pct*100:.2f}%)

Redacta un análisis cualitativo ejecutivo con rigor financiero:
Para CADA UNO de los 3 escenarios desarrolla obligatoriamente:
- Supuestos clave (volumen, precios, contención de gasto, inventario).
- Riesgos operativos y de mercado.
- Plan de contingencia accionable para la gerencia.
"""
        engine_mode = getattr(req, "engine_mode", "auto") or "auto"
        llm_res = await AIAdvisorService._call_local_llm(user_prompt, system_prompt=SYSTEM_PROMPT_BUDGET_PLANNER, engine_mode=engine_mode)
        
        provider = "deterministic_heuristic"
        status = "fallback"
        _, default_model, _ = get_ollama_config()
        model = default_model

        if llm_res:
            content, lat_ms = llm_res
            provider = "local_llm"
            status = "success"
            raw_markdown = content
            total_latency = lat_ms
        else:
            raw_markdown = cls._generate_fallback_qualitative_analysis(raw_proj)
            total_latency = (time.perf_counter() - start_time) * 1000

        return BudgetScenarioResponse(
            provider=provider,
            model=model,
            status=status,
            latency_ms=round(total_latency, 2),
            historical={
                'sales': float(hist_sales),
                'cogs': float(hist_cogs),
                'opex': float(hist_opex),
                'gross_margin': float(hist_sales - hist_cogs),
                'contribution_margin': float(hist_sales - hist_cogs - hist_opex)
            },
            conservative=conservative_item,
            base=base_item,
            aggressive=aggressive_item,
            ai_analysis={
                'summary': f"Proyección de 3 escenarios completada bajo metodología {status}.",
                'conservative_focus': conservative_item.focus,
                'base_focus': base_item.focus,
                'aggressive_focus': aggressive_item.focus
            },
            raw_markdown=raw_markdown
        )
