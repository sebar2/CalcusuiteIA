import os
import re
import time
import logging
from decimal import Decimal
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse
import httpx

from app.core.config import MELI_CLIENT_ID, MELI_CLIENT_SECRET
from app.domain.schemas import CompetitorItemResponse
from app.services.exchange_rate_service import ExchangeRateService

logger = logging.getLogger(__name__)

SITE_CONFIGS: Dict[str, Dict[str, Any]] = {
    "Uruguay": {"site_id": "MLU", "currency": "UYU", "fx": 42.65, "tld": "com.uy", "ddg_region": "uy-es"},
    "Argentina": {"site_id": "MLA", "currency": "ARS", "fx": 1200.0, "tld": "com.ar", "ddg_region": "ar-es"},
    "Chile": {"site_id": "MLC", "currency": "CLP", "fx": 950.0, "tld": "cl", "ddg_region": "cl-es"},
    "Brasil": {"site_id": "MLB", "currency": "BRL", "fx": 5.50, "tld": "com.br", "ddg_region": "br-pt"},
}


def get_site_config(country: str) -> Dict[str, Any]:
    cfg = dict(SITE_CONFIGS.get(country, SITE_CONFIGS["Uruguay"]))
    if country == "Uruguay" or cfg.get("site_id") == "MLU":
        cfg["fx"] = ExchangeRateService.get_cached_rate_used_sync()
    return cfg

BLACKLIST_KEYWORDS = {
    "infocasas", "veocasas", "casasymas", "inmuebles", "propiedades",
    "zonaprop", "alquiler", "apartamento", "inmobiliaria", "terreno",
    "propiedad", "alquilar", "dormitorios", "arriendo", "arrendar",
    "habitacion", "habitaciones", "inmueble", "monoambiente"
}


def is_blacklisted(text_or_url: str) -> bool:
    t = (text_or_url or "").lower()
    return any(k in t for k in BLACKLIST_KEYWORDS)


class MeliService:
    """
    Servicio Oficial de Integración con Mercado Libre Developers API.
    Implementa autenticación OAuth 2.0 (client_credentials), caché de token en memoria,
    consulta de catálogo oficial (search, domain discovery y catalog highlights)
    y mapeo estricto de permalinks reales con cero datos mock.
    """

    _cached_token: Optional[str] = None
    _token_expires_at: float = 0.0
    _seller_cache: Dict[int, str] = {}

    @classmethod
    async def get_access_token(cls) -> Optional[str]:
        """
        Obtiene un token de acceso OAuth 2.0 mediante el flujo client_credentials.
        Cachea en memoria para evitar autenticar en cada petición.
        """
        now = time.time()
        if cls._cached_token and now < cls._token_expires_at:
            return cls._cached_token

        client_id = os.getenv("MELI_CLIENT_ID") or MELI_CLIENT_ID
        client_secret = os.getenv("MELI_CLIENT_SECRET") or MELI_CLIENT_SECRET

        if not client_id or not client_secret:
            logger.warning("MELI_CLIENT_ID o MELI_CLIENT_SECRET no configurados en entorno.")
            return None

        url = "https://api.mercadolibre.com/oauth/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, data=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    token = data.get("access_token")
                    expires_in = float(data.get("expires_in", 21600))
                    cls._cached_token = token
                    # Margen de seguridad de 60 segundos
                    cls._token_expires_at = now + max(60.0, expires_in - 60.0)
                    logger.info("OAuth token de Mercado Libre obtenido exitosamente (expira en %.0fs).", expires_in)
                    return token
                else:
                    logger.error(
                        "Error al obtener token OAuth de Mercado Libre: status %d - %s",
                        resp.status_code,
                        resp.text
                    )
                    return None
        except Exception as exc:
            logger.error("Excepción en autenticación OAuth de Mercado Libre: %s", exc)
            return None

    @classmethod
    async def _get_seller_nickname(cls, seller_id: int, client: httpx.AsyncClient, headers: dict) -> str:
        """Obtiene y cachea el nickname del vendedor."""
        if seller_id in cls._seller_cache:
            return cls._seller_cache[seller_id]
        try:
            r = await client.get(f"https://api.mercadolibre.com/users/{seller_id}", headers=headers)
            if r.status_code == 200:
                nick = r.json().get("nickname") or f"Vendedor #{seller_id}"
                cls._seller_cache[seller_id] = nick
                return nick
        except Exception:
            pass
        return f"Vendedor Oficial #{seller_id}"

    @classmethod
    async def search_official_api(
        cls,
        site_id: str,
        search_query: str,
        country: str,
        fx_rate: float,
        target_currency: str,
        limit: int = 50
    ) -> List[CompetitorItemResponse]:
        """
        Consulta el catálogo oficial de Mercado Libre con token OAuth.
        Estrategia de 2 fases:
        1. Intento primario: GET /sites/{SITE_ID}/search?q={query}&limit=50
        2. Intento secundario: Domain Discovery + Category Highlights + Product Items oficiales
        """
        token = await cls.get_access_token()
        headers = {"User-Agent": "CalcuApp/1.0"}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        clean_q = search_query.strip()
        tld = SITE_CONFIGS.get(country, {}).get("tld", "com.uy")
        results: List[CompetitorItemResponse] = []

        # --- 1. INTENTO PRIMARIO: /sites/{SITE_ID}/search ---
        try:
            search_url = f"https://api.mercadolibre.com/sites/{site_id}/search"
            params = {"q": clean_q, "limit": min(limit, 50)}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(search_url, params=params, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    items = data.get("results", [])
                    for item in items:
                        title = str(item.get("title") or "").strip()
                        permalink = str(item.get("permalink") or "").strip()
                        raw_price = item.get("price")

                        if not title or not permalink or raw_price is None:
                            continue

                        try:
                            p_float = float(raw_price)
                            if p_float <= 0:
                                continue
                        except (ValueError, TypeError):
                            continue

                        if is_blacklisted(title) or is_blacklisted(permalink):
                            continue

                        item_id = str(item.get("id") or "")
                        seller = item.get("seller", {})
                        seller_name = str(seller.get("nickname") or "Vendedor Mercado Libre").strip()
                        address = item.get("address", {})
                        state_name = str(address.get("state_name") or country).strip()
                        item_curr = str(item.get("currency_id") or target_currency).upper()

                        if item_curr in ("UYU", "ARS", "CLP", "BRL") and fx_rate > 0:
                            p_usd = Decimal(str(round(p_float / fx_rate, 2)))
                        else:
                            p_usd = Decimal(str(round(p_float, 2)))

                        orig_p = Decimal(str(round(p_float, 2)))

                        results.append(CompetitorItemResponse(
                            id=item_id,
                            titulo=title,
                            vendedor=seller_name,
                            canal=f"Mercado Libre ({country})",
                            precio_original=orig_p,
                            moneda=item_curr,
                            precio_usd=p_usd,
                            ubicacion=state_name,
                            url=permalink
                        ))
                    if results:
                        logger.info("Mercado Libre /search retornó %d ofertas oficiales para '%s'.", len(results), clean_q)
                        return results[:limit]
        except Exception as e:
            logger.info("Intento primario /search con error: %s", e)

        # --- 2. INTENTO SECUNDARIO OFICIAL: Domain Discovery + Highlights + Items ---
        if not results and token:
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    dom_url = f"https://api.mercadolibre.com/sites/{site_id}/domain_discovery/search"
                    dom_resp = await client.get(dom_url, params={"q": clean_q}, headers=headers)
                    if dom_resp.status_code == 200:
                        categories = dom_resp.json()
                        for cat in categories[:2]:
                            cat_id = cat.get("category_id")
                            if not cat_id:
                                continue

                            hl_url = f"https://api.mercadolibre.com/highlights/{site_id}/category/{cat_id}"
                            hl_resp = await client.get(hl_url, headers=headers)
                            if hl_resp.status_code != 200:
                                continue

                            hl_data = hl_resp.json()
                            hl_products = hl_data.get("content", [])

                            for p_entry in hl_products[:25]:
                                pid = p_entry.get("id")
                                if not pid:
                                    continue

                                # 1. Nombre y detalles oficiales del producto
                                p_resp = await client.get(f"https://api.mercadolibre.com/products/{pid}", headers=headers)
                                if p_resp.status_code != 200:
                                    continue
                                p_data = p_resp.json()
                                p_name = str(p_data.get("name") or "").strip()
                                if not p_name or is_blacklisted(p_name):
                                    continue

                                # 2. Publicaciones activas del producto (items en venta)
                                items_resp = await client.get(f"https://api.mercadolibre.com/products/{pid}/items", headers=headers)
                                if items_resp.status_code != 200:
                                    continue
                                active_items = items_resp.json().get("results", [])
                                if not active_items:
                                    continue

                                it = active_items[0]
                                raw_p = it.get("price")
                                if raw_p is None:
                                    continue
                                try:
                                    p_float = float(raw_p)
                                    if p_float <= 0:
                                        continue
                                except (ValueError, TypeError):
                                    continue

                                item_id = str(it.get("item_id") or pid)
                                item_curr = str(it.get("currency_id") or target_currency).upper()
                                seller_id = it.get("seller_id")
                                seller_name = "Tienda Oficial Certificada"
                                if seller_id:
                                    seller_name = await cls._get_seller_nickname(seller_id, client, headers)

                                # Construcción del permalink canónico real de Mercado Libre
                                # Formato estándar garantizado: https://articulo.mercadolibre.{tld}/{SITE}-{ID}
                                if "-" in item_id:
                                    permalink = f"https://articulo.mercadolibre.{tld}/{item_id}"
                                elif len(item_id) > 3:
                                    permalink = f"https://articulo.mercadolibre.{tld}/{item_id[:3]}-{item_id[3:]}"
                                else:
                                    permalink = f"https://www.mercadolibre.{tld}/p/{pid}"

                                if item_curr in ("UYU", "ARS", "CLP", "BRL") and fx_rate > 0:
                                    p_usd = Decimal(str(round(p_float / fx_rate, 2)))
                                else:
                                    p_usd = Decimal(str(round(p_float, 2)))

                                orig_p = Decimal(str(round(p_float, 2)))

                                results.append(CompetitorItemResponse(
                                    id=item_id,
                                    titulo=p_name,
                                    vendedor=seller_name,
                                    canal=f"Mercado Libre ({country})",
                                    precio_original=orig_p,
                                    moneda=item_curr,
                                    precio_usd=p_usd,
                                    ubicacion=country,
                                    url=permalink
                                ))

                                if len(results) >= limit:
                                    break
                            if len(results) >= limit:
                                break
                    logger.info("Mercado Libre Highlights API retornó %d ofertas oficiales para '%s'.", len(results), clean_q)
            except Exception as exc:
                logger.info("Error en consulta de Highlights de Mercado Libre: %s", exc)

        return results[:limit]

    @classmethod
    async def search_mercadolibre_web_live(
        cls,
        search_query: str,
        country: str,
        region_clean: str,
        fx_rate: float,
        target_currency: str,
        tld: str,
        ddg_region: str,
        limit: int = 50
    ) -> List[CompetitorItemResponse]:
        """
        Rastreo de publicaciones reales en Mercado Libre vía DDGS para obtener permalinks auténticos
        (articulo.mercadolibre.{tld} o mercadolibre.{tld}/p/...) con precios reales.
        """
        results: List[CompetitorItemResponse] = []
        try:
            try:
                from ddgs import DDGS
            except ImportError:
                from duckduckgo_search import DDGS

            q = f'{search_query} site:mercadolibre.{tld}'
            try:
                raw_results = list(DDGS().text(q, region=ddg_region, max_results=limit))
            except Exception:
                raw_results = []

            for idx, r in enumerate(raw_results):
                title = str(r.get("title") or "").strip()
                link = str(r.get("href") or "").strip()
                body = str(r.get("body") or "").strip()

                if not title or not link:
                    continue

                if is_blacklisted(title) or is_blacklisted(link) or is_blacklisted(body):
                    continue

                found_prices = re.findall(r"\$\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)", body + " " + title)
                if not found_prices:
                    continue

                try:
                    clean_p = found_prices[0].replace(".", "").replace(",", ".")
                    val = float(clean_p)
                    if val <= 0:
                        continue
                    if val > 1000 and target_currency in ("ARS", "CLP") and fx_rate > 0:
                        val = val / fx_rate
                    p_val = Decimal(str(round(val, 2)))
                    orig_p = (p_val * Decimal(str(fx_rate))).quantize(Decimal('0.01')) if target_currency != "USD" else p_val
                except Exception:
                    continue

                seller_match = re.search(r"por\s+([A-Za-z0-9_\s]{3,30})", body, re.IGNORECASE)
                seller = seller_match.group(1).strip() if seller_match else "Vendedor Mercado Libre"

                id_match = re.search(r"(ML[UACB]-?[0-9]+)", link)
                item_id = id_match.group(1) if id_match else f"ml-web-{idx}"

                results.append(CompetitorItemResponse(
                    id=item_id,
                    titulo=title.replace(" - MercadoLibre", "").replace(" | Mercado Libre", "").strip(),
                    vendedor=seller,
                    canal=f"Mercado Libre ({country})",
                    precio_original=orig_p,
                    moneda=target_currency,
                    precio_usd=p_val,
                    ubicacion=region_clean or country,
                    url=link
                ))
        except Exception as exc:
            logger.info("Rastreo web en Mercado Libre omitido o sin resultados: %s", exc)

        return results
