import re
import time
import logging
from datetime import datetime
from typing import Optional, Dict, Any

import httpx

from app.domain.schemas import BROUExchangeRateResponse
from app.services.cache_service import memory_cache

logger = logging.getLogger(__name__)

BROU_COTIZACIONES_URL = "https://www.brou.com.uy/cotizaciones"
CACHE_TTL_SECONDS = 1800  # 30 minutos (1800 segundos) de cache en memoria
CACHE_KEY = "finance:exchange_rate:brou"

# Fallback de contingencia oficial ante cortes de red o indisponibilidad del servicio externo
FALLBACK_BUY = 41.50
FALLBACK_SELL = 43.80
FALLBACK_RATE_USED = 42.65


class ExchangeRateService:
    """
    Servicio de cotización oficial de moneda para Uruguay.
    Consulta la cotización oficial del Dólar Estadounidense en el Banco de la República (BROU),
    mantiene un cache en memoria thread-safe con TTL de 30 minutos (1800s) y provee contingencia
    automática (stale fallback) ante caídas o timeouts del servicio externo.
    """
    _cached_response: Optional[BROUExchangeRateResponse] = None
    _cached_timestamp: float = 0.0

    @classmethod
    def _is_cache_valid(cls) -> bool:
        return memory_cache.is_valid(CACHE_KEY)

    @classmethod
    def parse_brou_html(cls, html_content: str) -> Optional[Dict[str, float]]:
        """
        Extrae los valores de Compra y Venta del Dólar estadounidense desde el HTML de BROU.
        Retorna diccionario con 'buy', 'sell' y 'rate_used'.
        """
        try:
            # Buscar sección de Dólar estadounidense en la tabla cotizacion-portlet
            match = re.search(
                r'D[\xf3o]lar.*?class=["\']valor["\']>\s*([0-9]+,[0-9]+)\s*</p>.*?class=["\']valor["\']>\s*([0-9]+,[0-9]+)\s*</p>',
                html_content,
                re.DOTALL
            )
            if not match:
                # Patrón alternativo más flexible
                match = re.search(
                    r'(?:D[\xf3o]lar|USD).*?([0-9]{2,3},[0-9]{2,5}).*?([0-9]{2,3},[0-9]{2,5})',
                    html_content,
                    re.DOTALL
                )

            if match:
                buy_str, sell_str = match.groups()
                buy_val = float(buy_str.replace(".", "").replace(",", "."))
                sell_val = float(sell_str.replace(".", "").replace(",", "."))

                # Sanity check para cotización en Uruguay (entre 20 y 90 UYU/USD)
                if 20.0 <= buy_val <= 90.0 and 20.0 <= sell_val <= 90.0:
                    rate_used = round((buy_val + sell_val) / 2.0, 2)
                    return {
                        "buy": round(buy_val, 2),
                        "sell": round(sell_val, 2),
                        "rate_used": rate_used
                    }
        except Exception as e:
            logger.warning("Error al parsear cotizaciones del HTML de BROU: %s", e)

        return None

    @classmethod
    async def fetch_brou_rate(cls, force_refresh: bool = False) -> BROUExchangeRateResponse:
        """
        Obtiene la cotización oficial del BROU respetando el TTL de 30 minutos (1800s).
        Si la llamada remota falla, recurre al último dato en memoria (stale) o al fallback seguro.
        """
        # Sincronización con tests que resetean _cached_response a None
        if cls._cached_response is None:
            memory_cache.delete(CACHE_KEY)

        if not force_refresh and memory_cache.is_valid(CACHE_KEY):
            cached: Optional[BROUExchangeRateResponse] = memory_cache.get(CACHE_KEY)
            if cached:
                cls._cached_response = cached
                return cached

        rates = None
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(10.0, connect=5.0),
                follow_redirects=True
            ) as client:
                resp = await client.get(
                    BROU_COTIZACIONES_URL,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "Accept-Language": "es-UY,es;q=0.9,en;q=0.8"
                    }
                )
                if resp.status_code == 200:
                    rates = cls.parse_brou_html(resp.text)
        except Exception as exc:
            logger.warning("Fallo al conectar con servicio de cotizaciones BROU: %s. Utilizando contingencia.", exc)

        if rates:
            response = BROUExchangeRateResponse(
                source="BROU (Banco de la República Oriental del Uruguay)",
                currency_pair="USD/UYU",
                buy=rates["buy"],
                sell=rates["sell"],
                rate_used=rates["rate_used"],
                updated_at=datetime.now().isoformat()
            )
            cls._cached_response = response
            cls._cached_timestamp = time.time()
            memory_cache.set(CACHE_KEY, response, ttl_seconds=CACHE_TTL_SECONDS)
            logger.info("Cotización BROU actualizada exitosamente: 1 USD = %.2f UYU", response.rate_used)
            return response

        # Si falló la consulta pero teníamos una cotización previa en memoria, preservarla (stale)
        stale_response = memory_cache.get_stale(CACHE_KEY) or cls._cached_response
        if stale_response:
            logger.info("Utilizando cotización previa en memoria (stale) ante indisponibilidad remota.")
            cls._cached_response = stale_response
            return stale_response

        # Fallback de contingencia estricto (42.65 UYU) para no detener la operación
        logger.warning("Activando cotización de contingencia oficial: 1 USD = %.2f UYU", FALLBACK_RATE_USED)
        fallback_resp = BROUExchangeRateResponse(
            source="BROU (Banco de la República Oriental del Uruguay) [Modo Contingencia]",
            currency_pair="USD/UYU",
            buy=FALLBACK_BUY,
            sell=FALLBACK_SELL,
            rate_used=FALLBACK_RATE_USED,
            updated_at=datetime.now().isoformat()
        )
        cls._cached_response = fallback_resp
        cls._cached_timestamp = time.time()
        memory_cache.set(CACHE_KEY, fallback_resp, ttl_seconds=CACHE_TTL_SECONDS)
        return fallback_resp

    @classmethod
    def get_cached_rate_used_sync(cls) -> float:
        """
        Retorna sincrónicamente la tasa de cambio vigente (rate_used) para cálculos inmediatos.
        """
        cached = memory_cache.get_stale(CACHE_KEY)
        if cached:
            return cached.rate_used
        return FALLBACK_RATE_USED

    @classmethod
    async def get_usd_to_uyu_rate(cls) -> float:
        """
        Retorna la cotización del dólar en pesos uruguayos (UYU por cada USD).
        """
        data = await cls.fetch_brou_rate()
        return data.rate_used


async def get_brou_rate() -> float:
    """
    Función de acceso directo a la tasa de cambio BROU vigente (USD -> UYU).
    """
    return await ExchangeRateService.get_usd_to_uyu_rate()
