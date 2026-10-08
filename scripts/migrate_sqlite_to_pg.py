#!/usr/bin/env python3
"""
scripts/migrate_sqlite_to_pg.py
Script ETL de migración y sincronización de datos desde SQLite (calcu.db) a PostgreSQL 16
utilizando el driver Pure-Python oficial pg8000 para compatibilidad corporativa con Windows AppLocker.

Funcionalidades:
1. Conecta a la base SQLite de origen y al clúster PostgreSQL de destino.
2. Aplica las migraciones de Alembic (0001_baseline) y crea la estructura completa DDL de SQLAlchemy.
3. Transfiere registros tabla por tabla respetando estrictamente el orden de claves foráneas.
4. Sincroniza secuencias numéricas (pg_get_serial_sequence) para evitar conflictos de ID autoincrementales.
5. Reporta una tabla resumen de entidades y filas transferidas.
"""

import os
import sys
import argparse
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

# Agregar raíz al sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import sqlalchemy as sa
from sqlalchemy import create_engine, text, MetaData, Table, inspect
from sqlalchemy.types import Boolean
from alembic.config import Config
from alembic import command

from app.models.base import Base
import app.models.entities  # Registra modelos de catálogo e inventario
import app.domain.models   # Registra modelos de dominio, CRM y auditoría

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("MigrateETL")

# Orden estricto de migración respetando dependencias de Foreign Keys (BCNF)
TABLE_ORDER = [
    # 1. Estructura Organizacional BCNF
    "areas",
    "responsables_organizacion",
    "centros_costo",
    "canales_comerciales",

    # 2. Catálogo y Finanzas Base
    "categorias",
    "presupuestos_centros_costo",
    "productos",

    # 3. Ubicaciones Físicas e Inventario
    "warehouses",
    "inventarios",
    "inventario",
    "stock_location_batches",

    # 4. Operaciones, Compras y Reposición
    "ordenes_compra",
    "ordenes_compra_detalles",
    "ordenes_reposicion",

    # 5. Licitaciones ARCE y Oportunidades CRM (Precede a órdenes de venta)
    "tenders",
    "tender_items",
    "commercial_deals",
    "commercial_deal_items",

    # 6. Ventas y Presupuesto Comercial
    "transacciones_ventas",
    "sales_orders",
    "sales_order_items",
    "presupuestos_metas",
    "presupuestos_versiones",

    # 7. Auditoría, Gobernanza y Preferencias
    "user_preferences",
    "audit_logs",
    "acciones_compromisos",
]


def apply_alembic_and_schema(pg_url: str, pg_engine: sa.Engine):
    """Garantiza la aplicación de migraciones Alembic y la creación del esquema en PostgreSQL."""
    logger.info("Verificando y aplicando migraciones Alembic sobre PostgreSQL...")
    try:
        alembic_ini_path = root_dir / "alembic.ini"
        if alembic_ini_path.exists():
            alembic_cfg = Config(str(alembic_ini_path))
            alembic_cfg.set_main_option("sqlalchemy.url", pg_url)
            command.upgrade(alembic_cfg, "head")
            logging.getLogger().setLevel(logging.INFO)
            for h in logging.getLogger().handlers:
                h.setLevel(logging.INFO)
            logger.info("Migraciones Alembic aplicadas exitosamente.")
        else:
            logger.warning("alembic.ini no encontrado en %s, recurriendo a Base.metadata.create_all.", alembic_ini_path)
    except Exception as e:
        logger.warning("Aviso durante ejecución de Alembic: %s. Procediendo con sincronización de metadatos.", e)

    logger.info("Asegurando creación de todas las tablas BCNF en PostgreSQL...")
    Base.metadata.create_all(bind=pg_engine)


def reset_pg_sequence(conn: sa.Connection, table_name: str, id_col: str = "id"):
    """Actualiza el cursor de secuencia de PostgreSQL para evitar colisiones en futuros inserts."""
    try:
        seq_query = text(f"SELECT pg_get_serial_sequence('\"{table_name}\"', :col)")
        seq_name = conn.execute(seq_query, {"col": id_col}).scalar()
        if seq_name:
            reset_sql = text(f"""
                SELECT setval(
                    :seq,
                    COALESCE((SELECT MAX("{id_col}") FROM "{table_name}"), 1),
                    (SELECT MAX("{id_col}") FROM "{table_name}") IS NOT NULL
                )
            """)
            conn.execute(reset_sql, {"seq": seq_name})
            logger.debug("Secuencia '%s' de tabla '%s' actualizada.", seq_name, table_name)
    except Exception as e:
        logger.debug("No se actualizó secuencia para %s.%s: %s", table_name, id_col, e)


def migrate_data(sqlite_engine: sa.Engine, pg_engine: sa.Engine, dry_run: bool = False) -> Dict[str, int]:
    """Ejecuta la extracción, transformación y carga (ETL) tabla por tabla."""
    sqlite_insp = inspect(sqlite_engine)
    pg_insp = inspect(pg_engine)

    sqlite_tables = set(sqlite_insp.get_table_names())
    pg_tables = set(pg_insp.get_table_names())

    migration_report: Dict[str, int] = {}

    with pg_engine.begin() as pg_conn:
        for table_name in TABLE_ORDER:
            if table_name not in sqlite_tables:
                continue

            if table_name not in pg_tables:
                logger.warning("Tabla '%s' no existe en PostgreSQL destino. Omitiendo.", table_name)
                continue

            # Obtener columnas e información de tipos destino en PostgreSQL
            pg_col_map = {col["name"]: col for col in pg_insp.get_columns(table_name)}
            pg_columns = set(pg_col_map.keys())

            # Leer registros desde SQLite
            with sqlite_engine.connect() as sqlite_conn:
                rows_query = text(f'SELECT * FROM "{table_name}"')
                result = sqlite_conn.execute(rows_query)
                raw_rows = [dict(row._mapping) for row in result]

            if not raw_rows:
                migration_report[table_name] = 0
                continue

            # Filtrar y normalizar registros
            clean_rows = []
            for row in raw_rows:
                clean_row = {}
                for k, v in row.items():
                    if k in pg_columns:
                        col_info = pg_col_map.get(k)
                        # Normalizar enteros a booleanos si la columna de destino es booleana
                        if col_info and isinstance(col_info.get("type"), Boolean) and isinstance(v, int):
                            clean_row[k] = bool(v)
                        else:
                            clean_row[k] = v
                clean_rows.append(clean_row)

            # Sanitización de claves foráneas huérfanas
            if table_name == "sales_orders":
                existing_deals = {r[0] for r in pg_conn.execute(text("SELECT id FROM commercial_deals")).fetchall()}
                for row in clean_rows:
                    if row.get("deal_id") and row.get("deal_id") not in existing_deals:
                        logger.warning("Sales Order %s referencia deal_id %s inexistente. Ajustando a NULL.", row.get("id"), row.get("deal_id"))
                        row["deal_id"] = None
            elif table_name == "sales_order_items":
                existing_so = {r[0] for r in pg_conn.execute(text("SELECT id FROM sales_orders")).fetchall()}
                clean_rows = [r for r in clean_rows if r.get("sales_order_id") in existing_so]

            logger.info("Migrando '%s': %d registros detectados...", table_name, len(clean_rows))

            if not dry_run:
                target_meta = MetaData()
                target_table = Table(table_name, target_meta, autoload_with=pg_engine)

                # Carga en batches de 500 registros
                batch_size = 500
                for i in range(0, len(clean_rows), batch_size):
                    batch = clean_rows[i:i + batch_size]
                    pg_conn.execute(target_table.insert(), batch)

                # Resetear secuencias numéricas si la tabla contiene 'id'
                if "id" in pg_columns:
                    reset_pg_sequence(pg_conn, table_name, "id")

                migration_report[table_name] = len(clean_rows)
                logger.info("✓ Tabla '%s' migrada exitosamente (%d filas).", table_name, len(clean_rows))
            else:
                migration_report[table_name] = len(clean_rows)
                logger.info("[DRY-RUN] Tabla '%s': %d filas simuladas.", table_name, len(clean_rows))

    total_rows = sum(migration_report.values())
    print("\n" + "=" * 65)
    print(f"RESUMEN DE MIGRACIÓN ETL: {total_rows} registros transferidos a PostgreSQL 16")
    print("=" * 65)
    for t_name, count in migration_report.items():
        if count > 0:
            print(f"  • {t_name:<30} : {count:>5} filas")
    print("=" * 65 + "\n")
    return migration_report


def main():
    parser = argparse.ArgumentParser(description="Migración ETL de SQLite (calcu.db) a PostgreSQL 16 con pg8000")
    parser.add_argument(
        "--sqlite-path",
        default="calcu.db",
        help="Ruta al archivo de base de datos SQLite (default: calcu.db)"
    )
    parser.add_argument(
        "--pg-url",
        default=os.getenv("DATABASE_URL", "postgresql+pg8000://calcu_user:calcu_secure_pass_2026@localhost:5432/calcu_db"),
        help="URL de conexión a PostgreSQL destino"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Ejecutar en modo simulación sin persistir cambios en PostgreSQL"
    )
    parser.add_argument(
        "--skip-alembic",
        action="store_true",
        help="Omitir ejecución previa de Alembic"
    )

    args = parser.parse_args()

    sqlite_full_path = Path(args.sqlite_path).resolve()
    if not sqlite_full_path.exists():
        logger.error("Error: archivo SQLite no encontrado en %s", sqlite_full_path)
        sys.exit(1)

    sqlite_url = f"sqlite:///{sqlite_full_path}"
    logger.info("Conectando a SQLite origen: %s", sqlite_url)
    sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

    logger.info("Conectando a PostgreSQL destino: %s", args.pg_url.split("@")[-1] if "@" in args.pg_url else args.pg_url)
    try:
        pg_engine = create_engine(args.pg_url, pool_pre_ping=True)
    except Exception as e:
        logger.error("Error al instanciar motor de PostgreSQL: %s", e)
        sys.exit(1)

    if not args.skip_alembic and not args.dry_run:
        try:
            apply_alembic_and_schema(args.pg_url, pg_engine)
        except Exception as e:
            logger.error("Error aplicando esquemas en PostgreSQL: %s", e)
            logger.info("Asegúrese de que el contenedor de PostgreSQL esté activo con: docker-compose up -d")
            sys.exit(1)

    try:
        migrate_data(sqlite_engine, pg_engine, dry_run=args.dry_run)
    except Exception as e:
        logger.error("Error durante el proceso de migración de datos: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
