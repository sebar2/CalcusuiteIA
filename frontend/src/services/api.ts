import axios from 'axios';
import type {
  InventoryAlertItem,
  InventoryQuickUpdatePayload,
  InventoryQuickUpdateResponse,
  MarginSummaryItem,
  DiscountSimulationRequest,
  DiscountSimulationResponse,
  BudgetVarianceItem,
  BudgetScenarioResponse,
  SupplyActionPlanResponse,
  CrossReportResponse,
  UserPreferences,
  ETLUploadResponse,
  MultilevelVarianceResponse,
  SupplyKanbanResponse,
  SupplyOrder,
  InitiativeEvaluationRequest,
  InitiativeEvaluationResponse,
  AccionCompromiso,
  AuditLog,
  OllamaStatus,
  SupplyOrderUpdate,
  InitiativeBenchmarkRequest,
  InitiativeBenchmarkResponse,
  AvailablePeriodsResponse,
  BudgetSeedResponse,
  CompetitorItemResponse,
  CompetitorSearchRequest,
  CompetitorSearchResponse,
  CompetitorSelectionEvaluationRequest,
  CompetitorSelectionEvaluationResponse,
  BudgetManualBatchRequest,
  BudgetManualBatchResponse,
  BudgetAISuggestResponse,
  BudgetPeriodDeleteResponse,
  CategoryItem,
  CategoryCreateRequest,
  BROUExchangeRateResponse,
  CostCenterItem,
  CostCenterCreateRequest,
  CostCenterBudgetReportResponse,
  CostCenterBatchRequest,
  CostCenterBatchResponse,
  CostCenterTotalOpexResponse,
  AreaItem,
  AreaCreateRequest,
  ResponsibleUserItem,
  ResponsibleUserCreateRequest,
  TenderEvaluateRequest,
  TenderEvaluateResponse,
  TenderSummaryItem,
  TenderDetailResponse,
  CommercialDeal,
  CommercialDealCreatePayload,
  CommercialDealUpdatePayload,
  DealStage,
  StockLocationBatch,
  StockLocationBatchCreatePayload,
  StockTransferPayload,
  StockLocationSummary,
  WarehouseItem,
  WarehouseCreatePayload,
  WarehouseUpdatePayload,
  AreaUpdatePayload,
  ResponsibleUserUpdatePayload,
  BudgetCommitmentItem,
  BudgetCommitmentCreatePayload,
  BudgetCommitmentUpdatePayload,
  BudgetCommitmentAIAuditResponse,
  PurchaseOrderSuggestionsResponse,
  SalesOrder,
  SalesOrderGeneratePayload,
  StockBatchItem,
  WarehouseTransferPayload,
  WarehouseAssignStockPayload,
  WarehouseStockItem,
  TenderLiveFeedResponse,
  TenderImportFeedRequest,
  TenderFeedSyncRequest,
  TenderImportFeedResponse,
  BiddingVerticalItem,
  BiddingVerticalCreate,
  BiddingKeywordItem,
  BiddingKeywordBulkCreate,
  BiddingAIExpandKeywordsRequest,
  BiddingAIExpandKeywordsResponse,
  PricingAIBundlesResponse,
  ClientItem,
  ClientCreatePayload,
  ClientUpdatePayload,
  SupplierItem,
  SupplierCreatePayload,
  SupplierUpdatePayload,
  SupplierCatalogProductItem,
  SupplierCatalogProductsResponse,
  SupplierCatalogTendersResponse,
  SupplierCatalogUploadResponse,
  CostCenterBudgetCreatePayload,
  CostCenterBudgetUpdatePayload,
  CostCenterBudgetSingleResponse,
  OllamaModelsResponse,
  ActiveModelRequest,
  ActiveModelResponse,
  ReventaBatchCreatePayload,
  BatchApprovePayload,
  ImplicitServiceItem,
  ImplicitServiceCreatePayload,
  ImplicitBudgetOrder,
  ImplicitBudgetOrderCreate,
  LocalPurchaseOrder,
  LocalPurchaseOrderCreate,
  MluCategoryInfo,
  ArbitrageScanRequest,
  ArbitrageScanResponse,
  ProcurementCallsResponse,
  ProcurementCallSummaryResponse,
  ProcurementCallBenchmarksResponse,
  ProcurementTechnicalOpinionRequest,
  ProcurementTechnicalOpinionResponse,
  ProcurementSaveTrackingPayload,
  ProcurementCompetitiveMarkupRequest,
  ProcurementCompetitiveMarkupResponse,
  ProcurementProductsResponse,
  ProcurementProductDetailResponse,
  ProcurementSuppliersResponse,
  ProcurementSupplierDetailResponse,
  ProcurementBuyersResponse,
  ProcurementIntendenciasResponse,
  ProcurementCalendarResponse,
  Invoice,
  InvoiceSummary,
  ExpenseItem,
  JournalEntryItem,
  TaxSummaryResponse,
  AuditLogItem,
  SystemUserItem,
  ProductSearchResult,
  ClientSearchResult,
  CollectionsOverviewResponse,
  LegalNoticeResponse,
  GeneralLedgerAccount,
  DashboardMetricsResponse,
  IntegrationChannelConfig,
  OmnichannelConversationSummary,
  OmnichannelMessageItem,
  AIChatSuggestionResponse,
  TenantAccountItem,
} from '../types';

export const CUSTOM_API_STORAGE_KEY = 'calcu_custom_api_url';

export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(CUSTOM_API_STORAGE_KEY);
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
    // Si corre en la app nativa APK (Capacitor), usar directamente la IP Tailscale del host sebahost
    const isCapacitorNative = !!(window as any).Capacitor?.isNativePlatform?.();
    if (isCapacitorNative) {
      return 'http://100.119.40.92:8000';
    }
    if (window.location && window.location.hostname) {
      const host = window.location.hostname;
      if (host !== 'localhost' && host !== '127.0.0.1') {
        return `${window.location.protocol}//${host}:8000`;
      }
    }
  }
  return 'http://localhost:8000';
};

export const setCustomApiBaseUrl = (url: string) => {
  if (typeof window !== 'undefined') {
    if (!url || !url.trim()) {
      localStorage.removeItem(CUSTOM_API_STORAGE_KEY);
    } else {
      localStorage.setItem(CUSTOM_API_STORAGE_KEY, url.trim().replace(/\/+$/, ''));
    }
  }
};

export const getWsBaseUrl = (): string => {
  const httpUrl = getApiBaseUrl();
  return httpUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
};

const API_BASE_URL = getApiBaseUrl();

export const TOKEN_STORAGE_KEY = 'calcu_access_token';
export const USER_STORAGE_KEY = 'calcu_user';

export interface StoredUser {
  token: string;
  user_id: string;
  role: string;
  nombre?: string;
  tenant_id?: string;
  company_name?: string;
  license_tier?: string;
  simulated_tier?: string;
  subscription_status?: string;
  trial_days_remaining?: number;
  two_factor_enabled?: boolean;
  is_master_superadmin?: boolean;
  mfa_required?: boolean;
}

export const getStoredUser = (): StoredUser | null => {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    if (!token || !userJson) return null;
    const parsed = JSON.parse(userJson);
    return {
      token,
      user_id: parsed.user_id,
      role: parsed.role,
      nombre: parsed.nombre,
      tenant_id: parsed.tenant_id || 'tenant_calcu_corp',
      company_name: parsed.company_name || 'Calcu Corporación Central S.A.',
      license_tier: parsed.license_tier || 'ENTERPRISE_3PL',
      simulated_tier: parsed.simulated_tier || parsed.license_tier || 'ENTERPRISE_3PL',
      subscription_status: parsed.subscription_status || 'ACTIVE_PAID',
      trial_days_remaining: parsed.trial_days_remaining ?? 14,
      two_factor_enabled: Boolean(parsed.two_factor_enabled),
      is_master_superadmin: Boolean(parsed.is_master_superadmin),
    };
  } catch {
    return null;
  }
};

let currentRole: string = 'controller_admin';
let currentUserId: string = 'default_user';

// Inicializar contexto desde localStorage si existe
const initialUser = getStoredUser();
if (initialUser) {
  currentRole = initialUser.role;
  currentUserId = initialUser.user_id;
}

export const setCurrentAuthContext = (role: string, userId: string = 'default_user') => {
  currentRole = role;
  currentUserId = userId;
};

export const getCurrentRole = () => {
  const user = getStoredUser();
  return user?.role || currentRole;
};

export const logout = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  currentRole = 'controller_admin';
  currentUserId = 'default_user';
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('calcu:auth:logout'));
  }
};

export const login = async (
  username: string,
  password: string,
  captchaToken?: string,
  captchaAnswer?: string,
  totpCode?: string
): Promise<StoredUser> => {
  const payload: Record<string, any> = { username, password };
  if (captchaToken) payload.captcha_token = captchaToken;
  if (captchaAnswer !== undefined) payload.captcha_answer = captchaAnswer;
  if (totpCode) payload.totp_code = totpCode;

  const res = await axios.post(`${getApiBaseUrl()}/api/v1/auth/login`, payload);
  const data = res.data;

  if (data.mfa_required) {
    return {
      token: '',
      user_id: data.user_id,
      role: data.role,
      nombre: data.nombre,
      mfa_required: true,
    };
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
  const storedMeta = {
    user_id: data.user_id,
    role: data.role,
    nombre: data.nombre,
    tenant_id: data.tenant_id || 'tenant_calcu_corp',
    company_name: data.company_name || 'Calcu Corporación Central S.A.',
    license_tier: data.license_tier || 'ENTERPRISE_3PL',
    simulated_tier: data.simulated_tier || data.license_tier || 'ENTERPRISE_3PL',
    subscription_status: data.subscription_status || 'ACTIVE_PAID',
    trial_days_remaining: data.trial_days_remaining ?? 14,
    two_factor_enabled: Boolean(data.two_factor_enabled),
    is_master_superadmin: Boolean(data.is_master_superadmin),
  };
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(storedMeta));
  currentRole = data.role;
  currentUserId = data.user_id;
  const user: StoredUser = {
    token: data.access_token,
    ...storedMeta,
  };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('calcu:auth:login', { detail: user }));
  }
  return user;
};

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 600000, // 10 minutos (600.000 ms) para Benchmarking en profundidad
});

apiClient.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  const stored = getStoredUser();
  if (stored?.token) {
    config.headers['Authorization'] = `Bearer ${stored.token}`;
    config.headers['X-User-Role'] = stored.role;
    config.headers['X-User-Id'] = stored.user_id;
    if (stored.tenant_id) {
      config.headers['X-Tenant-Id'] = stored.tenant_id;
    }
  } else {
    config.headers['X-User-Role'] = currentRole;
    config.headers['X-User-Id'] = currentUserId;
  }
  return config;
});


apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/api/v1/auth/login');
      if (!isLoginRequest) {
        logout();
      }
    }
    return Promise.reject(error);
  }
);

export const apiService = {
  // Inventario y Abastecimiento
  async getCategories(): Promise<string[]> {
    const res = await apiClient.get<string[]>('/api/v1/inventory/categories');
    return res.data;
  },

  async getCategoryEntities(): Promise<CategoryItem[]> {
    const res = await apiClient.get<CategoryItem[]>('/api/v1/categories');
    return res.data;
  },

  async createCategory(payload: CategoryCreateRequest): Promise<CategoryItem> {
    const res = await apiClient.post<CategoryItem>('/api/v1/categories', payload);
    return res.data;
  },

  async getInventoryAlerts(params?: { only_alerts?: boolean; categoria?: string }): Promise<InventoryAlertItem[]> {
    const res = await apiClient.get<InventoryAlertItem[]>('/api/v1/inventory/alerts', { params });
    return res.data;
  },

  async updateInventoryQuick(sku: string, payload: InventoryQuickUpdatePayload): Promise<InventoryQuickUpdateResponse> {
    const res = await apiClient.patch<InventoryQuickUpdateResponse>(`/api/v1/inventory/${sku}`, payload);
    return res.data;
  },

  // Pricing y Márgenes
  async getPricingMargins(params?: { categoria?: string; sku?: string }): Promise<MarginSummaryItem[]> {
    const res = await apiClient.get<MarginSummaryItem[]>('/api/v1/pricing/margins', { params });
    return res.data;
  },

  async simulatePricing(payload: DiscountSimulationRequest): Promise<DiscountSimulationResponse> {
    const res = await apiClient.post<DiscountSimulationResponse>('/api/v1/pricing/simulate', payload);
    return res.data;
  },

  // Variaciones de Presupuesto
  async getBudgetVariance(params?: { periodo?: string; tipo?: string; categoria?: string }): Promise<BudgetVarianceItem[]> {
    const res = await apiClient.get<BudgetVarianceItem[]>('/api/v1/budget/variance', { params });
    return res.data;
  },

  async getAvailablePeriods(): Promise<AvailablePeriodsResponse> {
    const res = await apiClient.get<AvailablePeriodsResponse>('/api/v1/budget/available-periods');
    return res.data;
  },

  async seedBudgetFromActuals(periodo: string): Promise<BudgetSeedResponse> {
    const res = await apiClient.post<BudgetSeedResponse>('/api/v1/budget/seed-from-actuals', null, {
      params: { periodo },
    });
    return res.data;
  },

  // Copiloto Asesor IA & FP&A 3 Escenarios
  async getBudgetScenarios(payload: {
    target_period?: string;
    override_base_revenue?: number;
    scenario_conservative_growth_pct?: number;
    scenario_base_growth_pct?: number;
    scenario_aggressive_growth_pct?: number;
    inflation_rate_pct?: number;
    cogs_efficiency_factor?: number;
  }): Promise<BudgetScenarioResponse> {
    const res = await apiClient.post<BudgetScenarioResponse>('/api/v1/advisor/budget-scenarios', payload);
    return res.data;
  },

  async applyBudgetScenario(payload: {
    periodo: string;
    scenario_name: string;
    partidas: { centro_costo_id: number; monto_presupuestado: number; concepto_opex: string }[];
  }): Promise<{ status: string; periodo: string; partidas_actualizadas: number; message?: string }> {
    const res = await apiClient.post<{ status: string; periodo: string; partidas_actualizadas: number; message?: string }>(
      '/api/v1/budget/apply-scenario',
      payload
    );
    return res.data;
  },

  async getSupplyActionPlan(payload: {
    items?: any[];
    target_doh?: number;
  }): Promise<SupplyActionPlanResponse> {
    const res = await apiClient.post<SupplyActionPlanResponse>('/api/v1/advisor/supply-action-plan', payload);
    return res.data;
  },

  async getCrossReport(payload: {
    audience: string;
    periodo?: string;
    extra_context?: string;
  }): Promise<CrossReportResponse> {
    const res = await apiClient.post<CrossReportResponse>('/api/v1/advisor/generate-cross-report', payload);
    return res.data;
  },

  // Ingesta ETL
  async uploadSpreadsheet(file: File): Promise<ETLUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<ETLUploadResponse>('/api/v1/etl/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  // Preferencias de Usuario (Persistencia FASE 1)
  async getUserPreferences(userId: string = 'default_user'): Promise<UserPreferences> {
    const res = await apiClient.get<UserPreferences>('/api/v1/settings/preferences', {
      params: { user_id: userId },
    });
    return res.data;
  },

  async saveUserPreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    const res = await apiClient.post<UserPreferences>('/api/v1/settings/preferences', preferences);
    return res.data;
  },

  // ===================================================================
  // DIMENSIONES COCKPIT DEL ANALISTA DE NEGOCIO Y PERFORMANCE
  // ===================================================================

  // Dimensión 1: Multilevel Variance
  async getMultilevelVariance(periodo?: string): Promise<MultilevelVarianceResponse> {
    const res = await apiClient.get<MultilevelVarianceResponse>('/api/v1/variance/multilevel', {
      params: { periodo },
    });
    return res.data;
  },

  // Dimensión 3: Supply Kanban Pipeline
  async getSupplyKanban(): Promise<SupplyKanbanResponse> {
    const res = await apiClient.get<SupplyKanbanResponse>('/api/v1/supply/kanban');
    return res.data;
  },

  async updateSupplyOrderStage(orderId: number, targetStage: string): Promise<SupplyOrder> {
    const res = await apiClient.patch<SupplyOrder>(`/api/v1/supply/orders/${orderId}/stage`, {
      target_stage: targetStage,
    });
    return res.data;
  },

  async createSupplyOrder(order: {
    sku_id: string;
    cantidad: number;
    monto_total: number;
    proveedor: string;
    etapa?: string;
    responsable: string;
    fecha_arribo_estimada: string;
  }): Promise<SupplyOrder> {
    const res = await apiClient.post<SupplyOrder>('/api/v1/supply/orders', order);
    return res.data;
  },

  // Dimensión 4: Evaluador de Iniciativas
  async evaluateInitiative(req: InitiativeEvaluationRequest): Promise<InitiativeEvaluationResponse> {
    const res = await apiClient.post<InitiativeEvaluationResponse>('/api/v1/initiatives/evaluate', req);
    return res.data;
  },

  // Dimensión 5: Minutas y Acciones Cross-Área
  async getExecutiveSummaryMinutes(payload: {
    audience: string;
    periodo?: string;
    extra_context?: string;
  }): Promise<CrossReportResponse> {
    const res = await apiClient.post<CrossReportResponse>('/api/v1/advisor/executive-summary', payload);
    return res.data;
  },

  async getActions(area?: string): Promise<AccionCompromiso[]> {
    const res = await apiClient.get<AccionCompromiso[]>('/api/v1/actions', {
      params: { area },
    });
    return res.data;
  },

  async createAction(payload: {
    titulo: string;
    area: string;
    responsable: string;
    fecha_limite: string;
    estado?: string;
    origen?: string;
  }): Promise<AccionCompromiso> {
    const res = await apiClient.post<AccionCompromiso>('/api/v1/actions', payload);
    return res.data;
  },

  async createActionsBatch(acciones: {
    titulo: string;
    area: string;
    responsable: string;
    fecha_limite: string;
    estado?: string;
    origen?: string;
  }[]): Promise<AccionCompromiso[]> {
    const res = await apiClient.post<AccionCompromiso[]>('/api/v1/actions/batch', { acciones });
    return res.data;
  },

  async updateAction(id: number, data: Partial<AccionCompromiso>): Promise<AccionCompromiso> {
    const res = await apiClient.put<AccionCompromiso>(`/api/v1/actions/${id}`, data);
    return res.data;
  },

  async deleteAction(id: number): Promise<{ status: string; message: string }> {
    const res = await apiClient.delete<{ status: string; message: string }>(`/api/v1/actions/${id}`);
    return res.data;
  },

  // MÓDULO PRICING: Packs y Bundles Estratégicos con IA
  async getAIBundles(payload?: { model?: string; engine_mode?: string } | string): Promise<PricingAIBundlesResponse> {
    const body = typeof payload === 'object' ? payload : { engine_mode: payload || 'local_ai' };
    const res = await apiClient.post<PricingAIBundlesResponse>('/api/v1/pricing/ai-bundles-suggest', body, {
      timeout: 0,
    });
    return res.data;
  },

  // Dimensión 3: Actualizar orden de reposición (modal y stage)
  async updateOrder(orderId: number, data: SupplyOrderUpdate): Promise<SupplyOrder> {
    const res = await apiClient.patch<SupplyOrder>(`/api/v1/orders/${orderId}`, data);
    return res.data;
  },

  // Dimensión 4: Benchmarking Cruzado de Iniciativas (DB + Web)
  async benchmarkInitiative(payload: InitiativeBenchmarkRequest): Promise<InitiativeBenchmarkResponse> {
    const res = await apiClient.post<InitiativeBenchmarkResponse>('/api/v1/initiatives/ai-benchmark', payload);
    return res.data;
  },

  // Verificación de salud y modelos de Ollama en tiempo real
  async getOllamaStatus(): Promise<OllamaStatus> {
    const res = await apiClient.get<OllamaStatus>('/api/v1/advisor/ollama-status');
    return res.data;
  },

  // Dimensión 6: Trazabilidad y Auditoría
  async getAuditLogs(limit: number = 20): Promise<AuditLog[]> {
    const res = await apiClient.get<AuditLog[]>('/api/v1/audit/logs', {
      params: { limit },
    });
    return res.data;
  },

  // MÓDULO 1: Stepper 3 Fases - Búsqueda de competidores (hasta 10 min en Axios)
  async searchCompetitors(req: CompetitorSearchRequest): Promise<CompetitorSearchResponse | CompetitorItemResponse[]> {
    const res = await apiClient.post<CompetitorSearchResponse | CompetitorItemResponse[]>('/api/v1/initiatives/search-competitors', req, {
      timeout: 600000,
    });
    return res.data;
  },

  // MÓDULO 1: Stepper 3 Fases - Evaluación de la selección con IA
  async evaluateCompetitorSelection(req: CompetitorSelectionEvaluationRequest): Promise<CompetitorSelectionEvaluationResponse> {
    const res = await apiClient.post<CompetitorSelectionEvaluationResponse>('/api/v1/initiatives/evaluate-selection', req, {
      timeout: 0, // Inferencia completa sin interrupción
    });
    return res.data;
  },

  // MÓDULO: Sugerencias IA de Iniciativas según Tendencias de Mercado & Costos Reales
  async getInitiativeAiSuggestions(): Promise<{
    status: string;
    model_used: string;
    sugerencias: Array<{
      titulo: string;
      categoria: string;
      capex_estimado: number;
      costos_fijos_mensuales: number;
      costo_unitario: number;
      precio_target: number;
      volumen_mensual_estimado: number;
      tendencia_mercado: string;
      fuentes_comprobables: string[];
      justificacion_retorno: string;
    }>;
  }> {
    const res = await apiClient.get<any>('/api/v1/initiatives/ai-suggestions');
    return res.data;
  },

  // MÓDULO 3: Presupuesto en Blanco - Carga Manual (V0)
  async saveBudgetManualBatch(payload: BudgetManualBatchRequest): Promise<BudgetManualBatchResponse> {
    const res = await apiClient.post<BudgetManualBatchResponse>('/api/v1/budget/manual-batch', payload);
    return res.data;
  },

  // MÓDULO 3: Sugerencia de Presupuesto Asistida por IA
  async getAIBudgetSuggestions(periodo: string, engineMode: string = 'auto'): Promise<BudgetAISuggestResponse> {
    const res = await apiClient.post<BudgetAISuggestResponse>('/api/v1/budget/ai-suggest', null, {
      params: { periodo, engine_mode: engineMode },
      timeout: 0, // Inferencia completa sin interrupción para modelos densos (gemma4:31b)
    });
    return res.data;
  },

  async getAIBudgetGoals(periodo: string, engineMode: string = 'auto'): Promise<BudgetAISuggestResponse> {
    const res = await apiClient.post<BudgetAISuggestResponse>('/api/v1/budget/ai-goals', null, {
      params: { periodo, engine_mode: engineMode },
      timeout: 0, // Inferencia profunda sin timeout
    });
    return res.data;
  },

  // MÓDULO 3: Reiniciar / Limpiar Período Presupuestario (Admin)
  async deleteBudgetPeriod(periodo: string): Promise<BudgetPeriodDeleteResponse> {
    const res = await apiClient.delete<BudgetPeriodDeleteResponse>(`/api/v1/budget/period/${periodo}`);
    return res.data;
  },

  // Cotización oficial BROU (Banco República)
  async getBROUExchangeRate(forceRefresh: boolean = false): Promise<BROUExchangeRateResponse> {
    const res = await apiClient.get<BROUExchangeRateResponse>('/api/v1/finance/exchange-rate/brou', {
      params: { force_refresh: forceRefresh }
    });
    return res.data;
  },

  // MÓDULO: Centros de Costo & Presupuestos OPEX
  async getCostCenters(activeOnly: boolean = false): Promise<CostCenterItem[]> {
    const res = await apiClient.get<CostCenterItem[]>('/api/v1/cost-centers', {
      params: { active_only: activeOnly },
    });
    return res.data;
  },

  async createCostCenter(payload: CostCenterCreateRequest): Promise<CostCenterItem> {
    const res = await apiClient.post<CostCenterItem>('/api/v1/cost-centers', payload);
    return res.data;
  },

  async getCostCenterBudgetReport(periodo: string): Promise<CostCenterBudgetReportResponse> {
    const res = await apiClient.get<CostCenterBudgetReportResponse>('/api/v1/budget/cost-centers', {
      params: { periodo },
    });
    return res.data;
  },

  async saveCostCenterBudgetBatch(payload: CostCenterBatchRequest): Promise<CostCenterBatchResponse> {
    const res = await apiClient.post<CostCenterBatchResponse>('/api/v1/budget/cost-centers/batch', payload);
    return res.data;
  },

  async getTotalMonthlyOpex(periodo: string): Promise<CostCenterTotalOpexResponse> {
    const res = await apiClient.get<CostCenterTotalOpexResponse>('/api/v1/budget/cost-centers/total-opex', {
      params: { periodo },
    });
    return res.data;
  },

  // MÓDULO: Áreas y Responsables de la Organización
  async getAreas(): Promise<AreaItem[]> {
    const res = await apiClient.get<AreaItem[]>('/api/v1/areas');
    return res.data;
  },

  async createArea(payload: AreaCreateRequest): Promise<AreaItem> {
    const res = await apiClient.post<AreaItem>('/api/v1/areas', payload);
    return res.data;
  },

  async getUsers(areaId?: number): Promise<ResponsibleUserItem[]> {
    const res = await apiClient.get<ResponsibleUserItem[]>('/api/v1/users', {
      params: areaId ? { area_id: areaId } : undefined,
    });
    return res.data;
  },

  async createUser(payload: ResponsibleUserCreateRequest): Promise<ResponsibleUserItem> {
    const res = await apiClient.post<ResponsibleUserItem>('/api/v1/users', payload);
    return res.data;
  },

  // MÓDULO: Licitaciones & Proyectos B2B (Fusión Luminar -> Calcu)
  async evaluateTender(payload: TenderEvaluateRequest): Promise<TenderEvaluateResponse> {
    const res = await apiClient.post<TenderEvaluateResponse>('/api/v1/tenders/evaluate', payload);
    return res.data;
  },

  async createTender(payload: TenderEvaluateRequest): Promise<TenderSummaryItem> {
    const res = await apiClient.post<TenderSummaryItem>('/api/v1/tenders', payload);
    return res.data;
  },

  async getTenders(): Promise<TenderSummaryItem[]> {
    const res = await apiClient.get<TenderSummaryItem[]>('/api/v1/tenders');
    return res.data;
  },

  async getTenderDetail(id: string): Promise<TenderDetailResponse> {
    const res = await apiClient.get<TenderDetailResponse>(`/api/v1/tenders/${id}`);
    return res.data;
  },

  // MÓDULO 1: Pipeline Comercial (CRM)
  async getDeals(etapa?: string, vendedor?: string): Promise<CommercialDeal[]> {
    const res = await apiClient.get<CommercialDeal[]>('/api/v1/deals', {
      params: { etapa, vendedor },
    });
    return res.data;
  },

  async createDeal(payload: CommercialDealCreatePayload): Promise<CommercialDeal> {
    const res = await apiClient.post<CommercialDeal>('/api/v1/deals', payload);
    return res.data;
  },

  async updateDeal(id: string, payload: CommercialDealUpdatePayload): Promise<CommercialDeal> {
    const res = await apiClient.put<CommercialDeal>(`/api/v1/deals/${id}`, payload);
    return res.data;
  },

  async updateDealStage(id: string, etapa: DealStage): Promise<CommercialDeal> {
    const res = await apiClient.put<CommercialDeal>(`/api/v1/deals/${id}/stage`, { etapa });
    return res.data;
  },

  async patchDealStage(id: string, etapa: string): Promise<CommercialDeal> {
    const res = await apiClient.patch<CommercialDeal>(`/api/v1/crm/deals/${id}/stage`, { etapa });
    return res.data;
  },

  async deleteDeal(id: string): Promise<{ status: string; message: string }> {
    const res = await apiClient.delete<{ status: string; message: string }>(`/api/v1/deals/${id}`);
    return res.data;
  },

  // MÓDULO 2: Monitor de Stock Multi-Ubicación & Tránsito
  async getStockLocationsSummary(): Promise<StockLocationSummary> {
    const res = await apiClient.get<StockLocationSummary>('/api/v1/stock-locations/summary');
    return res.data;
  },

  async getStockBatches(ubicacion?: string): Promise<StockLocationBatch[]> {
    const res = await apiClient.get<StockLocationBatch[]>('/api/v1/stock-locations/batches', {
      params: { ubicacion },
    });
    return res.data;
  },

  async createStockBatch(payload: StockLocationBatchCreatePayload): Promise<StockLocationBatch> {
    const res = await apiClient.post<StockLocationBatch>('/api/v1/stock-locations/batches', payload);
    return res.data;
  },

  async transferStockBatch(payload: StockTransferPayload): Promise<StockLocationBatch> {
    const res = await apiClient.post<StockLocationBatch>('/api/v1/stock-locations/transfer', payload);
    return res.data;
  },

  async autoArriveStockBatches(): Promise<{ status: string; batches_processed: number; message: string }> {
    const res = await apiClient.post<{ status: string; batches_processed: number; message: string }>('/api/v1/stock-locations/auto-arrive');
    return res.data;
  },

  // MÓDULO: Gobernanza Multi-Depósito & Almacenes Físicos
  async getWarehouses(): Promise<WarehouseItem[]> {
    const res = await apiClient.get<WarehouseItem[]>('/api/v1/warehouses');
    return res.data;
  },

  async createWarehouse(payload: WarehouseCreatePayload): Promise<WarehouseItem> {
    const res = await apiClient.post<WarehouseItem>('/api/v1/warehouses', payload);
    return res.data;
  },

  async updateWarehouse(id: string, payload: WarehouseUpdatePayload): Promise<WarehouseItem> {
    const res = await apiClient.put<WarehouseItem>(`/api/v1/warehouses/${id}`, payload);
    return res.data;
  },

  async deleteWarehouse(id: string): Promise<{ status: string; warehouse_id: string; message: string }> {
    const res = await apiClient.delete<{ status: string; warehouse_id: string; message: string }>(`/api/v1/warehouses/${id}`);
    return res.data;
  },

  async getWarehouseStock(warehouseId: string): Promise<WarehouseStockItem[]> {
    const res = await apiClient.get<WarehouseStockItem[]>(`/api/v1/warehouses/${warehouseId}/stock`);
    return res.data;
  },

  // MÓDULO: Actualización de Áreas y Usuarios
  async updateArea(id: number, payload: AreaUpdatePayload): Promise<AreaItem> {
    const res = await apiClient.put<AreaItem>(`/api/v1/areas/${id}`, payload);
    return res.data;
  },

  async updateUser(id: number, payload: ResponsibleUserUpdatePayload): Promise<ResponsibleUserItem> {
    const res = await apiClient.put<ResponsibleUserItem>(`/api/v1/users/${id}`, payload);
    return res.data;
  },

  // MÓDULO: Compromisos Presupuestarios & Auditoría IA
  async getCommitments(): Promise<BudgetCommitmentItem[]> {
    const res = await apiClient.get<BudgetCommitmentItem[]>('/api/v1/commitments');
    return res.data;
  },

  async createCommitment(payload: BudgetCommitmentCreatePayload): Promise<BudgetCommitmentItem> {
    const res = await apiClient.post<BudgetCommitmentItem>('/api/v1/commitments', payload);
    return res.data;
  },

  async updateCommitment(id: number | string, payload: BudgetCommitmentUpdatePayload): Promise<BudgetCommitmentItem> {
    const res = await apiClient.put<BudgetCommitmentItem>(`/api/v1/commitments/${id}`, payload);
    return res.data;
  },

  async auditCommitmentsAI(periodo?: string): Promise<BudgetCommitmentAIAuditResponse> {
    const res = await apiClient.post<BudgetCommitmentAIAuditResponse>('/api/v1/commitments/ai-audit', null, {
      params: { periodo },
    });
    return res.data;
  },

  // MÓDULO: Motor de Órdenes de Compra Inteligentes (Cruce Stock x CRM)
  async getPurchaseOrderSuggestions(): Promise<PurchaseOrderSuggestionsResponse> {
    const res = await apiClient.post<PurchaseOrderSuggestionsResponse>('/api/v1/purchase-orders/suggestions');
    return res.data;
  },

  // MÓDULO: Órdenes de Venta (CRM Sales Orders)
  async generateSalesOrder(dealId: string, payload: SalesOrderGeneratePayload): Promise<SalesOrder> {
    const res = await apiClient.post<SalesOrder>(`/api/v1/deals/${dealId}/generate-sales-order`, payload);
    return res.data;
  },

  async getSalesOrdersByDeal(dealId: string): Promise<SalesOrder[]> {
    const res = await apiClient.get<SalesOrder[]>(`/api/v1/deals/${dealId}/sales-orders`);
    return res.data;
  },

  async getAllSalesOrders(): Promise<SalesOrder[]> {
    const res = await apiClient.get<SalesOrder[]>('/api/v1/sales-orders');
    return res.data;
  },

  async getSalesOrder(orderId: string): Promise<SalesOrder> {
    const res = await apiClient.get<SalesOrder>(`/api/v1/sales-orders/${orderId}`);
    return res.data;
  },

  // MÓDULO: Sincronización ROP & Multi-Depósito por Lote
  async getUnifiedBatches(warehouseId?: string, excludeTestBatches?: boolean): Promise<StockBatchItem[]> {
    const res = await apiClient.get<StockBatchItem[]>('/api/v1/warehouses/batches', {
      params: {
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        ...(excludeTestBatches !== undefined ? { exclude_test_batches: excludeTestBatches } : {}),
      },
    });
    return res.data;
  },

  async transferWarehouseStock(payload: WarehouseTransferPayload): Promise<{ status: string; message: string; batch: StockBatchItem }> {
    const res = await apiClient.post<{ status: string; message: string; batch: StockBatchItem }>('/api/v1/warehouses/transfer', payload);
    return res.data;
  },

  async assignDirectStock(payload: WarehouseAssignStockPayload): Promise<{ status: string; message: string; batch: StockBatchItem }> {
    const res = await apiClient.post<{ status: string; message: string; batch: StockBatchItem }>('/api/v1/warehouses/assign-stock', payload);
    return res.data;
  },

  // MÓDULO REVENTA & APROBACIÓN DE LOTES
  async createReventaBatch(payload: ReventaBatchCreatePayload): Promise<{ status: string; message: string; batch: StockBatchItem }> {
    const res = await apiClient.post<{ status: string; message: string; batch: StockBatchItem }>('/api/v1/warehouses/reventa-batches', payload);
    return res.data;
  },

  async approveBatch(batchId: string, payload: BatchApprovePayload): Promise<{ status: string; message: string; batch: StockBatchItem }> {
    const res = await apiClient.patch<{ status: string; message: string; batch: StockBatchItem }>(`/api/v1/warehouses/batches/${batchId}/approve`, payload);
    return res.data;
  },

  // MÓDULO ÓRDENES DE COMPRA LOCALES (URUGUAY)
  async getLocalPurchaseOrders(params?: { supplier_id?: number; estado?: string }): Promise<LocalPurchaseOrder[]> {
    const res = await apiClient.get<LocalPurchaseOrder[]>('/api/v1/supply/local-orders', { params });
    return res.data;
  },

  async createLocalPurchaseOrder(payload: LocalPurchaseOrderCreate): Promise<{ status: string; message: string; orden: LocalPurchaseOrder }> {
    const res = await apiClient.post<{ status: string; message: string; orden: LocalPurchaseOrder }>('/api/v1/supply/local-orders', payload);
    return res.data;
  },

  // MÓDULO PRESUPUESTOS IMPLÍCITOS & LOGÍSTICA
  async getImplicitCatalog(tipo?: string): Promise<ImplicitServiceItem[]> {
    const res = await apiClient.get<ImplicitServiceItem[]>('/api/v1/supply/implicit-catalog', {
      params: tipo ? { tipo } : undefined,
    });
    return res.data;
  },

  async createImplicitCatalogItem(payload: ImplicitServiceCreatePayload): Promise<ImplicitServiceItem> {
    const res = await apiClient.post<ImplicitServiceItem>('/api/v1/supply/implicit-catalog', payload);
    return res.data;
  },

  async getImplicitBudgets(estado?: string): Promise<ImplicitBudgetOrder[]> {
    const res = await apiClient.get<ImplicitBudgetOrder[]>('/api/v1/supply/implicit-budgets', {
      params: estado ? { estado } : undefined,
    });
    return res.data;
  },

  async createImplicitBudget(payload: ImplicitBudgetOrderCreate): Promise<{ status: string; message: string; presupuesto: ImplicitBudgetOrder }> {
    const res = await apiClient.post<{ status: string; message: string; presupuesto: ImplicitBudgetOrder }>('/api/v1/supply/implicit-budgets', payload);
    return res.data;
  },

  async approveImplicitBudget(id: number, payload: { accion: 'APROBADO' | 'RECHAZADO'; observaciones?: string }): Promise<{ status: string; message: string; presupuesto: ImplicitBudgetOrder }> {
    const res = await apiClient.patch<{ status: string; message: string; presupuesto: ImplicitBudgetOrder }>(`/api/v1/supply/implicit-budgets/${id}/approve`, payload);
    return res.data;
  },

  // PLANTILLA Y CARGA MASIVA DE PROVEEDORES REVENTA
  getReventaTemplateDownloadUrl(): string {
    return `${API_BASE_URL}/api/v1/suppliers/reventa/template`;
  },

  async importReventaExcel(formData: FormData): Promise<{ status: string; records_imported: number; errors: string[]; message: string }> {
    const res = await apiClient.post<{ status: string; records_imported: number; errors: string[]; message: string }>(
      '/api/v1/suppliers/reventa/import',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return res.data;
  },

  // MÓDULO: Feed de Licitaciones B2B Públicas (ARCE / UTE / IMM / OSE - SERLUX)
  async getTendersLiveFeed(params?: { nicho?: string; q?: string; keyword?: string }): Promise<TenderLiveFeedResponse> {
    const res = await apiClient.get<TenderLiveFeedResponse>('/api/v1/tenders/live-feed', { params });
    return res.data;
  },

  async syncTendersFeed(payload?: TenderFeedSyncRequest): Promise<TenderLiveFeedResponse> {
    const res = await apiClient.post<TenderLiveFeedResponse>('/api/v1/tenders/feed/sync', payload);
    return res.data;
  },

  async importTenderFeedItem(payload: TenderImportFeedRequest): Promise<TenderImportFeedResponse> {
    const res = await apiClient.post<TenderImportFeedResponse>('/api/v1/tenders/import-feed-item', payload);
    return res.data;
  },

  // MÓDULO: Licitaciones B2B Multi-Rubro & Gestión de Verticales/Keywords
  async getBiddingVerticals(): Promise<BiddingVerticalItem[]> {
    const res = await apiClient.get<BiddingVerticalItem[]>('/api/v1/bidding/verticals');
    return res.data;
  },

  async createBiddingVertical(payload: BiddingVerticalCreate): Promise<BiddingVerticalItem> {
    const res = await apiClient.post<BiddingVerticalItem>('/api/v1/bidding/verticals', payload);
    return res.data;
  },

  async updateBiddingVertical(verticalId: string, payload: BiddingVerticalCreate): Promise<BiddingVerticalItem> {
    const res = await apiClient.put<BiddingVerticalItem>(`/api/v1/bidding/verticals/${verticalId}`, payload);
    return res.data;
  },

  async getBiddingKeywords(verticalId: string): Promise<BiddingKeywordItem[]> {
    const res = await apiClient.get<BiddingKeywordItem[]>(`/api/v1/bidding/verticals/${verticalId}/keywords`);
    return res.data;
  },

  async addBiddingKeywordsBulk(verticalId: string, payload: BiddingKeywordBulkCreate): Promise<{ status: string; message: string }> {
    const res = await apiClient.post<{ status: string; message: string }>(`/api/v1/bidding/verticals/${verticalId}/keywords`, payload);
    return res.data;
  },

  async deleteBiddingKeyword(keywordId: number): Promise<{ status: string; message: string }> {
    const res = await apiClient.delete<{ status: string; message: string }>(`/api/v1/bidding/keywords/${keywordId}`);
    return res.data;
  },

  async expandBiddingKeywordsAI(payload: BiddingAIExpandKeywordsRequest): Promise<BiddingAIExpandKeywordsResponse> {
    // Sin timeout estricto para modelos locales de Ollama (timeout: 0 desactiva el timeout en axios)
    const res = await apiClient.post<BiddingAIExpandKeywordsResponse>('/api/v1/bidding/ai/expand-keywords', payload, {
      timeout: 0,
    });
    return res.data;
  },

  // DESCARGA DE PLANTILLA MODELO ETL (.XLSX)
  getEtlTemplateDownloadUrl(tipo: string = 'inventario'): string {
    return `${API_BASE_URL}/api/v1/etl/template?tipo=${tipo}`;
  },

  // Autenticación JWT y Gestión de Sesión
  login,
  logout,
  getStoredUser,

  // Exportación Nativa de Reportes Ejecutivos (P1.3)
  downloadExecutiveExcel,
  downloadExecutivePdf,

  // DIRECTORIO B2B: CLIENTES & PROVEEDORES
  async getClients(q?: string): Promise<ClientItem[]> {
    const res = await apiClient.get<ClientItem[]>('/api/v1/crm/clients', { params: q ? { q } : undefined });
    return res.data;
  },

  async createClient(payload: ClientCreatePayload): Promise<ClientItem> {
    const res = await apiClient.post<ClientItem>('/api/v1/crm/clients', payload);
    return res.data;
  },

  async updateClient(id: number, payload: ClientUpdatePayload): Promise<ClientItem> {
    const res = await apiClient.put<ClientItem>(`/api/v1/crm/clients/${id}`, payload);
    return res.data;
  },

  async getSuppliers(
    filterOrQuery?: string | {
      q?: string;
      search?: string;
      tipo?: string;
      tipo_proveedor?: string;
      rubro?: string;
      condicion_pago?: string;
    },
    legacyTipoProveedor?: string
  ): Promise<SupplierItem[]> {
    let params: Record<string, string> = {};

    if (typeof filterOrQuery === 'string') {
      if (filterOrQuery.trim()) params.q = filterOrQuery.trim();
      if (legacyTipoProveedor?.trim()) params.tipo_proveedor = legacyTipoProveedor.trim();
    } else if (filterOrQuery && typeof filterOrQuery === 'object') {
      if (filterOrQuery.search) params.search = filterOrQuery.search;
      if (filterOrQuery.q) params.q = filterOrQuery.q;
      if (filterOrQuery.tipo) params.tipo = filterOrQuery.tipo;
      if (filterOrQuery.tipo_proveedor) params.tipo_proveedor = filterOrQuery.tipo_proveedor;
      if (filterOrQuery.rubro) params.rubro = filterOrQuery.rubro;
      if (filterOrQuery.condicion_pago) params.condicion_pago = filterOrQuery.condicion_pago;
    }

    const res = await apiClient.get<SupplierItem[]>('/api/v1/suppliers', { params });
    return res.data;
  },

  async getSupplierById(id: number): Promise<SupplierItem> {
    const res = await apiClient.get<SupplierItem>(`/api/v1/suppliers/${id}`);
    return res.data;
  },

  async createSupplier(payload: SupplierCreatePayload): Promise<SupplierItem> {
    const res = await apiClient.post<SupplierItem>('/api/v1/suppliers', payload);
    return res.data;
  },

  async updateSupplier(id: number, payload: SupplierUpdatePayload): Promise<SupplierItem> {
    const res = await apiClient.put<SupplierItem>(`/api/v1/suppliers/${id}`, payload);
    return res.data;
  },

  // =========================================================================
  // CATÁLOGOS DE PROVEEDORES: PRODUCTOS (PVP/PVM), INGESTA EXCEL Y LICITACIONES
  // =========================================================================

  async getSupplierCatalogProducts(
    supplierId: number,
    params?: { rubro?: string; search?: string }
  ): Promise<SupplierCatalogProductsResponse> {
    const res = await apiClient.get<SupplierCatalogProductsResponse>(
      `/api/v1/suppliers/${supplierId}/catalog/products`,
      { params }
    );
    return res.data;
  },

  async saveSupplierCatalogProduct(
    supplierId: number,
    payload: {
      sku_proveedor: string;
      sku_calcu?: string | null;
      nombre: string;
      rubro?: string;
      costo_compra: number;
      precio_venta_comercios: number;
      precio_venta_publico: number;
      stock_estimado?: string;
    }
  ): Promise<SupplierCatalogProductItem> {
    const res = await apiClient.post<SupplierCatalogProductItem>(
      `/api/v1/suppliers/${supplierId}/catalog/products`,
      payload
    );
    return res.data;
  },

  async updateSupplierCatalogProduct(
    supplierId: number,
    itemId: number,
    payload: Partial<{
      sku_proveedor: string;
      sku_calcu: string | null;
      nombre: string;
      rubro: string;
      costo_compra: number;
      precio_venta_comercios: number;
      precio_venta_publico: number;
      stock_estimado: string;
    }>
  ): Promise<SupplierCatalogProductItem> {
    const res = await apiClient.put<SupplierCatalogProductItem>(
      `/api/v1/suppliers/${supplierId}/catalog/products/${itemId}`,
      payload
    );
    return res.data;
  },

  async deleteSupplierCatalogProduct(
    supplierId: number,
    itemId: number
  ): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<{ success: boolean; message: string }>(
      `/api/v1/suppliers/${supplierId}/catalog/products/${itemId}`
    );
    return res.data;
  },

  async uploadSupplierCatalogSpreadsheet(
    supplierId: number,
    file: File
  ): Promise<SupplierCatalogUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<SupplierCatalogUploadResponse>(
      `/api/v1/suppliers/${supplierId}/catalog/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return res.data;
  },

  async getSupplierCatalogTenders(supplierId: number): Promise<SupplierCatalogTendersResponse> {
    const res = await apiClient.get<SupplierCatalogTendersResponse>(
      `/api/v1/suppliers/${supplierId}/catalog/tenders`
    );
    return res.data;
  },

  // PRESUPUESTO: CRUD DE PARTIDAS DE CENTRO DE COSTO
  async createCostCenterBudget(payload: CostCenterBudgetCreatePayload): Promise<CostCenterBudgetSingleResponse> {
    const res = await apiClient.post<CostCenterBudgetSingleResponse>('/api/v1/budget/cost-centers', payload);
    return res.data;
  },

  async updateCostCenterBudget(id: number, payload: CostCenterBudgetUpdatePayload): Promise<CostCenterBudgetSingleResponse> {
    const res = await apiClient.put<CostCenterBudgetSingleResponse>(`/api/v1/budget/cost-centers/${id}`, payload);
    return res.data;
  },

  // ASESOR IA & MODELOS OLLAMA
  async getOllamaModels(): Promise<OllamaModelsResponse> {
    const res = await apiClient.get<OllamaModelsResponse>('/api/v1/advisor/models');
    return res.data;
  },

  async setActiveOllamaModel(payload: ActiveModelRequest): Promise<ActiveModelResponse> {
    const res = await apiClient.post<ActiveModelResponse>('/api/v1/advisor/active-model', payload);
    return res.data;
  },

  // CAZADOR DE OPORTUNIDADES: MERCADO LIBRE URUGUAY VS ALIBABA B2B
  async getMluCategories(): Promise<MluCategoryInfo[]> {
    const res = await apiClient.get<MluCategoryInfo[]>('/api/v1/initiatives/mlu/categories');
    return res.data;
  },

  async getArbitrageModels(): Promise<string[]> {
    const res = await apiClient.get<string[]>('/api/v1/initiatives/arbitrage/models');
    return res.data;
  },

  async scanArbitrage(payload: ArbitrageScanRequest): Promise<ArbitrageScanResponse> {
    const res = await apiClient.post<ArbitrageScanResponse>('/api/v1/initiatives/arbitrage/scan', payload, {
      timeout: 180000, // 3 minutos para 100 artículos y LLM
    });
    return res.data;
  },

  async exportArbitrageExcel(payload: ArbitrageScanRequest): Promise<void> {
    const res = await apiClient.post('/api/v1/initiatives/arbitrage/export-excel', payload, {
      responseType: 'blob',
      timeout: 180000,
    });
    const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const catSuffix = payload.category_id || 'ALL';
    downloadBlobFile(
      new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `Arbitraje_MLU_Alibaba_${catSuffix}_${nowStr}.xlsx`
    );
  },

  // =====================================================================
  // HUB DE LICITACIONES E INTELIGENCIA ESTATAL B2B (URUGUAY PROCUREMENT API)
  // =====================================================================
  async getProcurementOpenCalls(params?: {
    limit?: number;
    offset?: number;
    page?: number;
    q?: string;
    buyer?: string;
    category?: string;
    method?: string;
    sort?: string;
    ends_before?: string;
    start_date_from?: string;
    start_date_to?: string;
    end_date_from?: string;
    end_date_to?: string;
  }): Promise<ProcurementCallsResponse> {
    const res = await apiClient.get<ProcurementCallsResponse>('/api/v1/procurement/open-calls', { params });
    return res.data;
  },

  async getProcurementCallSummary(compraId: string | number): Promise<ProcurementCallSummaryResponse> {
    const res = await apiClient.get<ProcurementCallSummaryResponse>(`/api/v1/procurement/open-calls/${compraId}/summary`);
    return res.data;
  },

  async getProcurementCallBenchmarks(compraId: string | number): Promise<ProcurementCallBenchmarksResponse> {
    const res = await apiClient.get<ProcurementCallBenchmarksResponse>(`/api/v1/procurement/open-calls/${compraId}/benchmarks`);
    return res.data;
  },

  async getProcurementTechnicalOpinion(
    compraId: string | number,
    payload: ProcurementTechnicalOpinionRequest
  ): Promise<ProcurementTechnicalOpinionResponse> {
    const res = await apiClient.post<ProcurementTechnicalOpinionResponse>(
      `/api/v1/procurement/open-calls/${compraId}/technical-opinion`,
      payload
    );
    return res.data;
  },

  async auditExpertTender(
    compraId: string | number,
    payload: ProcurementTechnicalOpinionRequest
  ): Promise<ProcurementTechnicalOpinionResponse> {
    const res = await apiClient.post<ProcurementTechnicalOpinionResponse>(
      `/api/v1/procurement/open-calls/${compraId}/audit-expert`,
      payload
    );
    return res.data;
  },

  async saveProcurementTracking(
    compraId: string | number,
    payload: ProcurementSaveTrackingPayload
  ): Promise<{ status: string; message: string }> {
    const res = await apiClient.post<{ status: string; message: string }>(
      `/api/v1/procurement/open-calls/${compraId}/save-tracking`,
      payload
    );
    return res.data;
  },

  async getProcurementSavedTracking(): Promise<any[]> {
    const res = await apiClient.get<any[]>('/api/v1/procurement/saved-tracking');
    return res.data;
  },

  async deleteProcurementSavedTracking(tenderId: string): Promise<{ status: string; message: string }> {
    const res = await apiClient.delete<{ status: string; message: string }>(
      `/api/v1/procurement/saved-tracking/${tenderId}`
    );
    return res.data;
  },

  async getProcurementProducts(params?: {
    q?: string;
    page?: number;
    limit?: number;
    sort_by?: string;
  }): Promise<ProcurementProductsResponse> {
    const res = await apiClient.get<ProcurementProductsResponse>('/api/v1/procurement/products', { params });
    return res.data;
  },

  async getProcurementProductDetail(code: string): Promise<ProcurementProductDetailResponse> {
    const res = await apiClient.get<ProcurementProductDetailResponse>(`/api/v1/procurement/products/${encodeURIComponent(code)}`);
    return res.data;
  },

  async calculateCompetitiveMarkup(
    payload: ProcurementCompetitiveMarkupRequest
  ): Promise<ProcurementCompetitiveMarkupResponse> {
    const res = await apiClient.post<ProcurementCompetitiveMarkupResponse>(
      '/api/v1/procurement/competitive-markup',
      payload
    );
    return res.data;
  },

  async getProcurementSuppliers(params?: {
    search?: string;
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: string;
  }): Promise<ProcurementSuppliersResponse> {
    const res = await apiClient.get<ProcurementSuppliersResponse>('/api/v1/procurement/suppliers', { params });
    return res.data;
  },

  async getProcurementSuppliersAutocomplete(
    search: string,
    limit: number = 10
  ): Promise<{ success: boolean; data: Array<{ value: string; label: string; meta?: any }> }> {
    const res = await apiClient.get<{ success: boolean; data: Array<{ value: string; label: string; meta?: any }> }>(
      '/api/v1/procurement/suppliers/autocomplete',
      { params: { search, limit } }
    );
    return res.data;
  },

  async getProcurementTopSuppliers(limit: number = 15, year?: number): Promise<any> {
    const res = await apiClient.get<any>('/api/v1/procurement/suppliers/top', { params: { limit, year } });
    return res.data;
  },

  async getProcurementSupplierDetail(supplierId: string): Promise<ProcurementSupplierDetailResponse> {
    const res = await apiClient.get<ProcurementSupplierDetailResponse>(
      `/api/v1/procurement/suppliers/${encodeURIComponent(supplierId)}`
    );
    return res.data;
  },

  async getProcurementBuyers(params?: {
    search?: string;
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: string;
  }): Promise<ProcurementBuyersResponse> {
    const res = await apiClient.get<ProcurementBuyersResponse>('/api/v1/procurement/buyers', { params });
    return res.data;
  },

  async getProcurementIntendencias(): Promise<ProcurementIntendenciasResponse> {
    const res = await apiClient.get<ProcurementIntendenciasResponse>('/api/v1/procurement/intendencias');
    return res.data;
  },

  async getProcurementBuyerDetail(buyerId: string, params?: { start_date?: string; end_date?: string }): Promise<any> {
    const res = await apiClient.get<any>(`/api/v1/procurement/buyers/${encodeURIComponent(buyerId)}`, { params });
    return res.data;
  },

  async importCompetitorToSuppliers(payload: {
    id?: string;
    nombre: string;
    razon_social?: string;
    rut?: string;
    rubro?: string;
    email?: string;
    phone?: string;
    address?: string;
    contracts?: any[];
  }): Promise<{
    success: boolean;
    message: string;
    supplier: any;
    imported_items_count: number;
    imported_contracts_count: number;
  }> {
    const res = await apiClient.post('/api/v1/suppliers/import-competitor', payload);
    return res.data;
  },

  async getProcurementCalendar(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<ProcurementCalendarResponse> {
    const res = await apiClient.get<ProcurementCalendarResponse>('/api/v1/procurement/calendar', { params });
    return res.data;
  },

  // ===================================================================
  // DIMENSIÓN: FACTURACIÓN B2B (e-Facturas CFE DGI)
  // ===================================================================
  async getInvoices(params?: {
    periodo?: string;
    estado?: string;
    cliente_rut?: string;
    limit?: number;
  }): Promise<Invoice[]> {
    const res = await apiClient.get<Invoice[]>('/api/v1/invoices', { params });
    return res.data;
  },

  async getInvoiceDetail(invoiceId: number): Promise<Invoice> {
    const res = await apiClient.get<Invoice>(`/api/v1/invoices/${invoiceId}`);
    return res.data;
  },

  async createInvoice(payload: {
    cliente_nombre: string;
    cliente_rut: string;
    cliente_direccion?: string;
    fecha_emision?: string;
    fecha_vencimiento?: string;
    forma_pago?: string;
    tipo_cfe?: string;
    moneda?: string;
    tipo_cambio?: number;
    notas?: string;
    items: Array<{
      sku_id?: string;
      descripcion: string;
      cantidad: number;
      precio_unitario: number;
      tasa_iva_pct: number;
    }>;
  }): Promise<{ success: boolean; message: string; invoice_id: number; numero_factura: string; total: number }> {
    const res = await apiClient.post('/api/v1/invoices', payload);
    return res.data;
  },

  async updateInvoiceStatus(invoiceId: number, estado: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.post(`/api/v1/invoices/${invoiceId}/status`, null, { params: { estado } });
    return res.data;
  },

  async getInvoicesSummary(params?: { periodo?: string }): Promise<InvoiceSummary> {
    const res = await apiClient.get<InvoiceSummary>('/api/v1/invoices/summary', { params });
    return res.data;
  },

  // ===================================================================
  // DIMENSIÓN: GASTOS & LIBROS CONTABLES (Accounting Ledger)
  // ===================================================================
  async getExpenses(params?: {
    periodo?: string;
    categoria?: string;
    centro_costo_id?: number;
    limit?: number;
  }): Promise<ExpenseItem[]> {
    const res = await apiClient.get<ExpenseItem[]>('/api/v1/accounting/expenses', { params });
    return res.data;
  },

  async createExpense(payload: {
    fecha?: string;
    proveedor_beneficiario: string;
    rut_proveedor?: string;
    concepto: string;
    categoria_gasto: string;
    centro_costo_id?: number;
    subtotal_neto: number;
    tasa_iva_pct?: number;
    moneda?: string;
    numero_comprobante?: string;
    forma_pago?: string;
    estado?: string;
  }): Promise<{ success: boolean; message: string; expense_id: number; monto_total: number }> {
    const res = await apiClient.post('/api/v1/accounting/expenses', payload);
    return res.data;
  },

  async getJournal(limit: number = 100): Promise<JournalEntryItem[]> {
    const res = await apiClient.get<JournalEntryItem[]>('/api/v1/accounting/journal', { params: { limit } });
    return res.data;
  },

  async getTaxSummary(periodo?: string): Promise<TaxSummaryResponse> {
    const res = await apiClient.get<TaxSummaryResponse>('/api/v1/accounting/tax-summary', { params: { periodo } });
    return res.data;
  },

  // ===================================================================
  // DIMENSIÓN: MONITOREO & USUARIOS (Audit & RBAC)
  // ===================================================================
  async getMonitoringAuditLogs(params?: {
    severidad?: string;
    search?: string;
    limit?: number;
  }): Promise<AuditLogItem[]> {
    const res = await apiClient.get<AuditLogItem[]>('/api/v1/monitoring/audit-logs', { params });
    return res.data;
  },

  async recordAuditLog(payload: {
    user_id: string;
    role: string;
    action: string;
    resource: string;
    evento_realizado: string;
    severidad?: string;
    ip_address?: string;
    ubicacion?: string;
    details?: any;
  }): Promise<{ success: boolean; id: number; timestamp: string }> {
    const res = await apiClient.post('/api/v1/monitoring/audit-logs', payload);
    return res.data;
  },

  async getSystemUsers(): Promise<SystemUserItem[]> {
    const res = await apiClient.get<SystemUserItem[]>('/api/v1/monitoring/users');
    return res.data;
  },

  async createSystemUser(payload: {
    username: string;
    email: string;
    nombre_completo: string;
    puesto: string;
    role?: string;
    password?: string;
    send_email?: boolean;
    restricted_modules?: string[];
    activo?: boolean;
  }): Promise<{ success: boolean; message: string; user_id: number; restricted_modules: string[] }> {
    const res = await apiClient.post('/api/v1/monitoring/users', payload);
    return res.data;
  },

  async updateUserPermissions(userId: number, payload: {
    puesto?: string;
    role?: string;
    password?: string;
    send_email?: boolean;
    restricted_modules?: string[];
    activo?: boolean;
  }): Promise<{ success: boolean; message: string; restricted_modules: string[] }> {
    const res = await apiClient.put(`/api/v1/monitoring/users/${userId}/permissions`, payload);
    return res.data;
  },

  async sendUserCredentials(userId: number, password?: string): Promise<{ success: boolean; email: string; notified: boolean; message: string }> {
    const res = await apiClient.post(`/api/v1/monitoring/users/${userId}/send-credentials`, password ? { password } : {});
    return res.data;
  },

  async toggleUserActive(userId: number): Promise<{ success: boolean; activo: boolean; message: string }> {
    const res = await apiClient.delete(`/api/v1/monitoring/users/${userId}`);
    return res.data;
  },

  async getPositionPresets(): Promise<Record<string, { role: string; restricted_modules: string[] }>> {
    const res = await apiClient.get<Record<string, { role: string; restricted_modules: string[] }>>('/api/v1/monitoring/presets');
    return res.data;
  },

  // MÓDULO FACTURACIÓN B2B: Búsquedas predictivas, órdenes y notas de crédito
  async searchProductsPredictive(query: string): Promise<ProductSearchResult[]> {
    if (!query || query.trim().length < 2) return [];
    const res = await apiClient.get<ProductSearchResult[]>('/api/v1/invoices/search-products', { params: { q: query.trim() } });
    return res.data;
  },

  async searchClientsPredictive(query: string): Promise<ClientSearchResult[]> {
    if (!query || query.trim().length < 2) return [];
    const res = await apiClient.get<ClientSearchResult[]>('/api/v1/invoices/search-clients', { params: { q: query.trim() } });
    return res.data;
  },

  async getSalesOrdersAvailable(): Promise<any[]> {
    const res = await apiClient.get<any[]>('/api/v1/invoices/sales-orders');
    return res.data;
  },

  // MÓDULO CONTABILIDAD & COBRANZAS: Cobranzas Kanban, Intimación Legal y Libro Mayor
  async getCollectionsOverview(filter_days?: number): Promise<CollectionsOverviewResponse> {
    const res = await apiClient.get<CollectionsOverviewResponse>('/api/v1/accounting/collections/overview', {
      params: filter_days ? { filter_days } : undefined
    });
    return res.data;
  },

  async getLegalNotice(rut: string): Promise<LegalNoticeResponse> {
    const res = await apiClient.get<LegalNoticeResponse>(`/api/v1/accounting/collections/legal-notice/${encodeURIComponent(rut)}`);
    return res.data;
  },

  async getGeneralLedger(periodo?: string): Promise<GeneralLedgerAccount[]> {
    const res = await apiClient.get<GeneralLedgerAccount[]>('/api/v1/accounting/general-ledger', {
      params: periodo ? { periodo } : undefined
    });
    return res.data;
  },

  // MÓDULO MONITOREO: Reportes de Deudores, Dashboard de 6 Cuadrantes y Copiloto IA Gemini
  async getDebtorsReport(filter_days?: number): Promise<{
    filtro_aplicado_dias?: number;
    resumen: any;
    cantidad_deudores: number;
    deudores: any[];
  }> {
    const res = await apiClient.get('/api/v1/monitoring/reports/debtors', {
      params: filter_days ? { filter_days } : undefined
    });
    return res.data;
  },

  async getDashboardMetrics(): Promise<DashboardMetricsResponse> {
    const res = await apiClient.get<DashboardMetricsResponse>('/api/v1/monitoring/dashboard/metrics');
    return res.data;
  },

  async askMonitoringCopilot(prompt: string): Promise<{ success: boolean; model: string; respuesta: string; timestamp: string }> {
    const res = await apiClient.post('/api/v1/monitoring/dashboard/ai-copilot', { prompt });
    return res.data;
  },

  // --- AUTENTICACIÓN AVANZADA: CAPTCHA SVG & 2FA TOTP ---
  async getCaptcha(): Promise<{ captcha_token: string; captcha_svg: string; expires_in_seconds: number }> {
    const res = await apiClient.get('/api/v1/auth/captcha');
    return res.data;
  },

  async setup2FA(): Promise<{ status: string; user_id: string; totp_secret: string; otpauth_uri: string; instructions: string }> {
    const res = await apiClient.post('/api/v1/auth/2fa/setup');
    return res.data;
  },

  async enable2FA(totpCode: string): Promise<{ status: string; two_factor_enabled: boolean; message: string }> {
    const res = await apiClient.post('/api/v1/auth/2fa/enable', { totp_code: totpCode });
    return res.data;
  },

  async disable2FA(): Promise<{ status: string; two_factor_enabled: boolean; message: string }> {
    const res = await apiClient.post('/api/v1/auth/2fa/disable');
    return res.data;
  },

  // --- HUB DE INTEGRACIONES MULTICANAL & ADTECH ---
  async getIntegrationChannels(): Promise<IntegrationChannelConfig[]> {
    const res = await apiClient.get<IntegrationChannelConfig[]>('/api/v1/integrations/channels');
    return res.data;
  },

  async updateIntegrationChannel(
    channel: string,
    payload: {
      is_enabled: boolean;
      credentials?: Record<string, any>;
      auto_reply_enabled?: boolean;
      assigned_seller_strategy?: string;
      default_seller?: string;
      cost_per_lead_usd?: number;
    }
  ): Promise<IntegrationChannelConfig> {
    const res = await apiClient.put<IntegrationChannelConfig>(`/api/v1/integrations/channels/${channel}`, payload);
    return res.data;
  },

  async testIntegrationChannel(channel: string): Promise<{
    channel: string;
    connected: boolean;
    status: string;
    message: string;
  }> {
    const res = await apiClient.post(`/api/v1/integrations/channels/${channel}/test`);
    return res.data;
  },

  async getMeliAuthUrl(redirectUri?: string): Promise<{
    auth_url: string;
    client_id: string;
    redirect_uri: string;
    state: string;
  }> {
    const res = await apiClient.get('/api/v1/integrations/meli/authorize', {
      params: redirectUri ? { redirect_uri: redirectUri } : undefined,
    });
    return res.data;
  },

  async generateWhatsAppQR(): Promise<{
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
  }> {
    const res = await apiClient.post('/api/v1/integrations/whatsapp-qr/generate');
    return res.data;
  },

  async confirmWhatsAppQRScan(payload: {
    qr_token: string;
    linked_phone: string;
    device_label: string;
  }): Promise<IntegrationChannelConfig> {
    const res = await apiClient.post<IntegrationChannelConfig>(
      '/api/v1/integrations/whatsapp-qr/confirm-scan',
      payload
    );
    return res.data;
  },

  async disconnectWhatsAppQR(): Promise<IntegrationChannelConfig> {
    const res = await apiClient.post<IntegrationChannelConfig>('/api/v1/integrations/whatsapp-qr/disconnect');
    return res.data;
  },

  async getWhatsAppQRStatus(): Promise<{
    channel: string;
    status: string;
    is_enabled: boolean;
    bridge_online: boolean;
    bridge_connection: string;
    linked_phone?: string | null;
    qr_svg?: string | null;
    masked_credentials: Record<string, string>;
    channel_config?: IntegrationChannelConfig;
  }> {
    const res = await apiClient.get('/api/v1/integrations/whatsapp-qr/status');
    return res.data;
  },

  async ingestWebhookLead(
    channel: string,
    payload: {
      nombre_contacto: string;
      empresa?: string;
      email?: string;
      telefono?: string;
      proyecto_o_interes?: string;
      mensaje_inicial?: string;
      monto_estimado_usd?: number;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      external_lead_id?: string;
    }
  ): Promise<{
    status: string;
    deal_id: string;
    etapa: string;
    etapa_label: string;
    canal_origen: string;
    assigned_seller: string;
    ai_score: number;
    ai_classification: string;
    message: string;
  }> {
    const res = await apiClient.post(`/api/v1/integrations/webhooks/${channel}`, payload);
    return res.data;
  },

  // --- CHAT OMNICANAL UNIFICADO & COPILOTO IA GRATUITO ---
  async getOmnichannelConversations(canalFilter?: string): Promise<OmnichannelConversationSummary[]> {
    const res = await apiClient.get<OmnichannelConversationSummary[]>('/api/v1/omnichannel/conversations', {
      params: canalFilter && canalFilter !== 'ALL' ? { canal_filter: canalFilter } : undefined,
    });
    return res.data;
  },

  async getOmnichannelMessages(dealId: string): Promise<OmnichannelMessageItem[]> {
    const res = await apiClient.get<OmnichannelMessageItem[]>(`/api/v1/omnichannel/messages/${dealId}`);
    return res.data;
  },

  async sendOmnichannelMessage(
    dealId: string,
    payload: { channel: string; message_text: string; is_ai_generated?: boolean }
  ): Promise<{
    message: OmnichannelMessageItem;
    channel_connected: boolean;
    delivery_status: string;
    direct_action_url?: string | null;
    status_notice: string;
  }> {
    const res = await apiClient.post(`/api/v1/omnichannel/messages/${dealId}`, payload);
    return res.data;
  },

  async getAIChatSuggestions(dealId: string, tone: string = 'consultivo_b2b'): Promise<AIChatSuggestionResponse> {
    const res = await apiClient.post<AIChatSuggestionResponse>(`/api/v1/omnichannel/ai-suggest/${dealId}`, { tone });
    return res.data;
  },

  async updateOmnichannelContact(
    dealId: string,
    payload: { phone?: string; email?: string; ai_classification?: string; clear_items?: boolean }
  ): Promise<{
    deal_id: string;
    phone?: string | null;
    email?: string | null;
    ai_classification?: string;
    ai_score?: number;
    monto_total?: number;
    message: string;
  }> {
    const res = await apiClient.patch(`/api/v1/omnichannel/conversations/${dealId}/contact`, payload);
    return res.data;
  },

  // --- MULTI-TENANT SAAS, LICENCIAS & PANEL SUPER-ADMIN MAESTRO ---
  async getCurrentTenant(): Promise<TenantAccountItem> {
    const res = await apiClient.get<TenantAccountItem>('/api/v1/tenants/current');
    return res.data;
  },

  async getAllTenants(): Promise<TenantAccountItem[]> {
    const res = await apiClient.get<TenantAccountItem[]>('/api/v1/tenants');
    return res.data;
  },

  async provisionTenant(payload: {
    slug: string;
    nombre_empresa: string;
    rut?: string;
    admin_email: string;
    admin_username: string;
    admin_password?: string;
    license_tier?: string;
    trial_days?: number;
  }): Promise<TenantAccountItem> {
    const res = await apiClient.post<TenantAccountItem>('/api/v1/tenants', payload);
    return res.data;
  },

  async updateTenantLicense(
    tenantId: string,
    payload: {
      simulated_tier?: string;
      license_tier?: string;
      subscription_status?: string;
      extend_trial_days?: number;
      is_active?: boolean;
    }
  ): Promise<TenantAccountItem> {
    const res = await apiClient.patch<TenantAccountItem>(`/api/v1/tenants/${tenantId}/license`, payload);
    return res.data;
  },
};


export const api = apiService;
export default apiService;

export const downloadBlobFile = (blobData: Blob, defaultFilename: string) => {
  if (typeof window === 'undefined') return;
  const url = window.URL.createObjectURL(blobData);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', defaultFilename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export async function downloadExecutiveExcel(): Promise<void> {
  const res = await apiClient.get('/api/v1/reports/executive/excel', {
    responseType: 'blob',
  });
  const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadBlobFile(
    new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `Reporte_Ejecutivo_Calcu_${nowStr}.xlsx`
  );
}

export async function downloadExecutivePdf(): Promise<void> {
  const res = await apiClient.get('/api/v1/reports/executive/pdf', {
    responseType: 'blob',
  });
  const nowStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  downloadBlobFile(
    new Blob([res.data], {
      type: 'application/pdf',
    }),
    `Minuta_Ejecutiva_Calcu_${nowStr}.pdf`
  );
}

// Exportación directa solicitada para llamadas con timeout de 10 minutos (600.000 ms)
export const searchCompetitors = async (data: any) => {
  return apiClient.post('/api/v1/initiatives/search-competitors', data, {
    timeout: 600000, // 10 minutos
  });
};


