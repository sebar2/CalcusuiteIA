import pytest
from decimal import Decimal
from app.engine.variance import (
    calculate_variance,
    calculate_variance_pct,
    get_variance_status,
)

def test_calculate_variance():
    actual = Decimal('1200.00')
    budget = Decimal('1000.00')
    assert calculate_variance(actual, budget) == Decimal('200.00')

def test_calculate_variance_pct():
    actual = Decimal('1200.00')
    budget = Decimal('1000.00')
    assert calculate_variance_pct(actual, budget) == Decimal('0.2000')

def test_calculate_variance_pct_zero_budget():
    actual = Decimal('100.00')
    budget = Decimal('0')
    assert calculate_variance_pct(actual, budget) == Decimal('0')

def test_get_variance_status():
    # Caso igual -> Yellow
    assert get_variance_status(Decimal('100'), Decimal('100')) == 'Yellow'
    
    # Mayor es mejor (Ventas)
    assert get_variance_status(Decimal('120'), Decimal('100'), higher_is_better=True) == 'Green'
    assert get_variance_status(Decimal('80'), Decimal('100'), higher_is_better=True) == 'Red'

    # Menor es mejor (Costos)
    assert get_variance_status(Decimal('80'), Decimal('100'), higher_is_better=False) == 'Green'
    assert get_variance_status(Decimal('120'), Decimal('100'), higher_is_better=False) == 'Red'
