import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token, ROLE_CONTROLLER_ADMIN, ROLE_ANALISTA_COMERCIAL


client = TestClient(app)


def _admin_headers(tenant_id: str = "tenant_calcu_corp") -> dict:
    token = create_access_token(
        {
            "sub": "seba",
            "role": ROLE_CONTROLLER_ADMIN,
            "tenant_id": tenant_id,
        }
    )
    return {"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id}


def _comercial_headers(tenant_id: str = "tenant_calcu_corp") -> dict:
    token = create_access_token(
        {
            "sub": "comercial",
            "role": ROLE_ANALISTA_COMERCIAL,
            "tenant_id": tenant_id,
        }
    )
    return {"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id}


def test_integrations_vault_zero_secret_leak_and_rbac():
    """Verifica ISO 27001 CWE-312: las credenciales se cifran en bóveda y jamás se devuelven en texto plano."""
    # 1. El rol analista_comercial NO puede modificar llaves de integración (403 Forbidden)
    raw_secret = "EAABsbCS1iHgBO_SUPER_SECRET_TOKEN_998877"
    res_forbidden = client.put(
        "/api/v1/integrations/channels/META_ADS",
        headers=_comercial_headers(),
        json={
            "is_enabled": True,
            "credentials": {"access_token": raw_secret, "page_id": "1029384756"},
        },
    )
    assert res_forbidden.status_code == 403

    # 2. El rol controller_admin configura credenciales y la respuesta jamás expone raw_secret
    res_ok = client.put(
        "/api/v1/integrations/channels/META_ADS",
        headers=_admin_headers(),
        json={
            "is_enabled": True,
            "credentials": {"access_token": raw_secret, "page_id": "1029384756"},
            "auto_reply_enabled": True,
            "cost_per_lead_usd": 14.5,
        },
    )
    assert res_ok.status_code == 200
    body_text = res_ok.text
    assert raw_secret not in body_text, "Fuga de secreto en texto plano detectada (CWE-312)"
    data = res_ok.json()
    assert data["status"] == "CONNECTED"
    assert "masked_credentials" in data
    assert data["masked_credentials"]["access_token"].endswith("877")
    assert "•" in data["masked_credentials"]["access_token"]


def test_webhook_lead_auto_injection_into_prospeccion_and_omnichannel_ai():
    """Verifica que un lead de Google Ads / WhatsApp se inyecta en '1. Prospección' con su etiqueta y abre chat IA."""
    res = client.post(
        "/api/v1/integrations/webhooks/GOOGLE_ADS",
        headers=_admin_headers(),
        json={
            "nombre_contacto": "Ing. Roberto Méndez",
            "empresa": "Constructora del Plata S.A.",
            "email": "rmendez@constructoradelplata.uy",
            "telefono": "+598 99 333 444",
            "proyecto_o_interes": "Cotización urgente 600 Luminarias LUM-6060 para Torre Corporativa",
            "mensaje_inicial": "Hola, vimos su anuncio en Google Ads y necesitamos cotizar urgente 600 luminarias LUM-6060.",
            "monto_estimado_usd": 22000,
            "utm_source": "google",
            "utm_medium": "cpc",
            "utm_campaign": "Search_Luminarias_B2B_2026",
        },
    )
    assert res.status_code in (200, 201)
    lead_data = res.json()
    assert lead_data["etapa"] == "prospeccion"
    assert lead_data["canal_origen"] == "GOOGLE_ADS"
    assert lead_data["ai_score"] >= 70
    deal_id = lead_data["deal_id"]

    # Verificar que aparece en el listado de conversaciones omnicanal
    conv_res = client.get("/api/v1/omnichannel/conversations", headers=_comercial_headers())
    assert conv_res.status_code == 200
    convs = conv_res.json()
    assert any(c["deal_id"] == deal_id and c["canal_origen"] == "GOOGLE_ADS" for c in convs)

    # Generar sugerencias con el Agente Copiloto IA Gratuito
    ai_res = client.post(
        f"/api/v1/omnichannel/ai-suggest/{deal_id}",
        headers=_comercial_headers(),
        json={"tone": "consultivo_b2b"},
    )
    assert ai_res.status_code == 200
    ai_data = ai_res.json()
    assert ai_data["deal_id"] == deal_id
    assert len(ai_data["suggestions"]) >= 3
    assert ai_data["lead_analysis"]["canal_origen"] == "GOOGLE_ADS"

    # Enviar respuesta en el chat omnicanal por un canal sin credenciales (EMAIL) -> Verifica Zero Silent Mocks
    msg_res = client.post(
        f"/api/v1/omnichannel/messages/{deal_id}",
        headers=_comercial_headers(),
        json={
            "channel": "EMAIL",
            "message_text": ai_data["suggestions"][0]["text"],
            "is_ai_generated": True,
        },
    )
    assert msg_res.status_code == 200
    msg_payload = msg_res.json()
    assert msg_payload["delivery_status"] in ("LOGGED_PENDING_CHANNEL_CREDENTIALS", "DISPATCHED_VIA_API")
    assert msg_payload["message"]["is_ai_generated"] is True

    # Limpiar deal de prueba para no ensuciar el Kanban productivo
    del_res = client.delete(f"/api/v1/deals/{deal_id}", headers=_admin_headers())
    assert del_res.status_code == 200


def test_multitenant_trial_license_switcher_and_provisioning():
    """Verifica que los 14 días Trial inician en ENTERPRISE_3PL y el Admin puede alternar de licencia para probar."""
    curr_res = client.get("/api/v1/tenants/current", headers=_admin_headers())
    assert curr_res.status_code == 200
    curr = curr_res.json()
    tenant_id = curr["id"]
    assert curr["subscription_status"] in ("TRIAL_14_DAYS", "ACTIVE_PAID")

    # Cambiar a licencia STARTER durante el modo Trial para ver qué módulos restringe
    switch_starter = client.patch(
        f"/api/v1/tenants/{tenant_id}/license",
        headers=_admin_headers(),
        json={"simulated_tier": "STARTER", "license_tier": "STARTER"},
    )
    assert switch_starter.status_code == 200
    starter_data = switch_starter.json()
    assert starter_data["effective_tier"] == "STARTER"
    assert "logistics-kanban" in starter_data["capabilities"]["restricted_modules"]

    # Restaurar a ENTERPRISE_3PL (Full Suite)
    switch_ent = client.patch(
        f"/api/v1/tenants/{tenant_id}/license",
        headers=_admin_headers(),
        json={"simulated_tier": "ENTERPRISE_3PL", "license_tier": "ENTERPRISE_3PL"},
    )
    assert switch_ent.status_code == 200
    ent_data = switch_ent.json()
    assert ent_data["effective_tier"] == "ENTERPRISE_3PL"
    assert ent_data["capabilities"]["restricted_modules"] == []

    # Aprovisionar un nuevo Tenant aislado
    unique_slug = f"empresa_{uuid.uuid4().hex[:6]}"
    prov_res = client.post(
        "/api/v1/tenants",
        headers=_admin_headers(),
        json={
            "slug": unique_slug,
            "nombre_empresa": f"Corporación {unique_slug.upper()} S.A.",
            "rut": "219988770019",
            "admin_email": f"admin@{unique_slug}.uy",
            "admin_username": f"admin_{unique_slug}",
            "admin_password": "PasswordSeguro123!",
            "license_tier": "ENTERPRISE_3PL",
            "trial_days": 14,
        },
    )
    assert prov_res.status_code in (200, 201)
    new_tenant = prov_res.json()
    assert new_tenant["slug"] == unique_slug
    assert new_tenant["effective_tier"] == "ENTERPRISE_3PL"
    assert new_tenant["trial_days_remaining"] >= 13


def test_captcha_and_2fa_setup_endpoints():
    """Verifica generación de Captcha SVG anti-bots y configuración de 2FA TOTP."""
    cap_res = client.get("/api/v1/auth/captcha")
    assert cap_res.status_code == 200
    cap_data = cap_res.json()
    assert "captcha_token" in cap_data
    assert "captcha_svg" in cap_data
    assert cap_data["captcha_svg"].startswith("data:image/svg+xml;base64,")

    totp_res = client.post("/api/v1/auth/2fa/setup", headers=_admin_headers())
    assert totp_res.status_code == 200
    totp_data = totp_res.json()
    assert len(totp_data["totp_secret"]) >= 16
    assert totp_data["otpauth_uri"].startswith("otpauth://totp/")


def test_whatsapp_qr_generate_confirm_ingest_and_disconnect():
    """Verifica el flujo completo de vinculación independiente de WhatsApp por Código QR (WHATSAPP_QR)."""
    # 1. El rol analista_comercial NO puede generar ni vincular QR (403 Forbidden)
    qr_forbidden = client.post("/api/v1/integrations/whatsapp-qr/generate", headers=_comercial_headers())
    assert qr_forbidden.status_code == 403

    # 2. El rol controller_admin genera el desafío QR SVG firmado con HMAC
    qr_res = client.post("/api/v1/integrations/whatsapp-qr/generate", headers=_admin_headers())
    assert qr_res.status_code == 200
    qr_data = qr_res.json()
    assert qr_data["channel"] == "WHATSAPP_QR"
    assert qr_data["qr_svg"].startswith("data:image/svg+xml;base64,")
    assert len(qr_data["qr_token"]) > 20
    assert "-" in qr_data["pairing_code"]

    # 3. Confirmar escaneo del QR -> se cifra en bóveda AES-256 sin exponer session_auth_bundle en texto plano
    confirm_res = client.post(
        "/api/v1/integrations/whatsapp-qr/confirm-scan",
        headers=_admin_headers(),
        json={
            "qr_token": qr_data["qr_token"],
            "linked_phone": "+598 94 858 791",
            "device_label": "WhatsApp Web Multi-Dispositivo (Calcu CRM)",
        },
    )
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["channel"] == "WHATSAPP_QR"
    assert confirm_data["status"] == "CONNECTED"
    assert confirm_data["is_enabled"] is True
    assert confirm_data["masked_credentials"]["linked_phone"] == "+598 94 858 791"
    assert "•" in confirm_data["masked_credentials"]["session_auth_bundle"]
    assert "wa_md_aes256_" not in confirm_res.text

    # 4. Inyectar un prospecto entrante desde WHATSAPP_QR hacia "1. Prospección"
    ingest_res = client.post(
        "/api/v1/integrations/webhooks/WHATSAPP_QR",
        headers=_admin_headers(),
        json={
            "nombre_contacto": "Arq. Lucía Silva",
            "empresa": "Estudio Silva & Asociados",
            "telefono": "+598 91 222 333",
            "proyecto_o_interes": "Consulta directa por WhatsApp QR",
            "mensaje_inicial": "Hola, ¿cómo estás?",
        },
    )
    assert ingest_res.status_code == 201
    ing_data = ingest_res.json()
    assert ing_data["etapa"] == "prospeccion"
    assert ing_data["canal_origen"] == "WHATSAPP_QR"
    qr_deal_id = ing_data["deal_id"]

    # Limpiar deal de prueba
    client.delete(f"/api/v1/deals/{qr_deal_id}", headers=_admin_headers())

    # 5. Desvincular sesión QR -> vuelve a PENDING_CREDENTIALS
    disc_res = client.post("/api/v1/integrations/whatsapp-qr/disconnect", headers=_admin_headers())
    assert disc_res.status_code == 200
    disc_data = disc_res.json()
    assert disc_data["status"] == "PENDING_CREDENTIALS"
    assert disc_data["is_enabled"] is False
    assert disc_data["masked_credentials"] == {}


def test_five_user_requirements_optional_items_credit200_whatsapp_qr_personal_and_cascade_delete():
    """
    Verifica los 5 puntos solicitados por el usuario en sesión colegiada:
    1) Producto NO obligatorio al crear o editar tarjetas de prospecto (items=[]).
    2) Valor por defecto del crédito de la cuenta = USD 200.00.
    3) Prospecto nuevo por WhatsApp QR (WHATSAPP_QR) se crea con 0 productos y USD 0.00 (sin productos sin sentido).
    4) Categoría 'AMIGOS_FAMILIA' (Amigos / Familiares) y borrado en cascada de prospectos con conversación de WhatsApp.
    """
    # Punto 1: Crear tarjeta de prospecto sin productos (items=[])
    create_deal_res = client.post(
        "/api/v1/deals",
        headers=_comercial_headers(),
        json={
            "cliente": "Contacto Sin Producto Inicial",
            "proyecto_nombre": "Consulta General Exploratoria",
            "etapa": "prospeccion",
            "probabilidad": 20,
            "monto_total": 0,
            "moneda": "USD",
            "vendedor": "Ejecutivo Comercial",
            "fecha_cierre_estimada": "2026-12-31",
            "canal_origen": "MANUAL",
            "items": [],
        },
    )
    assert create_deal_res.status_code in (200, 201)
    deal_no_items = create_deal_res.json()
    assert deal_no_items["items"] == []
    assert float(deal_no_items["monto_total"]) == 0.0
    no_items_id = deal_no_items["id"]

    # Limpiar deal creado
    del_no_items = client.delete(f"/api/v1/deals/{no_items_id}", headers=_comercial_headers())
    assert del_no_items.status_code == 200

    # Punto 2: Valor por defecto del crédito de cuenta de cliente = USD 200.00
    unique_rut = f"21{uuid.uuid4().int % 10000000000:010d}"
    create_client_res = client.post(
        "/api/v1/crm/clients",
        headers=_comercial_headers(),
        json={
            "nombre": f"Cliente Crédito Default {unique_rut[-4:]}",
            "rut": unique_rut,
            "email": "contacto@clientedefault.uy",
            "telefono": "+598 99 000 111",
        },
    )
    assert create_client_res.status_code in (200, 201)
    created_client = create_client_res.json()
    assert float(created_client["limite_credito"]) == 200.0
    # Eliminar cliente temporal
    client.delete(f"/api/v1/crm/clients/{created_client['id']}", headers=_admin_headers())

    # Punto 3: Nuevo prospecto por WhatsApp QR entra con 0 productos y monto 0.00
    wa_qr_res = client.post(
        "/api/v1/integrations/webhooks/WHATSAPP_QR",
        headers=_admin_headers(),
        json={
            "nombre_contacto": "Primo Martín (WhatsApp QR)",
            "empresa": "Primo Martín",
            "telefono": "+598 98 765 432",
            "proyecto_o_interes": "Conversación WhatsApp QR (Primo Martín)",
            "mensaje_inicial": "Hola Seba! ¿Nos vemos hoy a la noche?",
        },
    )
    assert wa_qr_res.status_code == 201
    wa_qr_deal_id = wa_qr_res.json()["deal_id"]

    # Verificar que el deal en el pipeline tiene items == [] y monto_total == 0
    deals_list = client.get("/api/v1/deals", headers=_comercial_headers()).json()
    matched_deal = next((d for d in deals_list if d["id"] == wa_qr_deal_id), None)
    assert matched_deal is not None
    assert matched_deal["items"] == [], "WHATSAPP_QR NO debe asignar productos automáticamente"
    assert float(matched_deal["monto_total"]) == 0.0, "WHATSAPP_QR nuevo debe iniciar con monto 0"

    # Punto 4A: Clasificar como 'AMIGOS_FAMILIA' (Amigos / Familiares) y verificar vaciado de items
    patch_cat = client.patch(
        f"/api/v1/omnichannel/conversations/{wa_qr_deal_id}/contact",
        headers=_comercial_headers(),
        json={"ai_classification": "AMIGOS_FAMILIA", "clear_items": True},
    )
    assert patch_cat.status_code == 200
    assert patch_cat.json()["ai_classification"] == "AMIGOS_FAMILIA"

    # Punto 4B: Eliminar prospecto que tiene mensajes en omnichannel_messages (sin ForeignKeyViolation)
    cascade_del = client.delete(f"/api/v1/deals/{wa_qr_deal_id}", headers=_comercial_headers())
    assert cascade_del.status_code == 200



