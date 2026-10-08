from decimal import Decimal
import pytest
from app.engine.budget_scenarios import project_budget_scenarios

def test_project_budget_scenarios_coherent_sums():
    """
    Valida que los cálculos matemáticos de los 3 presupuestos sumen coherentemente:
    - Ventas = CMV + Margen Bruto
    - Margen Contribución = Margen Bruto - OPEX
    - Proyecciones porcentuales correctas
    """
    hist_sales = Decimal('100000.00')
    hist_cogs = Decimal('60000.00')
    hist_opex = Decimal('20000.00')

    res = project_budget_scenarios(
        historical_sales=hist_sales,
        historical_cogs=hist_cogs,
        historical_opex=hist_opex
    )

    for scenario_key in ['conservative', 'base', 'aggressive']:
        sc = res[scenario_key]
        sales = sc['projected_sales']
        cogs = sc['projected_cogs']
        gm = sc['gross_margin']
        opex = sc['projected_opex']
        cm = sc['contribution_margin']

        # Verificación de identidad contable exacta
        assert sales == cogs + gm, f"En {scenario_key}, Ventas ({sales}) != CMV ({cogs}) + Margen Bruto ({gm})"
        assert gm - opex == cm, f"En {scenario_key}, Margen Bruto ({gm}) - OPEX ({opex}) != Margen Contribución ({cm})"
        assert sc['gross_margin_pct'] == ((gm / sales).quantize(Decimal('0.0001')))
        assert sc['contribution_margin_pct'] == ((cm / sales).quantize(Decimal('0.0001')))

    # Verificación de variaciones específicas
    # Conservador: -3% ventas, -5% opex
    con = res['conservative']
    assert con['projected_sales'] == Decimal('97000.00')
    assert con['projected_opex'] == Decimal('19000.00')

    # Base: +6% ventas, +6% cogs, +3% opex
    base = res['base']
    assert base['projected_sales'] == Decimal('106000.00')
    assert base['projected_cogs'] == Decimal('63600.00')
    assert base['projected_opex'] == Decimal('20600.00')

    # Agresivo: +15% ventas, +13% cogs, +10% opex
    agg = res['aggressive']
    assert agg['projected_sales'] == Decimal('115000.00')
    assert agg['projected_cogs'] == Decimal('67800.00')
    assert agg['projected_opex'] == Decimal('22000.00')
