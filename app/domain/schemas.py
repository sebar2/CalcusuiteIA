import html
from enum import Enum
from decimal import Decimal
from datetime import date, datetime, timezone
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator

# --- Product Schemas ---
class ProductBase(BaseModel):
    sku: str
    nombre: str
    categoria: str
    costo_unitario: Decimal
    precio_venta: Decimal
    image_url: Optional[str] = None

class ProductCreate(ProductBase):
    doh_seguridad: Optional[int] = 15
    activo: Optional[bool] = True

class ProductUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    costo_unitario: Optional[Decimal] = None
    precio_venta: Optional[Decimal] = None
    image_url: Optional[str] = None
    doh_seguridad: Optional[int] = None
    activo: Optional[bool] = None

class ProductResponse(ProductBase):
    id: Optional[int] = None
    doh_seguridad: Optional[int] = 15
    activo: Optional[bool] = True
    model_config = ConfigDict(from_attributes=True)


# --- Client & Company Schemas ---
class ClientBase(BaseModel):
    nombre: str
    rut: Optional[str] = None
    logo_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    nombre: Optional[str] = None
    rut: Optional[str] = None
    logo_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class ClientDealItemSummary(BaseModel):
    id: Optional[str] = None
    deal_id: Optional[int] = None
    deal_code: Optional[str] = None
    deal_title: Optional[str] = None
    proyecto_nombre: Optional[str] = None
    monto_total: Decimal = Decimal('0.00')
    probabilidad_pct: Optional[int] = 50
    etapa: str = "prospeccion"
    moneda: str = "USD"
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True, extra="allow")

class ClientResponse(ClientBase):
    id: int
    deals_count: int = 0
    total_pipeline: Decimal = Decimal('0.00')
    pipeline_activo: Optional[float] = 0.0
    pipeline_total: Optional[float] = 0.0
    deals: List[ClientDealItemSummary] = []
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# --- Supplier Schemas ---
class SupplierBase(BaseModel):
    nombre: str
    rut: Optional[str] = None
    logo_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    nombre: Optional[str] = None
    rut: Optional[str] = None
    logo_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class SupplierProductItem(BaseModel):
    product_id: Optional[int] = None
    sku: str
    nombre: str
    categoria: Optional[str] = "General"
    costo_unitario: Decimal = Decimal('0.00')
    lead_time_dias: Decimal = Decimal('30.0')
    image_url: Optional[str] = None
    imagen_url: Optional[str] = None

class SupplierResponse(SupplierBase):
    id: int
    lead_time_promedio: Decimal = Decimal('30.0')
    skus_count: int = 0
    total_skus: int = 0
    productos: List[SupplierProductItem] = []
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# --- Inventory Schemas ---
class InventoryBase(BaseModel):
    product_sku: str
    deposito_central: int = Field(default=0, ge=0)
    transito_maritimo: int = Field(default=0, ge=0)
    aduana: int = Field(default=0, ge=0)
    stock_seguridad: int = Field(default=0, ge=0)
    lead_time_dias: Decimal = Field(default=Decimal('0'), ge=0)
    demanda_diaria_promedio: Decimal = Field(default=Decimal('0'), ge=0)

class InventoryCreate(InventoryBase):
    pass

class InventoryResponse(InventoryBase):
    id: int
    stock_actual: int
    model_config = ConfigDict(from_attributes=True)

class InventoryAlert(BaseModel):
    sku: str
    nombre: str
    categoria: str
    stock_actual: int
    rop: Decimal
    doh: Decimal
    is_alert: bool
    stock_seguridad: int
    lead_time_dias: Decimal
    deposito_central: int = 0
    transito_maritimo: int = 0
    aduana: int = 0
    costo_unitario: Optional[Decimal] = None
    demanda_diaria_promedio: Optional[Decimal] = None
    image_url: Optional[str] = None
    stock_comprometido_pipeline: int = 0
    stock_disponible_neto: int = 0
    model_config = ConfigDict(from_attributes=True, extra="allow")


class InventoryQuickUpdateRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="allow")
    stock_actual: Optional[int] = Field(None, ge=0)
    deposito_central: Optional[int] = Field(None, ge=0)
    transito_maritimo: Optional[int] = Field(None, ge=0)
    aduana: Optional[int] = Field(None, ge=0)
    costo_unitario: Optional[Decimal] = Field(None, ge=0)
    lead_time_dias: Optional[Decimal] = Field(None, ge=0)
    stock_seguridad: Optional[int] = Field(None, ge=0)
    demanda_diaria_promedio: Optional[Decimal] = Field(None, ge=0)
    image_url: Optional[str] = None


class InventoryQuickUpdateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="allow")
    status: str = "success"
    message: str
    item: InventoryAlert


# --- Sale Schemas ---
class SaleBase(BaseModel):
    transaction_id: str
    product_sku: str
    cantidad: int = Field(gt=0)
    precio_unitario: Decimal
    costo_unitario: Decimal
    comision_pct: Decimal = Field(default=Decimal('0'))
    flete_unitario: Decimal = Field(default=Decimal('0'))
    fecha: date

class SaleCreate(SaleBase):
    pass

class SaleResponse(SaleBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# --- Budget Schemas ---
class BudgetBase(BaseModel):
    periodo: str
    product_sku: Optional[str] = None
    categoria: Optional[str] = None
    monto_presupuestado: Decimal
    monto_real: Decimal = Decimal('0')
    tipo: str = "VENTAS"

class BudgetCreate(BudgetBase):
    pass

class BudgetResponse(BudgetBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class BudgetVarianceReport(BaseModel):
    id: int
    periodo: str
    categoria: Optional[str] = None
    tipo: str
    monto_presupuestado: Decimal
    monto_real: Decimal
    variacion_absoluta: Decimal
    variacion_porcentual: Decimal
    status: str  # Green, Yellow, Red


class AvailablePeriodsResponse(BaseModel):
    periods: List[str]
    default_period: str


class BudgetSeedResponse(BaseModel):
    status: str
    periodo: str
    records_seeded: int
    total_budgeted: Decimal
    message: str


# --- Pricing & Simulation Schemas ---
class MarginSummary(BaseModel):
    sku: str
    nombre: str
    categoria: str
    precio_venta: Decimal
    costo_unitario: Decimal
    gross_margin_pct: Decimal
    markup_pct: Decimal
    unit_contribution_margin: Decimal
    marginal_ratio: Decimal

class DiscountSimulationRequest(BaseModel):
    sku: Optional[str] = None
    base_price: Optional[Decimal] = Field(default=None, gt=0)
    cost: Optional[Decimal] = Field(default=None, ge=0)
    discount_pct: Decimal = Field(ge=0, le=1)
    commission_pct: Decimal = Field(default=Decimal('0'), ge=0, le=1)
    freight: Decimal = Field(default=Decimal('0'), ge=0)
    channel: Optional[str] = "General"

class DiscountSimulationResponse(BaseModel):
    base_price: Decimal
    discount_pct: Decimal
    discounted_price: Decimal
    effective_price: Optional[Decimal] = None
    cost: Decimal
    channel: Optional[str] = "General"
    gross_margin: Decimal
    gross_margin_pct: Optional[Decimal] = None
    markup: Optional[Decimal] = None
    markup_pct: Optional[Decimal] = None
    unit_contribution_margin: Decimal
    marginal_ratio: Decimal
    is_negative_margin: bool
    below_threshold_15pct: bool = False
    is_viable: bool = True


# --- ETL Schemas ---
class ETLUploadResponse(BaseModel):
    status: str
    records_processed: int
    errors: List[str] = []
    message: str


# --- AI Advisor Schemas ---
class VarianceLineItem(BaseModel):
    id: Optional[int] = None
    item: Optional[str] = None
    categoria: Optional[str] = None
    tipo: str = "VENTAS"
    periodo: Optional[str] = None
    monto_presupuestado: Decimal
    monto_real: Decimal
    variacion_absoluta: Optional[Decimal] = None
    variacion_porcentual: Optional[Decimal] = None
    status: Optional[str] = None


class VarianceInsightRequest(BaseModel):
    periodo: Optional[str] = None
    lines: List[VarianceLineItem] = Field(default_factory=list)
    total_presupuestado: Optional[Decimal] = None
    total_real: Optional[Decimal] = None
    notes: Optional[str] = None
    engine_mode: Optional[str] = Field(default="auto", description="Modo de ejecución: 'force_llm', 'heuristic', 'auto'")


class InventorySkuItem(BaseModel):
    sku: str
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    stock_actual: int
    rop: Decimal
    doh: Decimal
    is_alert: bool = False
    stock_seguridad: Optional[int] = 0
    lead_time_dias: Decimal = Field(default=Decimal('0'))
    demanda_diaria_promedio: Optional[Decimal] = Field(default=Decimal('0'))
    deposito_central: Optional[int] = 0
    transito_maritimo: Optional[int] = 0
    aduana: Optional[int] = 0


class InventoryInsightRequest(BaseModel):
    items: List[InventorySkuItem] = Field(default_factory=list)
    categoria_filter: Optional[str] = None
    only_alerts: Optional[bool] = False
    notes: Optional[str] = None
    engine_mode: Optional[str] = Field(default="auto", description="Modo de ejecución: 'force_llm', 'heuristic', 'auto'")


class AdvisorInsightResponse(BaseModel):
    provider: str = Field(description="Identificador del proveedor: 'local_llm' o 'deterministic_heuristic'")
    model: Optional[str] = Field(default=None, description="Nombre del modelo o heurística utilizada")
    status: str = Field(default="success", description="Estado de la inferencia: 'success', 'fallback' o 'error'")
    latency_ms: float = Field(default=0.0, description="Tiempo de respuesta en milisegundos")
    diagnosis: str = Field(description="Diagnóstico ejecutivo del desvío (volumen, precio o gasto)")
    cash_service_impact: str = Field(description="Evaluación de impacto en caja y nivel de servicio")
    action_plan: List[str] = Field(description="Plan de acción inmediato en 3 puntos ejecutivos para la gerencia")
    critical_items: List[str] = Field(default_factory=list, description="Lista de SKUs o líneas críticas detectadas")
    raw_markdown: str = Field(description="Texto completo en Markdown formateado para presentación ejecutiva")
    metrics_summary: dict = Field(default_factory=dict, description="Resumen cuantitativo de métricas calculadas")

    model_config = ConfigDict(from_attributes=True)


# --- 3-Scenario Budget Planning Schemas ---
class BudgetScenarioCostCenterItem(BaseModel):
    centro_costo_id: int
    nombre: str
    monto_sugerido: Decimal
    justificacion: str

    model_config = ConfigDict(from_attributes=True)


class BudgetScenarioPlanAccion(BaseModel):
    compras_abastecimiento: str = ""
    politica_pricing: str = ""
    logistica_inventario: str = ""

    model_config = ConfigDict(from_attributes=True)


class BudgetScenarioRiskItem(BaseModel):
    riesgo: str
    mitigacion: str

    model_config = ConfigDict(from_attributes=True)


class BudgetScenarioItem(BaseModel):
    name: str
    focus: str
    sales_growth_pct: Decimal = Decimal('0.00')
    cogs_growth_pct: Decimal = Decimal('0.00')
    opex_growth_pct: Decimal = Decimal('0.00')
    projected_sales: Decimal
    projected_cogs: Decimal
    gross_margin: Decimal = Decimal('0.00')
    gross_margin_pct: Decimal
    projected_opex: Decimal
    contribution_margin: Decimal
    contribution_margin_pct: Decimal = Decimal('0.00')
    delta_cm_vs_historical: Decimal = Decimal('0.00')
    doh_objetivo: int = 45
    plan_accion: Dict[str, str] = Field(default_factory=dict)
    desglose_centros_costo: List[Dict[str, Any]] = Field(default_factory=list)
    riesgos_mitigacion: List[Dict[str, str]] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class BudgetScenarioRequest(BaseModel):
    periodo: Optional[str] = None
    target_period: Optional[str] = None
    historical_sales: Optional[Decimal] = None
    historical_cogs: Optional[Decimal] = None
    historical_opex: Optional[Decimal] = None
    engine_mode: Optional[str] = Field(default="auto", description="Modo de ejecución: 'force_llm', 'heuristic', 'auto'")


class BudgetScenarioResponse(BaseModel):
    provider: str
    model: Optional[str] = None
    status: str = "success"
    latency_ms: float = 0.0
    periodo_objetivo: Optional[str] = None
    historical: dict
    conservative: BudgetScenarioItem
    base: BudgetScenarioItem
    aggressive: BudgetScenarioItem
    scenarios: Optional[Dict[str, Any]] = None
    escenarios: Optional[Dict[str, Any]] = None
    ai_analysis: dict = Field(default_factory=dict)
    analisis_ia: Optional[dict] = Field(default_factory=dict)
    raw_markdown: str

    model_config = ConfigDict(from_attributes=True)


# --- Apply Budget Scenario (Adopción de Presupuesto Oficial) ---
class ApplyScenarioPartida(BaseModel):
    centro_costo_id: int
    monto_presupuestado: Decimal
    concepto_opex: str = "Gasto Operativo Sugerido IA"


class ApplyScenarioRequest(BaseModel):
    periodo: str
    scenario_name: str = "base"
    partidas: List[ApplyScenarioPartida] = Field(default_factory=list)


class ApplyScenarioResponse(BaseModel):
    status: str = "success"
    periodo: str
    partidas_actualizadas: int
    message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- Copilot 1: Integral Audit Schemas ---
class IntegralAuditRequest(BaseModel):
    periodo: Optional[str] = None
    lines: List[VarianceLineItem] = Field(default_factory=list)
    engine_mode: Optional[str] = Field(default="auto", description="Modo de ejecución: 'force_llm', 'heuristic', 'auto'")


class IntegralAuditResponse(BaseModel):
    provider: str
    model: Optional[str] = None
    status: str = "success"
    latency_ms: float = 0.0
    price_effect: Decimal
    volume_effect: Decimal
    mix_effect: Decimal
    total_variance: Decimal
    critical_anomalies: List[str] = Field(default_factory=list)
    mitigation_plan_3_steps: List[str] = Field(default_factory=list)
    raw_markdown: str
    metrics_summary: dict = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


# --- Copilot 2: Commercial & Pricing Schemas ---
class ChannelMarginItem(BaseModel):
    channel: str
    categoria: Optional[str] = "General"
    sales: Decimal
    cost: Decimal
    commission_pct: Decimal = Decimal('0')
    freight: Decimal = Decimal('0')
    gross_margin_pct: Decimal
    markup_pct: Decimal
    contribution_margin: Decimal
    status: str
    suggested_action: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CommercialOptimizerRequest(BaseModel):
    channels: List[ChannelMarginItem] = Field(default_factory=list)
    promo_simulation: Optional[DiscountSimulationRequest] = None
    engine_mode: Optional[str] = Field(default="auto", description="Modo de ejecución: 'force_llm', 'heuristic', 'auto'")


class CommercialOptimizerResponse(BaseModel):
    provider: str
    model: Optional[str] = None
    status: str = "success"
    latency_ms: float = 0.0
    channel_analysis: List[ChannelMarginItem]
    price_adjustments_suggested: List[dict] = Field(default_factory=list)
    promo_evaluation: Optional[dict] = None
    raw_markdown: str
    executive_summary: str

    model_config = ConfigDict(from_attributes=True)


# --- Copilot 3: Supply Action Plan Schemas ---
class SuggestedPOItem(BaseModel):
    sku: str
    nombre: Optional[str] = None
    stock_actual: int
    rop: Decimal
    doh: Decimal
    lead_time_dias: Decimal
    suggested_quantity: int
    unit_cost: Decimal
    working_capital_required: Decimal
    priority: str
    economic_impact_risk: Decimal

    model_config = ConfigDict(from_attributes=True)


class SupplyActionPlanRequest(BaseModel):
    items: List[InventorySkuItem] = Field(default_factory=list)
    target_doh: Decimal = Decimal('45.0')
    engine_mode: Optional[str] = Field(default="auto", description="Modo de ejecución: 'force_llm', 'heuristic', 'auto'")


class SupplyActionPlanResponse(BaseModel):
    provider: str
    model: Optional[str] = None
    status: str = "success"
    latency_ms: float = 0.0
    total_skus_evaluated: int
    critical_skus_count: int
    total_working_capital_required: Decimal
    suggested_purchase_orders: List[SuggestedPOItem] = Field(default_factory=list)
    action_plan_3_steps: List[str] = Field(default_factory=list)
    raw_markdown: str

    model_config = ConfigDict(from_attributes=True)


# --- Copilot 4: Business Initiative Schemas ---
class InitiativeEvaluationRequest(BaseModel):
    initiative_name: str = "Nueva Iniciativa"
    initial_investment: Decimal = Field(..., ge=0)
    estimated_unit_cost: Decimal = Field(..., ge=0)
    estimated_unit_price: Decimal = Field(..., gt=0)
    expected_demand: int = Field(..., gt=0)
    fixed_costs: Decimal = Field(default=Decimal('0'), ge=0)
    competitors_notes: Optional[str] = None
    engine_mode: Optional[str] = Field(default="auto", description="Modo de ejecución: 'force_llm', 'heuristic', 'auto'")


class InitiativeEvaluationResponse(BaseModel):
    provider: str
    model: Optional[str] = None
    status: str = "success"
    latency_ms: float = 0.0
    initiative_name: str
    initial_investment: Decimal
    unit_contribution_margin: Decimal
    marginal_ratio: Decimal
    total_contribution_margin: Decimal
    break_even_units: int
    break_even_revenue: Decimal
    payback_cycles: Decimal
    roi_pct: Decimal
    viability: str
    risk_assessment: str
    raw_markdown: str

class OllamaStatusResponse(BaseModel):
    online: bool
    url: str
    models: List[str] = Field(default_factory=list)
    target_model: str
    target_model_available: bool
    message: str


# --- Benchmarking DB + Web Schemas ---
class InternalDBBenchmark(BaseModel):
    categoria: Optional[str] = None
    sku_count: int = 0
    avg_price: Decimal = Decimal('0')
    avg_cost: Decimal = Decimal('0')
    avg_margin_pct: Decimal = Decimal('0')
    avg_doh: Decimal = Decimal('0')
    sample_skus: List[str] = Field(default_factory=list)


class MarketWebReference(BaseModel):
    source: str
    title: str
    price: Optional[Decimal] = None
    original_price: Optional[Decimal] = None
    original_currency: Optional[str] = None
    seller: Optional[str] = None
    snippet: Optional[str] = None
    link: Optional[str] = None


class InitiativeBenchmarkRequest(BaseModel):
    product_name: str
    category: Optional[str] = None
    proposed_price: Decimal = Field(..., gt=0)
    proposed_cost: Decimal = Field(..., gt=0)
    expected_demand: int = Field(..., gt=0)
    initial_investment: Decimal = Field(default=Decimal('0'), ge=0)
    search_query: Optional[str] = None
    platform: Optional[str] = Field(default="hybrid", description="'mercadolibre' | 'google' | 'hybrid'")
    country: Optional[str] = Field(default="Uruguay", description="'Uruguay' | 'Argentina' | 'Chile' | 'Brasil'")
    department: Optional[str] = Field(default=None, description="Departamento o Provincia regional")
    engine_mode: Optional[str] = Field(default="auto", description="Modo: 'force_llm', 'heuristic', 'auto'")


class InitiativeBenchmarkResponse(BaseModel):
    provider: str
    model: Optional[str] = None
    latency_ms: float = 0.0
    product_name: str
    proposed_price: Decimal
    proposed_cost: Decimal
    proposed_margin_pct: Decimal
    internal_db: InternalDBBenchmark
    market_references: List[MarketWebReference] = Field(default_factory=list)
    market_avg_price: Optional[Decimal] = None
    price_competitiveness_pct: Decimal = Decimal('0') # % diferencia contra mercado
    break_even_units: int = 0
    payback_cycles: Decimal = Decimal('0')
    strategic_assessment: str
    raw_markdown: str

    model_config = ConfigDict(from_attributes=True)


# --- Copilot 5: Cross-Area Report Schemas ---
class CrossReportRequest(BaseModel):
    audience: str = Field(default="Directorio / Gerencia General", description="Directorio / Gerencia General | Gerencia Comercial | Jefatura de Logística / Operaciones")
    periodo: Optional[str] = None
    extra_context: Optional[str] = None
    engine_mode: Optional[str] = Field(default="auto", description="Modo de ejecución: 'force_llm', 'heuristic', 'auto'")


class CrossReportResponse(BaseModel):
    provider: str
    model: Optional[str] = None
    status: str = "success"
    latency_ms: float = 0.0
    audience: str
    key_metrics: dict = Field(default_factory=dict)
    executive_summary: str
    raw_markdown: str

    model_config = ConfigDict(from_attributes=True)


# --- User Preferences Schemas ---
class UserPreferenceBase(BaseModel):
    user_id: str = "default_user"
    active_theme: str = "light_bitrix"
    default_engine_mode: str = "auto" # 'force_llm', 'heuristic', 'auto'
    saved_filters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    visible_columns: Optional[List[str]] = Field(default_factory=list)
    last_view: str = "control_room"


class UserPreferenceCreate(UserPreferenceBase):
    pass


class UserPreferenceUpdate(BaseModel):
    user_id: Optional[str] = "default_user"
    active_theme: Optional[str] = None
    default_engine_mode: Optional[str] = None
    saved_filters: Optional[Dict[str, Any]] = None
    visible_columns: Optional[List[str]] = None
    last_view: Optional[str] = None


class UserPreferenceResponse(BaseModel):
    id: int
    user_id: str
    active_theme: str
    default_engine_mode: str = "auto"
    saved_filters: Optional[Dict[str, Any]] = None
    visible_columns: Optional[List[str]] = None
    last_view: str
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Multilevel Variance Analysis Schemas ---
class MultilevelVarianceLineItem(BaseModel):
    categoria: str
    sku: Optional[str] = None
    nombre: str
    budgeted_amount: Decimal
    actual_amount: Decimal
    variance_amount: Decimal
    variance_pct: Decimal
    price_variance: Decimal
    volume_variance: Decimal
    mix_variance: Decimal
    status: str
    requires_mitigation: bool

    model_config = ConfigDict(from_attributes=True)


class MultilevelVarianceResponse(BaseModel):
    total_budget: Decimal
    total_actual: Decimal
    net_variance: Decimal
    net_variance_pct: Decimal
    total_price_variance: Decimal
    total_volume_variance: Decimal
    total_mix_variance: Decimal
    requires_mitigation: bool
    mitigation_plan_3_steps: List[str] = Field(default_factory=list)
    lines: List[MultilevelVarianceLineItem]

    model_config = ConfigDict(from_attributes=True)


# --- Pipeline Kanban de Reposición Schemas ---
class SupplyOrderBase(BaseModel):
    sku_id: str
    cantidad: int = Field(gt=0)
    monto_total: Decimal = Field(gt=0)
    proveedor: str
    etapa: str = "sugerido"
    responsable: str
    fecha_arribo_estimada: date


class SupplyOrderCreate(SupplyOrderBase):
    pass


class SupplyOrderStageUpdate(BaseModel):
    target_stage: str


class SupplyOrderUpdate(BaseModel):
    sku_id: Optional[str] = None
    cantidad: Optional[int] = Field(default=None, gt=0)
    monto_total: Optional[Decimal] = Field(default=None, gt=0)
    proveedor: Optional[str] = None
    etapa: Optional[str] = None
    responsable: Optional[str] = None
    fecha_arribo_estimada: Optional[date] = None


class SupplyOrderResponse(SupplyOrderBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SupplyKanbanStage(BaseModel):
    id: str
    name: str
    color_hex: str
    total_capital: Decimal
    order_count: int
    orders: List[SupplyOrderResponse]


class SupplyKanbanResponse(BaseModel):
    stages: List[SupplyKanbanStage]
    total_pipeline_capital: Decimal


# --- Acciones y Compromisos Cross-Área Schemas ---
class AccionCompromisoCreate(BaseModel):
    titulo: str
    area: str
    responsable: str
    fecha_limite: date
    estado: str = "Pendiente"
    origen: str = "Minuta Ejecutiva"


class AccionCompromisoBatchCreate(BaseModel):
    acciones: List[AccionCompromisoCreate]


class AccionCompromisoResponse(BaseModel):
    id: int
    titulo: str
    area: str
    responsable: str
    fecha_limite: date
    estado: str
    origen: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Audit Logs Schemas ---
class AuditLogResponse(BaseModel):
    id: int
    user_id: str
    role: str
    action: str
    resource: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Benchmarking de Mercado en 3 Fases Schemas ---
class CompetitorItemResponse(BaseModel):
    id: str
    titulo: str
    vendedor: str
    canal: str
    precio_original: Optional[Decimal] = None
    precio_uyu: Optional[Decimal] = None
    moneda: str = "USD"
    precio_usd: Decimal
    ubicacion: str = ""
    url: str = ""


class BROUExchangeRateResponse(BaseModel):
    source: str = "BROU (Banco de la República Oriental del Uruguay)"
    currency_pair: str = "USD/UYU"
    buy: float
    sell: float
    rate_used: float
    updated_at: str


class CompetitorSearchRequest(BaseModel):
    model_config = ConfigDict(extra="allow", from_attributes=True, arbitrary_types_allowed=True)

    query: Optional[str] = ""
    product_name: Optional[str] = ""
    category: Optional[str] = "General"
    target_price: Optional[float] = 0.0
    price: Optional[float] = 0.0
    country: Optional[str] = "Uruguay"
    region: Optional[str] = "all"
    platform: Optional[str] = "google"
    # Moneda seleccionada por el usuario (USD o UYU)
    target_currency: Optional[str] = "USD"
    # Campos adicionales de retrocompatibilidad
    search_query: Optional[str] = ""
    proposed_price: Optional[float] = 0.0
    department: Optional[str] = None


class CompetitorSearchResponse(BaseModel):
    model_config = ConfigDict(extra="allow", from_attributes=True)

    status: str = "success"
    competitors: List[CompetitorItemResponse] = []
    total_empresas: int = 0
    message: Optional[str] = None
    target_currency: Optional[str] = "USD"
    exchange_rate_used: Optional[float] = None
    exchange_rate_source: Optional[str] = None



class CapexBreakdown(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="allow")
    maquinaria_equipos: float = 0.0
    adecuacion_local: float = 0.0
    marketing_lanzamiento: float = 0.0
    habilitaciones_marcas: float = 0.0
    otros_capex: float = 0.0


class OpexBreakdown(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="allow")
    sueldos_personal: float = 0.0
    alquiler_deposito: float = 0.0
    publicidad_mensual: float = 0.0
    seguros_servicios: float = 0.0
    otros_opex: float = 0.0


class BusinessCaseRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="allow")
    initiative_id: Optional[str] = None
    product_name: Optional[str] = None
    category: Optional[str] = None
    currency: str = "UYU"
    target_currency: Optional[str] = None
    proposed_price: float = Field(..., gt=0)
    direct_cost: float = Field(default=0.0, ge=0)
    proposed_cost: Optional[float] = None
    monthly_demand: int = Field(default=1, gt=0)
    expected_demand: Optional[int] = None
    capex_investment: float = Field(default=0.0, ge=0)
    initial_investment: Optional[float] = None
    monthly_opex: float = Field(default=0.0, ge=0)
    capex_details: Optional[CapexBreakdown] = None
    capex_breakdown: Optional[CapexBreakdown] = None
    opex_details: Optional[OpexBreakdown] = None
    opex_breakdown: Optional[OpexBreakdown] = None
    competitor_ids: Optional[list] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # direct_cost fallback
            if "direct_cost" not in data or data.get("direct_cost") is None:
                if "proposed_cost" in data and data.get("proposed_cost") is not None:
                    data["direct_cost"] = data["proposed_cost"]
            # monthly_demand fallback
            if "monthly_demand" not in data or data.get("monthly_demand") is None:
                if "expected_demand" in data and data.get("expected_demand") is not None:
                    data["monthly_demand"] = data["expected_demand"]
            # capex_investment fallback
            if "capex_investment" not in data or data.get("capex_investment") is None:
                if "initial_investment" in data and data.get("initial_investment") is not None:
                    data["capex_investment"] = data["initial_investment"]
            # currency fallback
            if "currency" not in data or not data.get("currency"):
                if "target_currency" in data and data.get("target_currency"):
                    data["currency"] = data["target_currency"]
            # capex_details fallback
            if "capex_details" not in data or data.get("capex_details") is None:
                if "capex_breakdown" in data and data.get("capex_breakdown") is not None:
                    data["capex_details"] = data["capex_breakdown"]
            # opex_details fallback
            if "opex_details" not in data or data.get("opex_details") is None:
                if "opex_breakdown" in data and data.get("opex_breakdown") is not None:
                    data["opex_details"] = data["opex_breakdown"]
        return data


class CompetitorSelectionEvaluationRequest(BaseModel):
    model_config = ConfigDict(extra="allow", from_attributes=True)

    product_name: str
    category: Optional[str] = None
    target_currency: Optional[str] = "USD"
    currency: Optional[str] = None
    proposed_price: Decimal = Field(gt=0)
    proposed_cost: Decimal = Field(ge=0)
    direct_cost: Optional[Decimal] = None
    expected_demand: int = Field(gt=0)
    monthly_demand: Optional[int] = None
    initial_investment: Decimal = Field(default=Decimal("0.0"), ge=0)
    capex_investment: Optional[Decimal] = None
    monthly_opex: Decimal = Field(default=Decimal("0.0"), ge=0)
    capex_details: Optional[CapexBreakdown] = None
    opex_details: Optional[OpexBreakdown] = None
    selected_competitors: Optional[List[CompetitorItemResponse]] = None
    competitor_ids: Optional[list] = None
    engine_mode: Optional[str] = "auto"


class CompetitorSelectionEvaluationResponse(BaseModel):
    model_config = ConfigDict(extra="allow", from_attributes=True)

    provider: str
    model: Optional[str] = None
    latency_ms: float
    product_name: str
    proposed_price: Decimal
    proposed_cost: Decimal
    proposed_margin_pct: Decimal
    min_price: Decimal
    max_price: Decimal
    median_price: Decimal
    avg_price: Decimal
    price_competitiveness_pct: Decimal
    unit_contribution_margin: Decimal
    marginal_ratio: Decimal
    monthly_opex: Optional[Decimal] = Decimal("0.0")
    gross_margin_monthly: Optional[Decimal] = Decimal("0.0")
    net_operating_cashflow: Optional[Decimal] = Decimal("0.0")
    break_even_units: Optional[float] = None
    break_even_money: Optional[float] = None
    break_even_revenue: Optional[Decimal] = None
    break_even_coverage_pct: Optional[float] = None
    payback_cycles: Optional[float] = None
    payback_months: Optional[float] = None
    payback_status: Optional[str] = None
    roi_pct: Decimal
    viability: str
    executive_assessment: str
    raw_markdown: str
    capex_details: Optional[CapexBreakdown] = None
    opex_details: Optional[OpexBreakdown] = None


# --- Presupuestos Flexibles: Carga Manual y Sugerencia IA Schemas ---
class BudgetManualItem(BaseModel):
    categoria_id: int
    monto_presupuestado: Decimal = Field(ge=0)
    unidades_presupuestadas: int = Field(ge=0)


class BudgetManualBatchRequest(BaseModel):
    periodo: str
    version: str = "V0"
    items: List[BudgetManualItem]


class BudgetManualBatchResponse(BaseModel):
    status: str
    periodo: str
    version: str
    records_saved: int
    total_budgeted: Decimal
    message: str


class BudgetCategorySuggestion(BaseModel):
    categoria_id: int
    categoria_nombre: str
    monto_sugerido: Decimal
    unidades_sugeridas: int
    crecimiento_pct: Decimal
    ventas_historicas: Decimal
    stock_actual: int
    avg_doh: Decimal
    justificacion: str


class BudgetAISuggestResponse(BaseModel):
    periodo: str
    total_sugerido: Decimal
    total_unidades: int
    suggestions: List[BudgetCategorySuggestion]
    analisis_resumen: str


class BudgetPeriodDeleteResponse(BaseModel):
    status: str
    periodo: str
    records_deleted: int
    message: str


# --- Categorías Dinámicas Schemas ---
class CategoryCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    margen_target_pct: Optional[float] = Field(default=30.0, ge=0.0, le=100.0)


class CategoryResponse(BaseModel):
    id: int
    nombre: str
    margen_target_pct: float
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Centros de Costo & Presupuestos OPEX (BCNF) ---
class AreaCreateRequest(BaseModel):
    codigo: str = Field(..., min_length=2, max_length=30)
    nombre: str = Field(..., min_length=2, max_length=100)
    descripcion: Optional[str] = None


class AreaUpdateRequest(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    descripcion: Optional[str] = None


class AreaSchema(BaseModel):
    id: int
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    centros_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class ResponsibleUserCreateRequest(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=100)
    cargo: str = Field(..., min_length=2, max_length=100)
    area_id: Optional[int] = None


class ResponsibleUserUpdateRequest(BaseModel):
    nombre: Optional[str] = None
    email: Optional[str] = None
    cargo: Optional[str] = None
    area_id: Optional[int] = None


class ResponsibleUserSchema(BaseModel):
    id: int
    nombre: str
    email: str
    cargo: str
    area_id: Optional[int] = None
    area_nombre: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class CostCenterBase(BaseModel):
    codigo: str = Field(..., min_length=2, max_length=30)
    nombre: str = Field(..., min_length=2, max_length=100)
    responsable: str = Field(default="No asignado", min_length=1, max_length=100)
    activo: bool = True
    area_id: Optional[int] = None
    responsable_id: Optional[int] = None


class CostCenterCreate(CostCenterBase):
    pass


class CostCenterResponse(CostCenterBase):
    id: int
    area_nombre: Optional[str] = None
    responsable_nombre: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class CostCenterExtended(BaseModel):
    id: str
    codigo: str
    nombre: str
    area_id: Optional[str] = None
    area_nombre: Optional[str] = None
    responsable_id: Optional[str] = None
    responsable_nombre: Optional[str] = None
    presupuesto_total: float = 0.0
    ejecutado_total: float = 0.0
    model_config = ConfigDict(from_attributes=True)


class CostCenterBudgetLine(BaseModel):
    id: Optional[int] = None
    periodo: str
    centro_costo_id: int
    centro_costo_codigo: Optional[str] = None
    centro_costo_nombre: Optional[str] = None
    concepto_opex: str
    monto_presupuestado: float = Field(default=0.0, ge=0)
    monto_real: float = Field(default=0.0, ge=0)
    variacion_monto: float = Field(default=0.0)
    variacion_pct: float = Field(default=0.0)
    estado: str  # "EN_PRESUPUESTO", "EXCESO_GASTO", "AHORRO"
    model_config = ConfigDict(from_attributes=True)


class CostCenterSummaryItem(BaseModel):
    centro_costo_id: int
    codigo: str
    nombre: str
    responsable: str
    area_id: Optional[int] = None
    area_nombre: Optional[str] = None
    responsable_id: Optional[int] = None
    responsable_nombre: Optional[str] = None
    total_presupuestado: float = Field(default=0.0, ge=0)
    total_real: float = Field(default=0.0, ge=0)
    variacion_neta: float = Field(default=0.0)
    variacion_pct: float = Field(default=0.0)
    estado: str
    partidas: List[CostCenterBudgetLine] = []
    model_config = ConfigDict(from_attributes=True)


class CostCenterBudgetReportResponse(BaseModel):
    periodo: str
    total_opex_presupuestado: float = Field(default=0.0, ge=0)
    total_opex_real: float = Field(default=0.0, ge=0)
    variacion_total: float = Field(default=0.0)
    variacion_total_pct: float = Field(default=0.0)
    centros_costo: List[CostCenterSummaryItem] = []
    model_config = ConfigDict(from_attributes=True)


class CostCenterBatchItem(BaseModel):
    centro_costo_id: int
    concepto_opex: str
    monto_presupuestado: float = Field(default=0.0, ge=0)
    monto_real: Optional[float] = Field(default=0.0, ge=0)


class CostCenterBatchRequest(BaseModel):
    periodo: str
    items: List[CostCenterBatchItem]


class CostCenterBatchResponse(BaseModel):
    status: str = "success"
    periodo: str
    records_saved: int
    total_opex_presupuestado: float
    message: str


class CostCenterBudgetCreate(BaseModel):
    centro_costo_id: int
    periodo: str = Field(..., description="Periodo contable (ej. 2025-09)")
    concepto_opex: str = Field(..., min_length=2, max_length=150)
    monto_presupuestado: Decimal = Field(default=Decimal('0.00'), ge=0)
    monto_real: Decimal = Field(default=Decimal('0.00'), ge=0)


class CostCenterBudgetUpdate(BaseModel):
    concepto_opex: Optional[str] = Field(None, min_length=2, max_length=150)
    monto_presupuestado: Optional[Decimal] = Field(None, ge=0)
    monto_real: Optional[Decimal] = Field(None, ge=0)
    periodo: Optional[str] = None
    centro_costo_id: Optional[int] = None


class CostCenterBudgetResponse(BaseModel):
    id: int
    periodo: str
    centro_costo_id: int
    centro_costo_codigo: Optional[str] = None
    centro_costo_nombre: Optional[str] = None
    concepto_opex: str
    monto_presupuestado: Decimal
    monto_real: Decimal
    model_config = ConfigDict(from_attributes=True)


class CostCenterTotalOpexResponse(BaseModel):
    periodo: str
    total_opex_presupuestado: float
    total_opex_real: float
    centros_contabilizados: int = 0
    partidas_contabilizadas: int = 0
    status: str = "success"


class CostCenterBudget(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nombre: str
    presupuesto_asignado: float = Field(default=0.0, ge=0)
    ejecutado: float = Field(default=0.0, ge=0)
    saldo_disponible: float = Field(default=0.0)
    variacion_neta: float = Field(default=0.0)
    periodo: Optional[str] = "2026-Q1"


class CostCentersGeneralBudgetResponse(BaseModel):
    periodo: str
    presupuesto_total: float = 0.0
    ejecutado_total: float = 0.0
    saldo_total: float = 0.0
    centros_costo: List[CostCenterBudget] = []
    status: str = "success"


# =====================================================================
# FUSIÓN LUMINAR -> CALCU: LICITACIONES & PROYECTOS B2B (ZERO-TRUST)
# =====================================================================

class TenderItemSecureSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sku: str = Field(..., max_length=50)
    cantidad_solicitada: int = Field(..., gt=0, le=100000)
    precio_objetivo_unitario: Optional[float] = Field(None, ge=0)

    @field_validator("sku")
    @classmethod
    def sanitize_sku(cls, v: str) -> str:
        return html.escape(v.strip().upper())


class TenderEvaluateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", from_attributes=True)

    proyecto_nombre: str = Field(..., min_length=2, max_length=200)
    cliente_licitacion: str = Field(..., min_length=2, max_length=150)
    nicho: str = Field(default="industria", max_length=50)
    plazo_entrega_dias: int = Field(default=30, gt=0, le=1000)
    fecha_requerida_entrega_dias: Optional[int] = Field(default=None, gt=0, le=1000)
    moneda: str = Field(default="USD", pattern="^(USD|UYU)$")
    margen_comercial_pct: Optional[float] = Field(default=0.35, ge=0.01, le=0.90)
    observaciones: Optional[str] = Field(None, max_length=2000)
    pliego_url: Optional[str] = Field(None, max_length=500)
    pliego_pdf_ref: Optional[str] = Field(None, max_length=250)
    fecha_limite_licitacion: Optional[date] = Field(None)
    engine_mode: Optional[str] = Field(default="auto")
    items: List[TenderItemSecureSchema] = Field(..., min_length=1)

    @model_validator(mode="before")
    @classmethod
    def sync_plazo(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "fecha_limite_licitacion" in data and data["fecha_limite_licitacion"]:
                try:
                    f_lim = data["fecha_limite_licitacion"]
                    if isinstance(f_lim, str):
                        from datetime import datetime as dt
                        d_val = dt.strptime(f_lim[:10], "%Y-%m-%d").date()
                    else:
                        d_val = f_lim
                    delta = (d_val - date.today()).days
                    if delta > 0:
                        data["plazo_entrega_dias"] = delta
                except Exception:
                    pass
            if "fecha_requerida_entrega_dias" in data and ("plazo_entrega_dias" not in data or not data["plazo_entrega_dias"]):
                data["plazo_entrega_dias"] = data["fecha_requerida_entrega_dias"]
            elif "plazo_entrega_dias" in data and ("fecha_requerida_entrega_dias" not in data or not data["fecha_requerida_entrega_dias"]):
                data["fecha_requerida_entrega_dias"] = data["plazo_entrega_dias"]
        return data

    @field_validator("proyecto_nombre", "cliente_licitacion")
    @classmethod
    def sanitize_text(cls, v: str) -> str:
        return html.escape(v.strip())

    @field_validator("observaciones")
    @classmethod
    def sanitize_observaciones(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return html.escape(v.strip())
        return v


TenderQuoteRequest = TenderEvaluateRequest


class DialecticalDebateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str = "success"
    proyecto_nombre: str
    postura_david: str
    replica_aristoteles: str
    modelo_utilizado: str = "qwen2.5:7b"
    latency_ms: Optional[float] = None


class TenderItemEvaluationResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sku: str
    descripcion: str
    cantidad_solicitada: int
    stock_deposito: int
    transito_maritimo: int
    lead_time_dias: float
    costo_unitario_usd: float
    costo_unitario_moneda: float
    precio_sugerido_unitario: float
    subtotal_precio: float
    margen_pct: float
    viabilidad_logistica: str  # 'VIABLE_STOCK_INMEDIATO', 'VIABLE_TRANSITO_IMPORTACION', 'QUIEBRE_LOGISTICO_CRITICO'
    unidades_faltantes: int = 0
    dias_retraso_estimado: int = 0
    badge_color: str = "emerald"
    detalle_logistico: str


class TenderEvaluateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str = "success"
    proyecto_nombre: str
    cliente_licitacion: str
    nicho: str
    plazo_entrega_dias: int
    moneda: str
    tasa_cambio_brou: float
    total_costo: float
    total_ofertado: float
    margen_total_pct: float
    viabilidad_general: str
    alerta_critica: bool
    items: List[TenderItemEvaluationResult]
    dictamen_david: Dict[str, Any]
    dictamen_aristoteles: Dict[str, Any]


class TenderCreateRequest(TenderEvaluateRequest):
    guardar_en_bd: bool = True


class TenderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    proyecto_nombre: str
    cliente_licitacion: str
    nicho: str
    fecha_apertura: Optional[date] = None
    plazo_entrega_dias: int
    moneda: str
    tipo_cambio_brou: float
    estado: str
    observaciones: Optional[str] = None
    total_items: int = 0
    total_ofertado: float = 0.0
    created_at: Optional[datetime] = None


# --- Commercial Deal (CRM) Schemas ---
class DealItemCreate(BaseModel):
    sku: str
    cantidad: int = Field(gt=0)
    precio_unitario: Optional[Decimal] = Field(default=Decimal('0.00'), ge=0)


class DealItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    deal_id: str
    sku: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Optional[Decimal] = None
    producto_nombre: Optional[str] = None
    image_url: Optional[str] = None


class CommercialDealCreate(BaseModel):
    proyecto_nombre: str = Field(..., min_length=2, max_length=200)
    cliente: str = Field(..., min_length=2, max_length=150)
    rut: Optional[str] = Field(default=None, max_length=50)
    vendedor: str = Field(default="Martín Gómez", max_length=100)
    monto_total: Optional[Decimal] = Field(default=Decimal('0.00'), ge=0)
    moneda: str = Field(default="USD", pattern=r"^(USD|UYU)$")
    etapa: str = Field(default="prospeccion") # prospeccion, cotizacion, propuesta_enviada, negociacion, ganada, perdida
    observaciones: Optional[str] = None
    logo_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    items: List[DealItemCreate] = Field(default_factory=list)

    @field_validator("proyecto_nombre", "cliente", "vendedor")
    @classmethod
    def sanitize_deal_text(cls, v: str) -> str:
        return html.escape(v.strip())


class CommercialDealUpdate(BaseModel):
    proyecto_nombre: Optional[str] = None
    cliente: Optional[str] = None
    rut: Optional[str] = None
    vendedor: Optional[str] = None
    monto_total: Optional[Decimal] = None
    moneda: Optional[str] = None
    etapa: Optional[str] = None
    observaciones: Optional[str] = None
    logo_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    items: Optional[List[DealItemCreate]] = None


class CommercialDealStageUpdate(BaseModel):
    etapa: str = Field(..., pattern=r"^(prospeccion|cotizacion|propuesta_enviada|negociacion|ganada|perdida)$")


class CommercialDealResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    proyecto_nombre: str
    cliente: str
    rut: Optional[str] = None
    vendedor: str
    monto_total: Decimal
    moneda: str
    etapa: str
    observaciones: Optional[str] = None
    logo_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    created_at: Optional[datetime] = None
    items: List[DealItemResponse] = Field(default_factory=list)
    total_items_count: int = 0
    stock_reservation_warning: Optional[str] = None


# --- Sales Orders (Órdenes de Venta Formales - OV) ---
class SalesOrderGenerateRequest(BaseModel):
    warehouse_id: str = Field(default="DEP-CENTRAL-MVD", description="Depósito desde donde se descuenta el stock")
    notas: Optional[str] = None
    moneda: Optional[str] = None


class SalesOrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sales_order_id: str
    sku: str
    cantidad: int
    precio_unitario: float
    subtotal: float
    producto_nombre: Optional[str] = None
    image_url: Optional[str] = None


class SalesOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    deal_id: str
    numero_ov: str
    cliente: str
    rut: Optional[str] = None
    vendedor: str
    warehouse_id: str
    subtotal: float
    iva_monto: float
    total: float
    moneda: str
    tipo_cambio: Optional[float] = None
    estado: str
    notas: Optional[str] = None
    logo_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    fecha_emision: date
    created_at: Optional[datetime] = None
    items: List[SalesOrderItemResponse] = Field(default_factory=list)


# --- Esquema Unificado de Lotes (ROP <-> Multi-Depósito) ---
class BatchStage(str, Enum):
    FABRICACION = "EN_FABRICACION"
    TRANSITO = "EN_TRANSITO"
    CENTRAL = "STOCK_CENTRAL"
    SUCURSAL = "STOCK_SUCURSAL"
    SHOWROOM = "SHOWROOM"


class StockBatchItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str = Field(default="")
    lote: str = Field(default="LOT-DEFAULT")  # Ej: "LOT-2026-SKU-1004"
    sku: str = Field(default="")
    cantidad: int = Field(default=0, ge=0)
    etapa: BatchStage = Field(default=BatchStage.CENTRAL)
    etapa_logistica: Optional[BatchStage] = None
    warehouse_id: str = Field(default="DEP-CENTRAL-MVD")  # "FAB-CHINA", "TRANSITO-MAR", "DEP-CENTRAL-MVD", "DEP-SALTO", "SHOWROOM-POCITOS"
    warehouse_nombre: Optional[str] = Field(default="")
    origen_pais: str = Field(default="China")
    proveedor: str = Field(default="Luminar Global Logistics")
    dias_restantes: int = Field(default=0)  # Días para embarcar o días hacia ETA
    dias_restantes_eta: Optional[int] = Field(default=0)
    fecha_eta: Optional[date] = None
    fecha_despacho: Optional[date] = None
    producto_nombre: Optional[str] = Field(default="")
    buque_o_tracking: Optional[str] = Field(default="")
    origen_tipo: str = Field(default="ROP")
    rop_order_id: Optional[str] = None
    estado: str = Field(default="DISPONIBLE")
    observaciones: Optional[str] = None


class WarehouseTransferPayload(BaseModel):
    lote: str
    sku: str
    cantidad: int = Field(..., gt=0)
    origen_id: str
    destino_id: str
    observaciones: Optional[str] = None


class WarehouseAssignStockPayload(BaseModel):
    warehouse_id: str
    sku: str
    cantidad: int = Field(..., gt=0)
    lote: Optional[str] = None
    origen_pais: Optional[str] = "China"
    proveedor: Optional[str] = "Ingreso Manual / Stock Inicial"
    observaciones: Optional[str] = None


# --- Feed Automatizado de Licitaciones B2B (Serlux: Iluminación & Mobiliario) ---
class LiveTenderFeedItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str  # Ej: "ARCE-1353660" (o "DEMO-..." si es dato de demostración)
    numero_llamado: str = ""  # Ej: "Licitación Abreviada 12/2026"
    organismo: str
    titulo: str
    nicho: str = "ILUMINACION_TECNICA"  # "ILUMINACION_TECNICA" | "MOBILIARIO_CORPORATIVO"
    fecha_apertura: str  # ISO 8601
    dias_para_apertura: int = 0
    plazo_dias_estimado: int = 15
    plazo_entrega_dias: int = 30
    monto_estimado_usd: Optional[float] = None
    pliego_url: str  # Ficha oficial verificable en comprasestatales.gub.uy
    pdf_download_url: Optional[str] = None  # Documento de bases (PDF/DOCX) publicado en OCDS
    pdf_nombre_archivo: Optional[str] = None
    resumen_necesidad: str = ""
    skus_sugeridos_catalogo: List[str] = Field(default_factory=list)
    skus_detectados: List[str] = Field(default_factory=list)  # Compatibilidad retro
    cantidades_sugeridas: Dict[str, int] = Field(default_factory=dict)
    keywords_detectadas: List[str] = Field(default_factory=list)  # Palabras clave detectadas en pliego
    snippet_coincidencia: Optional[str] = None  # Fragmento del pliego de hasta 200 caracteres con contexto
    clasificacion_fuente: str = "HEURISTICA"  # "LLM" | "HEURISTICA"
    confianza: float = 0.0
    justificacion: str = ""
    es_demo: bool = False


# Alias de compatibilidad
TenderFeedItem = LiveTenderFeedItem


class TenderLiveFeedResponse(BaseModel):
    status: str = "success"
    total: int
    items: List[LiveTenderFeedItem]
    fuente: str = "Agencia Reguladora de Compras Estatales (ARCE) / Compras Estatales Uruguay"
    fuente_estado: str = "LIVE"  # "LIVE" | "LIVE_SIN_COINCIDENCIAS" | "OFFLINE"
    incluye_demo: bool = False
    analizadas: int = 0
    descartadas: int = 0
    mensaje: Optional[str] = None
    actualizado_al: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TenderImportFeedRequest(BaseModel):
    feed_item_id: str
    proyecto_nombre: Optional[str] = None


# --- Stock Location & Batches Schemas ---
class StockLocationBatchCreate(BaseModel):
    id: str = Field(..., min_length=2, max_length=50) # ej: LOT-2026-001
    sku: str
    cantidad: int = Field(gt=0)
    ubicacion: str = Field(default="transito_maritimo") # fabrica_origen, transito_maritimo, deposito_central, showrooms_locales
    pais_origen: str = Field(default="CN", max_length=10)
    buque_o_tracking: Optional[str] = None
    fecha_despacho: Optional[date] = None
    fecha_eta: Optional[date] = None
    estado: str = Field(default="EN_TRANSITO")
    observaciones: Optional[str] = None


class StockTransferRequest(BaseModel):
    batch_id: str
    origen: Optional[str] = None
    destino: str = Field(..., pattern=r"^(fabrica_origen|transito_maritimo|deposito_central|showrooms_locales)$")
    cantidad: Optional[int] = Field(default=None, gt=0) # None = lote completo
    observaciones: Optional[str] = None


class StockLocationBatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sku: str
    producto_nombre: Optional[str] = None
    cantidad: int
    ubicacion: str # fabrica_origen, transito_maritimo, deposito_central, showrooms_locales
    pais_origen: str
    buque_o_tracking: Optional[str] = None
    fecha_despacho: Optional[date] = None
    fecha_eta: Optional[date] = None
    dias_restantes_eta: Optional[int] = None
    arribado: bool = False
    estado: str
    observaciones: Optional[str] = None
    created_at: Optional[datetime] = None


class StockLocationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    fabrica_origen_unidades: int = 0
    transito_maritimo_unidades: int = 0
    deposito_central_unidades: int = 0
    showrooms_locales_unidades: int = 0
    total_unidades: int = 0
    total_lotes: int = 0
    lotes_arribados_pendientes: int = 0


# --- Warehouses / Almacenes Schemas ---
class WarehouseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nombre: str
    tipo: str = "SUCURSAL"  # "CENTRAL", "SUCURSAL", "TRANSITO", "FABRICA"
    ubicacion: str
    capacidad_unidades: int = Field(default=10000, ge=0)
    activo: bool = True
    created_at: Optional[datetime] = None


class WarehouseCreate(BaseModel):
    id: Optional[str] = None
    nombre: str = Field(..., min_length=2, max_length=100)
    tipo: str = Field(default="SUCURSAL", pattern="^(CENTRAL|SUCURSAL|TRANSITO|FABRICA)$")
    ubicacion: str = Field(..., min_length=2, max_length=150)
    capacidad_unidades: int = Field(default=10000, ge=0)
    activo: bool = True


class WarehouseUpdate(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    ubicacion: Optional[str] = None
    capacidad_unidades: Optional[int] = None
    activo: Optional[bool] = None


# --- Sugerencias de Órdenes de Compra (Cruce Stock x CRM) ---
class PurchaseOrderSuggestion(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sku: str
    nombre: str
    stock_actual: int
    stock_transito: int
    demanda_crm_comprometida: int
    rop: int
    cantidad_sugerida_compra: int
    proveedor_id: Optional[str] = None
    costo_unitario_usd: float
    monto_total_usd: float
    lote_sugerido: str


class PurchaseOrderSuggestionsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str = "success"
    total_skus_evaluados: int = 0
    total_skus_deficit: int = 0
    inversion_total_sugerida_usd: float = 0.0
    sugerencias: List[PurchaseOrderSuggestion] = Field(default_factory=list)


# --- Compromisos Presupuestarios & Tareas Urgentes IA ---
class BudgetCommitmentSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Union[int, str]
    area: str
    responsable: str
    tarea: str
    monto: float = Field(default=0.0, ge=0)
    fecha_limite: date
    urgencia: str = "MEDIA"  # "ALTA", "MEDIA", "BAJA"
    estado: str = "PENDIENTE"
    area_id: Optional[str] = None
    responsable_id: Optional[str] = None
    origen: str = "Minuta Ejecutiva"
    created_at: Optional[datetime] = None


class BudgetCommitmentCreate(BaseModel):
    tarea: str = Field(..., min_length=3, max_length=200)
    area: Optional[str] = Field(default="Operaciones", max_length=100)
    responsable: Optional[str] = Field(default="Responsable General", max_length=100)
    monto: float = Field(default=0.0, ge=0)
    fecha_limite: Optional[date] = None
    urgencia: str = Field(default="MEDIA", pattern="^(ALTA|MEDIA|BAJA)$")
    estado: str = Field(default="PENDIENTE", max_length=50)
    area_id: Optional[str] = None
    responsable_id: Optional[str] = None
    origen: Optional[str] = "Comité Presupuestos"


class BudgetCommitmentUpdate(BaseModel):
    tarea: Optional[str] = None
    area: Optional[str] = None
    responsable: Optional[str] = None
    monto: Optional[float] = None
    fecha_limite: Optional[date] = None
    urgencia: Optional[str] = None
    estado: Optional[str] = None
    area_id: Optional[str] = None
    responsable_id: Optional[str] = None


class BudgetCommitmentAIAuditResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str = "success"
    periodo: str
    diagnostico_ia: str
    compromisos_urgentes_sugeridos: List[BudgetCommitmentCreate] = Field(default_factory=list)

class WarehouseBatchDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    lote: str
    cantidad: int
    estado: str = "DISPONIBLE"
    fecha_eta: Optional[date] = None
    buque_o_tracking: Optional[str] = None
    observaciones: Optional[str] = None


class WarehouseStockItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    sku: str
    producto_nombre: str
    image_url: Optional[str] = None
    stock_disponible: int
    stock_reservado: int = 0
    lotes: List[WarehouseBatchDetail] = Field(default_factory=list)


# --- Ollama Dynamic Models Schemas ---
class OllamaModelItem(BaseModel):
    name: str
    size: int = 0
    size_formatted: str = ""
    modified_at: Optional[str] = None
    digest: Optional[str] = None
    is_active: bool = False


class OllamaModelsResponse(BaseModel):
    models: List[OllamaModelItem] = Field(default_factory=list)
    active_model: str = "qwen2.5:7b"
    total: int = 0
    ollama_running: bool = True


class ActiveModelRequest(BaseModel):
    model: str = Field(..., min_length=1, description="Nombre del modelo Ollama (ej. qwen2.5:7b, llama3:8b)")


class ActiveModelResponse(BaseModel):
    status: str = "success"
    active_model: str
    message: str

