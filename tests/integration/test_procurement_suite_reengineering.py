"""
Test Suite Integral de Reingeniería para el Hub de Licitaciones y Mercado Público (Calcu Suite).
Verifica:
  1. Hidratación profunda OCDS (objeto, items solicitados, URLs pliego web y PDF).
  2. Dictamen con IA local y análisis PDF en 4 bloques.
  3. Precios & SICE conectado al Radar con rigor Decimal.
  4. Competidores master-detail, alerta de reventa y alta en Proveedores.
  5. Compradores con filtros multicriterio y semáforo DSO SIIF.
  6. Calendario con ordenamiento por factibilidad de stock.
  7. Cotizador B2B con reserva en Gemelo Digital 3D y exportación SICE (Excel / PDF).
"""

from decimal import Decimal
import pytest
from starlette.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_open_calls_deep_hydration_and_rubros():
    """Verifica que las convocatorias abiertas incluyan objeto_contratacion, items_solicitados y URLs de pliego."""
    res = client.get("/api/v1/procurement/open-calls", params={"category": "ILUMINACION_EFICIENCIA"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["total"] >= 1
    calls = data["calls"]
    first = calls[0]
    assert "objeto_contratacion" in first
    assert "items_solicitados" in first
    assert isinstance(first["items_solicitados"], list)
    if len(first["items_solicitados"]) > 0:
        item = first["items_solicitados"][0]
        assert "codigo_sice" in item
        assert "descripcion" in item
        assert "cantidad" in item
    assert "url_pliego_arce" in first
    assert first["url_pliego_arce"].startswith("https://")
    assert "url_pliego_pdf" in first


def test_analyze_pdf_four_blocks():
    """Verifica la extracción y dictamen del pliego en los 4 bloques clave."""
    payload = {
        "vertical_id": "ILUMINACION_EFICIENCIA",
        "titulo": "Suministro de Luminarias LED Viales para UTE",
        "organismo": "UTE",
        "items_solicitados": [
            {"codigo_sice": "LUM-6060", "descripcion": "Panel LED 60x60", "cantidad": 50, "unidad_medida": "UNIDAD"}
        ],
        "plazo_entrega_dias": 30,
    }
    res = client.post("/api/v1/procurement/open-calls/1378101/analyze-pdf", json=payload)
    assert res.status_code == 200
    data = res.json()["data"]
    assert "bloques" in data
    bloques = data["bloques"]
    assert "items_variantes" in bloques
    assert "plazos_multas" in bloques
    assert "muestras_garantias" in bloques
    assert "requisitos_rupe" in bloques
    assert data["es_aprobado"] is True


def test_pricing_radar_suggested_items_decimal():
    """Verifica la bandeja de sugerencias desde Radar SICE con cálculos financieros precisos."""
    res = client.get("/api/v1/procurement/pricing/radar-suggested-items")
    assert res.status_code == 200
    items = res.json()["data"]["items"]
    assert len(items) >= 1
    first = items[0]
    assert "codigo_sice" in first
    assert "ultimo_precio_adjudicado" in first
    assert "precio_oferta_recomendado_calcu" in first
    assert first["precio_oferta_recomendado_calcu"] > 0
    assert first["tc_brou"] == 40.10


def test_competitor_to_suppliers_bridge_and_arbitrage():
    """Verifica la ficha de competidor con detalle de productos y alta en catálogo de proveedores."""
    # 1. Detalle del competidor con alerta de arbitraje
    det_res = client.get("/api/v1/procurement/suppliers/distribuidores-del-plata")
    assert det_res.status_code == 200
    contracts = det_res.json()["data"]["recentContracts"]
    assert len(contracts) >= 1
    first_item = contracts[0]["items"][0]
    assert "sku_sice" in first_item
    assert "oportunidad_abastecimiento_local" in first_item

    # 2. Alta en Proveedores locales en 1 clic
    add_payload = {
        "competitor_name": "Serlux Soluciones SA",
        "competitor_rut": "21.849.201.0019",
        "rubro": "Iluminación & Suministros",
        "contract_id": "LIC-2026-008",
        "product_sku": "LUM-6060",
        "product_name": "Panel LED 60x60 40W 4000K",
        "cantidad": 100,
        "precio_adjudicado": 22.50,
        "moneda": "USD",
    }
    add_res = client.post("/api/v1/procurement/competitors/add-to-suppliers", json=add_payload)
    assert add_res.status_code == 200
    assert add_res.json()["status"] == "success"
    assert "supplier_id" in add_res.json()


def test_buyers_multicriteria_and_dso_traffic_light():
    """Verifica el listado de compradores con filtros multicriterio y semáforo de pago SIIF."""
    res = client.get("/api/v1/procurement/buyers", params={"search": "UTE"})
    assert res.status_code == 200
    buyers = res.json()["data"]["buyers"]
    assert len(buyers) >= 1
    ute = next((b for b in buyers if "UTE" in b["name"]), buyers[0])
    assert ute["dso_estimado_dias"] <= 45
    assert ute["dso_semaforo"] == "VERDE"


def test_calendar_cross_stock_feasibility_reordering():
    """Verifica el cruce de stock y reordenamiento por factibilidad (Tier 1 -> Tier 2 -> Tier 3)."""
    payload = {"vertical_id": "ILUMINACION_EFICIENCIA"}
    res = client.post("/api/v1/procurement/calendar/cross-stock", json=payload)
    assert res.status_code == 200
    data = res.json()["data"]
    items = data["items"]
    assert len(items) >= 1
    # Debe estar ordenado por Tier ascendente
    tiers = [it["tier"] for it in items]
    assert tiers == sorted(tiers)
    assert all("semaforo_logistico" in it for it in items)
    assert all("cobertura_stock_inmediato_pct" in it for it in items)


def test_quoter_twin_reservation():
    """Verifica la pre-reserva blanda y reserva dura en el Gemelo Digital 3D."""
    # Pre-reserva blanda
    res_soft = client.post("/api/v1/procurement/quoter/reserve-twin", json={
        "tender_id": "1378101",
        "skus": ["LUM-6060"],
        "reservation_type": "SOFT"
    })
    assert res_soft.status_code == 200
    assert res_soft.json()["reservation_type"] == "SOFT_RESERVED"

    # Reserva dura (bloqueo físico)
    res_hard = client.post("/api/v1/procurement/quoter/reserve-twin", json={
        "tender_id": "1378101",
        "skus": ["LUM-6060", "UFO-150W"],
        "reservation_type": "HARD"
    })
    assert res_hard.status_code == 200
    assert res_hard.json()["reservation_type"] == "HARD_RESERVED"
    assert res_hard.json()["http_code"] == 423


def test_sice_offer_export_excel_and_pdf():
    """Verifica la exportación oficial de oferta económica para RUPE / SICE en Excel y PDF."""
    offer_payload = {
        "empresa_oferente": "Calcu Enterprise SA",
        "rut_oferente": "21.999.830.0018",
        "numero_licitacion": "Licitación Abreviada 22/2026",
        "organismo": "UTE",
        "moneda": "USD",
        "tipo_cambio_brou": 40.10,
        "plazo_entrega_garantizado": "20 días corridos",
        "mantenimiento_oferta": "60 días corridos",
        "partidas": [
            {
                "codigo_sice": "LUM-6060",
                "descripcion": "Panel LED 60x60 40W 4000K UGR<19 DALI",
                "cantidad": 120,
                "unidad_medida": "UNIDAD",
                "precio_unitario_sin_iva": 24.50,
            },
            {
                "codigo_sice": "UFO-150W",
                "descripcion": "Campana Industrial UFO LED 150W IP65 90°",
                "cantidad": 60,
                "unidad_medida": "UNIDAD",
                "precio_unitario_sin_iva": 68.00,
            }
        ],
        "format": "excel"
    }

    # Test Excel export
    res_excel = client.post("/api/v1/procurement/export-sice-offer", json=offer_payload)
    assert res_excel.status_code == 200
    assert res_excel.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(res_excel.content) > 1000

    # Test PDF export
    offer_payload["format"] = "pdf"
    res_pdf = client.post("/api/v1/procurement/export-sice-offer", json=offer_payload)
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert res_pdf.content.startswith(b"%PDF")
