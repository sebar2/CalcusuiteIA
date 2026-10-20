"""Pruebas unitarias e integración para Jerarquía Superadmin Propietario,
Módulo de Configuraciones Dual y Agente IA Guardián de Ciberseguridad.
"""
from datetime import timedelta
import pytest
from starlette.testclient import TestClient

from app.main import app
from app.core.security import create_access_token
from app.database.session import SessionLocal, init_db
from app.models.multitenant_entities import TenantAccount


@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def admin_headers():
    token = create_access_token(
        {"sub": "seba", "role": "controller_admin", "tenant_id": "tenant_calcu_corp"},
        expires_delta=timedelta(hours=2),
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": "tenant_calcu_corp",
        "X-User-Role": "controller_admin",
    }


@pytest.fixture(scope="module")
def tenant_admin_headers():
    token = create_access_token(
        {"sub": "admin_distsur", "role": "controller_admin", "tenant_id": "tenant_distsur"},
        expires_delta=timedelta(hours=2),
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": "tenant_distsur",
        "X-User-Role": "controller_admin",
    }


# ============================================================================
# 1. JERARQUÍA DE SUPERADMINISTRADOR Y ESTADO PROPIETARIO
# ============================================================================

def test_tenant_calcu_corp_owner_hierarchy(client, admin_headers):
    """Verifica que tenant_calcu_corp tenga rol PROPIETARIO (OWNER) y ACTIVE_PAID inmutable."""
    with SessionLocal() as db:
        tenant = db.query(TenantAccount).filter(TenantAccount.id == "tenant_calcu_corp").first()
        assert tenant is not None
        assert tenant.account_role == "PROPIETARIO (OWNER)"
        assert tenant.subscription_status == "ACTIVE_PAID"
        assert tenant.license_tier == "ENTERPRISE_3PL"

    # Verificar a través de API GET /api/v1/tenants/current
    res = client.get("/api/v1/tenants/current", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["account_role"] == "PROPIETARIO (OWNER)"
    assert data["subscription_status"] == "ACTIVE_PAID"


def test_tenant_calcu_corp_prevents_db_degradation(client, admin_headers):
    """Verifica que un intento de degradar tenant_calcu_corp active simulación sin degradar DB."""
    payload = {
        "license_tier": "STARTER",
        "simulated_tier": "STARTER",
    }
    res = client.patch("/api/v1/tenants/tenant_calcu_corp/license", json=payload, headers=admin_headers)
    assert res.status_code == 200
    data = res.json()

    # En la base de datos se mantiene inmutable
    assert data["account_role"] == "PROPIETARIO (OWNER)"
    assert data["subscription_status"] == "ACTIVE_PAID"
    assert data["license_tier"] == "ENTERPRISE_3PL"
    # Permite simulación efímera para pruebas de UI
    assert data["simulated_tier"] == "STARTER"


# ============================================================================
# 2. TELEMETRÍA DE RED Y PAQUETES EN VIVO
# ============================================================================

def test_settings_network_telemetry(client, admin_headers):
    """GET /api/v1/settings/telemetry devuelve estado de Tailscale, WebSockets, API y puertos."""
    res = client.get("/api/v1/settings/telemetry", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "mesh_telemetry" in data
    assert "websockets_telemetry" in data
    assert "api_core_metrics" in data
    assert "ports_perimeter_audit" in data
    assert data["mesh_telemetry"]["direct_p2p_count"] >= 1
    assert 8000 in data["ports_perimeter_audit"]["detected_open_ports"]


# ============================================================================
# 3. GESTIÓN DEL MOTOR IA & BÓVEDA AES-256
# ============================================================================

def test_settings_ai_vault_config_and_rotation(client, admin_headers):
    """Prueba lectura de configuración de IA/Vault y rotación de claves AES-256."""
    res = client.get("/api/v1/settings/ai-vault", headers=admin_headers)
    assert res.status_code == 200
    cfg = res.json()
    assert "ai_engine" in cfg
    assert "cryptographic_vault" in cfg
    assert "AES-256" in cfg["cryptographic_vault"]["algorithm"]

    # Rotación de claves
    rot_res = client.post("/api/v1/settings/ai-vault/rotate-keys", headers=admin_headers)
    assert rot_res.status_code == 200
    rot_data = rot_res.json()
    assert rot_data["success"] is True
    assert "rotated_at" in rot_data
    assert "new_fingerprint" in rot_data

    # Actualizar parámetros de inferencia
    param_res = client.post(
        "/api/v1/settings/ai-vault/parameters",
        json={"temperature": 0.25},
        headers=admin_headers,
    )
    assert param_res.status_code == 200
    assert param_res.json()["default_temperature"] == 0.25


# ============================================================================
# 4. SOPORTE REMOTO JIT (JUST-IN-TIME) CON CONSENTIMIENTO ISO 27001
# ============================================================================

def test_settings_jit_support_lifecycle(client, admin_headers, tenant_admin_headers):
    """Valida el ciclo de vida JIT: Solicitud -> Aprobación (60 min token) -> Revocación."""
    # 1. Superadmin solicita soporte a tenant_distsur
    req_payload = {
        "target_tenant_id": "tenant_distsur",
        "reason": "Mantenimiento preventivo de sincronización e-Factura DGI",
    }
    req_res = client.post("/api/v1/settings/jit-support/request", json=req_payload, headers=admin_headers)
    assert req_res.status_code == 200
    session_data = req_res.json()
    session_id = session_data["session_id"]
    assert session_data["status"] == "PENDING_TENANT_CONSENT"

    # 2. Admin del Tenant aprueba el acceso temporal
    approve_payload = {"session_id": session_id, "action": "approve"}
    appr_res = client.post("/api/v1/settings/jit-support/action", json=approve_payload, headers=tenant_admin_headers)
    assert appr_res.status_code == 200
    appr_data = appr_res.json()
    assert appr_data["status"] == "ACTIVE_APPROVED_60MIN"
    assert appr_data["record"]["access_token"] is not None
    assert appr_data["record"]["duration_minutes"] == 60

    # 3. Revocar acceso anticipadamente
    revoke_payload = {"session_id": session_id, "action": "revoke"}
    rev_res = client.post("/api/v1/settings/jit-support/action", json=revoke_payload, headers=tenant_admin_headers)
    assert rev_res.status_code == 200
    assert rev_res.json()["status"] == "REVOKED_BY_ADMIN"


# ============================================================================
# 5. PARÁMETROS OPERATIVOS DEL TENANT
# ============================================================================

def test_settings_tenant_operational_params(client, tenant_admin_headers):
    """GET y PUT de parámetros operativos para el tenant (DGI, ROP, alertas)."""
    # GET inicial
    res_get = client.get("/api/v1/settings/tenant-params", headers=tenant_admin_headers)
    assert res_get.status_code == 200
    params = res_get.json()
    assert "rut_dgi" in params
    assert "rop_min_days_alert" in params

    # PUT actualización
    update_payload = {
        "razon_social": "Distribuidora del Sur S.A. Renovada",
        "rut_dgi": "219988770014",
        "rop_min_days_alert": 7,
        "doh_critical_alert": 15,
        "whatsapp_notifications": True,
    }
    res_put = client.put("/api/v1/settings/tenant-params", json=update_payload, headers=tenant_admin_headers)
    assert res_put.status_code == 200
    updated = res_put.json()
    assert updated["success"] is True
    assert updated["parameters"]["razon_social"] == "Distribuidora del Sur S.A. Renovada"
    assert updated["parameters"]["rop_min_days_alert"] == 7
    assert updated["parameters"]["doh_critical_alert"] == 15


# ============================================================================
# 6. COPILOTO IA DE CIBERSEGURIDAD (SECOPS COPILOT)
# ============================================================================

def test_settings_cybersec_ai_copilot_audit(client, admin_headers):
    """Verifica la ejecución del análisis de ciberseguridad del SecOps Copilot."""
    payload = {
        "prompt": "Verificar integridad de aislamiento de esquemas y puertos expuestos.",
    }
    # Endpoint principal en /api/v1/settings/cybersec-copilot
    res = client.post("/api/v1/settings/cybersec-copilot", json=payload, headers=admin_headers)
    assert res.status_code == 200
    audit = res.json()
    assert audit["success"] is True
    assert audit["agent"] == "Cybersec AI Guardian (SecOps Copilot)"
    assert "respuesta" in audit
    assert "metrics" in audit
    assert audit["metrics"]["port_anomalies_count"] == 0
    assert audit["metrics"]["owner_status"] == "ACTIVE_PAID (PERPETUO)"

    # Endpoint delegado en /api/v1/monitoring/cybersec-copilot
    mon_res = client.post("/api/v1/monitoring/cybersec-copilot", json=payload, headers=admin_headers)
    assert mon_res.status_code == 200
    assert mon_res.json()["success"] is True
    assert mon_res.json()["agent"] == "Cybersec AI Guardian (SecOps Copilot)"
