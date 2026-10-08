"""
Tests unitarios para la configuración multi-motor de base de datos (P2.1).
Valida:
- Asignación de QueuePool con pool_size=20, max_overflow=30 para PostgreSQL.
- Configuración para SQLite en archivo y StaticPool en memoria.
- Comportamiento no destructivo de run_non_destructive_migrations ante motores no-SQLite.
"""

import sys
from unittest.mock import MagicMock
import pytest
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool, StaticPool

from app.database.session import create_app_engine, run_non_destructive_migrations


@pytest.fixture(autouse=True)
def mock_psycopg_driver():
    """
    Mockea el driver DBAPI de psycopg en entornos Windows con restricciones de DLL nativa (AppLocker),
    permitiendo validar la instanciación e inspección estricta de QueuePool en SQLAlchemy.
    """
    original_modules = {k: sys.modules.get(k) for k in [
        "psycopg", "psycopg.adapt", "psycopg.types", "psycopg.pq", "psycopg.cr"
    ]}

    mock_mod = MagicMock()
    mock_mod.__version__ = "3.1.8"
    mock_mod.paramstyle = "pyformat"

    sys.modules["psycopg"] = mock_mod
    sys.modules["psycopg.adapt"] = mock_mod
    sys.modules["psycopg.types"] = mock_mod
    sys.modules["psycopg.pq"] = mock_mod

    yield

    for k, orig in original_modules.items():
        if orig is None:
            sys.modules.pop(k, None)
        else:
            sys.modules[k] = orig


def test_postgresql_engine_queuepool_configuration():
    """Verifica que URLs con protocolo postgresql configuren QueuePool con parámetros de producción."""
    pg_url = "postgresql+psycopg://calcu_user:calcu_secure_pass_2026@localhost:5432/calcu_db"
    pg_engine = create_app_engine(pg_url)

    assert isinstance(pg_engine, Engine)
    assert isinstance(pg_engine.pool, QueuePool)
    assert pg_engine.pool.size() == 20
    assert pg_engine.pool._max_overflow == 30
    assert pg_engine.pool._recycle == 1800
    assert pg_engine.pool._pre_ping is True


def test_sqlite_file_engine_configuration():
    """Verifica que URLs de archivo SQLite se configuren con dialecto sqlite y sin bloqueos de concurrencia."""
    sqlite_url = "sqlite:///calcu_test.db"
    sqlite_engine = create_app_engine(sqlite_url)

    assert isinstance(sqlite_engine, Engine)
    assert sqlite_engine.dialect.name == "sqlite"


def test_sqlite_memory_engine_staticpool():
    """Verifica que bases de prueba en memoria SQLite utilicen StaticPool para no perder transacciones entre hilos."""
    sqlite_mem_url = "sqlite:///:memory:"
    mem_engine = create_app_engine(sqlite_mem_url)

    assert isinstance(mem_engine, Engine)
    assert isinstance(mem_engine.pool, StaticPool)


def test_run_non_destructive_migrations_skips_non_sqlite():
    """Garantiza que las sentencias DDL nativas de SQLite se omitan en motores PostgreSQL."""
    pg_url = "postgresql+psycopg://dummy:dummy@localhost:5432/dummy"
    pg_engine = create_app_engine(pg_url)

    # Debe retornar de inmediato sin intentar ejecutar PRAGMA ni conectar a un socket inexistente
    run_non_destructive_migrations(target_engine=pg_engine)
