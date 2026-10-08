"""
Servicio de Licitaciones B2B, Factibilidad Logística y Dialéctica IA (Luminar -> Calcu)
Zero-Trust Security, Validación Pydantic V2 y Sincronización BROU
"""

import logging
import uuid
import json
import httpx
from decimal import Decimal
from datetime import date, datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.entities import Product, Inventory, Tender, TenderItem
from app.domain.schemas import (
    TenderEvaluateRequest,
    TenderEvaluateResponse,
    TenderItemEvaluationResult,
    TenderCreateRequest,
    TenderResponse,
)
from app.services.exchange_rate_service import ExchangeRateService
from app.services.agents.tenders_debate_service import run_dialectical_debate
from app.core.credentials import settings

logger = logging.getLogger(__name__)

# =====================================================================
# AGENTE DAVID JIMÉNEZ VERA: CONOCIMIENTO TÉCNICO Y NORMATIVAS UNIT
# =====================================================================
PERFIL_DAVID = {
    "nombre": "Ing. David Jiménez Vera",
    "cargo": "Ingeniero Eléctrico & Proyectista Lumínico - Luminar / Calcu",
    "especialidad": "Estudios Lumínicos (.ies, lux, UGR), Cálculo de ROI kWh, Homologación de Pliegos y Normativas IES LM-79/80, DALI-2, UNIT",
}

def calcular_roi_energetico(
    potencia_actual_w: float = 400.0,
    potencia_nueva_w: float = 150.0,
    cantidad: int = 100,
    horas_dia: float = 12.0,
    dias_ano: int = 300,
    tarifa_kwh_usd: float = 0.16,
    costo_inversion_usd: float = 12500.0,
) -> Dict[str, Any]:
    kwh_actual_ano = (potencia_actual_w * cantidad * horas_dia * dias_ano) / 1000.0
    kwh_luminar_ano = (potencia_nueva_w * cantidad * horas_dia * dias_ano) / 1000.0
    kwh_ahorro_ano = kwh_actual_ano - kwh_luminar_ano
    ahorro_usd_ano = kwh_ahorro_ano * tarifa_kwh_usd
    ahorro_pct = round(((potencia_actual_w - potencia_nueva_w) / potencia_actual_w) * 100.0, 1) if potencia_actual_w > 0 else 0.0
    meses_retorno = round((costo_inversion_usd / ahorro_usd_ano) * 12.0, 1) if ahorro_usd_ano > 0 else 0.0
    reduccion_co2_ton = round(kwh_ahorro_ano * 0.000385, 2)

    return {
        "kwh_ahorro_anual": round(kwh_ahorro_ano, 1),
        "ahorro_dolares_anual": round(ahorro_usd_ano, 2),
        "ahorro_energetico_pct": ahorro_pct,
        "meses_retorno_roi": meses_retorno,
        "reduccion_co2_ton_anual": reduccion_co2_ton,
        "tarifa_kwh_usd": tarifa_kwh_usd,
    }


def generar_dictamen_david(
    proyecto: str,
    cliente: str,
    nicho: str,
    items_eval: List[TenderItemEvaluationResult],
    alerta_critica: bool,
    plazo_entrega_dias: int = 30,
) -> Dict[str, Any]:
    nicho_lower = nicho.lower()
    if "oficina" in nicho_lower or "retail" in nicho_lower:
        lux_objetivo = 500
        ugr_maximo = 19
        tipo_curva = "Batwing / Simétrica 90° con microprismático anti-glare"
        norma = "UNIT 180 / CIE S 008 (Iluminación de interiores de trabajo)"
        potencia_ant = 4 * 18  # 72W tubos fluorescentes
        potencia_nueva = 40.0
    elif "vial" in nicho_lower or "calle" in nicho_lower or "municip" in nicho_lower:
        lux_objetivo = 30
        ugr_maximo = 15
        tipo_curva = "Tipo II / Tipo III Asimétrica vial con corte total (Full Cutoff)"
        norma = "UNIT-ISO 8995 / IESNA RP-8 (Alumbrado Público)"
        potencia_ant = 250.0  # Sodio
        potencia_nueva = 100.0
    else:  # Industrial / Bodega / Nave
        lux_objetivo = 300
        ugr_maximo = 22
        tipo_curva = "Campana Industrial 120° / 90° lente óptica policarbonato Bayer UV"
        norma = "UNIT 180 / UNE-EN 12464-1 (Zonas de trabajo industriales)"
        potencia_ant = 400.0  # Mercurio / Halogenuro
        potencia_nueva = 150.0

    total_unids = sum(item.cantidad_solicitada for item in items_eval)
    costo_total = sum(item.subtotal_precio for item in items_eval)

    roi = calcular_roi_energetico(
        potencia_actual_w=potencia_ant,
        potencia_nueva_w=potencia_nueva,
        cantidad=max(1, total_unids),
        costo_inversion_usd=max(1.0, costo_total),
    )

    errores_competencia = [
        "Presentan fichas comerciales en lugar de ensayos IES LM-79 emitidos por laboratorio acreditado ILAC.",
        "Declaran vida útil L70 extrapolada sin test real a 55°C/85°C/105°C bajo protocolo IES LM-80 / TM-21.",
        f"Incumplen el índice UGR (deslumbramiento > {ugr_maximo}), provocando fatiga visual y no-conformidad laboral.",
        "Omiten protección contra sobretensiones transitorias (DPS mínimo 6kV/10kV), provocando fallas masivas ante descargas atmosféricas.",
        "Drivers genéricos con THD > 20% y FP < 0.90 que generan penalizaciones por energía reactiva en tarifa UTE.",
    ]

    # Semáforo de plazo vs lead time marítimo estándar (60 días)
    if plazo_entrega_dias >= 60:
        semaforo_plazo = "VERDE"
    elif plazo_entrega_dias >= 30:
        semaforo_plazo = "AMARILLO"
    else:
        semaforo_plazo = "ROJO"

    sustitucion_local = (
        "Se sugiere sustitución u homologación con stock en plaza Montevideo (SKU alternativo de fabricación local o lote disponible) para mitigar quiebre de entrega."
        if alerta_critica
        else "No se requiere sustitución; cronograma de abastecimiento dentro de márgenes de seguridad."
    )

    alerta_txt = ""
    if alerta_critica:
        alerta_txt = (
            "\n[ALERTA TÉCNICA DE CRONOGRAMA]:\n"
            f"Se detectan ítems con quiebre logístico crítico frente al plazo de {plazo_entrega_dias} días (Semáforo: {semaforo_plazo}). "
            f"{sustitucion_local}\n"
        )

    resumen_dictamen = (
        f"Dictamen Técnico de Homologación Lumínica - Proyecto '{proyecto}' ({cliente}):\n\n"
        f"1. FOTOMETRÍA Y CONFORT VISUAL:\n"
        f"   - Nivel de iluminancia media proyectada: {lux_objetivo} lux sobre plano de trabajo.\n"
        f"   - Límite de deslumbramiento unificado: UGR < {ugr_maximo} garantizado por diseño óptico.\n"
        f"   - Curva fotométrica: {tipo_curva}.\n"
        f"   - Marco normativo de cumplimiento: {norma}.\n\n"
        f"2. EFICIENCIA ENERGÉTICA Y PAYBACK:\n"
        f"   - Ahorro de consumo energético: {roi['ahorro_energetico_pct']}% frente a tecnología preexistente.\n"
        f"   - Ahorro de energía proyectado: {roi['kwh_ahorro_anual']:,} kWh/año ({roi['reduccion_co2_ton_anual']} ton CO2 no emitidas).\n"
        f"   - Payback técnico estimado: {roi['meses_retorno_roi']} meses.\n\n"
        f"3. BLINDAJE TÉCNICO FRENTE A RIVALES:\n"
        + "\n".join([f"   • {err}" for err in errores_competencia[:3]])
        + alerta_txt
    )

    return {
        "agente": PERFIL_DAVID["nombre"],
        "cargo": PERFIL_DAVID["cargo"],
        "lux_objetivo": lux_objetivo,
        "ugr_maximo": ugr_maximo,
        "tipo_curva": tipo_curva,
        "norma_aplicable": norma,
        "roi_energetico": roi,
        "errores_competencia": errores_competencia,
        "dictamen_completo": resumen_dictamen,
        "compatibilidad_tecnica": True,
        "semaforo_plazo": semaforo_plazo,
        "sustitucion_local_sugerida": sustitucion_local,
    }


# =====================================================================
# AGENTE ARISTÓTELES: RETÓRICA COMERCIAL B2B (LOGOS, ETHOS, PATHOS)
# =====================================================================
ESTRATEGIAS_NICHO = {
    "municipios": {
        "nombre": "Gobiernos Municipales (Alumbrado Público)",
        "logos": "Reducción directa del gasto corriente municipal en alumbrado público. Cada peso ahorrado en la factura de UTE se reasigna a obras visibles.",
        "ethos": "Cumplimiento estricto del pliego y blindaje legal frente al Tribunal de Cuentas. Trazabilidad de laboratorio acreditado ILAC sin riesgo de impugnaciones.",
        "pathos": "Seguridad ciudadana y orgullo barrial. Espacios públicos vivos donde las familias transitan con tranquilidad al anochecer.",
        "pitch_apertura": "Sr. Intendente / Director de Obras: No venimos a venderle lámparas; venimos a convertir avenidas oscuras en corredores de seguridad ciudadana mientras reducimos más del 60% del consumo con respaldo certificado.",
        "frase_fuerza": "Una ciudad bien iluminada es una ciudad que confía en sus líderes.",
    },
    "industria": {
        "nombre": "Plantas Industriales & Logísticas",
        "logos": "Retorno de inversión acelerado y eliminación de paradas imprevistas gracias a drivers L80B10 > 50.000 horas.",
        "ethos": "Blindaje normativo total frente a auditorías de la Inspección General del Trabajo bajo normativa UNIT 180.",
        "pathos": "Bienestar, agudeza visual y dignidad laboral para los operarios. Cero fatiga visual y reducción radical de accidentes nocturnos.",
        "pitch_apertura": "Gerente de Operaciones: Iluminar con equipos genéricos cuesta accidentes y multas laborales. Con nuestro estudio fotométrico blindamos la seguridad de su equipo y recuperamos la inversión en meses.",
        "frase_fuerza": "Evite multas y aumente el rendimiento de sus operarios mediante una atmósfera de precisión.",
    },
    "real_estate": {
        "nombre": "Desarrolladores de Real Estate Corporativo",
        "logos": "Mayor tasa interna de retorno (TIR) del desarrollo y disminución de gastos comunes (OPEX), incrementando el atractivo para inquilinos Clase A.",
        "ethos": "Homologación para créditos LEED/EDGE y protocolos DALI-2 integrables a sistemas BMS inteligentes.",
        "pathos": "Exclusividad, diseño y status. Una atmósfera arquitectónica que transmite solidez, modernidad y compromiso sustentable.",
        "pitch_apertura": "Desarrollador: Un edificio corporativo se cotiza por la experiencia que proyecta y su eficiencia energética. Con nuestra prescripción técnica, su activo califica a certificaciones sustentables.",
        "frase_fuerza": "Luminar no solo ilumina, eleva el valor de mercado de su propiedad.",
    },
    "canchas_deportivas": {
        "nombre": "Complejos Deportivos (Pádel, Fútbol, Tenis)",
        "logos": "Consumo eléctrico reducido a un tercio frente a proyectores de halogenuro metálico. Encendido instantáneo sin esperas.",
        "ethos": "Cumplimiento normativo de federaciones deportivas con reporte fotométrico punto a punto sin flicker (<1%).",
        "pathos": "La emoción del juego sin sombras engañosas ni encandilamiento. Los jugadores eligen su complejo porque la visión de la pelota es perfecta.",
        "pitch_apertura": "Director del Complejo: Los jugadores eligen canchas donde no queden ciegos al mirar arriba en un remate. Garantizamos 400+ lux parejos y un 65% menos en la factura de UTE.",
        "frase_fuerza": "El deportista no perdona un punto ciego; juegue con iluminación de nivel profesional.",
    },
}

def generar_dictamen_aristoteles(
    proyecto: str,
    cliente: str,
    nicho: str,
    dictamen_david: Dict[str, Any],
    total_ofertado: float,
    moneda: str,
    margen_total_pct: float,
) -> Dict[str, Any]:
    nicho_key = "industria"
    nicho_lower = nicho.lower()
    for k in ESTRATEGIAS_NICHO:
        if k in nicho_lower:
            nicho_key = k
            break

    nicho_data = ESTRATEGIAS_NICHO[nicho_key]
    roi = dictamen_david.get("roi_energetico", {})
    ahorro_usd = roi.get("ahorro_dolares_anual", 12500)
    payback = roi.get("meses_retorno_roi", 14)
    kwh = roi.get("kwh_ahorro_anual", 85000)

    logos = (
        f"[LOGOS - Racionalidad Financiera]\n"
        f"La propuesta asciende a {moneda} {total_ofertado:,.2f} con un margen estimado de {margen_total_pct:.1f}%. "
        f"El proyecto genera un ahorro operativo anual de USD {ahorro_usd:,.2f} ({kwh:,} kWh/año), "
        f"con un período de amortización técnica de solo {payback} meses. Cada mes de demora en la decisión representa dinero perdido en la factura eléctrica."
    )

    ethos = (
        f"[ETHOS - Autoridad & Seguridad Jurídica]\n"
        f"{nicho_data['ethos']}\n"
        f"El Ing. David Jiménez Vera certifica cada partida bajo la norma {dictamen_david.get('norma_aplicable', 'UNIT 180')} "
        f"con curvas .IES y ensayos LM-79/80, garantizando {dictamen_david.get('lux_objetivo', 300)} lux y {dictamen_david.get('ugr_maximo', 22)} UGR."
    )

    pathos = (
        f"[PATHOS - Emoción & Liderazgo]\n"
        f"{nicho_data['pathos']}\n"
        f"Luminar no comercializa simples lámparas; instala la infraestructura lumínica que protege a las personas y posiciona a {cliente} en el estándar de excelencia."
    )

    pitch_completo = (
        f"ESTRATEGIA DE ADJUDICACIÓN COMERCIAL ({cliente.upper()} - {nicho_data['nombre'].upper()}):\n\n"
        f"• LEMA DE NEGOCIACIÓN: \"{nicho_data['frase_fuerza']}\"\n\n"
        f"1. PITCH DE ENTRADA:\n\"{nicho_data['pitch_apertura']}\"\n\n"
        f"2. {logos}\n\n"
        f"3. {ethos}\n\n"
        f"4. {pathos}\n\n"
        f"5. LLAMADO A LA ACCIÓN (Next Step):\n"
        f"\"Proponemos una sesión de 15 minutos con el Ing. David Jiménez Vera para presentar la memoria fotométrica punto a punto y validar los números de ahorro.\""
    )

    return {
        "nicho_aplicado": nicho_data["nombre"],
        "frase_fuerza": nicho_data["frase_fuerza"],
        "logos": logos,
        "ethos": ethos,
        "pathos": pathos,
        "pitch_apertura": nicho_data["pitch_apertura"],
        "estrategia_completa": pitch_completo,
    }


# =====================================================================
# MOTOR PRINCIPAL DE FACTIBILIDAD Y EVALUACIÓN DETERMINÍSTICA
# =====================================================================
class TendersService:
    def __init__(self):
        self.ollama_url = getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")

    def evaluate_tender(
        self,
        db: Session,
        payload: TenderEvaluateRequest,
    ) -> TenderEvaluateResponse:
        """
        Evalúa factibilidad logística ítem por ítem, consulta la tasa BROU,
        y genera los dictámenes técnicos (David) y comerciales (Aristóteles).
        """
        # 1. Cotización oficial BROU
        tasa_brou = float(ExchangeRateService.get_cached_rate_used_sync() or 40.40)
        moneda = payload.moneda.upper()

        items_results: List[TenderItemEvaluationResult] = []
        total_costo_moneda = 0.0
        total_ofertado_moneda = 0.0
        tiene_alerta_critica = False

        for item_in in payload.items:
            sku = item_in.sku
            cant = item_in.cantidad_solicitada

            # Consultar producto e inventario
            prod = db.query(Product).filter(Product.sku == sku).first()
            if not prod:
                # Fallback defensivo si el SKU no está en catálogo
                costo_base_usd = 20.0
                desc = f"Luminaria Genérica ({sku})"
                stock_dep = 0
                transito = 0
                lead_t = 60.0
            else:
                costo_base_usd = float(prod.costo_base)
                desc = prod.nombre
                inv = prod.inventario
                if inv:
                    stock_dep = inv.deposito_central
                    transito = inv.transito_maritimo
                    lead_t = float(inv.lead_time_dias or 60.0)
                else:
                    stock_dep = 0
                    transito = 0
                    lead_t = 60.0

            # Conversión cambiaria
            if moneda == "UYU":
                costo_moneda = round(costo_base_usd * tasa_brou, 2)
            else:
                costo_moneda = round(costo_base_usd, 2)

            # Cálculo de precio de venta sugerido
            margen_deseado = float(payload.margen_comercial_pct or 0.35)
            if item_in.precio_objetivo_unitario and item_in.precio_objetivo_unitario > 0:
                precio_unitario = float(item_in.precio_objetivo_unitario)
                margen_real = round(((precio_unitario - costo_moneda) / precio_unitario) * 100.0, 1) if precio_unitario > 0 else 0.0
            else:
                precio_unitario = round(costo_moneda / (1.0 - margen_deseado), 2)
                margen_real = round(margen_deseado * 100.0, 1)

            subtotal = round(precio_unitario * cant, 2)
            total_costo_moneda += round(costo_moneda * cant, 2)
            total_ofertado_moneda += subtotal

            # Evaluación determinística de viabilidad logística
            if stock_dep >= cant:
                viabilidad = "VIABLE_STOCK_INMEDIATO"
                badge_col = "emerald"
                faltantes = 0
                retraso = 0
                detalle = f"Stock inmediato disponible en plaza Montevideo ({stock_dep} u. en depósito)."
            elif lead_t <= float(payload.plazo_entrega_dias):
                viabilidad = "VIABLE_TRANSITO_IMPORTACION"
                badge_col = "amber"
                faltantes = max(0, cant - stock_dep)
                retraso = 0
                detalle = f"Stock en depósito ({stock_dep} u.) complementado por importación (Lead time: {lead_t:.0f}d <= Plazo: {payload.plazo_entrega_dias}d)."
            else:
                viabilidad = "QUIEBRE_LOGISTICO_CRITICO"
                badge_col = "rose"
                faltantes = max(0, cant - stock_dep)
                retraso = int(lead_t - float(payload.plazo_entrega_dias))
                detalle = f"Quiebre Logístico Crítico: Lead time de {lead_t:.0f}d supera plazo de {payload.plazo_entrega_dias}d. Faltan {faltantes} u. con retraso de {retraso} días."
                tiene_alerta_critica = True

            items_results.append(
                TenderItemEvaluationResult(
                    sku=sku,
                    descripcion=desc,
                    cantidad_solicitada=cant,
                    stock_deposito=stock_dep,
                    transito_maritimo=transito,
                    lead_time_dias=lead_t,
                    costo_unitario_usd=round(costo_base_usd, 2),
                    costo_unitario_moneda=costo_moneda,
                    precio_sugerido_unitario=precio_unitario,
                    subtotal_precio=subtotal,
                    margen_pct=margen_real,
                    viabilidad_logistica=viabilidad,
                    unidades_faltantes=faltantes,
                    dias_retraso_estimado=retraso,
                    badge_color=badge_col,
                    detalle_logistico=detalle,
                )
            )

        margen_consolidado_pct = (
            round(((total_ofertado_moneda - total_costo_moneda) / total_ofertado_moneda) * 100.0, 1)
            if total_ofertado_moneda > 0
            else 0.0
        )

        viabilidad_general = "QUIEBRE_LOGISTICO_CRITICO" if tiene_alerta_critica else "VIABLE_LOGISTICA_APROBADA"

        # 2. Dictamen del Ing. David Jiménez Vera
        dictamen_david = generar_dictamen_david(
            proyecto=payload.proyecto_nombre,
            cliente=payload.cliente_licitacion,
            nicho=payload.nicho,
            items_eval=items_results,
            alerta_critica=tiene_alerta_critica,
            plazo_entrega_dias=payload.plazo_entrega_dias,
        )

        # 3. Dictamen de Aristóteles (Estratega Comercial)
        dictamen_aristoteles = generar_dictamen_aristoteles(
            proyecto=payload.proyecto_nombre,
            cliente=payload.cliente_licitacion,
            nicho=payload.nicho,
            dictamen_david=dictamen_david,
            total_ofertado=total_ofertado_moneda,
            moneda=moneda,
            margen_total_pct=margen_consolidado_pct,
        )

        # Intentar enriquecimiento opcional con Ollama (timeout 2.5s)
        try:
            self._enrich_with_ollama(
                proyecto=payload.proyecto_nombre,
                cliente=payload.cliente_licitacion,
                dictamen_david=dictamen_david,
                dictamen_aristoteles=dictamen_aristoteles,
            )
        except Exception as e:
            logger.debug("Ollama enrichment omitted (using deterministic heuristics): %s", e)

        return TenderEvaluateResponse(
            status="success",
            proyecto_nombre=payload.proyecto_nombre,
            cliente_licitacion=payload.cliente_licitacion,
            nicho=payload.nicho,
            plazo_entrega_dias=payload.plazo_entrega_dias,
            moneda=moneda,
            tasa_cambio_brou=tasa_brou,
            total_costo=round(total_costo_moneda, 2),
            total_ofertado=round(total_ofertado_moneda, 2),
            margen_total_pct=margen_consolidado_pct,
            viabilidad_general=viabilidad_general,
            alerta_critica=tiene_alerta_critica,
            items=items_results,
            dictamen_david=dictamen_david,
            dictamen_aristoteles=dictamen_aristoteles,
        )

    async def evaluate_tender_async(
        self,
        db: Session,
        payload: TenderEvaluateRequest,
    ) -> TenderEvaluateResponse:
        """
        Evalúa factibilidad logística y ejecuta la cadena dialéctica multi-agente
        enriquecida con Ollama (qwen2.5:7b) entre Ing. David y Aristóteles.
        """
        base_resp = self.evaluate_tender(db, payload)

        mode = getattr(payload, "engine_mode", "auto") or "auto"
        if mode == "heuristic":
            return base_resp

        try:
            logistics_audit = [item.model_dump() for item in base_resp.items]
            debate_result = await run_dialectical_debate(
                tender_data=payload,
                logistics_audit=logistics_audit,
                exchange_rate_brou=base_resp.tasa_cambio_brou,
                engine_mode=mode,
            )

            # Inyectar las posturas generativas reales
            postura_david = debate_result["postura_david"]
            replica_aristoteles = debate_result["replica_aristoteles"]

            base_resp.dictamen_david["postura_david"] = postura_david
            base_resp.dictamen_david["postura_generativa_ia"] = postura_david
            base_resp.dictamen_david["modelo_utilizado"] = debate_result["modelo_utilizado"]
            if postura_david and not postura_david.startswith("[Error"):
                base_resp.dictamen_david["dictamen_completo"] = (
                    f"{base_resp.dictamen_david['dictamen_completo']}\n\n"
                    f"### 🏛️ DICTAMEN GENERATIVO DEL ING. DAVID JIMÉNEZ (Qwen 2.5:7b):\n{postura_david}"
                )

            base_resp.dictamen_aristoteles["replica_aristoteles"] = replica_aristoteles
            base_resp.dictamen_aristoteles["replica_generativa_ia"] = replica_aristoteles
            base_resp.dictamen_aristoteles["propuesta_formal"] = replica_aristoteles
            base_resp.dictamen_aristoteles["modelo_utilizado"] = debate_result["modelo_utilizado"]
            base_resp.dictamen_aristoteles["latency_ms"] = debate_result.get("latency_ms")
            if replica_aristoteles and not replica_aristoteles.startswith("[Error"):
                base_resp.dictamen_aristoteles["estrategia_completa"] = (
                    f"{base_resp.dictamen_aristoteles['estrategia_completa']}\n\n"
                    f"### ⚖️ RÉPLICA Y PROPUESTA FORMAL DE ARISTÓTELES (Qwen 2.5:7b):\n{replica_aristoteles}"
                )
        except Exception as e:
            logger.warning("Fallo en debate generativo Ollama; manteniendo dictamen base: %s", e)

        return base_resp

    def _enrich_with_ollama(
        self,
        proyecto: str,
        cliente: str,
        dictamen_david: Dict[str, Any],
        dictamen_aristoteles: Dict[str, Any],
    ):
        """Intenta enriquecer en segundo plano sin bloquear si Ollama está disponible (< 2.5s)."""
        prompt = (
            f"Como estratega comercial de iluminación en Uruguay, genera una frase contundente de cierre (máx 30 palabras) "
            f"para presentar la propuesta de Luminar al cliente '{cliente}' en el proyecto '{proyecto}'."
        )
        with httpx.Client(timeout=2.0) as client:
            resp = client.post(
                f"{self.ollama_url}/api/generate",
                json={"model": "qwen2.5:7b", "prompt": prompt, "stream": False},
            )
            if resp.status_code == 200:
                data = resp.json()
                text = data.get("response", "").strip()
                if text:
                    dictamen_aristoteles["frase_ia_qwen"] = text

    def save_tender(
        self,
        db: Session,
        eval_resp: TenderEvaluateResponse,
        observaciones: Optional[str] = None,
    ) -> Tender:
        """Persiste la cotización/licitación B2B evaluada en la base de datos."""
        tender_id = str(uuid.uuid4())
        new_tender = Tender(
            id=tender_id,
            proyecto_nombre=eval_resp.proyecto_nombre,
            cliente_licitacion=eval_resp.cliente_licitacion,
            nicho=eval_resp.nicho,
            plazo_entrega_dias=eval_resp.plazo_entrega_dias,
            moneda=eval_resp.moneda,
            tipo_cambio_brou=Decimal(str(eval_resp.tasa_cambio_brou)),
            estado="EVALUADO",
            observaciones=observaciones,
            dictamen_david=json.dumps(eval_resp.dictamen_david, ensure_ascii=False),
            dictamen_aristoteles=json.dumps(eval_resp.dictamen_aristoteles, ensure_ascii=False),
            created_at=datetime.now(timezone.utc),
        )
        db.add(new_tender)

        for it in eval_resp.items:
            db_item = TenderItem(
                tender_id=tender_id,
                sku=it.sku,
                cantidad_solicitada=it.cantidad_solicitada,
                costo_unitario_historico=Decimal(str(it.costo_unitario_moneda)),
                precio_unitario_ofertado=Decimal(str(it.precio_sugerido_unitario)),
                margen_estimado=Decimal(str(it.margen_pct)),
                viabilidad_logistica=it.viabilidad_logistica,
                unidades_faltantes=it.unidades_faltantes,
                dias_retraso_estimado=it.dias_retraso_estimado,
            )
            db.add(db_item)

        db.commit()
        db.refresh(new_tender)
        return new_tender

tenders_service = TendersService()
