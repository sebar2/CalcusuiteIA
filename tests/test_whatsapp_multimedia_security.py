import os
import io
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.multitenant_entities import OmnichannelMessage, IntegrationConfig
from app.models.entities import CommercialDeal

from app.core.security import create_access_token, ROLE_CONTROLLER_ADMIN

client = TestClient(app)

def get_auth_token():
    return create_access_token({
        "sub": "test_admin",
        "role": ROLE_CONTROLLER_ADMIN,
        "tenant_id": "tenant_calcu_corp"
    })

def test_whatsapp_qr_supervisor_and_status():
    """Verifica que el supervisor del puente Baileys esté activo y devuelva estado."""
    from app.services.whatsapp_bridge_supervisor import whatsapp_bridge_supervisor
    status = whatsapp_bridge_supervisor.ensure_bridge_running(wait_seconds=2.0)
    assert status is not None
    assert "bridge_online" in status

    token = get_auth_token()
    # Probar endpoint de generación de QR
    resp = client.post("/api/v1/integrations/whatsapp-qr/generate", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "qr_token" in resp.json()

def test_media_upload_security_validation():
    """Auditoría de Ciberseguridad ISO 27001 para subida de medios (Prevención CWE-434 RCE)."""
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Inyección de script / archivo ejecutable disfrazado de imagen o video
    fake_exe = io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00<?php phpinfo(); ?>")
    resp_vuln = client.post(
        "/api/v1/omnichannel/upload-media",
        files={"file": ("malware.php", fake_exe, "application/x-php")},
        headers=headers,
    )
    assert resp_vuln.status_code == 415

    # 2. Prueba de archivo legítimo JPEG por Magic Bytes (\xff\xd8\xff)
    valid_jpeg = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb")
    resp_jpg = client.post(
        "/api/v1/omnichannel/upload-media",
        files={"file": ("foto.jpg", valid_jpeg, "image/jpeg")},
        headers=headers,
    )
    assert resp_jpg.status_code == 200
    assert resp_jpg.json()["media_type"] == "IMAGE"

    # 3. Prueba de video legítimo MP4 por Magic Bytes ISO BMFF (ftyp)
    valid_mp4 = io.BytesIO(b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2mp41\x00\x00\x00\x08free")
    resp_mp4 = client.post(
        "/api/v1/omnichannel/upload-media",
        files={"file": ("video_demo.mp4", valid_mp4, "video/mp4")},
        headers=headers,
    )
    assert resp_mp4.status_code == 200
    assert resp_mp4.json()["media_type"] == "VIDEO"
    assert resp_mp4.json()["media_url"].endswith(".mp4")

    # 4. Prueba de video legítimo WebM por Magic Bytes EBML (\x1a\x45\xdf\xa3)
    valid_webm = io.BytesIO(b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01\x42\xf2\x81\x04")
    resp_webm = client.post(
        "/api/v1/omnichannel/upload-media",
        files={"file": ("video_demo.webm", valid_webm, "video/webm")},
        headers=headers,
    )
    assert resp_webm.status_code == 200
    assert resp_webm.json()["media_type"] == "VIDEO"
    assert resp_webm.json()["media_url"].endswith(".webm")

    # 5. Detección de archivo ejecutable renombrado a .mp4 (CWE-434)
    fake_mp4 = io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00")
    resp_fake_mp4 = client.post(
        "/api/v1/omnichannel/upload-media",
        files={"file": ("fake_video.mp4", fake_mp4, "application/octet-stream")},
        headers=headers,
    )
    assert resp_fake_mp4.status_code == 415

def test_media_size_limit_50mb():
    """Valida que archivos mayores a 50MB sean rechazados con 413 (Prevención DoS)."""
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Creamos un stream que excede 50MB
    oversized_data = b"0" * (50 * 1024 * 1024 + 1024)
    resp_oversized = client.post(
        "/api/v1/omnichannel/upload-media",
        files={"file": ("large_video.mp4", io.BytesIO(oversized_data), "video/mp4")},
        headers=headers,
    )
    assert resp_oversized.status_code == 413

def test_omnichannel_message_media_storage():
    """Verifica que la base de datos guarde y recupere media_url y media_type (AUDIO y VIDEO) sin errores."""
    db = SessionLocal()
    try:
        # Asegurar deal de prueba
        test_deal = db.query(CommercialDeal).first()
        if not test_deal:
            test_deal = CommercialDeal(
                id="deal-test-media-99",
                proyecto_nombre="Test Media Deal",
                cliente="Cliente Test",
                vendedor="Martín Gómez",
                etapa="prospeccion",
                canal_origen="WHATSAPP_QR",
                phone="+598 94 858 791",
            )
            db.add(test_deal)
            db.commit()

        # 1. Crear mensaje con audio adjunto en metadata_json
        msg_audio = OmnichannelMessage(
            tenant_id="tenant_calcu_corp",
            deal_id=test_deal.id,
            channel="WHATSAPP_QR",
            direction="INBOUND",
            sender_name="Cliente Test",
            message_text="🎙️ Nota de voz de prueba",
            delivery_status="RECEIVED",
            metadata_json={
                "media_url": "/static/uploads/omnichannel_media/test_audio.ogg",
                "media_type": "AUDIO",
                "duration_seconds": 15,
            },
        )
        db.add(msg_audio)

        # 2. Crear mensaje con video adjunto en metadata_json
        msg_video = OmnichannelMessage(
            tenant_id="tenant_calcu_corp",
            deal_id=test_deal.id,
            channel="WHATSAPP_QR",
            direction="INBOUND",
            sender_name="Cliente Test",
            message_text="🎥 Video explicativo del producto",
            delivery_status="RECEIVED",
            metadata_json={
                "media_url": "/static/uploads/omnichannel_media/test_video.mp4",
                "media_type": "VIDEO",
                "duration_seconds": 45,
            },
        )
        db.add(msg_video)
        db.commit()

        db.refresh(msg_audio)
        db.refresh(msg_video)

        assert msg_audio.id is not None
        assert msg_audio.metadata_json["media_type"] == "AUDIO"

        assert msg_video.id is not None
        assert msg_video.metadata_json["media_type"] == "VIDEO"
        assert msg_video.metadata_json["media_url"] == "/static/uploads/omnichannel_media/test_video.mp4"
    finally:
        db.close()

def test_media_upload_opus_audio():
    """Valida que los audios .opus (Ogg Opus) se reconozcan y guarden correctamente para WhatsApp PTT."""
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Archivo .opus nativo con firma OggS y OpusHead
    valid_opus = io.BytesIO(b"OggS\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00OpusHead\x01\x02\x00\x00\x80\xbb")
    resp_opus = client.post(
        "/api/v1/omnichannel/upload-media",
        files={"file": ("nota_voz_456.opus", valid_opus, "audio/ogg; codecs=opus")},
        headers=headers,
    )
    assert resp_opus.status_code == 200
    data = resp_opus.json()
    assert data["media_type"] == "AUDIO"
    assert data["media_url"].endswith(".opus")

    # 2. Archivo .opus grabado en navegador con contenedor EBML
    valid_ebml_opus = io.BytesIO(b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01")
    resp_ebml_opus = client.post(
        "/api/v1/omnichannel/upload-media",
        files={"file": ("nota_voz_browser.opus", valid_ebml_opus, "audio/webm; codecs=opus")},
        headers=headers,
    )
    assert resp_ebml_opus.status_code == 200
    assert resp_ebml_opus.json()["media_type"] == "AUDIO"
    assert resp_ebml_opus.json()["media_url"].endswith(".opus")

def test_meli_custom_shipping_payload_validation():
    """Verifica que el schema de publicación de MeLi valide y acepte costos de envío personalizados."""
    from app.api.v1.integrations import MeliPublishItemRequest
    from decimal import Decimal

    # Payload válido con costos personalizados
    req = MeliPublishItemRequest(
        title="Escritorio Ergonómico Calcu Office",
        category_id="MLU1055",
        price=Decimal("4500.00"),
        available_quantity=5,
        shipping_mode="custom",
        shipping_costs=[
            {"description": "Montevideo / Área Metropolitana", "cost": 180.0},
            {"description": "Interior del País", "cost": 250.0},
        ],
        local_pick_up=True,
    )
    assert req.shipping_mode == "custom"
    assert len(req.shipping_costs) == 2
    assert req.shipping_costs[0]["cost"] == 180.0

def test_security_rbac_and_sqli_defense():
    """Auditoría de Ciberseguridad: Prevención de Inyecciones SQL (CWE-89) y Control de Acceso RBAC."""
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Intento de Inyección SQL en parámetros de consulta
    sqli_payloads = [
        "' OR '1'='1",
        "'; DROP TABLE omnichannel_messages; --",
        "admin'--",
    ]
    for sqli in sqli_payloads:
        resp = client.get(
            f"/api/v1/omnichannel/conversations?search={sqli}",
            headers=headers
        )
        # La consulta ORM debe responder exitosamente (200 o lista vacía) sin filtrar datos no autorizados ni lanzar 500
        assert resp.status_code == 200

    # 2. Verificación de Roles RBAC: un rol no autorizado debe ser rechazado
    from app.core.security import create_access_token
    unauthorized_token = create_access_token({
        "sub": "chofer_invalido",
        "role": "conductor_3pl",
        "tenant_id": "tenant_calcu_corp"
    })
    resp_forbidden = client.post(
        "/api/v1/integrations/meli/items",
        json={"title": "Test Hack", "category_id": "MLU1055", "price": 100},
        headers={"Authorization": f"Bearer {unauthorized_token}"}
    )
    assert resp_forbidden.status_code in (401, 403)

if __name__ == "__main__":
    pytest.main(["-v", "test_whatsapp_multimedia_security.py"])
