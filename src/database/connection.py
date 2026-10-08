from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.models.base import Base

DATABASE_URL = 'sqlite:///calcu.db'

engine = create_engine(DATABASE_URL, connect_args={'check_same_thread': False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    from src.models.entities import Product, Inventory, SupplyOrder, Sale
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

