#!/usr/bin/env python3
"""
scripts/add_multimedia_and_contact_fields.py
Migración idempotente para agregar soporte multimedia (image_url, logo_url) y fichas de contacto (email, phone, address).
Compatible de forma dual con PostgreSQL 16 (pg8000) y SQLite (calcu.db).
"""

import os
import sys
import logging
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

import sqlalchemy as sa
from sqlalchemy import create_engine, text, inspect
from app.models.base import Base
import app.models.entities
import app.domain.models

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("MultimediaMigration")

# Imágenes realistas de productos de iluminación y materiales técnicos
PRODUCT_IMAGES = {
    "LUM-6060": "https://images.unsplash.com/photo-1565814636199-ae8133055c1c?w=500&auto=format&fit=crop&q=80",
    "DRV-DALI": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=80",
    "UFO-150W": "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=500&auto=format&fit=crop&q=80",
    "PANEL-40W": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&auto=format&fit=crop&q=80",
    "STRIP-COB-24V": "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=500&auto=format&fit=crop&q=80",
    "PROF-ALU-2M": "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=500&auto=format&fit=crop&q=80",
    "FOCO-PAR30": "https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=500&auto=format&fit=crop&q=80",
    "CAMP-IND-200W": "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=80",
    "CABLE-SIL-3X15": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80",
    "SENSOR-PIR-360": "https://images.unsplash.com/photo-1558002038-1055907df827?w=500&auto=format&fit=crop&q=80",
    "CONECT-WAGO-3P": "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=500&auto=format&fit=crop&q=80",
    "TERM-RACK-42U": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500&auto=format&fit=crop&q=80",
}

# Datos de contacto corporativo y logos para clientes B2B demo
COMPANIES_DATA = {
    "Saceem Corporativo SA": {
        "rut": "219876540018",
        "email": "abastecimiento@saceem.com.uy",
        "phone": "+598 2916 3300",
        "address": "Plaza Independencia 812, Torre Ejecutiva, Montevideo",
        "logo_url": "https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=200&auto=format&fit=crop&q=80",
    },
    "Constructora del Plata SA": {
        "rut": "214567890015",
        "email": "licitaciones@constructoradelplata.com.uy",
        "phone": "+598 2628 5500",
        "address": "Rambla Armenia 1250, Buceo, Montevideo",
        "logo_url": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200&auto=format&fit=crop&q=80",
    },
    "TechHub Coworking": {
        "rut": "218765430012",
        "email": "compras@techhub.uy",
        "phone": "+598 2900 1234",
        "address": "Av. 18 de Julio 1450, Piso 4, Montevideo",
        "logo_url": "https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&auto=format&fit=crop&q=80",
    },
    "Estudio Arq. Gómez & Asoc": {
        "rut": "217654320019",
        "email": "proyectos@gomezarq.uy",
        "phone": "+598 2711 8899",
        "address": "Ellauri 350, Punta Carretas, Montevideo",
        "logo_url": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=200&auto=format&fit=crop&q=80",
    },
}

DEFAULT_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1565814636199-ae8133055c1c?w=500&auto=format&fit=crop&q=80"


def migrate_engine(engine: sa.Engine, name: str):
    logger.info("Iniciando migración de esquema en motor: %s (%s)", name, engine.dialect.name)
    insp = inspect(engine)
    existing_tables = set(insp.get_table_names())

    with engine.begin() as conn:
        # 1. Crear tablas clients, companies, suppliers si no existen
        for tbl in ["clients", "companies", "suppliers"]:
            if tbl not in existing_tables:
                logger.info("Creando tabla '%s'...", tbl)
                if engine.dialect.name == "postgresql":
                    conn.execute(text(f"""
                        CREATE TABLE IF NOT EXISTS {tbl} (
                            id SERIAL PRIMARY KEY,
                            nombre VARCHAR(150) UNIQUE NOT NULL,
                            rut VARCHAR(50),
                            logo_url VARCHAR(500),
                            email VARCHAR(100),
                            phone VARCHAR(50),
                            address VARCHAR(255),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        );
                    """))
                else:
                    conn.execute(text(f"""
                        CREATE TABLE IF NOT EXISTS {tbl} (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            nombre VARCHAR(150) UNIQUE NOT NULL,
                            rut VARCHAR(50),
                            logo_url VARCHAR(500),
                            email VARCHAR(100),
                            phone VARCHAR(50),
                            address VARCHAR(255),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        );
                    """))

        # 2. Agregar image_url a productos
        for prod_tbl in ["productos", "products"]:
            if prod_tbl in existing_tables:
                cols = {c["name"] for c in insp.get_columns(prod_tbl)}
                if "image_url" not in cols:
                    logger.info("Agregando 'image_url' a tabla '%s'...", prod_tbl)
                    conn.execute(text(f"ALTER TABLE {prod_tbl} ADD COLUMN image_url VARCHAR(500);"))

        # 3. Agregar campos de contacto a commercial_deals, sales_orders, tenders
        contact_tables = ["commercial_deals", "sales_orders", "tenders"]
        contact_columns = [
            ("logo_url", "VARCHAR(500)"),
            ("email", "VARCHAR(100)"),
            ("phone", "VARCHAR(50)"),
            ("address", "VARCHAR(255)"),
        ]

        for tbl in contact_tables:
            if tbl in existing_tables:
                cols = {c["name"] for c in insp.get_columns(tbl)}
                for col_name, col_type in contact_columns:
                    if col_name not in cols:
                        logger.info("Agregando columna '%s' a '%s'...", col_name, tbl)
                        conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN {col_name} {col_type};"))

        # 4. Sembrar / Actualizar imágenes en productos existentes
        for prod_tbl in ["productos", "products"]:
            if prod_tbl in existing_tables:
                for sku, img_url in PRODUCT_IMAGES.items():
                    conn.execute(
                        text(f"UPDATE {prod_tbl} SET image_url = :img WHERE sku = :sku AND (image_url IS NULL OR image_url = '')"),
                        {"img": img_url, "sku": sku}
                    )
                # Para el resto de SKUs sin imagen asignada, asignar fallback
                conn.execute(
                    text(f"UPDATE {prod_tbl} SET image_url = :img WHERE image_url IS NULL OR image_url = ''"),
                    {"img": DEFAULT_FALLBACK_IMAGE}
                )

        # 5. Sembrar / Actualizar datos de contacto y logos en deals, sales_orders y clients
        for client_name, data in COMPANIES_DATA.items():
            # Actualizar en commercial_deals
            if "commercial_deals" in existing_tables:
                conn.execute(
                    text("""
                        UPDATE commercial_deals
                        SET rut = COALESCE(rut, :rut),
                            logo_url = :logo,
                            email = :email,
                            phone = :phone,
                            address = :address
                        WHERE cliente = :nombre
                    """),
                    {
                        "nombre": client_name,
                        "rut": data["rut"],
                        "logo": data["logo_url"],
                        "email": data["email"],
                        "phone": data["phone"],
                        "address": data["address"],
                    }
                )

            # Actualizar en sales_orders
            if "sales_orders" in existing_tables:
                conn.execute(
                    text("""
                        UPDATE sales_orders
                        SET rut = COALESCE(rut, :rut),
                            logo_url = :logo,
                            email = :email,
                            phone = :phone,
                            address = :address
                        WHERE cliente = :nombre
                    """),
                    {
                        "nombre": client_name,
                        "rut": data["rut"],
                        "logo": data["logo_url"],
                        "email": data["email"],
                        "phone": data["phone"],
                        "address": data["address"],
                    }
                )

            # Insertar en tabla clients si existe
            if "clients" in existing_tables:
                # Comprobar si ya existe
                res = conn.execute(text("SELECT id FROM clients WHERE nombre = :nombre"), {"nombre": client_name}).fetchone()
                if not res:
                    conn.execute(
                        text("""
                            INSERT INTO clients (nombre, rut, logo_url, email, phone, address)
                            VALUES (:nombre, :rut, :logo, :email, :phone, :address)
                        """),
                        {
                            "nombre": client_name,
                            "rut": data["rut"],
                            "logo": data["logo_url"],
                            "email": data["email"],
                            "phone": data["phone"],
                            "address": data["address"],
                        }
                    )

    logger.info("Migración y seeding completados con éxito para %s.", name)


def main():
    # 1. Migrar PostgreSQL
    pg_url = os.getenv("DATABASE_URL", "postgresql+pg8000://calcu_user:calcu_secure_pass_2026@localhost:5432/calcu_db")
    try:
        pg_engine = create_engine(pg_url)
        migrate_engine(pg_engine, "PostgreSQL 16")
    except Exception as e:
        logger.error("Error al migrar PostgreSQL: %s", e)

    # 2. Migrar SQLite local (calcu.db)
    sqlite_path = Path("calcu.db").resolve()
    if sqlite_path.exists():
        try:
            sqlite_engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})
            migrate_engine(sqlite_engine, "SQLite Local")
        except Exception as e:
            logger.error("Error al migrar SQLite: %s", e)


if __name__ == "__main__":
    main()
