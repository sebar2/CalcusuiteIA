"""
Suite de Auditoría de Ciberseguridad ISO 27001 & Bóveda Criptográfica AES-256 para Mercado Libre Uruguay.

Superagentes Involucrados:
- security-performance-orchestrator (CISO)
- technical-orchestrator (CTO / Backend Core)
- data-architect (Bases de datos & Aislamiento 3PL)

Validaciones Principales:
1. Almacenamiento seguro en Bóveda AES-256 (CWE-312: Cero secretos en texto claro en SQLite).
2. Prevención de fugas en respuestas HTTP (CWE-532: Enmascaramiento irreversible con ••••).
3. Máquina de estados blindada anti-falsos positivos (Bloqueo de publicaciones sin OAuth2 legítimo).
4. RBAC estricto contra escalación de privilegios (Solo controller_admin puede mutar la bóveda).
5. Linter Anti-Penalización de MeLi (Detección de números uruguayos, dominios, redes y pagos externos).
6. Aislamiento estricto de Inventario vs 3PL Logística (Inmutabilidad de aduana y tránsito marítimo).
"""

import uuid
import json
from decimal import Decimal
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import (
    create_access_token,
    ROLE_CONTROLLER_ADMIN,
    ROLE_ANALISTA_COMERCIAL,
    ROLE_3PL_OPERARIO,
    ROLE_3PL_CONDUCTOR,
)
from app.core.vault import encrypt_vault_payload, decrypt_vault_payload, sanitize_credentials_for_response
from app.services.meli_service import MeliService
from app.database.session import get_db
from app.models.entities import Product, Inventory
from app.models.multitenant_entities import IntegrationConfig, OmnichannelMessage

client = TestClient(app)


def _admin_headers(tenant_id: str = "tenant_calcu_corp") -> dict:
    token = create_access_token({
        "sub": "ciso_admin",
        "role": ROLE_CONTROLLER_ADMIN,
        "tenant_id": tenant_id,
    })
    return {"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id}


def _commercial_headers(tenant_id: str = "tenant_calcu_corp") -> dict:
    token = create_access_token({
        "sub": "vendedor_user",
        "role": ROLE_ANALISTA_COMERCIAL,
        "tenant_id": tenant_id,
    })
    return {"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id}


def _operario_3pl_headers(tenant_id: str = "tenant_calcu_corp") -> dict:
    token = create_access_token({
        "sub": "operario_deposito",
        "role": ROLE_3PL_OPERARIO,
        "tenant_id": tenant_id,
    })
    return {"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id}


# ==============================================================================
# 1. BÓVEDA CRIPTOGRÁFICA & NO PERSISTENCIA EN CLARO (ISO 27001 / CWE-312)
# ==============================================================================

def test_vault_aes256_encryption_integrity_in_database():
    """
    Auditoría ISO 27001: Inspecciona directamente las filas en base de datos SQLite
    para garantizar que 'access_token', 'refresh_token' y 'client_secret' se encuentren
    cifrados con AES y que JAMÁS existan en texto plano en disco.
    """
    db = next(get_db())
    raw_secret = "ultra_secret_mercadolibre_token_12345"
    raw_refresh = "refresh_token_super_secret_67890"

    # Simular guardado criptográfico en bóveda
    encrypted = encrypt_vault_payload({
        "app_id": "5376694505612300",
        "client_secret": "meli_secret_xyz",
        "access_token": raw_secret,
        "refresh_token": raw_refresh,
    })

    cfg = db.query(IntegrationConfig).filter(IntegrationConfig.channel == "MERCADO_LIBRE").first()
    assert cfg is not None
    cfg.encrypted_credentials = encrypted
    db.commit()

    # Re-consultar fila cruda de la base de datos
    db.refresh(cfg)
    raw_db_content = str(cfg.encrypted_credentials)

    # Verificaciones de ciberseguridad
    assert raw_secret not in raw_db_content, "VULNERABILIDAD CWE-312: Token expuesto en texto plano en la BD"
    assert raw_refresh not in raw_db_content, "VULNERABILIDAD CWE-312: Refresh token expuesto en texto plano en la BD"
    assert "meli_secret_xyz" not in raw_db_content, "VULNERABILIDAD CWE-312: Client secret expuesto en la BD"

    # Descifrado verificado con clave del entorno
    decrypted = decrypt_vault_payload(cfg.encrypted_credentials)
    assert decrypted["access_token"] == raw_secret
    assert decrypted["refresh_token"] == raw_refresh


# ==============================================================================
# 2. PREVENCIÓN DE FUGAS EN RESPUESTAS HTTP (CWE-532 / OWASP API3)
# ==============================================================================

def test_zero_secret_leak_in_api_endpoints():
    """
    Verifica que las respuestas JSON de FastAPI nunca devuelvan credenciales sin enmascarar.
    Cualquier campo sensible debe estar protegido con caracteres ••••.
    """
    res = client.get("/api/v1/integrations/channels", headers=_admin_headers())
    assert res.status_code == 200
    channels = res.json()
    meli = next((c for c in channels if c["channel"] == "MERCADO_LIBRE"), None)
    assert meli is not None

    masked = meli.get("masked_credentials", {})
    for field, val in masked.items():
        if field in ("access_token", "refresh_token", "client_secret"):
            assert "•" in str(val), f"El campo {field} no está debidamente enmascarado"
            assert "ultra_secret" not in str(val)


# ==============================================================================
# 3. MÁQUINA DE ESTADOS BLINDADA ANTI-FALSOS POSITIVOS
# ==============================================================================

def test_connected_state_machine_security_gate():
    """
    Verifica que guardar datos parciales (como App ID o Secret) sin token OAuth2 legítimo
    NO cambie el estado a 'CONNECTED', previniendo falsos positivos de sincronización.
    """
    db = next(get_db())
    cfg = db.query(IntegrationConfig).filter(IntegrationConfig.channel == "MERCADO_LIBRE").first()
    if cfg:
        cfg.encrypted_credentials = None
        cfg.status = "PENDING_CREDENTIALS"
        db.commit()

    # Intentar actualizar canal MeLi solo con credenciales de texto plano sin token
    payload = {
        "is_enabled": True,
        "credentials": {
            "app_id": "5376694505612300",
            "client_secret": "dummy_secret_value",
        }
    }
    res = client.put("/api/v1/integrations/channels/MERCADO_LIBRE", json=payload, headers=_admin_headers())
    assert res.status_code == 200
    data = res.json()

    # El estado DEBE ser PENDING_CREDENTIALS porque falta el access_token del vendedor
    assert data["status"] == "PENDING_CREDENTIALS", "Falso positivo: se marcó CONNECTED sin access_token"
    assert data["is_enabled"] is False

    # Intentar publicar un producto debe rebotar con 400 y mensaje educativo
    with patch("app.services.meli_service.MeliService.get_valid_seller_token", return_value=None):
        pub_payload = {
            "sku": "TEST-SECURITY-SKU-999",
            "title": "Producto de Prueba Seguridad",
            "category_id": "MLU1055",
            "price": 1000.0,
            "available_quantity": 5,
        }
        res_pub = client.post("/api/v1/integrations/meli/items", json=pub_payload, headers=_admin_headers())
        assert res_pub.status_code == 400
        assert "Vincule la cuenta vía OAuth2" in res_pub.json()["detail"]


# ==============================================================================
# 4. RBAC ESTRICTO CONTRA ESCALACIÓN DE PRIVILEGIOS
# ==============================================================================

def test_rbac_privilege_escalation_prevention():
    """
    Verifica que roles operarios o comerciales no puedan modificar la bóveda ni
    alterar configuraciones críticas de integración. Solo controller_admin tiene acceso.
    """
    payload = {
        "is_enabled": True,
        "credentials": {"malicious_key": "hacked"},
    }

    # 1. Analista Comercial intenta modificar canal -> 403 Forbidden
    res_comercial = client.put("/api/v1/integrations/channels/MERCADO_LIBRE", json=payload, headers=_commercial_headers())
    assert res_comercial.status_code == 403

    # 2. Operario 3PL intenta modificar canal -> 403 Forbidden
    res_3pl = client.put("/api/v1/integrations/channels/MERCADO_LIBRE", json=payload, headers=_operario_3pl_headers())
    assert res_3pl.status_code == 403

    # 3. Usuario sin token -> 401 Unauthorized
    res_anon = client.put("/api/v1/integrations/channels/MERCADO_LIBRE", json=payload)
    assert res_anon.status_code == 401


# ==============================================================================
# 5. LINTER ANTI-PENALIZACIÓN (DEFENSA EN PROFUNDIDAD)
# ==============================================================================

def test_anti_penalty_linter_advanced_adversarial_evasion():
    """
    Prueba patrones adversariales diseñados para intentar burlar las políticas de MeLi:
    - Teléfonos con puntos, guiones y espaciados uruguayos.
    - Dominios ocultos y enlaces web.
    - Intentos de coordinación de pagos fuera de Mercado Pago.
    """
    adversarial_samples = [
        "Llamame al 099.123.456 y arreglamos",
        "Escribime a +598 94 858 791",
        "Mi celular es 094858791",
        "Visitanos en calcu.uy para ver más",
        "Te hago descuento por fuera de la plataforma",
        "Arreglamos por whatsapp o wpp",
        "Haceme transferencia bancaria y te lo envío directo",
        "Buscame en instagram como @calcu_tienda",
    ]

    for sample in adversarial_samples:
        is_valid, reason = MeliService.validate_anti_penalty(sample)
        assert is_valid is False, f"El linter no detectó infracción en: '{sample}'"
        assert reason is not None and len(reason) > 10

    # Mensajes lícitos permitidos
    legitimate_samples = [
        "Buenas tardes, ¿tienen stock disponible en color blanco?",
        "Hola, ¿cuánto demora el envío al interior?",
        "Las dimensiones son 60cm de ancho por 40cm de profundidad.",
        "El producto cuenta con 12 meses de garantía oficial de fábrica.",
    ]

    for sample in legitimate_samples:
        is_valid, reason = MeliService.validate_anti_penalty(sample)
        assert is_valid is True, f"Falso positivo en mensaje legítimo: '{sample}' (Razón: {reason})"


# ==============================================================================
# 6. AISLAMIENTO ESTRICTO DE INVENTARIO VS 3PL LOGÍSTICA
# ==============================================================================

def test_inventory_isolation_3pl_integrity():
    """
    Garantía de Arquitectura de Datos:
    Las operaciones de sincronización de stock de Mercado Libre ÚNICAMENTE modifican
    la columna 'deposito_central' de la suite corporativa.
    Los stocks bajo régimen 3PL, aduana o tránsito marítimo son estrictamente inmutables.
    """
    db = next(get_db())
    sku_audit = f"SEC-ISO-{uuid.uuid4().hex[:6].upper()}"

    # Crear producto de prueba con inventario multi-depósito
    prod = Product(
        sku=sku_audit,
        nombre="Módulo Seguridad Calcu",
        categoria_id=1,
        costo_base=Decimal("50.00"),
        precio_lista=Decimal("120.00"),
        doh_seguridad=15,
        activo=True,
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)

    inv = Inventory(
        producto_id=prod.id,
        deposito_central=50,
        transito_maritimo=100,  # Stock 3PL / Comercio exterior
        aduana=30,              # Régimen aduanero 3PL
        stock_seguridad=10,
    )
    db.add(inv)
    db.commit()

    # Ejecutar sync-stock simulado
    with patch("app.services.meli_service.MeliService.update_item", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = {"id": "MLU999888", "available_quantity": 50, "status": "active"}

        res = client.post(
            "/api/v1/integrations/meli/items/MLU999888/sync-stock",
            headers=_admin_headers(),
            json={"sku": sku_audit}
        )
        assert res.status_code == 200

    # Verificar que los stocks 3PL / Aduana NO fueron alterados
    db.refresh(inv)
    assert inv.deposito_central == 50
    assert inv.transito_maritimo == 100, "VIOLACIÓN DE AISLAMIENTO: transito_maritimo fue modificado"
    assert inv.aduana == 30, "VIOLACIÓN DE AISLAMIENTO: aduana fue modificada"
    assert inv.stock_seguridad == 10, "VIOLACIÓN DE AISLAMIENTO: stock_seguridad fue modificado"


# ==============================================================================
# 7. RESILIENCIA Y MANEJO DE WEBHOOKS DESCONOCIDOS
# ==============================================================================

def test_webhook_graceful_handling_and_no_crash():
    """
    Verifica que el webhook responda HTTP 200 ante tópicos o notificaciones desconocidas
    para evitar que Mercado Libre penalice la aplicación cancelando la suscripción.
    """
    unknown_payload = {
        "resource": "/unknown_service/12345",
        "user_id": 999999,
        "topic": "unsupported_topic",
        "application_id": 5376694505612300,
        "attempts": 1,
    }
    res = client.post("/api/v1/integrations/webhooks/mercadolibre", json=unknown_payload)
    assert res.status_code == 200
    assert res.json()["status"] == "acknowledged"
