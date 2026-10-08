import pytest
from decimal import Decimal
from app.engine.inventory import (
    calculate_inventory_turnover,
    calculate_doh,
    calculate_rop,
)

def test_inventory_turnover_normal():
    # CMV 1000, Inventario promedio 200 -> Rotacion = 5.00
    cogs = Decimal('1000.00')
    avg_inv = Decimal('200.00')
    result = calculate_inventory_turnover(cogs, avg_inv)
    assert result == Decimal('5.00')

def test_inventory_turnover_zero_inventory():
    cogs = Decimal('1000.00')
    avg_inv = Decimal('0')
    result = calculate_inventory_turnover(cogs, avg_inv)
    assert result == Decimal('0')

def test_doh_normal():
    # Avg inv 200, CMV 1000 -> (200 / 1000) * 365 = 73.00
    avg_inv = Decimal('200.00')
    cogs = Decimal('1000.00')
    result = calculate_doh(avg_inv, cogs)
    assert result == Decimal('73.00')

def test_doh_zero_cogs():
    avg_inv = Decimal('200.00')
    cogs = Decimal('0')
    result = calculate_doh(avg_inv, cogs)
    assert result == Decimal('0')

def test_rop_normal():
    # Demanda 10, Lead time 15, Safety stock 25 -> (10 * 15) + 25 = 175.00
    daily_demand = Decimal('10.00')
    lead_time = Decimal('15.00')
    safety_stock = Decimal('25.00')
    result = calculate_rop(daily_demand, lead_time, safety_stock)
    assert result == Decimal('175.00')

def test_rop_zero_demand():
    daily_demand = Decimal('0')
    lead_time = Decimal('15.00')
    safety_stock = Decimal('0')
    result = calculate_rop(daily_demand, lead_time, safety_stock)
    assert result == Decimal('0.00')

def test_rop_default_safety_stock():
    daily_demand = Decimal('5.00')
    lead_time = Decimal('10.00')
    result = calculate_rop(daily_demand, lead_time)
    assert result == Decimal('50.00')
