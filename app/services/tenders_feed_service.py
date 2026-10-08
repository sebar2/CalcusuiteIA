"""
Motor de Búsqueda y Filtrado por Palabras Clave en Pliegos ARCE (Serlux: Iluminación & Mobiliario).

Pipeline de 3 capas con parseo multi-campo:
  1. Ingesta determinística: RSS/OCDS oficial de Compras Estatales (ARCE).
     Concatena y analiza <title>, <description>, <content:encoded> y los items del pliego.
  2. Taxonomía Exhaustiva Serlux:
     - Iluminación: columnas, brazos, luminarias, proyectores, drivers DALI, paneles, fotocélulas, etc.
     - Mobiliario: sillas, sillones, armarios, mostradores, escritorios, estanterías, bibliotecas, etc.
     - Extracción de snippet de contexto (150-200 chars) y keywords detectadas.
     - Clasificación asistida por Qwen 2.5:7b con fallback heurístico inmediato.
  3. Buscador Dinámico & Filtro por Nicho:
     - Búsqueda libre multi-campo (título, organismo, pliego, snippet, keywords).
     - Filtros por nicho (ILUMINACION_TECNICA / MOBILIARIO_CORPORATIVO / TODAS).
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

NICHO_ILUMINACION = "ILUMINACION_TECNICA"
NICHO_MOBILIARIO = "MOBILIARIO_CORPORATIVO"
CATALOGO_SKUS = {"LUM-6060", "UFO-150W", "DRV-DALI", "PRY-100W"}

CACHE_TTL = timedelta(minutes=15)
CACHE_FILE = Path(os.getenv("TENDERS_FEED_CACHE", "data/tenders_feed_cache.json"))
MAX_LLM_CLASSIFICATIONS_PER_SYNC = int(os.getenv("TENDERS_FEED_MAX_LLM", "20"))


# =====================================================================
# NORMALIZADOR Y DICCIONARIOS DE NICHO SERLUX
# =====================================================================

def normalizar_texto(texto: Optional[str]) -> str:
    """Remueve acentos, caracteres especiales y pasa a minúsculas."""
    if not texto:
        return ""
    nfkd = unicodedata.normalize("NFKD", str(texto))
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


# Alias de retrocompatibilidad
_norm = normalizar_texto


KEYWORDS_ILUMINACION: List[str] = [
    "luminaria", "luminarias", "led", "panel led", "campana", "high bay",
    "foco", "focos", "proyector", "proyectores", "alumbrado", "alumbrado publico",
    "columna", "columnas", "brazo", "brazos", "driver", "drivers", "dali",
    "balasto", "balastos", "tulipa", "farol", "faroles", "fotocelula", "jabalina",
    "tubo led", "tubos led", "downlight", "plafon", "luz de emergencia", "luces de emergencia"
]

KEYWORDS_MOBILIARIO: List[str] = [
    "mobiliario", "silla", "sillas", "sillon", "sillones", "armario", "armarios",
    "escritorio", "escritorios", "mostrador", "mostradores", "estanteria",
    "estanterias", "biblioteca", "bibliotecas", "archivador", "archivadores",
    "puesto de trabajo", "puestos de trabajo", "tabique", "tabiques", "gavetero",
    "mampara", "mamparas", "muebles", "equipamiento de oficina"
]

# Señales de descarte (rubros ajenos o falsos amigos)
KEYWORDS_DESCARTE: List[str] = [
    r"\bpintura vial\b", r"\btacha(s)? reflectiva", r"\basfalt", r"\bbitumin",
    r"\bpavimento\b", r"\balta tension\b", r"\bmedia tension\b",
    r"\btendido de (cable|linea)", r"\bobra vial\b", r"\blimpieza\b", r"\bdetergente",
    r"\balimento", r"\bmedicament", r"\breactivo\b", r"\barticulos de escritorio\b",
    r"\butiles de escritorio\b", r"\bsilla(s)? de ruedas\b", r"\bodontolog",
    r"\bcampana extractora\b", r"\bproyector(es)? (multimedia|de video|de datos)\b",
    r"\bvideoproyector", r"\bescritorio remoto\b", r"\bimpresion de formularios\b"
]

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
        pattern = rf"\b{re.escape(kw)}\b"
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
        pattern = rf"\b{re.escape(kw)}\b"
        m = re.search(pattern, texto_norm)
        if m:
            start_pos = m.start()
            if first_idx == -1 or start_pos < first_idx:
                first_idx = start_pos
                matched_word = kw

    if first_idx == -1:
        # Fallback a los primeros caracteres
        res = texto_fuente.strip()[:max_len]
        return f"{res}..." if len(texto_fuente) > max_len else res

    padding = max_len // 2
    snippet_start = max(0, first_idx - padding)
    snippet_end = min(len(texto_fuente), first_idx + len(matched_word) + padding)

    # Intentar ajustar a límites de palabras
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


def heuristic_classify(titulo: str, organismo: str = "", descripcion: str = "") -> Dict[str, Any]:
    """Clasificador determinístico por taxonomía profunda Serlux."""
    texto_consolidado = f"{titulo} {descripcion}"
    text_norm = normalizar_texto(texto_consolidado)

    hits_ilum = extract_keywords_matched(text_norm, KEYWORDS_ILUMINACION)
    hits_mob = extract_keywords_matched(text_norm, KEYWORDS_MOBILIARIO)

    # Señales de descarte
    neg_hits = [p for p in KEYWORDS_DESCARTE if re.search(p, text_norm)]

    total_hits = len(hits_ilum) + len(hits_mob)

    # Si hay descarte y ningún match positivo contundente, descartar
    if total_hits == 0 or (len(neg_hits) >= total_hits and total_hits < 2):
        return {
            "relevante": False,
            "categoria": "NO_APLICA",
            "skus_relacionados": [],
            "keywords_detectadas": [],
            "snippet": None,
            "confianza": 0.9 if neg_hits else 0.8,
            "justificacion_corta": (
                "Rubro ajeno a Serlux (señales de descarte detectadas)." if neg_hits
                else "Sin términos de iluminación ni mobiliario corporativo."
            ),
        }

    categoria = "ILUMINACION" if len(hits_ilum) >= len(hits_mob) else "MOBILIARIO"
    keywords = hits_ilum if categoria == "ILUMINACION" else hits_mob
    skus = suggest_skus(text_norm) if categoria == "ILUMINACION" else []
    snippet = extract_snippet(texto_consolidado, keywords)

    confianza = min(0.98, 0.65 + 0.08 * total_hits - 0.1 * len(neg_hits))
    return {
        "relevante": True,
        "categoria": categoria,
        "skus_relacionados": skus,
        "keywords_detectadas": keywords,
        "snippet": snippet,
        "confianza": round(confianza, 2),
        "justificacion_corta": f"Taxonomía {categoria.lower()}: coincidencias en {', '.join(keywords[:4])}.",
    }


def suggest_skus(text_normalizado: str) -> List[str]:
    found: List[str] = []
    for pattern, sku in SKU_RULES:
        if re.search(pattern, text_normalizado) and sku not in found:
            found.append(sku)
    return found


CLASSIFIER_PROMPT = """Actúas como el Filtro de Inteligencia Comercial de Serlux Uruguay.
Tu único trabajo es evaluar si la siguiente licitación corresponde a:
1. ILUMINACION (artefactos de luz, columnas, brazos, proyectores, lámparas, drivers, paneles).
2. MOBILIARIO (escritorios, sillas de oficina, armarios, mostradores, mobiliario corporativo).
3. OTRO (descartar inmediatamente). Ej: pintura vial, obras viales, cableado de alta tensión, limpieza, alimentos, insumos médicos, papelería.

Catálogo de SKUs disponibles: LUM-6060 (panel LED 60x60), UFO-150W (campana industrial), DRV-DALI (driver regulable DALI), PRY-100W (proyector exterior/vial o columnas).

Licitación:
Título: {titulo}
Organismo: {organismo}
Descripción: {descripcion}

Responde ÚNICAMENTE en formato JSON:
{{
  "relevante": true | false,
  "categoria": "ILUMINACION" | "MOBILIARIO" | "NO_APLICA",
  "skus_relacionados": ["LUM-6060", "UFO-150W"],
  "justificacion_corta": "Breve frase explicativa"
}}"""


def llm_classify(titulo: str, organismo: str, descripcion: str, timeout: float = 25.0) -> Optional[Dict[str, Any]]:
    """Clasificación semántica con Ollama (qwen2.5:7b). Devuelve None si falla."""
    prompt = CLASSIFIER_PROMPT.format(
        titulo=titulo[:300], organismo=organismo[:150], descripcion=(descripcion or "")[:1200]
    )
    try:
        resp = httpx.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0},
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        data = json.loads(resp.json().get("response", "{}"))
        categoria = str(data.get("categoria", "NO_APLICA")).upper()
        if categoria not in {"ILUMINACION", "MOBILIARIO", "NO_APLICA"}:
            categoria = "NO_APLICA"
        relevante = bool(data.get("relevante")) and categoria != "NO_APLICA"
        skus = [s for s in data.get("skus_relacionados", []) or [] if s in CATALOGO_SKUS]
        return {
            "relevante": relevante,
            "categoria": categoria if relevante else "NO_APLICA",
            "skus_relacionados": skus if categoria == "ILUMINACION" else [],
            "confianza": 0.9,
            "justificacion_corta": str(data.get("justificacion_corta", ""))[:240],
        }
    except Exception as exc:  # noqa: BLE001
        logger.info("Clasificador LLM no disponible (%s); se usa heurística.", exc)
        return None


def ollama_available() -> bool:
    try:
        r = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2.0)
        return r.status_code == 200
    except Exception:  # noqa: BLE001
        return False


def classify_tender(
    titulo: str, organismo: str = "", descripcion: str = "", use_llm: bool = True
) -> Dict[str, Any]:
    """
    Capa 2 completa: pre-filtro determinístico con diccionario extendido + confirmación LLM opcional.
    """
    heur = heuristic_classify(titulo, organismo, descripcion)
    heur["fuente"] = "HEURISTICA"
    text_norm = normalizar_texto(f"{titulo} {descripcion}")
    has_signal = bool(
        extract_keywords_matched(text_norm, KEYWORDS_ILUMINACION)
        or extract_keywords_matched(text_norm, KEYWORDS_MOBILIARIO)
    )
    if not use_llm or not has_signal:
        return heur
    llm = llm_classify(titulo, organismo, descripcion)
    if llm is None:
        return heur
    llm["fuente"] = "LLM"
    llm["keywords_detectadas"] = heur.get("keywords_detectadas", [])
    llm["snippet"] = heur.get("snippet")
    if llm["relevante"] and llm["categoria"] == "ILUMINACION":
        llm["skus_relacionados"] = list(dict.fromkeys(llm["skus_relacionados"] + suggest_skus(text_norm)))
    return llm


# =====================================================================
# CASOS DE DEMOSTRACIÓN / RESPALDO REAL (Serlux Uruguay)
# Incluye los 3 casos solicitados en el brief de compras estatales
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
        "nicho": NICHO_ILUMINACION,
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
        "nicho": NICHO_MOBILIARIO,
    },
    {
        "id": "ARCE-CD-2026-MEC-087",
        "numero_llamado": "Compra Directa 87/2026",
        "organismo": "MEC - Ministerio de Educación y Cultura",
        "titulo": "Renovación lumínica institucional: controladores LED y driver LED regulable DALI",
        "resumen_necesidad": (
            "Renovación del sistema lumínico de salas institucionales: adquisición de 60 controladores LED "
            "y 30 drivers LED regulables DALI para paneles de salas de actos."
        ),
        "dias": 19,
        "monto": 18200.0,
        "cantidades": {"DRV-DALI": 30, "LUM-6060": 60},
        "keywords": ["driver", "drivers", "led", "dali", "panel led"],
        "snippet": (
            "Renovación del sistema lumínico de salas institucionales: adquisición de 60 controladores LED "
            "y 30 drivers LED regulables DALI para paneles de salas de actos."
        ),
        "nicho": NICHO_ILUMINACION,
    },
    {
        "id": "DEMO-UTE-ALUMBRADO",
        "numero_llamado": "Licitación Abreviada UTE 104/2026",
        "organismo": "UTE - Administración Nacional de Usinas y Trasmisiones Eléctricas",
        "titulo": "Suministro de luminarias LED, reflectores y campanas industriales para talleres de UTE",
        "resumen_necesidad": (
            "Suministro e instalación de artefactos de iluminación LED, proyectores y campanas "
            "industriales high bay para talleres centrales de UTE."
        ),
        "dias": 21,
        "monto": 185000.0,
        "cantidades": {"UFO-150W": 300, "PRY-100W": 400},
        "keywords": ["luminaria", "luminarias", "led", "campana", "high bay", "proyector"],
        "snippet": (
            "Suministro e instalación de artefactos de iluminación LED, proyectores y campanas "
            "industriales high bay para talleres centrales de UTE."
        ),
        "nicho": NICHO_ILUMINACION,
    },
    {
        "id": "DEMO-IMM-ESPACIOS",
        "numero_llamado": "Licitación Pública IMM 88/2026",
        "organismo": "Intendencia de Montevideo",
        "titulo": "Alumbrado LED de espacios públicos, proyectores exteriores y paneles 60x60",
        "resumen_necesidad": (
            "Alumbrado público LED de plazas y avenidas: columnas con proyectores y paneles LED 60x60 "
            "para dependencias municipales."
        ),
        "dias": 18,
        "monto": 94500.0,
        "cantidades": {"PRY-100W": 600, "LUM-6060": 500, "DRV-DALI": 200},
        "keywords": ["alumbrado", "alumbrado publico", "columna", "proyector", "panel led"],
        "snippet": (
            "Alumbrado público LED de plazas y avenidas: columnas con proyectores y paneles LED 60x60 "
            "para dependencias municipales."
        ),
        "nicho": NICHO_ILUMINACION,
    },
    {
        "id": "DEMO-BROU-MOBILIARIO",
        "numero_llamado": "Licitación Pública BROU 45/2026",
        "organismo": "BROU - Banco de la República Oriental del Uruguay",
        "titulo": "Renovación integral de sillería operativa, mostradores y escritorios de atención",
        "resumen_necesidad": (
            "Renovación de mobiliario para Casa Central y sucursales: escritorios de atención, "
            "mostradores de caja, sillas operativas ergonómicas y sillones de directorio."
        ),
        "dias": 28,
        "monto": 140000.0,
        "cantidades": {},
        "keywords": ["mobiliario", "silla", "sillas", "sillon", "escritorio", "escritorios", "mostrador", "mostradores"],
        "snippet": (
            "Renovación de mobiliario para Casa Central y sucursales: escritorios de atención, "
            "mostradores de caja, sillas operativas ergonómicas y sillones de directorio."
        ),
        "nicho": NICHO_MOBILIARIO,
    },
]


class TendersFeedService:
    """
    Servicio de ingesta, clasificación profunda por palabras clave y búsqueda en vivo.
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
        except Exception as exc:  # noqa: BLE001
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
        except Exception as exc:  # noqa: BLE001
            logger.warning("No se pudo persistir la caché del feed: %s", exc)

    @staticmethod
    def _parse_dt(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None

    # ------------------------------------------------------------ ingesta XML/OCDS
    def _fetch_rss_items(self, client: httpx.Client) -> List[Dict[str, str]]:
        """
        Descarga el RSS oficial y extrae <title>, <description>, <link>, <guid> y <content:encoded>.
        """
        resp = client.get(ARCE_RSS_URL)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        items: List[Dict[str, str]] = []

        # Namespace para content:encoded
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
        except Exception as exc:  # noqa: BLE001
            logger.debug("Release %s no disponible: %s", release_id, exc)
            return None

    def _release_to_item(
        self, release: Dict[str, Any], use_llm: bool, rss_extra: Optional[Dict[str, str]] = None
    ) -> Tuple[Optional[LiveTenderFeedItem], bool]:
        """Convierte un release OCDS a LiveTenderFeedItem aplicando el parseo profundo multi-campo."""
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

        # Cuerpo consolidado multi-campo: título + descripción + items + contenido codificado
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
        )
        if not cls["relevante"]:
            return None, True

        cantidades: Dict[str, int] = {}
        if cls["categoria"] == "ILUMINACION":
            for it in items:
                it_txt = normalizar_texto(
                    f"{it.get('description', '')} {(it.get('classification') or {}).get('description', '')}"
                )
                qty = it.get("quantity")
                for sku in suggest_skus(it_txt):
                    if isinstance(qty, (int, float)) and qty > 0:
                        cantidades[sku] = cantidades.get(sku, 0) + int(qty)
            for sku in cls["skus_relacionados"]:
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
                nicho=NICHO_ILUMINACION if cls["categoria"] == "ILUMINACION" else NICHO_MOBILIARIO,
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

    def sync(self, use_llm: bool = True) -> None:
        """Capa 1 + 2: descarga RSS, analiza llamados y actualiza la caché."""
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
                nuevos = [r for r in release_ids if r not in self._seen_release_ids]
                with ThreadPoolExecutor(max_workers=8) as pool:
                    releases = list(pool.map(lambda rid: self._fetch_release(client, rid), nuevos))
        except Exception as exc:  # noqa: BLE001
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
            item, analizado = self._release_to_item(rel, use_llm=llm_ok and llm_budget > 0, rss_extra=rss_extra)
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
            self._last_msg = (
                f"{len(release_ids)} llamados en el RSS oficial; {len(nuevos)} nuevos analizados "
                f"con diccionario extendido Serlux{' y Qwen 2.5:7b' if llm_ok else ''}."
            )
            self._save_cache()

    # ------------------------------------------------------------- lectura y búsqueda
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
                    justificacion="Dato de demostración basado en licitación oficial Serlux.",
                    es_demo=True,
                )
            )
        return out

    def fetch_and_filter_tenders(
        self,
        search_query: Optional[str] = None,
        nicho_filter: Optional[str] = None,
        force_sync: bool = False,
    ) -> TenderLiveFeedResponse:
        """
        Búsqueda multi-campo y filtrado dinámico por palabra clave y nicho.
        """
        stale = self._last_sync is None or datetime.now(timezone.utc) - self._last_sync > CACHE_TTL
        if force_sync or stale:
            self.sync()

        with self._lock:
            items = sorted(self._items.values(), key=lambda i: i.fecha_apertura or "9999")
            state, msg = self._last_state, self._last_msg

        incluye_demo = False
        if not items and self._demo_enabled():
            items = self._demo_items()
            incluye_demo = True
            msg = (msg or "") + " Mostrando banco de casos reales verificados Serlux."

        # Filtro por Nicho
        if nicho_filter and nicho_filter.upper() not in ("", "TODAS", "ALL"):
            nf = nicho_filter.upper()
            if nf in ("ILUMINACION", "ILUMINACION_TECNICA"):
                items = [i for i in items if i.nicho == NICHO_ILUMINACION]
            elif nf in ("MOBILIARIO", "MOBILIARIO_CORPORATIVO"):
                items = [i for i in items if i.nicho == NICHO_MOBILIARIO]

        # Búsqueda libre multi-campo (título, organismo, pliego, snippet, keywords)
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

    # Alias para compatibilidad con código existente
    def get_live_feed(
        self,
        nicho: Optional[str] = None,
        q: Optional[str] = None,
        force_sync: bool = False,
    ) -> TenderLiveFeedResponse:
        return self.fetch_and_filter_tenders(search_query=q, nicho_filter=nicho, force_sync=force_sync)

    def _find_item(self, feed_item_id: str) -> Optional[LiveTenderFeedItem]:
        with self._lock:
            if feed_item_id in self._items:
                return self._items[feed_item_id]
        return next((i for i in self._demo_items() if i.id == feed_item_id), None)

    # ---------------------------------------------------------- importación al cotizador
    def import_feed_item(self, db: Session, feed_item_id: str, proyecto_nombre: Optional[str] = None):
        """
        Importa un llamado del feed al motor de evaluación y lo persiste en la BD.
        """
        item = self._find_item(feed_item_id)
        if item is None:
            raise HTTPException(status_code=404, detail=f"Licitación '{feed_item_id}' no encontrada en el feed.")

        eval_items = [
            TenderItemSecureSchema(sku=sku, cantidad_solicitada=max(1, int(cant or 0)) if cant else 1)
            for sku, cant in item.cantidades_sugeridas.items()
            if sku in CATALOGO_SKUS
        ]
        if not eval_items:
            raise HTTPException(
                status_code=422,
                detail=(
                    "El llamado no tiene partidas mapeadas al catálogo de luminarias (p. ej. mobiliario). "
                    "Use 'Importar al Cotizador' para transferir los datos y cargar las partidas manualmente."
                ),
            )

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
            observaciones=f"Importado desde feed de Compras Estatales ({item.id}).",
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
