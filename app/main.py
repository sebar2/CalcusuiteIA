from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database.session import init_db, SessionLocal
from app.services.etl_service import ETLService
from app.api.v1.endpoints import router as v1_router
from app.api.v1.advisor import router as advisor_router
from app.api.v1.settings import router as settings_router
from app.api.v1.cockpit import router as cockpit_router
from app.api.v1.initiatives import router as initiatives_router
from app.api.v1.auth import router as auth_router
from app.api.v1.procurement import router as procurement_router, b2b_tenders_router
from app.api.v1.suppliers import router as suppliers_catalog_router
import os
from fastapi.staticfiles import StaticFiles

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "static", "uploads")
os.makedirs(os.path.join(UPLOAD_DIR, "products"), exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Inicializar BD y cargar datos semilla si corresponde
    init_db()
    db = SessionLocal()
    try:
        ETLService.seed_demo_data(db)
    finally:
        db.close()
    yield
    # Shutdown

app = FastAPI(
    title="Calcu - SupplyFinance Core API",
    description="Motor de analítica financiera, pricing, abastecimiento y control de inventario",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Middleware CORS con soporte expreso para Vite SPA (:5173), Streamlit y producción
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8501",
        "http://127.0.0.1:8501",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError

# Controladores globales de excepciones
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTPException",
            "status_code": exc.status_code,
            "detail": exc.detail,
            "path": str(request.url)
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "error": "ValidationError",
            "status_code": status.HTTP_422_UNPROCESSABLE_CONTENT,
            "detail": exc.errors(),
            "path": str(request.url)
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "message": str(exc),
            "path": str(request.url)
        }
    )

@app.get("/", tags=["Sistema"])
def root():
    return {
        "title": "Calcu - SupplyFinance Core API",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "health": "/health"
    }

@app.get("/health", tags=["Sistema"])
def health_check():
    return {
        "status": "healthy",
        "service": "SupplyFinance-Core",
        "version": "1.0.0"
    }

# Registrar rutas de API v1
app.include_router(v1_router)
app.include_router(advisor_router)
app.include_router(settings_router)
app.include_router(cockpit_router)
app.include_router(initiatives_router)
app.include_router(auth_router)
app.include_router(procurement_router)
app.include_router(b2b_tenders_router)
app.include_router(suppliers_catalog_router)

# Montar directorio estático de uploads (imágenes extraídas de Excel y fotos de producto)
app.mount("/static/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
