from decimal import Decimal
import pytest
from app.engine.initiatives import evaluate_business_initiative

def test_evaluate_business_initiative_math():
    """
    Valida el cálculo de Break-Even, Payback, ROI y viabilidad económica.
    """
    res = evaluate_business_initiative(
        initial_investment=Decimal('50000.00'),
        estimated_unit_cost=Decimal('60.00'),
        estimated_unit_price=Decimal('100.00'),
        expected_demand=2000,
        fixed_costs=Decimal('10000.00')
    )

    # Margen unitario = 100 - 60 = 40
    assert res['unit_contribution_margin'] == Decimal('40.00')
    assert res['marginal_ratio'] == Decimal('0.4000')

    # Margen total = 40 * 2000 = 80,000
    assert res['total_contribution_margin'] == Decimal('80000.00')
    # Beneficio operativo neto = 80,000 - 10,000 = 70,000
    assert res['net_operating_profit'] == Decimal('70000.00')

    # Break even operativo = 10,000 / 40 = 250 unidades
    assert res['break_even_operational_units'] == 250
    # Break even inversión = 50,000 / 40 = 1250 unidades
    assert res['break_even_investment_units'] == 1250
    # Break even total = 60,000 / 40 = 1500 unidades
    assert res['break_even_total_units'] == 1500
    # Facturación de equilibrio = 1500 * 100 = 150,000
    assert res['break_even_revenue'] == Decimal('150000.00')

    # Payback = 50,000 / 70,000 = 0.71 ciclos
    assert res['payback_period_cycles'] == Decimal('0.71')
    # ROI = (70,000 - 50,000) / 50,000 = 20,000 / 50,000 = 40%
    assert res['roi_pct'] == Decimal('0.4000')
    assert res['viability'] == "Factible"
