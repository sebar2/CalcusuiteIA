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
  TenderImportFeedResponse,
  ClientItem,
  ClientCreatePayload,
  ClientUpdatePayload,
  SupplierItem,
  SupplierCreatePayload,
  SupplierUpdatePayload,
  CostCenterBudgetCreatePayload,
  CostCenterBudgetUpdatePayload,
  CostCenterBudgetSingleResponse,
  OllamaModelsResponse,
  ActiveModelRequest,
  ActiveModelResponse,
} from '../types';

const API_BASE_URL = 'http://localhost:8000';

export const TOKEN_STORAGE_KEY = 'calcu_access_token';
export const USER_STORAGE_KEY = 'calcu_user';

export interface StoredUser {
  token: string;
  user_id: string;
  role: string;
  nombre?: string;
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

export const login = async (username: string, password: string): Promise<StoredUser> => {
  const res = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, { username, password });
  const data = res.data;
  localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
  localStorage.setItem(
    USER_STORAGE_KEY,
    JSON.stringify({
      user_id: data.user_id,
      role: data.role,
      nombre: data.nombre,
    })
  );
  currentRole = data.role;
  currentUserId = data.user_id;
  const user: StoredUser = {
    token: data.access_token,
    user_id: data.user_id,
    role: data.role,
    nombre: data.nombre,
  };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('calcu:auth:login', { detail: user }));
  }
  return user;
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 600000, // 10 minutos (600.000 ms) para Benchmarking en profundidad
});

apiClient.interceptors.request.use((config) => {
  const stored = getStoredUser();
  if (stored?.token) {
    config.headers['Authorization'] = `Bearer ${stored.token}`;
    config.headers['X-User-Role'] = stored.role;
    config.headers['X-User-Id'] = stored.user_id;
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
  async getUnifiedBatches(): Promise<StockBatchItem[]> {
    const res = await apiClient.get<StockBatchItem[]>('/api/v1/warehouses/batches');
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

  // MÓDULO: Feed de Licitaciones B2B Públicas (ARCE / UTE / IMM / OSE - SERLUX)
  async getTendersLiveFeed(params?: { nicho?: string; q?: string; keyword?: string }): Promise<TenderLiveFeedResponse> {
    const res = await apiClient.get<TenderLiveFeedResponse>('/api/v1/tenders/live-feed', { params });
    return res.data;
  },

  async syncTendersFeed(): Promise<TenderLiveFeedResponse> {
    const res = await apiClient.post<TenderLiveFeedResponse>('/api/v1/tenders/feed/sync');
    return res.data;
  },

  async importTenderFeedItem(payload: TenderImportFeedRequest): Promise<TenderImportFeedResponse> {
    const res = await apiClient.post<TenderImportFeedResponse>('/api/v1/tenders/import-feed-item', payload);
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

  async getSuppliers(q?: string): Promise<SupplierItem[]> {
    const res = await apiClient.get<SupplierItem[]>('/api/v1/suppliers', { params: q ? { q } : undefined });
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


