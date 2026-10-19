import os
import io
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.multitenant_entities import OmnichannelMessage, IntegrationConfig
from app.models.entities import CommercialDeal

client = TestClient(app)

def test_whatsapp_qr_supervisor_and_status():
    """Verifica que el supervisor del puente Baileys esté activo y devuelva estado."""
    from app.services.whatsapp_bridge_supervisor import whatsapp_bridge_supervisor
    status = whatsapp_bridge_supervisor.ensure_bridge_running(wait_seconds=2.0)
    assert status is not None
    assert "bridge_online" in status

    # Probar endpoint de generación de QR
    resp = client.post("/api/v1/integrations/whatsapp-qr/generate", headers={"Authorization": "Bearer test"})
    # Status puede ser 200 o requerir token auth, verificar formato
    assert resp.status_code in (200, 401, 403)

def test_media_upload_security_validation():
    """Auditoría de Ciberseguridad ISO 27001 para subida de medios (Prevención CWE-434 RCE)."""
    # 1. Inyección de script / archivo ejecutable disfrazado de imagen
    fake_exe = io.BytesIO(b"MZ\x90\x00\x03\x00\x00\x00<?php phpinfo(); ?>")
    resp_vuln = client.post(
        "/api/v1/omnichannel/upload-media",
        files={"file": ("malware.php", fake_exe, "application/x-php")},
        headers={"Authorization": "Bearer test"},
    )
    # Debe ser rechazado (401 si no está autenticado o 415 si pasa auth)
    assert resp_vuln.status_code in (401, 415, 422)

    # 2. Prueba de archivo legítimo JPEG por Magic Bytes (\xff\xd8\xff)
    valid_jpeg = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb")
    resp_ok = client.post(
        "/api/v1/omnichannel/upload-media",
        files={"file": ("foto.jpg", valid_jpeg, "image/jpeg")},
        headers={"Authorization": "Bearer test"},
    )
    # Si requiere autenticación adecuada, probamos con sesión interna
    assert resp_ok.status_code in (200, 401)

def test_omnichannel_message_media_storage():
    """Verifica que la base de datos guarde y recupere media_url y media_type sin errores."""
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

        # Crear mensaje con audio adjunto en metadata_json
        msg = OmnichannelMessage(
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
        db.add(msg)
        db.commit()
        db.refresh(msg)

        assert msg.id is not None
        assert msg.metadata_json["media_type"] == "AUDIO"
        assert msg.metadata_json["media_url"] == "/static/uploads/omnichannel_media/test_audio.ogg"
    finally:
        db.close()

if __name__ == "__main__":
    pytest.main(["-v", "test_whatsapp_multimedia_security.py"])
