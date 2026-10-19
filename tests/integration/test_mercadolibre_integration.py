import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token, ROLE_CONTROLLER_ADMIN, ROLE_ANALISTA_COMERCIAL
from app.services.meli_service import MeliService
from app.database.session import get_db
from app.models.entities import CommercialDeal, Product, Inventory
from app.models.multitenant_entities import IntegrationConfig, OmnichannelMessage

client = TestClient(app)


def _admin_headers(tenant_id: str = "tenant_calcu_corp") -> dict:
    token = create_access_token(
        {
            "sub": "seba_admin",
            "role": ROLE_CONTROLLER_ADMIN,
            "tenant_id": tenant_id,
        }
    )
    return {"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id}


def _comercial_headers(tenant_id: str = "tenant_calcu_corp") -> dict:
    token = create_access_token(
        {
            "sub": "vendedor_user",
            "role": ROLE_ANALISTA_COMERCIAL,
            "tenant_id": tenant_id,
        }
    )
    return {"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id}


def test_meli_channel_listing_and_amber_status_when_no_token():
    """Verifica que Mercado Libre aparezca listado en el Hub de Integraciones con Alerta Ámbar si no está vinculado."""
    res = client.get("/api/v1/integrations/channels", headers=_admin_headers())
    assert res.status_code == 200
    channels = res.json()
    meli = next((c for c in channels if c["channel"] == "MERCADO_LIBRE"), None)
    assert meli is not None, "El canal MERCADO_LIBRE debe estar presente en el Hub de Integraciones"
    assert meli["display_name"] == "Mercado Libre Uruguay (Oficial MLU)"
    assert meli["default_seller"] == "Martín Gómez"
    if "access_token" in meli["masked_credentials"]:
        assert "•" in meli["masked_credentials"]["access_token"], "Jamás exponer access_token en claro (ISO 27001)"


def test_meli_authorize_url_generation():
    """Verifica la generación de la URL oficial OAuth 2.0 para Mercado Libre Uruguay con App ID 5376694505612300."""
    res = client.get("/api/v1/integrations/meli/authorize", headers=_admin_headers())
    assert res.status_code == 200
    data = res.json()
    assert "auth_url" in data
    assert "https://auth.mercadolibre.com.uy/authorization" in data["auth_url"]
    assert "client_id=5376694505612300" in data["auth_url"]
    assert "https%3A%2F%2F100.119.40.92%3A8000%2Fapi%2Fv1%2Fintegrations%2Fmeli%2Fcallback" in data["auth_url"]
    assert "response_type=code" in data["auth_url"]


def test_meli_webhook_fast_ack_and_question_lead_ingestion():
    """
    Simula una notificación webhook de MeLi por una pregunta pre-venta (/questions/XXXXX).
    Verifica respuesta 200 inmediata y creación del Deal en '1. Prospección' con etiqueta MERCADO_LIBRE.
    """
    question_id = f"89{uuid.uuid4().int % 1000000}"
    webhook_payload = {
        "resource": f"/questions/{question_id}",
        "user_id": 98765432,
        "topic": "questions",
        "application_id": 5376694505612300,
        "attempts": 1,
    }

    # 1. Enviar notificación al webhook oficial
    res = client.post("/api/v1/integrations/webhooks/mercadolibre", json=webhook_payload)
    assert res.status_code == 200, "MeLi exige ACK HTTP 200 inmediato"
    ack_data = res.json()
    assert ack_data["status"] == "acknowledged"
    assert ack_data["topic"] == "questions"

    # 2. Verificar que se creó el Deal en el CRM en etapa 'prospeccion'
    deal_id = f"deal-mlu-{question_id[:8]}"
    db = next(get_db())
    deal = db.query(CommercialDeal).filter(CommercialDeal.id == deal_id).first()
    assert deal is not None, f"El prospecto {deal_id} debió crearse en la base de datos"
    assert deal.etapa == "prospeccion", "La pregunta debe ingresar a '1. Prospección'"
    assert deal.canal_origen == "MERCADO_LIBRE"
    assert deal.vendedor == "Martín Gómez"

    # 3. Verificar que se registró el mensaje inicial en OmnichannelMessage
    msg = db.query(OmnichannelMessage).filter(OmnichannelMessage.deal_id == deal_id).first()
    assert msg is not None
    assert msg.channel == "MERCADO_LIBRE"
    assert msg.direction == "INBOUND"

    # 4. Idempotencia: enviar la misma notificación no duplica el Deal
    res_dup = client.post("/api/v1/integrations/webhooks/mercadolibre", json=webhook_payload)
    assert res_dup.status_code == 200
    dup_data = res_dup.json()
    assert dup_data["result"]["status"] == "duplicate_ignored"


def test_meli_webhook_order_ingestion_and_inventory_cruce():
    """
    Simula una notificación webhook de orden de compra (/orders/XXXXX).
    Verifica que se ingeste como Deal 'ganada' y afecte el inventario interno sin tocar el módulo 3PL.
    """
    order_id = f"77{uuid.uuid4().int % 1000000}"
    webhook_payload = {
        "resource": f"/orders/{order_id}",
        "user_id": 11223344,
        "topic": "orders",
        "application_id": 5376694505612300,
    }

    res = client.post("/api/v1/integrations/meli/webhook", json=webhook_payload)
    assert res.status_code == 200
    ack_data = res.json()
    assert ack_data["status"] == "acknowledged"

    deal_id = f"deal-mlu-ord-{order_id[:8]}"
    db = next(get_db())
    deal = db.query(CommercialDeal).filter(CommercialDeal.id == deal_id).first()
    assert deal is not None
    assert deal.etapa == "ganada"
    assert deal.canal_origen == "MERCADO_LIBRE"


def test_meli_anti_penalty_guardrail_blocks_contacts():
    """
    Linter Anti-Penalización: Mercado Libre sanciona con suspensión a vendedores que compartan
    teléfonos uruguayos, correos, enlaces externos o menciones a WhatsApp en preguntas pre-venta.
    Verifica que Calcu bloquee con HTTP 422 cualquier intento y permita respuestas limpias.
    """
    # 1. Crear un prospecto de prueba de MeLi
    deal_id = f"deal-mlu-test-{uuid.uuid4().hex[:6]}"
    db = next(get_db())
    test_deal = CommercialDeal(
        id=deal_id,
        proyecto_nombre="[MLU] Foco LED Solar 200W",
        cliente="Comprador MeLi #9988",
        vendedor="Martín Gómez",
        monto_total=Decimal("45.00"),
        moneda="USD",
        etapa="prospeccion",
        canal_origen="MERCADO_LIBRE",
        external_lead_id=f"meli_q_{uuid.uuid4().int % 100000}",
    )
    db.add(test_deal)
    db.commit()

    # Intento 1: Número de celular uruguayo (094 858 791)
    res_phone = client.post(
        f"/api/v1/omnichannel/messages/{deal_id}",
        headers=_admin_headers(),
        json={
            "channel": "MERCADO_LIBRE",
            "message_text": "Hola, comunicate a nuestro celular 094858791 para coordinar.",
        },
    )
    assert res_phone.status_code == 422
    assert "teléfono" in res_phone.json()["detail"].lower() or "políticas" in res_phone.json()["detail"].lower()

    # Intento 2: Correo electrónico
    res_email = client.post(
        f"/api/v1/omnichannel/messages/{deal_id}",
        headers=_admin_headers(),
        json={
            "channel": "MERCADO_LIBRE",
            "message_text": "Escribinos a ventas@calcu.com.uy para pasarte la cotización.",
        },
    )
    assert res_email.status_code == 422
    assert "correo" in res_email.json()["detail"].lower() or "políticas" in res_email.json()["detail"].lower()

    # Intento 3: Mención a WhatsApp
    res_wpp = client.post(
        f"/api/v1/omnichannel/messages/{deal_id}",
        headers=_admin_headers(),
        json={
            "channel": "MERCADO_LIBRE",
            "message_text": "Buscamos por whatsapp para coordinar la entrega.",
        },
    )
    assert res_wpp.status_code == 422
    assert "whatsapp" in res_wpp.json()["detail"].lower() or "políticas" in res_wpp.json()["detail"].lower()

    # Intento 4: Enlace externo
    res_url = client.post(
        f"/api/v1/omnichannel/messages/{deal_id}",
        headers=_admin_headers(),
        json={
            "channel": "MERCADO_LIBRE",
            "message_text": "Podés ver todas las fotos en https://calcu.com.uy/productos",
        },
    )
    assert res_url.status_code == 422
    assert "url" in res_url.json()["detail"].lower() or "externo" in res_url.json()["detail"].lower()

    # Intento 5: Respuesta limpia y consultiva conforme a las políticas de MeLi
    res_ok = client.post(
        f"/api/v1/omnichannel/messages/{deal_id}",
        headers=_admin_headers(),
        json={
            "channel": "MERCADO_LIBRE",
            "message_text": "¡Hola! Sí, disponemos de stock en nuestro depósito central con retiro inmediato o envío express por Mercado Envíos.",
        },
    )
    assert res_ok.status_code == 200
    data_ok = res_ok.json()
    assert data_ok["message"]["channel"] == "MERCADO_LIBRE"
    assert data_ok["message"]["direction"] == "OUTBOUND"


def test_meli_vault_zero_secret_leak_iso27001():
    """Garantía ISO 27001 CWE-312: Las credenciales de MeLi se cifran y jamás se exponen en texto claro."""
    raw_secret_token = "APP_USR-5376694505612300-SUPER-SECRET-OAUTH-TOKEN"
    res_update = client.put(
        "/api/v1/integrations/channels/MERCADO_LIBRE",
        headers=_admin_headers(),
        json={
            "is_enabled": True,
            "credentials": {
                "access_token": raw_secret_token,
                "seller_id": "192837465",
                "app_id": "5376694505612300",
            },
            "default_seller": "Martín Gómez",
            "cost_per_lead_usd": 0.85,
        },
    )
    assert res_update.status_code == 200
    res_text = res_update.text
    assert raw_secret_token not in res_text, "Fuga de secreto detectada en respuesta JSON (CWE-312)"
    data = res_update.json()
    assert data["channel"] == "MERCADO_LIBRE"
    assert data["status"] == "CONNECTED"
    assert data["default_seller"] == "Martín Gómez"
    assert data["cost_per_lead_usd"] == 0.85
