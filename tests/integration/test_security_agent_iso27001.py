import pytest
import os
import json
from starlette.testclient import TestClient
from app.main import app
from app.services.security_agent import security_agent, AUTHORIZED_APP_PORTS

client = TestClient(app)

def test_security_agent_perimeter_audit_direct():
    """Verifica que el agente local de ciberseguridad ejecute la auditoría perimetral conforme a ISO 27001."""
    result = security_agent.run_perimeter_audit()
    assert "status" in result
    assert "detected_ports" in result["iso_baseline"] or "authorized_whitelist" in result["iso_baseline"]
    assert 8000 in result["iso_baseline"]["authorized_whitelist"]
    assert 5173 in result["iso_baseline"]["authorized_whitelist"]
    assert "timestamp" in result

def test_security_agent_audit_log_persistence():
    """Verifica que los eventos de auditoría se persistan en el archivo de log inmutable JSONL."""
    security_agent.run_perimeter_audit()
    log_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs", "security_audit.jsonl")
    assert os.path.exists(log_file)
    with open(log_file, "r", encoding="utf-8") as f:
        lines = f.readlines()
        assert len(lines) > 0
        last_entry = json.loads(lines[-1])
        assert "timestamp" in last_entry
        assert "iso_controls" in last_entry
        assert "A.8.21" in last_entry["iso_controls"]

def test_api_security_status_endpoint():
    """Verifica el endpoint REST /api/v1/security/status."""
    res = client.get("/api/v1/security/status")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "all_detected_ports" in data
    assert "iso_baseline" in data

def test_api_security_scan_endpoint():
    """Verifica el endpoint REST /api/v1/security/scan."""
    res = client.post("/api/v1/security/scan")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert "timestamp" in data

def test_api_security_alerts_endpoint():
    """Verifica el endpoint REST /api/v1/security/alerts."""
    res = client.get("/api/v1/security/alerts")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_api_tailscale_p2p_endpoint():
    """Verifica el endpoint REST /api/v1/security/tailscale-p2p."""
    res = client.get("/api/v1/security/tailscale-p2p")
    assert res.status_code == 200
    data = res.json()
    assert "available" in data
    assert "recommendations" in data
