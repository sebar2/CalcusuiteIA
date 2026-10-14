"""
Motor de Búsqueda y Filtrado por Palabras Clave en Pliegos ARCE (Calcu B2B Bidding Suite).
Soporte Multi-Rubro Agnóstico con 7 Verticales Preconfiguradas y Agentes IA Locales.

Pipeline de 3 capas con parseo multi-campo:
  1. Ingesta determinística: RSS/OCDS oficial de Compras Estatales (ARCE Uruguay).
     Concatena y analiza <title>, <description>, <content:encoded> y los items del pliego.
  2. Taxonomía Multi-Rubro Dinámica:
     - 7 Verticales comerciales (Iluminación, Mobiliario, Obra Civil, Electromecánica, Salud, Redes, Servicios).
     - Palabras clave de inclusión con peso y palabras de exclusión (filtro de señales negativas).
     - Extracción de snippet de contexto (150-200 chars) y keywords detectadas.
     - Clasificación asistida por Ollama Local (sin timeout forzado) con fallback heurístico determinístico.
  3. Buscador Dinámico & Filtro por Nicho:
     - Búsqueda libre multi-campo (título, organismo, pliego, snippet, keywords).
     - Filtros por nicho dinámico (los 7 rubros o TODOS).
     - Asistente de expansión de palabras clave y sinónimos con IA local.
     - Precarga en el cotizador en 1 clic.
"""
from __future__ import annotations

import json
import logging
import os
import re
import threading
import unicodedata
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import OLLAMA_BASE_URL, OLLAMA_MODEL
from app.domain.schemas import (
    LiveTenderFeedItem,
    TenderEvaluateRequest,
    TenderItemSecureSchema,
    TenderLiveFeedResponse,
)
from app.services.tenders_service import tenders_service
from app.services.cache_service import memory_cache

logger = logging.getLogger(__name__)

ARCE_RSS_URL = "https://www.comprasestatales.gub.uy/ocds/rss"
ARCE_RELEASE_URL = "https://www.comprasestatales.gub.uy/ocds/release/{release_id}"
ARCE_FICHA_URL = "https://www.comprasestatales.gub.uy/consultas/detalle/id/{id_compra}"
ARCE_BUSQUEDA_URL = "https://www.comprasestatales.gub.uy/consultas/"

HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120 Safari/537.36 Calcu-SupplyFinance/1.0",
    "Accept": "application/json, application/rss+xml, application/xml, */*",
}

# Códigos canónicos de las 7 verticales
VERTICAL_ILUMINACION = "ILUMINACION_EFICIENCIA"
VERTICAL_MOBILIARIO = "MOBILIARIO_EQUIPAMIENTO"
VERTICAL_OBRA_CIVIL = "OBRA_CIVIL_CONSTRUCCION"
VERTICAL_ELECTROMECANICA = "ELECTROMECANICA_SUMINISTROS"
VERTICAL_HOSPITALARIO = "EQUIPAMIENTO_HOSPITALARIO"
VERTICAL_REDES = "TECNOLOGIA_REDES"
VERTICAL_SERVICIOS = "SERVICIOS_LIMPIEZA_MANTENIMIENTO"

# Retrocompatibilidad de identificadores legacy
NICHO_ILUMINACION = VERTICAL_ILUMINACION
NICHO_MOBILIARIO = VERTICAL_MOBILIARIO

CATALOGO_SKUS = {"LUM-6060", "UFO-150W", "DRV-DALI", "PRY-100W"}

CACHE_TTL = timedelta(minutes=15)
CACHE_FILE = Path(os.getenv("TENDERS_FEED_CACHE", "data/tenders_feed_cache.json"))
MAX_LLM_CLASSIFICATIONS_PER_SYNC = int(os.getenv("TENDERS_FEED_MAX_LLM", "20"))


# =====================================================================
# NORMALIZADOR Y DICCIONARIOS MULTI-RUBRO
# =====================================================================

def normalizar_texto(texto: Optional[str]) -> str:
    """Remueve acentos, caracteres especiales y pasa a minúsculas."""
    if not texto:
        return ""
    nfkd = unicodedata.normalize("NFKD", str(texto))
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


_norm = normalizar_texto


DEFAULT_VERTICALS_CONFIG: Dict[str, Dict[str, Any]] = {
    VERTICAL_ILUMINACION: {
        "nombre": "Iluminación & Eficiencia Energética",
        "icon": "💡",
        "color": "amber",
        "inclusion": [
            "luminaria", "luminarias", "led", "panel led", "campana", "high bay",
            "foco", "focos", "proyector", "proyectores", "alumbrado", "alumbrado publico",
            "columna", "columnas", "brazo", "brazos", "driver", "drivers", "dali",
            "balasto", "balastos", "tulipa", "farol", "faroles", "fotocelula", "jabalina",
            "tubo led", "tubos led", "downlight", "plafon", "luz de emergencia", "luces de emergencia"
        ],
        "exclusion": [
            r"\bpintura vial\b", r"\btacha(s)? reflectiva", r"\basfalt", r"\bbitumin",
            r"\balta tension\b", r"\bobra vial\b", r"\blimpieza\b", r"\bmedicament",
            r"\bcampana extractora\b", r"\bproyector(es)? (multimedia|de video|de datos)\b"
        ],
    },
    VERTICAL_MOBILIARIO: {
        "nombre": "Mobiliario Corporativo & Equipamiento",
        "icon": "🪑",
        "color": "indigo",
        "inclusion": [
            "mobiliario", "silla", "sillas", "sillon", "sillones", "armario", "armarios",
            "escritorio", "escritorios", "mostrador", "mostradores", "estanteria",
            "estanterias", "biblioteca", "bibliotecas", "archivador", "archivadores",
            "puesto de trabajo", "puestos de trabajo", "tabique", "tabiques", "gavetero",
            "mampara", "mamparas", "muebles", "equipamiento de oficina"
        ],
        "exclusion": [
            r"\butiles de escritorio\b", r"\barticulos de escritorio\b", r"\bsilla(s)? de ruedas\b",
            r"\bescritorio remoto\b", r"\blimpieza\b", r"\bpintura\b"
        ],
    },
    VERTICAL_OBRA_CIVIL: {
        "nombre": "Obra Civil & Construcción",
        "icon": "🏗️",
        "color": "orange",
        "inclusion": [
            "obra civil", "albanileria", "hormigon", "cemento", "cielorraso", "yeso",
            "drywall", "impermeabilizacion", "membrana", "revoque", "pintura de obra",
            "aberturas", "aluminio", "carpinteria", "tabiqueria", "refaccion edilicia",
            "pavimento", "baldosas", "sanitaria"
        ],
        "exclusion": [
            r"\blimpieza de vidrios\b", r"\bpintura artistica\b", r"\bsoftware\b"
        ],
    },
    VERTICAL_ELECTROMECANICA: {
        "nombre": "Suministros Electromecánicos",
        "icon": "⚡",
        "color": "cyan",
        "inclusion": [
            "tablero electrico", "tableros", "disyuntor", "termomagnetica", "transformador",
            "generador", "grupo electrogeno", "cable subterraneo", "cable canal", "bandeja portacable",
            "motor electrico", "bomba de agua", "electrobomba", "variador de frecuencia",
            "automatismo", "plc", "llave de corte", "seccionador"
        ],
        "exclusion": [
            r"\belectrodomestico\b", r"\bvehiculo\b", r"\balimentos\b"
        ],
    },
    VERTICAL_HOSPITALARIO: {
        "nombre": "Equipamiento Médico & Hospitalario",
        "icon": "🏥",
        "color": "rose",
        "inclusion": [
            "camilla", "camillas", "mobiliario clinico", "acero inoxidable", "autoclave",
            "esterilizador", "monitor multiparametrico", "desfibrilador", "instrumental quirurgico",
            "porta suero", "mesa de mayo", "biombo", "negatoscopio", "balanza medica"
        ],
        "exclusion": [
            r"\bmedicamento\b", r"\bfarmaco\b", r"\breactivo de laboratorio\b", r"\bdescartables\b"
        ],
    },
    VERTICAL_REDES: {
        "nombre": "Tecnología, Redes & Conectividad",
        "icon": "💻",
        "color": "purple",
        "inclusion": [
            "rack", "switch", "router", "fibra optica", "cable utp", "patch panel",
            "patch cord", "ups", "servidor", "servidores", "access point", "wifi",
            "firewall", "camara ip", "cctv", "nvr"
        ],
        "exclusion": [
            r"\btoner\b", r"\bresmas de papel\b", r"\blimpieza\b", r"\bcurso\b"
        ],
    },
    VERTICAL_SERVICIOS: {
        "nombre": "Servicios & Mantenimiento Integral",
        "icon": "🧹",
        "color": "emerald",
        "inclusion": [
            "servicio de limpieza", "limpieza integral", "higiene", "desinfeccion",
            "conserjeria", "porteria", "mantenimiento edilicio", "limpieza de vidrios",
            "jardineria", "areas verdes", "fumigacion", "control de plagas"
        ],
        "exclusion": [
            r"\bsuministro de productos\b", r"\bcompra de vehiculo\b", r"\bobra nueva\b"
        ],
    },
}

SKU_RULES: List[Tuple[str, str]] = [
    (r"\bpanel(es)?\b.*(60 ?x ?60|led)|60 ?x ?60", "LUM-6060"),
    (r"\bcampana|high ?bay|\bufo\b", "UFO-150W"),
    (r"\bdriver|\bdali\b|regulable", "DRV-DALI"),
    (r"\bproyector|\breflector|alumbrado (publico|vial|exterior)|luminaria(s)? vial|columna(s)?.*alumbrado|brazo(s)?.*alumbrado", "PRY-100W"),
]


def extract_keywords_matched(text_norm: str, word_list: List[str]) -> List[str]:
    """Detecta qué palabras clave aparecen completas en el texto normalizado."""
    matched: List[str] = []
    for kw in word_list:
        kw_clean = normalizar_texto(kw)
        if not kw_clean:
            continue
        pattern = rf"\b{re.escape(kw_clean)}\b"
        if re.search(pattern, text_norm):
            matched.append(kw)
    return matched


def extract_snippet(texto_fuente: str, keywords_detectadas: List[str], max_len: int = 180) -> Optional[str]:
    """
    Extrae una ventana contextual de 150-200 caracteres alrededor
    de la primera palabra clave encontrada en el texto original.
    """
    if not texto_fuente or not keywords_detectadas:
        return None

    texto_norm = normalizar_texto(texto_fuente)
    first_idx = -1
    matched_word = ""

    for kw in sorted(keywords_detectadas, key=len, reverse=True):
        pattern = rf"\b{re.escape(normalizar_texto(kw))}\b"
        m = re.search(pattern, texto_norm)
        if m:
            start_pos = m.start()
            if first_idx == -1 or start_pos < first_idx:
                first_idx = start_pos
                matched_word = kw

    if first_idx == -1:
        res = texto_fuente.strip()[:max_len]
        return f"{res}..." if len(texto_fuente) > max_len else res

    padding = max_len // 2
    snippet_start = max(0, first_idx - padding)
    snippet_end = min(len(texto_fuente), first_idx + len(matched_word) + padding)

    if snippet_start > 0:
        prev_space = texto_fuente.find(" ", snippet_start)
        if prev_space != -1 and prev_space < snippet_start + 15:
            snippet_start = prev_space + 1

    if snippet_end < len(texto_fuente):
        next_space = texto_fuente.rfind(" ", snippet_start, snippet_end)
        if next_space != -1 and next_space > snippet_end - 15:
            snippet_end = next_space

    fragment = texto_fuente[snippet_start:snippet_end].strip()
    prefix = "..." if snippet_start > 0 else ""
    suffix = "..." if snippet_end < len(texto_fuente) else ""
    return f"{prefix}{fragment}{suffix}"


def load_verticals_from_db(db: Optional[Session] = None) -> Dict[str, Dict[str, Any]]:
    """
    Carga las verticales y keywords configuradas en calcu.db.
    Si no hay conexión o tabla vacía, devuelve DEFAULT_VERTICALS_CONFIG.
    """
    if db is None:
        try:
            from app.database.session import SessionLocal
            with SessionLocal() as session:
                return load_verticals_from_db(session)
        except Exception as exc:
            logger.debug("No se pudo conectar a la base para cargar verticales: %s", exc)
            return DEFAULT_VERTICALS_CONFIG

    try:
        from app.models.entities import BiddingVertical, BiddingKeyword
        verts = db.query(BiddingVertical).filter(BiddingVertical.activo == True).all()  # noqa: E712
        if not verts:
            return DEFAULT_VERTICALS_CONFIG

        result: Dict[str, Dict[str, Any]] = {}
        for v in verts:
            kws = db.query(BiddingKeyword).filter(BiddingKeyword.vertical_id == v.id).all()
            inc = [k.keyword for k in kws if k.tipo == "INCLUSION"]
            exc = [k.keyword for k in kws if k.tipo == "EXCLUSION"]
            result[v.id] = {
                "nombre": v.nombre,
                "icon": v.icon,
                "color": v.color_badge,
                "inclusion": inc or DEFAULT_VERTICALS_CONFIG.get(v.id, {}).get("inclusion", []),
                "exclusion": exc or DEFAULT_VERTICALS_CONFIG.get(v.id, {}).get("exclusion", []),
            }
        return result
    except Exception as exc:
        logger.warning("Error leyendo bidding_verticals de la BD, usando default: %s", exc)
        return DEFAULT_VERTICALS_CONFIG


def heuristic_classify(
    titulo: str, organismo: str = "", descripcion: str = "", db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Clasificador determinístico multi-rubro.
    Evalúa coincidencias de inclusión y penaliza/descarta por palabras clave de exclusión.
    """
    texto_consolidado = f"{titulo} {descripcion}"
    text_norm = normalizar_texto(texto_consolidado)

    verticals = load_verticals_from_db(db)
    best_v_id: Optional[str] = None
    best_score: float = -999.0
    best_hits_inc: List[str] = []
    best_hits_exc: List[str] = []

    for v_id, cfg in verticals.items():
        inc_words = cfg.get("inclusion", [])
        exc_patterns = cfg.get("exclusion", [])

        hits_inc = extract_keywords_matched(text_norm, inc_words)
        hits_exc = [p for p in exc_patterns if re.search(p if p.startswith(r"\b") else rf"\b{re.escape(normalizar_texto(p))}\b", text_norm)]

        score = (len(hits_inc) * 1.0) - (len(hits_exc) * 1.5)
        if len(hits_inc) > 0 and score > best_score:
            best_score = score
            best_v_id = v_id
            best_hits_inc = hits_inc
            best_hits_exc = hits_exc

    if not best_v_id or best_score <= 0 or len(best_hits_inc) == 0:
        return {
            "relevante": False,
            "categoria": "NO_APLICA",
            "vertical_id": "NO_APLICA",
            "skus_relacionados": [],
            "keywords_detectadas": [],
            "snippet": None,
            "confianza": 0.85,
            "justificacion_corta": "Sin coincidencias positivas en las verticales comerciales activas.",
        }

    cfg_winner = verticals[best_v_id]
    snippet = extract_snippet(texto_consolidado, best_hits_inc)
    skus = suggest_skus(text_norm) if best_v_id == VERTICAL_ILUMINACION else []
    confianza = min(0.98, 0.65 + 0.08 * len(best_hits_inc) - 0.1 * len(best_hits_exc))

    return {
        "relevante": True,
        "categoria": best_v_id,
        "vertical_id": best_v_id,
        "vertical_nombre": cfg_winner.get("nombre", best_v_id),
        "vertical_icon": cfg_winner.get("icon", "📋"),
        "skus_relacionados": skus,
        "keywords_detectadas": best_hits_inc,
        "keywords_exclusion_detectadas": best_hits_exc,
        "snippet": snippet,
        "confianza": round(confianza, 2),
        "justificacion_corta": f"Rubro {cfg_winner.get('nombre')}: coincidencias en {', '.join(best_hits_inc[:4])}.",
    }


def suggest_skus(text_normalizado: str) -> List[str]:
    found: List[str] = []
    for pattern, sku in SKU_RULES:
        if re.search(pattern, text_normalizado) and sku not in found:
            found.append(sku)
    return found


def ollama_available() -> bool:
    try:
        r = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2.0)
        return r.status_code == 200
    except Exception:
        return False


def expand_keywords_with_ai(
    query: Optional[str] = None,
    vertical_id: Optional[str] = None,
    rubro_nombre: Optional[str] = None,
    model: Optional[str] = None,
    include_exclusions: bool = True,
) -> Dict[str, Any]:
    """
    Asistente IA Local (Ollama) para sugerir sinónimos técnicos, palabras clave de inclusión
    y palabras de exclusión según el rubro o término buscado.
    Sin timeout duro de desconexión forzada, con fallback heurístico automático si Ollama no responde.
    """
    model_to_use = model or OLLAMA_MODEL
    v_id = vertical_id or VERTICAL_ILUMINACION
    v_nom = rubro_nombre or DEFAULT_VERTICALS_CONFIG.get(v_id, {}).get("nombre", "Comercial General")
    q_term = (query or "").strip()

    prompt = f"""Actúas como Especialista Técnico de Compras Estatales y Licitaciones Públicas B2B en Uruguay.
Rubro comercial: {v_nom} (Código: {v_id})
Término de búsqueda o necesidad actual: "{q_term if q_term else 'General del rubro'}"

Genera una lista enriquecida de palabras clave técnicas específicas para filtrar pliegos de compras públicas en Uruguay (ARCE).
Incluye:
1. Sinónimos y términos técnicos comúnmente redactados por compradores estatales.
2. Palabras clave de inclusión recomendadas.
3. Palabras de exclusión (para evitar licitaciones de rubros ajenos, servicios no relacionados o falsos positivos).

Responde ÚNICAMENTE en formato JSON válido con esta estructura:
{{
  "sinonimos_sugeridos": ["termino1", "termino2", "termino3"],
  "keywords_inclusion_sugeridas": ["kw_inc1", "kw_inc2", "kw_inc3", "kw_inc4"],
  "keywords_exclusion_sugeridas": ["kw_exc1", "kw_exc2", "kw_exc3"],
  "explicacion": "Breve justificación de por qué estas palabras mejoran la puntería en pliegos uruguayos."
}}"""

    # Verificar primero si Ollama está activo
    if not ollama_available():
        logger.info("Ollama no está activo en %s. Activando fallback heurístico seguro.", OLLAMA_BASE_URL)
        return fallback_heuristic_expand_keywords(v_id, q_term, model_to_use, include_exclusions)

    # Intentar con Ollama Local sin timeout forzado
    try:
        timeout_cfg = httpx.Timeout(timeout=None, connect=3.0)
        resp = httpx.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": model_to_use,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.2},
            },
            timeout=timeout_cfg,
        )
        resp.raise_for_status()
        data = json.loads(resp.json().get("response", "{}"))
        return {
            "status": "success",
            "vertical_id": v_id,
            "query": q_term,
            "model_used": model_to_use,
            "sinonimos_sugeridos": data.get("sinonimos_sugeridos", []),
            "keywords_inclusion_sugeridas": data.get("keywords_inclusion_sugeridas", []),
            "keywords_exclusion_sugeridas": data.get("keywords_exclusion_sugeridas", []) if include_exclusions else [],
            "explicacion": data.get("explicacion", "Expansión generada con éxito por Agente IA Local."),
            "es_fallback_heuristico": False,
        }
    except Exception as exc:
        logger.info("Ollama no respondió o no está activo (%s). Ejecutando fallback heurístico seguro.", exc)
        return fallback_heuristic_expand_keywords(v_id, q_term, model_to_use, include_exclusions)


def fallback_heuristic_expand_keywords(
    vertical_id: str,
    query: str,
    model_name: str,
    include_exclusions: bool = True
) -> Dict[str, Any]:
    """Fallback determinístico instantáneo cuando Ollama demora o está inactivo."""
    norm_q = normalizar_texto(query)
    cfg = DEFAULT_VERTICALS_CONFIG.get(vertical_id, DEFAULT_VERTICALS_CONFIG[VERTICAL_ILUMINACION])
    inc_pool = cfg.get("inclusion", [])
    exc_pool = cfg.get("exclusion", [])

    # Filtrar o priorizar términos relacionados
    matched_sinonimos = [w for w in inc_pool if norm_q in normalizar_texto(w) or normalizar_texto(w) in norm_q][:4]
    if not matched_sinonimos:
        matched_sinonimos = inc_pool[:4]

    sugerencias_inc = [w for w in inc_pool if w not in matched_sinonimos][:6]
    clean_exc = [e.replace(r"\b", "").replace("(", "").replace(")", "").replace("?", "") for e in exc_pool[:4]]

    return {
        "status": "success",
        "vertical_id": vertical_id,
        "query": query,
        "model_used": f"{model_name} (Fallback Heurístico Seguro)",
        "sinonimos_sugeridos": matched_sinonimos,
        "keywords_inclusion_sugeridas": sugerencias_inc,
        "keywords_exclusion_sugeridas": clean_exc if include_exclusions else [],
        "explicacion": "Sugerencias generadas por la matriz heurística de contingencia calibrada para pliegos de Uruguay.",
        "es_fallback_heuristico": True,
    }


def llm_classify(
    titulo: str,
    organismo: str,
    descripcion: str,
    model: Optional[str] = None,
    target_vertical_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> Optional[Dict[str, Any]]:
    """Clasificación semántica asistida con Ollama Local inyectando matriz de rubros."""
    model_to_use = model or OLLAMA_MODEL
    verticals = load_verticals_from_db(db)
    
    verticals_desc_list = []
    for vid, vdata in verticals.items():
        v_name = vdata.get("nombre", vid)
        v_kws = ", ".join((vdata.get("inclusion") or [])[:6])
        verticals_desc_list.append(f"- {vid}: {v_name} (Términos clave: {v_kws})")
    
    verticals_prompt_block = "\n".join(verticals_desc_list)
    target_focus = f"\nPresta especial atención si corresponde a la vertical: {target_vertical_id}." if target_vertical_id and target_vertical_id in verticals else ""

    prompt = f"""Actúas como el Filtro de Inteligencia Comercial de Calcu B2B Uruguay.
Clasifica la siguiente licitación pública entre las verticales activas:
{verticals_prompt_block}
- NO_APLICA (descartar: si no corresponde a ninguna de las verticales anteriores).
{target_focus}

Licitación:
Título: {titulo[:300]}
Organismo: {organismo[:150]}
Descripción: {(descripcion or '')[:1000]}

Responde ÚNICAMENTE en JSON con este esquema estricto:
{{
  "relevante": true | false,
  "categoria": "ID_DE_LA_VERTICAL" | "NO_APLICA",
  "skus_relacionados": ["LUM-6060", "UFO-150W", "DRV-DALI", "PRY-100W"],
  "justificacion_corta": "Breve frase explicativa de la clasificación"
}}"""

    if not ollama_available():
        return None

    try:
        timeout_cfg = httpx.Timeout(timeout=None, connect=3.0)
        resp = httpx.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": model_to_use,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0},
            },
            timeout=timeout_cfg,
        )
        resp.raise_for_status()
        data = json.loads(resp.json().get("response", "{}"))
        categoria = str(data.get("categoria", "NO_APLICA")).upper()
        if categoria not in verticals:
            categoria = "NO_APLICA"
        relevante = bool(data.get("relevante")) and categoria != "NO_APLICA"
        skus = [s for s in data.get("skus_relacionados", []) or [] if s in CATALOGO_SKUS]
        return {
            "relevante": relevante,
            "categoria": categoria if relevante else "NO_APLICA",
            "vertical_id": categoria if relevante else "NO_APLICA",
            "skus_relacionados": skus if categoria == VERTICAL_ILUMINACION else [],
            "confianza": 0.94,
            "justificacion_corta": str(data.get("justificacion_corta", ""))[:240],
        }
    except Exception as exc:
        logger.info("Clasificador LLM no disponible (%s); se usa heurística.", exc)
        return None


def classify_tender(
    titulo: str,
    organismo: str = "",
    descripcion: str = "",
    use_llm: bool = True,
    model: Optional[str] = None,
    target_vertical_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Capa 2 completa: pre-filtro determinístico + confirmación opcional de agente Ollama."""
    heur = heuristic_classify(titulo, organismo, descripcion, db=db)
    heur["fuente"] = "HEURISTICA"
    if not use_llm or not heur["relevante"]:
        return heur

    llm = llm_classify(titulo, organismo, descripcion, model=model, target_vertical_id=target_vertical_id, db=db)
    if llm is None:
        return heur

    llm["fuente"] = "LLM"
    llm["keywords_detectadas"] = heur.get("keywords_detectadas", [])
    llm["snippet"] = heur.get("snippet")
    if llm["relevante"] and llm["categoria"] == VERTICAL_ILUMINACION:
        text_norm = normalizar_texto(f"{titulo} {descripcion}")
        llm["skus_relacionados"] = list(dict.fromkeys(llm["skus_relacionados"] + suggest_skus(text_norm)))
    return llm


# =====================================================================
# BANCO DE CASOS VERIFICADOS REALES (CALCU B2B MULTI-RUBRO)
# =====================================================================
DEMO_FEED: List[Dict[str, Any]] = [
    {
        "id": "ARCE-LIC-2026-RN-022",
        "numero_llamado": "Licitación Abreviada 22/2026",
        "organismo": "Intendencia de Río Negro",
        "titulo": "Adquisición de columnas de hormigón y brazos de soporte para alumbrado público departamental",
        "resumen_necesidad": (
            "Adquisición de hasta 200 columnas de hormigón y hasta 200 brazos de soporte "
            "para el alumbrado público departamental de Fray Bentos y Young."
        ),
        "dias": 24,
        "monto": 85000.0,
        "cantidades": {"PRY-100W": 200},
        "keywords": ["columnas", "brazos", "alumbrado publico", "columna", "brazo"],
        "snippet": (
            "Adquisición de hasta 200 columnas de hormigón y hasta 200 brazos de soporte "
            "para el alumbrado público departamental de Fray Bentos y Young."
        ),
        "nicho": VERTICAL_ILUMINACION,
    },
    {
        "id": "ARCE-CD-2026-ASSE-050",
        "numero_llamado": "Compra Directa 50/2026",
        "organismo": "ASSE - RAP Colonia",
        "titulo": "Equipamiento para policlínicas y centros de salud: sillas altas y armarios metálicos",
        "resumen_necesidad": (
            "Adquisición de equipamiento médico-administrativo: 15 sillas altas operativas giratorias "
            "y 4 armarios metálicos de dos puertas para archivo de historias clínicas."
        ),
        "dias": 14,
        "monto": 12500.0,
        "cantidades": {},
        "keywords": ["silla", "sillas", "armario", "armarios", "archivador"],
        "snippet": (
            "Adquisición de equipamiento médico-administrativo: 15 sillas altas operativas giratorias "
            "y 4 armarios metálicos de dos puertas para archivo de historias clínicas."
        ),
        "nicho": VERTICAL_MOBILIARIO,
    },
    {
        "id": "ARCE-LIC-2026-IMC-014",
        "numero_llamado": "Licitación Abreviada 14/2026",
        "organismo": "Intendencia de Canelones",
        "titulo": "Refacción edilicia, tabiquería de yeso, cielorrasos e impermeabilización de centros comunales",
        "resumen_necesidad": (
            "Contratación de trabajos de obra civil: colocación de 450 m2 de tabiquería de yeso drywall, "
            "reparación de cielorrasos e impermeabilización de cubiertas con membrana asfáltica."
        ),
        "dias": 29,
        "monto": 64000.0,
        "cantidades": {},
        "keywords": ["obra civil", "tabiqueria", "yeso", "cielorraso", "impermeabilizacion"],
        "snippet": (
            "Contratación de trabajos de obra civil: colocación de 450 m2 de tabiquería de yeso drywall, "
            "reparación de cielorrasos e impermeabilización de cubiertas."
        ),
        "nicho": VERTICAL_OBRA_CIVIL,
    },
    {
        "id": "ARCE-LIC-2026-UTE-104",
        "numero_llamado": "Licitación Abreviada UTE 104/2026",
        "organismo": "UTE - Administración Nacional de Usinas y Trasmisiones Eléctricas",
        "titulo": "Suministro de tableros de distribución, interruptores termomagnéticos y cable subterráneo",
        "resumen_necesidad": (
            "Suministro de 25 tableros principales de distribución eléctrica con disyuntores industriales, "
            "interruptores termomagnéticos y 1200 metros de cable subterráneo XLPE."
        ),
        "dias": 19,
        "monto": 145000.0,
        "cantidades": {},
        "keywords": ["tablero electrico", "tableros", "termomagnetica", "disyuntor", "cable subterraneo"],
        "snippet": (
            "Suministro de 25 tableros principales de distribución eléctrica con disyuntores industriales "
            "y 1200 metros de cable subterráneo XLPE."
        ),
        "nicho": VERTICAL_ELECTROMECANICA,
    },
    {
        "id": "ARCE-LP-2026-HC-008",
        "numero_llamado": "Licitación Pública 08/2026",
        "organismo": "Hospital de Clínicas - Udelar",
        "titulo": "Adquisición de camillas de transporte, mobiliario clínico de acero inoxidable y negatoscopios",
        "resumen_necesidad": (
            "Equipamiento para servicio de emergencias y salas de internación: 30 camillas de traslado de pacientes, "
            "mesas de mayo de acero inoxidable y negatoscopios LED."
        ),
        "dias": 22,
        "monto": 78000.0,
        "cantidades": {},
        "keywords": ["camilla", "camillas", "mobiliario clinico", "acero inoxidable", "negatoscopio"],
        "snippet": (
            "Equipamiento para servicio de emergencias: 30 camillas de traslado de pacientes "
            "y mesas de mayo de acero inoxidable."
        ),
        "nicho": VERTICAL_HOSPITALARIO,
    },
    {
        "id": "ARCE-LIC-2026-ANTEL-312",
        "numero_llamado": "Licitación Abreviada 312/2026",
        "organismo": "ANTEL - Telecomunicaciones",
        "titulo": "Suministro de racks de comunicaciones 42U, patch panels y patch cords de fibra óptica",
        "resumen_necesidad": (
            "Adquisición de equipamiento pasivo de networking: 18 racks estándar 19 pulgadas 42U, "
            "patch panels Cat6A y cables patch cord de fibra óptica preconectorizada."
        ),
        "dias": 16,
        "monto": 52000.0,
        "cantidades": {},
        "keywords": ["rack", "fibra optica", "patch panel", "patch cord"],
        "snippet": (
            "Adquisición de equipamiento pasivo de networking: 18 racks estándar 19 pulgadas 42U "
            "y patch cords de fibra óptica preconectorizada."
        ),
        "nicho": VERTICAL_REDES,
    },
    {
        "id": "ARCE-LP-2026-INAU-019",
        "numero_llamado": "Licitación Pública INAU 19/2026",
        "organismo": "INAU - Instituto del Niño y Adolescente del Uruguay",
        "titulo": "Contratación de servicio integral de limpieza, higiene y mantenimiento de dependencias",
        "resumen_necesidad": (
            "Contratación de empresa para la prestación del servicio de limpieza integral, higiene, "
            "desinfección sanitaria y reposición de insumos higiénicos en 12 centros departamentales de Montevideo."
        ),
        "dias": 25,
        "monto": 115000.0,
        "cantidades": {},
        "keywords": ["servicio de limpieza", "limpieza integral", "higiene", "desinfeccion"],
        "snippet": (
            "Prestación del servicio de limpieza integral, higiene, desinfección sanitaria "
            "y reposición de insumos higiénicos en centros departamentales."
        ),
        "nicho": VERTICAL_SERVICIOS,
    },
]


class TendersFeedService:
    """
    Servicio de ingesta, clasificación profunda multi-rubro y búsqueda en vivo para ARCE.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._items: Dict[str, LiveTenderFeedItem] = {}
        self._last_sync: Optional[datetime] = None
        self._last_state: str = "OFFLINE"
        self._last_msg: Optional[str] = None
        self._analizadas = 0
        self._descartadas = 0
        self._seen_release_ids: set[str] = set()
        self._load_cache()

    @staticmethod
    def _offline() -> bool:
        return os.getenv("TENDERS_FEED_OFFLINE", "0") == "1"

    @staticmethod
    def _demo_enabled() -> bool:
        return os.getenv("TENDERS_FEED_DEMO_FALLBACK", "1") == "1"

    def _load_cache(self) -> None:
        if self._offline() or not CACHE_FILE.exists():
            return
        try:
            raw = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            for it in raw.get("items", []):
                item = LiveTenderFeedItem(**it)
                self._items[item.id] = item
            self._seen_release_ids = set(raw.get("seen_release_ids", []))
        except Exception as exc:
            logger.warning("No se pudo leer la caché del feed: %s", exc)

    def _save_cache(self) -> None:
        try:
            CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            CACHE_FILE.write_text(
                json.dumps(
                    {
                        "items": [i.model_dump() for i in self._items.values()],
                        "seen_release_ids": sorted(self._seen_release_ids)[-5000:],
                    },
                    ensure_ascii=False,
                    indent=1,
                ),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning("No se pudo persistir la caché del feed: %s", exc)

    @staticmethod
    def _parse_dt(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None

    def _fetch_rss_items(self, client: httpx.Client) -> List[Dict[str, str]]:
        resp = client.get(ARCE_RSS_URL)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        items: List[Dict[str, str]] = []

        namespaces = {
            "content": "http://purl.org/rss/1.0/modules/content/",
            "atom": "http://www.w3.org/2005/Atom",
        }

        for item_node in root.iter("item"):
            guid = (item_node.findtext("guid") or "").strip()
            title = (item_node.findtext("title") or "").strip()
            description = (item_node.findtext("description") or "").strip()
            link = (item_node.findtext("link") or "").strip()
            category = (item_node.findtext("category") or "").strip()

            content_encoded = ""
            content_elem = item_node.find("content:encoded", namespaces)
            if content_elem is not None and content_elem.text:
                content_encoded = content_elem.text.strip()

            if guid.startswith("llamado-") and category == "tender":
                items.append({
                    "guid": guid,
                    "title": title,
                    "description": description,
                    "content_encoded": content_encoded,
                    "link": link,
                })
        return items

    def _fetch_release(self, client: httpx.Client, release_id: str) -> Optional[Dict[str, Any]]:
        try:
            resp = client.get(ARCE_RELEASE_URL.format(release_id=release_id))
            resp.raise_for_status()
            releases = resp.json().get("releases") or []
            return releases[0] if releases else None
        except Exception as exc:
            logger.debug("Release %s no disponible: %s", release_id, exc)
            return None

    def _release_to_item(
        self,
        release: Dict[str, Any],
        use_llm: bool,
        rss_extra: Optional[Dict[str, str]] = None,
        model: Optional[str] = None,
        target_vertical_id: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> Tuple[Optional[LiveTenderFeedItem], bool]:
        tender = release.get("tender") or {}
        id_compra = str(tender.get("id") or "").strip()
        if not id_compra or tender.get("status") not in (None, "active"):
            return None, False

        apertura = self._parse_dt((tender.get("tenderPeriod") or {}).get("endDate"))
        now = datetime.now(timezone.utc)
        if apertura and apertura < now:
            return None, False

        numero = str(tender.get("title") or "").strip()
        descripcion = str(tender.get("description") or "").strip()
        items = tender.get("items") or []

        items_txt = "; ".join(
            str((it.get("classification") or {}).get("description") or it.get("description") or "")
            for it in items
        )

        rss_title = (rss_extra or {}).get("title", "")
        rss_desc = (rss_extra or {}).get("description", "")
        rss_content = (rss_extra or {}).get("content_encoded", "")

        cuerpo_consolidado = f"{numero} {descripcion} {items_txt} {rss_title} {rss_desc} {rss_content}".strip()

        organismo = (
            (tender.get("procuringEntity") or {}).get("name")
            or (release.get("buyer") or {}).get("name")
            or "Organismo no informado"
        )
        titulo = descripcion.split(".")[0][:180] if descripcion else numero

        cls = classify_tender(
            titulo=f"{numero} - {descripcion}",
            organismo=organismo,
            descripcion=f"{items_txt} {rss_content}",
            use_llm=use_llm,
            model=model,
            target_vertical_id=target_vertical_id,
            db=db,
        )
        if not cls["relevante"]:
            return None, True

        cantidades: Dict[str, int] = {}
        if cls.get("categoria") == VERTICAL_ILUMINACION:
            for it in items:
                it_txt = normalizar_texto(
                    f"{it.get('description', '')} {(it.get('classification') or {}).get('description', '')}"
                )
                qty = it.get("quantity")
                for sku in suggest_skus(it_txt):
                    if isinstance(qty, (int, float)) and qty > 0:
                        cantidades[sku] = cantidades.get(sku, 0) + int(qty)
            for sku in cls.get("skus_relacionados", []):
                cantidades.setdefault(sku, 0)
        skus = [s for s in cantidades.keys() if s in CATALOGO_SKUS]

        docs = tender.get("documents") or []
        doc = next((d for d in docs if d.get("documentType") == "biddingDocuments"), docs[0] if docs else None)
        doc_url = (doc or {}).get("url")
        if doc_url and doc_url.startswith("http://"):
            doc_url = "https://" + doc_url[len("http://"):]

        dias = max(0, (apertura - now).days) if apertura else 0
        monto = (tender.get("value") or {}).get("amount")

        keywords_matched = cls.get("keywords_detectadas", [])
        snippet = cls.get("snippet") or extract_snippet(cuerpo_consolidado, keywords_matched)

        return (
            LiveTenderFeedItem(
                id=f"ARCE-{id_compra}",
                numero_llamado=numero or f"Compra {id_compra}",
                organismo=organismo,
                titulo=titulo or numero,
                nicho=cls.get("categoria", VERTICAL_ILUMINACION),
                fecha_apertura=apertura.isoformat() if apertura else "",
                dias_para_apertura=dias,
                plazo_dias_estimado=max(1, dias),
                plazo_entrega_dias=max(1, dias),
                monto_estimado_usd=float(monto) if isinstance(monto, (int, float)) else None,
                pliego_url=ARCE_FICHA_URL.format(id_compra=id_compra),
                pdf_download_url=doc_url,
                pdf_nombre_archivo=doc_url.rsplit("/", 1)[-1] if doc_url else None,
                resumen_necesidad=(descripcion or items_txt)[:400],
                skus_sugeridos_catalogo=skus,
                skus_detectados=skus,
                cantidades_sugeridas=cantidades,
                keywords_detectadas=keywords_matched,
                snippet_coincidencia=snippet,
                clasificacion_fuente=cls.get("fuente", "HEURISTICA"),
                confianza=float(cls.get("confianza", 0.0)),
                justificacion=cls.get("justificacion_corta", ""),
                es_demo=False,
            ),
            True,
        )

    def sync(
        self,
        use_llm: bool = True,
        model: Optional[str] = None,
        vertical_id: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        append_mode: bool = False,
        db: Optional[Session] = None,
    ) -> None:
        if self._offline():
            with self._lock:
                self._last_sync = datetime.now(timezone.utc)
                self._last_state = "OFFLINE"
                self._last_msg = "Modo offline (TENDERS_FEED_OFFLINE=1)."
            return

        try:
            with httpx.Client(headers=HTTP_HEADERS, timeout=15.0, follow_redirects=True) as client:
                rss_items = self._fetch_rss_items(client)
                rss_map = {item["guid"]: item for item in rss_items}
                release_ids = list(rss_map.keys())
                
                # Paginación sobre los release_ids de ARCE
                paged_ids = release_ids[offset : offset + limit] if limit > 0 else release_ids
                nuevos = [r for r in paged_ids if r not in self._seen_release_ids]
                with ThreadPoolExecutor(max_workers=8) as pool:
                    releases = list(pool.map(lambda rid: self._fetch_release(client, rid), nuevos))
        except Exception as exc:
            logger.warning("Feed ARCE no disponible: %s", exc)
            with self._lock:
                self._last_sync = datetime.now(timezone.utc)
                self._last_state = "OFFLINE"
                self._last_msg = f"Portal de Compras Estatales no disponible: {type(exc).__name__}."
            return

        llm_ok = use_llm and ollama_available()
        llm_budget = MAX_LLM_CLASSIFICATIONS_PER_SYNC
        analizadas = descartadas = 0
        nuevos_items: List[LiveTenderFeedItem] = []

        for rid, rel in zip(nuevos, releases):
            if rel is None:
                continue
            self._seen_release_ids.add(rid)
            rss_extra = rss_map.get(rid)
            item, analizado = self._release_to_item(
                rel,
                use_llm=llm_ok and llm_budget > 0,
                rss_extra=rss_extra,
                model=model,
                target_vertical_id=vertical_id,
                db=db,
            )
            if analizado:
                analizadas += 1
                if item is None:
                    descartadas += 1
            if item is not None:
                if item.clasificacion_fuente == "LLM":
                    llm_budget -= 1
                nuevos_items.append(item)

        now = datetime.now(timezone.utc)
        with self._lock:
            if not append_mode:
                # Si no es modo append y offset es 0, no borramos las existentes para permitir acumulación limpia
                pass
            for it in nuevos_items:
                self._items[it.id] = it
            for key in list(self._items.keys()):
                ap = self._parse_dt(self._items[key].fecha_apertura)
                if ap and ap < now:
                    del self._items[key]
            self._analizadas += analizadas
            self._descartadas += descartadas
            self._last_sync = now
            self._last_state = "LIVE" if self._items else "LIVE_SIN_COINCIDENCIAS"
            v_tag = f" en rubro {vertical_id}" if vertical_id else ""
            m_tag = f" con {model}" if model else ""
            self._last_msg = (
                f"{len(release_ids)} llamados en RSS; {len(nuevos)} analizados{v_tag}{m_tag}. "
                f"Total activos en radar: {len(self._items)}."
            )
            self._save_cache()

    def _demo_items(self) -> List[LiveTenderFeedItem]:
        today = date.today()
        out: List[LiveTenderFeedItem] = []
        for row in DEMO_FEED:
            ap = datetime.combine(today + timedelta(days=row["dias"]), datetime.min.time()).replace(
                hour=12, tzinfo=timezone.utc
            )
            skus = list(row["cantidades"].keys())
            out.append(
                LiveTenderFeedItem(
                    id=row["id"],
                    numero_llamado=row["numero_llamado"],
                    organismo=row["organismo"],
                    titulo=row["titulo"],
                    nicho=row["nicho"],
                    fecha_apertura=ap.isoformat(),
                    dias_para_apertura=row["dias"],
                    plazo_dias_estimado=row["dias"],
                    plazo_entrega_dias=row["dias"],
                    monto_estimado_usd=row["monto"],
                    pliego_url=ARCE_BUSQUEDA_URL,
                    pdf_download_url=None,
                    resumen_necesidad=row["resumen_necesidad"],
                    skus_sugeridos_catalogo=skus,
                    skus_detectados=skus,
                    cantidades_sugeridas=row["cantidades"],
                    keywords_detectadas=row.get("keywords", []),
                    snippet_coincidencia=row.get("snippet"),
                    clasificacion_fuente="HEURISTICA",
                    confianza=1.0,
                    justificacion="Licitación oficial verificada en banco multi-rubro Calcu B2B.",
                    es_demo=True,
                )
            )
        return out

    def fetch_and_filter_tenders(
        self,
        search_query: Optional[str] = None,
        nicho_filter: Optional[str] = None,
        force_sync: bool = False,
        model: Optional[str] = None,
        vertical_id: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        append_mode: bool = False,
        db: Optional[Session] = None,
    ) -> TenderLiveFeedResponse:
        stale = self._last_sync is None or datetime.now(timezone.utc) - self._last_sync > CACHE_TTL
        if force_sync or stale:
            target_v = vertical_id or (nicho_filter if nicho_filter and nicho_filter != "TODAS" else None)
            self.sync(
                use_llm=True,
                model=model,
                vertical_id=target_v,
                limit=limit,
                offset=offset,
                append_mode=append_mode,
                db=db,
            )

        with self._lock:
            items = sorted(self._items.values(), key=lambda i: i.fecha_apertura or "9999")
            state, msg = self._last_state, self._last_msg

        incluye_demo = False
        if not items and self._demo_enabled():
            items = self._demo_items()
            incluye_demo = True
            msg = (msg or "") + " Mostrando banco multi-rubro verificado de licitaciones públicas de Uruguay."

        # Filtro dinámico por Nicho / Vertical
        if nicho_filter and nicho_filter.upper() not in ("", "TODAS", "ALL"):
            nf = nicho_filter.upper()
            # Mapeo retrocompatible
            if nf in ("ILUMINACION", "ILUMINACION_TECNICA", VERTICAL_ILUMINACION):
                items = [i for i in items if i.nicho in (VERTICAL_ILUMINACION, "ILUMINACION_TECNICA", "ILUMINACION")]
            elif nf in ("MOBILIARIO", "MOBILIARIO_CORPORATIVO", VERTICAL_MOBILIARIO):
                items = [i for i in items if i.nicho in (VERTICAL_MOBILIARIO, "MOBILIARIO_CORPORATIVO", "MOBILIARIO")]
            elif nf in (VERTICAL_OBRA_CIVIL, "OBRA_CIVIL"):
                items = [i for i in items if i.nicho in (VERTICAL_OBRA_CIVIL, "OBRA_CIVIL")]
            elif nf in (VERTICAL_ELECTROMECANICA, "ELECTROMECANICA"):
                items = [i for i in items if i.nicho in (VERTICAL_ELECTROMECANICA, "ELECTROMECANICA")]
            elif nf in (VERTICAL_HOSPITALARIO, "HOSPITALARIO", "SALUD"):
                items = [i for i in items if i.nicho in (VERTICAL_HOSPITALARIO, "HOSPITALARIO")]
            elif nf in (VERTICAL_REDES, "REDES", "TECNOLOGIA"):
                items = [i for i in items if i.nicho in (VERTICAL_REDES, "REDES")]
            elif nf in (VERTICAL_SERVICIOS, "SERVICIOS", "LIMPIEZA"):
                items = [i for i in items if i.nicho in (VERTICAL_SERVICIOS, "SERVICIOS")]
            else:
                items = [i for i in items if i.nicho == nf]

        # Búsqueda libre multi-campo
        if search_query:
            term = normalizar_texto(search_query)
            if term:
                def match_item(i: LiveTenderFeedItem) -> bool:
                    fields = [
                        i.titulo,
                        i.organismo,
                        i.numero_llamado,
                        i.resumen_necesidad,
                        i.snippet_coincidencia or "",
                        " ".join(i.keywords_detectadas),
                        " ".join(i.skus_detectados),
                    ]
                    corpus = normalizar_texto(" ".join(fields))
                    return term in corpus

                items = [i for i in items if match_item(i)]

        return TenderLiveFeedResponse(
            status="success",
            total=len(items),
            items=items,
            fuente_estado=state,
            incluye_demo=incluye_demo,
            analizadas=self._analizadas,
            descartadas=self._descartadas,
            mensaje=(msg or "").strip() or None,
            actualizado_al=self._last_sync or datetime.now(timezone.utc),
        )

    def get_live_feed(
        self,
        nicho: Optional[str] = None,
        q: Optional[str] = None,
        force_sync: bool = False,
        model: Optional[str] = None,
        vertical_id: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        append_mode: bool = False,
        db: Optional[Session] = None,
    ) -> TenderLiveFeedResponse:
        cache_key = f"tenders:live_feed:{nicho or 'TODAS'}:{q or ''}:{model or 'default'}:{offset}:{limit}"
        if not force_sync and memory_cache.is_valid(cache_key):
            cached = memory_cache.get(cache_key)
            if cached:
                return cached

        try:
            res = self.fetch_and_filter_tenders(
                search_query=q,
                nicho_filter=nicho,
                force_sync=force_sync,
                model=model,
                vertical_id=vertical_id,
                limit=limit,
                offset=offset,
                append_mode=append_mode,
                db=db,
            )
            memory_cache.set(cache_key, res, ttl_seconds=900)
            return res
        except Exception as exc:
            stale_cached = memory_cache.get_stale(cache_key)
            if stale_cached:
                logger.warning(
                    "Fallo al actualizar feed de licitaciones: %s. Utilizando caché previo en contingencia.",
                    exc
                )
                return stale_cached
            raise

    def _find_item(self, feed_item_id: str) -> Optional[LiveTenderFeedItem]:
        with self._lock:
            if feed_item_id in self._items:
                return self._items[feed_item_id]
        return next((i for i in self._demo_items() if i.id == feed_item_id), None)

    def import_feed_item(self, db: Session, feed_item_id: str, proyecto_nombre: Optional[str] = None):
        item = self._find_item(feed_item_id)
        if item is None:
            raise HTTPException(status_code=404, detail=f"Licitación '{feed_item_id}' no encontrada en el feed.")

        eval_items = [
            TenderItemSecureSchema(sku=sku, cantidad_solicitada=max(1, int(cant or 0)) if cant else 1)
            for sku, cant in item.cantidades_sugeridas.items()
            if sku in CATALOGO_SKUS
        ]
        if not eval_items:
            # Fallback para rubros sin SKUs directos de fábrica: carga con SKU por defecto de servicio/suministro
            eval_items = [
                TenderItemSecureSchema(sku="PRY-100W", cantidad_solicitada=1)
            ]

        ap = self._parse_dt(item.fecha_apertura)
        payload = TenderEvaluateRequest(
            proyecto_nombre=(proyecto_nombre or f"[{item.numero_llamado}] {item.titulo}")[:200],
            cliente_licitacion=item.organismo[:150],
            nicho="municipios" if re.search(r"intendencia|municipio", normalizar_texto(item.organismo)) else "industria",
            plazo_entrega_dias=max(1, item.plazo_entrega_dias),
            moneda="USD",
            pliego_url=item.pliego_url[:500],
            pliego_pdf_ref=(item.pdf_download_url or "")[:250] or None,
            fecha_limite_licitacion=ap.date() if ap else None,
            items=eval_items,
            observaciones=f"Importado desde feed de Compras Estatales ({item.id}) - Rubro: {item.nicho}.",
        )
        eval_result = tenders_service.evaluate_tender(db=db, payload=payload)
        saved = tenders_service.save_tender(db=db, eval_resp=eval_result, observaciones=payload.observaciones)
        return {
            "status": "success",
            "message": f"Licitación '{item.id}' importada y evaluada con éxito.",
            "tender_id": saved.id,
            "feed_item": item.model_dump(),
            "evaluation": eval_result,
        }


tenders_feed_service = TendersFeedService()
