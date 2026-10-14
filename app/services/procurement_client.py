"""
Cliente Asíncrono Centralizado para la API de Compras Estatales y Licitaciones de Uruguay
(Con la Tuya / SICE / ARCE - https://conlatuya.checkleaked.cc/api)

Diseñado con:
  - Manejo asíncrono httpx de alta concurrencia
  - Inyección segura de API Key (x-api-key)
  - Respeto del límite de 600 req/min
  - Capa de caché en memoria con TTL de 15 minutos (900s) para consultas analíticas pesadas
  - Codificación segura de identificadores con caracteres especiales (RUPE X/...)
  - Manejo de excepciones resiliente con datos defensivos
"""

from __future__ import annotations

import logging
import urllib.parse
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings
from app.services.cache_service import memory_cache

logger = logging.getLogger(__name__)

CACHE_TTL_ANALYTICS = 900  # 15 minutos
CACHE_TTL_CALLS = 180      # 3 minutos para llamados en vivo
DEFAULT_TIMEOUT = 25.0


class ProcurementClient:
    """
    Cliente oficial de Calcu Suite para interactuar con la API de Compras Estatales de Uruguay.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        self.base_url = (base_url or settings.conlatuya_base_url).rstrip("/")
        self.api_key = api_key or settings.conlatuya_api_key
        self.timeout = timeout

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/json",
            "User-Agent": "Calcu-Procurement-Hub/2.0 (Uruguay B2B Supply & Intelligence Suite)",
        }
        if self.api_key:
            headers["x-api-key"] = self.api_key
        return headers

    async def _get(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        cache_ttl: Optional[int] = None,
        use_cache: bool = True,
    ) -> Dict[str, Any]:
        """
        Ejecuta una petición GET contra la API con soporte de caché en memoria y resiliencia.
        """
        clean_params = {k: v for k, v in (params or {}).items() if v is not None}
        query_str = urllib.parse.urlencode(sorted(clean_params.items()))
        cache_key = f"procurement:{endpoint}:{query_str}"

        if use_cache and cache_ttl is not None:
            cached_data = memory_cache.get(cache_key)
            if cached_data is not None:
                return cached_data

        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = self._get_headers()

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=headers, params=clean_params)

                if response.status_code == 200:
                    data = response.json()
                    if use_cache and cache_ttl is not None:
                        memory_cache.set(cache_key, data, ttl_seconds=cache_ttl)
                    return data
                elif response.status_code == 404:
                    logger.warning("Procurement API 404 para %s (params: %s)", url, clean_params)
                    return {"success": False, "status_code": 404, "data": None, "message": "Recurso no encontrado en compras estatales"}
                elif response.status_code == 429:
                    logger.error("Rate limit de Procurement API alcanzado (600 req/min).")
                    return {"success": False, "status_code": 429, "data": None, "message": "Límite de peticiones excedido"}
                else:
                    logger.warning("Procurement API HTTP %s: %s", response.status_code, response.text[:200])
                    return {
                        "success": False,
                        "status_code": response.status_code,
                        "data": None,
                        "message": f"Error del servidor remoto ({response.status_code})",
                    }
        except httpx.TimeoutException:
            logger.error("Timeout al consultar Procurement API: %s", url)
            return {"success": False, "status_code": 504, "data": None, "message": "Tiempo de espera agotado al consultar compras estatales"}
        except Exception as exc:
            logger.exception("Error de red conectando con Procurement API: %s", exc)
            return {"success": False, "status_code": 500, "data": None, "message": str(exc)}

    # =========================================================================
    # TAB 1: RADAR DE CONVOCATORIAS EN VIVO
    # =========================================================================

    async def get_open_calls(
        self,
        limit: int = 20,
        offset: int = 0,
        page: Optional[int] = None,
        query: Optional[str] = None,
        buyer: Optional[str] = None,
        category: Optional[str] = None,
        method: Optional[str] = None,
        sort: Optional[str] = None,
        ends_before: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Obtiene convocatorias públicas abiertas en vivo con paginación acumulativa.
        """
        calc_page = page if page is not None else ((offset // max(1, limit)) + 1)
        params: Dict[str, Any] = {
            "page": calc_page,
            "limit": limit,
        }
        if query:
            params["q"] = query
        if buyer:
            params["buyer"] = buyer
        if category:
            params["category"] = category
        if method:
            params["method"] = method
        if sort:
            params["sort"] = sort
        if ends_before:
            params["endsBefore"] = ends_before

        return await self._get("open-calls", params=params, cache_ttl=CACHE_TTL_CALLS)

    async def get_call_detail(self, compra_id: str) -> Dict[str, Any]:
        """
        Obtiene el detalle completo de un llamado por su identificador de compra.
        """
        encoded_id = urllib.parse.quote(str(compra_id).strip(), safe="")
        return await self._get(f"open-calls/{encoded_id}", cache_ttl=CACHE_TTL_CALLS)

    async def get_call_summary(self, compra_id: str) -> Dict[str, Any]:
        """
        Obtiene el resumen estructurado de pliego generado por IA (objeto, plazos, garantías, requisitos).
        """
        encoded_id = urllib.parse.quote(str(compra_id).strip(), safe="")
        return await self._get(f"open-calls/{encoded_id}/summary", cache_ttl=CACHE_TTL_ANALYTICS)

    async def get_call_benchmarks(self, compra_id: str) -> Dict[str, Any]:
        """
        Obtiene los precios de referencia históricos y percentiles (p25, p50, p75, p95) para las partidas del pliego.
        """
        encoded_id = urllib.parse.quote(str(compra_id).strip(), safe="")
        return await self._get(f"open-calls/{encoded_id}/benchmarks", cache_ttl=CACHE_TTL_ANALYTICS)

    # =========================================================================
    # TAB 2: INTELIGENCIA DE PRECIOS & BENCHMARKS SICE/CUBS
    # =========================================================================

    async def search_products(
        self,
        query: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
        sort_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Busca productos y códigos de catálogo SICE/CUBS con analítica de compras históricas.
        """
        params: Dict[str, Any] = {
            "page": page,
            "limit": limit,
        }
        if query:
            params["q"] = query
        if sort_by:
            params["sortBy"] = sort_by

        return await self._get("analytics/products", params=params, cache_ttl=CACHE_TTL_ANALYTICS)

    async def get_product_analytics(self, product_code: str) -> Dict[str, Any]:
        """
        Obtiene la dispersión de precios, percentiles y baselines de un código SICE.
        """
        encoded_code = urllib.parse.quote(str(product_code).strip(), safe="")
        return await self._get(f"analytics/products/{encoded_code}", cache_ttl=CACHE_TTL_ANALYTICS)

    # =========================================================================
    # TAB 3: ANÁLISIS DE COMPETIDORES (PROVEEDORES)
    # =========================================================================

    async def search_suppliers(
        self,
        query: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Buscador de proveedores y empresas adjudicatarias del Estado uruguayo.
        """
        params: Dict[str, Any] = {
            "page": page,
            "limit": limit,
        }
        if query:
            params["search"] = query
        if sort_by:
            params["sortBy"] = sort_by
        if sort_order:
            params["sortOrder"] = sort_order

        return await self._get("suppliers", params=params, cache_ttl=CACHE_TTL_ANALYTICS)

    async def get_supplier_autocomplete(self, query: str, limit: int = 10) -> Dict[str, Any]:
        """
        Autocompletado predictivo de nombres y RUTs de proveedores en RUPE.
        """
        params = {"search": query, "limit": limit}
        return await self._get("suppliers/autocomplete", params=params, cache_ttl=300)

    async def get_supplier_detail(self, supplier_id: str) -> Dict[str, Any]:
        """
        Ficha exhaustiva del competidor: contratos adjudicados, organismos compradores, RUT y montos.
        """
        encoded_id = urllib.parse.quote(str(supplier_id).strip(), safe="")
        return await self._get(f"suppliers/{encoded_id}", cache_ttl=CACHE_TTL_ANALYTICS)

    async def get_top_suppliers(
        self,
        limit: int = 15,
        year: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Ranking de los principales proveedores adjudicatarios por volumen de facturación estatal.
        """
        params: Dict[str, Any] = {"limit": limit}
        if year:
            params["year"] = year
        return await self._get("analytics/top-suppliers", params=params, cache_ttl=CACHE_TTL_ANALYTICS)

    # =========================================================================
    # TAB 4: RADIOGRAFÍA DE COMPRADORES & INTENDENCIAS
    # =========================================================================

    async def get_buyers(
        self,
        query: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Listado de organismos públicos compradores (Ministerios, Entes Autónomos, Servicios Descentralizados).
        """
        params: Dict[str, Any] = {
            "page": page,
            "limit": limit,
        }
        if query:
            params["search"] = query
        if sort_by:
            params["sortBy"] = sort_by
        if sort_order:
            params["sortOrder"] = sort_order

        return await self._get("buyers", params=params, cache_ttl=CACHE_TTL_ANALYTICS)

    async def get_buyer_detail(self, buyer_id: str) -> Dict[str, Any]:
        """
        Detalle y estadísticas de compra de un organismo específico.
        """
        encoded_id = urllib.parse.quote(str(buyer_id).strip(), safe="")
        return await self._get(f"buyers/{encoded_id}", cache_ttl=CACHE_TTL_ANALYTICS)

    async def get_intendencias_stats(self) -> Dict[str, Any]:
        """
        Radiografía de compras de las 19 Intendencias Departamentales de Uruguay.
        """
        return await self._get("analytics/intendencias", cache_ttl=CACHE_TTL_ANALYTICS)

    # =========================================================================
    # TAB 5: CALENDARIO DE VENCIMIENTOS
    # =========================================================================

    async def get_calendar(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Calendario de llamados guardados y próximos cierres de ofertas.
        Si la cuenta remota aún no tiene cierres configurados en /api/calendar,
        completa automáticamente con los próximos vencimientos activos de /open-calls.
        """
        remote_cal = await self._get("calendar", cache_ttl=CACHE_TTL_CALLS)
        items = []
        if remote_cal.get("success") and isinstance(remote_cal.get("data"), dict):
            items = remote_cal["data"].get("items") or []

        # Si el calendario remoto está vacío, completamos con los llamados activos próximos a vencer
        if not items:
            open_resp = await self.get_open_calls(limit=40, sort="closingSoon")
            if open_resp.get("success") and isinstance(open_resp.get("data"), dict):
                calls = open_resp["data"].get("calls") or []
                for call in calls:
                    tp = call.get("tenderPeriod") or {}
                    end_dt = tp.get("endDate")
                    buyer_info = call.get("buyer") or {}
                    items.append({
                        "compraId": str(call.get("compraId") or call.get("id") or ""),
                        "title": call.get("title") or "Licitación Pública",
                        "buyer": buyer_info.get("name") or "Organismo Estatal",
                        "status": call.get("status") or "ACTIVE",
                        "endDate": end_dt,
                        "sourceUrl": call.get("ocid"),
                        "saved": False,
                        "matched": True,
                        "category": call.get("classificationSet") or [],
                    })

        # Filtrado opcional por fechas
        if start_date or end_date:
            filtered_items = []
            for it in items:
                it_end = it.get("endDate")
                if not it_end:
                    filtered_items.append(it)
                    continue
                try:
                    it_date_str = it_end.split("T")[0]
                    if start_date and it_date_str < start_date:
                        continue
                    if end_date and it_date_str > end_date:
                        continue
                    filtered_items.append(it)
                except Exception:
                    filtered_items.append(it)
            items = filtered_items

        return {
            "success": True,
            "data": {
                "items": items,
                "total": len(items),
                "timestamp": datetime.now().isoformat(),
            }
        }


# Instancia singleton del cliente
procurement_client = ProcurementClient()
