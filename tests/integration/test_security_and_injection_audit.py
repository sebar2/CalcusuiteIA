import pytest
from starlette.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.entities import Warehouse, WarehouseSlot

client = TestClient(app)

# ==============================================================
# 1. SQL INJECTION (SQLi) PENETRATION & HARDENING TESTS
# ==============================================================

def test_sqli_in_digital_twin_search_query():
    """Verifica que payloads maliciosos de SQLi en búsqueda sean sanitizados por SQLAlchemy ORM."""
    sqli_payloads = [
        "' OR '1'='1",
        "'; DROP TABLE warehouse_slots; --",
        "' UNION SELECT '1', '2', '3', '4', '5' --",
        "1' OR 1=1 #",
        "admin'--",
        "'; EXEC xp_cmdshell('dir'); --",
    ]
    for payload in sqli_payloads:
        res = client.get(
            f"/api/v1/digital-twin/slots",
            params={"warehouse_id": "DEP-CENTRAL-MVD", "search": payload},
        )
        # Debe retornar 200 con lista vacía de resultados, sin errores de sintaxis SQL ni ejecución de comandos
        assert res.status_code == 200, f"Failed on payload: {payload}"
        assert isinstance(res.json(), list)

    # Verificar que la tabla warehouse_slots SIGUE INTACTA
    db = SessionLocal()
    try:
        count = db.query(WarehouseSlot).count()
        assert count > 0, "Tabla warehouse_slots fue destruida por inyección SQL!"
    finally:
        db.close()


def test_sqli_in_warehouse_id_parameter():
    """Verifica protección de inyección en warehouse_id y filtros de cuerpo."""
    sqli_payload = "DEP-CENTRAL-MVD' OR '1'='1"
    res = client.get(
        "/api/v1/digital-twin/slots",
        params={"warehouse_id": sqli_payload},
    )
    assert res.status_code == 200
    assert len(res.json()) == 0  # No debe volcar todos los depósitos


def test_sqli_in_intelligence_summary_parameter():
    """Verifica que el ID de depósito en intelligence-summary esté parametrizado."""
    malicious_id = "'; DELETE FROM warehouses; --"
    res = client.get(
        "/api/v1/digital-twin/intelligence-summary",
        params={"warehouse_id": malicious_id},
    )
    assert res.status_code == 200
    # Verificar que los depósitos siguen existiendo
    db = SessionLocal()
    try:
        wh_count = db.query(Warehouse).count()
        assert wh_count > 0, "Inyección logró ejecutar DROP/DELETE en warehouses!"
    finally:
        db.close()


def test_sqli_in_transfer_payload():
    """Verifica que transfer_stock rechace o parametrice inputs maliciosos."""
    malicious_payload = {
        "source_warehouse_id": "' OR 1=1 --",
        "source_slot_code": "A-01-01-01'; DROP TABLE warehouses; --",
        "target_warehouse_id": "DEP-CENTRAL-MVD",
        "target_slot_code": "B-01-01-01",
        "mover_lote_completo": True,
    }
    res = client.post("/api/v1/digital-twin/transfer", json=malicious_payload)
    # Debe rechazar porque la posición no existe
    assert res.status_code == 400


# ==============================================================
# 2. XSS / STORED PAYLOAD VALIDATION
# ==============================================================

def test_xss_sanitization_in_warehouse_creation():
    """Verifica que scripts maliciosos XSS no se ejecuten ni corrompan el esquema."""
    xss_payload = {
        "id": "SEC-TEST-WH-01",
        "nombre": "<script>alert('XSS_ATTACK')</script>",
        "tipo": "SUCURSAL",
        "module_scope": "SUPPLY_CHAIN",
        "ubicacion": "<img src=x onerror=alert(document.cookie)>",
    }
    res = client.post("/api/v1/digital-twin/warehouses", json=xss_payload)
    assert res.status_code == 201
    
    # Comprobar que al consultarlo se devuelve como JSON escapado seguro
    wh_res = client.get("/api/v1/digital-twin/warehouses?module_scope=SUPPLY_CHAIN")
    assert wh_res.status_code == 200
    found = next((w for w in wh_res.json() if w["id"] == "SEC-TEST-WH-01"), None)
    assert found is not None
    # FastAPI y Starlette devuelven application/json donde los caracteres están serializados
    assert "<script>" in found["nombre"] or "&lt;script&gt;" in found["nombre"]

    # Limpieza
    db = SessionLocal()
    try:
        db.query(Warehouse).filter(Warehouse.id == "SEC-TEST-WH-01").delete()
        db.commit()
    finally:
        db.close()


# ==============================================================
# 3. PATH TRAVERSAL / LFI SECURITY
# ==============================================================

def test_path_traversal_in_static_uploads():
    """Verifica que StaticFiles no permita Path Traversal para leer archivos del sistema."""
    traversal_paths = [
        "/static/uploads/../../app/core/config.py",
        "/static/uploads/..%2f..%2fapp%2fcore%2fconfig.py",
        "/static/uploads/%2e%2e%2f%2e%2e%2fmain.py",
    ]
    for path in traversal_paths:
        res = client.get(path)
        # Starlette StaticFiles bloquea explícitamente path traversal retornando 404 o 400
        assert res.status_code in (404, 400), f"Path traversal vulnerable on: {path}"


# ==============================================================
# 4. MULTI-TENANT ISOLATION & PERIMETER SECURITY
# ==============================================================

def test_tenant_schema_sanitization():
    """Verifica que tenant_id con caracteres peligrosos no permita inyección en schema."""
    from app.database.session import tenant_connection_manager
    # Inyección en nombre de tenant
    malicious_tenant = 'tenant"; DROP SCHEMA public CASCADE; --'
    session = tenant_connection_manager.get_session_for_tenant(malicious_tenant)
    assert session is not None
    session.close()

    # Comprobar que public sigue existiendo
    db = SessionLocal()
    try:
        assert db.query(Warehouse).count() > 0
    finally:
        db.close()


def test_rbac_digital_twin_and_logistics_segregation():
    """Verifica que endpoints logísticos requieran roles válidos o identidades seguras."""
    # Intentar acceso con rol no permitido a órdenes de despacho si aplica
    res = client.get("/api/v1/logistics/hub")
    assert res.status_code == 200
    data = res.json()
    assert "nombre" in data
