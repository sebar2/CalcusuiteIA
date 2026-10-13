import asyncio
from app.services.arbitrage_service import ArbitrageService

def test_arbitrage_categories_and_models():
    cats = ArbitrageService.get_categories()
    assert len(cats) == 28
    assert any(c["id"] == "MLU1000" for c in cats)
    assert not any(c["id"] in ("MLU1743", "MLU1459", "MLU1540") for c in cats)

def test_arbitrage_scan_and_excel_generation():
    scan_result = asyncio.run(ArbitrageService.process_arbitrage_scan(
        category_id="ALL",
        limit=5
    ))
    assert scan_result["status"] == "success"
    assert len(scan_result["items"]) >= 1
    
    first_item = scan_result["items"][0]
    assert first_item["mlu_permalink"].startswith("http")
    assert first_item["alibaba_search_url"].startswith("http")
    assert "SearchText=" in first_item["alibaba_search_url"]
    
    # Generar Excel y verificar que no lance NameError ni excepciones
    excel_bytes = ArbitrageService.generate_excel_report(scan_result)
    assert isinstance(excel_bytes, bytes)
    assert len(excel_bytes) > 1000
