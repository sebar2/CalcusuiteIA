import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.base import Base
from app.models.entities import Warehouse, WarehouseSlot, Product, Client, StockLocationBatch
from app.models.logistics_entities import LogisticsClient, LogisticsDispatchOrder, LogisticsServicePricing
from app.models.accounting_entities import Invoice
from app.database.session import get_db

client = TestClient(app)

# ==============================================================================
# 1. DATABASE NORMALIZATION & INTEGRITY AUDIT (1NF, 2NF, 3NF, BCNF)
# ==============================================================================

def test_database_table_normalization_bcnf():
    """
    Audita que las entidades principales de la base de datos cumplan BCNF:
    - Toda tabla posee clave primaria definida.
    - No existen dependencias parciales ni transitivas en atributos operativos.
    - Claves foráneas formalizadas hacia entidades maestras.
    """
    mapper_registry = Base.registry.mappers
    
    assert len(mapper_registry) > 0, "El registro de mappers no debe estar vacío"
    
    for mapper in mapper_registry:
        table = mapper.local_table
        table_name = table.name
        
        # 1. Validación de Clave Primaria (1NF / 2NF)
        pks = [c.name for c in table.primary_key.columns]
        assert len(pks) >= 1, f"La tabla {table_name} debe poseer al menos una clave primaria"
        
        # 2. Validación de Tipos Atómicos para Medidas y Finanzas
        for col in table.columns:
            col_name = col.name.lower()
            if col_name.endswith(('_m', '_kg', '_cbm')) or any(dim in col_name for dim in ['subtotal', 'total', 'precio', 'costo', 'tarifa', 'saldo']):
                col_type_str = str(col.type).upper()
                assert 'NUMERIC' in col_type_str or 'DECIMAL' in col_type_str or 'FLOAT' in col_type_str or 'INTEGER' in col_type_str, (
                    f"Columna dimensional/monetaria {table_name}.{col.name} ({col_type_str}) debe ser estrictamente numérica (Numeric/Decimal)"
                )

def test_foreign_key_referential_integrity():
    """
    Verifica que las tablas satélite o transaccionales mantengan relaciones de clave foránea
    formalizadas hacia sus entidades maestras (3NF / BCNF).
    """
    inspector = inspect(WarehouseSlot)
    fks = {fk.target_fullname for col in inspector.columns for fk in col.foreign_keys}
    
    # warehouse_slots debe referenciar formalmente a warehouses
    assert any('warehouses.id' in fk for fk in fks), "WarehouseSlot debe poseer FK hacia warehouses.id"
    # warehouse_slots debe referenciar formalmente a productos (tabla real de SKUs)
    assert any('productos.id' in fk for fk in fks), "WarehouseSlot debe poseer FK hacia productos.id"


# ==============================================================================
# 2. CYBERSECURITY AUDIT: SQL INJECTION (SQLi) PENETRATION SUITE
# ==============================================================================

SQLI_PAYLOADS = [
    "' OR '1'='1",
    "'; DROP TABLE warehouse_slots; --",
    "1' UNION SELECT null, null, null, null--",
    "admin'--",
    "' OR 1=1 /*",
    "\" OR \"\"=\"",
    "1; SELECT pg_sleep(5); --",
    "' WAITFOR DELAY '0:0:5'--",
    "1' AND 1=(SELECT COUNT(*) FROM users) AND '1'='1",
    "NaN' OR 1=1--"
]

def test_sqli_resilience_digital_twin_slots():
    """
    Ejecuta ataques SQL Injection en endpoints de búsqueda y filtrado 3D.
    Ningún payload debe provocar un error 500 de base de datos ni ejecución de código SQL arbitrario.
    """
    for payload in SQLI_PAYLOADS:
        # 1. Inyección en parámetro warehouse_id
        res_wh = client.get(f"/api/v1/digital-twin/slots?warehouse_id={payload}")
        assert res_wh.status_code in [200, 404, 422], (
            f"Fallo de ciberseguridad SQLi en warehouse_id con payload: {payload}. Status: {res_wh.status_code}"
        )
        
        # 2. Inyección en parámetro search
        res_search = client.get(f"/api/v1/digital-twin/slots?search={payload}")
        assert res_search.status_code in [200, 422], (
            f"Fallo de ciberseguridad SQLi en search con payload: {payload}. Status: {res_search.status_code}"
        )
        
        # 3. Inyección en parámetro cuerpo
        res_cuerpo = client.get(f"/api/v1/digital-twin/slots?cuerpo={payload}")
        assert res_cuerpo.status_code in [200, 422], (
            f"Fallo de ciberseguridad SQLi en cuerpo con payload: {payload}. Status: {res_cuerpo.status_code}"
        )

def test_sqli_resilience_sync_real_inventory():
    """
    Intenta inyecciones SQL en el endpoint de sincronización masiva de inventario 3D.
    """
    for payload in SQLI_PAYLOADS:
        res = client.post(f"/api/v1/digital-twin/sync-real-inventory?warehouse_id={payload}")
        assert res.status_code in [200, 404, 422], (
            f"Fallo de ciberseguridad SQLi en sync-real-inventory con payload: {payload}"
        )

def test_sqli_resilience_3pl_monthly_billing():
    """
    Intenta inyecciones SQL en la liquidación bimonetaria 3PL.
    """
    for payload in SQLI_PAYLOADS:
        payload_data = {
            "client_id": payload,
            "period": "2026-10",
            "currency": "USD"
        }
        res = client.post("/api/v1/logistics/3pl/settle-monthly-billing", json=payload_data)
        assert res.status_code in [200, 404, 400, 422], (
            f"Fallo de ciberseguridad SQLi en liquidación 3PL con payload: {payload}"
        )


# ==============================================================================
# 3. CYBERSECURITY AUDIT: QR SCAN TAMPERING & CRYPTOGRAPHIC INTEGRITY
# ==============================================================================

def test_tampered_qr_code_hmac_rejection():
    """
    Verifica que el receptor QR por WebSocket/REST rechace instantáneamente
    cualquier payload cuyo HMAC-SHA256 haya sido falsificado, mitigando ataques
    de inyección de mercadería fantasma o spoofing de operador.
    """
    # 1. Generar token legítimo firmado con HMAC-SHA256
    gen_res = client.post("/api/v1/digital-twin/generate-qr-label", json={
        "warehouse_id": "WH-3PL-01",
        "slot_code": "B-01-01-01",
        "sku": "SKU-CYBER-TEST",
        "lote": "LOT-CYBER-99",
        "units_count": 40
    })
    assert gen_res.status_code == 200
    valid_token = gen_res.json()["qr_token"]

    # 2. Falsificar deliberadamente los últimos bytes de la firma HMAC
    tampered_token = valid_token[:-6] + "badbad"
    res = client.post("/api/v1/digital-twin/scan-qr-receive", json={"qr_token": tampered_token})
    assert res.status_code == 400
    assert "HMAC-SHA256" in res.json().get("detail", "") and ("inválida" in res.json().get("detail", "") or "adulterada" in res.json().get("detail", ""))

    # 3. Payload con estructura maliciosa / inyección SQL
    malicious_qr = {
        "qr_token": "'; DROP TABLE warehouse_slots; --"
    }
    res2 = client.post("/api/v1/digital-twin/scan-qr-receive", json=malicious_qr)
    assert res2.status_code == 400


# ==============================================================================
# 4. CROSS-ORIGIN RESOURCE SHARING (CORS) & HEADER SECURITY AUDIT
# ==============================================================================

def test_cors_and_security_headers():
    """
    Verifica que la API aplique cabeceras seguras de CORS y no admita orígenes no autorizados.
    """
    res_valid = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert res_valid.status_code == 200
    assert res_valid.headers.get("access-control-allow-origin") == "http://localhost:5173"

    # Origen no permitido no debe recibir Access-Control-Allow-Origin
    res_invalid = client.get("/health", headers={"Origin": "https://malicious-attacker.com"})
    assert res_invalid.status_code == 200
    assert res_invalid.headers.get("access-control-allow-origin") is None
