from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, Optional

def calculate_variance(actual: Decimal, budget: Decimal) -> Decimal:
    """Variación absoluta: Actuals - Budget"""
    return (actual - budget).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def calculate_variance_pct(actual: Decimal, budget: Decimal) -> Decimal:
    """
    Variación porcentual: (Actuals - Budget) / Budget
    Si budget es cero, retorna Decimal('0').
    """
    if budget == Decimal('0'):
        return Decimal('0.0000')
    pct = (actual - budget) / budget
    return pct.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

def get_variance_status(actual: Decimal, budget: Decimal, higher_is_better: bool = True) -> str:
    """
    Clasificación por semáforos de la variación presupuestaria:
    - 'Yellow' si actual == budget
    - 'Green' o 'Red' según higher_is_better
    """
    if actual == budget:
        return "Yellow"
    if higher_is_better:
        return "Green" if actual > budget else "Red"
    else:
        return "Green" if actual < budget else "Red"

def calculate_price_volume_mix_variance(
    budgeted_price: Decimal,
    budgeted_qty: Decimal,
    actual_price: Decimal,
    actual_qty: Decimal,
    budgeted_margin: Optional[Decimal] = None
) -> Dict[str, Decimal]:
    """
    Desglose estándar de variaciones financieras:
    - Efecto Precio: (Precio Real - Precio Presupuestado) * Cantidad Real
    - Efecto Volumen: (Cantidad Real - Cantidad Presupuestada) * Margen o Precio Presupuestado
    - Efecto Mix: Variación combinada
    """
    price_variance = (actual_price - budgeted_price) * actual_qty
    base_val = budgeted_margin if budgeted_margin is not None else budgeted_price
    volume_variance = (actual_qty - budgeted_qty) * base_val
    
    total_variance = (actual_price * actual_qty) - (budgeted_price * budgeted_qty)
    mix_variance = total_variance - price_variance - volume_variance

    return {
        'price_variance': price_variance.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'volume_variance': volume_variance.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'mix_variance': mix_variance.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        'total_variance': total_variance.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    }

def analyze_budget_variance(
    budgeted_amount: Decimal,
    actual_amount: Decimal,
    is_expense: bool = False
) -> Dict[str, Any]:
    """
    Analiza la variación presupuestaria y retorna el semáforo y deltas normalizados.
    """
    variance = actual_amount - budgeted_amount
    variance_pct = (variance / budgeted_amount).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP) if budgeted_amount != Decimal('0') else Decimal('0.0000')
    
    if is_expense:
        if variance_pct <= Decimal('0'):
            status = 'Green'
        elif variance_pct <= Decimal('0.05'):
            status = 'Yellow'
        else:
            status = 'Red'
    else:
        if variance_pct >= Decimal('0'):
            status = 'Green'
        elif variance_pct >= Decimal('-0.05'):
            status = 'Yellow'
        else:
            status = 'Red'
            
    return {
        'variance_amount': variance,
        'variance_pct': variance_pct,
        'status': status
    }


def calculate_multilevel_variance_breakdown(
    lines: list
) -> Dict[str, Any]:
    """
    Descomposición multinivel de variaciones financieras consolidadas y por categoría:
    - Efecto Precio Total
    - Efecto Volumen Total
    - Efecto Mix Total
    - Variación Neta Total
    - Semáforos contables auditados y bandera de mitigación requerida (> 5%)
    """
    total_price = Decimal('0.00')
    total_volume = Decimal('0.00')
    total_mix = Decimal('0.00')
    total_budget = Decimal('0.00')
    total_actual = Decimal('0.00')
    
    breakdown_lines = []
    
    for item in lines:
        cat = item.get("categoria", "General")
        b_price = Decimal(str(item.get("budgeted_price", 0)))
        b_qty = Decimal(str(item.get("budgeted_qty", 0)))
        a_price = Decimal(str(item.get("actual_price", 0)))
        a_qty = Decimal(str(item.get("actual_qty", 0)))
        b_margin = Decimal(str(item.get("budgeted_margin", b_price))) if "budgeted_margin" in item else None

        pvm = calculate_price_volume_mix_variance(b_price, b_qty, a_price, a_qty, b_margin)
        
        b_total = (b_price * b_qty).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        a_total = (a_price * a_qty).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        var_pct = Decimal('0.0000')
        if b_total != Decimal('0.00'):
            var_pct = ((a_total - b_total) / b_total).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            
        status = "Green" if var_pct >= Decimal('0') else ("Yellow" if var_pct >= Decimal('-0.05') else "Red")
        requires_mitigation = abs(var_pct) > Decimal('0.05')

        total_price += pvm['price_variance']
        total_volume += pvm['volume_variance']
        total_mix += pvm['mix_variance']
        total_budget += b_total
        total_actual += a_total

        breakdown_lines.append({
            "categoria": cat,
            "sku": item.get("sku"),
            "nombre": item.get("nombre", cat),
            "budgeted_amount": b_total,
            "actual_amount": a_total,
            "variance_amount": pvm['total_variance'],
            "variance_pct": var_pct,
            "price_variance": pvm['price_variance'],
            "volume_variance": pvm['volume_variance'],
            "mix_variance": pvm['mix_variance'],
            "status": status,
            "requires_mitigation": requires_mitigation
        })

    net_variance = total_actual - total_budget
    net_variance_pct = ((net_variance / total_budget).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)) if total_budget > 0 else Decimal('0.0000')

    return {
        "total_budget": total_budget,
        "total_actual": total_actual,
        "net_variance": net_variance,
        "net_variance_pct": net_variance_pct,
        "total_price_variance": total_price,
        "total_volume_variance": total_volume,
        "total_mix_variance": total_mix,
        "requires_mitigation": abs(net_variance_pct) > Decimal('0.05'),
        "lines": breakdown_lines
    }
