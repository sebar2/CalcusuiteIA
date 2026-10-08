"""
Servicio de Debate Dialéctico Generativo Multi-Agente (Ing. David Jiménez Vera vs. Aristóteles)
Modelo Local: Ollama (qwen2.5:7b)
Módulo: Licitaciones & Proyectos B2B (Calcu | SupplyFinance Suite)
"""

import logging
import time
import httpx
from typing import Dict, Any, List, Optional
from app.core.config import OLLAMA_BASE_URL, OLLAMA_MODEL
from app.domain.schemas import TenderQuoteRequest, DialecticalDebateResponse

logger = logging.getLogger(__name__)

OLLAMA_URL = f"{OLLAMA_BASE_URL}/api/generate"
MODEL_NAME = OLLAMA_MODEL or "qwen2.5:7b"

SYSTEM_PROMPT_DAVID = """Actúas como el Ingeniero David Jiménez Vera, consultor senior en ingeniería electrotécnica y perito de iluminación para Serlux en Uruguay.
Tu especialidad absoluta son las normativas UNIT (UNIT-ISO 8995-1 para interiores de trabajo y UNIT 1083 para alumbrado público), límites de deslumbramiento UGR (<19 en oficinas, <25 en industrias), fotometría, flujo luminoso útil (lm/W), factor de potencia (>0.95), distorsión armónica THD (<10%) y durabilidad L80B10.
Tu estilo es técnico, analítico, riguroso e inflexible ante la mediocridad.

Tu tarea:
1. Auditar los requerimientos técnicos y las partidas solicitadas.
2. Cruzar las cantidades con el stock disponible en Montevideo y los tiempos de importación marítima (60 días).
3. Si hay quiebre logístico crítico, advertir el riesgo legal de penalidades por atraso y sugerir un reemplazo técnico viable con el inventario disponible.
4. Calcular el impacto de confort visual y eficiencia energética (kWh).
Sé conciso, estructurado y usa viñetas técnicas con métricas concretas."""

SYSTEM_PROMPT_ARISTOTELES = """Actúas como Aristóteles, Director Estratégico de Cierre Comercial B2B y maestro de la retórica de negocios para Serlux en Uruguay.
Tu rol es tomar el dictamen técnico de ingeniería y transformarlo en una oferta comercial ganadora, protegiendo el margen neto de la empresa y asegurando la adjudicación.
Dominas la estructura retórica clásica:
- LOGOS: Demostración numérica contundente (precios en USD o UYU con tasa BROU, costo total de propiedad TCO, ahorro en factura eléctrica de UTE).
- ETHOS: Respaldo institucional de Serlux (garantía local real de 5 años con reposición inmediata en Montevideo, stock propio sin depender de contenedores en viaje).
- PATHOS: Paz mental para el director de obra o jefe de compras (cero riesgo de multas por entrega tardía y aprobación garantizada en inspecciones).

Tu tarea:
1. Analizar la postura técnica del Ing. David. Si David es demasiado purista y encarece la cotización, rebate su postura buscando el equilibrio óptimo de costo/beneficio.
2. Definir la estrategia de pricing y margen de ganancia.
3. Redactar la PROPUESTA COMERCIAL FORMAL lista para ser enviada por correo electrónico al cliente (con saludo, detalle de partidas, condiciones comerciales y llamado a la acción)."""


async def query_ollama(
    prompt: str,
    system_prompt: str,
    temperature: float = 0.3,
    timeout: float = 60.0
) -> str:
    """Invoca a Ollama localmente con manejo de timeout defensivo."""
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "system": system_prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "top_p": 0.9,
            "num_ctx": 4096,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(OLLAMA_URL, json=payload)
            if response.status_code == 200:
                resp_json = response.json()
                return resp_json.get("response", "").strip()
            logger.warning("Ollama HTTP status %s: %s", response.status_code, response.text)
            return f"[Error Ollama HTTP {response.status_code}]"
    except httpx.TimeoutException:
        logger.warning("Ollama query timeout after %s seconds", timeout)
        return "[Ollama timeout: el modelo tardó más de lo esperado]"
    except Exception as e:
        logger.warning("Ollama connection error: %s", e)
        return f"[Ollama fuera de línea o inaccesible: {str(e)}]"


def _build_deterministic_david_fallback(
    tender_data: TenderQuoteRequest,
    logistics_audit: List[Dict[str, Any]],
    exchange_rate_brou: float
) -> str:
    """Genera dictamen técnico detallado estructurado como fallback si Ollama no está disponible."""
    quiebres = [it for it in logistics_audit if it.get("viabilidad_logistica") == "QUIEBRE_LOGISTICO_CRITICO" or "QUIEBRE" in it.get("estado_logistico", "")]
    
    lineas = [
        f"### 🏛️ DICTAMEN ELECTROTÉCNICO & NORMATIVO UNIT",
        f"**Perito:** Ing. David Jiménez Vera | **Proyecto:** {tender_data.proyecto_nombre} ({tender_data.cliente_licitacion})",
        f"**Normas Aplicadas:** UNIT-ISO 8995-1 (Ambientes de Trabajo) / UNIT 1083 (Alumbrado Vial)",
        "",
        "#### 1. Auditoría Fotométrica y de Confort Visual:",
        "- **Límite UGR:** Garantizado < 19 en áreas administrativas y < 22 en naves industriales con ópticas microprismáticas.",
        "- **Eficacia Lumínica:** > 135 lm/W útil real certificada en laboratorio (fichas IES LM-79/80 disponibles).",
        "- **Calidad de Componentes:** Drivers con Factor de Potencia > 0.96, THD < 8% y supresor de transitorios (DPS) de 6kV incorporado.",
        "",
        "#### 2. Auditoría Logística y Realidad en Depósito de Montevideo:",
    ]
    
    for it in logistics_audit:
        sku = it.get("sku")
        sol = it.get("cantidad_solicitada", 0)
        stock = it.get("stock_deposito", it.get("stock_actual", 0))
        lead_t = it.get("lead_time_dias", it.get("lead_time", 60))
        viab = it.get("viabilidad_logistica", it.get("estado_logistico", ""))
        lineas.append(f"- **SKU {sku}:** Solicitado {sol} u. | Stock Plaza: {stock} u. | Lead Time: {lead_t:.0f}d | Estado: `{viab}`")

    if quiebres:
        lineas.extend([
            "",
            "#### ⚠️ ALERTA TÉCNICA DE QUIEBRE Y HOMOLOGACIÓN SUGERIDA:",
            f"Se detectan partidas con lead time de importación superior al plazo contractual ({tender_data.plazo_entrega_dias} días).",
            "**Recomendación Pericial:** No arriesgar penalizaciones por mora de obra. Proponer entrega parcial con stock inmediato de plaza y homologación cruzada por luminarias de especificación equivalente o superior disponibles en depósito central.",
        ])
    else:
        lineas.extend([
            "",
            "#### ✅ VIABILIDAD TÉCNICA TOTAL:",
            "Las partidas solicitadas están cubiertas con stock en plaza o tránsito con arribo dentro de la ventana contractual.",
        ])

    return "\n".join(lineas)


def _build_deterministic_aristoteles_fallback(
    tender_data: TenderQuoteRequest,
    logistics_audit: List[Dict[str, Any]],
    postura_david: str,
    exchange_rate_brou: float
) -> str:
    """Genera propuesta comercial y retórica B2B estructurada como fallback si Ollama no está disponible."""
    total_costo = sum(it.get("costo_unitario_moneda", it.get("costo_unitario", 0)) * it.get("cantidad_solicitada", 1) for it in logistics_audit)
    total_oferta = sum(it.get("subtotal_precio", 0) for it in logistics_audit)
    moneda = tender_data.moneda

    return f"""### ⚖️ ESTRATEGIA RETÓRICA B2B & PROPUESTA COMERCIAL
**Director:** Aristóteles (Estrategia de Cierre Serlux) | **Cliente:** {tender_data.cliente_licitacion}

#### 1. Trivio Retórico de Negociación:
- **LOGOS (Racionalidad Financiera):** La inversión total asciende a **{moneda} {total_oferta:,.2f}** (Tipo de cambio BROU: {exchange_rate_brou:.2f} UYU). Proyectamos un retorno acelerado (ROI < 14 meses) al reducir más del 62% del consumo eléctrico frente a tecnologías tradicionales, ahorrando miles de dólares en la tarifa de UTE.
- **ETHOS (Autoridad Institucional Serlux):** Garantía oficial directa de 5 años con respaldo en Montevideo. Si un equipo falla, se reemplaza en 24 horas desde nuestro depósito local, sin esperar semanas a que un fabricante en el exterior tramite un reclamo.
- **PATHOS (Paz Mental & Seguridad del Proyecto):** Tranquilidad absoluta para la dirección de obra y la gerencia de compras. Homologación aprobada en primera inspección y cero multas contractuales por atrasos logísticos.

---

#### 2. PROPUESTA COMERCIAL FORMAL (Lista para Enviar):

**Estimado Equipo de Compras y Dirección de Obra de {tender_data.cliente_licitacion},**

Nos dirigimos a ustedes en relación al proyecto **"{tender_data.proyecto_nombre}"** para presentar formalmente la propuesta técnica y económica de Serlux Iluminación Técnica:

1. **Cumplimiento Normativo Incondicional:**  
   Nuestras luminarias cumplen estrictamente con los estándares UNIT-ISO 8995-1 y UNIT 1083, garantizando niveles óptimos de confort visual (UGR controlado) y vida útil superior a 50.000 horas (L80B10).

2. **Condiciones Económicas y Plazo de Entrega:**  
   - **Monto Total de la Propuesta:** {moneda} {total_oferta:,.2f} (Precios netos + IVA).
   - **Plazo de Entrega:** {tender_data.plazo_entrega_dias} días hábiles, garantizado con disponibilidad inmediata desde nuestro centro logístico en Montevideo.
   - **Garantía:** 5 años integrales sobre luminaria y driver.

Quedamos a su entera disposición para coordinar una reunión técnica con el **Ing. David Jiménez Vera** y presentar la simulación fotométrica punto a punto.

Atentamente,  
**Equipo de Proyectos B2B & Licitaciones**  
*Serlux Uruguay | SupplyFinance Suite*
"""


async def run_dialectical_debate(
    tender_data: TenderQuoteRequest,
    logistics_audit: List[Dict[str, Any]],
    exchange_rate_brou: float = 40.40,
    engine_mode: str = "auto"
) -> Dict[str, Any]:
    """
    Ejecuta el pipeline dialéctico encadenado multi-turno:
    Turno 1: Ing. David Jiménez Vera (Rigor Electrotécnico & Normativo UNIT)
    Turno 2: Aristóteles (Estrategia Comercial B2B & Propuesta Formal)
    """
    t0 = time.perf_counter()

    # Si se selecciona 'heuristic', usamos inmediatamente los fallbacks estructurados
    if engine_mode == "heuristic":
        postura_david = _build_deterministic_david_fallback(tender_data, logistics_audit, exchange_rate_brou)
        replica_aristoteles = _build_deterministic_aristoteles_fallback(tender_data, logistics_audit, postura_david, exchange_rate_brou)
        latency_ms = (time.perf_counter() - t0) * 1000
        return {
            "proyecto_nombre": tender_data.proyecto_nombre,
            "postura_david": postura_david,
            "replica_aristoteles": replica_aristoteles,
            "modelo_utilizado": "heuristica_deterministica",
            "latency_ms": round(latency_ms, 1),
            "status": "success",
        }

    # Resumen estructurado del inventario y partidas
    resumen_partidas = []
    for item in logistics_audit:
        sku = item.get("sku", "")
        desc = item.get("descripcion", item.get("nombre", ""))
        cant = item.get("cantidad_solicitada", 0)
        stock = item.get("stock_deposito", item.get("stock_actual", 0))
        lead_t = item.get("lead_time_dias", item.get("lead_time", 60))
        costo_unit = item.get("costo_unitario_usd", item.get("costo_unitario", 0))
        viab = item.get("viabilidad_logistica", item.get("estado_logistico", ""))
        resumen_partidas.append(
            f"- SKU: {sku} ({desc}) | Solicitado: {cant} u. | "
            f"Stock Físico Montevideo: {stock} u. | Lead Time Fábrica: {lead_t:.0f} días | "
            f"Costo CIF Unitario: USD {costo_unit:.2f} | Estado Logístico: {viab}"
        )
    items_context = "\n".join(resumen_partidas)

    plazo_dias = getattr(tender_data, "plazo_entrega_dias", 30) or getattr(tender_data, "fecha_requerida_entrega_dias", 30) or 30

    prompt_david = f"""PROYECTO: {tender_data.proyecto_nombre}
CLIENTE / LICITACIÓN: {tender_data.cliente_licitacion}
NICHO DE APLICACIÓN: {tender_data.nicho}
PLAZO MÁXIMO DE ENTREGA CONTRACTUAL: {plazo_dias} días
MONEDA: {tender_data.moneda} (Tipo de cambio BROU: {exchange_rate_brou:.2f} UYU)

PARTIDAS Y ESTADO EN DEPÓSITO DE MONTEVIDEO:
{items_context}

Por favor, emite tu dictamen electrotécnico y logístico estricto."""

    # Inferencia 1: Ing. David (temperature=0.2 para máximo rigor)
    postura_david = await query_ollama(prompt_david, SYSTEM_PROMPT_DAVID, temperature=0.2, timeout=50.0)

    # Si Ollama falló o devolvió error, aplicamos fallback determinístico para David
    if not postura_david or postura_david.startswith("[Error") or postura_david.startswith("[Ollama"):
        logger.info("Ollama fallo en turno de David; aplicando fallback determinístico: %s", postura_david)
        postura_david = _build_deterministic_david_fallback(tender_data, logistics_audit, exchange_rate_brou)
        used_model = "qwen2.5:7b (con fallback híbrido)"
    else:
        used_model = MODEL_NAME

    # Inferencia 2: Aristóteles (recibe el dictamen previo de David con temperature=0.6)
    prompt_aristoteles = f"""PROYECTO: {tender_data.proyecto_nombre}
CLIENTE: {tender_data.cliente_licitacion}
NICHO DE APLICACIÓN: {tender_data.nicho}
PLAZO DE ENTREGA: {plazo_dias} días
MONEDA: {tender_data.moneda} (Tasa BROU: {exchange_rate_brou:.2f} UYU)

PARTIDAS ANALIZADAS:
{items_context}

DICTAMEN TÉCNICO PREVIO DEL ING. DAVID JIMÉNEZ:
\"\"\"
{postura_david}
\"\"\"

Evalúa la postura de David, plantea tu réplica comercial y redacta la propuesta ejecutiva formal completa lista para copiar y enviar al cliente."""

    replica_aristoteles = await query_ollama(prompt_aristoteles, SYSTEM_PROMPT_ARISTOTELES, temperature=0.6, timeout=50.0)

    # Si Ollama falló para Aristóteles, aplicamos fallback determinístico
    if not replica_aristoteles or replica_aristoteles.startswith("[Error") or replica_aristoteles.startswith("[Ollama"):
        logger.info("Ollama fallo en turno de Aristóteles; aplicando fallback determinístico: %s", replica_aristoteles)
        replica_aristoteles = _build_deterministic_aristoteles_fallback(
            tender_data, logistics_audit, postura_david, exchange_rate_brou
        )
        used_model = "qwen2.5:7b (con fallback híbrido)"

    latency_ms = (time.perf_counter() - t0) * 1000

    return {
        "proyecto_nombre": tender_data.proyecto_nombre,
        "postura_david": postura_david,
        "replica_aristoteles": replica_aristoteles,
        "modelo_utilizado": used_model,
        "latency_ms": round(latency_ms, 1),
        "status": "success",
    }
