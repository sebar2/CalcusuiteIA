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

def test_import_competitor_to_suppliers_and_catalog(client):
    payload = {
        "id": "COMP-TEST-001",
        "nombre": "Empresa Licitante Test SA",
        "razon_social": "Empresa Licitante Test SA",
        "rut": "219998880019",
        "rubro": "Electromecánica & Iluminación",
        "email": "contacto@licitantetest.uy",
        "phone": "+598 2901 2345",
        "contracts": [
            {
                "id": "LIC-2026-001",
                "title": "Suministro de Columnas de Alumbrado y Luminarias LED",
                "buyerName": "Intendencia de Canelones",
                "date": "2026-02-15",
                "amount": 150000.0,
                "currency": "UYU",
                "items": [
                    {
                        "description": "Luminaria LED Vial 100W IP66",
                        "quantity": 50,
                        "unitName": "UNIDAD",
                        "unitPrice": 1800.0,
                        "totalPrice": 90000.0,
                        "currency": "UYU",
                    },
                    {
                        "description": "Columna de Acero Galvanizado 9m",
                        "quantity": 20,
                        "unitName": "UNIDAD",
                        "unitPrice": 3000.0,
                        "totalPrice": 60000.0,
                        "currency": "UYU",
                    }
                ]
            }
        ]
    }

    res = client.post("/api/v1/suppliers/import-competitor", json=payload)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["success"] is True
    assert res_data["imported_items_count"] == 2
    assert res_data["supplier"]["tipo_proveedor"] == "licitaciones"

    # Verificar que el proveedor aparece con el filtro tipo=licitaciones
    filter_res = client.get("/api/v1/suppliers?tipo=licitaciones")
    assert filter_res.status_code == 200
    suppliers_licitaciones = filter_res.json()
    assert any(s["rut"] == "219998880019" for s in suppliers_licitaciones)

    # Verificar que los ítems están en su catálogo de productos
    supplier_id = res_data["supplier"]["id"]
    cat_res = client.get(f"/api/v1/suppliers/{supplier_id}/catalog/products")
    assert cat_res.status_code == 200
    cat_items = cat_res.json()["items"]
    assert len(cat_items) == 2
    assert any("Luminaria LED" in item["nombre"] for item in cat_items)

def test_buyer_detail_endpoint(client):
    res = client.get("/api/v1/procurement/buyers/Intendencia de Canelones")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    buyer_info = data["data"]
    assert "name" in buyer_info
    assert "contracts" in buyer_info
    assert "contact" in buyer_info
    # Verificar pliego url en los contratos
    for c in buyer_info.get("contracts", []):
        assert "pliego_url" in c
        assert c["pliego_url"].startswith("http")

