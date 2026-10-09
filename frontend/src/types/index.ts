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

export interface DiscountSimulationRequest {
  base_price?: number;
  cost?: number;
  sku?: string;
  discount_pct: number;
  channel?: string;
  commission_pct?: number;
  freight?: number;
}

export interface DiscountSimulationResponse {
  discount_pct: number;
  effective_price: number;
  channel?: string;
  commission_pct?: number;
  freight?: number;
  gross_margin: number;
  gross_margin_pct: number;
  unit_contribution_margin: number;
  marginal_ratio: number;
  markup_pct: number;
  below_threshold_15pct?: boolean;
  is_viable: boolean;
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

export type UserRole = 'analista_comercial' | 'analista_operaciones' | 'controller_admin';

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
}

export interface BudgetAISuggestResponse {
  periodo: string;
  total_sugerido: number;
  total_unidades: number;
  suggestions: BudgetCategorySuggestion[];
  analisis_resumen: string;
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

export interface CommercialDeal {
  id: string;
  proyecto_nombre: string;
  cliente: string;
  rut?: string;
  logo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
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
export type WarehouseType = 'CENTRAL' | 'SUCURSAL' | 'TRANSITO' | 'FABRICA' | string;

export interface WarehouseItem {
  id: string;
  nombre: string;
  tipo: WarehouseType;
  ubicacion: string;
  capacidad_unidades: number;
  activo: boolean;
  created_at?: string;
}

export interface WarehouseCreatePayload {
  id: string;
  nombre: string;
  tipo?: WarehouseType;
  ubicacion: string;
  capacidad_unidades?: number;
  activo?: boolean;
}

export interface WarehouseUpdatePayload {
  nombre?: string;
  tipo?: WarehouseType;
  ubicacion?: string;
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
export type BatchStage = 'fabricacion' | 'transito' | 'deposito_central' | 'deposito_salto' | 'showroom_pocitos';

export interface StockBatchItem {
  id: string;
  lote: string;
  sku: string;
  producto_nombre?: string;
  image_url?: string | null;
  cantidad: number;
  etapa_logistica: BatchStage;
  warehouse_id: string;
  warehouse_nombre?: string;
  buque_o_tracking?: string | null;
  fecha_despacho?: string | null;
  fecha_eta?: string | null;
  dias_restantes_eta?: number | null;
  origen_tipo: 'ROP' | 'STOCK_DIRECTO';
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

export interface TenderImportFeedResponse {
  status: string;
  message: string;
  tender_id: string;
  feed_item: TenderFeedItem;
  evaluation: any;
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
  deals_count: number;
  total_pipeline: number;
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
}

export interface ClientUpdatePayload {
  nombre?: string;
  rut?: string;
  logo_url?: string;
  email?: string;
  phone?: string;
  address?: string;
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
  rut?: string | null;
  logo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  total_skus: number;
  productos: SupplierProductItem[];
  created_at?: string;
}

export interface SupplierCreatePayload {
  nombre: string;
  rut?: string;
  logo_url?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface SupplierUpdatePayload {
  nombre?: string;
  rut?: string;
  logo_url?: string;
  email?: string;
  phone?: string;
  address?: string;
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



