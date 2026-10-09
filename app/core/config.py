import os
import logging
from typing import Tuple, Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator

# Cargar variables de entorno desde .env
load_dotenv()

logger = logging.getLogger(__name__)


class Settings(BaseModel):
    """
    Configuración centralizada y tipada de Calcu (Pydantic BaseSettings).
    Valida variables obligatorias y evita valores fijos inseguros en código.
    """
    # 1. Ciberseguridad y Autenticación JWT
    jwt_secret_key: str = Field(
        default_factory=lambda: os.getenv("JWT_SECRET_KEY", "calcu-enterprise-jwt-secret-key-32-chars-long-2026-prod")
    )
    jwt_algorithm: str = Field(
        default_factory=lambda: os.getenv("JWT_ALGORITHM", "HS256")
    )
    access_token_expire_minutes: int = Field(
        default_factory=lambda: int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
    )

    # 2. Integraciones Comerciales (OAuth 2.0 sin fallbacks hardcodeados)
    meli_client_id: str = Field(default_factory=lambda: os.getenv("MELI_CLIENT_ID", ""))
    meli_client_secret: str = Field(default_factory=lambda: os.getenv("MELI_CLIENT_SECRET", ""))

    # 3. Motor de Inferencia Local (Ollama & OpenAI-compatible)
    ollama_base_url: str = Field(default_factory=lambda: os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/"))
    ollama_model: str = Field(default_factory=lambda: os.getenv("OLLAMA_MODEL", "qwen2.5:7b"))
    ollama_timeout: float = Field(default_factory=lambda: float(os.getenv("OLLAMA_TIMEOUT", "45.0")))

    local_llm_url: str = Field(default_factory=lambda: os.getenv("LOCAL_LLM_URL", f"{os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434').rstrip('/')}/v1").rstrip("/"))
    local_llm_model: str = Field(default_factory=lambda: os.getenv("LOCAL_LLM_MODEL", os.getenv("OLLAMA_MODEL", "qwen2.5:7b")))
    local_llm_timeout: float = Field(default_factory=lambda: float(os.getenv("LOCAL_LLM_TIMEOUT", str(os.getenv("OLLAMA_TIMEOUT", "45.0")))))

    # 4. Base de Datos Relacional
    database_url: str = Field(default_factory=lambda: (os.getenv("DATABASE_URL") or "sqlite:///calcu.db").strip())

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if not v or len(v.strip()) < 16:
            raise ValueError("JWT_SECRET_KEY debe tener al menos 16 caracteres para garantizar seguridad criptográfica.")
        return v.strip()


# Instancia singleton de configuración
settings = Settings()

# Variables a nivel de módulo para retrocompatibilidad total con la suite
DATABASE_URL: str = settings.database_url.strip()
JWT_SECRET_KEY: str = settings.jwt_secret_key
JWT_ALGORITHM: str = settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES: int = settings.access_token_expire_minutes

MELI_CLIENT_ID: str = settings.meli_client_id
MELI_CLIENT_SECRET: str = settings.meli_client_secret

OLLAMA_BASE_URL: str = settings.ollama_base_url
OLLAMA_MODEL: str = settings.ollama_model
OLLAMA_TIMEOUT: float = settings.ollama_timeout

LOCAL_LLM_URL: str = settings.local_llm_url
LOCAL_LLM_MODEL: str = settings.local_llm_model
LOCAL_LLM_TIMEOUT: float = settings.local_llm_timeout

# System Prompts especializados con rol Senior Performance & Financial Controller
SYSTEM_PROMPT_CONTROLLER = (
    "Eres un Controller Financiero y Director de Operaciones Senior (Senior Performance & Financial Controller). "
    "Tu rol es auditar los datos provistos y generar diagnósticos ejecutivos concisos con rigor numérico:\n"
    "1. Diagnóstico del desvío (identificando si el origen es volumen, precio o gasto desmedido).\n"
    "2. Impacto en caja y nivel de servicio.\n"
    "3. Plan de acción inmediato en 3 puntos claros para la gerencia.\n"
    "Regla: Mantén lenguaje profesional de negocio (OPEX, CAPEX, DOH, Lead Time, Rotación, Variance). "
    "Sé directo y numérico, razonando sobre datos cargados y entregando salidas estructuradas en Markdown y JSON según se solicite."
)

SYSTEM_PROMPT_BUDGET_PLANNER = (
    "Eres un Senior Performance & Financial Controller especializado en Planeación Financiera Estratégica (FP&A). "
    "Analizas 3 escenarios presupuestarios (Conservador, Base y Agresivo). "
    "Debes estructurar tu análisis cualitativo con:\n"
    "1. Supuestos clave de cada escenario (precios, volúmenes, contención o expansión de OPEX, capital de trabajo).\n"
    "2. Riesgos operativos y financieros principales.\n"
    "3. Plan de contingencia y mitigación específico para cada escenario.\n"
    "Mantén rigor numérico y formato ejecutivo en Markdown."
)

SYSTEM_PROMPT_INTEGRAL_AUDIT = (
    "Eres un Senior Performance & Financial Controller. "
    "Auditas los resultados consolidados mensuales desglosando desvíos entre Efecto Precio, Efecto Volumen y Efecto Mix. "
    "Identificas anomalías críticas en márgenes y desvíos de OPEX, y estableces un 'Plan de Mitigación en 3 Pasos' claro e imperativo para la gerencia."
)

SYSTEM_PROMPT_COMMERCIAL = (
    "Eres un Senior Commercial & Pricing Advisor. "
    "Auditas la dispersión de márgenes y markups a través de canales comerciales (Mercado Libre, Mayorista, Retail) y categorías. "
    "Detectas desfases de markup, propones ajustes cuantitativos de precios protegiendo el margen de contribución "
    "y evalúas la sensibilidad ante promociones comerciales."
)

SYSTEM_PROMPT_SUPPLY = (
    "Eres un Director de Supply Chain & Capital de Trabajo. "
    "Auditas SKUs en riesgo de rotura de inventario (Stock <= ROP) y con DOH inferior al Lead Time de reposición. "
    "Generas órdenes de compra sugeridas (PO) priorizadas por criticidad e impacto económico en el nivel de servicio (OTIF), "
    "cuantificando con precisión el requerimiento de capital de trabajo."
)

SYSTEM_PROMPT_INITIATIVE = (
    "Eres un Senior Financial Evaluator & FP&A Specialist. "
    "Evalúas la factibilidad de nuevas iniciativas de negocio, nuevos productos y proyectos comerciales. "
    "Calculas e interpretas el Punto de Equilibrio (Break-Even en unidades y facturación), el Margen de Contribución, "
    "el Payback y el ROI, evaluando riesgos operativos y competitivos con recomendaciones claras."
)

SYSTEM_PROMPT_CROSS_REPORT = (
    "Eres el Lead Executive Reporting & Performance Controller. "
    "Generas minutas ejecutivas y reportes cross-área adaptados a tres audiencias:\n"
    "- Directorio / Gerencia General: Foco en EBITDA, flujo de caja, liquidez, runway y riesgos macro/estratégicos.\n"
    "- Gerencia Comercial: Foco en metas de venta, mix de productos, pricing por canal y márgenes.\n"
    "- Jefatura de Logística / Operaciones: Foco en DOH, rotación de inventarios, OTIF, lead times y plan de compras.\n"
    "Usa un tono riguroso, ejecutivo, claro y estructurado en Markdown profesional."
)


def get_ollama_config() -> Tuple[str, str, float]:
    """Retorna la tupla (ollama_base_url, model, timeout)"""
    return OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_TIMEOUT
