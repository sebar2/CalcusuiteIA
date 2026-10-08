from decimal import Decimal
import pytest
from app.engine.variance import calculate_price_volume_mix_variance, analyze_budget_variance

def test_price_volume_mix_variance():
    """Valida el desglose entre Efecto Precio, Volumen y Mix."""
    # Presupuestado: 100 unidades a $50 = $5000
    # Real: 120 unidades a $55 = $6600
    # Variación total = +$1600
    res = calculate_price_volume_mix_variance(
        budgeted_price=Decimal('50.00'),
        budgeted_qty=Decimal('100'),
        actual_price=Decimal('55.00'),
        actual_qty=Decimal('120')
    )

    # Efecto precio: (55 - 50) * 120 = 5 * 120 = 600
    assert res['price_variance'] == Decimal('600.00')
    # Efecto volumen: (120 - 100) * 50 = 20 * 50 = 1000
    assert res['volume_variance'] == Decimal('1000.00')
    # Efecto mix: 1600 - 600 - 1000 = 0
    assert res['mix_variance'] == Decimal('0.00')
    assert res['total_variance'] == Decimal('1600.00')

def test_analyze_budget_variance():
    # Ventas bajo presupuesto
    res1 = analyze_budget_variance(budgeted_amount=Decimal('100.00'), actual_amount=Decimal('90.00'), is_expense=False)
    assert res1['status'] == 'Red'

    # Gasto bajo presupuesto
    res2 = analyze_budget_variance(budgeted_amount=Decimal('100.00'), actual_amount=Decimal('90.00'), is_expense=True)
    assert res2['status'] == 'Green'
