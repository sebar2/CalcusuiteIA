import re
import uuid
import logging
from typing import List, Dict, Any, Tuple
from decimal import Decimal
import httpx

from app.core.credentials import settings
from app.services.exchange_rate_service import get_brou_rate

logger = logging.getLogger(__name__)

SERPER_URL = "https://google.serper.dev/search"

BLACKLIST_DOMAINS = [
    "mercadolibre.com.uy",
    "mercadolibre.com",
    "infocasas.com.uy",
    "gallito.com.uy",
    "inmuebles.elpais.com.uy",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "wikipedia.org",
    "youtube.com",
    "twitter.com",
    "x.com",
    "pinterest.com",
]


def clean_company_name(title: str, domain: str) -> str:
    """Extrae el nombre limpio de la tienda/empresa a partir del dominio o título."""
    if domain:
        parts = domain.replace('www.', '').split('.')
        if parts:
            name = parts[0].capitalize()
            if len(name) >= 3 and name.lower() not in ("tienda", "shop", "online", "uy", "com"):
                return name[:40]
    clean = re.sub(r'(?i)(uruguay|montevideo|en uruguay|precios|comprar|\.com|\.uy)', '', title)
    clean = clean.split('-')[0].split('|')[0].strip()
    if not clean or len(clean) < 3:
        clean = domain.replace('www.', '').split('.')[0].capitalize()
    return clean[:40]


def extract_price(text: str, fallback: float) -> Tuple[float, str]:
    """
    Buscar patrones de precio en UYU o USD dentro del título o snippet.
    Aplica discernimiento contextual por orden de magnitud en Uruguay.
    Retorna (valor_float, moneda_detectada).
    """
    if not text:
        return fallback, ("UYU" if fallback >= 450.0 else "USD")

    # 1. Patrones explícitos en USD
    usd_match = re.search(r'(?:US\$|USD|\$U\$D)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)', text, re.IGNORECASE)
    if usd_match:
        try:
            val_str = usd_match.group(1).replace('.', '').replace(',', '.')
            val = float(val_str)
            if val > 0:
                return val, "USD"
        except (ValueError, IndexError):
            pass

    # 2. Patrones explícitos en UYU ($U o UYU)
    uyu_match = re.search(r'(?:\$U|UYU)\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)', text, re.IGNORECASE)
    if uyu_match:
        try:
            val_str = uyu_match.group(1).replace('.', '').replace(',', '.')
            val = float(val_str)
            if val > 0:
                return val, "UYU"
        except (ValueError, IndexError):
            pass

    # 3. Signo '$' genérico: discernimiento contextual en e-commerce uruguayo
    generic_match = re.search(r'\$\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)', text)
    if generic_match:
        try:
            val_str = generic_match.group(1).replace('.', '').replace(',', '.')
            val = float(val_str)
            if val > 0:
                # Un valor < 450 con signo '$' genérico en e-commerce uruguayo representa USD (ej. $ 73.53)
                # Un valor >= 450 representa Pesos Uruguayos (ej. $ 2.990 UYU)
                if val < 450.0:
                    return val, "USD"
                else:
                    return val, "UYU"
        except (ValueError, IndexError):
            pass

    return fallback, ("UYU" if fallback >= 450.0 else "USD")


async def search_google_serper(
    query: str,
    target_currency: str = "UYU",
    fallback_price: float = 3000.0
) -> List[Dict[str, Any]]:
    """
    Ejecuta búsqueda web directa regionalizada con Serper.dev en Uruguay.
    Filtra dominios en lista negra, extrae precios reales o asigna fallback monetario,
    y unifica con la cotización oficial BROU.
    """
    if not settings.SERPER_API_KEY:
        logger.warning("SERPER_API_KEY no configurada. Omitiendo búsqueda Serper.")
        return []

    headers = {
        "X-API-KEY": settings.SERPER_API_KEY,
        "Content-Type": "application/json"
    }

    # Búsqueda orientada a e-commerce y retailers en Uruguay
    search_q = f"{query} comprar precio uruguay"
    req_body = {
        "q": search_q,
        "gl": "uy",
        "hl": "es",
        "num": 40
    }

    logger.info("Iniciando búsqueda Serper.dev con query: '%s'", search_q)

    organic_results = []
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0)) as client:
            response = await client.post(SERPER_URL, headers=headers, json=req_body)
            if response.status_code == 200:
                data = response.json()
                organic_results = data.get("organic", [])
            else:
                logger.error("Serper API error: status %s - %s", response.status_code, response.text)
                return []
    except Exception as exc:
        logger.error("Excepción al conectar con Serper.dev: %s", exc)
        return []

    if not organic_results:
        logger.info("Serper.dev no retornó resultados orgánicos para '%s'", query)
        return []

    # Obtener tasa oficial del BROU
    try:
        brou_rate = await get_brou_rate()
        if not brou_rate or brou_rate <= 0:
            brou_rate = 42.65
    except Exception as err:
        logger.warning("Error obteniendo tasa BROU en serper service: %s. Usando 42.65", err)
        brou_rate = 42.65

    competitors: List[Dict[str, Any]] = []

    for item in organic_results:
        link = item.get("link", "")
        title = item.get("title", "")
        snippet = item.get("snippet", "")

        # Extraer dominio
        domain_match = re.search(r'https?://(?:www\.)?([^/]+)', link)
        domain = domain_match.group(1).lower() if domain_match else ""

        # Comprobar blacklist
        if any(blacklisted in domain or blacklisted in link.lower() for blacklisted in BLACKLIST_DOMAINS):
            continue

        # Extraer precio y moneda con discernimiento de magnitud
        combined_text = f"{title} {snippet}"
        raw_price, detected_currency = extract_price(combined_text, fallback_price)

        # Regla estricta de conversión cambiaria BROU
        if detected_currency == "USD":
            precio_usd = round(raw_price, 2)
            precio_uyu = round(raw_price * brou_rate, 2)
        else:
            precio_uyu = round(raw_price, 2)
            precio_usd = round(raw_price / brou_rate, 2)

        vendedor = clean_company_name(title, domain)

        competitors.append({
            "id": f"serper_{uuid.uuid4().hex[:10]}",
            "titulo": title[:100] if title else f"Producto {vendedor}",
            "vendedor": vendedor,
            "canal": "Google Search (Directo)",
            "precio_original": Decimal(str(raw_price)),
            "precio_uyu": Decimal(str(precio_uyu)),
            "moneda": detected_currency,
            "precio_usd": Decimal(str(precio_usd)),
            "ubicacion": "Uruguay",
            "url": link
        })

    logger.info("Serper.dev procesó %d competidores válidos tras filtrado.", len(competitors))
    return competitors
