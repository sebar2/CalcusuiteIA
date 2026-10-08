import os
import logging
from datetime import date, timedelta
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import QueuePool, StaticPool, NullPool
from sqlalchemy.orm import sessionmaker, Session
from app.models.base import Base
from app.core.config import DATABASE_URL as DEFAULT_DATABASE_URL

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)


def create_app_engine(database_url: str) -> Engine:
    """
    Factoría de motor SQLAlchemy con soporte dual de infraestructura:
    - PostgreSQL: QueuePool (pool_size=20, max_overflow=30, recycle=1800s, pre_ping=True).
    - SQLite: Conexión monohilo desactivada y StaticPool en bases en memoria.
    """
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

        cursor.execute("SELECT COUNT(*) FROM warehouses")
        count_warehouses = cursor.fetchone()[0]
        if count_warehouses == 0:
            sample_warehouses = [
                ("dep-central", "Central Montevideo", "CENTRAL", "Camino Carrasco 4500, Montevideo", 50000, 1),
                ("loc-pocitos", "Local Pocitos Showroom", "SUCURSAL", "Av. Brasil 2890, Montevideo", 5000, 1),
                ("zf-aduana", "Depósito Aduanero Zona Franca", "TRANSITO", "Zonamerica Edificio Beta", 25000, 1),
                ("fab-ningbo", "Fábrica Serlux Ningbo", "FABRICA", "Ningbo High-Tech Industrial Zone, China", 100000, 1),
            ]
            for w_id, w_nom, w_tip, w_ubi, w_cap, w_act in sample_warehouses:
                conn.execute(
                    text("""
                        INSERT INTO warehouses (id, nombre, tipo, ubicacion, capacidad_unidades, activo)
                        VALUES (:id, :nom, :tipo, :ubi, :cap, :act)
                    """),
                    {"id": w_id, "nom": w_nom, "tipo": w_tip, "ubi": w_ubi, "cap": w_cap, "act": w_act}
                )
            conn.commit()

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


def init_db(target_engine: Engine = None):
    """Crea todas las tablas si no existen y corre migraciones seguras"""
    eng = target_engine or engine
    from app.models import entities  # Asegurar registro de modelos
    from app.domain import models   # Asegurar registro de modelos del dominio
    Base.metadata.create_all(bind=eng)
    if eng.dialect.name == "sqlite":
        run_non_destructive_migrations(eng)


def get_db():
    """Generador de sesión de base de datos"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
