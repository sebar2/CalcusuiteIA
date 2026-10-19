import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_leads_endpoint_creation_and_listing():
    payload = {
        "nombre": "Test Contact",
        "empresa": "Test Logistics SRL",
        "email": "test@logistics.com",
        "telefono": "+59899123456",
        "interes": "Logística 3PL & WMS Móvil",
        "mensaje": "Prueba unitaria automatizada del formulario de leads"
    }
    response = client.post("/api/v1/leads", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert "lead_id" in data
    assert data["direct_contact"]["whatsapp"] == "+59894858791"

    # Verificar que el lead puede ser consultado en el endpoint GET /leads
    get_res = client.get("/api/v1/leads?limit=10")
    assert get_res.status_code == 200
    leads = get_res.json()
    assert any(l["email"] == "test@logistics.com" for l in leads)

def test_leads_honeypot_blocking():
    payload = {
        "nombre": "Bot Spammer",
        "empresa": "Spam Corp",
        "email": "spam@spam.com",
        "telefono": "+123456789",
        "honeypot": "I am a bot"
    }
    response = client.post("/api/v1/leads", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert data["lead_id"] == 0
