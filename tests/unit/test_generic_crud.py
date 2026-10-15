import pytest
from decimal import Decimal
from app.database.session import SessionLocal
from app.database.repositories import (
    crud_category,
    crud_warehouse,
    CategoryCreateSchema,
    CategoryUpdateSchema,
    WarehouseCreateSchema,
)

def test_generic_crud_category_lifecycle():
    """Valida el ciclo de vida completo (Create, Read, Update, Delete) en CRUDBase con SQLAlchemy 2.0."""
    db = SessionLocal()
    try:
        # Create
        cat_in = CategoryCreateSchema(nombre="Categoría Test DRY", margen_target_pct=Decimal("0.35"))
        cat = crud_category.create(db, obj_in=cat_in)
        assert cat.id is not None
        assert cat.nombre == "Categoría Test DRY"
        assert cat.margen_target_pct == Decimal("0.35")

        # Get
        retrieved = crud_category.get(db, cat.id)
        assert retrieved is not None
        assert retrieved.id == cat.id

        # Update
        cat_up = CategoryUpdateSchema(margen_target_pct=Decimal("0.40"))
        updated = crud_category.update(db, db_obj=retrieved, obj_in=cat_up)
        assert updated.margen_target_pct == Decimal("0.40")

        # Get Multi & Count
        total = crud_category.count(db)
        assert total >= 1
        items = crud_category.get_multi(db, limit=10)
        assert len(items) >= 1

        # Delete
        removed = crud_category.remove(db, id=cat.id)
        assert removed is not None
        assert crud_category.get(db, cat.id) is None
    finally:
        db.close()

def test_generic_crud_warehouse_lifecycle():
    """Valida operaciones en otra entidad usando la misma abstracción genérica DRY."""
    db = SessionLocal()
    try:
        wh_in = WarehouseCreateSchema(
            id="wh-test-dry",
            nombre="Almacén Test DRY",
            tipo="SUCURSAL",
            ubicacion="Zona Franca Test",
            capacidad_unidades=5000,
            activo=True,
        )
        wh = crud_warehouse.create(db, obj_in=wh_in)
        assert wh.id == "wh-test-dry"

        # Count
        count_wh = crud_warehouse.count(db)
        assert count_wh >= 1

        # Remove
        crud_warehouse.remove(db, id=wh.id)
        assert crud_warehouse.get(db, "wh-test-dry") is None
    finally:
        db.close()
