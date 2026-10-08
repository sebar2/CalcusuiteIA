import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_ollama_status_endpoint():
    res = client.get("/api/v1/advisor/ollama-status")
    assert res.status_code == 200
    data = res.json()
    assert "online" in data
    assert "url" in data
    assert "models" in data
    assert "target_model" in data


def test_initiative_benchmark_heuristic_mode():
    payload = {
        "product_name": "Teclado Mecánico RGB Pro",
        "category": "Electrónica",
        "proposed_price": 120.0,
        "proposed_cost": 55.0,
        "expected_demand": 300,
        "initial_investment": 15000.0,
        "search_query": "teclado mecanico rgb precio",
        "engine_mode": "heuristic"
    }
    res = client.post(
        "/api/v1/initiatives/ai-benchmark",
        json=payload,
        headers={"X-User-Role": "controller_admin", "X-User-Id": "controller_test"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["product_name"] == "Teclado Mecánico RGB Pro"
    assert data["provider"] == "deterministic_heuristic"
    assert float(data["proposed_margin_pct"]) > 0
    assert "internal_db" in data
    assert "market_references" in data
    assert len(data["market_references"]) >= 2
    assert data["break_even_units"] > 0
    assert "Dictamen Ejecutivo" in data["raw_markdown"]


def test_initiative_benchmark_force_llm_zero_fallback_on_failure():
    """
    En modo 'force_llm', si Ollama falla o no responde, está terminantemente PROHIBIDO
    ejecutar la heurística contable. Debe responder HTTP 503 explícito.
    """
    payload = {
        "product_name": "Monitor Curvo UltraWide",
        "category": "Electrónica",
        "proposed_price": 450.0,
        "proposed_cost": 280.0,
        "expected_demand": 100,
        "initial_investment": 20000.0,
        "engine_mode": "force_llm"
    }
    # Simulamos fallo de red de Ollama
    with patch("httpx.AsyncClient.post", side_effect=Exception("Connection refused to Ollama 11434")):
        res = client.post(
            "/api/v1/initiatives/ai-benchmark",
            json=payload,
            headers={"X-User-Role": "controller_admin", "X-User-Id": "controller_test"}
        )
        assert res.status_code == 503
        detail = res.json().get("detail", "")
        assert "Ollama" in detail or "Servicio LLM" in detail


def test_batch_actions_creation():
    payload = {
        "acciones": [
            {
                "titulo": "Auditar dispersión de precios en Mayorista",
                "area": "Comercial",
                "responsable": "Analista Comercial",
                "fecha_limite": "2026-10-20",
                "estado": "Pendiente",
                "origen": "Minuta Test"
            },
            {
                "titulo": "Revisar stock de seguridad para SKUs críticos",
                "area": "Operaciones",
                "responsable": "Jefe Logística",
                "fecha_limite": "2026-10-25",
                "estado": "Pendiente",
                "origen": "Minuta Test"
            }
        ]
    }
    res = client.post(
        "/api/v1/actions/batch",
        json=payload,
        headers={"X-User-Role": "controller_admin", "X-User-Id": "controller_test"}
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert data[0]["titulo"] == "Auditar dispersión de precios en Mayorista"
    assert data[1]["titulo"] == "Revisar stock de seguridad para SKUs críticos"


def test_update_order_patch():
    # Crear una orden temporal para no alterar los acumulados de las órdenes fijas de prueba
    from app.database.session import SessionLocal
    from app.models.entities import OrdenReposicion
    from datetime import date
    from decimal import Decimal

    db = SessionLocal()
    temp_order = OrdenReposicion(
        sku_id="SKU-1002",
        cantidad=50,
        monto_total=Decimal('2500.00'),
        proveedor="Proveedor Temp",
        etapa="sugerido",
        responsable="Operaciones Test",
        fecha_arribo_estimada=date(2026, 11, 15)
    )
    db.add(temp_order)
    db.commit()
    db.refresh(temp_order)
    order_id = temp_order.id
    db.close()

    try:
        patch_payload = {
            "cantidad": 120,
            "monto_total": 4500.0,
            "proveedor": "Proveedor Patch Test",
            "responsable": "Analista Operaciones"
        }
        patch_res = client.patch(
            f"/api/v1/orders/{order_id}",
            json=patch_payload,
            headers={"X-User-Role": "controller_admin", "X-User-Id": "controller_test"}
        )
        assert patch_res.status_code == 200
        updated = patch_res.json()
        assert updated["cantidad"] == 120
        assert float(updated["monto_total"]) == 4500.0
        assert updated["proveedor"] == "Proveedor Patch Test"
    finally:
        # Cleanup
        db = SessionLocal()
        to_del = db.query(OrdenReposicion).filter(OrdenReposicion.id == order_id).first()
        if to_del:
            db.delete(to_del)
            db.commit()
        db.close()


def test_user_preferences_default_engine_mode_persistence():
    pref_payload = {
        "user_id": "test_pref_user",
        "active_theme": "dark",
        "default_engine_mode": "force_llm",
        "last_view": "initiatives"
    }
    save_res = client.post("/api/v1/settings/preferences", json=pref_payload)
    assert save_res.status_code == 200
    saved = save_res.json()
    assert saved["default_engine_mode"] == "force_llm"
    assert saved["active_theme"] == "dark"

    get_res = client.get("/api/v1/settings/preferences?user_id=test_pref_user")
    assert get_res.status_code == 200
    fetched = get_res.json()
    assert fetched["default_engine_mode"] == "force_llm"
