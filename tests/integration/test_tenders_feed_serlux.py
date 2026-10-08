"""QA del feed de licitaciones Serlux: clasificador, parser OCDS y URLs."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import tenders_feed_service as feed_mod
from app.services.tenders_feed_service import TendersFeedService, classify_tender, heuristic_classify

client = TestClient(app)


# ---------------------------------------------------------------- clasificador
@pytest.mark.parametrize(
    "titulo,relevante,categoria",
    [
        ("Adquisición de pintura vial y tachas reflectivas", False, "NO_APLICA"),
        (
            "Suministro e instalación de artefactos de iluminación LED y campanas industriales "
            "para talleres de UTE",
            True,
            "ILUMINACION",
        ),
        ("Renovación de sillería operativa y escritorios para sucursal bancaria BROU", True, "MOBILIARIO"),
        ("Tendido de cable de alta tensión en estación Rodríguez", False, "NO_APLICA"),
        ("Compra de artículos de limpieza y detergentes", False, "NO_APLICA"),
        ("Compra de artículos de escritorio y papelería", False, "NO_APLICA"),
        ("Adquisición de proyector multimedia para sala de conferencias", False, "NO_APLICA"),
        ("Impresión de formularios de inspección", False, "NO_APLICA"),
        ("Luminarias viales LED para alumbrado público de Canelones", True, "ILUMINACION"),
    ],
)
def test_heuristic_classifier(titulo, relevante, categoria):
    res = classify_tender(titulo, use_llm=False)
    assert res["relevante"] is relevante
    assert res["categoria"] == categoria


def test_classifier_suggests_catalog_skus_only():
    res = heuristic_classify("Campanas industriales high bay y paneles LED 60x60 con driver DALI")
    assert res["categoria"] == "ILUMINACION"
    assert set(res["skus_relacionados"]) == {"UFO-150W", "LUM-6060", "DRV-DALI"}


def test_llm_failure_falls_back_to_heuristic(monkeypatch):
    monkeypatch.setattr(feed_mod, "llm_classify", lambda *a, **k: None)
    res = classify_tender("Paneles LED para oficinas", use_llm=True)
    assert res["relevante"] is True and res["fuente"] == "HEURISTICA"


def test_llm_can_veto(monkeypatch):
    monkeypatch.setattr(
        feed_mod,
        "llm_classify",
        lambda *a, **k: {"relevante": False, "categoria": "NO_APLICA", "skus_relacionados": [],
                         "confianza": 0.9, "justificacion_corta": "Rubro ajeno"},
    )
    res = classify_tender("Luminarias LED", use_llm=True)
    assert res["relevante"] is False and res["fuente"] == "LLM"


# ------------------------------------------------------------- parser OCDS
def _release(id_compra, descripcion, items, days=10, doc=True):
    end = (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "id": f"llamado-{id_compra}",
        "buyer": {"name": "UTE"},
        "tender": {
            "id": str(id_compra),
            "title": "Licitación Abreviada 12/2026",
            "description": descripcion,
            "status": "active",
            "procuringEntity": {"name": "UTE"},
            "items": items,
            "tenderPeriod": {"endDate": end},
            "documents": [
                {"documentType": "biddingDocuments",
                 "url": f"http://www.comprasestatales.gub.uy/Pliegos/pliego_{id_compra}.pdf"}
            ] if doc else [],
        },
    }


def test_release_to_item_maps_urls_and_quantities():
    svc = TendersFeedService()
    rel = _release(
        999001,
        "Suministro de campanas industriales LED y proyectores LED para talleres.",
        [
            {"description": "CAMPANA INDUSTRIAL LED 150W", "quantity": 120},
            {"description": "PROYECTOR LED EXTERIOR 100W", "quantity": 40},
        ],
    )
    item, analizado = svc._release_to_item(rel, use_llm=False)
    assert analizado and item is not None
    assert item.id == "ARCE-999001"
    assert item.pliego_url == "https://www.comprasestatales.gub.uy/consultas/detalle/id/999001"
    assert item.pdf_download_url == "https://www.comprasestatales.gub.uy/Pliegos/pliego_999001.pdf"
    assert item.pdf_nombre_archivo == "pliego_999001.pdf"
    assert item.cantidades_sugeridas == {"UFO-150W": 120, "PRY-100W": 40}
    assert item.nicho == "ILUMINACION_TECNICA"


def test_release_irrelevant_or_expired_is_discarded():
    svc = TendersFeedService()
    item, analizado = svc._release_to_item(
        _release(999002, "Adquisición de pintura vial y tachas reflectivas", []), use_llm=False
    )
    assert analizado and item is None
    item, _ = svc._release_to_item(_release(999003, "Luminarias LED", [], days=-2), use_llm=False)
    assert item is None


# ------------------------------------------------------------- endpoints
def test_live_feed_has_no_broken_links_and_niche_filter():
    res = client.get("/api/v1/tenders/live-feed")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 4
    for it in data["items"]:
        assert it["pliego_url"].startswith("https://")
        assert "undefined" not in it["pliego_url"]
        assert it["pdf_download_url"] is None or it["pdf_download_url"].startswith("https://")
        assert it["nicho"] in ("ILUMINACION_TECNICA", "MOBILIARIO_CORPORATIVO")

    mob = client.get("/api/v1/tenders/live-feed", params={"nicho": "MOBILIARIO_CORPORATIVO"}).json()
    assert mob["total"] >= 1
    assert all(i["nicho"] == "MOBILIARIO_CORPORATIVO" for i in mob["items"])


def test_feed_sync_endpoint_and_import_errors():
    assert client.post("/api/v1/tenders/feed/sync").status_code == 200
    assert client.post("/api/v1/tenders/import-feed-item", json={"feed_item_id": "NO-EXISTE"}).status_code == 404
    # Mobiliario sin SKUs de catálogo -> 422 explícito (no 500)
    res = client.post("/api/v1/tenders/import-feed-item", json={"feed_item_id": "DEMO-BROU-MOBILIARIO"})
    assert res.status_code == 422


# ------------------------------------------------------------- 3 casos reales ARCE Serlux
def test_three_real_arce_cases_exist_with_keywords_and_snippets():
    res = client.get("/api/v1/tenders/live-feed")
    assert res.status_code == 200
    items = {it["id"]: it for it in res.json()["items"]}

    # Caso 1: Intendencia de Río Negro - Columnas y brazos de soporte
    assert "ARCE-LIC-2026-RN-022" in items
    rn = items["ARCE-LIC-2026-RN-022"]
    assert rn["nicho"] == "ILUMINACION_TECNICA"
    assert rn["organismo"] == "Intendencia de Río Negro"
    assert any("columna" in kw for kw in rn["keywords_detectadas"])
    assert any("brazo" in kw for kw in rn["keywords_detectadas"])
    assert rn["snippet_coincidencia"] is not None
    assert len(rn["snippet_coincidencia"]) > 20

    # Caso 2: ASSE RAP Colonia - Sillas altas y armarios metálicos
    assert "ARCE-CD-2026-ASSE-050" in items
    asse = items["ARCE-CD-2026-ASSE-050"]
    assert asse["nicho"] == "MOBILIARIO_CORPORATIVO"
    assert "ASSE" in asse["organismo"]
    assert any("silla" in kw for kw in asse["keywords_detectadas"])
    assert any("armario" in kw for kw in asse["keywords_detectadas"])
    assert asse["snippet_coincidencia"] is not None

    # Caso 3: MEC - Controladores LED y driver LED regulable DALI
    assert "ARCE-CD-2026-MEC-087" in items
    mec = items["ARCE-CD-2026-MEC-087"]
    assert mec["nicho"] == "ILUMINACION_TECNICA"
    assert "MEC" in mec["organismo"]
    assert any("driver" in kw for kw in mec["keywords_detectadas"])
    assert "DRV-DALI" in mec["skus_detectados"]
    assert mec["snippet_coincidencia"] is not None


def test_live_feed_filter_by_keyword_param():
    # Filtrado por 'columnas'
    res_col = client.get("/api/v1/tenders/live-feed", params={"keyword": "columnas"})
    assert res_col.status_code == 200
    data_col = res_col.json()
    assert data_col["total"] >= 1
    ids_col = [i["id"] for i in data_col["items"]]
    assert "ARCE-LIC-2026-RN-022" in ids_col

    # Filtrado por 'armario'
    res_arm = client.get("/api/v1/tenders/live-feed", params={"keyword": "armario"})
    assert res_arm.status_code == 200
    data_arm = res_arm.json()
    assert data_arm["total"] >= 1
    ids_arm = [i["id"] for i in data_arm["items"]]
    assert "ARCE-CD-2026-ASSE-050" in ids_arm

    # Filtrado por 'driver'
    res_drv = client.get("/api/v1/tenders/live-feed", params={"keyword": "driver"})
    assert res_drv.status_code == 200
    data_drv = res_drv.json()
    assert data_drv["total"] >= 1
    ids_drv = [i["id"] for i in data_drv["items"]]
    assert "ARCE-CD-2026-MEC-087" in ids_drv


def test_snippet_extraction_bounds():
    from app.services.tenders_feed_service import extract_snippet
    texto = (
        "Llamado a interesados para el suministro e instalacion de artefactos de iluminacion vial, "
        "columnas de hormigon de 9 metros y brazos pescantes dobles para alumbrado publico en ruta nacional."
    )
    snippet = extract_snippet(texto, ["columnas", "brazos"], max_len=80)
    assert snippet is not None
    assert "columnas" in snippet or "brazos" in snippet
    assert len(snippet) <= 120

