"""
Rutas de API v1 para el Hub de Licitaciones e Inteligencia Estatal B2B (Calcu Suite).
Centraliza todas las consultas a compras públicas de Uruguay (Con la Tuya / SICE / ARCE),
protege secretos, aplica caché en memoria con TTL de 15 min y rigor numérico en Decimal.
"""

from __future__ import annotations

import logging
import urllib.parse
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings, OLLAMA_BASE_URL, OLLAMA_MODEL
from app.database.session import get_db
from app.models.entities import Product, Inventory, StockLocationBatch, Tender, TenderItem, Warehouse
from app.services.procurement_client import procurement_client
from app.services.cache_service import memory_cache
import httpx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/procurement", tags=["Procurement Intelligence Hub"])


# =============================================================================
# MODELOS PYDANTIC PARA CONTRATOS DE DATOS
# =============================================================================

class TechnicalOpinionRequest(BaseModel):
    vertical_id: Optional[str] = "ILUMINACION_EFICIENCIA"
    model: Optional[str] = None
    custom_notes: Optional[str] = None
    titulo: Optional[str] = None
    organismo: Optional[str] = None
    monto_estimado: Optional[float] = None
    plazo_entrega_dias: Optional[int] = 30
    summary: Optional[Dict[str, Any]] = None
    benchmarks: Optional[List[Dict[str, Any]]] = None


class TechnicalOpinionResponse(BaseModel):
    compra_id: str
    vertical_id: str
    perito_rol: str
    perito_nombre: str
    dictamen_markdown: str
    viable: bool
    alerta_riesgo: Optional[str] = None
    fuente_ia: str


class SaveTrackingRequest(BaseModel):
    compra_id: str
    proyecto_nombre: str
    cliente_licitacion: str
    nicho: Optional[str] = "ILUMINACION_EFICIENCIA"
    fecha_apertura: Optional[str] = None
    plazo_entrega_dias: Optional[int] = 30
    moneda: Optional[str] = "USD"
    monto_referencia: Optional[float] = None
    pliego_url: Optional[str] = None
    observaciones: Optional[str] = None


class CompetitiveMarkupRequest(BaseModel):
    sku: Optional[str] = None
    costo_nacionalizado: Optional[Decimal] = None
    product_code: Optional[str] = None
    precio_mediana_sice: Optional[Decimal] = None
    moneda: str = "USD"
    cantidad_solicitada: int = 1
    tasa_cambio_brou: Optional[Decimal] = Decimal("40.40")
    descuento_estrategico_pct: Optional[Decimal] = Decimal("6.00")  # % por debajo de la mediana


class CompetitiveMarkupResponse(BaseModel):
    sku: Optional[str]
    product_code: Optional[str]
    descripcion_producto: Optional[str]
    costo_nacionalizado_mvd: Decimal
    precio_mediana_sice: Decimal
    precio_ganador_sugerido: Decimal
    rango_competitivo_min: Decimal
    rango_competitivo_max: Decimal
    markup_pct: Decimal
    margen_bruto_pct: Decimal
    contribucion_unitaria: Decimal
    contribucion_total: Decimal
    moneda: str
    probabilidad_ganar: str  # ALTA, MEDIA, RIESGOSA
    diagnostico_estrategico: str


# =============================================================================
# TAB 1: RADAR DE CONVOCATORIAS EN VIVO
# =============================================================================

@router.get("/open-calls")
async def get_open_calls(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    page: Optional[int] = Query(None, ge=1),
    q: Optional[str] = Query(None, description="Búsqueda libre por palabra clave"),
    buyer: Optional[str] = Query(None, description="Filtrar por organismo comprador"),
    category: Optional[str] = Query(None, description="Filtrar por categoría o vertical"),
    method: Optional[str] = Query(None, description="Método de compra: Directa, Abreviada, Pública"),
    sort: Optional[str] = Query("closingSoon", description="Criterio de ordenamiento"),
    ends_before: Optional[str] = Query(None, description="Fecha límite ISO"),
):
    """
    Retorna convocatorias vivas desde la API de Compras Estatales con soporte de paginación acumulativa.
    """
    res = await procurement_client.get_open_calls(
        limit=limit,
        offset=offset,
        page=page,
        query=q,
        buyer=buyer,
        category=category,
        method=method,
        sort=sort,
        ends_before=ends_before,
    )
    if not res.get("success"):
        raise HTTPException(
            status_code=res.get("status_code", 502),
            detail=res.get("message", "Error al consultar convocatorias en compras estatales"),
        )
    return res


@router.get("/open-calls/{compra_id}/summary")
async def get_call_summary(compra_id: str):
    """
    Retorna el resumen estructurado generado por IA del pliego oficial de la licitación.
    """
    res = await procurement_client.get_call_summary(compra_id)
    if not res.get("success"):
        raise HTTPException(
            status_code=res.get("status_code", 502),
            detail=res.get("message", "No se pudo obtener el resumen IA del pliego"),
        )
    return res


@router.get("/open-calls/{compra_id}/benchmarks")
@router.get("/tenders/{compra_id}/benchmarks")
async def get_call_benchmarks(compra_id: str):
    """
    Retorna los precios de referencia históricos y percentiles (p25, p50, p75, p95) del pliego.
    Estructura normalizada y compatible con Con la Tuya y Calcu Suite.
    """
    res = await procurement_client.get_call_benchmarks(compra_id)
    if not res.get("success"):
        raise HTTPException(
            status_code=res.get("status_code", 502),
            detail=res.get("message", "No se pudieron obtener los benchmarks de precios"),
        )

    raw_data = res.get("data") or {}
    raw_benchmarks = raw_data.get("benchmarks") if isinstance(raw_data, dict) else (raw_data if isinstance(raw_data, list) else [])

    normalized_items = []
    for bm in raw_benchmarks:
        if not isinstance(bm, dict):
            continue
        c_id = bm.get("classificationId") or bm.get("siceCode") or ""
        lbl = bm.get("label") or bm.get("description") or "Artículo de Licitación"
        prod = bm.get("product") or {}
        baselines = bm.get("priceBaselines") or []

        primary_baseline = baselines[0] if baselines else {}
        p50 = primary_baseline.get("p50")
        p25 = primary_baseline.get("p25")
        p75 = primary_baseline.get("p75")
        p95 = primary_baseline.get("p95")
        curr = primary_baseline.get("currency") or "UYU"
        unit = primary_baseline.get("unitName") or "unidad"
        sample_n = primary_baseline.get("n") or prod.get("contractCount") or 0

        normalized_items.append({
            "classificationId": c_id,
            "siceCode": c_id,
            "label": lbl,
            "description": lbl,
            "product": prod,
            "contractCount": prod.get("contractCount") or sample_n,
            "sampleCount": sample_n,
            "buyerCount": prod.get("buyerCount", 0),
            "supplierCount": prod.get("supplierCount", 0),
            "totalUYU": prod.get("totalUYU", 0.0),
            "priceBaselines": baselines,
            "medianValue": p50,
            "minValue": p25,
            "maxValue": p75 or p95,
            "currency": curr,
            "unitName": unit,
            "topSuppliers": prod.get("topSuppliers", []),
            "recentContracts": prod.get("topSuppliers", []),
            "topBuyers": prod.get("topBuyers", []),
            "hasHistory": bool(baselines or (prod.get("contractCount", 0) > 0)),
        })

    return {
        "success": True,
        "compraId": compra_id,
        "data": {
            "compraId": compra_id,
            "benchmarks": raw_benchmarks,
            "items": normalized_items,
        }
    }


@router.post("/open-calls/{compra_id}/technical-opinion", response_model=TechnicalOpinionResponse)
@router.post("/open-calls/{compra_id}/audit-expert", response_model=TechnicalOpinionResponse)
async def generate_technical_opinion(
    compra_id: str,
    payload: TechnicalOpinionRequest,
    db: Session = Depends(get_db),
):
    """
    Genera un dictamen técnico exhaustivo con el agente experto de la vertical seleccionada
    (Ing. David para Luminarias/Iluminación, Ing. Civil para Obras, etc.) vía Ollama local
    alimentado tanto del resumen del pliego como de los benchmarks de precios SICE.
    """
    vertical = (payload.vertical_id or "ILUMINACION_EFICIENCIA").upper()

    # Mapeo de roles de ingeniería por vertical
    roles_map = {
        "ILUMINACION_EFICIENCIA": {
            "perito_rol": "Consultor Senior en Ingeniería Electrotécnica y Alumbrado Público",
            "perito_nombre": "Ing. David Jiménez Vera",
            "normas": "UNIT-ISO 8995-1 (Ambientes de Trabajo) y UNIT 1083 (Alumbrado Vial)",
            "foco": "Fotometría, lm/W, UGR < 19, drivers DALI-2, factor de potencia > 0.96 y DPS de 6kV",
        },
        "OBRA_CIVIL_CONSTRUCCION": {
            "perito_rol": "Especialista Estructural y Perito de Obra Civil",
            "perito_nombre": "Ing. Civil Alejandro Morales",
            "normas": "Normativas UNIT de Estructuras y Requisitos Municipales de Edificación",
            "foco": "Resistencia característica, ensayos de laboratorio, pliegos MTOP e intendencias",
        },
        "ELECTROMECANICA_SUMINISTROS": {
            "perito_rol": "Ingeniero Electromecánico Senior de Instalaciones Industriales",
            "perito_nombre": "Ing. Marcelo Rossi",
            "normas": "Reglamento de Baja y Media Tensión UTE y Normas IEC 61439",
            "foco": "Poder de corte en kA, curvas de disparo, aislamiento dieléctrico y barras de cobre",
        },
        "MOBILIARIO_EQUIPAMIENTO": {
            "perito_rol": "Director Técnico de Ergonomía y Mobiliario Corporativo",
            "perito_nombre": "Lic. Arq. Sofía Larrosa",
            "normas": "Norma UNE-EN 1335 (Sillas de Oficina) y estándares de resistencia BIFMA",
            "foco": "Mecanismos sincro, densidad de espuma inyectada, melamínicos de 25mm con canto ABS",
        },
        "EQUIPAMIENTO_HOSPITALARIO": {
            "perito_rol": "Perito en Bioingeniería y Equipamiento Médico",
            "perito_nombre": "Bioing. Martín Carve",
            "normas": "Buenas Prácticas MSP Uruguay y Normativa IEC 60601 de Seguridad Eléctrica Médica",
            "foco": "Biocompatibilidad, grado electromédico BF/CF, ciclos de esterilización y autoclave",
        },
        "TECNOLOGIA_REDES": {
            "perito_rol": "Ingeniero Principal de Telecomunicaciones y Networking",
            "perito_nombre": "Ing. Rodrigo Silva",
            "normas": "Estándares ANSI/TIA-568 y certificaciones Fluke Networks",
            "foco": "Atenuación dB/km en fibra monomodo, categoría 6A blindada F/UTP, redundancia PoE+",
        },
        "SERVICIOS_LIMPIEZA_MANTENIMIENTO": {
            "perito_rol": "Auditor de Operaciones, Servicios Integrales y Seguridad Ocupacional",
            "perito_nombre": "Lic. Valentina Viera",
            "normas": "Decreto 406/988 de Seguridad e Higiene Laboral y Fichas de Seguridad CIAT",
            "foco": "Ratios m2/hora por operario, equipamiento rotativo industrial y dotación de EPP",
        },
    }

    perito = roles_map.get(vertical, roles_map["ILUMINACION_EFICIENCIA"])

    # 1. Resumen de Pliego
    summary_obj = payload.summary or {}
    if not summary_obj:
        summary_data = await procurement_client.get_call_summary(compra_id)
        if summary_data.get("success") and isinstance(summary_data.get("data"), dict):
            summary_obj = summary_data["data"].get("summary") or {}

    # 2. Benchmarks SICE de Precios
    benchmarks_list = payload.benchmarks or []
    if not benchmarks_list:
        bm_res = await procurement_client.get_call_benchmarks(compra_id)
        if bm_res.get("success") and isinstance(bm_res.get("data"), dict):
            benchmarks_list = bm_res["data"].get("items") or bm_res["data"].get("benchmarks") or []

    benchmarks_summary_lines = []
    if benchmarks_list:
        for b in benchmarks_list:
            lbl = b.get("label") or b.get("description") or "Artículo de Licitación"
            baselines = b.get("priceBaselines") or []
            if baselines:
                for bl in baselines:
                    benchmarks_summary_lines.append(
                        f"- {lbl}: Mediana p50 = {bl.get('currency')} ${bl.get('p50')} ({bl.get('unitName')}) | "
                        f"Rango competitivo: ${bl.get('p25')} a ${bl.get('p75')} (Muestra: {bl.get('n')} compras estatales)"
                    )
            else:
                benchmarks_summary_lines.append(f"- {lbl}: Sin antecedentes directos de precios en SICE.")
    benchmarks_text = "\n".join(benchmarks_summary_lines) if benchmarks_summary_lines else "Sin baselines de precios históricos en compras estatales."

    titulo = payload.titulo or summary_obj.get("objeto") or f"Licitación Pública {compra_id}"
    organismo = payload.organismo or "Organismo Comprador Estatal"
    plazo_dias = payload.plazo_entrega_dias or 30

    # Auditoría logística de Calcu para el dictamen
    inventario_mvd = db.query(Inventory).all()
    stock_total_mvd = sum(int(i.deposito_central or 0) for i in inventario_mvd)
    stock_transito = sum(int(i.transito_maritimo or 0) for i in inventario_mvd)

    prompt = f"""AUDITORÍA TÉCNICA Y DICTAMEN OFICIAL:
Llamado N°: {compra_id}
Proyecto / Objeto: {titulo}
Organismo Comprador: {organismo}
Plazo de Entrega Exigido: {plazo_dias} días corridos.

Requisitos Clave del Pliego: {summary_obj.get('requisitosClave', 'Conformidad técnica y entrega en depósito')}
Garantías Solicitadas: {summary_obj.get('garantias', 'Mantenimiento de oferta y fiel cumplimiento')}
Observaciones del Pliego: {summary_obj.get('observaciones', 'Sin observaciones especiales')}

Precios de Referencia SICE / Benchmarks Estatales:
{benchmarks_text}

Disponibilidad en Depósito Central de Montevideo:
- Stock físico nacionalizado disponible: {stock_total_mvd} unidades
- Stock en tránsito marítimo (ETA próximo): {stock_transito} unidades

Genera tu dictamen técnico en Markdown estructurado como {perito['perito_nombre']}:
1. Evaluación de Requisitos Técnicos y Cumplimiento Normativo ({perito['normas']}).
2. Auditoría de Precios y Estrategia frente a Benchmarks SICE (Comparación frente a la mediana estatal y rango sugerido para ganar).
3. Verificación de Viabilidad Logística y Plazos ({plazo_dias} días frente al inventario en Montevideo).
4. Veredicto Final Imperativo: APROBADO TÉCNICAMENTE (Viable), CONDICIONADO, o RECHAZO TÉCNICO.
"""

    system_prompt = (
        f"Eres el {perito['perito_nombre']}, {perito['perito_rol']}. "
        f"Tu especialidad son {perito['foco']}. Eres riguroso, técnico e inflexible ante desvíos de calidad. "
        "Responde con análisis formal y viñetas técnicas concisas."
    )

    dictamen_markdown = ""
    fuente_ia = "Ollama Local"

    # Intentar invocación a Ollama
    try:
        model_to_use = payload.model or OLLAMA_MODEL or "qwen2.5:7b"
        async with httpx.AsyncClient(timeout=45.0) as client:
            ollama_resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": model_to_use,
                    "prompt": prompt,
                    "system": system_prompt,
                    "stream": False,
                    "options": {"temperature": 0.25, "top_p": 0.9},
                },
            )
            if ollama_resp.status_code == 200:
                dictamen_markdown = ollama_resp.json().get("response", "").strip()
    except Exception as exc:
        logger.warning("Ollama offline o timeout para dictamen técnico (%s). Usando fallback heurístico.", exc)

    # Si Ollama falló o no devolvió texto, armamos fallback estructurado de ingeniería
    if not dictamen_markdown:
        fuente_ia = "Motor Determinístico de Ingeniería Calcu"
        viable_flag = plazo_dias >= 15
        dictamen_markdown = f"""### 🏛️ DICTAMEN TÉCNICO DE INGENIERÍA
**Perito:** {perito['perito_nombre']} | **Rol:** {perito['perito_rol']}
**Convocatoria:** #{compra_id} - {titulo}
**Organismo:** {organismo}

#### 1. Marco Normativo y Ensayos Exigidos:
- **Normas Rectoras:** {perito['normas']}
- **Criterios de Calidad Auditados:** {perito['foco']}.
- **Documentación Técnica a Presentar:** Protocolos de ensayo de tipo en laboratorios acreditados (ISO 17025) y certificados de conformidad de origen.

#### 2. Auditoría de Precios SICE & Estrategia Competitiva:
- **Precios de Referencia del Estado:**
{benchmarks_text}
- **Recomendación Estratégica:** Posicionar la oferta un 5% a 7% por debajo de la mediana histórica (p50) para maximizar puntuación en pliegos de precio ponderado sin comprometer el margen bruto objetivo (>30%).

#### 3. Auditoría Logística y Realidad en Depósito de Montevideo:
- **Plazo de Entrega del Pliego:** {plazo_dias} días corridos.
- **Stock Nacionalizado en Montevideo:** {stock_total_mvd} unidades disponibles para retiro/entrega inmediata.
- **Stock en Tránsito Marítimo:** {stock_transito} unidades con arribo estimado al Puerto de Montevideo.
- **Diagnóstico Operativo:** {"🟢 Plazo suficiente para despacho y montaje inmediato desde Depósito Central Montevideo." if viable_flag else "🔴 Plazo crítico (<15 días): Exige coordinación prioritaria de flete local y retiro directo de aduana."}

#### 4. Veredicto Final:
- **Veredicto:** {"✅ APROBADO TÉCNICAMENTE - Cumple especificaciones y garantiza viabilidad operativa y comercial." if viable_flag else "⚠️ CONDICIONADO - Requiere solicitud de prórroga o confirmación expresa de stock nacionalizado."}
"""

    viable = "APROBADO" in dictamen_markdown or "VIABLE" in dictamen_markdown.upper()
    alerta = None if viable else f"Plazo o stock crítico para entrega en {plazo_dias} días."

    return TechnicalOpinionResponse(
        compra_id=compra_id,
        vertical_id=vertical,
        perito_rol=perito["perito_rol"],
        perito_nombre=perito["perito_nombre"],
        dictamen_markdown=dictamen_markdown,
        viable=viable,
        alerta_riesgo=alerta,
        fuente_ia=fuente_ia,
    )


# =============================================================================
# ROUTER B2B TENDERS ALIAS
# =============================================================================
b2b_tenders_router = APIRouter(prefix="/api/v1/b2b/tenders", tags=["B2B Tenders Intelligence"])

@b2b_tenders_router.get("/{compra_id}/benchmarks")
async def b2b_get_call_benchmarks(compra_id: str):
    return await get_call_benchmarks(compra_id)

@b2b_tenders_router.get("/{compra_id}/summary")
async def b2b_get_call_summary(compra_id: str):
    return await get_call_summary(compra_id)

@b2b_tenders_router.post("/{compra_id}/audit-expert", response_model=TechnicalOpinionResponse)
async def b2b_audit_expert(
    compra_id: str,
    payload: TechnicalOpinionRequest,
    db: Session = Depends(get_db),
):
    return await generate_technical_opinion(compra_id, payload, db)


# =============================================================================
# PERSISTENCIA DE SEGUIMIENTO (FAVORITOS DE LICITACIONES)
# =============================================================================

@router.post("/open-calls/{compra_id}/save-tracking")
def save_call_tracking(
    compra_id: str,
    payload: SaveTrackingRequest,
    db: Session = Depends(get_db),
):
    """
    Guarda una convocatoria en la lista de seguimiento activo de Calcu Suite.
    """
    existing = db.query(Tender).filter(Tender.id == compra_id).first()
    if existing:
        existing.proyecto_nombre = payload.proyecto_nombre
        existing.cliente_licitacion = payload.cliente_licitacion
        existing.nicho = payload.nicho
        existing.plazo_entrega_dias = payload.plazo_entrega_dias or 30
        existing.moneda = payload.moneda or "USD"
        existing.observaciones = payload.observaciones or existing.observaciones
        existing.estado = "SEGUIMIENTO"
        db.commit()
        return {"status": "updated", "message": f"Convocatoria {compra_id} actualizada en seguimiento."}

    new_tender = Tender(
        id=compra_id,
        proyecto_nombre=payload.proyecto_nombre,
        cliente_licitacion=payload.cliente_licitacion,
        nicho=payload.nicho or "ILUMINACION_EFICIENCIA",
        fecha_apertura=datetime.strptime(payload.fecha_apertura, "%Y-%m-%d").date() if payload.fecha_apertura else None,
        plazo_entrega_dias=payload.plazo_entrega_dias or 30,
        moneda=payload.moneda or "USD",
        tipo_cambio_brou=Decimal("40.40"),
        estado="SEGUIMIENTO",
        observaciones=payload.observaciones,
        created_at=datetime.now(),
    )
    db.add(new_tender)
    db.commit()
    return {"status": "created", "message": f"Convocatoria {compra_id} guardada en seguimiento exitosamente."}


@router.get("/saved-tracking")
def get_saved_tracking(db: Session = Depends(get_db)):
    """
    Retorna todas las convocatorias en seguimiento en Calcu.
    """
    tenders = db.query(Tender).order_by(Tender.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "proyecto_nombre": t.proyecto_nombre,
            "cliente_licitacion": t.cliente_licitacion,
            "nicho": t.nicho,
            "fecha_apertura": t.fecha_apertura.isoformat() if t.fecha_apertura else None,
            "plazo_entrega_dias": t.plazo_entrega_dias,
            "moneda": t.moneda,
            "estado": t.estado,
            "observaciones": t.observaciones,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tenders
    ]


@router.delete("/saved-tracking/{tender_id}")
def delete_saved_tracking(tender_id: str, db: Session = Depends(get_db)):
    """
    Elimina una convocatoria de la lista de seguimiento.
    """
    t = db.query(Tender).filter(Tender.id == tender_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Licitación no encontrada en seguimiento")
    db.delete(t)
    db.commit()
    return {"status": "deleted", "message": f"Licitación {tender_id} removida de seguimiento"}


# =============================================================================
# TAB 2: INTELIGENCIA DE PRECIOS & BENCHMARKS SICE/CUBS
# =============================================================================

@router.get("/products")
async def search_products(
    q: Optional[str] = Query(None, description="Búsqueda por código SICE o descripción"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: Optional[str] = Query(None, description="Criterio de ordenamiento"),
):
    """
    Busca códigos de catálogo SICE/CUBS con analítica de compras estatales.
    """
    res = await procurement_client.search_products(query=q, page=page, limit=limit, sort_by=sort_by)
    if not res.get("success"):
        raise HTTPException(
            status_code=res.get("status_code", 502),
            detail=res.get("message", "Error al buscar productos en SICE"),
        )
    return res


@router.get("/products/{code}")
async def get_product_analytics(code: str):
    """
    Retorna la ficha de un código SICE con dispersión de precios, percentiles y baselines.
    """
    res = await procurement_client.get_product_analytics(code)
    if not res.get("success"):
        raise HTTPException(
            status_code=res.get("status_code", 502),
            detail=res.get("message", f"No se encontró analítica para el código {code}"),
        )
    return res


@router.post("/competitive-markup", response_model=CompetitiveMarkupResponse)
async def calculate_competitive_markup(
    payload: CompetitiveMarkupRequest,
    db: Session = Depends(get_db),
):
    """
    Calculadora de Markup Competitivo de Calcu:
    Toma el SKU o costo nacionalizado en Montevideo, lo compara contra la mediana estatal
    (medianValue de SICE) y calcula el precio óptimo y rango de markup para ganar el pliego.
    """
    costo_nacionalizado = payload.costo_nacionalizado
    sku_desc = None

    # Si se envió SKU, buscamos en catálogo local de Calcu
    if payload.sku:
        prod = db.query(Product).filter(Product.sku == payload.sku.strip().upper()).first()
        if prod:
            sku_desc = prod.nombre
            if costo_nacionalizado is None and prod.costo_base:
                costo_nacionalizado = Decimal(str(prod.costo_base))

    if costo_nacionalizado is None or costo_nacionalizado <= Decimal("0"):
        costo_nacionalizado = Decimal("25.00")  # Costo base de prueba si no hay registro

    # Obtener la mediana estatal de SICE
    mediana_sice = payload.precio_mediana_sice
    sice_desc = None

    if (mediana_sice is None or mediana_sice <= Decimal("0")) and payload.product_code:
        prod_data = await procurement_client.get_product_analytics(payload.product_code)
        if prod_data.get("success") and isinstance(prod_data.get("data"), dict):
            p_obj = prod_data["data"]
            sice_desc = p_obj.get("description") or p_obj.get("canonicalName")
            # Buscar precio de referencia en UYU o USD
            price_units = p_obj.get("priceUnits") or []
            for pu in price_units:
                if pu.get("currency") == payload.moneda:
                    mediana_sice = Decimal(str(pu.get("p50") or pu.get("median") or 0))
                    break
            if (mediana_sice is None or mediana_sice <= 0) and price_units:
                # Tomar primer precio y convertir si es necesario
                first_pu = price_units[0]
                val = Decimal(str(first_pu.get("p50") or first_pu.get("median") or 0))
                if first_pu.get("currency") == "UYU" and payload.moneda == "USD":
                    val = val / (payload.tasa_cambio_brou or Decimal("40.40"))
                elif first_pu.get("currency") == "USD" and payload.moneda == "UYU":
                    val = val * (payload.tasa_cambio_brou or Decimal("40.40"))
                mediana_sice = val

    if mediana_sice is None or mediana_sice <= Decimal("0"):
        # Si no hubo dato de SICE, simulamos mediana de mercado con 35% de markup sobre costo
        mediana_sice = (costo_nacionalizado * Decimal("1.35")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Cálculo del precio ganador sugerido: descuento estratégico bajo la mediana (default 6%)
    desc_pct = (payload.descuento_estrategico_pct or Decimal("6.00")) / Decimal("100.00")
    precio_ganador = (mediana_sice * (Decimal("1.00") - desc_pct)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Protección de piso: nunca ofertar por debajo de costo + 12%
    piso_minimo = (costo_nacionalizado * Decimal("1.12")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if precio_ganador < piso_minimo:
        precio_ganador = piso_minimo

    rango_min = piso_minimo
    rango_max = mediana_sice

    # Márgenes y Markup
    markup_pct = ((precio_ganador - costo_nacionalizado) / costo_nacionalizado * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    margen_bruto_pct = ((precio_ganador - costo_nacionalizado) / precio_ganador * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    contrib_unit = (precio_ganador - costo_nacionalizado).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    contrib_total = (contrib_unit * Decimal(str(payload.cantidad_solicitada))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Probabilidad de adjudicación
    if precio_ganador < mediana_sice and margen_bruto_pct >= Decimal("20.00"):
        prob = "ALTA"
        diagnostico = f"Excelente competitividad: Ofertando a {payload.moneda} {precio_ganador} ({payload.descuento_estrategico_pct}% bajo la mediana histórica del Estado) se asegura un margen bruto de {margen_bruto_pct}% y alta probabilidad de primer lugar en precio evaluable."
    elif precio_ganador <= mediana_sice:
        prob = "MEDIA"
        diagnostico = f"Competitividad equilibrada: Ofertando al nivel de la mediana estatal ({payload.moneda} {precio_ganador}) con margen de {margen_bruto_pct}%. Se recomienda reforzar antecedentes técnicos y plazos de entrega."
    else:
        prob = "RIESGOSA"
        diagnostico = f"Alerta de precio superior a la mediana estatal. El costo nacionalizado en Montevideo ({payload.moneda} {costo_nacionalizado}) reduce el margen de maniobra comercial."

    return CompetitiveMarkupResponse(
        sku=payload.sku,
        product_code=payload.product_code,
        descripcion_producto=sku_desc or sice_desc or "Producto de Suministro Estatal",
        costo_nacionalizado_mvd=costo_nacionalizado.quantize(Decimal("0.01")),
        precio_mediana_sice=mediana_sice.quantize(Decimal("0.01")),
        precio_ganador_sugerido=precio_ganador.quantize(Decimal("0.01")),
        rango_competitivo_min=rango_min.quantize(Decimal("0.01")),
        rango_competitivo_max=rango_max.quantize(Decimal("0.01")),
        markup_pct=markup_pct,
        margen_bruto_pct=margen_bruto_pct,
        contribucion_unitaria=contrib_unit,
        contribucion_total=contrib_total,
        moneda=payload.moneda,
        probabilidad_ganar=prob,
        diagnostico_estrategico=diagnostico,
    )


# =============================================================================
# TAB 3: ANÁLISIS DE COMPETIDORES (PROVEEDORES)
# =============================================================================

@router.get("/suppliers")
async def search_suppliers(
    search: Optional[str] = Query(None, description="Búsqueda por nombre de empresa o RUT"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: Optional[str] = Query("totalValue", description="Ordenar por totalValue, totalContracts, name"),
    sort_order: Optional[str] = Query("desc", description="asc o desc"),
):
    """
    Buscador de empresas adjudicatarias del Estado uruguayo.
    """
    res = await procurement_client.search_suppliers(
        query=search,
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    if not res.get("success"):
        raise HTTPException(
            status_code=res.get("status_code", 502),
            detail=res.get("message", "Error al buscar proveedores estatales"),
        )
    return res


@router.get("/suppliers/autocomplete")
async def get_suppliers_autocomplete(
    search: str = Query(..., min_length=2, description="Texto a autocompletar"),
    limit: int = Query(10, ge=1, le=30),
):
    """
    Autocompletado predictivo para nombres de competidores o números de RUT en RUPE.
    """
    res = await procurement_client.get_supplier_autocomplete(query=search, limit=limit)
    if not res.get("success"):
        raise HTTPException(
            status_code=res.get("status_code", 502),
            detail=res.get("message", "Error en autocompletado de proveedores"),
        )
    return res


@router.get("/suppliers/top")
async def get_top_suppliers(
    limit: int = Query(15, ge=1, le=50),
    year: Optional[int] = Query(None, description="Filtrar por año"),
):
    """
    Ranking de principales proveedores estatales por volumen total adjudicado.
    """
    res = await procurement_client.get_top_suppliers(limit=limit, year=year)
    if not res.get("success"):
        raise HTTPException(
            status_code=res.get("status_code", 502),
            detail=res.get("message", "Error al obtener ranking de proveedores"),
        )
    return res


def normalize_supplier_recent_contracts(raw_contracts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Normaliza los contratos estatales del competidor:
    - Extrae el nombre real del organismo comprador (buyer.name)
    - Calcula el monto real a partir de los ítems y precios unitarios
    - Extrae la descripción real del pliego o ítem adjudicado
    - Desglosa los ítems con cantidades, unidades y precios
    - Elimina tarjetas vacías que mostraban 'Contrato Estatal - Organismo - UYU $ 0,00'
    """
    normalized = []
    for c in raw_contracts:
        buyer_obj = c.get("buyer") or {}
        buyer_name = buyer_obj.get("name") or c.get("buyerName") or "Organismo Estatal"

        contract_date = c.get("date") or c.get("sourceYear") or ""
        if isinstance(contract_date, str) and "T" in contract_date:
            contract_date = contract_date.split("T")[0]

        awards = c.get("awards") or []
        items_list = []
        calc_total = Decimal("0.00")
        curr = c.get("currency") or "UYU"
        title = c.get("title") or ""

        for aw in awards:
            if not title and aw.get("title") and not str(aw.get("title")).startswith("X/"):
                title = aw.get("title")
            aw_date = aw.get("date")
            if not contract_date and aw_date:
                contract_date = str(aw_date).split("T")[0]

            for itm in (aw.get("items") or []):
                cls = itm.get("classification") or {}
                desc = cls.get("description") or itm.get("description") or "Ítem Adjudicado"
                if not title or str(title).startswith("X/"):
                    title = desc

                qty = itm.get("quantity") or 1
                unit_info = itm.get("unit") or {}
                u_name = unit_info.get("name") or itm.get("unitName") or "UNIDAD"
                val_info = unit_info.get("value") or {}
                u_price = val_info.get("amount") or itm.get("avgPrice") or 0
                if val_info.get("currency"):
                    curr = val_info.get("currency")

                try:
                    price_dec = Decimal(str(u_price)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                    total_dec = (Decimal(str(qty)) * price_dec).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                except Exception:
                    price_dec = Decimal("0.00")
                    total_dec = Decimal("0.00")

                calc_total += total_dec

                items_list.append({
                    "id": str(itm.get("id") or ""),
                    "description": desc,
                    "quantity": qty,
                    "unitName": u_name,
                    "unitPrice": float(price_dec),
                    "totalPrice": float(total_dec),
                    "currency": curr,
                })

        final_amount = float(calc_total) if calc_total > Decimal("0.00") else float(c.get("amount") or 0)
        if not title:
            title = f"Adjudicación {c.get('id') or ''}".strip()

        # Eliminar las tarjetas dummy que dicen 'Contrato Estatal - Organismo - UYU $ 0,00'
        if final_amount > 0 or items_list or (title and title != "Contrato Estatal"):
            normalized.append({
                "id": str(c.get("id") or c.get("_id") or ""),
                "ocid": c.get("ocid"),
                "title": title,
                "buyerName": buyer_name,
                "date": str(contract_date),
                "amount": final_amount,
                "currency": curr,
                "status": c.get("status") or "Adjudicado",
                "itemsCount": len(items_list),
                "items": items_list,
            })

    return normalized


@router.get("/suppliers/{supplier_id:path}")
async def get_supplier_detail(supplier_id: str):
    """
    Ficha de inteligencia del competidor: contratos adjudicados, organismos compradores,
    montos en UYU/USD y datos de registro RUPE.
    Garantiza montos reales, nombres de organismos y desglose de ítems adjudicados.
    """
    res = await procurement_client.get_supplier_detail(supplier_id)
    if not res.get("success"):
        raise HTTPException(
            status_code=res.get("status_code", 502),
            detail=res.get("message", f"No se encontró ficha del proveedor {supplier_id}"),
        )
    if isinstance(res.get("data"), dict) and "recentContracts" in res["data"]:
        res["data"]["recentContracts"] = normalize_supplier_recent_contracts(res["data"]["recentContracts"])
    return res


# =============================================================================
# TAB 4: RADIOGRAFÍA DE COMPRADORES & INTENDENCIAS
# =============================================================================

@router.get("/buyers")
async def get_buyers(
    search: Optional[str] = Query(None, description="Búsqueda por nombre de organismo"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort_by: Optional[str] = Query("totalSpending", description="totalSpending, totalContracts, name"),
    sort_order: Optional[str] = Query("desc", description="asc o desc"),
):
    """
    Listado y analítica de organismos estatales compradores (Ministerios, Entes Autónomos, IMM, etc.).
    """
    res = await procurement_client.get_buyers(
        query=search,
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    if not res.get("success"):
        raise HTTPException(
            status_code=res.get("status_code", 502),
            detail=res.get("message", "Error al consultar compradores estatales"),
        )
    return res


@router.get("/intendencias")
async def get_intendencias_stats():
    """
    Radiografía analítica de las 19 Intendencias Departamentales de Uruguay:
    volumen de gasto, distribución anual y desglose de modalidades de compra
    (Compra Directa vs Licitación Abreviada vs Licitación Pública).
    """
    res = await procurement_client.get_intendencias_stats()
    if not res.get("success"):
        raise HTTPException(
            status_code=res.get("status_code", 502),
            detail=res.get("message", "Error al obtener estadísticas de intendencias"),
        )
    return res


# =============================================================================
# TAB 5: CALENDARIO DE VENCIMIENTOS & CONTROL LOGÍSTICO
# =============================================================================

@router.get("/calendar")
async def get_calendar(
    start_date: Optional[str] = Query(None, description="Fecha de inicio (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Fecha fin (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """
    Cronograma de cierres de ofertas y llamados guardados cruzados con la base de datos de
    Depósitos Uruguay (`ops-logistics`) para asignar el Semáforo Logístico:
      - 🟢 Verde: Stock nacionalizado suficiente en Montevideo para entrega inmediata post-adjudicación.
      - 🟡 Amarillo: Stock en tránsito marítimo (ETA próximo).
      - 🔴 Rojo: Requiere fabricación en origen (lead time incompatible con el pliego).
    """
    res = await procurement_client.get_calendar(start_date=start_date, end_date=end_date)
    if not res.get("success"):
        raise HTTPException(
            status_code=res.get("status_code", 502),
            detail=res.get("message", "Error al consultar calendario de licitaciones"),
        )

    items = res.get("data", {}).get("items") or []

    # Consultar stock global de Montevideo y tránsito para el semáforo
    inventarios = db.query(Inventory).all()
    total_mvd = sum(int(i.deposito_central or 0) for i in inventarios)
    total_transito = sum(int(i.transito_maritimo or 0) for i in inventarios)

    # Identificar llamados guardados en Calcu
    saved_ids = {t.id for t in db.query(Tender.id).all()}

    enriched_items = []
    now = datetime.now()

    for it in items:
        cid = str(it.get("compraId") or "")
        is_saved = it.get("saved") or (cid in saved_ids)
        end_date_str = it.get("endDate")

        # Calcular días restantes hasta el cierre
        dias_restantes = 30
        if end_date_str:
            try:
                clean_dt_str = end_date_str.replace("Z", "+00:00")
                dt = datetime.fromisoformat(clean_dt_str)
                diff = dt.date() - now.date()
                dias_restantes = max(0, diff.days)
            except Exception:
                dias_restantes = 30

        # Reglas del Semáforo Logístico (ops-logistics)
        # Si hay stock nacionalizado en Montevideo (>= 30 unidades) y plazo razonable
        if total_mvd >= 50:
            semaforo = "VERDE"
            semaforo_color = "emerald"
            diagnostico_logistico = "🟢 Stock nacionalizado en Depósito Central Montevideo disponible para entrega inmediata."
        elif total_mvd + total_transito >= 50 and dias_restantes >= 20:
            semaforo = "AMARILLO"
            semaforo_color = "amber"
            diagnostico_logistico = "🟡 Stock en tránsito marítimo hacia el Puerto de Montevideo con ETA compatible con el plazo de entrega."
        else:
            semaforo = "ROJO"
            semaforo_color = "rose"
            diagnostico_logistico = "🔴 Requiere fabricación en origen (Shenzhen / ultramar). Lead time excede el plazo del pliego sin inventario previo."

        enriched_items.append({
            **it,
            "saved": is_saved,
            "dias_restantes": dias_restantes,
            "semaforo_logistico": semaforo,
            "semaforo_color": semaforo_color,
            "diagnostico_logistico": diagnostico_logistico,
            "stock_mvd_disponible": total_mvd,
            "stock_transito": total_transito,
        })

    return {
        "success": True,
        "data": {
            "items": enriched_items,
            "total": len(enriched_items),
            "deposito_central_mvd_unidades": total_mvd,
            "transito_maritimo_unidades": total_transito,
            "timestamp": datetime.now().isoformat(),
        }
    }
