from decimal import Decimal, ROUND_HALF_UP

def calculate_inventory_turnover(cogs: Decimal, avg_inventory: Decimal) -> Decimal:
    """
    Calcula Rotación de inventario: CMV / Inventario Promedio
    Si el inventario promedio es cero, retorna Decimal('0').
    """
    if avg_inventory == Decimal('0'):
        return Decimal('0')
    return (cogs / avg_inventory).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def calculate_doh(avg_inventory: Decimal, cogs: Decimal) -> Decimal:
    """
    Calcula Days on Hand (DOH): (Inventario Promedio / CMV) * 365
    Si el CMV es cero, retorna Decimal('0').
    """
    if cogs == Decimal('0'):
        return Decimal('0')
    doh = (avg_inventory / cogs) * Decimal('365')
    return doh.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def calculate_rop(daily_demand: Decimal, lead_time: Decimal, safety_stock: Decimal = Decimal('0')) -> Decimal:
    """
    Calcula Punto de Reorden (ROP): (Demanda Diaria * Lead Time) + Stock de Seguridad
    """
    rop = (daily_demand * lead_time) + safety_stock
    return rop.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
