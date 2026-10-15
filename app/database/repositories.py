from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from app.database.generic_crud import CRUDBase
from app.models.entities import Category, Warehouse
from app.models.logistics_entities import (
    LogisticsClient,
    LogisticsCostItem,
    LogisticsDriver,
    LogisticsVehicle,
    LogisticsHub,
)

# ========================================================
# ESQUEMAS UNIFICADOS PYDANTIC V2 PARA CRUD GENÉRICO
# ========================================================

class CategoryBaseSchema(BaseModel):
    nombre: str
    margen_target_pct: Decimal = Decimal("0.30")
    model_config = ConfigDict(from_attributes=True)

class CategoryCreateSchema(CategoryBaseSchema):
    pass

class CategoryUpdateSchema(BaseModel):
    nombre: Optional[str] = None
    margen_target_pct: Optional[Decimal] = None
    model_config = ConfigDict(from_attributes=True)


class WarehouseBaseSchema(BaseModel):
    id: str
    nombre: str
    tipo: str = "SUCURSAL"
    ubicacion: str
    pais: str = "Uruguay"
    capacidad_unidades: int = 10000
    activo: bool = True
    model_config = ConfigDict(from_attributes=True)

class WarehouseCreateSchema(WarehouseBaseSchema):
    pass

class WarehouseUpdateSchema(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    ubicacion: Optional[str] = None
    pais: Optional[str] = None
    capacidad_unidades: Optional[int] = None
    activo: Optional[bool] = None
    model_config = ConfigDict(from_attributes=True)


class CostItemBaseSchema(BaseModel):
    tipo: str = "FIJO"  # FIJO o VARIABLE
    categoria: str = "ALQUILER"
    nombre: str
    monto_mensual: Decimal = Decimal("1000.00")
    moneda: str = "UYU"
    descripcion: Optional[str] = None
    activo: bool = True
    model_config = ConfigDict(from_attributes=True)

class CostItemCreateSchema(CostItemBaseSchema):
    pass

class CostItemUpdateSchema(BaseModel):
    tipo: Optional[str] = None
    categoria: Optional[str] = None
    nombre: Optional[str] = None
    monto_mensual: Optional[Decimal] = None
    moneda: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None
    model_config = ConfigDict(from_attributes=True)


# ========================================================
# INSTANCIAS DE REPOSITORIOS CRUD GENÉRICOS (SQLAlchemy 2.0)
# ========================================================

crud_category = CRUDBase[Category, CategoryCreateSchema, CategoryUpdateSchema](Category)
crud_warehouse = CRUDBase[Warehouse, WarehouseCreateSchema, WarehouseUpdateSchema](Warehouse)
crud_cost_item = CRUDBase[LogisticsCostItem, CostItemCreateSchema, CostItemUpdateSchema](LogisticsCostItem)
crud_client = CRUDBase[LogisticsClient, BaseModel, BaseModel](LogisticsClient)
crud_driver = CRUDBase[LogisticsDriver, BaseModel, BaseModel](LogisticsDriver)
crud_vehicle = CRUDBase[LogisticsVehicle, BaseModel, BaseModel](LogisticsVehicle)
crud_hub = CRUDBase[LogisticsHub, BaseModel, BaseModel](LogisticsHub)
