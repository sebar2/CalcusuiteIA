#!/usr/bin/env python
"""
Sembrado DML de Lotes Multi-Origen en stock_location_batches.
Asegura lotes para los 3 orígenes:
  - STOCK_DIRECTO: en DEP-CENTRAL-MVD y SHOWROOM-POCITOS.
  - LICITACION_B2B: en TRANSITO-MAR (buque para Saceem/Bahía) y FAB-CHINA.
  - ROP_REPOSICION: en FAB-CHINA y DEP-SALTO.
Sin tocar DDL (respeta Alembic 0001_baseline).
"""

import os
import sys

# Asegurar que el directorio raíz del proyecto esté en sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import date, timedelta
from app.database.session import SessionLocal
from app.models.entities import StockLocationBatch, Product, Warehouse

def seed_multiorigin_batches():
    db = SessionLocal()
    try:
        products = db.query(Product).all()
        if not products:
            print("No se encontraron productos en la base de datos.")
            return

        prod_map = {p.sku: p for p in products}
        skus = list(prod_map.keys())
        today = date.today()

        batches_data = [
            # 1. STOCK_DIRECTO
            {
                "id": "LOT-DIR-MVD-001",
                "sku": "LUM-6060" if "LUM-6060" in prod_map else skus[0],
                "cantidad": 350,
                "ubicacion": "DEP-CENTRAL-MVD",
                "pais_origen": "CN",
                "buque_o_tracking": "TRK-LOCAL-MVD-881",
                "fecha_despacho": today - timedelta(days=5),
                "fecha_eta": today,
                "estado": "DISPONIBLE",
                "observaciones": "Origen: STOCK_DIRECTO | Stock físico nacionalizado para despacho inmediato"
            },
            {
                "id": "LOT-DIR-MVD-002",
                "sku": "UFO-150W" if "UFO-150W" in prod_map else skus[1],
                "cantidad": 180,
                "ubicacion": "DEP-CENTRAL-MVD",
                "pais_origen": "CN",
                "buque_o_tracking": "TRK-LOCAL-MVD-882",
                "fecha_despacho": today - timedelta(days=8),
                "fecha_eta": today,
                "estado": "DISPONIBLE",
                "observaciones": "Origen: STOCK_DIRECTO | Reserva de stock central"
            },
            {
                "id": "LOT-DIR-POC-001",
                "sku": "DRV-DALI" if "DRV-DALI" in prod_map else skus[2],
                "cantidad": 95,
                "ubicacion": "SHOWROOM-POCITOS",
                "pais_origen": "DE",
                "buque_o_tracking": "SHOWROOM-LOCAL-01",
                "fecha_despacho": today - timedelta(days=2),
                "fecha_eta": today,
                "estado": "DISPONIBLE",
                "observaciones": "Origen: STOCK_DIRECTO | Exhibición y venta en mesón Pocitos"
            },

            # 2. LICITACION_B2B
            {
                "id": "LOT-LIC-MAR-001",
                "sku": "LUM-6060" if "LUM-6060" in prod_map else skus[0],
                "cantidad": 420,
                "ubicacion": "TRANSITO-MAR",
                "pais_origen": "CN",
                "buque_o_tracking": "MSC-CAP-SAN-DIEGO-774B",
                "fecha_despacho": today - timedelta(days=12),
                "fecha_eta": today + timedelta(days=18),
                "estado": "EN_TRANSITO",
                "observaciones": "Origen: LICITACION_B2B | Licitación ARCE - Obra Hospitalaria Saceem y Bahía"
            },
            {
                "id": "LOT-LIC-MAR-002",
                "sku": "DRV-DALI" if "DRV-DALI" in prod_map else skus[2],
                "cantidad": 250,
                "ubicacion": "TRANSITO-MAR",
                "pais_origen": "DE",
                "buque_o_tracking": "CMA-CGM-ATLANTIC-112",
                "fecha_despacho": today - timedelta(days=8),
                "fecha_eta": today + timedelta(days=22),
                "estado": "EN_TRANSITO",
                "observaciones": "Origen: LICITACION_B2B | Adjudicación Licitación Iluminación Pública"
            },
            {
                "id": "LOT-LIC-FAB-001",
                "sku": "UFO-150W" if "UFO-150W" in prod_map else skus[1],
                "cantidad": 300,
                "ubicacion": "FAB-CHINA",
                "pais_origen": "CN",
                "buque_o_tracking": "PO-LIC-2026-SHENZHEN",
                "fecha_despacho": today + timedelta(days=5),
                "fecha_eta": today + timedelta(days=40),
                "estado": "EN_PRODUCCION",
                "observaciones": "Origen: LICITACION_B2B | Proyecto Licitatorio Corporativo"
            },

            # 3. ROP_REPOSICION
            {
                "id": "LOT-ROP-FAB-001",
                "sku": "SKU-1001" if "SKU-1001" in prod_map else skus[3],
                "cantidad": 200,
                "ubicacion": "FAB-CHINA",
                "pais_origen": "CN",
                "buque_o_tracking": "PO-ROP-2026-BATCH-01",
                "fecha_despacho": today + timedelta(days=7),
                "fecha_eta": today + timedelta(days=35),
                "estado": "EN_PRODUCCION",
                "observaciones": "Origen: ROP_REPOSICION | Disparo automático Punto de Pedido"
            },
            {
                "id": "LOT-ROP-SALTO-001",
                "sku": "SKU-1002" if "SKU-1002" in prod_map else skus[4],
                "cantidad": 120,
                "ubicacion": "DEP-SALTO",
                "pais_origen": "CN",
                "buque_o_tracking": "CAMION-SALTO-EXP-4",
                "fecha_despacho": today - timedelta(days=1),
                "fecha_eta": today,
                "estado": "DISPONIBLE",
                "observaciones": "Origen: ROP_REPOSICION | Reposición regional según DOH de seguridad"
            },
            {
                "id": "LOT-ROP-FAB-002",
                "sku": "LUM-6060" if "LUM-6060" in prod_map else skus[0],
                "cantidad": 150,
                "ubicacion": "FAB-CHINA",
                "pais_origen": "CN",
                "buque_o_tracking": "PO-ROP-2026-PANEL-99",
                "fecha_despacho": today + timedelta(days=10),
                "fecha_eta": today + timedelta(days=38),
                "estado": "EN_PRODUCCION",
                "observaciones": "Origen: ROP_REPOSICION | Cobertura preventiva de stock"
            }
        ]

        inserted = 0
        updated = 0

        for b_dict in batches_data:
            existing = db.query(StockLocationBatch).filter(StockLocationBatch.id == b_dict["id"]).first()
            if existing:
                existing.sku = b_dict["sku"]
                existing.cantidad = b_dict["cantidad"]
                existing.ubicacion = b_dict["ubicacion"]
                existing.pais_origen = b_dict["pais_origen"]
                existing.buque_o_tracking = b_dict["buque_o_tracking"]
                existing.fecha_despacho = b_dict["fecha_despacho"]
                existing.fecha_eta = b_dict["fecha_eta"]
                existing.estado = b_dict["estado"]
                existing.observaciones = b_dict["observaciones"]
                updated += 1
            else:
                new_batch = StockLocationBatch(
                    id=b_dict["id"],
                    sku=b_dict["sku"],
                    cantidad=b_dict["cantidad"],
                    ubicacion=b_dict["ubicacion"],
                    pais_origen=b_dict["pais_origen"],
                    buque_o_tracking=b_dict["buque_o_tracking"],
                    fecha_despacho=b_dict["fecha_despacho"],
                    fecha_eta=b_dict["fecha_eta"],
                    estado=b_dict["estado"],
                    observaciones=b_dict["observaciones"]
                )
                db.add(new_batch)
                inserted += 1

        db.commit()
        print(f"Sembrado multi-origen completado: {inserted} insertados, {updated} actualizados.")

        # Verificar conteo por origen
        all_batches = db.query(StockLocationBatch).all()
        lic_count = sum(1 for b in all_batches if "LICIT" in (b.observaciones or "").upper() or "LICIT" in (b.id or "").upper())
        rop_count = sum(1 for b in all_batches if "ROP" in (b.observaciones or "").upper() or "ROP" in (b.id or "").upper())
        dir_count = sum(1 for b in all_batches if "DIRECTO" in (b.observaciones or "").upper() or "DIR" in (b.id or "").upper())
        print(f"Total Lotes en BD: {len(all_batches)} (Licitación: {lic_count}, ROP: {rop_count}, Directo: {dir_count})")

    except Exception as e:
        db.rollback()
        print(f"Error en el sembrado multi-origen: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_multiorigin_batches()
