import pytest
from decimal import Decimal
from app.engine.pricing import (
    calculate_gross_margin,
    calculate_markup,
    calculate_unit_contribution_margin,
    calculate_marginal_ratio,
    simulate_discount,
)

def test_markup_and_gross_margin_reconciliation():
    """
    Reconciliación contable exacta:
    Costo 100 y Precio 150 deben dar Markup de 50.00% y Margen Bruto de 33.33%.
    """
    cost = Decimal('100.00')
    price = Decimal('150.00')
    
    markup = calculate_markup(price, cost)
    gross_margin = calculate_gross_margin(price, cost)

    assert markup == Decimal('0.5000')  # 50.00%
    assert gross_margin == Decimal('0.3333')  # 33.33%

def test_discount_simulation_negative_margin():
    """
    Validar que un descuento del 40% sobre el precio de 150 genere margen negativo frente a costos directos.
    Precio 150 * (1 - 0.40) = 90. Costo = 100. Margen = (90 - 100)/90 = -0.1111 (-11.11%).
    """
    base_price = Decimal('150.00')
    cost = Decimal('100.00')
    discount_pct = Decimal('0.40')

    result = simulate_discount(base_price, cost, discount_pct)

    assert result["discounted_price"] == Decimal('90.00')
    assert result["gross_margin"] == Decimal('-0.1111')
    assert result["is_negative_margin"] is True

def test_zero_sales_margin():
    """Ventas en cero deben retornar Decimal('0')"""
    sales = Decimal('0')
    cost = Decimal('100.00')
    result = calculate_gross_margin(sales, cost)
    assert result == Decimal('0')

def test_zero_cost_markup():
    """Costo en cero debe retornar Decimal('0')"""
    sales = Decimal('150.00')
    cost = Decimal('0')
    result = calculate_markup(sales, cost)
    assert result == Decimal('0')

def test_unit_contribution_margin_and_ratio():
    """
    Validar contribución marginal y ratio descontando comisiones y flete.
    Precio = 150, Costo = 100, Comisión = 5% (7.50), Flete = 10
    CM = 150 - 100 - 7.50 - 10 = 32.50
    Ratio = 32.50 / 150 = 0.2167
    """
    selling_price = Decimal('150.00')
    cost = Decimal('100.00')
    commission_pct = Decimal('0.05')
    freight = Decimal('10.00')

    cm = calculate_unit_contribution_margin(selling_price, cost, commission_pct, freight)
    ratio = calculate_marginal_ratio(selling_price, cost, commission_pct, freight)

    assert cm == Decimal('32.50')
    assert ratio == Decimal('0.2167')

def test_marginal_ratio_zero_selling_price():
    selling_price = Decimal('0')
    cost = Decimal('50.00')
    ratio = calculate_marginal_ratio(selling_price, cost)
    assert ratio == Decimal('0')


def test_catalog_pricing_metrics():
    """
    Validar cálculos de catálogo de proveedores:
    PVP = 200, PVM = 150, Costo = 100
    - Descuento a comercios: ((200 - 150) / 200) * 100 = 25.00%
    - Margen bruto reventa: ((150 - 100) / 150) * 100 = 33.33%
    - Markup sobre costo: ((200 - 100) / 100) * 100 = 100.00%
    """
    from app.engine.pricing import (
        calculate_trade_discount,
        calculate_resale_gross_margin,
        calculate_cost_markup,
        calculate_catalog_item_metrics,
    )
    cost = Decimal('100.00')
    pvm = Decimal('150.00')
    pvp = Decimal('200.00')

    assert calculate_trade_discount(pvp, pvm) == Decimal('25.00')
    assert calculate_resale_gross_margin(pvm, cost) == Decimal('33.33')
    assert calculate_cost_markup(pvp, cost) == Decimal('100.00')

    metrics = calculate_catalog_item_metrics(cost, pvm, pvp)
    assert metrics["descuento_comercios_pct"] == Decimal('25.00')
    assert metrics["margen_reventa_pct"] == Decimal('33.33')
    assert metrics["markup_costo_pct"] == Decimal('100.00')


def test_catalog_pricing_edge_cases():
    from app.engine.pricing import (
        calculate_trade_discount,
        calculate_resale_gross_margin,
        calculate_cost_markup,
    )
    assert calculate_trade_discount(Decimal('0'), Decimal('10')) == Decimal('0.00')
    assert calculate_resale_gross_margin(Decimal('0'), Decimal('10')) == Decimal('0.00')
    assert calculate_cost_markup(Decimal('50'), Decimal('0')) == Decimal('0.00')
