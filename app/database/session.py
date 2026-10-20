import os
import logging
from typing import Optional
from datetime import date, timedelta
import jwt
from fastapi import Request
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool, StaticPool, NullPool
from sqlalchemy.orm import sessionmaker, Session
from app.models.base import Base
from app.core.config import DATABASE_URL as DEFAULT_DATABASE_URL, settings


logger = logging.getLogger(__name__)

DATABASE_URL = (os.environ.get("DATABASE_URL") or getattr(settings, "database_url", DEFAULT_DATABASE_URL) or DEFAULT_DATABASE_URL).strip()


def create_app_engine(database_url: str) -> Engine:
    """
    Factoría de motor SQLAlchemy con soporte dual de infraestructura:
    - PostgreSQL: QueuePool (pool_size=20, max_overflow=30, recycle=1800s, pre_ping=True).
    - SQLite: Conexión monohilo desactivada y StaticPool en bases en memoria.
    """
    database_url = database_url.strip()
    if "@localhost:" in database_url:
        database_url = database_url.replace("@localhost:", "@127.0.0.1:")
    if database_url.startswith("postgresql"):
        return create_engine(
            database_url,
            poolclass=QueuePool,
            pool_size=20,
            max_overflow=30,
            pool_recycle=1800,
            pool_pre_ping=True,
        )
    else:
        engine_kwargs = {
            "connect_args": {"check_same_thread": False},
        }
        if ":memory:" in database_url:
            engine_kwargs["poolclass"] = StaticPool
        return create_engine(database_url, **engine_kwargs)


engine = create_app_engine(DATABASE_URL)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Garantiza claves foráneas activas únicamente en conexiones de SQLite sin alterar PostgreSQL."""
    try:
        import sqlite3
        if isinstance(dbapi_connection, sqlite3.Connection):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    except Exception:
        pass


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base de datos Sandbox totalmente aislada para usuario demo
DEMO_DATABASE_URL = (os.environ.get("DEMO_DATABASE_URL") or "sqlite:///calcu_demo.db").strip()
engine_demo = create_app_engine(DEMO_DATABASE_URL)
SessionDemo = sessionmaker(autocommit=False, autoflush=False, bind=engine_demo)



def sync_table_columns(conn):
    """
    Sincroniza y asegura que todas las columnas añadidas a los modelos
    existan en las tablas físicas de la base de datos, soportando de forma
    nativa e idéntica tanto PostgreSQL 16 (pg8000/psycopg2) como SQLite.
    Es no destructivo y totalmente idempotente.
    """
    from sqlalchemy import inspect
    try:
        inspector = inspect(conn)
        existing_tables = set(inspector.get_table_names())
    except Exception as e:
        logger.warning("No se pudo inspeccionar las tablas para sincronización: %s", e)
        return

    def add_col_if_missing(table: str, col: str, col_type: str, default: str = None):
        if table not in existing_tables:
            return
        try:
            current_cols = {c["name"] for c in inspector.get_columns(table)}
            if col not in current_cols:
                def_part = f" DEFAULT {default}" if default else ""
                sql = f"ALTER TABLE {table} ADD COLUMN {col} {col_type}{def_part}"
                conn.execute(text(sql))
                conn.commit()
                logger.info("Migración no destructiva multi-dialecto: columna '%s' añadida a tabla '%s'.", col, table)
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            logger.warning("No se pudo añadir columna '%s' a '%s': %s", col, table, e)

    # 1. stock_location_batches (Multi-Depósito, Dual-SKU y Fechas de fabricación)
    add_col_if_missing("stock_location_batches", "fecha_terminado", "DATE")
    add_col_if_missing("stock_location_batches", "sku_fabrica", "VARCHAR(100)")
    add_col_if_missing("stock_location_batches", "lote_fabrica", "VARCHAR(100)")
    add_col_if_missing("stock_location_batches", "supplier_id", "INTEGER")
    add_col_if_missing("stock_location_batches", "warehouse_id", "VARCHAR(50)")

    add_col_if_missing("stock_location_batches", "estado_aprobacion", "VARCHAR(30)", "'APROBADO'")
    add_col_if_missing("stock_location_batches", "costo_compra", "NUMERIC(14, 4)")

    # 2. suppliers (Directorio de Fábricas y Navieras/Buques)
    add_col_if_missing("suppliers", "tipo_proveedor", "VARCHAR(50)", "'FABRICA'")
    add_col_if_missing("suppliers", "razon_social", "VARCHAR(200)")
    add_col_if_missing("suppliers", "pais", "VARCHAR(100)", "'China'")
    add_col_if_missing("suppliers", "contacto_nombre", "VARCHAR(100)")
    add_col_if_missing("suppliers", "contacto_cargo", "VARCHAR(100)")
    add_col_if_missing("suppliers", "descripcion", "TEXT")
    add_col_if_missing("suppliers", "rubro", "VARCHAR(100)", "'Iluminación'")
    add_col_if_missing("suppliers", "condicion_pago", "VARCHAR(50)", "'30 días'")

    # 3. warehouses (Nodos Logísticos Internacionales y Nacionales)
    add_col_if_missing("warehouses", "pais", "VARCHAR(100)", "'Uruguay'")

    # 4. commercial_deals (CRM B2B & Atribución Multicanal AdTech)
    add_col_if_missing("commercial_deals", "rut", "VARCHAR(50)")
    add_col_if_missing("commercial_deals", "canal_origen", "VARCHAR(50)", "'MANUAL'")
    add_col_if_missing("commercial_deals", "utm_source", "VARCHAR(150)")
    add_col_if_missing("commercial_deals", "utm_medium", "VARCHAR(150)")
    add_col_if_missing("commercial_deals", "utm_campaign", "VARCHAR(150)")
    add_col_if_missing("commercial_deals", "external_lead_id", "VARCHAR(100)")
    add_col_if_missing("commercial_deals", "costo_adquisicion_estimado", "NUMERIC(14, 4)", "0.0")
    add_col_if_missing("commercial_deals", "ai_score", "INTEGER", "75")
    add_col_if_missing("commercial_deals", "ai_classification", "VARCHAR(50)", "'WARM'")

    # 5. centros_costo & acciones_compromisos (BCNF)
    add_col_if_missing("centros_costo", "area_id", "INTEGER")
    add_col_if_missing("centros_costo", "responsable_id", "INTEGER")
    add_col_if_missing("acciones_compromisos", "monto", "NUMERIC(14, 4)", "0.0")
    add_col_if_missing("acciones_compromisos", "urgencia", "VARCHAR(20)", "'MEDIA'")
    add_col_if_missing("acciones_compromisos", "area_id", "VARCHAR(50)")
    add_col_if_missing("acciones_compromisos", "responsable_id", "VARCHAR(50)")

    # 6. categorias & productos
    add_col_if_missing("categorias", "created_at", "TIMESTAMP")
    add_col_if_missing("productos", "image_url", "VARCHAR(500)")

    # 6.1. Warehouses (Multi-Depósito Gemelo Digital 3D & Module Scope)
    add_col_if_missing("warehouses", "module_scope", "VARCHAR(30)", "'SUPPLY_CHAIN'")
    add_col_if_missing("warehouses", "superficie_m2", "NUMERIC(14, 4)", "1200.0000")
    add_col_if_missing("warehouses", "volumen_max_m3", "NUMERIC(14, 4)", "7200.0000")
    add_col_if_missing("warehouses", "capacidad_peso_kg", "NUMERIC(14, 4)", "500000.0000")
    add_col_if_missing("warehouses", "altura_max_m", "NUMERIC(14, 4)", "8.5000")
    add_col_if_missing("warehouses", "width_m", "NUMERIC(14, 4)", "50.0000")
    add_col_if_missing("warehouses", "length_m", "NUMERIC(14, 4)", "100.0000")
    add_col_if_missing("warehouses", "clear_height_m", "NUMERIC(14, 4)", "12.0000")

    # 6.2. Warehouse Slots (Geometría Paramétrica Real de Racks, Cajas y Catálogo)
    add_col_if_missing("warehouse_slots", "rack_width_m", "NUMERIC(14, 4)", "2.4000")
    add_col_if_missing("warehouse_slots", "rack_height_m", "NUMERIC(14, 4)", "6.0000")
    add_col_if_missing("warehouse_slots", "rack_depth_m", "NUMERIC(14, 4)", "1.2000")
    add_col_if_missing("warehouse_slots", "levels_count", "INTEGER", "4")
    add_col_if_missing("warehouse_slots", "max_rack_weight_kg", "NUMERIC(14, 4)", "3000.0000")
    add_col_if_missing("warehouse_slots", "box_width_m", "NUMERIC(14, 4)", "0.4000")
    add_col_if_missing("warehouse_slots", "box_height_m", "NUMERIC(14, 4)", "0.3000")
    add_col_if_missing("warehouse_slots", "box_length_m", "NUMERIC(14, 4)", "0.4000")
    add_col_if_missing("warehouse_slots", "unit_weight_kg", "NUMERIC(14, 4)", "5.0000")
    add_col_if_missing("warehouse_slots", "units_count", "INTEGER", "1")
    add_col_if_missing("warehouse_slots", "real_product_id", "INTEGER")

    # 7. ordenes_compra (Plaza Local / Reventa)
    add_col_if_missing("ordenes_compra", "tipo_orden", "VARCHAR(30)", "'IMPORTACION'")
    add_col_if_missing("ordenes_compra", "fecha_disponible", "DATE")
    add_col_if_missing("ordenes_compra", "monto_total", "NUMERIC(14, 4)", "0.0")

    # 7.1. 3PL Logística & Distribución (Campos nuevos de picking, disponibilidad y sucursales)
    add_col_if_missing("logistics_drivers", "modalidad_pago", "VARCHAR(30)", "'VIAJE_KM'")
    add_col_if_missing("logistics_drivers", "tarifa_hora", "NUMERIC(14, 4)", "0.0")
    add_col_if_missing("logistics_drivers", "tarifa_jornal", "NUMERIC(14, 4)", "0.0")
    add_col_if_missing("logistics_drivers", "disponibilidad_semanal", "TEXT")
    add_col_if_missing("logistics_dispatch_orders", "branch_id", "INTEGER")
    add_col_if_missing("logistics_dispatch_orders", "responsable_armado", "VARCHAR(150)")
    add_col_if_missing("logistics_dispatch_orders", "contacto_receptor_nombre", "VARCHAR(150)")
    add_col_if_missing("logistics_dispatch_orders", "contacto_receptor_telefono", "VARCHAR(50)")
    add_col_if_missing("logistics_dispatch_orders", "kilometros_recorrido", "NUMERIC(14, 4)", "0.0")
    add_col_if_missing("logistics_dispatch_orders", "tipo_despacho", "VARCHAR(50)", "'ESTANDAR'")
    add_col_if_missing("logistics_dispatch_orders", "firma_digital_receptor", "TEXT")

    # 7.2. Auditoría y Monitoreo Perimetral
    add_col_if_missing("audit_logs", "ip_address", "VARCHAR(50)", "'100.64.0.1'")
    add_col_if_missing("audit_logs", "ubicacion", "VARCHAR(100)", "'Montevideo (Nodo Tailscale Central)'")
    add_col_if_missing("audit_logs", "evento_realizado", "VARCHAR(255)")
    add_col_if_missing("audit_logs", "severidad", "VARCHAR(20)", "'INFO'")
    add_col_if_missing("logistics_dispatch_orders", "firma_fecha_hora", "TIMESTAMP")
    add_col_if_missing("logistics_dispatch_orders", "firma_aclaracion", "VARCHAR(150)")

    # 7.3. Clientes B2B & Consumidor Final (Límite de crédito y documento CI/RUT)
    add_col_if_missing("clients", "razon_social", "VARCHAR(200)")
    add_col_if_missing("clients", "nombre_fantasia", "VARCHAR(200)")
    add_col_if_missing("clients", "documento", "VARCHAR(50)")
    add_col_if_missing("clients", "tipo_documento", "VARCHAR(20)", "'RUT'")
    add_col_if_missing("clients", "es_consumidor_final", "BOOLEAN", "FALSE")
    add_col_if_missing("clients", "limite_credito", "NUMERIC(14, 4)", "200.0")

    # 7.4. Facturación B2B & Notas de Crédito
    add_col_if_missing("invoices", "cliente_documento", "VARCHAR(50)")
    add_col_if_missing("invoices", "tipo_documento_receptor", "VARCHAR(20)", "'RUT'")
    add_col_if_missing("invoices", "es_consumidor_final", "BOOLEAN", "FALSE")
    add_col_if_missing("invoices", "orden_compra_ref", "VARCHAR(50)")
    add_col_if_missing("invoices", "factura_referencia_id", "INTEGER")

    # 7.4.1. Normalización BCNF / 3NF / 1NF
    add_col_if_missing("commercial_deals", "client_id", "INTEGER")
    if "collection_cases" in existing_tables and "invoices" in existing_tables and "collection_case_invoices" not in existing_tables:
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS collection_case_invoices (
                    case_id INTEGER NOT NULL REFERENCES collection_cases(id) ON DELETE CASCADE,
                    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                    PRIMARY KEY (case_id, invoice_id)
                )
            """))
            conn.commit()
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            logger.debug("Silenced collection_case_invoices creation: %s", e)


    # 7.5. Usuarios del Sistema, Multi-Tenancy & 2FA
    add_col_if_missing("system_users", "password_hash", "VARCHAR(255)")
    add_col_if_missing("system_users", "tenant_id", "VARCHAR(50)", "'tenant_calcu_corp'")
    add_col_if_missing("system_users", "two_factor_enabled", "BOOLEAN", "FALSE")
    add_col_if_missing("system_users", "two_factor_secret_encrypted", "VARCHAR(255)")
    add_col_if_missing("system_users", "is_master_superadmin", "BOOLEAN", "FALSE")
    add_col_if_missing("tenant_accounts", "account_role", "VARCHAR(40)", "'CLIENTE_TENANT'")

    # 7.6. Jerarquía Inmutable del Superadministrador y Propietario (Sebastian Rodriguez)
    if "tenant_accounts" in existing_tables and "system_users" in existing_tables:
        try:
            conn.execute(text("""
                UPDATE tenant_accounts 
                SET account_role = 'PROPIETARIO (OWNER)',
                    subscription_status = 'ACTIVE_PAID',
                    license_tier = 'ENTERPRISE_3PL',
                    simulated_tier = 'ENTERPRISE_3PL',
                    max_users = 999999
                WHERE id = 'tenant_calcu_corp'
            """))
            conn.execute(text("""
                UPDATE system_users
                SET is_master_superadmin = TRUE,
                    role = 'controller_admin',
                    puesto = 'Controller General & Propietario'
                WHERE username IN ('seba', 'sebastian', 'sebar_2@hotmail.com')
            """))
            conn.commit()
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            logger.debug("Silenced owner hierarchy sync: %s", e)

    # 8. Semilla de Proveedores Uruguay y Servicios Implícitos si la tabla existe
    if "suppliers" in existing_tables:
        try:
            # Proveedores Locales / Reventa
            prov_uy_count = conn.execute(text("SELECT COUNT(*) FROM suppliers WHERE tipo_proveedor IN ('PROVEEDOR_UY', 'PROVEEDOR_REVENTA')")).scalar() or 0
            if prov_uy_count == 0:
                sample_uy = [
                    ("Distribuidora Eléctrica del Plata", "Eléctrica del Plata S.A.", "214567890014", "PROVEEDOR_UY", "Uruguay", "Rodrigo Méndez", "Gerente de Ventas Mayorista", "rmendez@electricaplata.com.uy", "+598 2900 1122", "Rondeau 1450, Montevideo", "Distribuidor mayorista de plaza con stock inmediato para licitaciones y obras."),
                    ("Ferretería & Luminarias Sur", "Luminarias del Sur Ltda.", "219876540019", "PROVEEDOR_REVENTA", "Uruguay", "Mariana Cabrera", "Ejecutiva de Cuentas B2B", "mcabrera@luminariassur.uy", "+598 2408 3344", "Av. 8 de Octubre 2700, Montevideo", "Proveedor de reventa de luminarias industriales y componentes de reposición local."),
                    ("Logística & Despachos Portuarios MVD", "Despachos Portuarios del Este S.A.", "216543210012", "SERVICIO_LOGISTICO", "Uruguay", "Guzmán Pereyra", "Despachante de Aduanas", "gpereyra@despachosmvd.uy", "+598 2916 8899", "Zabala 1520, Montevideo", "Agencia aduanera y fletes terrestres puerto-depósito."),
                ]
                for n, rz, rut, tip, p, cn, cc, em, ph, ad, d in sample_uy:
                    conn.execute(text("""
                        INSERT INTO suppliers (nombre, razon_social, rut, tipo_proveedor, pais, contacto_nombre, contacto_cargo, email, phone, address, descripcion)
                        VALUES (:n, :rz, :rut, :tip, :p, :cn, :cc, :em, :ph, :ad, :d)
                    """), {"n": n, "rz": rz, "rut": rut, "tip": tip, "p": p, "cn": cn, "cc": cc, "em": em, "ph": ph, "ad": ad, "d": d})
                conn.commit()
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            logger.warning("No se pudo sembrar proveedores Uy: %s", e)

    # 9. Semilla de Catálogo de Servicios Implícitos (Landed Costs)
    if "implicit_service_catalog" in existing_tables:
        try:
            srv_count = conn.execute(text("SELECT COUNT(*) FROM implicit_service_catalog")).scalar() or 0
            if srv_count == 0:
                services_base = [
                    ("MARITIMO", "SRV-MAR-40HQ", "Flete Marítimo Contenedor 40' High Cube", 4200.00, "Flete marítimo puerto origen (China) a Puerto de Montevideo."),
                    ("MARITIMO", "SRV-MAR-20ST", "Flete Marítimo Contenedor 20' Standard", 2600.00, "Flete marítimo contenedor chico de 20 pies."),
                    ("MARITIMO", "SRV-MAR-LCL", "Flete Marítimo Carga Consolidada (Medio Contenedor LCL)", 1400.00, "Flete por metro cúbico / LCL consolidado en origen."),
                    ("SEGURO", "SRV-SEG-INT", "Póliza de Seguro de Carga Internacional", 450.00, "Cobertura total contra todo riesgo en tránsito marítimo (All Risks)."),
                    ("ADUANA", "SRV-ADU-DESP", "Honorarios de Despacho & Liberación Aduanera MVD", 650.00, "Gestión aduanera, tasas de puerto ANP y trámite DUA de importación."),
                    ("TRANSPORTE_CAMION", "SRV-CAM-PORT", "Flete Terrestre Camión Puerto MVD a Depósito Central", 380.00, "Transporte en camión portacontenedor desde terminal portuaria a depósito."),
                    ("TRANSPORTE_CAMION", "SRV-CAM-INT", "Flete Terrestre Camión Montevideo a Salto / Interior", 720.00, "Distribución de carga pesada a depósitos regionales del interior."),
                ]
                for r, c, nom, costo, desc in services_base:
                    conn.execute(text("""
                        INSERT INTO implicit_service_catalog (rubro, codigo, nombre_servicio, costo_unitario_base, moneda, descripcion, activo)
                        VALUES (:r, :c, :nom, :costo, 'USD', :desc, :activo)
                    """), {"r": r, "c": c, "nom": nom, "costo": costo, "desc": desc, "activo": True})
                conn.commit()
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            logger.warning("No se pudo sembrar catálogo de servicios implícitos: %s", e)

    # 10. Semilla de Catálogo de Productos de Proveedores (PVP / PVM / Costo)
    if "supplier_catalog_items" in existing_tables:
        try:
            cat_count = conn.execute(text("SELECT COUNT(*) FROM supplier_catalog_items")).scalar() or 0
            if cat_count == 0:
                suppliers_rows = conn.execute(text("SELECT id, nombre FROM suppliers ORDER BY id ASC LIMIT 5")).fetchall()
                if suppliers_rows:
                    sample_catalog = [
                        ("SKU-PROV-LUM01", "SKU-LED-P6060", "Panel LED 60x60 40W 4000K Backlight", "Iluminación", 12.50, 19.80, 29.90, "En Stock MVD"),
                        ("SKU-PROV-LUM02", "SKU-CAMP-150W", "Campana Industrial LED UFO 150W IP65", "Iluminación", 34.00, 52.00, 78.50, "En Stock MVD"),
                        ("SKU-PROV-LUM03", "SKU-VIAL-100W", "Luminaria Alumbrado Público LED 100W", "Iluminación", 45.00, 68.00, 99.00, "24-48 hs"),
                        ("SKU-PROV-DRV01", "SKU-DALI-75W", "Driver Inteligente DALI 75W Regulable", "Electromecánica", 18.20, 27.50, 39.00, "En Stock MVD"),
                        ("SKU-PROV-OBR01", None, "Pintura Epoxi Industrial Alto Tránsito 20L", "Obra Civil", 42.00, 64.00, 95.00, "En Stock MVD"),
                        ("SKU-PROV-FER01", None, "Juego de Herramientas Aisladas 1000V", "Ferretería", 22.00, 33.50, 49.90, "48-72 hs"),
                    ]
                    for idx, row in enumerate(suppliers_rows):
                        supp_id = row[0]
                        start_i = idx % len(sample_catalog)
                        assigned_items = sample_catalog[start_i: start_i + 3]
                        if len(assigned_items) < 2:
                            assigned_items = sample_catalog[:3]
                        for sku_p, sku_c, nom, rub, c_comp, p_com, p_pub, st_est in assigned_items:
                            conn.execute(text("""
                                INSERT INTO supplier_catalog_items (supplier_id, sku_proveedor, sku_calcu, nombre, rubro, costo_compra, precio_venta_comercios, precio_venta_publico, stock_estimado, updated_at)
                                VALUES (:sid, :sp, :sc, :nom, :rub, :cc, :pvc, :pvp, :st, CURRENT_TIMESTAMP)
                            """), {
                                "sid": supp_id,
                                "sp": f"{sku_p}-{supp_id}",
                                "sc": sku_c,
                                "nom": nom,
                                "rub": rub,
                                "cc": c_comp,
                                "pvc": p_com,
                                "pvp": p_pub,
                                "st": st_est,
                            })
                    conn.commit()
                    logger.info("Catálogo inicial de productos de proveedores sembrado exitosamente.")
        except Exception as e:
            try:
                conn.rollback()
            except Exception:
                pass
            logger.warning("No se pudo sembrar catálogo inicial de proveedores: %s", e)


def run_non_destructive_migrations(target_engine: Engine = None):
    """
    Ejecuta migraciones no destructivas garantizando que la estructura BCNF
    esté al día sin alterar ni eliminar ningún dato previo.
    En dialectos no-SQLite (e.g. PostgreSQL), el esquema es gobernado por Alembic.
    """
    eng = target_engine or engine
    if eng.dialect.name != "sqlite":
        logger.info("Migraciones DDL específicas de SQLite omitidas para el motor %s.", eng.dialect.name)
        return
    with eng.connect() as conn:
        # 1. Asegurar tabla de categorías
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS categorias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre VARCHAR(100) UNIQUE NOT NULL,
                margen_target_pct NUMERIC(14, 4) DEFAULT 0.30,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))

        # 2. Verificar columnas existentes en categorias
        cursor = conn.connection.cursor()
        cursor.execute("PRAGMA table_info(categorias)")
        columns = [row[1] for row in cursor.fetchall()]

        if "created_at" not in columns:
            try:
                conn.execute(text("ALTER TABLE categorias ADD COLUMN created_at TIMESTAMP DEFAULT NULL"))
                conn.commit()
                logger.info("Columna created_at añadida exitosamente a tabla categorias.")
            except Exception as e:
                logger.warning("No se pudo añadir created_at a categorias (posiblemente ya existe): %s", e)

        # 3. Poblar categorías base con INSERT OR IGNORE
        base_categories = [
            ("Electrónica", 0.30),
            ("Accesorios", 0.30),
            ("Repuestos", 0.30),
            ("Dormitorio", 0.30),
            ("Baño", 0.30),
            ("Living", 0.30),
            ("Colchones", 0.30),
            ("Industrial", 0.35),
            ("Insumos", 0.30),
        ]

        for cat_name, cat_margin in base_categories:
            conn.execute(
                text("INSERT OR IGNORE INTO categorias (nombre, margen_target_pct) VALUES (:nombre, :margen)"),
                {"nombre": cat_name, "margen": cat_margin}
            )

        # Sanear registros existentes con escala 0-100 (ej. 30.0 -> 0.30)
        try:
            conn.execute(text("UPDATE categorias SET margen_target_pct = margen_target_pct / 100.0 WHERE margen_target_pct > 1.0"))
            conn.commit()
        except Exception as e:
            logger.warning("Error saneando escala margen_target_pct: %s", e)

        # 4. Asegurar tabla de Áreas / Sectores (BCNF)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS areas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo VARCHAR(30) UNIQUE NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                descripcion VARCHAR(255)
            );
        """))

        # 5. Asegurar tabla de Responsables / Usuarios de Organización (BCNF)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS responsables_organizacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                cargo VARCHAR(100) NOT NULL,
                area_id INTEGER REFERENCES areas(id)
            );
        """))

        # 6. Asegurar tabla de centros de costo (BCNF)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS centros_costo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo VARCHAR(30) UNIQUE NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                responsable VARCHAR(100) NOT NULL,
                activo BOOLEAN DEFAULT 1,
                area_id INTEGER REFERENCES areas(id),
                responsable_id INTEGER REFERENCES responsables_organizacion(id)
            );
        """))

        # Verificar y agregar columnas area_id y responsable_id a centros_costo si la tabla ya existía
        cursor = conn.connection.cursor()
        cursor.execute("PRAGMA table_info(centros_costo)")
        cc_columns = [row[1] for row in cursor.fetchall()]
        if "area_id" not in cc_columns:
            try:
                conn.execute(text("ALTER TABLE centros_costo ADD COLUMN area_id INTEGER REFERENCES areas(id)"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir area_id a centros_costo: %s", e)
        if "responsable_id" not in cc_columns:
            try:
                conn.execute(text("ALTER TABLE centros_costo ADD COLUMN responsable_id INTEGER REFERENCES responsables_organizacion(id)"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir responsable_id a centros_costo: %s", e)

        # 7. Asegurar tabla de presupuestos por centro de costo (OPEX)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS presupuestos_centros_costo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                periodo VARCHAR(50) NOT NULL,
                centro_costo_id INTEGER NOT NULL REFERENCES centros_costo(id),
                concepto_opex VARCHAR(150) NOT NULL,
                monto_presupuestado NUMERIC(14, 4) DEFAULT 0.00,
                monto_real NUMERIC(14, 4) DEFAULT 0.00
            );
        """))

        # 8. Sembrar Áreas corporativas base con INSERT OR IGNORE
        base_areas = [
            ("SEC-LOG", "Logística & Supply Chain", "Gestión de almacenamiento, transporte y abastecimiento"),
            ("SEC-MKT", "Marketing & Crecimiento", "Estrategia de demanda, pauta publicitaria y growth"),
            ("SEC-OPS", "Operaciones & Tecnología", "Infraestructura, desarrollo IT y soporte operacional"),
            ("SEC-ADM", "Administración & Finanzas", "Tesorería, contabilidad, legal y control presupuestario"),
            ("SEC-COM", "Comercial & Negocios", "Ventas omnicanal B2B/B2C, alianzas y fidelización"),
        ]
        for a_cod, a_nom, a_desc in base_areas:
            conn.execute(
                text("INSERT OR IGNORE INTO areas (codigo, nombre, descripcion) VALUES (:codigo, :nombre, :desc)"),
                {"codigo": a_cod, "nombre": a_nom, "desc": a_desc}
            )

        # 9. Sembrar Responsables / Usuarios corporativos base con INSERT OR IGNORE
        # Mapear IDs de áreas para asignar
        cursor.execute("SELECT id, codigo FROM areas")
        area_map = {row[1]: row[0] for row in cursor.fetchall()}

        base_users = [
            ("Jefe de Operaciones Logísticas", "logistica@calcu.com", "Jefe de Operaciones", area_map.get("SEC-LOG")),
            ("Head of Growth & Performance", "growth@calcu.com", "Head of Growth", area_map.get("SEC-MKT")),
            ("Director de Infraestructura & TI", "tech@calcu.com", "Director de TI", area_map.get("SEC-OPS")),
            ("Controller Financiero", "controller@calcu.com", "Controller Financiero", area_map.get("SEC-ADM")),
            ("Gerente Comercial B2B/B2C", "comercial@calcu.com", "Gerente Comercial", area_map.get("SEC-COM")),
            ("Dra. Sofía Rivas", "sofia.rivas@calcu.com", "Fintech & Data Lead", area_map.get("SEC-ADM")),
        ]
        for u_nom, u_email, u_cargo, u_area in base_users:
            conn.execute(
                text("INSERT OR IGNORE INTO responsables_organizacion (nombre, email, cargo, area_id) VALUES (:nombre, :email, :cargo, :area_id)"),
                {"nombre": u_nom, "email": u_email, "cargo": u_cargo, "area_id": u_area}
            )

        # 10. Sembrar Centros de Costo corporativos base con INSERT OR IGNORE
        cursor.execute("SELECT id, nombre FROM responsables_organizacion")
        user_map = {row[1]: row[0] for row in cursor.fetchall()}

        base_cost_centers = [
            ("CC-LOG", "Logística & Almacenamiento", "Jefe de Operaciones Logísticas", area_map.get("SEC-LOG"), user_map.get("Jefe de Operaciones Logísticas")),
            ("CC-MKT", "Marketing & Crecimiento", "Head of Growth & Performance", area_map.get("SEC-MKT"), user_map.get("Head of Growth & Performance")),
            ("CC-OPS", "Operaciones & TI", "Director de Infraestructura & TI", area_map.get("SEC-OPS"), user_map.get("Director de Infraestructura & TI")),
            ("CC-ADM", "Administración & Finanzas", "Controller Financiero", area_map.get("SEC-ADM"), user_map.get("Controller Financiero")),
            ("CC-COM", "Comercial & Canales", "Gerente Comercial B2B/B2C", area_map.get("SEC-COM"), user_map.get("Gerente Comercial B2B/B2C")),
            ("CC-FINTECH", "Fintech & Data Intelligence", "Dra. Sofía Rivas", area_map.get("SEC-ADM"), user_map.get("Dra. Sofía Rivas")),
        ]

        for cc_cod, cc_nom, cc_resp, a_id, u_id in base_cost_centers:
            conn.execute(
                text("""
                    INSERT OR IGNORE INTO centros_costo (codigo, nombre, responsable, activo, area_id, responsable_id)
                    VALUES (:codigo, :nombre, :resp, 1, :a_id, :u_id)
                """),
                {"codigo": cc_cod, "nombre": cc_nom, "resp": cc_resp, "a_id": a_id, "u_id": u_id}
            )
            # Actualizar vínculos si el centro ya existía sin FK
            conn.execute(
                text("""
                    UPDATE centros_costo
                    SET area_id = COALESCE(area_id, :a_id),
                        responsable_id = COALESCE(responsable_id, :u_id)
                    WHERE codigo = :codigo
                """),
                {"codigo": cc_cod, "a_id": a_id, "u_id": u_id}
            )

        conn.commit()

        # 7. Sembrar partidas iniciales de OPEX para '2025-09' si la tabla está vacía
        cursor = conn.connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM presupuestos_centros_costo WHERE periodo = '2025-09'")
        count_opex = cursor.fetchone()[0]
        if count_opex == 0:
            cursor.execute("SELECT id, codigo FROM centros_costo")
            cc_map = {row[1]: row[0] for row in cursor.fetchall()}
            sample_opex = [
                (cc_map.get("CC-LOG"), "Alquiler Depósito Central", 45000.0, 44200.0),
                (cc_map.get("CC-LOG"), "Fletes y Envíos Locales", 22000.0, 24500.0),
                (cc_map.get("CC-MKT"), "Pauta Digital Meta & Google", 35000.0, 36800.0),
                (cc_map.get("CC-MKT"), "Agencia Creativa & Contenidos", 18000.0, 18000.0),
                (cc_map.get("CC-OPS"), "Suscripciones Cloud & SaaS", 12500.0, 12500.0),
                (cc_map.get("CC-OPS"), "Mantenimiento Servidores & Red", 6000.0, 5800.0),
                (cc_map.get("CC-ADM"), "Nómina Administrativa Prorrateada", 55000.0, 55000.0),
                (cc_map.get("CC-ADM"), "Servicios Públicos & Seguros", 8500.0, 9200.0),
                (cc_map.get("CC-COM"), "Comisiones y Viáticos Comerciales", 15000.0, 13400.0),
            ]
            for cc_id, conc, m_pres, m_real in sample_opex:
                if cc_id:
                    conn.execute(
                        text("""
                            INSERT INTO presupuestos_centros_costo (periodo, centro_costo_id, concepto_opex, monto_presupuestado, monto_real)
                            VALUES ('2025-09', :cc_id, :concepto, :presup, :real)
                        """),
                        {"cc_id": cc_id, "concepto": conc, "presup": m_pres, "real": m_real}
                    )
            conn.commit()

        # 8. Asegurar tablas de Licitaciones y Proyectos B2B (Luminar -> Calcu)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tenders (
                id VARCHAR(36) PRIMARY KEY,
                proyecto_nombre VARCHAR(200) NOT NULL,
                cliente_licitacion VARCHAR(150) NOT NULL,
                nicho VARCHAR(50) DEFAULT 'industria' NOT NULL,
                fecha_apertura DATE,
                plazo_entrega_dias INTEGER NOT NULL,
                moneda VARCHAR(10) DEFAULT 'USD' NOT NULL,
                tipo_cambio_brou NUMERIC(10, 4) DEFAULT 40.40 NOT NULL,
                estado VARCHAR(30) DEFAULT 'BORRADOR' NOT NULL,
                observaciones TEXT,
                dictamen_david TEXT,
                dictamen_aristoteles TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS tender_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tender_id VARCHAR(36) NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
                sku VARCHAR(50) NOT NULL REFERENCES productos(sku),
                cantidad_solicitada INTEGER NOT NULL,
                costo_unitario_historico NUMERIC(14, 4),
                precio_unitario_ofertado NUMERIC(14, 4) NOT NULL,
                margen_estimado NUMERIC(10, 4),
                viabilidad_logistica VARCHAR(50) DEFAULT 'VIABLE_STOCK_INMEDIATO' NOT NULL,
                unidades_faltantes INTEGER DEFAULT 0 NOT NULL,
                dias_retraso_estimado INTEGER DEFAULT 0 NOT NULL
            );
        """))
        conn.commit()

        # 9. Sembrar Catálogo Técnico Serlux (Luminar B2B)
        conn.execute(text("INSERT OR IGNORE INTO categorias (nombre, margen_target_pct) VALUES ('Iluminación Técnica', 0.35)"))
        conn.commit()
        cursor.execute("SELECT id FROM categorias WHERE nombre = 'Iluminación Técnica'")
        cat_id_row = cursor.fetchone()
        cat_lum_id = cat_id_row[0] if cat_id_row else 1

        serlux_prods = [
            ("LUM-6060", "Panel LED 60x60 40W 4000K UGR<19", 14.50, 29.90, 60, 80, 0, 0, 350, 60.0, 5.0),
            ("UFO-150W", "Campana Industrial High Bay 150W IP65 LM-80", 42.00, 85.00, 60, 45, 0, 0, 120, 60.0, 2.0),
            ("DRV-DALI", "Driver Regulable DALI-2 50W THD<10%", 11.20, 24.50, 45, 15, 0, 0, 100, 45.0, 2.0),
            ("PRY-100W", "Proyector Exterior LED 100W Asimétrico 5000K", 26.80, 55.00, 60, 420, 0, 0, 180, 60.0, 3.0),
        ]
        for sku, nom, c_cif, p_lista, doh, dep, trans, adu, sec_s, lead_t, dem in serlux_prods:
            cursor.execute("SELECT id FROM productos WHERE sku = ?", (sku,))
            p_row = cursor.fetchone()
            if not p_row:
                conn.execute(
                    text("""
                        INSERT INTO productos (sku, nombre, categoria_id, costo_base, precio_lista, doh_seguridad, activo)
                        VALUES (:sku, :nom, :cat_id, :costo, :precio, :doh, 1)
                    """),
                    {"sku": sku, "nom": nom, "cat_id": cat_lum_id, "costo": c_cif, "precio": p_lista, "doh": doh}
                )
                conn.commit()
                cursor.execute("SELECT id FROM productos WHERE sku = ?", (sku,))
                new_p_id = cursor.fetchone()[0]
                conn.execute(
                    text("""
                        INSERT INTO inventarios (producto_id, deposito_central, transito_maritimo, aduana, stock_seguridad, lead_time_dias, demanda_diaria_promedio)
                        VALUES (:pid, :dep, :trans, :adu, :sec, :lead, :dem)
                    """),
                    {"pid": new_p_id, "dep": dep, "trans": trans, "adu": adu, "sec": sec_s, "lead": lead_t, "dem": dem}
                )
                conn.commit()

        # 10. Asegurar tablas de Pipeline Comercial (CRM)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS commercial_deals (
                id VARCHAR(36) PRIMARY KEY,
                proyecto_nombre VARCHAR(200) NOT NULL,
                cliente VARCHAR(150) NOT NULL,
                rut VARCHAR(50),
                vendedor VARCHAR(100) DEFAULT 'Martín Gómez' NOT NULL,
                monto_total NUMERIC(14, 4) DEFAULT 0.0 NOT NULL,
                moneda VARCHAR(10) DEFAULT 'USD' NOT NULL,
                etapa VARCHAR(30) DEFAULT 'prospeccion' NOT NULL,
                observaciones TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))

        # Migración no destructiva: columna rut en commercial_deals si no existe
        cursor.execute("PRAGMA table_info(commercial_deals)")
        cdeal_cols = [r[1] for r in cursor.fetchall()]
        if "rut" not in cdeal_cols:
            try:
                conn.execute(text("ALTER TABLE commercial_deals ADD COLUMN rut VARCHAR(50) DEFAULT NULL"))
                conn.commit()
            except Exception:
                pass

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS commercial_deal_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id VARCHAR(36) NOT NULL REFERENCES commercial_deals(id) ON DELETE CASCADE,
                sku VARCHAR(50) NOT NULL REFERENCES productos(sku),
                cantidad INTEGER NOT NULL,
                precio_unitario NUMERIC(14, 4) DEFAULT 0.0 NOT NULL
            );
        """))

        # 10.1 Asegurar tablas de Órdenes de Venta Formales (Sales Orders - OV)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sales_orders (
                id VARCHAR(50) PRIMARY KEY,
                deal_id VARCHAR(36) NOT NULL REFERENCES commercial_deals(id),
                numero_ov VARCHAR(50) UNIQUE NOT NULL,
                cliente VARCHAR(150) NOT NULL,
                rut VARCHAR(50),
                vendedor VARCHAR(100) DEFAULT 'Martín Gómez' NOT NULL,
                warehouse_id VARCHAR(50) DEFAULT 'DEP-CENTRAL-MVD' NOT NULL,
                subtotal NUMERIC(14, 4) NOT NULL,
                iva_monto NUMERIC(14, 4) NOT NULL,
                total NUMERIC(14, 4) NOT NULL,
                moneda VARCHAR(10) DEFAULT 'USD' NOT NULL,
                tipo_cambio NUMERIC(10, 4),
                estado VARCHAR(30) DEFAULT 'EMITIDA' NOT NULL,
                notas TEXT,
                fecha_emision DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sales_order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sales_order_id VARCHAR(50) NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
                sku VARCHAR(50) NOT NULL REFERENCES productos(sku),
                cantidad INTEGER NOT NULL,
                precio_unitario NUMERIC(14, 4) NOT NULL,
                subtotal NUMERIC(14, 4) NOT NULL
            );
        """))

        # 11. Asegurar tabla de Lotes de Stock Multi-Ubicación y Tránsito
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS stock_location_batches (
                id VARCHAR(50) PRIMARY KEY,
                sku VARCHAR(50) NOT NULL REFERENCES productos(sku),
                cantidad INTEGER NOT NULL,
                ubicacion VARCHAR(50) DEFAULT 'transito_maritimo' NOT NULL,
                pais_origen VARCHAR(10) DEFAULT 'CN' NOT NULL,
                buque_o_tracking VARCHAR(100),
                fecha_despacho DATE,
                fecha_eta DATE,
                estado VARCHAR(30) DEFAULT 'EN_TRANSITO' NOT NULL,
                observaciones TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        conn.commit()

        # 12. Sembrar datos iniciales de Pipeline Comercial si está vacío
        cursor = conn.connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM commercial_deals")
        count_deals = cursor.fetchone()[0]
        if count_deals == 0:
            sample_deals = [
                (
                    "deal-martin-pocitos-001",
                    "Edificio Pocitos",
                    "Constructora Bahía / Ing. Rossi",
                    "Martín Gómez",
                    15000.0,
                    "USD",
                    "negociacion",
                    "Licitación privada de iluminación LED técnica para torre residencial en Rambla Pocitos. Requiere luminarias antideslumbramiento UGR<19.",
                    [("LUM-6060", 500, 30.0)]
                ),
                (
                    "deal-shopping-carretas-002",
                    "Remodelación Parking Punta Carretas",
                    "Shopping Punta Carretas SA",
                    "Martín Gómez",
                    8500.0,
                    "USD",
                    "cotizacion",
                    "Campanas industriales UFO 150W para sustitución de sodio en cocheras subterráneas.",
                    [("UFO-150W", 100, 85.0)]
                ),
                (
                    "deal-clinica-carrasco-003",
                    "Clínica Médica Carrasco",
                    "Dr. Martínez & Asoc.",
                    "Laura Varela",
                    4200.0,
                    "USD",
                    "propuesta_enviada",
                    "Drivers DALI y paneles LED para consultorios médicos.",
                    [("LUM-6060", 100, 30.0), ("DRV-DALI", 50, 24.0)]
                ),
                (
                    "deal-oficinas-wts-004",
                    "Oficinas Corporativas WTC Free Zone",
                    "TechHub Coworking",
                    "Martín Gómez",
                    12000.0,
                    "USD",
                    "prospeccion",
                    "Propuesta integral de eficiencia energética y domótica en oficinas piso 14.",
                    [("LUM-6060", 300, 28.0), ("DRV-DALI", 150, 24.0)]
                ),
            ]
            for d_id, proj, cli, vend, monto, mon, eta, obs, items in sample_deals:
                conn.execute(
                    text("""
                        INSERT INTO commercial_deals (id, proyecto_nombre, cliente, vendedor, monto_total, moneda, etapa, observaciones)
                        VALUES (:id, :proj, :cli, :vend, :monto, :mon, :eta, :obs)
                    """),
                    {"id": d_id, "proj": proj, "cli": cli, "vend": vend, "monto": monto, "mon": mon, "eta": eta, "obs": obs}
                )
                for sku, cant, p_unit in items:
                    conn.execute(
                        text("""
                            INSERT INTO commercial_deal_items (deal_id, sku, cantidad, precio_unitario)
                            VALUES (:did, :sku, :cant, :p_unit)
                        """),
                        {"did": d_id, "sku": sku, "cant": cant, "p_unit": p_unit}
                    )
            conn.commit()

        # 13. Sembrar datos iniciales de Lotes de Stock Multi-Ubicación si está vacío
        cursor.execute("SELECT COUNT(*) FROM stock_location_batches")
        count_batches = cursor.fetchone()[0]
        if count_batches == 0:
            today = date.today()
            sample_batches = [
                (
                    "LOT-2026-001",
                    "LUM-6060",
                    200,
                    "transito_maritimo",
                    "CN",
                    "Cosco Faith / BL-UY-88219",
                    today - timedelta(days=20),
                    today + timedelta(days=6),
                    "EN_TRANSITO",
                    "Contenedor 40HQ directo desde Ningbo hacia Puerto de Montevideo. Arribo estimado en 6 días."
                ),
                (
                    "LOT-2026-002",
                    "UFO-150W",
                    100,
                    "fabrica_origen",
                    "CN",
                    "Shenzhen Industrial Hub #4",
                    today + timedelta(days=5),
                    today + timedelta(days=35),
                    "EN_PRODUCCION",
                    "Control de calidad en línea de ensamblaje final. Inspección pre-embarque agendada."
                ),
                (
                    "LOT-2026-003",
                    "DRV-DALI",
                    150,
                    "deposito_central",
                    "DE",
                    "Lufthansa Cargo LH-8204",
                    today - timedelta(days=40),
                    today - timedelta(days=10),
                    "DISPONIBLE",
                    "Nacionalizado y almacenado en Nave A - Depósito Montevideo."
                ),
                (
                    "LOT-2026-004",
                    "LUM-6060",
                    50,
                    "showrooms_locales",
                    "CN",
                    "Local Transfer LT-102",
                    today - timedelta(days=15),
                    today - timedelta(days=12),
                    "DISPONIBLE",
                    "Exhibición activa en Showroom Pocitos y Casa Central."
                ),
                (
                    "LOT-2026-005",
                    "PRY-100W",
                    80,
                    "transito_maritimo",
                    "CN",
                    "Maersk Rio Grande / BL-MR-3310",
                    today - timedelta(days=25),
                    today - timedelta(days=1), # ETA cumplida / listo para arribo
                    "EN_TRANSITO",
                    "Llegó a rada de Montevideo, inspección aduanera completada."
                ),
            ]
            for b_id, sku, cant, ubic, pais, track, f_desp, f_eta, est, obs in sample_batches:
                conn.execute(
                    text("""
                        INSERT INTO stock_location_batches (id, sku, cantidad, ubicacion, pais_origen, buque_o_tracking, fecha_despacho, fecha_eta, estado, observaciones)
                        VALUES (:id, :sku, :cant, :ubic, :pais, :track, :f_desp, :f_eta, :est, :obs)
                    """),
                    {
                        "id": b_id,
                        "sku": sku,
                        "cant": cant,
                        "ubic": ubic,
                        "pais": pais,
                        "track": track,
                        "f_desp": f_desp,
                        "f_eta": f_eta,
                        "est": est,
                        "obs": obs
                    }
                )
            conn.commit()

        # 14. Asegurar tabla de Almacenes / Depósitos (Warehouses)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS warehouses (
                id VARCHAR(50) PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                tipo VARCHAR(30) DEFAULT 'SUCURSAL' NOT NULL,
                ubicacion VARCHAR(150) NOT NULL,
                capacidad_unidades INTEGER DEFAULT 10000 NOT NULL,
                activo BOOLEAN DEFAULT 1 NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        conn.commit()

        # Migración segura para warehouses (columna pais)
        cursor.execute("PRAGMA table_info(warehouses)")
        wh_columns = [row[1] for row in cursor.fetchall()]
        if "pais" not in wh_columns:
            try:
                conn.execute(text("ALTER TABLE warehouses ADD COLUMN pais VARCHAR(100) DEFAULT 'Uruguay'"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna pais a warehouses: %s", e)

        cursor.execute("SELECT COUNT(*) FROM warehouses")
        count_warehouses = cursor.fetchone()[0]
        if count_warehouses == 0:
            sample_warehouses = [
                ("dep-central", "Central Montevideo", "CENTRAL", "Camino Carrasco 4500, Montevideo", "Uruguay", 50000, 1),
                ("loc-pocitos", "Local Pocitos Showroom", "SUCURSAL", "Av. Brasil 2890, Montevideo", "Uruguay", 5000, 1),
                ("dep-salto", "Depósito Regional Salto", "SUCURSAL", "Av. Barbieri 820, Salto", "Uruguay", 8000, 1),
                ("zf-aduana", "Depósito Aduanero Zona Franca", "TRANSITO", "Zonamerica Edificio Beta", "Uruguay", 25000, 1),
                ("wh-ningbo-hub", "Depósito Internacional Ningbo", "INTERNACIONAL", "Ningbo Port Logistics Park, Zhejiang", "China", 60000, 1),
                ("wh-shenzhen-hub", "Depósito Consolidación Shenzhen", "INTERNACIONAL", "Yantian Bonded Area, Shenzhen", "China", 45000, 1),
                ("wh-hamburgo-hub", "Depósito Hub Hamburgo", "INTERNACIONAL", "Freihafen Hamburg, Speicherstadt", "Alemania", 30000, 1),
            ]
            for w_id, w_nom, w_tip, w_ubi, w_pais, w_cap, w_act in sample_warehouses:
                conn.execute(
                    text("""
                        INSERT INTO warehouses (id, nombre, tipo, ubicacion, pais, capacidad_unidades, activo)
                        VALUES (:id, :nom, :tipo, :ubi, :pais, :cap, :act)
                    """),
                    {"id": w_id, "nom": w_nom, "tipo": w_tip, "ubi": w_ubi, "pais": w_pais, "cap": w_cap, "act": w_act}
                )
            conn.commit()
        else:
            # Asegurar que al menos existan depósitos internacionales de muestra
            int_whs = [
                ("wh-ningbo-hub", "Depósito Internacional Ningbo", "INTERNACIONAL", "Ningbo Port Logistics Park, Zhejiang", "China", 60000, 1),
                ("wh-shenzhen-hub", "Depósito Consolidación Shenzhen", "INTERNACIONAL", "Yantian Bonded Area, Shenzhen", "China", 45000, 1),
            ]
            for w_id, w_nom, w_tip, w_ubi, w_pais, w_cap, w_act in int_whs:
                cursor.execute("SELECT id FROM warehouses WHERE id = ?", (w_id,))
                if not cursor.fetchone():
                    try:
                        conn.execute(
                            text("""
                                INSERT INTO warehouses (id, nombre, tipo, ubicacion, pais, capacidad_unidades, activo)
                                VALUES (:id, :nom, :tipo, :ubi, :pais, :cap, :act)
                            """),
                            {"id": w_id, "nom": w_nom, "tipo": w_tip, "ubi": w_ubi, "pais": w_pais, "cap": w_cap, "act": w_act}
                        )
                        conn.commit()
                    except Exception as e:
                        logger.warning("No se pudo insertar almacén internacional %s: %s", w_id, e)

        # 15. Asegurar columnas y datos en acciones_compromisos
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS acciones_compromisos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo VARCHAR(200) NOT NULL,
                area VARCHAR(100) DEFAULT 'Operaciones' NOT NULL,
                responsable VARCHAR(100) DEFAULT 'Responsable General' NOT NULL,
                fecha_limite DATE NOT NULL,
                estado VARCHAR(50) DEFAULT 'PENDIENTE' NOT NULL,
                origen VARCHAR(100) DEFAULT 'Minuta Ejecutiva' NOT NULL,
                monto NUMERIC(14, 4) DEFAULT 0.0 NOT NULL,
                urgencia VARCHAR(20) DEFAULT 'MEDIA' NOT NULL,
                area_id VARCHAR(50),
                responsable_id VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        conn.commit()

        cursor.execute("PRAGMA table_info(acciones_compromisos)")
        ac_columns = [row[1] for row in cursor.fetchall()]
        if "monto" not in ac_columns:
            try:
                conn.execute(text("ALTER TABLE acciones_compromisos ADD COLUMN monto NUMERIC(14, 4) DEFAULT 0.0"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna monto a acciones_compromisos: %s", e)
        if "urgencia" not in ac_columns:
            try:
                conn.execute(text("ALTER TABLE acciones_compromisos ADD COLUMN urgencia VARCHAR(20) DEFAULT 'MEDIA'"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna urgencia a acciones_compromisos: %s", e)
        if "area_id" not in ac_columns:
            try:
                conn.execute(text("ALTER TABLE acciones_compromisos ADD COLUMN area_id VARCHAR(50)"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna area_id a acciones_compromisos: %s", e)
        if "responsable_id" not in ac_columns:
            try:
                conn.execute(text("ALTER TABLE acciones_compromisos ADD COLUMN responsable_id VARCHAR(50)"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna responsable_id a acciones_compromisos: %s", e)

        cursor.execute("SELECT COUNT(*) FROM acciones_compromisos")
        count_ac = cursor.fetchone()[0]
        if count_ac == 0:
            today = date.today()
            sample_compromisos = [
                (
                    "Negociar tarifa de flete marítimo para contenedor 40HQ",
                    "Logística y Abastecimiento",
                    "Rodrigo Silva",
                    today + timedelta(days=10),
                    "PENDIENTE",
                    "Auditoría FP&A",
                    1200.0,
                    "ALTA",
                    "AREA-LOG",
                    "USR-RODRIGO"
                ),
                (
                    "Regularizar desvío en pauta digital Meta de Q3",
                    "Marketing",
                    "Valentina Ríos",
                    today + timedelta(days=7),
                    "EN PROGRESO",
                    "Comité de Presupuestos",
                    1800.0,
                    "ALTA",
                    "AREA-MKT",
                    "USR-VALENTINA"
                ),
                (
                    "Auditar stock de seguridad en drivers DALI Serlux",
                    "Operaciones",
                    "Martín Gómez",
                    today + timedelta(days=15),
                    "PENDIENTE",
                    "Revisión ROP",
                    500.0,
                    "MEDIA",
                    "AREA-OPS",
                    "USR-MARTIN"
                ),
            ]
            for tit, ar, resp, fl, est, orig, mnt, urg, aid, rid in sample_compromisos:
                conn.execute(
                    text("""
                        INSERT INTO acciones_compromisos (titulo, area, responsable, fecha_limite, estado, origen, monto, urgencia, area_id, responsable_id)
                        VALUES (:tit, :ar, :resp, :fl, :est, :orig, :mnt, :urg, :aid, :rid)
                    """),
                    {
                        "tit": tit,
                        "ar": ar,
                        "resp": resp,
                        "fl": fl,
                        "est": est,
                        "orig": orig,
                        "mnt": mnt,
                        "urg": urg,
                        "aid": aid,
                        "rid": rid
                    }
                )
            conn.commit()

        # Migración segura para suppliers (Fábricas y Buques / Navieras)
        cursor.execute("PRAGMA table_info(suppliers)")
        sup_columns = [row[1] for row in cursor.fetchall()]
        if "tipo_proveedor" not in sup_columns:
            try:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN tipo_proveedor VARCHAR(50) DEFAULT 'FABRICA'"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna tipo_proveedor a suppliers: %s", e)
        if "razon_social" not in sup_columns:
            try:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN razon_social VARCHAR(200)"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna razon_social a suppliers: %s", e)
        if "pais" not in sup_columns:
            try:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN pais VARCHAR(100) DEFAULT 'China'"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna pais a suppliers: %s", e)
        if "contacto_nombre" not in sup_columns:
            try:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN contacto_nombre VARCHAR(100)"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna contacto_nombre a suppliers: %s", e)
        if "contacto_cargo" not in sup_columns:
            try:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN contacto_cargo VARCHAR(100)"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna contacto_cargo a suppliers: %s", e)
        if "descripcion" not in sup_columns:
            try:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN descripcion TEXT"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna descripcion a suppliers: %s", e)

        # Migración segura para stock_location_batches (Trazabilidad Dual-SKU y Fechas)
        cursor.execute("PRAGMA table_info(stock_location_batches)")
        batch_columns = [row[1] for row in cursor.fetchall()]
        if "sku_fabrica" not in batch_columns:
            try:
                conn.execute(text("ALTER TABLE stock_location_batches ADD COLUMN sku_fabrica VARCHAR(100)"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna sku_fabrica a stock_location_batches: %s", e)
        if "lote_fabrica" not in batch_columns:
            try:
                conn.execute(text("ALTER TABLE stock_location_batches ADD COLUMN lote_fabrica VARCHAR(100)"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna lote_fabrica a stock_location_batches: %s", e)
        if "fecha_terminado" not in batch_columns:
            try:
                conn.execute(text("ALTER TABLE stock_location_batches ADD COLUMN fecha_terminado DATE"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna fecha_terminado a stock_location_batches: %s", e)
        if "supplier_id" not in batch_columns:
            try:
                conn.execute(text("ALTER TABLE stock_location_batches ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna supplier_id a stock_location_batches: %s", e)
        if "warehouse_id" not in batch_columns:
            try:
                conn.execute(text("ALTER TABLE stock_location_batches ADD COLUMN warehouse_id VARCHAR(50)"))
                conn.commit()
            except Exception as e:
                logger.warning("No se pudo añadir columna warehouse_id a stock_location_batches: %s", e)

        # Migración segura para logistics_drivers (Modalidad de pago y tarifas operario hora/jornal)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='logistics_drivers'")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(logistics_drivers)")
            driver_columns = [row[1] for row in cursor.fetchall()]
            if "modalidad_pago" not in driver_columns:
                try:
                    conn.execute(text("ALTER TABLE logistics_drivers ADD COLUMN modalidad_pago VARCHAR(30) DEFAULT 'VIAJE_KM'"))
                    conn.commit()
                except Exception as e:
                    logger.warning("No se pudo añadir columna modalidad_pago a logistics_drivers: %s", e)
            if "tarifa_hora" not in driver_columns:
                try:
                    conn.execute(text("ALTER TABLE logistics_drivers ADD COLUMN tarifa_hora NUMERIC(14, 4) DEFAULT 0.0"))
                    conn.commit()
                except Exception as e:
                    logger.warning("No se pudo añadir columna tarifa_hora a logistics_drivers: %s", e)
            if "tarifa_jornal" not in driver_columns:
                try:
                    conn.execute(text("ALTER TABLE logistics_drivers ADD COLUMN tarifa_jornal NUMERIC(14, 4) DEFAULT 0.0"))
                    conn.commit()
                except Exception as e:
                    logger.warning("No se pudo añadir columna tarifa_jornal a logistics_drivers: %s", e)

        # Semilla de proveedores canónicos: Fábricas y Navieras
        cursor.execute("SELECT COUNT(*) FROM suppliers")
        count_sup = cursor.fetchone()[0]
        if count_sup == 0:
            sample_suppliers = [
                ("Foshan Lighting Co. Ltd", "Foshan Electrical and Lamp Co. Ltd", "CN-91440600190", "FABRICA", "China", "Chen Wei", "Director de Exportaciones", "cwei@foshanlighting.cn", "+86 757 8228 1234", "Foshan High-Tech Industrial Zone, Guangdong", "Fábrica principal de paneles LED y campanas industriales con certificación CE y RoHS."),
                ("Ningbo Led Component Group", "Ningbo Electronics Import & Export Co.", "CN-91330201720", "FABRICA", "China", "Lin Zhao", "Jefe de Planta", "lzhao@ningboled.com", "+86 574 8770 9988", "Beilun District, Ningbo, Zhejiang", "Fabricante especializado en drivers de corriente constante regulables DALI y 1-10V."),
                ("Shenzhen OptoTech Industry", "Shenzhen Opto Industrial Technologies Co.", "CN-91440300582", "FABRICA", "China", "Mei Huang", "Gerente Comercial LatAm", "mhuang@optotech.com.cn", "+86 755 2603 5500", "Nanshan Tech Park, Shenzhen", "Línea de proyectores reflectores exteriores Slim IP65 y tiras COB."),
                ("MSC LAURA - Mediterranean Shipping", "MSC Mediterranean Shipping Company SA", "CH-CHE-106.533.456", "NAVIERA_BUQUE", "Suiza", "Capt. Marco Valente", "Agente Portuario MVD", "mvalente@msc.com", "+598 2916 4400", "Rambla 25 de Agosto 508, Montevideo", "Buque portacontenedor y naviera regular para ruta Lejano Oriente - Río de la Plata."),
                ("Maersk Line Atlantic", "Maersk A/S", "DK-33165012", "NAVIERA_BUQUE", "Dinamarca", "Søren Hansen", "Representante Comercial", "shansen@maersk.com", "+598 2915 2211", "Plaza Independencia 811, Montevideo", "Servicio marítimo directo con despacho aduanero y tracking satelital en alta mar."),
                ("Cosco Shipping Lines", "COSCO Shipping Lines Co. Ltd", "CN-91310000132", "NAVIERA_BUQUE", "China", "Wang Lei", "Logistics Coordinator", "wlei@coscon.com", "+86 21 6596 6666", "Dongdaming Road, Shanghai", "Naviera estatal china especializada en fletes marítimos transoceánicos."),
            ]
            for nom, rz, rut, tip, pais, c_nom, c_crg, em, ph, ad, desc in sample_suppliers:
                conn.execute(
                    text("""
                        INSERT INTO suppliers (nombre, razon_social, rut, tipo_proveedor, pais, contacto_nombre, contacto_cargo, email, phone, address, descripcion)
                        VALUES (:nom, :rz, :rut, :tip, :pais, :c_nom, :c_crg, :em, :ph, :ad, :desc)
                    """),
                    {
                        "nom": nom, "rz": rz, "rut": rut, "tip": tip, "pais": pais,
                        "c_nom": c_nom, "c_crg": c_crg, "em": em, "ph": ph, "ad": ad, "desc": desc
                    }
                )
            conn.commit()


def seed_multitenant_and_omnichannel(conn):
    """
    Inicializa cuentas Multi-Tenant (SaaS), los 5 canales del Hub de Integraciones
    respetando la política de Cero Falsos Positivos (PENDING_CREDENTIALS por defecto)
    y prospectos multicanal en '1. Prospección' con su historial de Chat Omnicanal.
    """
    import json
    import secrets
    from datetime import datetime, timezone, timedelta

    now_utc = datetime.now(timezone.utc)
    trial_end = now_utc + timedelta(days=14)

    # 1. Cuentas Multi-Tenant iniciales
    try:
        t_count = conn.execute(text("SELECT COUNT(*) FROM tenant_accounts")).scalar() or 0
        if t_count == 0:
            default_tenants = [
                (
                    "tenant_calcu_corp",
                    "calcu_corp",
                    "Calcu Corporación Central S.A.",
                    "218994020015",
                    "tenant_calcu_corp",
                    "POSTGRES_SCHEMA",
                    "ENTERPRISE_3PL",
                    None,
                    "ACTIVE_PAID",
                    now_utc,
                    now_utc + timedelta(days=365),
                    999,
                    "admin@calcu.com",
                    "admin",
                    490.00,
                    True,
                ),
                (
                    "tenant_demo_sandbox",
                    "demo_sandbox",
                    "Empresa Evaluadora Trial (14 Días)",
                    "215551110019",
                    "tenant_demo_sandbox",
                    "POSTGRES_SCHEMA",
                    "ENTERPRISE_3PL",
                    "ENTERPRISE_3PL",
                    "TRIAL_14_DAYS",
                    now_utc,
                    trial_end,
                    999,
                    "demo@calcu.com",
                    "demo",
                    0.00,
                    True,
                ),
                (
                    "tenant_distsur",
                    "distsur",
                    "Distribuidora del Sur Ltda.",
                    "214409820012",
                    "tenant_distsur",
                    "POSTGRES_SCHEMA",
                    "ENTERPRISE_3PL",
                    "ENTERPRISE_3PL",
                    "TRIAL_14_DAYS",
                    now_utc,
                    trial_end,
                    25,
                    "admin@distsur.com.uy",
                    "admin_distsur",
                    190.00,
                    True,
                ),
            ]
            for (
                tid, slug, nom, rut, sch, strat, tier, sim_tier,
                st, t_start, t_end, max_u, adm_em, adm_usr, mrr, act
            ) in default_tenants:
                conn.execute(
                    text("""
                        INSERT INTO tenant_accounts (
                            id, slug, nombre_empresa, rut, schema_name, db_strategy,
                            license_tier, simulated_tier, subscription_status,
                            trial_starts_at, trial_ends_at, max_users,
                            admin_email, admin_username, mrr_usd, is_active, created_at
                        ) VALUES (
                            :tid, :slug, :nom, :rut, :sch, :strat,
                            :tier, :sim_tier, :st,
                            :t_start, :t_end, :max_u,
                            :adm_em, :adm_usr, :mrr, :act, :now_utc
                        )
                    """),
                    {
                        "tid": tid, "slug": slug, "nom": nom, "rut": rut,
                        "sch": sch, "strat": strat, "tier": tier, "sim_tier": sim_tier,
                        "st": st, "t_start": t_start, "t_end": t_end, "max_u": max_u,
                        "adm_em": adm_em, "adm_usr": adm_usr, "mrr": mrr, "act": act,
                        "now_utc": now_utc
                    }
                )
            conn.commit()
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.warning("No se pudo sembrar tenant_accounts: %s", e)

    # 2. Canales del Hub de Integraciones (Sin falsos positivos: PENDING_CREDENTIALS hasta configurar llaves reales)
    try:
        channels_seed = [
            ("GOOGLE_ADS", "Google Ads (Lead Form & Campañas Search)", False, "PENDING_CREDENTIALS", 12.50, "Martín Gómez"),
            ("META_ADS", "Facebook & Instagram (Meta Lead Ads)", False, "PENDING_CREDENTIALS", 8.40, "Laura Varela"),
            ("WHATSAPP", "WhatsApp Business Cloud API Oficial", False, "PENDING_CREDENTIALS", 2.10, "Martín Gómez"),
            ("WHATSAPP_QR", "WhatsApp Directo (Vinculación por Código QR)", False, "PENDING_CREDENTIALS", 0.50, "Martín Gómez"),
            ("EMAIL", "Correo Corporativo (SMTP / IMAP Verificado)", False, "PENDING_CREDENTIALS", 1.50, "Laura Varela"),
            ("WEB_FORM", "Página Web Corporativa (Webhook Directo)", False, "PENDING_CREDENTIALS", 3.00, "Martín Gómez"),
        ]
        for ch_code, disp, enab, stat, cpl, seller in channels_seed:
            ch_exists = conn.execute(
                text("SELECT COUNT(*) FROM integration_configs WHERE channel = :ch"),
                {"ch": ch_code}
            ).scalar() or 0
            if ch_exists == 0:
                wh_tok = f"whk_{ch_code.lower()}_{secrets.token_hex(8)}"
                conn.execute(
                    text("""
                        INSERT INTO integration_configs (
                            tenant_id, channel, display_name, is_enabled, status,
                            encrypted_credentials, masked_summary, webhook_token,
                            auto_reply_enabled, assigned_seller_strategy, default_seller,
                            cost_per_lead_usd, leads_captured_count, updated_at
                        ) VALUES (
                            'tenant_calcu_corp', :ch, :disp, :enab, :stat,
                            NULL, :msum, :wht,
                            :auto_rep, 'ROUND_ROBIN', :seller,
                            :cpl, 0, :now_utc
                        )
                    """),
                    {
                        "ch": ch_code,
                        "disp": disp,
                        "enab": enab,
                        "stat": stat,
                        "msum": json.dumps({}),
                        "wht": wh_tok,
                        "auto_rep": True,
                        "seller": seller,
                        "cpl": cpl,
                        "now_utc": now_utc,
                    }
                )
        conn.commit()
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.warning("No se pudo sembrar integration_configs: %s", e)

    # 3. Prospectos Multicanal de Muestra en "1. Prospección" y Mensajes de Chat Omnicanal
    try:
        # Actualizar deal-oficinas-wts-004 existente para que tenga fuente clara y contacto
        conn.execute(
            text("""
                UPDATE commercial_deals
                SET canal_origen = 'GOOGLE_ADS',
                    utm_source = 'google',
                    utm_medium = 'cpc',
                    utm_campaign = 'B2B_Iluminacion_Oficinas_Q4',
                    email = COALESCE(email, 'compras@techhub.uy'),
                    phone = COALESCE(phone, '+59899112233'),
                    costo_adquisicion_estimado = 14.50,
                    ai_score = 92,
                    ai_classification = 'HOT'
                WHERE id = 'deal-oficinas-wts-004'
            """)
        )

        multichannel_prospects = [
            (
                "deal-meta-logistica-005",
                "Almacenamiento & Ruteo 3PL Retail",
                "Supermercados El Dorado / Lic. Fernando Silva",
                "213344550018",
                "Laura Varela",
                18500.0,
                "USD",
                "prospeccion",
                "Lead capturado vía Meta Lead Ads. Consulta por servicio de depósito 3PL y distribución a sucursales en Maldonado y Rocha.",
                "fsilva@eldorado.com.uy",
                "+59894223344",
                "META_ADS",
                "facebook",
                "paid_social",
                "3PL_Expansion_Uruguay_2026",
                "meta_lead_998123",
                9.80,
                88,
                "HOT",
            ),
            (
                "deal-wa-luminarias-006",
                "Reposición Campanas Industriales Nave Logística",
                "Frigorífico Modelo S.A. / Ing. Carlos Méndez",
                "211122330011",
                "Martín Gómez",
                6800.0,
                "USD",
                "prospeccion",
                "Contacto entrante por WhatsApp Business. Solicita cotización urgente de 80 campanas UFO 150W IP65 con entrega en Montevideo.",
                "cmendez@frigorificomodelo.uy",
                "+59898776655",
                "WHATSAPP",
                "whatsapp",
                "inbound_chat",
                "Directo_WA_Corporativo",
                "wa_msg_774120",
                2.10,
                95,
                "HOT",
            ),
            (
                "deal-web-licitacion-007",
                "Proyectores Exteriores Complejo Deportivo",
                "Club Atlético Bohemios / Intendencia",
                "217788990014",
                "Laura Varela",
                5400.0,
                "USD",
                "prospeccion",
                "Formulario Web Corporativo completado en landing page. Pide ficha técnica de proyectores PRY-100W y plazos de garantía.",
                "infraestructura@bohemios.uy",
                "+59891334455",
                "WEB_FORM",
                "web_organico",
                "referral",
                "Landing_Calcu_2026",
                "web_lead_55201",
                3.00,
                79,
                "WARM",
            ),
            (
                "deal-email-corporativo-008",
                "Suministro Anual Drivers DALI & Paneles",
                "Estudio Arq. Gómez Platero",
                "216655440017",
                "Martín Gómez",
                22400.0,
                "USD",
                "prospeccion",
                "Consulta recibida por Email Corporativo. Adjuntan planilla de cómputo métrico para obra corporativa en Carrasco.",
                "adquisiciones@gomezplatero.com",
                "+59892445566",
                "EMAIL",
                "email_directo",
                "inbound_email",
                "Bandeja_Ventas_B2B",
                "email_lead_33109",
                1.50,
                86,
                "HOT",
            ),
        ]

        for (
            did, proj, cli, rut, vend, monto, mon, eta, obs,
            em, ph, canal, usrc, umed, ucamp, ext_id, cac, score, clasif
        ) in multichannel_prospects:
            exists = conn.execute(
                text("SELECT COUNT(*) FROM commercial_deals WHERE id = :did"),
                {"did": did}
            ).scalar() or 0
            if exists == 0:
                conn.execute(
                    text("""
                        INSERT INTO commercial_deals (
                            id, proyecto_nombre, cliente, rut, vendedor, monto_total,
                            moneda, etapa, observaciones, email, phone,
                            canal_origen, utm_source, utm_medium, utm_campaign,
                            external_lead_id, costo_adquisicion_estimado, ai_score, ai_classification, created_at
                        ) VALUES (
                            :did, :proj, :cli, :rut, :vend, :monto,
                            :mon, :eta, :obs, :em, :ph,
                            :canal, :usrc, :umed, :ucamp,
                            :ext_id, :cac, :score, :clasif, :now_utc
                        )
                    """),
                    {
                        "did": did, "proj": proj, "cli": cli, "rut": rut, "vend": vend,
                        "monto": monto, "mon": mon, "eta": eta, "obs": obs,
                        "em": em, "ph": ph, "canal": canal, "usrc": usrc,
                        "umed": umed, "ucamp": ucamp, "ext_id": ext_id,
                        "cac": cac, "score": score, "clasif": clasif, "now_utc": now_utc
                    }
                )
        conn.commit()

        # Sembrar mensajes iniciales en omnichannel_messages si está vacío
        msg_count = conn.execute(text("SELECT COUNT(*) FROM omnichannel_messages")).scalar() or 0
        if msg_count == 0:
            initial_messages = [
                (
                    "deal-oficinas-wts-004",
                    "GOOGLE_ADS",
                    "INBOUND",
                    "TechHub Coworking (Compras)",
                    "compras@techhub.uy",
                    "Hola equipo de Calcu, vimos su anuncio en Google buscando iluminación eficiente para oficinas en WTC. Necesitamos cotizar 300 paneles LED 60x60 UGR<19 y 150 drivers DALI. ¿Tienen stock para entrega inmediata?",
                    "RECEIVED",
                    False,
                ),
                (
                    "deal-meta-logistica-005",
                    "META_ADS",
                    "INBOUND",
                    "Lic. Fernando Silva (El Dorado)",
                    "+59894223344",
                    "Buenas tardes, completé el formulario en Facebook. Estamos evaluando tercerizar recepción de mercadería y distribución 3PL para 12 locales del Este. ¿Cuáles son sus tarifas por pallet y flete por km?",
                    "RECEIVED",
                    False,
                ),
                (
                    "deal-wa-luminarias-006",
                    "WHATSAPP",
                    "INBOUND",
                    "Ing. Carlos Méndez (Frigorífico Modelo)",
                    "+59898776655",
                    "¡Hola! Les escribo por WhatsApp porque necesitamos urgente 80 Campanas Industriales LED UFO 150W IP65 para nuestra cámara seca. ¿A qué precio nos quedan por volumen y cuándo podrían despachar?",
                    "RECEIVED",
                    False,
                ),
                (
                    "deal-web-licitacion-007",
                    "WEB_FORM",
                    "INBOUND",
                    "Club Atlético Bohemios",
                    "infraestructura@bohemios.uy",
                    "Estimados, enviamos consulta desde su página web. Necesitamos proyectores exteriores de 100W para remodelación de canchas. ¿Cuentan con stock en Montevideo?",
                    "RECEIVED",
                    False,
                ),
                (
                    "deal-email-corporativo-008",
                    "EMAIL",
                    "INBOUND",
                    "Estudio Arq. Gómez Platero",
                    "adquisiciones@gomezplatero.com",
                    "Estimado equipo comercial: solicitamos presupuesto formal B2B para provisión anual de luminarias técnicas y drivers regulables DALI-2 según pliego adjunto. Quedamos atentos.",
                    "RECEIVED",
                    False,
                ),
            ]
            for d_id, ch, direc, s_name, s_addr, m_txt, d_stat, is_ai in initial_messages:
                conn.execute(
                    text("""
                        INSERT INTO omnichannel_messages (
                            tenant_id, deal_id, channel, direction, sender_name,
                            sender_address, message_text, delivery_status, is_ai_generated, created_at
                        ) VALUES (
                            'tenant_calcu_corp', :did, :ch, :direc, :sname,
                            :saddr, :mtxt, :dstat, :isai, :now_utc
                        )
                    """),
                    {
                        "did": d_id, "ch": ch, "direc": direc, "sname": s_name,
                        "saddr": s_addr, "mtxt": m_txt, "dstat": d_stat,
                        "isai": is_ai, "now_utc": now_utc
                    }
                )
            conn.commit()
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.warning("No se pudo sembrar prospectos multicanal y mensajes omnicanal: %s", e)


class TenantConnectionManager:
    """
    Gestor Multi-Tenant de Bases de Datos Aisladas (Opción B — PostgreSQL Schema / Isolated DB).
    - En PostgreSQL: Crea e inicializa esquemas dedicados `tenant_{slug}` y ejecuta `SET search_path`.
    - En entorno local SQLite: Crea bases de datos físicamente separadas en `tenants_data/{tenant_id}.db`
      para nuevos tenants, manteniendo `calcu.db` para `tenant_calcu_corp` y `calcu_demo.db` para `demo`.
    """
    def __init__(self):
        self._engines: dict[str, Engine] = {}
        self._sessionmakers: dict[str, sessionmaker] = {}
        self.tenants_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "tenants_data")
        os.makedirs(self.tenants_dir, exist_ok=True)

    def get_session_for_tenant(self, tenant_id: str) -> Session:
        clean_tid = (tenant_id or "tenant_calcu_corp").strip().lower()
        # 1. Cuentas predeterminadas existentes
        if clean_tid in ("tenant_calcu_corp", "default", "calcu_corp", ""):
            return SessionLocal()
        if clean_tid in ("tenant_demo_sandbox", "demo_sandbox", "demo"):
            return SessionDemo()

        # 2. Cuentas aisladas adicionales (PostgreSQL Schema o Base Aislada)
        if clean_tid not in self._sessionmakers:
            if DATABASE_URL.startswith("postgresql"):
                # En PostgreSQL usamos schema-per-tenant sobre el motor principal
                schema_safe = "".join(c for c in clean_tid if c.isalnum() or c == "_")
                if not schema_safe:
                    schema_safe = "tenant_custom"
                with engine.connect() as conn:
                    conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema_safe}"'))
                    conn.commit()
                tenant_eng = engine.execution_options(schema_translate_map={None: schema_safe})
                Base.metadata.create_all(bind=tenant_eng)
                self._engines[clean_tid] = tenant_eng
                self._sessionmakers[clean_tid] = sessionmaker(autocommit=False, autoflush=False, bind=tenant_eng)
            else:
                # Archivo físico independiente por Tenant
                safe_filename = "".join(c for c in clean_tid if c.isalnum() or c in ("_", "-"))
                db_path = os.path.join(self.tenants_dir, f"{safe_filename}.db")
                tenant_url = f"sqlite:///{db_path}"
                tenant_eng = create_app_engine(tenant_url)
                init_db(target_engine=tenant_eng)
                self._engines[clean_tid] = tenant_eng
                self._sessionmakers[clean_tid] = sessionmaker(autocommit=False, autoflush=False, bind=tenant_eng)

        return self._sessionmakers[clean_tid]()


tenant_connection_manager = TenantConnectionManager()


def init_db(target_engine: Engine = None):
    """Crea todas las tablas si no existen y corre migraciones seguras multi-dialecto en base principal y demo"""
    engines_to_init = [target_engine] if target_engine else [engine, engine_demo]
    from app.models import entities  # Asegurar registro de modelos
    from app.models import logistics_entities  # Asegurar registro de modelos 3PL Logística
    from app.models import accounting_entities  # Asegurar registro de facturación, contabilidad y RBAC
    from app.models import multitenant_entities  # Asegurar registro de Multi-Tenancy, Vault y Chat Omnicanal
    from app.domain import models   # Asegurar registro de modelos del dominio
    for eng in engines_to_init:
        try:
            Base.metadata.create_all(bind=eng)
            with eng.connect() as conn:
                sync_table_columns(conn)
            if eng.dialect.name == "sqlite":
                run_non_destructive_migrations(eng)
            with eng.connect() as conn:
                seed_multitenant_and_omnichannel(conn)
        except Exception as e:
            logger.warning("Error inicializando motor de BD %s: %s", eng, e)


def get_db(request: Request = None):
    """
    Generador de sesión de base de datos Multi-Tenant & Sandbox Aislado:
    - Resuelve el `tenant_id` desde el token JWT (`tenant_id`), encabezado `X-Tenant-Id` o usuario `demo`.
    - Enruta de forma transparente a la base de datos / esquema PostgreSQL exclusivo de la empresa.
    """
    resolved_tenant_id = "tenant_calcu_corp"
    if request:
        try:
            # 1. Comprobar encabezado Authorization Bearer Token
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ", 1)[1]
                payload = jwt.decode(
                    token, 
                    getattr(settings, "jwt_secret_key", "calcu-enterprise-jwt-secret-key-32-chars-long-2026-prod"), 
                    algorithms=[getattr(settings, "jwt_algorithm", "HS256")]
                )
                if payload.get("sub") == "demo":
                    resolved_tenant_id = "tenant_demo_sandbox"
                elif payload.get("tenant_id"):
                    resolved_tenant_id = str(payload.get("tenant_id"))
            # 2. Comprobar encabezado explícito X-Tenant-Id o X-User-Id únicamente en desarrollo/pruebas controladas
            if resolved_tenant_id == "tenant_calcu_corp":
                allow_header_tenant = os.getenv("ENVIRONMENT") != "production" or os.getenv("ALLOW_TEST_HEADER_AUTH") == "1"
                if allow_header_tenant:
                    header_tenant = request.headers.get("x-tenant-id")
                    if header_tenant:
                        resolved_tenant_id = header_tenant.strip()
                    elif request.headers.get("x-user-id") == "demo" or request.query_params.get("user_id") == "demo":
                        resolved_tenant_id = "tenant_demo_sandbox"
        except Exception:
            pass

    db = tenant_connection_manager.get_session_for_tenant(resolved_tenant_id)
    try:
        yield db
    finally:
        db.close()


