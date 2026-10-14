from decimal import Decimal, ROUND_HALF_UP
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class CapacityCheckResult(BaseModel):
    peso_total_kg: float
    volumen_total_m3: float
    capacidad_vehiculo_kg: float
    capacidad_vehiculo_m3: float
    utilizacion_peso_pct: float
    utilizacion_volumen_pct: float
    is_overweight: bool
    is_overvolume: bool
    can_dispatch: bool
    estado_alerta: str  # 'OPTIMO', 'ADVERTENCIA', 'SOBRECARGA_CRITICA'
    mensajes: List[str]
    sugerencia_vehiculo: Optional[str] = None


class ServiceSettlementItem(BaseModel):
    concepto: str
    cantidad: float
    unidad_medida: str
    tarifa_unitaria: float
    subtotal: float


class ServiceSettlementResult(BaseModel):
    client_id: int
    dias_almacenaje: int
    pallets: int
    total_bultos: int
    total_unidades: int
    distancia_km: float
    items: List[ServiceSettlementItem]
    subtotal_almacenaje: float
    subtotal_handling: float
    subtotal_vas: float
    subtotal_flete: float
    total_sin_impuestos: float
    iva_monto: float
    total_facturar: float


class RouteProfitabilityResult(BaseModel):
    orden_id: Optional[int] = None
    numero_orden: str
    tarifa_flete_cliente: float
    pago_conductor: float
    peajes_combustible_variables: float
    costo_total_operativo: float
    margen_bruto: float
    margen_pct: float
    semaforo: str  # 'VERDE', 'AMARILLO', 'ROJO'
    diagnostico: str


class EbitdaAnalysisResult(BaseModel):
    ingresos_servicios_totales: float
    costos_directos_choferes: float
    costos_variables_operativos: float
    margen_contribucion: float
    margen_contribucion_pct: float
    costos_fijos_totales: float
    ebitda_neto: float
    ebitda_pct: float
    punto_equilibrio_ingresos: float
    cobertura_costos_fijos_pct: float
    total_viajes: int
    total_km_recorridos: float
    semaforo: str  # 'VERDE', 'AMARILLO', 'ROJO'
    diagnostico: str


class LogisticsEngine:
    """
    Motor analítico y de optimización para la unidad de negocio 3PL:
    1. Cubicaje y verificación de capacidad de carga.
    2. Liquidación multifactorial de servicios de almacenaje, manipulación y fletes.
    3. Análisis de margen de contribución y rentabilidad por viaje.
    """

    @staticmethod
    def to_decimal(val: Any) -> Decimal:
        if val is None:
            return Decimal("0.0")
        if isinstance(val, Decimal):
            return val
        return Decimal(str(val))

    @classmethod
    def validate_capacity(
        cls,
        capacidad_max_kg: Any,
        capacidad_max_m3: Any,
        peso_total_kg: Any,
        volumen_total_m3: Any,
    ) -> CapacityCheckResult:
        max_kg = cls.to_decimal(capacidad_max_kg)
        max_m3 = cls.to_decimal(capacidad_max_m3)
        peso = cls.to_decimal(peso_total_kg)
        vol = cls.to_decimal(volumen_total_m3)

        util_peso = (peso / max_kg * Decimal("100.0")) if max_kg > Decimal("0") else Decimal("0.0")
        util_vol = (vol / max_m3 * Decimal("100.0")) if max_m3 > Decimal("0") else Decimal("0.0")

        is_over_kg = peso > max_kg
        is_over_vol = vol > max_m3
        can_dispatch = not (is_over_kg or is_over_vol)

        mensajes: List[str] = []
        if is_over_kg:
            mensajes.append(f"Exceso de Peso: {float(peso):.1f} kg supera tara máxima de {float(max_kg):.1f} kg ({float(util_peso):.1f}%).")
        if is_over_vol:
            mensajes.append(f"Exceso de Volumen: {float(vol):.2f} m³ supera cubicaje de {float(max_m3):.2f} m³ ({float(util_vol):.1f}%).")

        # Semáforo de alerta
        max_util = max(util_peso, util_vol)
        if is_over_kg or is_over_vol:
            estado_alerta = "SOBRECARGA_CRITICA"
        elif max_util >= Decimal("85.0"):
            estado_alerta = "ADVERTENCIA"
            mensajes.append(f"Utilización alta ({float(max_util):.1f}%). Requiere estiba cuidadosa.")
        else:
            estado_alerta = "OPTIMO"

        # Sugerencia de vehículo si excede
        sugerencia = None
        if not can_dispatch:
            if peso > Decimal("3500") or vol > Decimal("25"):
                sugerencia = "Camión Plataforma Pesado / Semi-Remolque (Capacidad > 7000 kg, > 35 m³)"
            elif peso > Decimal("1500") or vol > Decimal("12"):
                sugerencia = "Camión Plataforma Mediano / Chasis (Capacidad 3500-5000 kg, 20-25 m³)"
            else:
                sugerencia = "Furgón Utilitario Alto (Capacidad 1500 kg, 12 m³)"

        return CapacityCheckResult(
            peso_total_kg=round(float(peso), 2),
            volumen_total_m3=round(float(vol), 3),
            capacidad_vehiculo_kg=round(float(max_kg), 2),
            capacidad_vehiculo_m3=round(float(max_m3), 3),
            utilizacion_peso_pct=round(float(util_peso), 1),
            utilizacion_volumen_pct=round(float(util_vol), 1),
            is_overweight=is_over_kg,
            is_overvolume=is_over_vol,
            can_dispatch=can_dispatch,
            estado_alerta=estado_alerta,
            mensajes=mensajes,
            sugerencia_vehiculo=sugerencia,
        )

    @classmethod
    def calculate_service_settlement(
        cls,
        client_id: int,
        dias_almacenaje: int,
        pallets: int,
        total_bultos: int,
        total_unidades: int,
        tarifa_almacenaje_pallet_dia: Any,
        tarifa_handling_bulto: Any,
        tarifa_etiquetado_unidad: Any,
        tarifa_flete_base: Any,
        distancia_km: float = 0.0,
        tarifa_flete_km_adicional: Any = Decimal("0.0"),
        iva_pct: float = 22.0,
    ) -> ServiceSettlementResult:
        t_alm = cls.to_decimal(tarifa_almacenaje_pallet_dia)
        t_hnd = cls.to_decimal(tarifa_handling_bulto)
        t_etiq = cls.to_decimal(tarifa_etiquetado_unidad)
        t_flt_base = cls.to_decimal(tarifa_flete_base)
        t_flt_km = cls.to_decimal(tarifa_flete_km_adicional)

        dias_dec = Decimal(str(dias_almacenaje))
        pallets_dec = Decimal(str(pallets))
        bultos_dec = Decimal(str(total_bultos))
        unidades_dec = Decimal(str(total_unidades))
        dist_dec = Decimal(str(distancia_km))

        sub_almacenaje = dias_dec * pallets_dec * t_alm
        sub_handling = bultos_dec * t_hnd
        sub_vas = unidades_dec * t_etiq
        
        # Flete: base + km excedentes (por ejemplo si > 15 km)
        km_adicionales = max(Decimal("0.0"), dist_dec - Decimal("15.0"))
        sub_flete = t_flt_base + (km_adicionales * t_flt_km)

        items: List[ServiceSettlementItem] = [
            ServiceSettlementItem(
                concepto="Almacenaje en Racks (Pallet / Día)",
                cantidad=float(dias_dec * pallets_dec),
                unidad_medida="pallet-días",
                tarifa_unitaria=float(t_alm),
                subtotal=round(float(sub_almacenaje), 2),
            ),
            ServiceSettlementItem(
                concepto="Manipulación (Handling In / Out)",
                cantidad=float(bultos_dec),
                unidad_medida="bultos",
                tarifa_unitaria=float(t_hnd),
                subtotal=round(float(sub_handling), 2),
            ),
            ServiceSettlementItem(
                concepto="Servicios de Valor Agregado (VAS / Etiquetado)",
                cantidad=float(unidades_dec),
                unidad_medida="unidades",
                tarifa_unitaria=float(t_etiq),
                subtotal=round(float(sub_vas), 2),
            ),
            ServiceSettlementItem(
                concepto=f"Flete Distribución Capilar ({float(dist_dec):.1f} km)",
                cantidad=1.0,
                unidad_medida="viaje",
                tarifa_unitaria=round(float(sub_flete), 2),
                subtotal=round(float(sub_flete), 2),
            ),
        ]

        total_sin_iva = sub_almacenaje + sub_handling + sub_vas + sub_flete
        iva_monto = total_sin_iva * (cls.to_decimal(iva_pct) / Decimal("100.0"))
        total_facturar = total_sin_iva + iva_monto

        return ServiceSettlementResult(
            client_id=client_id,
            dias_almacenaje=dias_almacenaje,
            pallets=pallets,
            total_bultos=total_bultos,
            total_unidades=total_unidades,
            distancia_km=distancia_km,
            items=items,
            subtotal_almacenaje=round(float(sub_almacenaje), 2),
            subtotal_handling=round(float(sub_handling), 2),
            subtotal_vas=round(float(sub_vas), 2),
            subtotal_flete=round(float(sub_flete), 2),
            total_sin_impuestos=round(float(total_sin_iva), 2),
            iva_monto=round(float(iva_monto), 2),
            total_facturar=round(float(total_facturar), 2),
        )

    @classmethod
    def calculate_route_profitability(
        cls,
        numero_orden: str,
        tarifa_flete_cliente: Any,
        pago_conductor: Any,
        peajes_variables: Any = Decimal("0.0"),
        orden_id: Optional[int] = None,
    ) -> RouteProfitabilityResult:
        flt_cli = cls.to_decimal(tarifa_flete_cliente)
        cost_chofer = cls.to_decimal(pago_conductor)
        gastos_var = cls.to_decimal(peajes_variables)

        costo_total = cost_chofer + gastos_var
        margen_bruto = flt_cli - costo_total

        if flt_cli > Decimal("0"):
            margen_pct = (margen_bruto / flt_cli * Decimal("100.0"))
        else:
            margen_pct = Decimal("-100.0") if costo_total > Decimal("0") else Decimal("0.0")

        # Criterios de semáforo
        if margen_pct >= Decimal("25.0"):
            semaforo = "VERDE"
            diagnostico = f"Margen saludable ({float(margen_pct):.1f}%). Operación altamente rentable."
        elif margen_pct >= Decimal("10.0"):
            semaforo = "AMARILLO"
            diagnostico = f"Margen moderado ({float(margen_pct):.1f}%). Requiere optimizar retorno o consolidación de bultos."
        else:
            semaforo = "ROJO"
            diagnostico = f"Margen crítico o deficitario ({float(margen_pct):.1f}%). Revisar tarifa con cliente o renegociar con chofer."

        return RouteProfitabilityResult(
            orden_id=orden_id,
            numero_orden=numero_orden,
            tarifa_flete_cliente=round(float(flt_cli), 2),
            pago_conductor=round(float(cost_chofer), 2),
            peajes_combustible_variables=round(float(gastos_var), 2),
            costo_total_operativo=round(float(costo_total), 2),
            margen_bruto=round(float(margen_bruto), 2),
            margen_pct=round(float(margen_pct), 1),
            semaforo=semaforo,
            diagnostico=diagnostico,
        )

    @classmethod
    def calculate_ebitda_and_breakeven(
        cls,
        ingresos_totales: Any,
        costos_choferes: Any,
        costos_variables_extras: Any,
        costos_fijos_totales: Any,
        total_viajes: int = 0,
        total_km: Any = Decimal("0.0"),
    ) -> EbitdaAnalysisResult:
        ing = cls.to_decimal(ingresos_totales)
        c_chof = cls.to_decimal(costos_choferes)
        c_var = cls.to_decimal(costos_variables_extras)
        c_fijos = cls.to_decimal(costos_fijos_totales)
        km = cls.to_decimal(total_km)

        margen_contrib = ing - (c_chof + c_var)
        mc_pct = (margen_contrib / ing * Decimal("100.0")) if ing > Decimal("0") else Decimal("0.0")

        ebitda = margen_contrib - c_fijos
        ebitda_pct = (ebitda / ing * Decimal("100.0")) if ing > Decimal("0") else Decimal("0.0")

        # Punto de equilibrio = Costos Fijos / Margen de Contribución Ratio
        ratio_mc = (margen_contrib / ing) if ing > Decimal("0") else Decimal("0.0")
        if ratio_mc > Decimal("0"):
            breakeven = c_fijos / ratio_mc
        else:
            breakeven = Decimal("0.0")

        cobertura = (margen_contrib / c_fijos * Decimal("100.0")) if c_fijos > Decimal("0") else Decimal("100.0")

        if ebitda > Decimal("0") and ebitda_pct >= Decimal("15.0"):
            semaforo = "VERDE"
            diagnostico = f"EBITDA positivo ({float(ebitda_pct):.1f}%). La operación supera el punto de equilibrio holgadamente."
        elif ebitda >= Decimal("0"):
            semaforo = "AMARILLO"
            diagnostico = f"EBITDA neutro o ajustado ({float(ebitda_pct):.1f}%). Absorbe costos fijos pero requiere mayor volumen de fletes/bultos."
        else:
            semaforo = "ROJO"
            diagnostico = f"EBITDA deficitario ({float(ebitda_pct):.1f}%). El margen de contribución no alcanza a absorber la estructura fija de depósito."

        return EbitdaAnalysisResult(
            ingresos_servicios_totales=round(float(ing), 2),
            costos_directos_choferes=round(float(c_chof), 2),
            costos_variables_operativos=round(float(c_var), 2),
            margen_contribucion=round(float(margen_contrib), 2),
            margen_contribucion_pct=round(float(mc_pct), 1),
            costos_fijos_totales=round(float(c_fijos), 2),
            ebitda_neto=round(float(ebitda), 2),
            ebitda_pct=round(float(ebitda_pct), 1),
            punto_equilibrio_ingresos=round(float(breakeven), 2),
            cobertura_costos_fijos_pct=round(float(cobertura), 1),
            total_viajes=total_viajes,
            total_km_recorridos=round(float(km), 1),
            semaforo=semaforo,
            diagnostico=diagnostico,
        )

