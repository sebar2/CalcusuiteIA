import pytest
import html
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_tenders_zero_trust_sanitization():
    """
    Valida que inputs con payloads XSS o inyecciones maliciosas
    sean sanitizados por Pydantic V2 sin lanzar excepciones 500.
    """
    malicious_payload = {
        "proyecto_nombre": "<script>alert('pwned')</script> Obra Hospitalaria",
        "cliente_licitacion": "Ministerio de Salud Pública' OR '1'='1",
        "nicho": "industria",
        "plazo_entrega_dias": 30,
        "moneda": "USD",
        "engine_mode": "heuristic",
        "observaciones": "<img src=x onerror=alert(1)> Notas de pliego",
        "items": [
            {
                "sku": "  lum-6060  ",  # Se debe sanitizar a mayúsculas y sin espacios
                "cantidad_solicitada": 50,
            }
        ]
    }

    res = client.post("/api/v1/tenders/evaluate", json=malicious_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    # Verificar que el script no esté en crudo (debe estar escapado en HTML entities)
    assert "<script>" not in data["proyecto_nombre"]
    assert "&lt;script&gt;" in data["proyecto_nombre"]
    assert "LUM-6060" == data["items"][0]["sku"]


def test_tenders_deterministic_logistics_quiebre_critico():
    """
    Test de lógica determinística:
    Cotizar 300 unidades de LUM-6060 (Stock: 80, Lead Time: 60d) con plazo de 15 días:
    - 80 < 300 y 60d > 15d -> DEBE disparar QUIEBRE_LOGISTICO_CRITICO.
    - Unidades faltantes = 220.
    - Días retraso estimado = 45 días (60 - 15).
    """
    from app.database.session import SessionLocal
    from app.models.entities import Product
    db = SessionLocal()
    p = db.query(Product).filter_by(sku="LUM-6060").first()
    if p and p.inventario:
        p.inventario.deposito_central = 80
        p.inventario.lead_time_dias = Decimal("60")
        db.commit()
    db.close()

    payload = {
        "proyecto_nombre": "Ampliación Planta Conaprole",
        "cliente_licitacion": "Conaprole SA",
        "nicho": "industria",
        "plazo_entrega_dias": 15,
        "moneda": "USD",
        "engine_mode": "heuristic",
        "items": [
            {
                "sku": "LUM-6060",
                "cantidad_solicitada": 300,
            }
        ]
    }

    res = client.post("/api/v1/tenders/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["alerta_critica"] is True
    assert data["viabilidad_general"] == "QUIEBRE_LOGISTICO_CRITICO"

    item = data["items"][0]
    assert item["sku"] == "LUM-6060"
    assert item["cantidad_solicitada"] == 300
    assert item["stock_deposito"] == 80
    assert item["viabilidad_logistica"] == "QUIEBRE_LOGISTICO_CRITICO"
    assert item["unidades_faltantes"] == 220
    assert item["dias_retraso_estimado"] == 45
    assert item["badge_color"] == "rose"

    # Verificar que David incluye la alerta técnica
    dictamen_david = data["dictamen_david"]
    assert "ALERTA TÉCNICA DE CRONOGRAMA" in dictamen_david["dictamen_completo"]
    assert dictamen_david["ugr_maximo"] == 22

    # Verificar que Aristóteles incluye Logos, Ethos, Pathos
    dictamen_aristoteles = data["dictamen_aristoteles"]
    assert "LOGOS" in dictamen_aristoteles["logos"]
    assert "ETHOS" in dictamen_aristoteles["ethos"]
    assert "PATHOS" in dictamen_aristoteles["pathos"]


def test_tenders_viable_stock_inmediato():
    """
    Cotizar 50 unidades de LUM-6060 (Stock: 80):
    - stock_deposito (80) >= cantidad (50) -> VIABLE_STOCK_INMEDIATO.
    """
    payload = {
        "proyecto_nombre": "Oficinas World Trade Center MVD",
        "cliente_licitacion": "WTC Free Zone",
        "nicho": "oficinas",
        "plazo_entrega_dias": 10,
        "moneda": "USD",
        "engine_mode": "heuristic",
        "items": [
            {
                "sku": "LUM-6060",
                "cantidad_solicitada": 50,
            }
        ]
    }

    res = client.post("/api/v1/tenders/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["alerta_critica"] is False
    assert data["viabilidad_general"] == "VIABLE_LOGISTICA_APROBADA"
    item = data["items"][0]
    assert item["viabilidad_logistica"] == "VIABLE_STOCK_INMEDIATO"
    assert item["unidades_faltantes"] == 0
    assert item["dias_retraso_estimado"] == 0
    assert item["badge_color"] == "emerald"

    # Oficinas -> David evalúa UGR < 19
    assert data["dictamen_david"]["ugr_maximo"] == 19
    assert data["dictamen_david"]["lux_objetivo"] == 500


def test_tenders_conversion_moneda_uyu_con_brou():
    """
    Cotizar en moneda UYU debe convertir los costos CIF usando la cotización oficial del BROU.
    """
    payload = {
        "proyecto_nombre": "Alumbrado Rambla Costanera",
        "cliente_licitacion": "Intendencia de Canelones",
        "nicho": "municipios",
        "plazo_entrega_dias": 90,
        "moneda": "UYU",
        "engine_mode": "heuristic",
        "items": [
            {
                "sku": "PRY-100W",
                "cantidad_solicitada": 100,
            }
        ]
    }

    res = client.post("/api/v1/tenders/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["moneda"] == "UYU"
    tasa_brou = data["tasa_cambio_brou"]
    assert tasa_brou > 35.0

    item = data["items"][0]
    # Costo USD de PRY-100W es 26.80
    assert item["costo_unitario_usd"] == 26.80
    expected_costo_uyu = round(26.80 * tasa_brou, 2)
    assert abs(item["costo_unitario_moneda"] - expected_costo_uyu) < 0.1
    assert item["subtotal_precio"] > 0


def test_tenders_persistence_and_listing():
    """
    Verifica que POST /api/v1/tenders almacena la licitación
    y GET /api/v1/tenders la lista con sus ítems.
    """
    unique_name = f"Licitación UTE Central Batlle {Decimal('123.45')}"
    payload = {
        "proyecto_nombre": unique_name,
        "cliente_licitacion": "Administración Nacional de Usinas y Trasmisiones Eléctricas (UTE)",
        "nicho": "industria",
        "plazo_entrega_dias": 60,
        "moneda": "USD",
        "engine_mode": "heuristic",
        "items": [
            {
                "sku": "UFO-150W",
                "cantidad_solicitada": 40,
            },
            {
                "sku": "DRV-DALI",
                "cantidad_solicitada": 10,
            }
        ]
    }

    create_res = client.post("/api/v1/tenders", json=payload)
    assert create_res.status_code == 200
    created = create_res.json()
    assert "id" in created
    assert created["proyecto_nombre"] == unique_name
    assert created["total_items"] == 2
    assert created["total_ofertado"] > 0

    tender_id = created["id"]

    # Detalle
    detail_res = client.get(f"/api/v1/tenders/{tender_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == tender_id
    assert len(detail["items"]) == 2
    assert "dictamen_david" in detail
    assert "dictamen_aristoteles" in detail

    # Listado
    list_res = client.get("/api/v1/tenders")
    assert list_res.status_code == 200
    tenders_list = list_res.json()
    assert any(t["id"] == tender_id for t in tenders_list)


def test_tenders_dialectical_debate_endpoint():
    """
    Verifica que el endpoint dedicado POST /api/v1/tenders/debate
    ejecute la cadena dialéctica entre Ing. David y Aristóteles
    retornando ambas posturas y el modelo utilizado.
    """
    payload = {
        "proyecto_nombre": "Ampliación Conaprole Planta Rincón",
        "cliente_licitacion": "Conaprole SA",
        "nicho": "industria",
        "plazo_entrega_dias": 15,
        "moneda": "USD",
        "engine_mode": "heuristic",
        "items": [
            {
                "sku": "LUM-6060",
                "cantidad_solicitada": 300,
            }
        ]
    }

    res = client.post("/api/v1/tenders/debate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "postura_david" in data
    assert "replica_aristoteles" in data
    assert "David" in data["postura_david"] or "UNIT" in data["postura_david"]
    assert "Aristóteles" in data["replica_aristoteles"] or "LOGOS" in data["replica_aristoteles"]
    assert "modelo_utilizado" in data
