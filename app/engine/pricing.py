from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any

def calculate_gross_margin(sales: Decimal, cost: Decimal) -> Decimal:
    """
    Margen bruto sobre ventas: (Ventas - Costo) / Ventas
    Si las ventas son cero, retorna Decimal('0').
    """
    if sales == Decimal('0'):
        return Decimal('0')
    margin = (sales - cost) / sales
    return margin.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

def calculate_markup(sales: Decimal, cost: Decimal) -> Decimal:
    """
    Markup sobre costo: (Ventas - Costo) / Costo
    Si el costo es cero, retorna Decimal('0').
    """
    if cost == Decimal('0'):
        return Decimal('0')
    markup = (sales - cost) / cost
    return markup.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

def calculate_unit_contribution_margin(
    selling_price: Decimal,
    variable_cost: Decimal,
    commission_pct: Decimal = Decimal('0'),
    freight: Decimal = Decimal('0')
) -> Decimal:
    """
    Margen de contribución unitario:
    Precio Venta - Costo Variable - Comisiones - Flete
    """
    commission = selling_price * commission_pct
    margin = selling_price - variable_cost - commission - freight
    return margin.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def calculate_marginal_ratio(
    selling_price: Decimal,
    variable_cost: Decimal,
    commission_pct: Decimal = Decimal('0'),
    freight: Decimal = Decimal('0')
) -> Decimal:
    """
    Ratio marginal: Margen de Contribución Unitario / Precio Venta
    Si el precio de venta es cero, retorna Decimal('0').
    """
    if selling_price == Decimal('0'):
        return Decimal('0')
    unit_cm = calculate_unit_contribution_margin(selling_price, variable_cost, commission_pct, freight)
    ratio = unit_cm / selling_price
    return ratio.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

CHANNEL_DEFAULT_COMMISSIONS = {
    "Mercado Libre": Decimal('0.12'),
    "Retail": Decimal('0.05'),
    "Mayorista": Decimal('0.03'),
    "Directo Web": Decimal('0.04'),
    "General": Decimal('0.00'),
}

def calculate_channel_net_contribution_margin(
    selling_price: Decimal,
    variable_cost: Decimal,
    channel: str = "General",
    custom_commission_pct: Decimal = None,
    freight_last_mile: Decimal = Decimal('0')
) -> Dict[str, Any]:
    """
    Cálculo de Margen de Contribución Neto por canal comercial deduciendo
    comisiones específicas (ej. 12% ML, pasarelas) y flete de última milla.
    Verifica el umbral crítico del 15% de ratio marginal.
    """
    commission = custom_commission_pct if custom_commission_pct is not None else CHANNEL_DEFAULT_COMMISSIONS.get(channel, Decimal('0.05'))
    unit_cm = calculate_unit_contribution_margin(selling_price, variable_cost, commission, freight_last_mile)
    marginal_ratio = calculate_marginal_ratio(selling_price, variable_cost, commission, freight_last_mile)
    below_threshold_15pct = marginal_ratio < Decimal('0.15')
    return {
        "channel": channel,
        "commission_pct": commission,
        "freight_last_mile": freight_last_mile,
        "unit_contribution_margin": unit_cm,
        "marginal_ratio": marginal_ratio,
        "below_threshold_15pct": below_threshold_15pct,
        "is_viable": not below_threshold_15pct and unit_cm > Decimal('0')
    }

def simulate_discount(
    base_price: Decimal,
    cost: Decimal,
    discount_pct: Decimal,
    commission_pct: Decimal = Decimal('0'),
    freight: Decimal = Decimal('0'),
    channel: str = "General"
) -> Dict[str, Any]:
    """
    Simulador de impacto de descuentos comerciales.
    Calcula el precio descontado, margen bruto, markup y margen de contribución,
    alertando en tiempo real si el margen de contribución cae por debajo del umbral del 15%.
    """
    discounted_price = (base_price * (Decimal('1') - discount_pct)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    gross_margin = calculate_gross_margin(discounted_price, cost)
    markup = calculate_markup(discounted_price, cost)
    
    effective_comm = commission_pct
    if effective_comm == Decimal('0') and channel in CHANNEL_DEFAULT_COMMISSIONS and channel != "General":
        effective_comm = CHANNEL_DEFAULT_COMMISSIONS[channel]

    unit_cm = calculate_unit_contribution_margin(discounted_price, cost, effective_comm, freight)
    cm_ratio = calculate_marginal_ratio(discounted_price, cost, effective_comm, freight)
    below_threshold = cm_ratio < Decimal('0.15')

    return {
        "base_price": base_price,
        "discount_pct": discount_pct,
        "discounted_price": discounted_price,
        "effective_price": discounted_price,
        "cost": cost,
        "channel": channel,
        "commission_pct": effective_comm,
        "gross_margin": gross_margin,
        "gross_margin_amount": (discounted_price - cost).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        "gross_margin_pct": gross_margin,
        "markup_pct": markup,
        "unit_contribution_margin": unit_cm,
        "marginal_ratio": cm_ratio,
        "is_negative_margin": gross_margin < Decimal('0') or unit_cm < Decimal('0'),
        "below_threshold_15pct": below_threshold,
        "is_viable": not below_threshold and unit_cm > Decimal('0')
    }
