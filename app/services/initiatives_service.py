import re
import math
import logging
from typing import Dict, Any, Optional, List, Tuple
from decimal import Decimal

logger = logging.getLogger(__name__)


def calculate_financial_metrics(
    price: float,
    direct_cost: float,
    demand: int,
    capex: float = 0.0,
    opex: float = 0.0,
    **kwargs
) -> Dict[str, Any]:
    """
    Motor financiero cuantitativo con blindaje estricto contra casos límite:
    - MCU <= 0 (precio menor o igual a costo)
    - Flujo operativo deficitario (FON <= 0)
    - CAPEX = 0 (retorno inmediato sin inversión previa de capital)
    - Cobertura de Break-Even / Margen de seguridad sobre la demanda
    """
    if "monthly_opex" in kwargs and not opex:
        opex = float(kwargs["monthly_opex"])
    if "capex_investment" in kwargs and not capex:
        capex = float(kwargs["capex_investment"])
    if "initial_investment" in kwargs and not capex:
        capex = float(kwargs["initial_investment"])

    price = float(price)
    direct_cost = float(direct_cost)
    demand = int(demand)
    capex = float(capex)
    opex = float(opex)

    # 1. Margen de Contribución Unitario
    mcu = price - direct_cost
    margin_pct = (mcu / price * 100.0) if price > 0 else 0.0

    # 2. Flujos mensuales
    gross_margin_monthly = mcu * demand
    net_operating_cashflow = gross_margin_monthly - opex

    # 3. Punto de Equilibrio Operativo (Break-Even)
    if mcu > 0:
        be_units = round(opex / mcu, 1)
        be_money = round(be_units * price, 2)
        be_coverage_pct = round((be_units / demand * 100.0), 1) if demand > 0 else 0.0
    else:
        be_units = None
        be_money = None
        be_coverage_pct = None

    # 4. Periodo de Recupero (Payback)
    if capex == 0:
        payback_months = 0.0
        payback_status = "Inmediato (Sin CAPEX previo)"
    elif net_operating_cashflow > 0:
        payback_months = round(capex / net_operating_cashflow, 2)
        payback_status = f"{payback_months} meses"
    else:
        payback_months = None
        payback_status = "No amortizable (Flujo operativo deficitario)"

    return {
        "mcu": round(mcu, 2),
        "unit_contribution_margin": round(mcu, 2),
        "margin_pct": round(margin_pct, 1),
        "proposed_margin_pct": round(margin_pct, 1),
        "gross_margin_monthly": round(gross_margin_monthly, 2),
        "net_operating_cashflow": round(net_operating_cashflow, 2),
        "break_even_units": be_units,
        "break_even_money": be_money,
        "break_even_revenue": be_money,
        "break_even_coverage_pct": be_coverage_pct,
        "payback_months": payback_months,
        "payback_cycles": payback_months,
        "payback_status": payback_status
    }


def build_financial_prompt(
    product_name: str,
    category: str,
    currency: str,
    price: float,
    direct_cost: float,
    demand: int,
    capex: float,
    opex: float,
    metrics: Dict[str, Any],
    market_stats: Optional[Dict[str, Any]] = None
) -> Tuple[str, str]:
    """
    Construye el System Prompt y User Prompt enriquecidos para Qwen 2.5:7b
    garantizando cero alucinaciones cambiarias y coherencia con OPEX/CAPEX.
    """
    curr = (currency or "UYU").upper()
    currency_sym = "UYU $" if curr == "UYU" else "USD $"
    currency_name = "Pesos Uruguayos" if curr == "UYU" else "Dólares Estadounidenses"

    mcu = metrics["mcu"]
    margin_pct = metrics["margin_pct"]
    gross_margin_monthly = metrics["gross_margin_monthly"]
    net_operating_cashflow = metrics["net_operating_cashflow"]
    be_units = metrics["break_even_units"]
    be_money = metrics["break_even_money"]
    be_cov = metrics["break_even_coverage_pct"]
    payback_status = metrics["payback_status"]

    def fmt_num(val: Any) -> str:
        if val is None:
            return "N/D"
        try:
            return f"{float(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        except Exception:
            return str(val)

    market_block = ""
    if market_stats:
        min_p = fmt_num(market_stats.get("min_price", 0))
        avg_p = fmt_num(market_stats.get("avg_price", 0))
        max_p = fmt_num(market_stats.get("max_price", 0))
        comp_diff = market_stats.get("price_comp_pct", 0)
        rivals = market_stats.get("rivals", "")
        market_block = f"""
BENCHMARKING DE MERCADO ({currency_sym}):
- Rango Muestral de Competidores: [{currency_sym} {min_p} - {currency_sym} {max_p}]
- Promedio de Competidores: {currency_sym} {avg_p}
- Diferencial de Precios: {comp_diff:+.1f}% vs Rivales
- Vendedores de referencia: {rivals}
"""

    system_prompt = f"""Eres un Chief Commercial Officer y Senior FP&A Controller.

=== ESTRUCTURA FINANCIERA DEL PROYECTO ({currency_sym}) ===
- Precio Propuesto: {currency_sym} {fmt_num(price)}
- Costo Directo Unitario: {currency_sym} {fmt_num(direct_cost)} (MCU: {currency_sym} {fmt_num(mcu)} | Margen: {margin_pct}%)
- Demanda Estimada: {demand:,} unidades/mes
- Inversión Inicial (CAPEX): {currency_sym} {fmt_num(capex)}
- Costos Fijos Mensuales (OPEX): {currency_sym} {fmt_num(opex)}
- Margen Bruto Mensual: {currency_sym} {fmt_num(gross_margin_monthly)}
- Flujo Operativo Neto: {currency_sym} {fmt_num(net_operating_cashflow)} / mes
- Punto de Equilibrio (Break-Even): {be_units if be_units is not None else 'No alcanzable (MCU deficitario)'} unidades/mes ({currency_sym} {fmt_num(be_money) if be_money is not None else 'N/D'}/mes)
- Margen de Seguridad: El Punto de Equilibrio representa el {be_cov if be_cov is not None else 'N/D'}% de la demanda estimada.
- Período de Recupero (Payback): {payback_status}

=== REGLAS OBLIGATORIAS DE REDACCIÓN ===
1. Moneda única: {currency_name} ({currency_sym}). ESTÁ TERMINANTEMENTE PROHIBIDO mencionar "USD" o "dólares" si la moneda activa es UYU.
2. En el análisis de Factibilidad Operativa, evalúa si la demanda ({demand} u) supera con holgura el Punto de Equilibrio ({be_units if be_units is not None else 'N/D'} u) para absorber el OPEX mensual ({currency_sym} {fmt_num(opex)}).
3. Si el Payback es "{payback_status}", destaca la agilidad de lanzamiento sin capital inicial inmovilizado.
4. Genera un dictamen estructurado en 3 secciones nítidas:
   1. Posicionamiento Competitivo y Elasticidad de Precio
   2. Factibilidad Operativa, Punto de Equilibrio y Absorción de OPEX
   3. Recomendaciones Estratégicas y Pricing Sugerido (especificando importes exactos en {currency_sym})
"""

    user_prompt = f"""Evalúa la viabilidad operativa y financiera de la iniciativa '{product_name}' (Categoría: {category or 'General'}).
{market_block}
Entrega el dictamen ejecutivo con rigor numérico, sin introducciones vacías y formateado en Markdown limpio."""

    return system_prompt, user_prompt


def sanitize_financial_markdown(text: str, currency: str = "UYU") -> str:
    """Aplica saneamiento regex para erradicar tokens residuales de USD cuando la moneda es UYU."""
    if not text:
        return ""
    cleaned = text
    if (currency or "UYU").upper() == "UYU":
        cleaned = re.sub(r'\$\s?([0-9\.\,]+)\s?USD', r'UYU $ \1', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'(?:US\$|USD)\s?([0-9\.\,]+)', r'UYU $ \1', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\bUSD\b', 'UYU', cleaned)
        cleaned = re.sub(r'\bdólares\b', 'pesos uruguayos', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\bdólar\b', 'peso uruguayo', cleaned, flags=re.IGNORECASE)

    return cleaned.replace("```markdown", "").replace("```", "").strip()
