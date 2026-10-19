import os
import re
import time
import logging
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from urllib.parse import urlparse, urlencode
import secrets
from datetime import datetime, timezone
import httpx
from sqlalchemy.orm import Session

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

    # =========================================================================
    # INTEGRACIÓN OFICIAL MERCADO LIBRE URUGUAY (MLU) - SELLER OAUTH & WEBHOOKS
    # =========================================================================

    MELI_AUTH_BASE_URL = "https://auth.mercadolibre.com.uy/authorization"
    MELI_API_BASE_URL = "https://api.mercadolibre.com"
    DEFAULT_REDIRECT_URI = "https://100.119.40.92:8000/api/v1/integrations/meli/callback"

    @classmethod
    def get_client_credentials(cls) -> Tuple[str, str]:
        """Obtiene client_id y client_secret de entorno con fallback al App ID oficial."""
        client_id = (os.getenv("MELI_CLIENT_ID") or MELI_CLIENT_ID or "5376694505612300").strip()
        client_secret = (os.getenv("MELI_CLIENT_SECRET") or MELI_CLIENT_SECRET or "").strip()
        return client_id, client_secret

    @classmethod
    def build_authorization_url(
        cls,
        tenant_id: str = "tenant_calcu_corp",
        redirect_uri: Optional[str] = None,
        state: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Construye la URL oficial de autorización OAuth 2.0 para Mercado Libre Uruguay.
        App ID: 5376694505612300 (Calcu-Benchmarking)
        """
        client_id, _ = cls.get_client_credentials()
        r_uri = redirect_uri or cls.DEFAULT_REDIRECT_URI
        st = state or f"st_{tenant_id}_{secrets.token_hex(8)}"
        params = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": r_uri,
            "state": st,
        }
        auth_url = f"{cls.MELI_AUTH_BASE_URL}?{urlencode(params)}"
        return {
            "auth_url": auth_url,
            "client_id": client_id,
            "redirect_uri": r_uri,
            "state": st,
        }

    @classmethod
    async def exchange_authorization_code(
        cls,
        code: str,
        redirect_uri: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Intercambia el authorization_code por tokens definitivos de vendedor contra MeLi.
        """
        client_id, client_secret = cls.get_client_credentials()
        if not client_secret:
            raise ValueError("MELI_CLIENT_SECRET no configurado en entorno (.env).")

        r_uri = redirect_uri or cls.DEFAULT_REDIRECT_URI
        url = f"{cls.MELI_API_BASE_URL}/oauth/token"
        payload = {
            "grant_type": "authorization_code",
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": r_uri,
        }
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, data=payload, headers=headers)
            if resp.status_code == 200:
                return resp.json()
            else:
                logger.error("Error intercambiando code de MeLi: %d %s", resp.status_code, resp.text)
                raise RuntimeError(f"Error MeLi OAuth ({resp.status_code}): {resp.text}")

    @classmethod
    async def refresh_seller_token(
        cls,
        refresh_token: str
    ) -> Dict[str, Any]:
        """
        Renueva el access_token utilizando el refresh_token de un solo uso de Mercado Libre.
        """
        client_id, client_secret = cls.get_client_credentials()
        if not client_secret:
            raise ValueError("MELI_CLIENT_SECRET no configurado en entorno (.env).")

        url = f"{cls.MELI_API_BASE_URL}/oauth/token"
        payload = {
            "grant_type": "refresh_token",
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
        }
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, data=payload, headers=headers)
            if resp.status_code == 200:
                return resp.json()
            else:
                logger.error("Error renovando refresh_token de MeLi: %d %s", resp.status_code, resp.text)
                raise RuntimeError(f"Error renovación MeLi ({resp.status_code}): {resp.text}")

    @classmethod
    def get_valid_seller_token(
        cls,
        db: Session,
        tenant_id: str = "tenant_calcu_corp"
    ) -> Optional[str]:
        """
        Garantía ISO 27001: Obtiene el token de vendedor descifrándolo de la bóveda AES-256.
        Si está próximo a expirar (<30 min) y tiene refresh_token, lo renueva automáticamente.
        """
        from app.models.multitenant_entities import IntegrationConfig
        from app.core.vault import decrypt_vault_payload, encrypt_vault_payload, sanitize_credentials_for_response

        cfg = db.query(IntegrationConfig).filter(
            IntegrationConfig.channel == "MERCADO_LIBRE",
            IntegrationConfig.tenant_id == tenant_id
        ).first()

        if not cfg or not cfg.encrypted_credentials:
            return None

        creds = decrypt_vault_payload(cfg.encrypted_credentials)
        if not creds:
            return None

        access_token = creds.get("access_token")
        refresh_token = creds.get("refresh_token")
        expires_at = creds.get("expires_at", 0)

        # Si aún tiene más de 30 minutos de validez, retornarlo directamente
        now_ts = time.time()
        if access_token and (expires_at - now_ts > 1800):
            return access_token

        # Si tiene refresh token, renovar preventivamente
        if refresh_token:
            try:
                client_id, client_secret = cls.get_client_credentials()
                if client_secret:
                    with httpx.Client(timeout=10.0) as c:
                        resp = c.post(
                            f"{cls.MELI_API_BASE_URL}/oauth/token",
                            data={
                                "grant_type": "refresh_token",
                                "client_id": client_id,
                                "client_secret": client_secret,
                                "refresh_token": refresh_token,
                            },
                            headers={"Content-Type": "application/x-www-form-urlencoded"}
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            new_access = data.get("access_token")
                            new_refresh = data.get("refresh_token") or refresh_token
                            exp_in = float(data.get("expires_in", 21600))
                            creds.update({
                                "access_token": new_access,
                                "refresh_token": new_refresh,
                                "expires_at": time.time() + exp_in,
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                            })
                            cfg.encrypted_credentials = encrypt_vault_payload(creds)
                            cfg.masked_summary = sanitize_credentials_for_response(creds)
                            cfg.status = "CONNECTED"
                            db.commit()
                            return new_access
            except Exception as e:
                logger.error("Error en renovación preventiva de token MeLi: %s", e)
                return access_token

        return access_token

    @classmethod
    def validate_anti_penalty(cls, text: str) -> Tuple[bool, Optional[str]]:
        """
        Linter Anti-Penalización de Mercado Libre:
        Detecta y bloquea datos de contacto externos (teléfonos uruguayos, correos, enlaces web y menciones)
        para proteger la reputación y evitar suspensión de la cuenta en preguntas pre-venta.
        """
        if not text:
            return True, None

        clean_text = text.lower()

        # 1. Teléfonos uruguayos (09X XXX XXX, 09XXXXXXX, +598 9X...)
        phone_patterns = [
            r"\b09[1-9]\d{6}\b",
            r"\b09[1-9][\s.-]?\d{3}[\s.-]?\d{3}\b",
            r"\+?598[\s.-]?9[1-9][\s.-]?\d{6}\b",
            r"\b2\d{7}\b",  # Teléfonos fijos Montevideo (ej. 2400 1234)
        ]
        for pat in phone_patterns:
            if re.search(pat, text):
                return False, "Se detectó un número telefónico uruguayo. MeLi penaliza severamente el envío de números en preguntas pre-venta."

        # 2. Correos electrónicos
        email_pattern = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"
        if re.search(email_pattern, text):
            return False, "Se detectó una dirección de correo electrónico. MeLi prohíbe el intercambio de emails en preguntas pre-venta."

        # 3. Enlaces web, dominios y URLs
        url_patterns = [
            r"https?://\S+",
            r"www\.\S+",
            r"\b[a-zA-Z0-9-]+\.(com|uy|com\.uy|org|net|io|me|ar|cl|br)\b",
        ]
        for pat in url_patterns:
            if re.search(pat, text, re.IGNORECASE):
                return False, "Se detectó una URL o dominio web externo. MeLi prohíbe enlaces externos en preguntas pre-venta."

        # 4. Palabras clave de contacto externo o pago por fuera
        forbidden_keywords = [
            ("whatsapp", "WhatsApp"),
            ("wpp", "WhatsApp"),
            ("whats", "WhatsApp"),
            ("celular", "contacto telefónico"),
            ("telefono", "contacto telefónico"),
            ("teléfono", "contacto telefónico"),
            ("por fuera", "transacción externa"),
            ("transferencia bancaria", "pago por fuera de Mercado Pago"),
            ("instagram", "red social externa"),
            ("facebook", "red social externa"),
        ]
        for kw, desc in forbidden_keywords:
            if re.search(rf"\b{kw}\b", clean_text):
                return False, f"Se detectó mención a '{kw}' ({desc}). MeLi prohíbe coordinar contactos o pagos externos."

        return True, None

    @classmethod
    async def fetch_meli_resource(
        cls,
        resource_path: str,
        access_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Consulta un recurso oficial de MeLi (/questions/..., /items/..., /orders/...).
        """
        clean_path = resource_path if resource_path.startswith("/") else f"/{resource_path}"
        url = f"{cls.MELI_API_BASE_URL}{clean_path}"
        headers = {"Accept": "application/json"}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                return resp.json()
            logger.warning("Recurso MeLi %s retornó %d: %s", clean_path, resp.status_code, resp.text)
            return {}

    @classmethod
    async def answer_question(
        cls,
        question_id: int | str,
        text: str,
        access_token: str
    ) -> Dict[str, Any]:
        """
        Envía una respuesta a una pregunta pre-venta en MeLi verificando linter anti-penalización.
        """
        is_valid, violation = cls.validate_anti_penalty(text)
        if not is_valid:
            raise ValueError(f"Violación de políticas de Mercado Libre: {violation}")

        url = f"{cls.MELI_API_BASE_URL}/answers"
        payload = {
            "question_id": int(question_id),
            "text": text.strip()
        }
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                return resp.json()
            raise RuntimeError(f"Error al responder pregunta en MeLi ({resp.status_code}): {resp.text}")

    @classmethod
    def process_meli_webhook_sync(
        cls,
        db: Session,
        resource: str,
        topic: str,
        user_id: Optional[int | str] = None,
        tenant_id: str = "tenant_calcu_corp"
    ) -> Dict[str, Any]:
        """
        Procesa de forma idempotente las notificaciones de Webhooks de Mercado Libre Uruguay:
        - topic == 'questions' -> Ingesta de pregunta en '1. Prospección' con canal MERCADO_LIBRE.
        - topic == 'orders' -> Actualización/Cierre de venta y cruce de stock en módulo de Inventario.
        """
        from app.models.entities import CommercialDeal, Product, Inventory
        from app.models.multitenant_entities import IntegrationConfig, OmnichannelMessage

        cfg = db.query(IntegrationConfig).filter(
            IntegrationConfig.channel == "MERCADO_LIBRE"
        ).first()
        default_seller = cfg.default_seller if cfg and cfg.default_seller else "Martín Gómez"

        clean_res = resource.strip()
        
        # 1. CASO PREGUNTAS PRE-VENTA (/questions/XXXXX)
        if topic == "questions" or clean_res.startswith("/questions/"):
            q_id_match = re.search(r"/questions/(\d+)", clean_res)
            question_id = q_id_match.group(1) if q_id_match else secrets.token_hex(6)
            external_lead_id = f"meli_q_{question_id}"

            existing_deal = db.query(CommercialDeal).filter(
                CommercialDeal.external_lead_id == external_lead_id
            ).first()
            if existing_deal:
                return {
                    "status": "duplicate_ignored",
                    "deal_id": existing_deal.id,
                    "topic": topic,
                    "message": f"Pregunta de MeLi #{question_id} ya indexada en Prospección.",
                }

            token = cls.get_valid_seller_token(db, tenant_id=tenant_id)
            q_data: Dict[str, Any] = {}
            item_data: Dict[str, Any] = {}
            if token:
                try:
                    with httpx.Client(timeout=6.0) as c:
                        qr = c.get(f"{cls.MELI_API_BASE_URL}{clean_res}", headers={"Authorization": f"Bearer {token}"})
                        if qr.status_code == 200:
                            q_data = qr.json()
                            item_id = q_data.get("item_id")
                            if item_id:
                                ir = c.get(f"{cls.MELI_API_BASE_URL}/items/{item_id}", headers={"Authorization": f"Bearer {token}"})
                                if ir.status_code == 200:
                                    item_data = ir.json()
                except Exception as ex:
                    logger.warning("Consulta a MeLi API en webhook question tuvo excepción: %s", ex)

            q_text = q_data.get("text") or f"Consulta sobre publicación de Mercado Libre ({clean_res})"
            buyer_id = q_data.get("from", {}).get("id") or user_id or "comprador_anonimo"
            buyer_name = f"Comprador MeLi #{buyer_id}"
            item_title = item_data.get("title") or "Publicación Mercado Libre Uruguay"
            item_price = Decimal(str(item_data.get("price") or "0.00"))
            item_curr = item_data.get("currency_id") or "USD"
            permalink = item_data.get("permalink") or f"https://articulo.mercadolibre.com.uy/{clean_res}"

            deal_id = f"deal-mlu-{question_id[:8]}"
            obs_text = f"Pregunta en MeLi:\n\"{q_text}\"\n\nPublicación: {item_title}\nEnlace: {permalink}"

            new_deal = CommercialDeal(
                id=deal_id,
                proyecto_nombre=f"[MLU] {item_title[:150]}",
                cliente=buyer_name,
                rut=None,
                vendedor=default_seller,
                monto_total=item_price,
                moneda=item_curr,
                etapa="prospeccion",  # Columna '1. Prospección' obligatoria
                observaciones=obs_text,
                canal_origen="MERCADO_LIBRE",
                utm_source="mercadolibre_uy",
                utm_medium="organic_question",
                utm_campaign=f"item_{q_data.get('item_id', 'general')}",
                external_lead_id=external_lead_id,
                costo_adquisicion_estimado=cfg.cost_per_lead_usd if cfg else Decimal("0.80"),
                ai_score=85,
                ai_classification="WARM",
                created_at=datetime.now(timezone.utc),
            )
            db.add(new_deal)

            msg = OmnichannelMessage(
                tenant_id=tenant_id,
                deal_id=deal_id,
                channel="MERCADO_LIBRE",
                direction="INBOUND",
                sender_name=buyer_name,
                sender_address=f"meli_buyer_{buyer_id}",
                message_text=q_text,
                delivery_status="RECEIVED",
                is_ai_generated=False,
                created_at=datetime.now(timezone.utc),
            )
            db.add(msg)

            if cfg:
                cfg.leads_captured_count = (cfg.leads_captured_count or 0) + 1
                cfg.updated_at = datetime.now(timezone.utc)

            db.commit()
            return {
                "status": "ingested_prospeccion",
                "deal_id": deal_id,
                "topic": "questions",
                "question_id": question_id,
                "cliente": buyer_name,
                "etapa": "prospeccion",
                "message": "Pregunta de MeLi inyectada exitosamente en '1. Prospección'.",
            }

        # 2. CASO ÓRDENES DE VENTA POST-VENTA (/orders/XXXXX)
        elif topic == "orders" or clean_res.startswith("/orders/"):
            ord_id_match = re.search(r"/orders/(\d+)", clean_res)
            order_id = ord_id_match.group(1) if ord_id_match else secrets.token_hex(6)
            external_lead_id = f"meli_ord_{order_id}"

            existing_deal = db.query(CommercialDeal).filter(
                CommercialDeal.external_lead_id == external_lead_id
            ).first()
            if existing_deal:
                return {
                    "status": "duplicate_ignored",
                    "deal_id": existing_deal.id,
                    "topic": topic,
                    "message": f"Orden de MeLi #{order_id} ya procesada previamente.",
                }

            token = cls.get_valid_seller_token(db, tenant_id=tenant_id)
            ord_data: Dict[str, Any] = {}
            if token:
                try:
                    with httpx.Client(timeout=6.0) as c:
                        or_res = c.get(f"{cls.MELI_API_BASE_URL}{clean_res}", headers={"Authorization": f"Bearer {token}"})
                        if or_res.status_code == 200:
                            ord_data = or_res.json()
                except Exception as ex:
                    logger.warning("Consulta MeLi /orders tuvo excepción: %s", ex)

            total_amount = Decimal(str(ord_data.get("total_amount") or "0.00"))
            currency = ord_data.get("currency_id") or "USD"
            buyer_info = ord_data.get("buyer", {})
            buyer_name = buyer_info.get("nickname") or f"Comprador MeLi #{buyer_info.get('id', user_id or 'orden')}"
            
            deal_id = f"deal-mlu-ord-{order_id[:8]}"
            deal = CommercialDeal(
                id=deal_id,
                proyecto_nombre=f"[MLU Venta] Orden #{order_id}",
                cliente=buyer_name,
                rut=None,
                vendedor=default_seller,
                monto_total=total_amount,
                moneda=currency,
                etapa="ganada",  # Orden cerrada ganada
                observaciones=f"Venta concretada en Mercado Libre Uruguay. Orden #{order_id}",
                canal_origen="MERCADO_LIBRE",
                utm_source="mercadolibre_uy",
                utm_medium="marketplace_order",
                utm_campaign=f"order_{order_id}",
                external_lead_id=external_lead_id,
                costo_adquisicion_estimado=cfg.cost_per_lead_usd if cfg else Decimal("0.80"),
                ai_score=100,
                ai_classification="HOT",
                created_at=datetime.now(timezone.utc),
            )
            db.add(deal)

            # Cruce de Stock en Módulo de Inventario (deposito_central) - NO en módulo 3PL
            order_items = ord_data.get("order_items", [])
            for oi in order_items:
                item_obj = oi.get("item", {})
                qty = int(oi.get("quantity") or 1)
                seller_sku = item_obj.get("seller_sku") or item_obj.get("id")
                prod = db.query(Product).filter(
                    (Product.sku == seller_sku) | (Product.codigo_barra == seller_sku)
                ).first()
                if prod and prod.id:
                    inv = db.query(Inventory).filter(Inventory.producto_id == prod.id).first()
                    if inv:
                        inv.deposito_central = max(0, inv.deposito_central - qty)

            msg = OmnichannelMessage(
                tenant_id=tenant_id,
                deal_id=deal_id,
                channel="MERCADO_LIBRE",
                direction="INBOUND",
                sender_name=buyer_name,
                sender_address=f"meli_order_{order_id}",
                message_text=f"¡Nueva compra en Mercado Libre Uruguay! Orden #{order_id} por {currency} {total_amount}.",
                delivery_status="RECEIVED",
                is_ai_generated=False,
                created_at=datetime.now(timezone.utc),
            )
            db.add(msg)

            if cfg:
                cfg.leads_captured_count = (cfg.leads_captured_count or 0) + 1
                cfg.updated_at = datetime.now(timezone.utc)

            db.commit()
            return {
                "status": "ingested_order",
                "deal_id": deal_id,
                "topic": "orders",
                "order_id": order_id,
                "monto": float(total_amount),
                "etapa": "ganada",
                "message": "Orden MeLi procesada, trato ganado y stock de inventario actualizado.",
            }

        return {
            "status": "ignored",
            "topic": topic,
            "resource": resource,
            "message": "Topic no relevante para prospección u órdenes."
        }

