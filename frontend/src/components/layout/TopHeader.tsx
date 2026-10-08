import { useEffect, useRef, useState } from 'react';
import { 
  Search, 
  RefreshCw, 
  Download, 
  Settings, 
  AlertTriangle, 
  Clock, 
  ChevronDown,
  Sun,
  Moon,
  Cpu,
  Zap,
  Activity,
  Shield,
  User,
  LogOut,
  Key,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { apiService, getStoredUser, login as apiLogin, logout as apiLogout } from '../../services/api';
import type { StoredUser } from '../../services/api';
import type { EngineMode, OllamaStatus } from '../../types';

interface TopHeaderProps {
  sidebarCollapsed: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onlyAlerts: boolean;
  onToggleOnlyAlerts: () => void;
  leadTimeFilter: boolean;
  onToggleLeadTime: () => void;
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
  isRefreshing?: boolean;
  currentRole?: string;
  onRoleChange?: (role: string) => void;
  engineMode?: EngineMode;
  onEngineModeChange?: (mode: EngineMode) => void;
}

export const TopHeader = ({
  sidebarCollapsed,
  searchQuery,
  onSearchChange,
  categories,
  selectedCategory,
  onSelectCategory,
  onlyAlerts,
  onToggleOnlyAlerts,
  leadTimeFilter,
  onToggleLeadTime,
  selectedPeriod,
  onSelectPeriod,
  onRefresh,
  onExport,
  onOpenSettings,
  isRefreshing = false,
  currentRole = 'controller_admin',
  onRoleChange,
  engineMode = 'auto',
  onEngineModeChange,
}: TopHeaderProps) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { isDark, toggleTheme } = useTheme();
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [isCheckingOllama, setIsCheckingOllama] = useState<boolean>(false);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([
    '2025-09',
    '2025-10',
    '2025-11',
    '2025-12'
  ]);

  // Consultar períodos presupuestarios disponibles dinámicamente
  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const data = await apiService.getAvailablePeriods();
        if (data.periods && data.periods.length > 0) {
          setAvailablePeriods(data.periods);
          if (!selectedPeriod || !data.periods.includes(selectedPeriod)) {
            onSelectPeriod(data.default_period);
          }
        }
      } catch (err) {
        console.error('Error fetching available periods:', err);
      }
    };
    fetchPeriods();
  }, []);

  // Estado de Autenticación JWT y Switcher de Usuarios Demo
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(() => getStoredUser());
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  useEffect(() => {
    const handleLoginEvent = (e: Event) => {
      const customEvent = e as CustomEvent<StoredUser>;
      setCurrentUser(customEvent.detail);
      if (onRoleChange && customEvent.detail?.role) {
        onRoleChange(customEvent.detail.role);
      }
    };
    const handleLogoutEvent = () => {
      setCurrentUser(null);
      if (onRoleChange) {
        onRoleChange('controller_admin');
      }
    };
    window.addEventListener('calcu:auth:login', handleLoginEvent);
    window.addEventListener('calcu:auth:logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('calcu:auth:login', handleLoginEvent);
      window.removeEventListener('calcu:auth:logout', handleLogoutEvent);
    };
  }, [onRoleChange]);

  const handleQuickLogin = async (username: string, pass: string) => {
    setIsLoggingIn(true);
    try {
      const user = await apiLogin(username, pass);
      setCurrentUser(user);
      if (onRoleChange) onRoleChange(user.role);
      setIsAuthMenuOpen(false);
    } catch (err) {
      console.error('Error en autenticación rápida:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    apiLogout();
    setCurrentUser(null);
    setIsAuthMenuOpen(false);
  };

  // Atajo de teclado global Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Consultar estado en vivo de Ollama
  const checkOllama = async () => {
    setIsCheckingOllama(true);
    try {
      const status = await apiService.getOllamaStatus();
      setOllamaStatus(status);
    } catch {
      setOllamaStatus({
        online: false,
        url: 'http://127.0.0.1:11434',
        models: [],
        target_model: 'qwen2.5:7b',
        target_model_available: false,
        message: 'No se pudo contactar con Ollama local',
      });
    } finally {
      setIsCheckingOllama(false);
    }
  };

  useEffect(() => {
    checkOllama();
    const interval = setInterval(checkOllama, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 z-20 transition-all duration-300 flex items-center justify-between px-6 ${
        sidebarCollapsed ? 'left-16' : 'left-64'
      }`}
    >
      {/* Buscador Global & Chips */}
      <div className="flex items-center space-x-3 flex-1 max-w-4xl">
        {/* Input Buscador con Ctrl + K badge */}
        <div className="relative w-56 md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar SKU, producto..."
            className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-14 py-1.5 text-xs text-[#333333] dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#00a2e8] focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded shadow-xs">
            Ctrl+K
          </kbd>
        </div>

        {/* Separador vertical */}
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

        {/* Selector de Modo de Inferencia (Módulo 1) */}
        {onEngineModeChange && (
          <div className="hidden lg:flex items-center space-x-1.5">
            <div className="relative">
              <select
                value={engineMode}
                onChange={(e) => onEngineModeChange(e.target.value as EngineMode)}
                className={`appearance-none text-xs font-semibold rounded-lg pl-8 pr-7 py-1.5 border transition-all cursor-pointer focus:outline-none ${
                  engineMode === 'force_llm'
                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                    : engineMode === 'heuristic'
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    : 'bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] dark:text-sky-300 border-sky-200 dark:border-sky-800'
                }`}
                title="Modo de Inferencia Analítica"
              >
                <option value="force_llm">🧠 IA Local (Qwen 2.5:7b - Espera activa)</option>
                <option value="heuristic">⚡ Motor Heurístico (Instantáneo)</option>
                <option value="auto">🔄 Automático (Fallback)</option>
              </select>
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                {engineMode === 'force_llm' ? (
                  <Cpu size={13} className="text-purple-600 dark:text-purple-400" />
                ) : engineMode === 'heuristic' ? (
                  <Zap size={13} className="text-amber-600 dark:text-amber-400" />
                ) : (
                  <Activity size={13} className="text-[#00a2e8]" />
                )}
              </div>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
            </div>
          </div>
        )}

        {/* Chips / Píldoras de Filtro Rápido */}
        <div className="hidden md:flex items-center space-x-2 overflow-x-auto py-1">
          {/* Chip Categoría */}
          <div className="relative group">
            <select
              value={selectedCategory}
              onChange={(e) => onSelectCategory(e.target.value)}
              className="appearance-none bg-[#f5f7f8] dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 text-xs font-medium text-[#535c69] dark:text-slate-300 rounded-full pl-3 pr-7 py-1.5 cursor-pointer focus:outline-none focus:border-[#00a2e8] transition-all"
            >
              <option value="Todas">Categoría: Todas</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  Categoría: {c}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>

          {/* Chip 🚨 Solo Quiebres */}
          <button
            onClick={onToggleOnlyAlerts}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
              onlyAlerts
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-[#e74c3c] dark:text-rose-400 shadow-xs'
                : 'bg-[#f5f7f8] dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-[#535c69] dark:text-slate-300'
            }`}
          >
            <AlertTriangle size={13} className={onlyAlerts ? 'text-[#e74c3c]' : 'text-slate-400 dark:text-slate-500'} />
            <span>🚨 Solo Quiebres</span>
          </button>

          {/* Chip Lead Time > 30d */}
          <button
            onClick={onToggleLeadTime}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
              leadTimeFilter
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-[#f39c12] dark:text-amber-400 shadow-xs'
                : 'bg-[#f5f7f8] dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-[#535c69] dark:text-slate-300'
            }`}
          >
            <Clock size={13} className={leadTimeFilter ? 'text-[#f39c12]' : 'text-slate-400 dark:text-slate-500'} />
            <span>Lead Time &gt; 30d</span>
          </button>

          {/* Chip Periodo */}
          <div className="relative group">
            <select
              value={selectedPeriod}
              onChange={(e) => onSelectPeriod(e.target.value)}
              className="appearance-none bg-[#f5f7f8] dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-medium text-[#535c69] dark:text-slate-300 rounded-full pl-3 pr-7 py-1.5 cursor-pointer focus:outline-none focus:border-[#00a2e8] transition-all"
            >
              {availablePeriods.map((p) => (
                <option key={p} value={p}>
                  Periodo: {p}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>
        </div>
      </div>

      {/* Botones de Acción Rápida & Estado Ollama */}
      <div className="flex items-center space-x-2">
        {/* Badge de Estado Ollama */}
        <div 
          onClick={checkOllama}
          className={`hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border cursor-pointer transition-all ${
            ollamaStatus?.online
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
          }`}
          title={ollamaStatus ? `${ollamaStatus.message} (Click para verificar)` : 'Verificando Ollama...'}
        >
          <span className={`w-2 h-2 rounded-full ${ollamaStatus?.online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span>
            {isCheckingOllama 
              ? 'Verificando...' 
              : ollamaStatus?.online 
              ? '🤖 Ollama: Conectado' 
              : 'Ollama: Offline'}
          </span>
        </div>

        {/* Toggle Dark Mode */}
        <button
          onClick={toggleTheme}
          className="p-1.5 text-[#535c69] dark:text-slate-300 hover:text-[#00a2e8] bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors shadow-2xs"
          title={isDark ? 'Cambiar a modo Claro' : 'Cambiar a modo Oscuro'}
        >
          {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-600" />}
        </button>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-[#535c69] dark:text-slate-300 hover:text-[#00a2e8] bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors shadow-2xs"
          title="Actualizar datos"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-[#00a2e8]' : ''} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>

        <button
          onClick={onExport}
          className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-[#535c69] dark:text-slate-300 hover:text-[#333333] dark:hover:text-white bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors shadow-2xs"
          title="Exportar reporte CSV"
        >
          <Download size={13} />
          <span className="hidden sm:inline">Exportar</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="p-1.5 text-[#535c69] dark:text-slate-300 hover:text-[#00a2e8] bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors shadow-2xs"
          title="Preferencias de Usuario"
        >
          <Settings size={16} />
        </button>

        {/* Indicador de Autenticación JWT & Switcher Demo en 1-Clic */}
        <div className="relative flex items-center pl-2 ml-1 border-l border-slate-200 dark:border-slate-800 space-x-2">
          {/* Badge de Rol y Usuario */}
          <div 
            onClick={() => setIsAuthMenuOpen(!isAuthMenuOpen)}
            className="flex items-center space-x-1.5 cursor-pointer select-none group"
            title="Click para gestionar sesión o alternar usuario demo"
          >
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 group-hover:text-[#00a2e8] transition-colors leading-tight">
                {currentUser?.nombre || currentUser?.user_id || 'Modo Demo'}
              </span>
              <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                (currentUser?.role || currentRole) === 'controller_admin'
                  ? 'text-purple-600 dark:text-purple-400'
                  : (currentUser?.role || currentRole) === 'analista_operaciones'
                  ? 'text-[#00a2e8]'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}>
                {currentUser?.role === 'controller_admin' ? '🛡️ Controller Admin' : currentUser?.role === 'analista_operaciones' ? '📦 Operaciones' : currentUser?.role === 'analista_comercial' ? '📈 Comercial' : currentRole}
              </span>
            </div>

            <div 
              className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-xs transition-transform group-hover:scale-105 ${
                (currentUser?.role || currentRole) === 'controller_admin'
                  ? 'bg-gradient-to-tr from-purple-600 to-indigo-500'
                  : (currentUser?.role || currentRole) === 'analista_operaciones'
                  ? 'bg-gradient-to-tr from-[#00a2e8] to-[#2fc6f6]'
                  : 'bg-gradient-to-tr from-emerald-600 to-teal-400'
              }`}
            >
              {(currentUser?.role || currentRole) === 'controller_admin' ? 'CA' : (currentUser?.role || currentRole) === 'analista_operaciones' ? 'AO' : 'AC'}
            </div>
            <ChevronDown size={12} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
          </div>

          {/* Menú Desplegable de Autenticación y Acceso Rápido Demo */}
          {isAuthMenuOpen && (
            <div 
              className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-3 px-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">Sesión RBAC</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {currentUser ? `Token JWT activo: ${currentUser.user_id}` : 'Sin token activo en navegador'}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  (currentUser?.role || currentRole) === 'controller_admin'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                    : (currentUser?.role || currentRole) === 'analista_operaciones'
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                }`}>
                  {currentUser?.role || currentRole}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 px-1">
                  Acceso Rápido Demo (1-Clic)
                </p>

                <button
                  onClick={() => handleQuickLogin('admin', 'admin123')}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-purple-300"
                >
                  <div className="flex items-center space-x-2">
                    <Shield size={14} className="text-purple-500" />
                    <span>Controller Admin</span>
                  </div>
                  <span className="text-[10px] text-slate-400">admin123</span>
                </button>

                <button
                  onClick={() => handleQuickLogin('operaciones', 'ops123')}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-200 hover:text-[#00a2e8] dark:hover:text-sky-300"
                >
                  <div className="flex items-center space-x-2">
                    <Key size={14} className="text-[#00a2e8]" />
                    <span>Analista Operaciones</span>
                  </div>
                  <span className="text-[10px] text-slate-400">ops123</span>
                </button>

                <button
                  onClick={() => handleQuickLogin('comercial', 'com123')}
                  disabled={isLoggingIn}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300"
                >
                  <div className="flex items-center space-x-2">
                    <User size={14} className="text-emerald-500" />
                    <span>Analista Comercial</span>
                  </div>
                  <span className="text-[10px] text-slate-400">com123</span>
                </button>
              </div>

              {currentUser && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <LogOut size={13} />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
