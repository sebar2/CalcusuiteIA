import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import type { ActiveTab } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { SettingsModal } from './components/common/SettingsModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { apiService, setCurrentAuthContext, getStoredUser, type StoredUser } from './services/api';
import { ThemeProvider } from './context/ThemeContext';
import { LoginView } from './views/auth/LoginView';

const ControlRoomView = lazy(() => import('./views/ControlRoomView').then(m => ({ default: m.ControlRoomView })));
const SupplyKanbanView = lazy(() => import('./views/SupplyKanbanView').then(m => ({ default: m.SupplyKanbanView })));
const PricingAnalyticsView = lazy(() => import('./views/PricingAnalyticsView').then(m => ({ default: m.PricingAnalyticsView })));
const InitiativesEvaluatorView = lazy(() => import('./views/InitiativesEvaluatorView').then(m => ({ default: m.InitiativesEvaluatorView })));
const TendersView = lazy(() => import('./views/TendersView').then(m => ({ default: m.TendersView })));
const CommercialKanbanView = lazy(() => import('./views/CommercialKanbanView').then(m => ({ default: m.CommercialKanbanView })));
const MultiLocationStockView = lazy(() => import('./views/MultiLocationStockView').then(m => ({ default: m.MultiLocationStockView })));
const VarianceScenariosView = lazy(() => import('./views/VarianceScenariosView').then(m => ({ default: m.VarianceScenariosView })));
const ExecutiveReportsView = lazy(() => import('./views/ExecutiveReportsView').then(m => ({ default: m.ExecutiveReportsView })));
const EtlIngestView = lazy(() => import('./views/EtlIngestView').then(m => ({ default: m.EtlIngestView })));
const ClientsView = lazy(() => import('./views/directory/ClientsView').then(m => ({ default: m.ClientsView })));
const SuppliersView = lazy(() => import('./views/directory/SuppliersView').then(m => ({ default: m.SuppliersView })));
const SupplierCatalogsView = lazy(() => import('./views/SupplierCatalogsView').then(m => ({ default: m.SupplierCatalogsView })));
const TendersRadarView = lazy(() => import('./views/tenders/TendersRadarView').then(m => ({ default: m.TendersRadarView })));
const TendersBenchmarksView = lazy(() => import('./views/tenders/TendersBenchmarksView').then(m => ({ default: m.TendersBenchmarksView })));
const TendersCompetitorsView = lazy(() => import('./views/tenders/TendersCompetitorsView').then(m => ({ default: m.TendersCompetitorsView })));
const TendersBuyersView = lazy(() => import('./views/tenders/TendersBuyersView').then(m => ({ default: m.TendersBuyersView })));
const TendersCalendarView = lazy(() => import('./views/tenders/TendersCalendarView').then(m => ({ default: m.TendersCalendarView })));
const TendersQuoterView = lazy(() => import('./views/tenders/TendersQuoterView').then(m => ({ default: m.TendersQuoterView })));

// 3PL LOGÍSTICA & DISTRIBUCIÓN
const LogisticsClientsView = lazy(() => import('./views/logistics/LogisticsClientsView').then(m => ({ default: m.LogisticsClientsView })));
const LogisticsFleetView = lazy(() => import('./views/logistics/LogisticsFleetView').then(m => ({ default: m.LogisticsFleetView })));
const LogisticsInventoryView = lazy(() => import('./views/logistics/LogisticsInventoryView').then(m => ({ default: m.LogisticsInventoryView })));
const LogisticsKanbanView = lazy(() => import('./views/logistics/LogisticsKanbanView').then(m => ({ default: m.LogisticsKanbanView })));
const LogisticsTrackingView = lazy(() => import('./views/logistics/LogisticsTrackingView').then(m => ({ default: m.LogisticsTrackingView })));
const LogisticsOrdersView = lazy(() => import('./views/logistics/LogisticsOrdersView').then(m => ({ default: m.LogisticsOrdersView })));
const LogisticsFinanceView = lazy(() => import('./views/logistics/LogisticsFinanceView').then(m => ({ default: m.LogisticsFinanceView })));

// NUEVOS MÓDULOS: FACTURACIÓN B2B, GASTOS & CONTABILIDAD, MONITOREO, OMNICANAL & MULTI-TENANT
const InvoicesB2BView = lazy(() => import('./views/InvoicesB2BView').then(m => ({ default: m.InvoicesB2BView })));
const AccountingLedgerView = lazy(() => import('./views/AccountingLedgerView').then(m => ({ default: m.AccountingLedgerView })));
const MonitoringAuditView = lazy(() => import('./views/MonitoringAuditView').then(m => ({ default: m.MonitoringAuditView })));
const IntegrationsView = lazy(() => import('./views/IntegrationsView').then(m => ({ default: m.IntegrationsView })));
const OmnichannelChatView = lazy(() => import('./views/OmnichannelChatView').then(m => ({ default: m.OmnichannelChatView })));
const MasterAdminTenantsView = lazy(() => import('./views/MasterAdminTenantsView').then(m => ({ default: m.MasterAdminTenantsView })));
const MercadoLibreView = lazy(() => import('./views/commercial/MercadoLibreView').then(m => ({ default: m.MercadoLibreView })));

import { Lock } from 'lucide-react';

const ViewLoading = () => (
  <div className="h-96 flex flex-col items-center justify-center space-y-3 text-slate-400">
    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    <span className="text-xs font-medium tracking-wide">Cargando módulo Calcu...</span>
  </div>
);
import type { 
  InventoryAlertItem, 
  MarginSummaryItem, 
  UserPreferences,
  UserRole,
  EngineMode,
  TenantAccountItem,
} from './types';

export function AppContent() {
  // Estado de Layout & Navegación
  const [activeTab, setActiveTab] = useState<ActiveTab>('control_room');
  // Estado de Autenticación & Auth Gate
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(() => getStoredUser());
  const [currentRole, setCurrentRole] = useState<UserRole>(() => (getStoredUser()?.role as UserRole) || 'controller_admin');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [engineMode, setEngineMode] = useState<EngineMode>('auto');
  const [selectedSupplierForCatalogId, setSelectedSupplierForCatalogId] = useState<number | null>(null);
  const [selectedDealForChatId, setSelectedDealForChatId] = useState<string | null>(null);
  const [restrictedModules, setRestrictedModules] = useState<string[]>([]);

  const syncRestrictions = useCallback(async () => {
    try {
      const [users, tenant] = await Promise.all([
        apiService.getSystemUsers().catch(() => []),
        apiService.getCurrentTenant().catch(() => null),
      ]);
      const u = users.find(x => x.username === currentUser?.user_id || x.role === currentRole);
      const userRestricted = u?.restricted_modules || [];
      const licenseRestricted = tenant?.capabilities?.restricted_modules || [];
      setRestrictedModules(Array.from(new Set([...userRestricted, ...licenseRestricted])));
    } catch {
      // ignore
    }
  }, [currentUser, currentRole]);

  useEffect(() => {
    syncRestrictions();
  }, [syncRestrictions]);

  useEffect(() => {
    const handleLoginEvent = (e: Event) => {
      const customEvent = e as CustomEvent<StoredUser>;
      setCurrentUser(customEvent.detail);
      if (customEvent.detail?.role) {
        handleRoleChange(customEvent.detail.role);
      }
    };
    const handleLogoutEvent = () => {
      setCurrentUser(null);
    };
    const handleLicenseChangeEvent = (e: Event) => {
      const customEvent = e as CustomEvent<TenantAccountItem>;
      if (customEvent.detail?.capabilities?.restricted_modules) {
        setRestrictedModules(customEvent.detail.capabilities.restricted_modules);
      } else {
        syncRestrictions();
      }
    };
    window.addEventListener('calcu:auth:login', handleLoginEvent);
    window.addEventListener('calcu:auth:logout', handleLogoutEvent);
    window.addEventListener('calcu:license:changed', handleLicenseChangeEvent);
    return () => {
      window.removeEventListener('calcu:auth:login', handleLoginEvent);
      window.removeEventListener('calcu:auth:logout', handleLogoutEvent);
      window.removeEventListener('calcu:license:changed', handleLicenseChangeEvent);
    };
  }, [syncRestrictions]);

  const handleRoleChange = (role: string) => {
    setCurrentRole(role as UserRole);
    setCurrentAuthContext(role, 'default_user');
  };

  const handleEngineModeChange = (mode: EngineMode) => {
    setEngineMode(mode);
    apiService.saveUserPreferences({
      user_id: preferences.user_id || 'default_user',
      default_engine_mode: mode,
    }).catch((err) => console.warn('Could not auto-save engine mode preference', err));
  };

  // Filtros Globales (Sincronizados con Chips del TopHeader)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [onlyAlerts, setOnlyAlerts] = useState<boolean>(false);
  const [leadTimeFilter, setLeadTimeFilter] = useState<boolean>(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2025-09');

  // Datos Core del Backend
  const [categories, setCategories] = useState<string[]>([]);
  const [inventory, setInventory] = useState<InventoryAlertItem[]>([]);
  const [margins, setMargins] = useState<MarginSummaryItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Preferencias de Usuario (Persistencia FASE 1 & MÓDULO 1)
  const [preferences, setPreferences] = useState<UserPreferences>({
    user_id: 'default_user',
    active_theme: 'light_bitrix',
    default_engine_mode: 'auto',
    saved_filters: {
      categoria: 'Todas',
      only_alerts: false,
      lead_time_min: 0,
      periodo: '2025-09',
    },
    visible_columns: [],
    last_view: 'control_room',
  });

  // 1. Cargar Preferencias Iniciales desde FastAPI
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const pref = await apiService.getUserPreferences('default_user');
        setPreferences(pref);
        if (pref.default_engine_mode) {
          setEngineMode(pref.default_engine_mode);
        }
        if (pref.last_view && ['control_room', 'kanban', 'stock_trace', 'pricing', 'crm', 'initiatives', 'tenders', 'variance', 'reports', 'etl'].includes(pref.last_view)) {
          setActiveTab(pref.last_view as ActiveTab);
        }
        if (pref.saved_filters) {
          if (pref.saved_filters.categoria) setSelectedCategory(pref.saved_filters.categoria);
          if (pref.saved_filters.only_alerts !== undefined) setOnlyAlerts(Boolean(pref.saved_filters.only_alerts));
          if (pref.saved_filters.periodo) setSelectedPeriod(pref.saved_filters.periodo);
        }
      } catch (err) {
        console.warn('Backend preferences not initialized yet, using defaults', err);
      }
    };
    loadPreferences();
  }, []);

  // 2. Cargar Datos del Negocio
  const loadBusinessData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [cats, inv, mrg] = await Promise.all([
        apiService.getCategories().catch(() => ['Electrónica', 'Accesorios', 'Repuestos']),
        apiService.getInventoryAlerts().catch(() => []),
        apiService.getPricingMargins().catch(() => []),
      ]);
      setCategories(cats);
      setInventory(inv);
      setMargins(mrg);
    } catch (err) {
      console.error('Error loading business data', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBusinessData();
  }, [loadBusinessData]);

  // Manejo de cambio de Tab con persistencia automática de última vista
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    apiService.saveUserPreferences({
      user_id: preferences.user_id || 'default_user',
      last_view: tab,
    }).catch((err) => console.warn('Could not auto-save tab preference', err));
  };

  // Guardar filtros en preferencias
  const handleSaveFilterPreferences = (newFilters: any) => {
    apiService.saveUserPreferences({
      user_id: preferences.user_id || 'default_user',
      saved_filters: newFilters,
    }).catch((err) => console.warn('Could not auto-save filter preference', err));
  };

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    handleSaveFilterPreferences({ ...preferences.saved_filters, categoria: cat });
  };

  const handleToggleAlerts = () => {
    const next = !onlyAlerts;
    setOnlyAlerts(next);
    handleSaveFilterPreferences({ ...preferences.saved_filters, only_alerts: next });
  };

  const handleToggleLeadTime = () => {
    setLeadTimeFilter(!leadTimeFilter);
  };

  const handlePeriodSelect = (period: string) => {
    setSelectedPeriod(period);
    handleSaveFilterPreferences({ ...preferences.saved_filters, periodo: period });
  };

  // Guardar configuración completa desde el Modal
  const handleSaveSettings = async (updated: Partial<UserPreferences>) => {
    const saved = await apiService.saveUserPreferences({
      ...preferences,
      ...updated,
    });
    setPreferences(saved);
  };

  // Exportar datos a CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `calcu_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (activeTab === 'control_room') {
      headers = ['SKU', 'Nombre', 'Categoria', 'Stock_Actual', 'ROP', 'DOH', 'Lead_Time', 'Alerta'];
      rows = inventory.map((i) => [
        i.sku,
        `"${i.nombre}"`,
        i.categoria,
        i.stock_actual,
        Number(i.rop).toFixed(2),
        Number(i.doh).toFixed(2),
        i.lead_time_dias,
        i.is_alert ? 'QUIEBRE' : 'OK',
      ]);
    } else if (activeTab === 'pricing') {
      headers = ['SKU', 'Nombre', 'Categoria', 'Precio_Venta', 'Costo_Unitario', 'Margen_Bruto_%', 'Markup_%'];
      rows = margins.map((m) => [
        m.sku,
        `"${m.nombre}"`,
        m.categoria,
        Number(m.precio_venta).toFixed(2),
        Number(m.costo_unitario).toFixed(2),
        Number(m.gross_margin_pct).toFixed(2),
        Number(m.markup_pct).toFixed(2),
      ]);
    } else {
      headers = ['SKU', 'Info'];
      rows = [['N/A', 'Exportacion disponible en Control Room y Pricing']];
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Conteo de quiebres para el badge del Sidebar
  const alertCount = inventory.filter((i) => i.is_alert).length;

  useEffect(() => {
    const is3PLParam = typeof window !== 'undefined' && window.location.search.includes('mode=3pl');
    const is3PLUser = currentRole === 'admin_3pl' || currentRole === 'operario_3pl' || currentRole === 'conductor_3pl';
    if (is3PLParam || is3PLUser) {
      if (!activeTab.startsWith('logistics-')) {
        if (currentRole === 'conductor_3pl') {
          setActiveTab('logistics-tracking');
        } else if (currentRole === 'operario_3pl') {
          setActiveTab('logistics-inventory');
        } else {
          setActiveTab('logistics-kanban');
        }
      }
    }
  }, [currentRole, activeTab]);

  // Auth Gate: Si no hay sesión válida activa, renderizar exclusivamente LoginView
  if (!currentUser) {
    const is3PLParam = typeof window !== 'undefined' && window.location.search.includes('mode=3pl');
    return (
      <LoginView
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          handleRoleChange(user.role);
          if (user.role === 'conductor_3pl') {
            setActiveTab('logistics-tracking');
          } else if (user.role === 'operario_3pl') {
            setActiveTab('logistics-inventory');
          } else if (user.role === 'admin_3pl') {
            setActiveTab('logistics-kanban');
          } else if (is3PLParam) {
            setActiveTab('logistics-kanban');
          } else if (user.role === 'operaciones' || user.role === 'analista_operaciones') {
            setActiveTab('kanban');
          } else if (user.role === 'comercial' || user.role === 'analista_comercial') {
            setActiveTab('crm');
          } else {
            setActiveTab('control_room');
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#eef2f4] dark:bg-slate-950 text-[#333333] dark:text-slate-100 flex transition-colors duration-200">
      {/* 1. Sidebar Fijo / Mobile Drawer */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        alertCount={alertCount}
        currentRole={currentRole}
        restrictedModules={restrictedModules}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* 2. Main Wrapper */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 ml-0 ${
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        {/* Top Header Fijo */}
        <TopHeader
          sidebarCollapsed={sidebarCollapsed}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={handleCategorySelect}
          onlyAlerts={onlyAlerts}
          onToggleOnlyAlerts={handleToggleAlerts}
          leadTimeFilter={leadTimeFilter}
          onToggleLeadTime={handleToggleLeadTime}
          selectedPeriod={selectedPeriod}
          onSelectPeriod={handlePeriodSelect}
          onRefresh={loadBusinessData}
          onExport={handleExportCSV}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isRefreshing={isRefreshing}
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          engineMode={engineMode}
          onEngineModeChange={handleEngineModeChange}
          isMobileMenuOpen={isMobileMenuOpen}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Content Area con Padding del Header Fijo optimizado para Redmi Note 9 Pro */}
        <main className="flex-1 mt-16 p-3 sm:p-6 overflow-y-auto">
          <Suspense fallback={<ViewLoading />}>
            {restrictedModules.includes(activeTab) ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/50 shadow-sm space-y-3 max-w-lg mx-auto mt-12 animate-in fade-in">
                <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800">
                  <Lock size={26} />
                </div>
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                  Acceso Restringido por Política Corporativa
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Su usuario ({currentUser?.nombre || currentUser?.user_id || currentRole}) no tiene autorización para acceder al módulo <strong>{activeTab}</strong>.
                  Para solicitar habilitación de permisos, comuníquese con el Controller General o con el Administrador de Monitoreo.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('control_room')}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Volver a Sala de Control
                  </button>
                </div>
              </div>
            ) : (
              <>
                {activeTab === 'control_room' && (
                  <ErrorBoundary fallbackTitle="Error al cargar Sala de Control">
                <ControlRoomView
                  inventory={inventory}
                  isLoading={isRefreshing}
                  selectedCategory={selectedCategory}
                  onlyAlerts={onlyAlerts}
                  leadTimeFilter={leadTimeFilter}
                  searchQuery={searchQuery}
                  onItemUpdated={(updated) =>
                    setInventory((prev) => prev.map((item) => (item.sku === updated.sku ? updated : item)))
                  }
                />
              </ErrorBoundary>
            )}

            {activeTab === 'kanban' && (
              <ErrorBoundary fallbackTitle="Error al cargar Kanban de Abastecimiento">
                <SupplyKanbanView 
                  onlyAlerts={onlyAlerts}
                  leadTimeFilter={leadTimeFilter}
                  searchQuery={searchQuery}
                  currentRole={currentRole}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'pricing' && (
              <ErrorBoundary fallbackTitle="Error al cargar Matriz de Pricing & Márgenes">
                <PricingAnalyticsView
                  margins={margins}
                  selectedCategory={selectedCategory}
                  searchQuery={searchQuery}
                  currentRole={currentRole}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'stock_trace' && (
              <ErrorBoundary fallbackTitle="Error al cargar Trazabilidad Multi-Depósito">
                <MultiLocationStockView currentRole={currentRole} />
              </ErrorBoundary>
            )}

            {activeTab === 'crm' && (
              <ErrorBoundary fallbackTitle="Error al cargar Pipeline Comercial (CRM)">
                <CommercialKanbanView 
                  onNavigateToTenders={() => setActiveTab('tenders')}
                  onNavigateToIntegrations={() => setActiveTab('integrations')}
                  onNavigateToOmnichannelChat={(dealId) => {
                    if (dealId) setSelectedDealForChatId(dealId);
                    setActiveTab('omnichannel_chat');
                  }}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'integrations' && (
              <ErrorBoundary fallbackTitle="Error al cargar Hub de Integraciones Multicanal">
                <IntegrationsView
                  currentRole={currentRole}
                  onNavigateToCRM={() => setActiveTab('crm')}
                  onNavigateToChat={(dealId) => {
                    if (dealId) setSelectedDealForChatId(dealId);
                    setActiveTab('omnichannel_chat');
                  }}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'omnichannel_chat' && (
              <ErrorBoundary fallbackTitle="Error al cargar Chat Omnicanal Unificado">
                <OmnichannelChatView
                  initialDealId={selectedDealForChatId}
                  onNavigateToIntegrations={() => setActiveTab('integrations')}
                  onNavigateToCRM={() => setActiveTab('crm')}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'mercadolibre' && (
              <ErrorBoundary fallbackTitle="Error al cargar Mercado Libre Uruguay">
                <MercadoLibreView
                  currentRole={currentRole}
                  onNavigateToCRM={() => setActiveTab('crm')}
                  onNavigateToChat={(dealId) => {
                    if (dealId) setSelectedDealForChatId(dealId);
                    setActiveTab('omnichannel_chat');
                  }}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'tenants_admin' && (
              <ErrorBoundary fallbackTitle="Error al cargar Licencias SaaS & Multi-Tenant">
                <MasterAdminTenantsView
                  onLicenseChanged={() => syncRestrictions()}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'clients' && (
              <ErrorBoundary fallbackTitle="Error al cargar Directorio de Clientes B2B">
                <ClientsView />
              </ErrorBoundary>
            )}

            {activeTab === 'suppliers' && (
              <ErrorBoundary fallbackTitle="Error al cargar Directorio de Proveedores">
                <SuppliersView 
                  onNavigateToCatalogs={(supplierId: number) => {
                    setSelectedSupplierForCatalogId(supplierId);
                    setActiveTab('supplier-catalogs');
                  }}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'supplier-catalogs' && (
              <ErrorBoundary fallbackTitle="Error al cargar Catálogos de Proveedores">
                <SupplierCatalogsView 
                  initialSupplierId={selectedSupplierForCatalogId} 
                />
              </ErrorBoundary>
            )}

            {activeTab === 'initiatives' && (
              <ErrorBoundary fallbackTitle="Error al cargar Evaluador de Nuevos Proyectos">
                <InitiativesEvaluatorView 
                  engineMode={engineMode}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'tenders' && (
              <ErrorBoundary fallbackTitle="Error al cargar Licitaciones & Proyectos B2B">
                <TendersView 
                  engineMode={engineMode}
                  currentRole={currentRole}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'tenders_radar' && (
              <ErrorBoundary fallbackTitle="Error al cargar Radar de Convocatorias">
                <TendersRadarView 
                  engineMode={engineMode}
                  currentRole={currentRole}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'tenders_benchmarks' && (
              <ErrorBoundary fallbackTitle="Error al cargar Precios & SICE">
                <TendersBenchmarksView 
                  engineMode={engineMode}
                  currentRole={currentRole}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'tenders_competitors' && (
              <ErrorBoundary fallbackTitle="Error al cargar Competidores & Proveedores">
                <TendersCompetitorsView 
                  engineMode={engineMode}
                  currentRole={currentRole}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'tenders_buyers' && (
              <ErrorBoundary fallbackTitle="Error al cargar Compradores & Intendencias">
                <TendersBuyersView 
                  engineMode={engineMode}
                  currentRole={currentRole}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'tenders_calendar' && (
              <ErrorBoundary fallbackTitle="Error al cargar Calendario & Logística MVD">
                <TendersCalendarView 
                  engineMode={engineMode}
                  currentRole={currentRole}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'tenders_cotizador' && (
              <ErrorBoundary fallbackTitle="Error al cargar Cotizador & Dictamen B2B">
                <TendersQuoterView 
                  engineMode={engineMode}
                  currentRole={currentRole}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'logistics-clients' && (
              <ErrorBoundary fallbackTitle="Error al cargar Clientes 3PL">
                <LogisticsClientsView />
              </ErrorBoundary>
            )}

            {activeTab === 'logistics-fleet' && (
              <ErrorBoundary fallbackTitle="Error al cargar Flota & Choferes 3PL">
                <LogisticsFleetView />
              </ErrorBoundary>
            )}

            {activeTab === 'logistics-inventory' && (
              <ErrorBoundary fallbackTitle="Error al cargar Depósito & Stock 3PL">
                <LogisticsInventoryView />
              </ErrorBoundary>
            )}

            {activeTab === 'logistics-kanban' && (
              <ErrorBoundary fallbackTitle="Error al cargar Kanban Operativo 3PL">
                <LogisticsKanbanView />
              </ErrorBoundary>
            )}

            {activeTab === 'logistics-tracking' && (
              <ErrorBoundary fallbackTitle="Error al cargar Ruteo & Tracking GPS en Vivo">
                <LogisticsTrackingView />
              </ErrorBoundary>
            )}

            {activeTab === 'logistics-orders' && (
              <ErrorBoundary fallbackTitle="Error al cargar Órdenes de Servicio Logístico">
                <LogisticsOrdersView />
              </ErrorBoundary>
            )}

            {activeTab === 'logistics-finance' && (
              <ErrorBoundary fallbackTitle="Error al cargar Costos & Rentabilidad 3PL">
                <LogisticsFinanceView />
              </ErrorBoundary>
            )}

            {activeTab === 'variance' && (
              <ErrorBoundary fallbackTitle="Error al cargar Control Presupuestario">
                <VarianceScenariosView
                  selectedPeriod={selectedPeriod}
                  selectedCategory={selectedCategory}
                  currentRole={currentRole}
                  engineMode={engineMode}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'reports' && (
              <ErrorBoundary fallbackTitle="Error al cargar Informes Ejecutivos">
                <ExecutiveReportsView
                  selectedPeriod={selectedPeriod}
                  engineMode={engineMode}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'etl' && (
              <ErrorBoundary fallbackTitle="Error al cargar Módulo de Ingesta ETL">
                <EtlIngestView
                  onUploadSuccess={loadBusinessData}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'invoices' && (
              <ErrorBoundary fallbackTitle="Error al cargar Facturación B2B">
                <InvoicesB2BView />
              </ErrorBoundary>
            )}

            {activeTab === 'accounting' && (
              <ErrorBoundary fallbackTitle="Error al cargar Libros Contables & Gastos">
                <AccountingLedgerView />
              </ErrorBoundary>
            )}

            {activeTab === 'monitoring' && (
              <ErrorBoundary fallbackTitle="Error al cargar Módulo de Monitoreo">
                <MonitoringAuditView />
              </ErrorBoundary>
            )}
              </>
            )}
          </Suspense>
        </main>
      </div>

      {/* Modal de Configuración y Preferencias */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={preferences}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
