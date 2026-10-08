from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Optional

def project_budget_scenarios(
    historical_sales: Decimal,
    historical_cogs: Decimal,
    historical_opex: Decimal,
    sales_growth_con: Decimal = Decimal('-0.03'),
    cogs_growth_con: Decimal = Decimal('-0.03'),
    opex_growth_con: Decimal = Decimal('-0.05'),
    sales_growth_base: Decimal = Decimal('0.06'),
    cogs_growth_base: Decimal = Decimal('0.06'),
    opex_growth_base: Decimal = Decimal('0.03'),
    sales_growth_agg: Decimal = Decimal('0.15'),
    cogs_growth_agg: Decimal = Decimal('0.13'),
    opex_growth_agg: Decimal = Decimal('0.10'),
) -> Dict[str, Any]:
    """
    Motor de Proyección de 3 Escenarios Presupuestarios:
    - Conservador (Defensivo): Contracción de volumen (-3%), recorte de OPEX (-5%), liquidación de stock.
    - Base (Moderado / Tendencial): Crecimiento tendencial (+6%), OPEX controlado (+3%), equilibrio DOH.
    - Agresivo (Expansión Comercial): Aceleración comercial (+15%), economía de escala en CMV (+13%), inversión en marketing (+10%).
    """
    def calc_scenario(s_growth: Decimal, c_growth: Decimal, o_growth: Decimal, name: str, focus: str) -> Dict[str, Any]:
        proj_sales = (historical_sales * (Decimal('1') + s_growth)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        proj_cogs = (historical_cogs * (Decimal('1') + c_growth)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        proj_opex = (historical_opex * (Decimal('1') + o_growth)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        gross_margin = proj_sales - proj_cogs
        gross_margin_pct = (gross_margin / proj_sales).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP) if proj_sales != Decimal('0') else Decimal('0.0000')
        
        contribution_margin = gross_margin - proj_opex
        contribution_margin_pct = (contribution_margin / proj_sales).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP) if proj_sales != Decimal('0') else Decimal('0.0000')
        
        delta_sales_pct = s_growth.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
        delta_cm_abs = contribution_margin - (historical_sales - historical_cogs - historical_opex)
        
        return {
            'name': name,
            'focus': focus,
            'sales_growth_pct': delta_sales_pct,
            'cogs_growth_pct': c_growth.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP),
            'opex_growth_pct': o_growth.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP),
            'projected_sales': proj_sales,
            'projected_cogs': proj_cogs,
            'gross_margin': gross_margin,
            'gross_margin_pct': gross_margin_pct,
            'projected_opex': proj_opex,
            'contribution_margin': contribution_margin,
            'contribution_margin_pct': contribution_margin_pct,
            'delta_cm_vs_historical': delta_cm_abs
        }

    hist_gm = historical_sales - historical_cogs
    hist_gm_pct = (hist_gm / historical_sales).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP) if historical_sales != Decimal('0') else Decimal('0.0000')
    hist_cm = hist_gm - historical_opex
    hist_cm_pct = (hist_cm / historical_sales).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP) if historical_sales != Decimal('0') else Decimal('0.0000')

    return {
        'historical': {
            'sales': historical_sales,
            'cogs': historical_cogs,
            'gross_margin': hist_gm,
            'gross_margin_pct': hist_gm_pct,
            'opex': historical_opex,
            'contribution_margin': hist_cm,
            'contribution_margin_pct': hist_cm_pct
        },
        'conservative': calc_scenario(
            sales_growth_con, cogs_growth_con, opex_growth_con,
            name="Conservador (Defensivo)",
            focus="Protección de liquidez, reducción de OPEX y liquidación de sobrestock"
        ),
        'base': calc_scenario(
            sales_growth_base, cogs_growth_base, opex_growth_base,
            name="Base (Moderado / Tendencial)",
            focus="Crecimiento alineado a tendencia, absorción inflacionaria y reposición controlada"
        ),
        'aggressive': calc_scenario(
            sales_growth_agg, cogs_growth_agg, opex_growth_agg,
            name="Agresivo (Expansión Comercial)",
            focus="Aceleración comercial (+15%), escala con proveedores y campañas de marketing"
        )
    }
