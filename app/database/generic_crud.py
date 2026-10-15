from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from pydantic import BaseModel
from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import Session
from app.models.base import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Abstracción DRY de Operaciones CRUD Genéricas para SQLAlchemy 2.0 y Pydantic v2.
    Proporciona operaciones type-safe con select(), scalars() y tipado estricto.
    """

    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, id: Any) -> Optional[ModelType]:
        """Obtiene un registro por su clave primaria usando sintaxis moderna SQLAlchemy 2.0."""
        stmt = select(self.model).where(self.model.id == id)
        return db.scalars(stmt).first()

    def get_multi(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[Any] = None,
        filters: Optional[List[Any]] = None,
    ) -> List[ModelType]:
        """Obtiene múltiples registros con paginación, filtros opcionales y ordenamiento."""
        stmt = select(self.model)
        if filters:
            for f in filters:
                stmt = stmt.where(f)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        stmt = stmt.offset(skip).limit(limit)
        return list(db.scalars(stmt).all())

    def count(self, db: Session, filters: Optional[List[Any]] = None) -> int:
        """Cuenta total de registros según filtros aplicados."""
        stmt = select(func.count()).select_from(self.model)
        if filters:
            for f in filters:
                stmt = stmt.where(f)
        return db.scalar(stmt) or 0

    def create(self, db: Session, *, obj_in: Union[CreateSchemaType, Dict[str, Any]]) -> ModelType:
        """Crea un nuevo registro transformando desde esquema Pydantic v2 o diccionario."""
        if isinstance(obj_in, dict):
            obj_in_data = obj_in
        else:
            obj_in_data = obj_in.model_dump(exclude_unset=True)

        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]],
    ) -> ModelType:
        """Actualiza un registro existente con cambios delta de Pydantic v2."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, id: Any) -> Optional[ModelType]:
        """Elimina un registro por ID y lo retorna."""
        obj = self.get(db, id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj
