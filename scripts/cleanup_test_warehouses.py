"""
Script de consolidación y limpieza de depósitos huérfanos o duplicados.
Garantiza que únicamente permanezcan activos y limpios los 5 nodos logísticos canónicos de Calcu:
1. FAB-CHINA
2. TRANSITO-MAR
3. DEP-CENTRAL-MVD
4. DEP-SALTO
5. SHOWROOM-POCITOS
"""
import sys
import os

# Asegurar path de Calcu
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.session import SessionLocal, engine
from app.models.entities import Warehouse, StockLocationBatch
from app.services.inventory_sync_service import inventory_sync_service


def cleanup_warehouses():
    print("=== INICIANDO CONSOLIDACIÓN DE DEPÓSITOS EN CALCU ===")
    
    with SessionLocal() as db:
        # 1. Asegurar depósitos canónicos
        inventory_sync_service.ensure_default_warehouses(db)

        canonical_ids = {
            "FAB-CHINA",
            "TRANSITO-MAR",
            "DEP-CENTRAL-MVD",
            "DEP-SALTO",
            "SHOWROOM-POCITOS"
        }

        # 2. Consultar todos los depósitos
        all_warehouses = db.query(Warehouse).all()
        print(f"Total depósitos encontrados en base de datos: {len(all_warehouses)}")

        reassigned_batches = 0
        deleted_warehouses = 0

        for wh in all_warehouses:
            if wh.id in canonical_ids:
                print(f" [OK] Depósito canónico conservado: {wh.id} ({wh.nombre})")
                continue

            # Determinar a qué depósito canónico consolidar
            wh_lower = wh.id.lower()
            if "salto" in wh_lower:
                target_canonical = "DEP-SALTO"
            elif "pocitos" in wh_lower or "showroom" in wh_lower:
                target_canonical = "SHOWROOM-POCITOS"
            elif "transito" in wh_lower or "aduana" in wh_lower:
                target_canonical = "TRANSITO-MAR"
            elif "fabrica" in wh_lower or "china" in wh_lower:
                target_canonical = "FAB-CHINA"
            else:
                target_canonical = "DEP-CENTRAL-MVD"

            print(f" [MIGRATE] Depósito redundante: '{wh.id}' -> Reasignando hacia '{target_canonical}'")

            # Reasignar lotes asociados a esta ubicación
            batches = db.query(StockLocationBatch).filter(
                (StockLocationBatch.ubicacion == wh.id) |
                (StockLocationBatch.ubicacion == wh.nombre)
            ).all()

            for b in batches:
                rev_target = inventory_sync_service.LOCATION_REVERSE_MAP.get(target_canonical, "deposito_central")
                b.ubicacion = rev_target
                b.observaciones = f"Consolidado desde depósito redundante {wh.id}. {b.observaciones or ''}".strip()
                reassigned_batches += 1

            # Eliminar depósito redundante
            db.delete(wh)
            deleted_warehouses += 1

        db.commit()
        print(f"=== RESULTADOS DE LIMPIEZA ===")
        print(f" - Lotes reasignados: {reassigned_batches}")
        print(f" - Depósitos eliminados: {deleted_warehouses}")

        remaining = db.query(Warehouse).all()
        print(f" - Depósitos activos finales ({len(remaining)}):")
        for r in remaining:
            print(f"   * [{r.id}] {r.nombre} ({r.tipo}) - Capacidad: {r.capacidad_unidades}")


if __name__ == "__main__":
    cleanup_warehouses()
