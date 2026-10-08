"""
Capa de Caché en Memoria con TTL (Time-To-Live) e Invalidación Thread-Safe.

Provee un gestor centralizado en memoria para evitar consultas redundantes a servicios externos
(BROU, Compras Estatales/ARCE, Scrapers) y garantiza alta disponibilidad mediante soporte
de datos 'stale' (retorno del último valor válido ante indisponibilidad o timeout remoto).
"""

from __future__ import annotations

import asyncio
import inspect
import logging
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass
class CacheEntry:
    value: Any
    created_at: float
    expires_at: Optional[float]

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return time.time() > self.expires_at


class InMemoryCache:
    """
    Gestor de caché en memoria thread-safe con soporte TTL y retención stale.
    """

    def __init__(self) -> None:
        self._store: Dict[str, CacheEntry] = {}
        self._lock = threading.RLock()

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """Almacena un valor en la caché con TTL en segundos."""
        now = time.time()
        expires_at = (now + ttl_seconds) if ttl_seconds is not None else None
        with self._lock:
            self._store[key] = CacheEntry(
                value=value,
                created_at=now,
                expires_at=expires_at
            )

    def get(self, key: str, default: Any = None) -> Any:
        """Retorna el valor si existe y no ha expirado; de lo contrario retorna default."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return default
            if entry.is_expired:
                return default
            return entry.value

    def get_stale(self, key: str, default: Any = None) -> Any:
        """
        Retorna el valor almacenado incluso si ha expirado.
        Ideal para contingencia ante caídas de proveedores externos.
        """
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return default
            return entry.value

    def is_valid(self, key: str) -> bool:
        """Indica si la clave existe y aún está dentro de su ventana de vigencia (TTL)."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return False
            return not entry.is_expired

    def delete(self, key: str) -> bool:
        """Elimina una entrada de la caché."""
        with self._lock:
            return self._store.pop(key, None) is not None

    def clear(self) -> None:
        """Purga todas las entradas de la caché."""
        with self._lock:
            self._store.clear()

    def size(self) -> int:
        """Cantidad de elementos registrados."""
        with self._lock:
            return len(self._store)

    def get_or_set(
        self,
        key: str,
        factory_func: Callable[[], T],
        ttl_seconds: int,
        fallback_to_stale: bool = True
    ) -> T:
        """
        Obtiene el valor de la caché. Si no está o expiró, ejecuta factory_func(),
        almacena el resultado y lo retorna. Si factory_func() falla y fallback_to_stale=True,
        retorna el último valor almacenado en caché.
        """
        if self.is_valid(key):
            val = self.get(key)
            if val is not None:
                return val

        try:
            val = factory_func()
            self.set(key, val, ttl_seconds=ttl_seconds)
            return val
        except Exception as exc:
            if fallback_to_stale:
                stale_val = self.get_stale(key)
                if stale_val is not None:
                    logger.warning(
                        "Fallo al refrescar caché para clave '%s': %s. Retornando valor stale en contingencia.",
                        key, exc
                    )
                    return stale_val
            raise

    async def async_get_or_set(
        self,
        key: str,
        factory_coro: Callable[[], Any],
        ttl_seconds: int,
        fallback_to_stale: bool = True
    ) -> Any:
        """
        Versión asincrónica de get_or_set para factories corutinas (ej. llamadas httpx.AsyncClient).
        """
        if self.is_valid(key):
            val = self.get(key)
            if val is not None:
                return val

        try:
            val = await factory_coro()
            self.set(key, val, ttl_seconds=ttl_seconds)
            return val
        except Exception as exc:
            if fallback_to_stale:
                stale_val = self.get_stale(key)
                if stale_val is not None:
                    logger.warning(
                        "Fallo al refrescar caché asíncrona para clave '%s': %s. Retornando valor stale en contingencia.",
                        key, exc
                    )
                    return stale_val
            raise


# Instancia singleton para toda la aplicación
memory_cache = InMemoryCache()
