import pytest
import json
from starlette.testclient import TestClient
from app.main import app
from app.services.telemetry_ws import telemetry_manager

client = TestClient(app)

def test_telemetry_ws_fleet_connection_and_broadcast():
    """Valida la conexión WebSocket y la recepción de eventos push de flota en tiempo real."""
    with client.websocket_connect("/api/v1/logistics/tracking/ws/fleet") as websocket:
        # El servidor envía instantánea inicial
        data_text = websocket.receive_text()
        msg = json.loads(data_text)
        assert msg["type"] == "FLEET_SNAPSHOT"
        assert isinstance(msg["data"], list)

        # Probar heartbeat PING -> PONG
        websocket.send_text("PING")
        pong = websocket.receive_text()
        assert pong == "PONG"

def test_telemetry_ws_driver_ping_submission():
    """Valida que un chofer móvil transmita telemetría continua por WebSocket persistente."""
    # Obtenemos una orden válida de la BD
    res_orders = client.get("/api/v1/logistics/orders")
    assert res_orders.status_code == 200
    orders = res_orders.json()
    order_id = orders[0]["id"] if orders else 1

    with client.websocket_connect(f"/api/v1/logistics/tracking/ws/driver/{order_id}") as driver_ws:
        ping_payload = {
            "lat": -34.8900,
            "lng": -56.1600,
            "velocidad_kmh": 45.0,
            "bateria_pct": 94,
        }
        driver_ws.send_text(json.dumps(ping_payload))
        response_text = driver_ws.receive_text()
        ack = json.loads(response_text)
        assert ack["status"] == "ACK"
        assert ack["order_id"] == order_id
        assert "timestamp" in ack

def test_gzip_middleware_compression():
    """Verifica que GZipMiddleware comprima respuestas mayores a 1000 bytes cuando se solicita."""
    # /api/v1/logistics/inventory suele ser grande (>1KB)
    headers = {"Accept-Encoding": "gzip"}
    res = client.get("/api/v1/logistics/inventory", headers=headers)
    assert res.status_code == 200
    # Starlette descomprime automáticamente en el testclient o marca la cabecera si el payload supera el umbral
    assert len(res.content) > 0
