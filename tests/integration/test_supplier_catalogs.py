import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal, init_db
from app.models.entities import Supplier, SupplierCatalogItem

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

def test_list_suppliers_filters(client):
    # Test filtro sin parámetros
    res = client.get("/api/v1/suppliers")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "rubro" in data[0]
    assert "condicion_pago" in data[0]

    # Test filtro por tipo LOCAL
    res_local = client.get("/api/v1/suppliers?tipo=LOCAL")
    assert res_local.status_code == 200

    # Test filtro por search
    res_search = client.get("/api/v1/suppliers?search=Sur")
    assert res_search.status_code == 200

def test_supplier_catalog_products(client):
    # Obtener un proveedor existente
    supp_res = client.get("/api/v1/suppliers")
    assert supp_res.status_code == 200
    supp_id = supp_res.json()[0]["id"]

    # Consultar catálogo
    cat_res = client.get(f"/api/v1/suppliers/{supp_id}/catalog/products")
    assert cat_res.status_code == 200
    cat_data = cat_res.json()
    assert cat_data["success"] is True
    assert "items" in cat_data

    # Crear o actualizar un ítem
    payload = {
        "sku_proveedor": "TEST-SKU-999",
        "sku_calcu": "SKU-CALCU-999",
        "nombre": "Producto Test Catálogo",
        "rubro": "Iluminación",
        "costo_compra": 50.0,
        "precio_venta_comercios": 75.0,
        "precio_venta_publico": 100.0,
        "stock_estimado": "En Stock MVD"
    }
    post_res = client.post(f"/api/v1/suppliers/{supp_id}/catalog/products", json=payload)
    assert post_res.status_code == 200
    item = post_res.json()
    assert item["sku_proveedor"] == "TEST-SKU-999"
    assert Decimal(str(item["descuento_comercios_pct"])) == Decimal('25.00')  # ((100-75)/100)*100
    assert Decimal(str(item["margen_reventa_pct"])) == Decimal('33.33')  # ((75-50)/75)*100
    assert Decimal(str(item["markup_costo_pct"])) == Decimal('100.00')  # ((100-50)/50)*100

    # Eliminar el ítem creado para dejar limpia la base
    del_res = client.delete(f"/api/v1/suppliers/{supp_id}/catalog/products/{item['id']}")
    assert del_res.status_code == 200

def test_supplier_catalog_tenders(client):
    supp_res = client.get("/api/v1/suppliers")
    assert supp_res.status_code == 200
    supp_id = supp_res.json()[0]["id"]

    tenders_res = client.get(f"/api/v1/suppliers/{supp_id}/catalog/tenders")
    assert tenders_res.status_code == 200
    data = tenders_res.json()
    assert data["success"] is True
    assert "contracts" in data
