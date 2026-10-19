export interface InventoryAlertItem {
  sku: string;
  nombre: string;
  categoria: string;
  stock_actual: number;
  rop: number;
  doh: number;
  is_alert: boolean;
  stock_seguridad: number;
  lead_time_dias: number;
  deposito_central: number;
  transito_maritimo: number;
  aduana: number;
  costo_unitario?: number;
  demanda_diaria_promedio?: number;
  image_url?: string | null;
  stock_comprometido_pipeline?: number;
  stock_disponible_neto?: number;
}

export interface InventoryQuickUpdatePayload {
  stock_actual?: number;
  deposito_central?: number;
  transito_maritimo?: number;
  aduana?: number;
  costo_unitario?: number;
  lead_time_dias?: number;
  stock_seguridad?: number;
  demanda_diaria_promedio?: number;
  image_url?: string;
}

export interface InventoryQuickUpdateResponse {
  status: string;
  message: string;
  item: InventoryAlertItem;
}

export interface MarginSummaryItem {
  sku: string;
  nombre: string;
  categoria: string;
  precio_venta: number;
  costo_unitario: number;
  gross_margin_pct: number;
  markup_pct: number;
  unit_contribution_margin: number;
  marginal_ratio: number;
}

export interface WaterfallStepItem {
  step: string;
  valor: number;
  tipo: 'base' | 'deduccion' | 'subtotal' | 'final' | string;
}

export interface DiscountSimulationRequest {
  base_price?: number;
  precio_base?: number;
  cost?: number;
  costo_unitario?: number;
  sku?: string;
  discount_pct?: number;
  descuento_pct?: number;
  channel?: string;
  canal?: string;
  commission_pct?: number;
  comision_pct?: number;
  freight?: number;
  flete_usd?: number;
}

export interface DiscountSimulationResponse {
  // Claves en español del Waterfall
  precio_base?: number;
  descuento_monto?: number;
  precio_neto?: number;
  cmv?: number;
  canal_flete?: number;
  margen_contribucion?: number;
  ratio_marginal?: number;
  waterfall_steps?: WaterfallStepItem[];
  alerta?: string | null;

  // Claves existentes
  base_price?: number | string;
  discount_pct?: number | string;
  discounted_price?: number | string;
  effective_price: number;
  channel?: string;
  commission_pct?: number;
  freight?: number;
  gross_margin?: number | string;
  gross_margin_pct?: number;
  unit_contribution_margin?: number | string;
  marginal_ratio?: number | string;
  markup_pct?: number;
  below_threshold_15pct?: boolean;
  is_viable?: boolean;
}

export interface BudgetVarianceItem {
  id: number;
  periodo: string;
  categoria?: string;
  tipo: string;
  monto_presupuestado: number;
  monto_real: number;
  variacion_absoluta: number;
  variacion_porcentual: number;
  status: 'GREEN' | 'YELLOW' | 'RED' | string;
}

export interface AvailablePeriodsResponse {
  periods: string[];
  default_period: string;
}

export interface BudgetSeedResponse {
  status: string;
  periodo: string;
  records_seeded: number;
  total_budgeted: number;
  message: string;
}

export interface BudgetScenarioMetrics {
  nombre: string;
  enfoque: string;
  crecimiento_volumen_pct: number;
  variacion_precio_pct: number;
  variacion_costo_cogs_pct: number;
  variacion_opex_pct: number;
  ingresos_totales: number;
  cogs_total: number;
  margen_bruto: number;
  margen_bruto_pct: number;
  opex_total: number;
  ebitda: number;
  ebitda_margin_pct: number;
  doh_objetivo_dias: number;
  flujo_caja_estimado: number;
}

export interface BudgetScenarioResponse {
  provider: string;
  model?: string;
  status: string;
  latency_ms: number;
  periodo_objetivo: string;
  base_real_ingresos: number;
  escenarios: {
    conservador: BudgetScenarioMetrics;
    base: BudgetScenarioMetrics;
    agresivo: BudgetScenarioMetrics;
  };
  analisis_ia: {
    resumen_ejecutivo: string;
    supuestos_clave: string[];
    riesgos_principales: string[];
    plan_de_contingencia: string[];
  };
  raw_markdown: string;
}

export interface SuggestedPOItem {
  sku: string;
  nombre?: string;
  stock_actual: number;
  rop: number;
  doh: number;
  lead_time_dias: number;
  suggested_quantity: number;
  unit_cost: number;
  working_capital_required: number;
  priority: string;
  economic_impact_risk: number;
}

export interface SupplyActionPlanResponse {
  provider: string;
  model?: string;
  status: string;
  latency_ms: number;
  total_skus_evaluated: number;
  critical_skus_count: number;
  total_working_capital_required: number;
  suggested_purchase_orders: SuggestedPOItem[];
  action_plan_3_steps: string[];
  raw_markdown: string;
}

export interface CrossReportResponse {
  provider: string;
  model?: string;
  status: string;
  latency_ms: number;
  audience: string;
  key_metrics: Record<string, any>;
  executive_summary: string;
  raw_markdown: string;
}

export type EngineMode = 'force_llm' | 'heuristic' | 'auto';

export interface OllamaStatus {
  online: boolean;
  url: string;
  models: string[];
  target_model: string;
  target_model_available: boolean;
  message: string;
}

export interface UserPreferences {
  id?: number;
  user_id: string;
  active_theme: string;
  default_engine_mode?: EngineMode;
  saved_filters: {
    categoria?: string;
    only_alerts?: boolean;
    lead_time_min?: number;
    periodo?: string;
    [key: string]: any;
  };
  visible_columns: string[];
  last_view: string;
  updated_at?: string;
}

export interface ETLUploadResponse {
  status: string;
  records_processed: number;
  errors: string[];
  message: string;
}

// =====================================================================
// DIMENSIÓN 1: MULTILEVEL VARIANCE TYPES
// =====================================================================
export interface MultilevelVarianceLineItem {
  categoria: string;
  sku?: string;
  nombre: string;
  budgeted_amount: number;
  actual_amount: number;
  variance_amount: number;
  variance_pct: number;
  price_variance: number;
  volume_variance: number;
  mix_variance: number;
  status: string;
  requires_mitigation: boolean;
}

export interface MultilevelVarianceResponse {
  total_budget: number;
  total_actual: number;
  net_variance: number;
  net_variance_pct: number;
  total_price_variance: number;
  total_volume_variance: number;
  total_mix_variance: number;
  requires_mitigation: boolean;
  mitigation_plan_3_steps: string[];
  lines: MultilevelVarianceLineItem[];
}

// =====================================================================
// DIMENSIÓN 3: KANBAN DE REPOSICIÓN TYPES
// =====================================================================
export interface SupplyOrder {
  id: number;
  sku_id: string;
  cantidad: number;
  monto_total: number;
  proveedor: string;
  etapa: 'sugerido' | 'aprobacion' | 'fabricacion' | 'transito' | 'ingresado' | string;
  responsable: string;
  fecha_arribo_estimada: string;
  created_at?: string;
}

export interface SupplyKanbanStage {
  id: string;
  name: string;
  color_hex: string;
  total_capital: number;
  order_count: number;
  orders: SupplyOrder[];
}

export interface SupplyKanbanResponse {
  stages: SupplyKanbanStage[];
  total_pipeline_capital: number;
}

// =====================================================================
// DIMENSIÓN 4: EVALUADOR DE INICIATIVAS TYPES
// =====================================================================
export interface InitiativeEvaluationRequest {
  initiative_name: string;
  initial_investment: number;
  estimated_unit_cost: number;
  estimated_unit_price: number;
  expected_demand: number;
  fixed_costs?: number;
  competitors_notes?: string;
}

export interface InitiativeEvaluationResponse {
  provider: string;
  model?: string;
  status: string;
  latency_ms: number;
  initiative_name: string;
  initial_investment: number;
  unit_contribution_margin: number;
  marginal_ratio: number;
  total_contribution_margin: number;
  break_even_units: number;
  break_even_revenue: number;
  payback_cycles: number;
  roi_pct: number;
  viability: 'Factible' | 'Marginal' | 'Inviable' | string;
  risk_assessment: string;
  raw_markdown: string;
}

// =====================================================================
// DIMENSIÓN 5 & 6: ACCIONES, AUDIT LOGS & RBAC
// =====================================================================
export interface AccionCompromiso {
  id: number;
  titulo: string;
  area: string;
  responsable: string;
  fecha_limite: string;
  estado: string;
  origen: string;
  created_at?: string;
}

export interface AuditLog {
  id: number;
  user_id: string;
  role: string;
  action: string;
  resource: string;
  details?: Record<string, any>;
  timestamp: string;
}

export type UserRole =
  | 'analista_comercial'
  | 'analista_operaciones'
  | 'controller_admin'
  | 'admin_3pl'
  | 'operario_3pl'
  | 'conductor_3pl';

export interface SupplyOrderUpdate {
  sku_id?: string;
  cantidad?: number;
  monto_total?: number;
  proveedor?: string;
  etapa?: string;
  responsable?: string;
  fecha_arribo_estimada?: string;
}

export interface InternalDBBenchmark {
  categoria?: string;
  sku_count: number;
  avg_price: number;
  avg_cost: number;
  avg_margin_pct: number;
  avg_doh: number;
  sample_skus: string[];
}

export interface MarketWebReference {
  source: string;
  title: string;
  price?: number;
  original_price?: number;
  original_currency?: string;
  seller?: string;
  snippet?: string;
  link?: string;
}

export interface InitiativeBenchmarkRequest {
  product_name: string;
  category?: string;
  proposed_price: number;
  proposed_cost: number;
  expected_demand: number;
  initial_investment?: number;
  search_query?: string;
  platform?: 'mercadolibre' | 'google' | 'hybrid';
  country?: string;
  department?: string;
  engine_mode?: EngineMode;
}

export interface InitiativeBenchmarkResponse {
  provider: string;
  model?: string;
  latency_ms: number;
  product_name: string;
  proposed_price: number;
  proposed_cost: number;
  proposed_margin_pct: number;
  internal_db: InternalDBBenchmark;
  market_references: MarketWebReference[];
  market_avg_price?: number;
  price_competitiveness_pct: number;
  break_even_units: number;
  payback_cycles: number;
  strategic_assessment: string;
  raw_markdown: string;
}

export interface BROUExchangeRateResponse {
  source: string;
  currency_pair: string;
  buy: number;
  sell: number;
  rate_used: number;
  updated_at: string;
}

// =====================================================================
// STEPPER DE 3 FASES: BENCHMARKING DE COMPETIDORES
// =====================================================================
export interface CompetitorItemResponse {
  id: string;
  titulo: string;
  vendedor: string;
  canal: string;
  precio_original?: number;
  precio_uyu?: number;
  moneda: string;
  precio_usd: number;
  ubicacion?: string;
  url?: string;
}

export interface CompetitorSearchRequest {
  query?: string;
  product_name?: string;
  category?: string;
  target_price?: number;
  price?: number;
  country?: string;
  region?: string;
  platform?: string;
  target_currency?: 'USD' | 'UYU';
  search_query?: string;
  proposed_price?: number;
  department?: string;
}

export interface CompetitorSearchResponse {
  status: string;
  competitors: CompetitorItemResponse[];
  total_empresas: number;
  message?: string | null;
  target_currency?: string;
  exchange_rate_used?: number;
  exchange_rate_source?: string;
}

export interface CapexBreakdown {
  maquinaria_equipos: number;
  adecuacion_local: number;
  marketing_lanzamiento: number;
  habilitaciones_marcas: number;
  otros_capex: number;
}

export interface OpexBreakdown {
  sueldos_personal: number;
  alquiler_deposito: number;
  publicidad_mensual: number;
  seguros_servicios: number;
  otros_opex: number;
}

export interface CompetitorSelectionEvaluationRequest {
  product_name: string;
  category?: string;
  proposed_price: number;
  proposed_cost: number;
  expected_demand: number;
  initial_investment: number;
  monthly_opex?: number;
  capex_details?: CapexBreakdown;
  opex_details?: OpexBreakdown;
  selected_competitors: CompetitorItemResponse[];
  engine_mode?: EngineMode;
  target_currency?: 'USD' | 'UYU';
}

export interface CompetitorSelectionEvaluationResponse {
  provider: string;
  model?: string;
  latency_ms: number;
  product_name: string;
  proposed_price: number;
  proposed_cost: number;
  proposed_margin_pct: number;
  min_price: number;
  max_price: number;
  median_price: number;
  avg_price: number;
  price_competitiveness_pct: number;
  unit_contribution_margin: number;
  marginal_ratio: number;
  monthly_opex?: number;
  gross_margin_monthly?: number;
  net_operating_cashflow?: number;
  break_even_units?: number | null;
  break_even_money?: number | null;
  break_even_revenue?: number | null;
  break_even_coverage_pct?: number | null;
  payback_cycles?: number | null;
  payback_months?: number | null;
  payback_status?: string | null;
  roi_pct: number;
  viability: string;
  executive_assessment: string;
  raw_markdown: string;
  capex_details?: CapexBreakdown;
  opex_details?: OpexBreakdown;
}

// =====================================================================
// PRESUPUESTOS FLEXIBLES: CARGA MANUAL Y ASISTIDA POR IA
// =====================================================================
export interface BudgetManualItem {
  categoria_id: number;
  categoria_nombre?: string;
  monto_presupuestado: number;
  unidades_presupuestadas: number;
}

export interface BudgetManualBatchRequest {
  periodo: string;
  version?: string;
  items: BudgetManualItem[];
}

export interface BudgetManualBatchResponse {
  status: string;
  periodo: string;
  version: string;
  records_saved: number;
  total_budgeted: number;
  message: string;
}

export interface SkuPrioritarioItem {
  sku: string;
  nombre: string;
  tipo_accion: 'PUSH_SOBRESTOCK' | 'PULL_REPOSICION' | string;
  motivo: string;
}

export interface BusinessUnitDistribution {
  unidad: string;
  participacion_pct: number;
  enfoque: string;
}

export interface BudgetCategorySuggestion {
  categoria_id: number;
  categoria_nombre: string;
  monto_sugerido: number;
  unidades_sugeridas: number;
  crecimiento_pct: number;
  ventas_historicas: number;
  stock_actual: number;
  avg_doh: number;
  justificacion: string;
  diagnostico_tag?: string;
  fundamento_estrategico?: string;
  skus_prioritarios?: SkuPrioritarioItem[];
}

export interface BudgetAISuggestResponse {
  periodo: string;
  total_sugerido: number;
  total_unidades: number;
  suggestions: BudgetCategorySuggestion[];
  analisis_resumen: string;
  crecimiento_global_pct?: number;
  dictamen_general?: string;
  distribucion_unidades_negocio?: BusinessUnitDistribution[];
  metas_categorias?: BudgetCategorySuggestion[];
}

export interface BudgetPeriodDeleteResponse {
  status: string;
  periodo: string;
  records_deleted: number;
  message: string;
}

// =====================================================================
// CATEGORÍAS DINÁMICAS (BCNF)
// =====================================================================
export interface CategoryItem {
  id: number;
  nombre: string;
  margen_target_pct: number;
  created_at?: string;
}

export interface CategoryCreateRequest {
  nombre: string;
  margen_target_pct?: number;
}

// =====================================================================
// ESTRUCTURA ORGANIZACIONAL (ÁREAS & RESPONSABLES - BCNF)
// =====================================================================
export interface AreaItem {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  centros_count?: number;
}

export interface AreaCreateRequest {
  codigo: string;
  nombre: string;
  descripcion?: string;
}

export interface ResponsibleUserItem {
  id: number;
  nombre: string;
  email: string;
  cargo?: string;
  area_id?: number;
  area_nombre?: string;
}

export interface ResponsibleUserCreateRequest {
  nombre: string;
  email: string;
  cargo?: string;
  area_id?: number;
}

// =====================================================================
// CENTROS DE COSTO & PRESUPUESTOS OPEX (BCNF)
// =====================================================================
export interface CostCenterItem {
  id: number;
  codigo: string;
  nombre: string;
  responsable: string;
  activo: boolean;
  area_id?: number;
  area_nombre?: string;
  responsable_id?: number;
  responsable_nombre?: string;
}

export interface CostCenterCreateRequest {
  codigo: string;
  nombre: string;
  responsable?: string;
  activo?: boolean;
  area_id?: number;
  responsable_id?: number;
}

export interface CostCenterBudgetLine {
  id?: number;
  periodo: string;
  centro_costo_id: number;
  centro_costo_codigo?: string;
  centro_costo_nombre?: string;
  concepto_opex: string;
  monto_presupuestado: number;
  monto_real: number;
  variacion_monto: number;
  variacion_pct: number;
  estado: 'EN_PRESUPUESTO' | 'EXCESO_GASTO' | 'AHORRO' | string;
}

export interface CostCenterSummaryItem {
  centro_costo_id: number;
  codigo: string;
  nombre: string;
  responsable: string;
  area_id?: number;
  area_nombre?: string;
  responsable_id?: number;
  responsable_nombre?: string;
  total_presupuestado: number;
  total_real: number;
  variacion_neta: number;
  variacion_pct: number;
  estado: 'EN_PRESUPUESTO' | 'EXCESO_GASTO' | 'AHORRO' | string;
  partidas: CostCenterBudgetLine[];
}

export interface CostCenterBudgetReportResponse {
  periodo: string;
  total_opex_presupuestado: number;
  total_opex_real: number;
  variacion_total: number;
  variacion_total_pct: number;
  centros_costo: CostCenterSummaryItem[];
}

export interface CostCenterBatchItem {
  centro_costo_id: number;
  concepto_opex: string;
  monto_presupuestado: number;
  monto_real?: number;
}

export interface CostCenterBatchRequest {
  periodo: string;
  items: CostCenterBatchItem[];
}

export interface CostCenterBatchResponse {
  status: string;
  periodo: string;
  records_saved: number;
  total_opex_presupuestado: number;
  message: string;
}

export interface CostCenterTotalOpexResponse {
  periodo: string;
  total_opex_presupuestado: number;
  total_opex_real: number;
  centros_contabilizados?: number;
  partidas_contabilizadas?: number;
  status: string;
}

// =====================================================================
// FUSIÓN LUMINAR -> CALCU: LICITACIONES & PROYECTOS B2B (ZERO-TRUST)
// =====================================================================
export interface TenderItemSecure {
  sku: string;
  cantidad_solicitada: number;
  precio_objetivo_unitario?: number;
}

export interface TenderEvaluateRequest {
  proyecto_nombre: string;
  cliente_licitacion: string;
  nicho: string;
  plazo_entrega_dias: number;
  moneda: 'USD' | 'UYU' | string;
  margen_comercial_pct?: number;
  observaciones?: string;
  engine_mode?: EngineMode;
  pliego_url?: string;
  pliego_pdf_ref?: string;
  fecha_limite_licitacion?: string;
  items: TenderItemSecure[];
}

export interface TenderItemEvaluationResult {
  sku: string;
  descripcion: string;
  cantidad_solicitada: number;
  stock_deposito: number;
  transito_maritimo: number;
  lead_time_dias: number;
  costo_unitario_usd: number;
  costo_unitario_moneda: number;
  precio_sugerido_unitario: number;
  subtotal_precio: number;
  margen_pct: number;
  viabilidad_logistica: 'VIABLE_STOCK_INMEDIATO' | 'VIABLE_TRANSITO_IMPORTACION' | 'QUIEBRE_LOGISTICO_CRITICO' | string;
  unidades_faltantes: number;
  dias_retraso_estimado: number;
  badge_color: 'emerald' | 'amber' | 'rose' | string;
  detalle_logistico: string;
}

export interface DictamenDavid {
  agente: string;
  cargo: string;
  lux_objetivo: number;
  ugr_maximo: number;
  tipo_curva: string;
  norma_aplicable: string;
  roi_energetico: {
    kwh_ahorro_anual: number;
    ahorro_dolares_anual: number;
    ahorro_energetico_pct: number;
    meses_retorno_roi: number;
    reduccion_co2_ton_anual: number;
    tarifa_kwh_usd: number;
  };
  errores_competencia: string[];
  dictamen_completo: string;
  postura_david?: string;
  modelo_utilizado?: string;
  compatibilidad_tecnica?: boolean;
  semaforo_plazo?: 'VERDE' | 'AMARILLO' | 'ROJO' | string;
  sustitucion_local_sugerida?: string;
}

export interface DictamenAristoteles {
  nicho_aplicado: string;
  frase_fuerza: string;
  logos: string;
  ethos: string;
  pathos: string;
  pitch_apertura: string;
  estrategia_completa: string;
  frase_ia_qwen?: string;
  replica_aristoteles?: string;
  propuesta_formal?: string;
  modelo_utilizado?: string;
  latency_ms?: number;
}

export interface TenderEvaluateResponse {
  status: string;
  proyecto_nombre: string;
  cliente_licitacion: string;
  nicho: string;
  plazo_entrega_dias: number;
  moneda: string;
  tasa_cambio_brou: number;
  total_costo: number;
  total_ofertado: number;
  margen_total_pct: number;
  viabilidad_general: 'VIABLE_LOGISTICA_APROBADA' | 'QUIEBRE_LOGISTICO_CRITICO' | string;
  alerta_critica: boolean;
  items: TenderItemEvaluationResult[];
  dictamen_david: DictamenDavid;
  dictamen_aristoteles: DictamenAristoteles;
}

export interface TenderSummaryItem {
  id: string;
  proyecto_nombre: string;
  cliente_licitacion: string;
  nicho: string;
  fecha_apertura?: string;
  plazo_entrega_dias: number;
  moneda: string;
  tipo_cambio_brou: number;
  estado: string;
  observaciones?: string;
  total_items: number;
  total_ofertado: number;
  created_at?: string;
}

export interface TenderDetailResponse {
  id: string;
  proyecto_nombre: string;
  cliente_licitacion: string;
  nicho: string;
  fecha_apertura?: string;
  plazo_entrega_dias: number;
  moneda: string;
  tipo_cambio_brou: number;
  estado: string;
  observaciones?: string;
  total_ofertado: number;
  items: {
    id: number;
    sku: string;
    cantidad_solicitada: number;
    costo_unitario: number;
    precio_unitario: number;
    subtotal: number;
    margen_estimado: number;
    viabilidad_logistica: string;
    unidades_faltantes: number;
    dias_retraso_estimado: number;
  }[];
  dictamen_david: DictamenDavid;
  dictamen_aristoteles: DictamenAristoteles;
  created_at?: string;
}


// --- MÓDULO 1: Pipeline Comercial (CRM) ---
export type DealStage = 'prospeccion' | 'cotizacion' | 'propuesta_enviada' | 'negociacion' | 'ganada' | 'perdida';

export interface DealItemPayload {
  sku: string;
  cantidad: number;
  precio_unitario?: number;
}

export interface DealItem {
  id: number;
  deal_id: string;
  sku: string;
  cantidad: number;
  precio_unitario: number;
  subtotal?: number;
  producto_nombre?: string;
  image_url?: string | null;
}

export type LeadSourceChannel = 'GOOGLE_ADS' | 'META_ADS' | 'WHATSAPP' | 'WHATSAPP_QR' | 'EMAIL' | 'WEB_FORM' | 'MERCADO_LIBRE' | 'MANUAL' | string;

export interface CommercialDeal {
  id: string;
  proyecto_nombre: string;
  cliente: string;
  rut?: string;
  logo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  canal_origen?: LeadSourceChannel;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  external_lead_id?: string | null;
  costo_adquisicion_estimado?: number;
  ai_score?: number;
  ai_classification?: 'HOT' | 'WARM' | 'COLD' | 'AMIGOS_FAMILIA' | string;
  vendedor: string;
  monto_total: number;
  moneda: 'USD' | 'UYU' | string;
  etapa: DealStage;
  observaciones?: string;
  created_at?: string;
  items: DealItem[];
  total_items_count: number;
  stock_reservation_warning?: string;
}

export interface CommercialDealCreatePayload {
  proyecto_nombre: string;
  cliente: string;
  rut?: string;
  logo_url?: string;
  email?: string;
  phone?: string;
  address?: string;
  canal_origen?: LeadSourceChannel;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  external_lead_id?: string;
  costo_adquisicion_estimado?: number;
  ai_score?: number;
  ai_classification?: string;
  vendedor?: string;
  monto_total?: number;
  moneda?: string;
  etapa?: DealStage;
  observaciones?: string;
  items?: DealItemPayload[];
}

export interface CommercialDealUpdatePayload {
  proyecto_nombre?: string;
  cliente?: string;
  rut?: string;
  logo_url?: string;
  email?: string;
  phone?: string;
  address?: string;
  canal_origen?: LeadSourceChannel;
  utm_campaign?: string;
  ai_score?: number;
  ai_classification?: string;
  vendedor?: string;
  monto_total?: number;
  moneda?: string;
  etapa?: DealStage;
  observaciones?: string;
  items?: DealItemPayload[];
}



// --- MÓDULO 2: Monitor de Stock Multi-Ubicación & Tránsito ---
export type StockLocationType = 'fabrica_origen' | 'transito_maritimo' | 'deposito_central' | 'showrooms_locales';

export interface StockLocationBatch {
  id: string;
  sku: string;
  producto_nombre?: string;
  cantidad: number;
  ubicacion: StockLocationType;
  pais_origen: string;
  buque_o_tracking?: string;
  fecha_despacho?: string;
  fecha_eta?: string;
  dias_restantes_eta?: number | null;
  arribado: boolean;
  estado: string;
  observaciones?: string;
  created_at?: string;
}

export interface StockLocationBatchCreatePayload {
  id: string;
  sku: string;
  cantidad: number;
  ubicacion?: StockLocationType;
  pais_origen?: string;
  buque_o_tracking?: string;
  fecha_despacho?: string;
  fecha_eta?: string;
  estado?: string;
  observaciones?: string;
}

export interface StockTransferPayload {
  batch_id: string;
  origen?: string;
  destino: StockLocationType;
  cantidad?: number;
  observaciones?: string;
}

export interface StockLocationSummary {
  fabrica_origen_unidades: number;
  transito_maritimo_unidades: number;
  deposito_central_unidades: number;
  showrooms_locales_unidades: number;
  total_unidades: number;
  total_lotes: number;
  lotes_arribados_pendientes: number;
}


// --- GOBERNANZA MULTI-DEPÓSITO & ALMACENES FÍSICOS ---
export type WarehouseType = 'CENTRAL' | 'SUCURSAL' | 'TRANSITO' | 'FABRICA' | 'INTERNACIONAL' | 'URUGUAY' | string;

export interface WarehouseItem {
  id: string;
  nombre: string;
  tipo: WarehouseType;
  ubicacion: string;
  pais?: string | null;
  capacidad_unidades: number;
  activo: boolean;
  created_at?: string;
}

export interface WarehouseCreatePayload {
  id?: string;
  nombre: string;
  tipo?: WarehouseType;
  ubicacion: string;
  pais?: string;
  capacidad_unidades?: number;
  activo?: boolean;
}

export interface WarehouseUpdatePayload {
  nombre?: string;
  tipo?: WarehouseType;
  ubicacion?: string;
  pais?: string;
  capacidad_unidades?: number;
  activo?: boolean;
}

// --- ACTUALIZACIÓN DE ÁREAS Y USUARIOS ---
export interface AreaUpdatePayload {
  codigo?: string;
  nombre?: string;
  descripcion?: string;
}

export interface ResponsibleUserUpdatePayload {
  nombre?: string;
  email?: string;
  cargo?: string;
  area_id?: number | null;
}

// --- GOBERNANZA PRESUPUESTARIA: COMPROMISOS & AUDITORÍA IA ---
export interface BudgetCommitmentItem {
  id: number | string;
  area: string;
  responsable: string;
  tarea: string;
  monto: number;
  fecha_limite: string;
  urgencia: 'ALTA' | 'MEDIA' | 'BAJA' | string;
  estado: 'PENDIENTE' | 'EN_CURSO' | 'CUMPLIDO' | 'BLOQUEADO' | string;
  area_id?: string | null;
  responsable_id?: string | null;
  origen: string;
  created_at?: string;
}

export interface BudgetCommitmentCreatePayload {
  tarea: string;
  area?: string;
  responsable?: string;
  monto?: number;
  fecha_limite?: string;
  urgencia?: 'ALTA' | 'MEDIA' | 'BAJA' | string;
  estado?: string;
  area_id?: string | null;
  responsable_id?: string | null;
  origen?: string;
}

export interface BudgetCommitmentUpdatePayload {
  tarea?: string;
  area?: string;
  responsable?: string;
  monto?: number;
  fecha_limite?: string;
  urgencia?: string;
  estado?: string;
  area_id?: string | null;
  responsable_id?: string | null;
}

export interface BudgetCommitmentAIAuditResponse {
  status: string;
  periodo: string;
  diagnostico_ia: string;
  compromisos_urgentes_sugeridos: BudgetCommitmentCreatePayload[];
}

// --- MOTOR DE ÓRDENES DE COMPRA INTELIGENTES (CRUCE STOCK X CRM) ---
export interface PurchaseOrderSuggestionItem {
  sku: string;
  nombre: string;
  stock_actual: number;
  stock_transito: number;
  demanda_crm_comprometida: number;
  rop: number;
  cantidad_sugerida_compra: number;
  proveedor_id?: string | null;
  costo_unitario_usd: number;
  monto_total_usd: number;
  lote_sugerido: string;
}

export interface PurchaseOrderSuggestionsResponse {
  status: string;
  total_skus_evaluados: number;
  total_skus_deficit: number;
  inversion_total_sugerida_usd: number;
  sugerencias: PurchaseOrderSuggestionItem[];
}

// --- ÓRDENES DE VENTA (CRM SALES ORDERS) ---
export interface SalesOrderItem {
  id: number;
  sales_order_id: string;
  sku: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  producto_nombre?: string;
}

export interface SalesOrder {
  id: string;
  numero_ov: string;
  deal_id: string;
  cliente: string;
  rut?: string | null;
  fecha_emision: string;
  moneda: string;
  subtotal: number;
  iva_tasa: number;
  iva_monto: number;
  total: number;
  warehouse_id: string;
  warehouse_nombre?: string | null;
  estado: string;
  observaciones?: string | null;
  created_at?: string;
  items: SalesOrderItem[];
}

export interface SalesOrderGeneratePayload {
  warehouse_id?: string;
  observaciones?: string;
}

// --- SINCRONIZACIÓN ROP & MULTI-DEPÓSITO POR LOTE ---
export type BatchStage = 'fabricacion' | 'transito' | 'deposito_central' | 'deposito_salto' | 'showroom_pocitos' | string;
export type LogisticStageColumn = 'fabrica' | 'deposito_internacional' | 'alta_mar' | 'proveedor_uy' | 'deposito_uruguay';

export interface StockBatchItem {
  id: string;
  lote: string;
  sku: string;
  sku_fabrica?: string | null;
  lote_fabrica?: string | null;
  producto_nombre?: string;
  image_url?: string | null;
  imagen_url?: string | null;
  cantidad: number;
  precio_venta?: number;
  costo_compra?: number | null;
  estado_aprobacion?: 'PENDIENTE_APROBACION' | 'APROBADO' | 'RECHAZADO' | string;
  etapa?: string;
  etapa_logistica?: BatchStage;
  etapa_columna?: LogisticStageColumn | string;
  warehouse_id: string;
  warehouse_nombre?: string;
  supplier_id?: number | null;
  supplier_nombre?: string | null;
  origen_pais?: string;
  proveedor?: string;
  dias_restantes?: number;
  dias_restantes_eta?: number | null;
  buque_o_tracking?: string | null;
  fecha_despacho?: string | null;
  fecha_eta?: string | null;
  fecha_terminado?: string | null;
  origen_tipo?: 'ROP' | 'STOCK_DIRECTO' | 'LICITACION_B2B' | 'REVENTA_LOCAL' | string;
  rop_order_id?: string | null;
  estado: string;
  observaciones?: string | null;
  created_at?: string;
}

export interface WarehouseBatchDetail {
  lote: string;
  cantidad: number;
  estado: string;
  fecha_eta?: string | null;
  buque_o_tracking?: string | null;
  observaciones?: string | null;
}

export interface WarehouseStockItem {
  sku: string;
  producto_nombre: string;
  image_url?: string | null;
  stock_disponible: number;
  stock_reservado: number;
  lotes: WarehouseBatchDetail[];
}

export interface WarehouseTransferPayload {
  batch_id: string;
  origen_warehouse_id: string;
  destino_warehouse_id: string;
  cantidad: number;
  observaciones?: string;
}

export interface WarehouseAssignStockPayload {
  lote: string;
  sku: string;
  cantidad: number;
  warehouse_id: string;
  buque_o_tracking?: string;
  fecha_eta?: string;
  observaciones?: string;
}

// --- FEED DE LICITACIONES B2B PÚBLICAS (ARCE / UTE / IMM / OSE - SERLUX) ---
export interface TenderFeedItem {
  id: string;
  numero_llamado?: string;
  organismo: string;
  titulo: string;
  nicho?: 'ILUMINACION_TECNICA' | 'MOBILIARIO_CORPORATIVO' | string;
  fecha_apertura: string;
  dias_para_apertura?: number;
  plazo_dias_estimado?: number;
  plazo_entrega_dias?: number;
  monto_estimado_usd?: number | null;
  pliego_url: string;
  pdf_download_url?: string | null;
  pdf_nombre_archivo?: string | null;
  resumen_necesidad?: string;
  skus_sugeridos_catalogo?: string[];
  skus_detectados: string[];
  cantidades_sugeridas: Record<string, number>;
  clasificacion_fuente?: 'LLM' | 'HEURISTICA' | string;
  confianza?: number;
  justificacion?: string;
  keywords_detectadas?: string[];
  snippet_coincidencia?: string | null;
  es_demo?: boolean;
}

export type LiveTenderFeedItem = TenderFeedItem;

export interface TenderLiveFeedResponse {
  status: string;
  total: number;
  items: TenderFeedItem[];
  fuente?: string;
  fuente_estado?: 'LIVE' | 'LIVE_SIN_COINCIDENCIAS' | 'OFFLINE' | string;
  incluye_demo?: boolean;
  analizadas?: number;
  descartadas?: number;
  mensaje?: string | null;
  actualizado_al?: string;
}

export interface TenderImportFeedRequest {
  feed_item_id: string;
  proyecto_nombre?: string;
}

export interface TenderFeedSyncRequest {
  model?: string;
  vertical_id?: string;
  limit?: number;
  offset?: number;
  append_mode?: boolean;
}

export interface TenderImportFeedResponse {
  status: string;
  message: string;
  tender_id: string;
  feed_item: TenderFeedItem;
  evaluation: any;
}

// =====================================================================
// LICITACIONES B2B: MOTOR MULTI-RUBRO & AGENTES IA LOCALES
// =====================================================================
export interface BiddingKeywordItem {
  id: number;
  vertical_id: string;
  keyword: string;
  tipo: 'INCLUSION' | 'EXCLUSION' | string;
  peso: number;
  fuente: string;
  created_at?: string;
}

export interface BiddingKeywordCreate {
  keyword: string;
  tipo: 'INCLUSION' | 'EXCLUSION' | string;
  peso?: number;
}

export interface BiddingKeywordBulkCreate {
  keywords: string[];
  tipo: 'INCLUSION' | 'EXCLUSION' | string;
  peso?: number;
}

export interface BiddingVerticalItem {
  id: string;
  nombre: string;
  icon: string;
  color_badge: string;
  descripcion?: string | null;
  activo: boolean;
  keywords_count?: number;
}

export interface BiddingVerticalCreate {
  id: string;
  nombre: string;
  icon?: string;
  color_badge?: string;
  descripcion?: string | null;
  activo?: boolean;
}

export interface BiddingAIExpandKeywordsRequest {
  vertical_id?: string;
  rubro_nombre?: string;
  query?: string;
  model?: string;
  include_exclusions?: boolean;
}

export interface BiddingAIExpandKeywordsResponse {
  status: string;
  vertical_id?: string;
  query?: string;
  model_used: string;
  sinonimos_sugeridos: string[];
  keywords_inclusion_sugeridas: string[];
  keywords_exclusion_sugeridas: string[];
  explicacion: string;
  es_fallback_heuristico: boolean;
}

// =====================================================================
// DIRECTORIO B2B: CLIENTES & PROVEEDORES (MODERN SAAS)
// =====================================================================
export interface ClientDealItemSummary {
  deal_id: number;
  deal_code: string;
  deal_title: string;
  etapa: string;
  monto_total: number;
  probabilidad_pct: number;
  created_at?: string | null;
}

export interface ClientItem {
  id: number;
  nombre: string;
  rut?: string | null;
  logo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  limite_credito?: number;
  deals_count: number;
  total_pipeline: number;
  pipeline_activo?: number;
  pipeline_total?: number;
  deals: ClientDealItemSummary[];
  created_at?: string;
}

export interface ClientCreatePayload {
  nombre: string;
  rut?: string;
  logo_url?: string;
  email?: string;
  phone?: string;
  address?: string;
  limite_credito?: number;
}

export interface ClientUpdatePayload {
  nombre?: string;
  rut?: string;
  logo_url?: string;
  email?: string;
  phone?: string;
  address?: string;
  limite_credito?: number;
}

export interface SupplierProductItem {
  product_id: number;
  sku: string;
  nombre: string;
  costo_unitario: number;
  lead_time_dias: number;
  imagen_url?: string | null;
}

export interface SupplierItem {
  id: number;
  nombre: string;
  razon_social?: string | null;
  rut?: string | null;
  tipo_proveedor?: 'FABRICA' | 'NAVIERA_BUQUE' | 'LOGISTICA' | 'GENERAL' | 'PROVEEDOR_UY' | 'PROVEEDOR_REVENTA' | string;
  pais?: string | null;
  contacto_nombre?: string | null;
  contacto_cargo?: string | null;
  descripcion?: string | null;
  logo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  rubro?: string | null;
  condicion_pago?: string | null;
  total_skus: number;
  skus_count?: number;
  catalog_items_count?: number;
  productos: SupplierProductItem[];
  ordenes_compra_count?: number;
  ordenes_compra?: {
    id: number | string;
    sku_id: string;
    cantidad: number;
    monto_total: number;
    etapa: string;
    fecha_arribo_estimada?: string | null;
    responsable?: string;
  }[];
  created_at?: string;
}

export interface SupplierCreatePayload {
  nombre: string;
  razon_social?: string;
  rut?: string;
  tipo_proveedor?: string;
  pais?: string;
  contacto_nombre?: string;
  contacto_cargo?: string;
  descripcion?: string;
  logo_url?: string;
  email?: string;
  phone?: string;
  address?: string;
  rubro?: string;
  condicion_pago?: string;
}

export interface SupplierUpdatePayload {
  nombre?: string;
  razon_social?: string;
  rut?: string;
  tipo_proveedor?: string;
  pais?: string;
  contacto_nombre?: string;
  contacto_cargo?: string;
  descripcion?: string;
  logo_url?: string;
  email?: string;
  phone?: string;
  address?: string;
  rubro?: string;
  condicion_pago?: string;
}

export interface SupplierCatalogProductItem {
  id: number;
  supplier_id: number;
  sku_proveedor: string;
  sku_calcu?: string | null;
  nombre: string;
  rubro: string;
  costo_compra: number;
  precio_venta_comercios: number;
  precio_venta_publico: number;
  descuento_comercios_pct: number;
  margen_reventa_pct: number;
  markup_costo_pct: number;
  stock_estimado: string;
  updated_at?: string;
}

export interface SupplierCatalogProductsResponse {
  success: boolean;
  supplier_id: number;
  supplier_name: string;
  total: number;
  items: SupplierCatalogProductItem[];
}

export interface SupplierCatalogTenderAwardItem {
  id: string;
  description: string;
  quantity: number;
  unitName: string;
  unitPrice: number;
  totalPrice: number;
  currency: string;
}

export interface SupplierCatalogTenderContract {
  id: string;
  ocid?: string;
  title: string;
  buyerName: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  itemsCount: number;
  items: SupplierCatalogTenderAwardItem[];
}

export interface SupplierCatalogTendersResponse {
  success: boolean;
  supplier: {
    id: number;
    nombre: string;
    razon_social?: string | null;
    rut?: string | null;
    tipo_proveedor?: string;
    rubro?: string;
  };
  remote_matched: boolean;
  total_contracts: number;
  contracts: SupplierCatalogTenderContract[];
}

export interface SupplierCatalogUploadResponse {
  success: boolean;
  message: string;
  processed: number;
  created: number;
  updated: number;
}

// =====================================================================
// PRESUPUESTO: LÍNEAS DE CENTRO DE COSTO
// =====================================================================
export interface CostCenterBudgetCreatePayload {
  periodo: string;
  centro_costo_id: number;
  concepto_opex: string;
  monto_presupuestado: number;
  monto_real?: number;
}

export interface CostCenterBudgetUpdatePayload {
  concepto_opex?: string;
  monto_presupuestado?: number;
  monto_real?: number;
}

export interface CostCenterBudgetSingleResponse {
  id: number;
  periodo: string;
  centro_costo_id: number;
  centro_costo_codigo: string;
  centro_costo_nombre: string;
  concepto_opex: string;
  monto_presupuestado: number;
  monto_real: number;
  variacion_monto: number;
  variacion_pct: number;
  estado: string;
}

// =====================================================================
// MODELOS OLLAMA DINÁMICOS
// =====================================================================
export interface OllamaModelItem {
  name: string;
  size: number;
  size_formatted: string;
  modified_at?: string | null;
  digest?: string | null;
  is_active: boolean;
}

export interface OllamaModelsResponse {
  models: OllamaModelItem[];
  active_model: string;
  total: number;
  ollama_running: boolean;
}

export interface ActiveModelRequest {
  model: string;
}

export interface ActiveModelResponse {
  status: string;
  active_model: string;
  message: string;
}

// =====================================================================
// PRICING AI BUNDLES & STRATEGIC PACKS
// =====================================================================
export interface BundleProductItem {
  sku: string;
  nombre: string;
  stock_actual: number;
  doh: number;
  precio_regular_usd: number;
  costo_unitario_usd: number;
  es_sobrestock: boolean;
}

export interface AIBundleItem {
  id: string;
  nombre_pack: string;
  descripcion: string;
  productos: BundleProductItem[];
  precio_individual_total_usd: number;
  precio_bundle_sugerido_usd: number;
  descuento_bundle_pct: number;
  margen_neto_pct: number;
  capital_inmovilizado_liberado_usd: number;
  m2_liberados_estimados: number;
  argumento_comercial: string;
  evaluacion_marketing: string;
  evaluacion_finanzas: string;
  evaluacion_logistica: string;
}

export interface PricingAIBundlesResponse {
  status: string;
  total_bundles_sugeridos: number;
  dictamen_cfo: string;
  bundles: AIBundleItem[];
}

// =====================================================================
// PROVEEDORES REVENTA & LOTES LOCALES UY
// =====================================================================
export interface ReventaBatchCreatePayload {
  supplier_id: number;
  sku: string;
  sku_proveedor?: string;
  descripcion: string;
  cantidad: number;
  precio_venta: number;
  costo_compra?: number;
  warehouse_destino_id?: string;
  observaciones?: string;
}

export interface BatchApprovePayload {
  accion: 'APROBADO' | 'RECHAZADO';
  notas?: string;
}

// =====================================================================
// PRESUPUESTOS IMPLÍCITOS & LOGÍSTICA
// =====================================================================
export type TipoServicioLogistico = 'MARITIMO' | 'SEGURO' | 'ADUANA' | 'FLETE_CAMION' | 'OTRO';

export interface ImplicitServiceItem {
  id: number;
  tipo_servicio: TipoServicioLogistico;
  nombre_servicio: string;
  descripcion?: string | null;
  unidad_medida: string;
  costo_referencia_usd: number;
  moneda: string;
  proveedor_sugerido_id?: number | null;
  activo: boolean;
}

export interface ImplicitServiceCreatePayload {
  tipo_servicio: TipoServicioLogistico;
  nombre_servicio: string;
  descripcion?: string;
  unidad_medida?: string;
  costo_referencia_usd: number;
  moneda?: string;
  proveedor_sugerido_id?: number;
}

export interface ImplicitBudgetItem {
  id?: number;
  servicio_catalogo_id?: number | null;
  supplier_id?: number | null;
  supplier_nombre?: string | null;
  tipo_servicio: string;
  concepto: string;
  cantidad: number;
  costo_unitario_usd: number;
  subtotal_usd: number;
  observaciones?: string | null;
}

export interface ImplicitBudgetOrder {
  id: number;
  numero_presupuesto: string;
  titulo: string;
  buque_o_embarque?: string | null;
  orden_compra_importacion_id?: number | null;
  total_usd: number;
  moneda: string;
  estado_aprobacion: 'BORRADOR' | 'PENDIENTE_APROBACION' | 'APROBADO' | 'RECHAZADO' | string;
  aprobado_por_usuario?: string | null;
  observaciones?: string | null;
  created_at?: string;
  items: ImplicitBudgetItem[];
}

export interface ImplicitBudgetOrderCreate {
  titulo: string;
  buque_o_embarque?: string;
  orden_compra_importacion_id?: number;
  items: {
    servicio_catalogo_id?: number;
    supplier_id?: number;
    tipo_servicio: string;
    concepto: string;
    cantidad: number;
    costo_unitario_usd: number;
    observaciones?: string;
  }[];
  observaciones?: string;
}

// =====================================================================
// ÓRDENES DE COMPRA LOCALES (URUGUAY / REVENTA)
// =====================================================================
export interface LocalPurchaseOrderItem {
  sku: string;
  sku_proveedor?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  precio_venta_sugerido: number;
}

export interface LocalPurchaseOrderCreate {
  supplier_id: number;
  fecha_disponible: string;
  destino_warehouse_id?: string;
  observaciones?: string;
  items: LocalPurchaseOrderItem[];
}

export interface LocalPurchaseOrder {
  id: number;
  numero_orden: string;
  supplier_id: number;
  supplier_nombre: string;
  tipo_orden: string;
  estado: string;
  fecha_disponible?: string | null;
  monto_total: number;
  destino_warehouse_id?: string | null;
  destino_warehouse_nombre?: string | null;
  observaciones?: string | null;
  created_at: string;
  items: any[];
}




// =====================================================================
// CAZADOR DE OPORTUNIDADES: MERCADO LIBRE URUGUAY VS ALIBABA B2B
// =====================================================================
export interface MluCategoryInfo {
  id: string;
  name: string;
  path: string;
  icon?: string;
}

export interface ArbitrageScanRequest {
  category_id?: string;
  article_name?: string;
  min_price?: number;
  max_price?: number;
  currency?: 'UYU' | 'USD';
  ollama_model?: string;
  limit?: number;
}

export interface ArbitrageItemResponse {
  ranking: number;
  mlu_id: string;
  mlu_title: string;
  mlu_category_id: string;
  mlu_category_name: string;
  mlu_seller_name: string;
  mlu_price_uyu: number;
  mlu_price_usd: number;
  mlu_sold_quantity: number;
  mlu_permalink: string;
  mlu_thumbnail?: string | null;
  trend_signal: string;
  b2b_english_query: string;
  alibaba_supplier: string;
  alibaba_years: string;
  alibaba_verified: boolean;
  alibaba_fob_price_usd: number;
  alibaba_moq: number;
  alibaba_search_url: string;
  shipping_logistics_usd: number;
  landed_cost_usd: number;
  mlu_fee_usd: number;
  net_margin_usd: number;
  net_margin_pct: number;
  markup: number;
  roi_pct: number;
  recommendation: string;
  status_color: string;
}

export interface ArbitrageSummaryMetrics {
  avg_net_margin_pct: number;
  avg_markup: number;
  high_profit_opportunities: number;
  total_catalog_scanned: number;
}

export interface ArbitrageScanResponse {
  status: string;
  total_items: number;
  category_analyzed: string;
  article_filter?: string | null;
  currency_filter: string;
  min_price?: number | null;
  max_price?: number | null;
  exchange_rate_used: number;
  ollama_model_used: string;
  execution_time_seconds: number;
  summary_metrics: ArbitrageSummaryMetrics;
  items: ArbitrageItemResponse[];
}


// =====================================================================
// HUB DE LICITACIONES E INTELIGENCIA ESTATAL B2B (URUGUAY PROCUREMENT API)
// =====================================================================

export interface ProcurementCallItem {
  _id?: string;
  compraId: number | string;
  title: string;
  buyer?: {
    id?: string;
    name?: string;
  };
  procuringEntity?: {
    id?: string;
    name?: string;
  };
  status?: string;
  publishDate?: string;
  firstSeenAt?: string;
  tenderPeriod?: {
    startDate?: string;
    endDate?: string;
  };
  procurementMethodDetails?: string;
  classificationSet?: string[];
  ocid?: string;
  amount?: number;
  currency?: string;
}

export interface ProcurementCallsResponse {
  success: boolean;
  data: {
    calls: ProcurementCallItem[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages?: number;
    };
  };
  message?: string;
}

export interface ProcurementCallSummaryData {
  objeto?: string;
  requisitosClave?: string | string[];
  documentacionRequerida?: string | string[];
  formaCotizacion?: string;
  plazos?: string | {
    recepcionOfertas?: string;
    aperturaOfertas?: string;
    consultas?: string;
    [key: string]: any;
  };
  plazoEjecucion?: string;
  garantias?: string | Record<string, any>;
  criteriosEvaluacion?: string | string[];
  montoReferencia?: string;
  observaciones?: string | string[];
  model?: string;
  generatedAt?: string;
  sourceDocs?: string[];
  disclaimer?: string;
  docsSignature?: string;
}

export interface ProcurementCallSummaryResponse {
  success: boolean;
  data: {
    available: boolean;
    summary?: ProcurementCallSummaryData;
    stale?: boolean;
    generating?: boolean;
  };
}

export interface ProcurementBaselineItem {
  currency: string;
  unitName: string;
  n: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface ProcurementSupplierWinSummary {
  id: string;
  name: string;
  spendUYU: number;
  lines: number;
}

export interface ProcurementBuyerSummary {
  id: string;
  name: string;
  spendUYU: number;
  lines: number;
}

export interface ProcurementBenchmarkItem {
  classificationId?: string;
  siceCode?: string;
  codigoArticulo?: string;
  label: string;
  description?: string;
  descripcion?: string;
  product?: {
    contractCount?: number;
    buyerCount?: number;
    supplierCount?: number;
    totalUYU?: number;
    firstYear?: number;
    lastYear?: number;
    topSuppliers?: ProcurementSupplierWinSummary[];
    topBuyers?: ProcurementBuyerSummary[];
  };
  priceBaselines?: ProcurementBaselineItem[];
  medianValue?: number;
  precioMediano?: number;
  minValue?: number;
  maxValue?: number;
  currency?: string;
  unitName?: string;
  sampleCount?: number;
  contractCount?: number;
  totalContratos?: number;
  topSuppliers?: ProcurementSupplierWinSummary[];
  recentContracts?: Array<{
    id?: string;
    name?: string;
    proveedor?: string;
    organismo?: string;
    buyer?: string;
    fecha?: string;
    precio?: number;
    spendUYU?: number;
    lines?: number;
  }>;
  topBuyers?: ProcurementBuyerSummary[];
  hasHistory?: boolean;
}

export interface ProcurementCallBenchmarksResponse {
  success: boolean;
  compraId?: string;
  data: {
    compraId?: string;
    benchmarks?: ProcurementBenchmarkItem[];
    items?: ProcurementBenchmarkItem[];
  };
}

export interface ProcurementTechnicalOpinionRequest {
  vertical_id?: string;
  model?: string;
  custom_notes?: string;
  titulo?: string;
  organismo?: string;
  monto_estimado?: number;
  plazo_entrega_dias?: number;
  summary?: any;
  benchmarks?: any;
}

export interface ProcurementTechnicalOpinionResponse {
  compra_id: string;
  vertical_id: string;
  perito_rol: string;
  perito_nombre: string;
  dictamen_markdown: string;
  viable: boolean;
  alerta_riesgo?: string | null;
  fuente_ia: string;
}

export interface ProcurementSaveTrackingPayload {
  compra_id: string;
  proyecto_nombre: string;
  cliente_licitacion: string;
  nicho?: string;
  fecha_apertura?: string;
  plazo_entrega_dias?: number;
  moneda?: string;
  monto_referencia?: number;
  pliego_url?: string;
  observaciones?: string;
}

export interface ProcurementCompetitiveMarkupRequest {
  sku?: string;
  costo_nacionalizado?: number;
  product_code?: string;
  precio_mediana_sice?: number;
  moneda?: string;
  cantidad_solicitada?: number;
  tasa_cambio_brou?: number;
  descuento_estrategico_pct?: number;
}

export interface ProcurementCompetitiveMarkupResponse {
  sku?: string;
  product_code?: string;
  descripcion_producto?: string;
  costo_nacionalizado_mvd: number;
  precio_mediana_sice: number;
  precio_ganador_sugerido: number;
  rango_competitivo_min: number;
  rango_competitivo_max: number;
  markup_pct: number;
  margen_bruto_pct: number;
  contribucion_unitaria: number;
  contribucion_total: number;
  moneda: string;
  probabilidad_ganar: 'ALTA' | 'MEDIA' | 'RIESGOSA' | string;
  diagnostico_estrategico: string;
}

export interface ProcurementProductItem {
  _id?: string;
  code: string;
  description: string;
  canonicalName?: string;
  lineCount?: number;
  contractCount?: number;
  buyerCount?: number;
  supplierCount?: number;
  totalUYU?: number;
  currencies?: string[];
  unitName?: string;
  rubroPath?: string;
  famiName?: string;
  subfName?: string;
  clasName?: string;
  subcName?: string;
  priceUnits?: any[];
}

export interface ProcurementProductsResponse {
  success: boolean;
  data: {
    products: ProcurementProductItem[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages?: number;
    };
  };
}

export interface ProcurementProductDetailResponse {
  success: boolean;
  data: ProcurementProductItem & {
    topBuyers?: Array<{ buyerId: string; name: string; totalUYU: number; contractCount: number }>;
    topSuppliers?: Array<{ supplierId: string; name: string; totalUYU: number; contractCount: number }>;
    byYear?: Array<{ year: number; totalUYU: number; contractCount: number }>;
    variants?: any[];
  };
}

export interface ProcurementSupplierItem {
  _id?: string;
  id?: string;
  supplierId?: string;
  name: string;
  totalValue?: number;
  totalAmount?: number;
  totalContracts?: number;
  transactionCount?: number;
  avgContractValue?: number;
  rank?: number;
  category?: string;
  description?: string;
  buyerCount?: number;
  buyers?: any[];
  topCategories?: any[];
}

export interface ProcurementSuppliersResponse {
  success: boolean;
  data: {
    suppliers: ProcurementSupplierItem[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages?: number;
    };
  };
}

export interface ProcurementSupplierDetailResponse {
  success: boolean;
  data: {
    supplier: ProcurementSupplierItem;
    dei?: any;
    rupe?: {
      rut?: string;
      razonSocial?: string;
      estado?: string;
      vigencia?: string;
    };
    contact?: any;
    recentContracts?: Array<{
      id?: string;
      compraId?: string;
      title?: string;
      buyerName?: string;
      amount?: number;
      currency?: string;
      date?: string;
      method?: string;
    }>;
  };
}

export interface ProcurementBuyerItem {
  _id?: string;
  buyerId?: string;
  name: string;
  totalSpending?: number;
  totalContracts?: number;
  supplierCount?: number;
  avgContractValue?: number;
  topCategories?: any[];
}

export interface ProcurementBuyersResponse {
  success: boolean;
  data: {
    buyers: ProcurementBuyerItem[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages?: number;
    };
  };
}

export interface ProcurementIntendenciasResponse {
  success: boolean;
  data: {
    departments: Array<{
      name: string;
      code?: string;
      totalSpendingUYU?: number;
      totalSpend?: number;
      totalContracts?: number;
      methodsBreakdown?: {
        directa?: number;
        abreviada?: number;
        publica?: number;
      };
      topSuppliers?: Array<{ name: string; totalUYU: number }>;
    }>;
    byYear?: any[];
    national?: any;
    calculatedAt?: string;
  };
}

export interface ProcurementCalendarItem {
  compraId: string;
  title: string;
  buyer: string;
  status: string;
  endDate: string;
  sourceUrl?: string;
  saved: boolean;
  matched: boolean;
  category?: string[];
  dias_restantes?: number;
  semaforo_logistico: 'VERDE' | 'AMARILLO' | 'ROJO';
  semaforo_color: 'emerald' | 'amber' | 'rose' | string;
  diagnostico_logistico: string;
  stock_mvd_disponible: number;
  stock_transito: number;
}

export interface ProcurementCalendarResponse {
  success: boolean;
  data: {
    items: ProcurementCalendarItem[];
    total: number;
    deposito_central_mvd_unidades: number;
    transito_maritimo_unidades: number;
    timestamp?: string;
  };
}

// =====================================================================
// DIMENSIÓN: FACTURACIÓN B2B (e-Facturas CFE DGI)
// =====================================================================
export interface InvoiceItem {
  id?: number;
  sku_id?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  tasa_iva_pct: number;
  subtotal: number;
  monto_iva: number;
  total: number;
}

export interface Invoice {
  id: number;
  numero_factura: string;
  serie: string;
  tipo_cfe: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  cliente_nombre: string;
  cliente_rut: string;
  cliente_documento?: string;
  tipo_documento_receptor?: string;
  es_consumidor_final?: boolean;
  orden_compra_ref?: string;
  factura_referencia_id?: number;
  cliente_direccion?: string;
  moneda: string;
  tipo_cambio: number;
  subtotal: number;
  monto_iva_basico: number;
  monto_iva_minimo: number;
  monto_iva_exento: number;
  total: number;
  estado: 'EMITIDA' | 'COBRADA' | 'ANULADA' | string;
  forma_pago: string;
  notas?: string;
  items_count?: number;
  items?: InvoiceItem[];
}

export interface InvoiceSummary {
  periodo: string;
  total_facturado: number;
  iva_debito_fiscal: number;
  cuentas_por_cobrar: number;
  total_cobrado: number;
  cantidad_facturas: number;
  cantidad_anuladas: number;
}

// =====================================================================
// DIMENSIÓN: GASTOS & LIBROS CONTABLES (Accounting Ledger)
// =====================================================================
export interface ExpenseItem {
  id: number;
  fecha: string;
  proveedor_beneficiario: string;
  rut_proveedor?: string;
  concepto: string;
  categoria_gasto: string;
  centro_costo_id?: number;
  centro_costo_nombre?: string;
  subtotal_neto: number;
  tasa_iva_pct: number;
  monto_iva: number;
  monto_total: number;
  moneda: string;
  numero_comprobante?: string;
  forma_pago: string;
  estado: string;
}

export interface JournalLineItem {
  id: number;
  cuenta_codigo: string;
  cuenta_nombre: string;
  debe: number;
  haber: number;
}

export interface JournalEntryItem {
  id: number;
  numero_asiento: number;
  fecha: string;
  glosa: string;
  tipo_operacion: string;
  referencia_doc?: string;
  total_debe: number;
  total_haber: number;
  balanceado: boolean;
  lines: JournalLineItem[];
}

export interface TaxSummaryResponse {
  periodo: string;
  ventas_netas: number;
  gastos_netos: number;
  iva_debito_fiscal: number;
  iva_credito_fiscal: number;
  saldo_iva_neto: number;
  estado_iva: 'A_PAGAR' | 'SALDO_A_FAVOR' | string;
  nomina_imponible: number;
  bps_patronal_jubilatorio: number;
  bps_fonasa: number;
  total_bps: number;
  anticipo_irae: number;
  total_obligaciones_fiscales: number;
  recomendacion_fiscal_ia: string;
}

// =====================================================================
// DIMENSIÓN: MONITOREO & USUARIOS (Audit & RBAC)
// =====================================================================
export interface AuditLogItem {
  id: number;
  timestamp: string;
  fecha: string;
  hora: string;
  user_id: string;
  role: string;
  action: string;
  resource: string;
  ip_address?: string;
  ubicacion?: string;
  evento_realizado: string;
  severidad: 'INFO' | 'WARNING' | 'CRITICAL' | string;
  details?: any;
}

export interface SystemUserItem {
  id: number;
  username: string;
  email: string;
  nombre_completo: string;
  puesto: string;
  role: string;
  restricted_modules: string[];
  activo: boolean;
  created_at: string;
  last_login?: string;
}

// =====================================================================
// BÚSQUEDA PREDICTIVA & AUTOCOMPLETADO (>2 CARACTERES)
// =====================================================================
export interface ProductSearchResult {
  sku: string;
  nombre: string;
  descripcion: string;
  precio_unitario: number;
  costo: number;
  stock_actual: number;
  tasa_iva_pct: number;
  origen: string;
}

export interface ClientSearchResult {
  id: number;
  nombre: string;
  razon_social: string;
  nombre_fantasia: string;
  rut: string;
  documento: string;
  tipo_documento: string;
  es_consumidor_final: boolean;
  email?: string;
  phone?: string;
  address?: string;
  limite_credito: number;
  deuda_acumulada: number;
  cupo_disponible: number;
  bloqueo_credito: boolean;
}

// =====================================================================
// GESTIÓN DE COBRANZAS & DEUDORES (KANBAN 5 ETAPAS)
// =====================================================================
export interface DebtorInvoiceItem {
  id: number;
  numero_factura: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  dias_vencido: number;
  moneda: string;
  total: number;
}

export interface DebtorItem {
  client_id?: number;
  cliente_nombre: string;
  cliente_rut: string;
  tipo_documento: string;
  es_consumidor_final: boolean;
  email?: string;
  phone?: string;
  address?: string;
  limite_credito: number;
  monto_total_deuda: number;
  dias_max_vencido: number;
  etapa: '1_NUEVO_DEUDOR' | '2_CONTACTADO' | '3_ADVERTIDO' | '4_COMPLICADO' | '5_JURIDICO' | string;
  facturas_numeros: string[];
  facturas?: DebtorInvoiceItem[];
  facturas_detalle?: DebtorInvoiceItem[];
  excede_limite?: boolean;
  cupo_disponible?: number;
}

export interface CollectionsKanbanStage {
  id: string;
  titulo: string;
  descripcion: string;
  color: string;
  items: DebtorItem[];
  total_monto: number;
}

export interface CollectionsOverviewResponse {
  resumen: {
    total_cartera_vencida: number;
    cantidad_deudores: number;
    dias_mora_promedio: number;
    casos_criticos_60d: number;
  };
  kanban: Record<string, CollectionsKanbanStage>;
  deudores: DebtorItem[];
}

export interface LegalNoticeResponse {
  cliente_nombre: string;
  cliente_rut: string;
  monto_total: number;
  dias_vencido: number;
  facturas: string[];
  texto_intimacion: string;
}

export interface GeneralLedgerMovement {
  fecha: string;
  asiento: number;
  glosa: string;
  referencia?: string;
  debe: number;
  haber: number;
}

export interface GeneralLedgerAccount {
  cuenta_codigo: string;
  cuenta_nombre: string;
  total_debe: number;
  total_haber: number;
  saldo: number;
  movimientos: GeneralLedgerMovement[];
}

export interface DashboardMetricsResponse {
  fecha_reporte: string;
  deudores: {
    resumen: {
      total_cartera_vencida: number;
      cantidad_deudores: number;
      dias_mora_promedio: number;
      casos_criticos_60d: number;
    };
    etapas: Array<{
      etapa: string;
      titulo: string;
      monto: number;
      cantidad: number;
      color: string;
    }>;
    total_deudores: number;
  };
  vendedores: Array<{
    nombre: string;
    ventas: number;
    cobrado: number;
    mora: number;
    clientes: number;
    cumplimiento_meta_pct: number;
  }>;
  asistencia_horarios: Array<{
    usuario: string;
    username: string;
    puesto: string;
    hora_ingreso: string;
    hora_egreso: string;
    nodo_tailscale: string;
    estado_conexion: string;
    tiempo_sesion: string;
  }>;
  top_productos: Array<{
    sku: string;
    descripcion: string;
    unidades_vendidas: number;
    total_facturado: number;
    margen_estimado_pct: number;
  }>;
  formas_pago: Array<{
    forma_pago: string;
    monto: number;
    porcentaje: number;
  }>;
  medios_compra: Array<{
    canal: string;
    monto: number;
    participacion_pct: number;
    ordenes: number;
  }>;
}

// --- MÓDULOS NUEVOS: HUB DE INTEGRACIONES MULTICANAL, CHAT OMNICANAL IA & MULTI-TENANT SAAS ---

export interface IntegrationChannelConfig {
  id: number;
  tenant_id: string;
  channel: 'GOOGLE_ADS' | 'META_ADS' | 'WHATSAPP' | 'WHATSAPP_QR' | 'EMAIL' | 'WEB_FORM' | 'MERCADO_LIBRE' | string;
  display_name: string;
  is_enabled: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'PENDING_CREDENTIALS' | 'AUTH_ERROR' | string;
  masked_credentials: Record<string, string>;
  webhook_url: string;
  webhook_token_masked: string;
  auto_reply_enabled: boolean;
  assigned_seller_strategy: string;
  default_seller: string;
  cost_per_lead_usd: number;
  leads_captured_count: number;
  deals_won_count: number;
  revenue_closed_usd: number;
  estimated_roas: number;
  last_tested_at?: string | null;
  updated_at: string;
}

export interface WhatsAppQRSessionResponse {
  channel: string;
  tenant_id: string;
  current_status: string;
  qr_token: string;
  qr_svg: string;
  pairing_code: string;
  expires_in_seconds: number;
  bridge_online?: boolean;
  bridge_connection?: string;
  bridge_linked_phone?: string | null;
  instructions: string[];
}

export interface WhatsAppQRStatusResponse {
  channel: string;
  status: string;
  is_enabled: boolean;
  bridge_online: boolean;
  bridge_connection: string;
  linked_phone?: string | null;
  qr_svg?: string | null;
  masked_credentials: Record<string, string>;
  channel_config?: IntegrationChannelConfig;
}

export interface OmnichannelConversationSummary {
  deal_id: string;
  proyecto_nombre: string;
  cliente: string;
  vendedor: string;
  etapa: DealStage;
  monto_total: number;
  moneda: string;
  canal_origen: LeadSourceChannel;
  utm_campaign?: string | null;
  email?: string | null;
  phone?: string | null;
  ai_score: number;
  ai_classification: string;
  last_message_text: string;
  last_message_channel: string;
  last_message_at: string;
  messages_count: number;
}

export interface OmnichannelMessageItem {
  id: number;
  deal_id: string;
  channel: string;
  direction: 'INBOUND' | 'OUTBOUND';
  sender_name: string;
  sender_address?: string | null;
  message_text: string;
  delivery_status: string;
  is_ai_generated: boolean;
  created_at: string;
}

export interface AIChatSuggestionItem {
  id: string;
  title: string;
  channel_recommended: string;
  text: string;
}

export interface AIChatSuggestionResponse {
  deal_id: string;
  ai_engine: string;
  lead_analysis: {
    canal_origen: string;
    utm_campaign: string;
    ai_score: number;
    ai_classification: string;
    detected_intent: string;
    catalog_matched: string;
  };
  suggestions: AIChatSuggestionItem[];
}

export interface TenantAccountItem {
  id: string;
  slug: string;
  nombre_empresa: string;
  rut?: string | null;
  schema_name: string;
  db_strategy: string;
  license_tier: 'STARTER' | 'PRO' | 'ENTERPRISE_3PL' | string;
  simulated_tier: 'STARTER' | 'PRO' | 'ENTERPRISE_3PL' | string;
  effective_tier: 'STARTER' | 'PRO' | 'ENTERPRISE_3PL' | string;
  subscription_status: 'TRIAL_14_DAYS' | 'ACTIVE_PAID' | 'SUSPENDED' | 'EXPIRED' | string;
  trial_days_remaining: number;
  trial_ends_at: string;
  max_users: number;
  admin_email: string;
  admin_username: string;
  mrr_usd: number;
  is_active: boolean;
  created_at: string;
  capabilities: {
    name: string;
    price_monthly_usd: number;
    max_users: number;
    allowed_channels: string[];
    ai_autopilot: boolean;
    b2b_invoicing: boolean;
    module_3pl: boolean;
    restricted_modules: string[];
    features: string[];
  };
}

// --- MERCADO LIBRE URUGUAY (MLU) - CATÁLOGO, PUBLICACIÓN & ANALÍTICA ---
export interface MeliReadyProductItem {
  id: number;
  sku: string;
  nombre: string;
  categoria: string;
  costo_base: number;
  precio_lista: number;
  deposito_central: number;
  image_url?: string | null;
}

export interface MeliCategoryPrediction {
  category_id: string;
  category_name: string;
  domain_id?: string;
  domain_name?: string;
  attributes?: any[];
}

export interface MeliPublishItemPayload {
  product_id?: number;
  sku?: string;
  title: string;
  category_id: string;
  price: number;
  currency_id?: string;
  available_quantity: number;
  condition?: string;
  listing_type_id?: string;
  pictures?: string[];
  image_url?: string;
  description?: string;
  attributes?: any[];
}

export interface MeliPublishItemResponse {
  status: string;
  item_id: string;
  title: string;
  permalink: string;
  price: number;
  available_quantity: number;
  meli_status: string;
  raw_response?: any;
}

export interface MeliUpdateItemPayload {
  available_quantity?: number;
  price?: number;
  status?: string;
  sku?: string;
}

export interface MeliSyncStockResponse {
  item_id: string;
  sku: string;
  deposito_central_stock: number;
  meli_available_quantity: number;
  status: string;
  message: string;
}

export interface MeliSellerReputationResponse {
  seller_id: number;
  nickname: string;
  site_id: string;
  permalink?: string;
  reputation_level: string;
  power_seller_status?: string;
  transactions_completed: number;
  transactions_canceled: number;
  ratings_positive: number;
  ratings_negative: number;
  status?: Record<string, any>;
}

export interface MeliItemAnalyticsResponse {
  item_id: string;
  title: string;
  price: number;
  currency_id: string;
  status: string;
  available_quantity: number;
  sold_quantity: number;
  visits_last_30d: number;
  questions_total: number;
  questions_unanswered: number;
  conversion_rate_pct: number;
  permalink?: string;
  thumbnail?: string;
}




