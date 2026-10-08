from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any

def evaluate_business_initiative(
    initial_investment: Decimal,
    estimated_unit_cost: Decimal,
    estimated_unit_price: Decimal,
    expected_demand: int,
    fixed_costs: Decimal = Decimal('0')
) -> Dict[str, Any]:
    """
    Evaluador financiero de factibilidad para nuevas iniciativas comerciales / proyectos.
    Calcula:
    - Margen de Contribución Unitario y Marginal Ratio
    - Margen de Contribución Total
    - Break-Even Point en Unidades (Operativo, Recuperación y Total)
    - Break-Even Point en Facturación ($)
    - Payback Period (ciclos / períodos de amortización)
    - ROI (%)
    - Categorización de viabilidad (Factible, Marginal, Inviable)
    """
    demand = Decimal(str(expected_demand))
    
    unit_margin = estimated_unit_price - estimated_unit_cost
    marginal_ratio = (unit_margin / estimated_unit_price).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP) if estimated_unit_price != Decimal('0') else Decimal('0.0000')
    total_contribution_margin = (unit_margin * demand).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    total_revenue = (estimated_unit_price * demand).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    if unit_margin > Decimal('0'):
        be_operativo = (fixed_costs / unit_margin).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        be_recuperacion = (initial_investment / unit_margin).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        be_total_unidades = ((initial_investment + fixed_costs) / unit_margin).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    else:
        be_operativo = Decimal('0')
        be_recuperacion = Decimal('0')
        be_total_unidades = Decimal('0')
        
    be_facturacion = (be_total_unidades * estimated_unit_price).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    net_operating_profit = total_contribution_margin - fixed_costs
    
    if net_operating_profit > Decimal('0'):
        payback_period_cycles = (initial_investment / net_operating_profit).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    else:
        payback_period_cycles = Decimal('0.00')
        
    if initial_investment > Decimal('0'):
        roi_pct = ((net_operating_profit - initial_investment) / initial_investment).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
    else:
        roi_pct = Decimal('0.0000')
        
    if net_operating_profit > initial_investment and unit_margin > Decimal('0'):
        viability = "Factible"
    elif net_operating_profit > Decimal('0') and unit_margin > Decimal('0'):
        viability = "Marginal"
    else:
        viability = "Inviable"
        
    return {
        'initial_investment': initial_investment,
        'estimated_unit_cost': estimated_unit_cost,
        'estimated_unit_price': estimated_unit_price,
        'expected_demand': expected_demand,
        'fixed_costs': fixed_costs,
        'total_revenue': total_revenue,
        'unit_contribution_margin': unit_margin,
        'marginal_ratio': marginal_ratio,
        'total_contribution_margin': total_contribution_margin,
        'net_operating_profit': net_operating_profit,
        'break_even_operational_units': int(be_operativo),
        'break_even_investment_units': int(be_recuperacion),
        'break_even_total_units': int(be_total_unidades),
        'break_even_revenue': be_facturacion,
        'payback_period_cycles': payback_period_cycles,
        'roi_pct': roi_pct,
        'viability': viability
    }
