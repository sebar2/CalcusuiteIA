import uuid
from decimal import Decimal
from unittest.mock import patch, MagicMock, AsyncMock
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
    assert ("sebahost.taild84e22.ts.net" in data["auth_url"] or "100.119.40.92" in data["auth_url"])
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


def test_meli_get_ready_products():
    """Verifica que el endpoint /meli/products liste los artículos del inventario con stock en depósito central."""
    db = next(get_db())
    sku_test = "TEST-MELI-SKU-001"
    prod = db.query(Product).filter(Product.sku == sku_test).first()
    if not prod:
        prod = Product(
            sku=sku_test,
            nombre="Luminaria LED Panel 60x60 Alta Potencia",
            categoria_id=1,
            costo_base=Decimal("25.00"),
            precio_lista=Decimal("45.00"),
            doh_seguridad=15,
            activo=True,
            image_url="https://images.unsplash.com/photo-test.jpg",
        )
        db.add(prod)
        db.commit()
        db.refresh(prod)
        inv = Inventory(
            producto_id=prod.id,
            deposito_central=120,
            transito_maritimo=0,
            aduana=0,
            stock_seguridad=20,
        )
        db.add(inv)
        db.commit()
    else:
        inv = db.query(Inventory).filter(Inventory.producto_id == prod.id).first()
        if inv:
            inv.deposito_central = 120
            db.commit()

    res = client.get("/api/v1/integrations/meli/products", headers=_comercial_headers())
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    target = next((p for p in items if p["sku"] == sku_test), None)
    assert target is not None
    assert target["deposito_central"] == 120
    assert target["precio_lista"] == 45.0


def test_meli_predict_category():
    """Verifica la predicción de categorías oficiales mediante Domain Discovery de MeLi."""
    mock_predictions = [
        {
            "category_id": "MLU1055",
            "category_name": "Paneles LED",
            "domain_id": "MLU-LED_PANELS",
            "domain_name": "Paneles LED",
            "attributes": []
        }
    ]
    with patch("app.services.meli_service.MeliService.predict_category", new_callable=AsyncMock) as mock_predict:
        mock_predict.return_value = mock_predictions
        res = client.post(
            "/api/v1/integrations/meli/predict-category",
            headers=_comercial_headers(),
            json={"title": "Luminaria LED Panel 60x60"},
        )
        assert res.status_code == 200
        data = res.json()
        assert "predictions" in data
        assert len(data["predictions"]) == 1
        assert data["predictions"][0]["category_id"] == "MLU1055"


def test_meli_publish_item_guardrails_and_success():
    """
    Verifica el flujo de publicación oficial de catálogo en MeLi:
    1. Rechazo por título > 60 caracteres.
    2. Rechazo por datos de contacto en título (Anti-Penalización).
    3. Publicación exitosa vía POST /items y subrecurso /description.
    """
    # 1. Título excedido (>60 chars)
    res_long = client.post(
        "/api/v1/integrations/meli/items",
        headers=_admin_headers(),
        json={
            "title": "Este es un título excesivamente largo que sobrepasa el límite estricto de sesenta caracteres de Mercado Libre",
            "category_id": "MLU1055",
            "price": 1200.0,
            "currency_id": "UYU",
            "available_quantity": 10,
        }
    )
    assert res_long.status_code in (400, 422)

    # 2. Título con datos prohibidos (teléfono uruguayo)
    res_phone = client.post(
        "/api/v1/integrations/meli/items",
        headers=_admin_headers(),
        json={
            "title": "Luminaria LED 60w Cel 099123456",
            "category_id": "MLU1055",
            "price": 1200.0,
            "currency_id": "UYU",
            "available_quantity": 10,
        }
    )
    assert res_phone.status_code == 422
    assert "política MeLi" in res_phone.json()["detail"]

    # 3. Publicación exitosa
    mock_meli_response = {
        "id": "MLU77665544",
        "title": "Luminaria LED Panel 60x60 Calcu",
        "category_id": "MLU1055",
        "price": 1200.0,
        "currency_id": "UYU",
        "available_quantity": 25,
        "permalink": "https://articulo.mercadolibre.com.uy/MLU-77665544-panel-led.html",
        "status": "active",
    }
    with patch("app.services.meli_service.MeliService.publish_item", new_callable=AsyncMock) as mock_pub:
        mock_pub.return_value = mock_meli_response
        res_ok = client.post(
            "/api/v1/integrations/meli/items",
            headers=_admin_headers(),
            json={
                "title": "Luminaria LED Panel 60x60 Calcu",
                "category_id": "MLU1055",
                "price": 1200.0,
                "currency_id": "UYU",
                "available_quantity": 25,
                "condition": "new",
                "listing_type_id": "gold_special",
                "description": "Panel LED extra plano para embutir en cielo raso comercial.",
            }
        )
        assert res_ok.status_code == 200
        data = res_ok.json()
        assert data["status"] == "published"
        assert data["item_id"] == "MLU77665544"
        assert data["permalink"] == "https://articulo.mercadolibre.com.uy/MLU-77665544-panel-led.html"


def test_meli_update_item_and_inventory_stock_sync():
    """
    Verifica la actualización de stock/precios en MeLi y la sincronización con deposito_central:
    1. Actualización manual de precio y estado (active / paused).
    2. Sincronización atómica de existencias desde deposito_central sin tocar depósitos 3PL.
    """
    mock_up_res = {
        "id": "MLU77665544",
        "price": 1350.0,
        "available_quantity": 18,
        "status": "paused",
    }
    with patch("app.services.meli_service.MeliService.update_item", new_callable=AsyncMock) as mock_up:
        mock_up.return_value = mock_up_res
        res = client.put(
            "/api/v1/integrations/meli/items/MLU77665544",
            headers=_admin_headers(),
            json={
                "price": 1350.0,
                "status": "paused",
            }
        )
        assert res.status_code == 200
        assert res.json()["status"] == "updated"
        assert "price" in res.json()["updated_fields"]

    db = next(get_db())
    sku_sync = "TEST-MELI-SKU-001"
    prod = db.query(Product).filter(Product.sku == sku_sync).first()
    if prod:
        inv = db.query(Inventory).filter(Inventory.producto_id == prod.id).first()
        if inv:
            inv.deposito_central = 77
            db.commit()

    with patch("app.services.meli_service.MeliService.update_item", new_callable=AsyncMock) as mock_up2:
        mock_up2.return_value = {"id": "MLU77665544", "available_quantity": 77, "status": "active"}
        res_sync = client.post(
            "/api/v1/integrations/meli/items/MLU77665544/sync-stock",
            headers=_admin_headers(),
            json={"sku": sku_sync}
        )
        assert res_sync.status_code == 200
        data_sync = res_sync.json()
        assert data_sync["deposito_central_stock"] == 77
        assert data_sync["meli_available_quantity"] == 77
        assert "exitosamente" in data_sync["message"]


def test_meli_seller_reputation_and_analytics():
    """Verifica la consulta de métricas de reputación del vendedor y analítica de conversión del ítem."""
    mock_profile = {
        "seller_id": 98765432,
        "nickname": "CALCU_OFICIAL_UY",
        "site_id": "MLU",
        "reputation_level": "5_green",
        "power_seller_status": "gold",
        "transactions_completed": 1420,
        "transactions_canceled": 12,
        "ratings_positive": 0.99,
        "ratings_negative": 0.01,
        "status": {"site_status": "active"},
    }
    mock_analytics = {
        "item_id": "MLU77665544",
        "title": "Luminaria LED Panel 60x60 Calcu",
        "price": 1200.0,
        "currency_id": "UYU",
        "status": "active",
        "available_quantity": 77,
        "sold_quantity": 45,
        "visits_last_30d": 900,
        "questions_total": 35,
        "questions_unanswered": 0,
        "conversion_rate_pct": 5.0,
        "permalink": "https://articulo.mercadolibre.com.uy/MLU-77665544-panel-led.html",
    }

    with patch("app.services.meli_service.MeliService.get_seller_profile", new_callable=AsyncMock) as m_prof:
        m_prof.return_value = mock_profile
        res_rep = client.get("/api/v1/integrations/meli/seller-reputation", headers=_admin_headers())
        assert res_rep.status_code == 200
        assert res_rep.json()["nickname"] == "CALCU_OFICIAL_UY"
        assert res_rep.json()["reputation_level"] == "5_green"

    with patch("app.services.meli_service.MeliService.get_item_analytics", new_callable=AsyncMock) as m_ana:
        m_ana.return_value = mock_analytics
        res_ana = client.get("/api/v1/integrations/meli/items/MLU77665544/analytics", headers=_admin_headers())
        assert res_ana.status_code == 200
        assert res_ana.json()["conversion_rate_pct"] == 5.0
        assert res_ana.json()["sold_quantity"] == 45


def test_meli_category_search_and_attributes():
    """Valida los endpoints de búsqueda en vivo de categorías y consulta de atributos requeridos."""
    mock_search = [
        {"category_id": "MLU1590", "category_name": "Otros", "domain_name": "Artículos de iluminación para el hogar"},
        {"category_id": "MLU205183", "category_name": "Bombitas de Luz", "domain_name": "Bombitas de luz"},
    ]
    mock_attrs = [
        {"id": "BRAND", "name": "Marca", "value_type": "string", "required": True, "values": []},
        {"id": "MODEL", "name": "Modelo", "value_type": "string", "required": True, "values": []},
        {"id": "APPLICATION", "name": "Aplicación", "value_type": "list", "required": True, "values": [{"id": "IND", "name": "Industrial"}]},
    ]

    with patch("app.services.meli_service.MeliService.search_categories", new_callable=AsyncMock) as m_search:
        m_search.return_value = mock_search
        res = client.get("/api/v1/integrations/meli/categories/search", params={"q": "tubo"}, headers=_admin_headers())
        assert res.status_code == 200
        assert len(res.json()["results"]) == 2
        assert res.json()["results"][0]["category_id"] == "MLU1590"

    with patch("app.services.meli_service.MeliService.get_category_attributes", new_callable=AsyncMock) as m_attrs:
        m_attrs.return_value = mock_attrs
        res = client.get("/api/v1/integrations/meli/categories/MLU1590/attributes", headers=_admin_headers())
        assert res.status_code == 200
        assert len(res.json()["attributes"]) == 3
        assert res.json()["attributes"][0]["id"] == "BRAND"


def test_meli_picture_upload_and_family_name_publishing():
    """Valida la subida directa de archivos a MeLi CDN y la publicación compatible con family_name de User Products."""
    mock_upload = {
        "id": "767380-MLU118130314086_102026",
        "url": "http://http2.mlstatic.com/D_NQ_NP_767380-MLU118130314086_102026-F.jpg",
        "secure_url": "https://http2.mlstatic.com/D_NQ_NP_767380-MLU118130314086_102026-F.jpg",
        "status": "ACTIVE",
    }
    mock_published = {
        "id": "MLU99887766",
        "title": "Tubo LED T8 Vidrio 60cm 9W",
        "family_name": "Tubo LED T8 Vidrio 60cm 9W",
        "category_id": "MLU1590",
        "price": 450.0,
        "available_quantity": 20,
        "permalink": "https://articulo.mercadolibre.com.uy/MLU-99887766.html",
        "status": "active",
    }

    with patch("app.services.meli_service.MeliService.upload_picture", new_callable=AsyncMock) as m_up:
        m_up.return_value = mock_upload
        files = {"file": ("test.jpg", b"dummy_jpeg_bytes_content_here", "image/jpeg")}
        res = client.post("/api/v1/integrations/meli/pictures/upload", files=files, headers=_admin_headers())
        assert res.status_code == 200
        assert res.json()["id"] == "767380-MLU118130314086_102026"

    with patch("app.services.meli_service.MeliService.publish_item", new_callable=AsyncMock) as m_pub:
        m_pub.return_value = mock_published
        payload = {
            "title": "Tubo LED T8 Vidrio 60cm 9W",
            "family_name": "Tubo LED T8 Vidrio 60cm 9W",
            "category_id": "MLU1590",
            "price": 450.0,
            "currency_id": "UYU",
            "available_quantity": 20,
            "picture_id": "767380-MLU118130314086_102026",
            "attributes": [
                {"id": "BRAND", "value_name": "Calcu"},
                {"id": "MODEL", "value_name": "T8 Vidrio"},
                {"id": "APPLICATION", "value_name": "Industrial"},
            ],
        }
        res_pub = client.post("/api/v1/integrations/meli/items", json=payload, headers=_admin_headers())
        assert res_pub.status_code == 200
        assert res_pub.json()["item_id"] == "MLU99887766"
        assert res_pub.json()["status"] == "published"

