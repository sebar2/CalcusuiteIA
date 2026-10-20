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
from app.api.v1.logistics import router as logistics_router, seed_logistics_demo
from app.api.v1.security import router as security_router
from app.api.v1.invoices import router as invoices_router
from app.api.v1.accounting import router as accounting_router
from app.api.v1.monitoring import router as monitoring_router
from app.api.v1.leads import router as leads_router
from app.api.v1.integrations import router as integrations_router
from app.api.v1.omnichannel import router as omnichannel_router
from app.api.v1.tenants import router as tenants_router
from app.api.v1.digital_twin import router as digital_twin_router
from app.services.security_agent import security_agent
from starlette.middleware.gzip import GZipMiddleware

import os
from fastapi.staticfiles import StaticFiles

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "static", "uploads")
os.makedirs(os.path.join(UPLOAD_DIR, "products"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "omnichannel_media"), exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Inicializar BD y cargar datos semilla si corresponde
    init_db()
    db = SessionLocal()
    try:
        ETLService.seed_demo_data(db)
        seed_logistics_demo(db)
    finally:
        db.close()
    # Baseline ISO 27001: Ejecutar escaneo perimetral en arranque
    try:
        security_agent.run_perimeter_audit()
    except Exception:
        pass
    # Iniciar micro-servidor local de WhatsApp Web (Baileys) en 127.0.0.1:3010
    try:
        from app.services.whatsapp_bridge_supervisor import whatsapp_bridge_supervisor
        whatsapp_bridge_supervisor.ensure_bridge_running()
    except Exception:
        pass
    yield
    # Shutdown: Detener procesos hijos
    try:
        from app.services.whatsapp_bridge_supervisor import whatsapp_bridge_supervisor
        whatsapp_bridge_supervisor.stop_bridge()
    except Exception:
        pass

app = FastAPI(
    title="Calcu - SupplyFinance Core API",
    description="Motor de analítica financiera, pricing, abastecimiento y control de inventario",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Compresión dinámica Gzip/Brotli para reducción crítica de latencia en payloads grandes (>1KB)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Middleware CORS con soporte para Localhost, Tailscale VPN (100.x.y.z), Red LAN y Capacitor Mobile
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8501",
        "http://127.0.0.1:8501",
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
        "ionic://localhost",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|100\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|.*\.ts\.net)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError

import re

_ALLOWED_ORIGIN_REGEX = re.compile(r"^https?://(localhost|127\.0\.0\.1|100\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|.*\.ts\.net)(:\d+)?$")
_ALLOWED_EXACT_ORIGINS = {
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:8501", "http://127.0.0.1:8501",
    "http://localhost", "https://localhost",
    "capacitor://localhost", "ionic://localhost"
}

def get_cors_headers(request: Request) -> dict:
    origin = request.headers.get("origin")
    headers = {}
    if origin and (origin in _ALLOWED_EXACT_ORIGINS or _ALLOWED_ORIGIN_REGEX.match(origin)):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Methods"] = "*"
        headers["Access-Control-Allow-Headers"] = "*"
    return headers

# Controladores globales de excepciones con preservación de CORS
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        headers=get_cors_headers(request),
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
        headers=get_cors_headers(request),
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
        headers=get_cors_headers(request),
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
app.include_router(logistics_router)
app.include_router(security_router)
app.include_router(invoices_router, prefix="/api/v1")
app.include_router(accounting_router, prefix="/api/v1")
app.include_router(monitoring_router, prefix="/api/v1")
app.include_router(leads_router, prefix="/api/v1")
app.include_router(integrations_router)
app.include_router(omnichannel_router)
app.include_router(tenants_router)
app.include_router(digital_twin_router, prefix="/api/v1")


# Montar directorio estático de uploads (imágenes extraídas de Excel y fotos de producto)
app.mount("/static/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Montar web landing para previsualización local y acceso directo
DOCS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs")
if os.path.exists(DOCS_DIR):
    app.mount("/landing", StaticFiles(directory=DOCS_DIR, html=True), name="landing")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
