#!/usr/bin/env python
"""
Script de Higiene y Saneamiento de Lotes de Prueba: Calcu (SupplyFinance-Core).

Objetivo:
1. Eliminar lotes repetitivos residuales de pruebas de integración (ej. 'LOT-2026-TEST-6060-SHO-...').
2. Mantener la integridad referencial de la base de datos (no altera inventarios físicos reales ni órdenes de venta).
3. Asegurar una distribución limpia y representativa de 1 o 2 lotes clave por fase logística:
   - Fábricas en Origen (FAB-CHINA / fabrica_origen)
   - Tránsito Marítimo / Alta Mar (TRANSITO-MAR)
   - Depósito Central Montevideo (DEP-CENTRAL-MVD)
   - Sucursal Salto (DEP-SALTO)
   - Showroom Pocitos (SHOWROOM-POCITOS)
   - Proveedores Uy / Reventa Local
"""

import os
import sys
import subprocess
from datetime import date, timedelta

# Asegurar path raíz del proyecto
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

def run_psql_command(sql: str):
    """Ejecuta SQL directamente en el contenedor Docker calcu-postgres de forma segura."""
    cmd = [
        "docker", "exec", "-i", "calcu-postgres",
        "psql", "-U", "calcu_user", "-d", "calcu_db",
        "-c", sql
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error ejecutando SQL: {res.stderr}")
        return None
    return res.stdout

def clean_test_lots():
    print("[*] Iniciando protocolo de saneamiento de lotes en Calcu...")

    # 1. Eliminar lotes repetitivos de transferencias de test en showrooms_locales
    sql_cleanup = """
    DELETE FROM stock_location_batches 
    WHERE id LIKE 'LOT-2026-TEST-6060-SHO-%'
       OR id = 'LOT-AUTO-ARRIVE-999'
       OR id LIKE 'LOT-DIR-2026-%';
    """
    res = run_psql_command(sql_cleanup)
    print("Lotes residuales eliminados:")
    print(res)

    # 2. Reajustar lote representativo de prueba 'LOT-2026-TEST-6060' a una cantidad limpia
    sql_adjust = """
    UPDATE stock_location_batches 
    SET cantidad = 500, warehouse_id = 'DEP-CENTRAL-MVD'
    WHERE id = 'LOT-2026-TEST-6060';
    """
    run_psql_command(sql_adjust)

    # 3. Asegurar que exista un lote de muestra en Showroom Pocitos y Proveedor Uy
    sql_ensure = """
    -- Verificar o actualizar lote de muestra en Pocitos
    UPDATE stock_location_batches 
    SET warehouse_id = 'SHOWROOM-POCITOS' 
    WHERE id = 'LOT-DIR-POC-001';

    -- Asegurar lote representativo de Proveedor Reventa Uy si no existe
    INSERT INTO stock_location_batches (
        id, sku, cantidad, ubicacion, pais_origen, buque_o_tracking, 
        fecha_despacho, fecha_eta, estado, observaciones, 
        warehouse_id, supplier_id, estado_aprobacion, costo_compra
    )
    SELECT 
        'LOT-REV-UY-001', 'LUM-6060', 100, 'proveedor_uy', 'UY', 'ORDEN-LOCAL-DIR-01',
        CURRENT_DATE, CURRENT_DATE + INTERVAL '2 days', 'DISPONIBLE', 'Stock local de reventa disponible para entrega en 48hs.',
        'DEP-CENTRAL-MVD', 10, 'APROBADO', 18.5000
    WHERE NOT EXISTS (
        SELECT 1 FROM stock_location_batches WHERE id = 'LOT-REV-UY-001'
    );
    """
    run_psql_command(sql_ensure)

    # 4. Mostrar resumen consolidado por ubicación
    sql_summary = """
    SELECT 
        COALESCE(warehouse_id, ubicacion) AS fase_logistica, 
        COUNT(*) AS total_lotes, 
        SUM(cantidad) AS unidades_totales 
    FROM stock_location_batches 
    GROUP BY COALESCE(warehouse_id, ubicacion)
    ORDER BY fase_logistica;
    """
    summary = run_psql_command(sql_summary)
    print("\n[OK] Estado consolidado de lotes tras saneamiento:")
    print(summary)
    print("[DONE] Protocolo de saneamiento finalizado con exito.")

if __name__ == "__main__":
    clean_test_lots()
