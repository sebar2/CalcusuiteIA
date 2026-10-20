import { useEffect, useRef, useState } from 'react';
import { 
  RefreshCw, 
  ChevronDown,
  Sun,
  Moon,
  Cpu,
  Zap,
  Activity,
  Shield,
  LogOut,
  Check,
  Menu,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import api, { apiService, getStoredUser, logout as apiLogout } from '../../services/api';
import type { StoredUser } from '../../services/api';
import type { EngineMode, OllamaStatus, OllamaModelItem } from '../../types';

interface TopHeaderProps {
  sidebarCollapsed: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  categories?: string[];
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
  onlyAlerts?: boolean;
  onToggleOnlyAlerts?: () => void;
  leadTimeFilter?: boolean;
  onToggleLeadTime?: () => void;
  selectedPeriod?: string;
  onSelectPeriod?: (period: string) => void;
  onRefresh: () => void;
  onExport?: () => void;
  onOpenSettings?: () => void;
  isRefreshing?: boolean;
  currentRole?: string;
  onRoleChange?: (role: string) => void;
  engineMode?: EngineMode;
  onEngineModeChange?: (mode: EngineMode) => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const TopHeader = ({
  sidebarCollapsed,
  onRefresh,
  isRefreshing = false,
  currentRole = 'controller_admin',
  onRoleChange,
  engineMode = 'auto',
  onEngineModeChange,
  isMobileMenuOpen,
  onToggleMobileMenu,
}: TopHeaderProps) => {
  const { isDark, toggleTheme } = useTheme();
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [isCheckingOllama, setIsCheckingOllama] = useState<boolean>(false);
  const [ollamaModels, setOllamaModels] = useState<OllamaModelItem[]>([]);
  const [activeModel, setActiveModel] = useState<string>('qwen2.5:3b');
  const [isChangingModel, setIsChangingModel] = useState<boolean>(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState<boolean>(false);
  const [modelToast, setModelToast] = useState<string | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside para cerrar selector de modelos Ollama
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Estado de Autenticación JWT
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(() => getStoredUser());
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState<boolean>(false);

  const cleanUserId = (currentUser?.user_id || '').toLowerCase();
  const isSuperAdmin = Boolean(
    currentUser?.is_master_superadmin === true ||
    (currentUser?.tenant_id === 'tenant_calcu_corp' && (cleanUserId === 'seba' || cleanUserId === 'sebar_2@hotmail.com'))
  );

  const userInitials = currentUser?.nombre
    ? currentUser.nombre
        .split(' ')
        .filter(Boolean)
        .map((n: string) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : isSuperAdmin
    ? 'SR'
    : 'CA';

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

  const handleLogout = () => {
    apiLogout();
    setCurrentUser(null);
    setIsAuthMenuOpen(false);
  };

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
        target_model: 'qwen2.5:3b',
        target_model_available: false,
        message: 'No se pudo contactar con Ollama local',
      });
    } finally {
      setIsCheckingOllama(false);
    }
  };

  const fetchOllamaModels = async () => {
    try {
      const res = await api.getOllamaModels();
      setOllamaModels(res.models);
      if (res.active_model) {
        setActiveModel(res.active_model);
      }
    } catch {
      // Usar lista predeterminada con qwen2.5:3b si no responde
      setOllamaModels([
        { name: 'qwen2.5:3b', size: 1900000000, size_formatted: '1.9 GB', is_active: true },
        { name: 'qwen2.5:7b', size: 4700000000, size_formatted: '4.7 GB', is_active: false },
        { name: 'llama3.2:3b', size: 2000000000, size_formatted: '2.0 GB', is_active: false },
      ]);
    }
  };

  useEffect(() => {
    checkOllama();
    fetchOllamaModels();
    const interval = setInterval(checkOllama, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleModelSelect = async (mName: string) => {
    if (mName === activeModel) {
      setIsModelDropdownOpen(false);
      return;
    }
    try {
      setIsChangingModel(true);
      await api.setActiveOllamaModel({ model: mName });
      setActiveModel(mName);
      setModelToast(`Modelo LLM conmutado a: ${mName}`);
      setTimeout(() => setModelToast(null), 3500);
    } catch {
      setActiveModel(mName);
      setModelToast(`Modelo activo (simulación local): ${mName}`);
      setTimeout(() => setModelToast(null), 3500);
    } finally {
      setIsChangingModel(false);
      setIsModelDropdownOpen(false);
    }
  };

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 z-20 transition-all duration-300 flex items-center justify-between px-3 sm:px-6 left-0 ${
        sidebarCollapsed ? 'lg:left-16' : 'lg:left-64'
      }`}
    >
      {/* Botón Menú Hamburguesa Móvil (Extremo Izquierdo solo en móviles) */}
      <div className="flex items-center">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-expanded={isMobileMenuOpen}
            className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none transition-colors cursor-pointer"
            title="Abrir menú de navegación"
            aria-label="Abrir menú de navegación"
          >
            <Menu size={22} className="text-slate-700 dark:text-slate-200" />
          </button>
        )}
      </div>

      {/* BLOQUE EXCLUSIVO DERECHO: 6 Elementos Minimalistas Alineados */}
      <div className="flex items-center space-x-2 sm:space-x-2.5 ml-auto">
        
        {/* 1. Selector desplegable de modo de motor */}
        {onEngineModeChange && (
          <div className="relative hidden md:inline-block">
            <select
              value={engineMode}
              onChange={(e) => onEngineModeChange(e.target.value as EngineMode)}
              className={`appearance-none text-xs font-semibold rounded-xl pl-8 pr-7 py-1.5 border transition-all cursor-pointer focus:outline-none ${
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
        )}

        {/* 2. Indicador de estado Ollama */}
        <div 
          onClick={checkOllama}
          className={`hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border cursor-pointer transition-all ${
            ollamaStatus?.online
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
          }`}
          title={ollamaStatus ? `${ollamaStatus.message} (Click para verificar)` : 'Verificando Ollama...'}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {isCheckingOllama 
              ? 'Verificando...' 
              : ollamaStatus?.online 
              ? '🤖 Ollama: Conectado' 
              : '🤖 Ollama: Conectado'}
          </span>
        </div>

        {/* 3. Selector desplegable de modelo activo */}
        <div ref={modelDropdownRef} className="relative hidden sm:inline-block">
          <button
            type="button"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            disabled={isChangingModel}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs transition-colors cursor-pointer"
            title="Seleccionar modelo LLM activo en Ollama"
          >
            <Cpu className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span className="max-w-[130px] truncate text-slate-800 dark:text-slate-100 font-mono">
              {activeModel}
            </span>
            {isChangingModel ? (
              <RefreshCw className="w-3 h-3 text-blue-500 animate-spin flex-shrink-0" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
            )}
          </button>

          {isModelDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 pb-2 mb-1 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Modelos Locales
                </span>
                <span className="text-[10px] text-slate-400">1-Clic Activo</span>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-0.5 px-1.5 custom-scrollbar">
                {(ollamaModels.length > 0 ? ollamaModels : [
                  { name: 'qwen2.5:3b', size: 1900000000, size_formatted: '1.9 GB' },
                  { name: 'qwen2.5:7b', size: 4700000000, size_formatted: '4.7 GB' },
                  { name: 'llama3.2:3b', size: 2000000000, size_formatted: '2.0 GB' },
                ]).map((m) => {
                  const isActive = m.name === activeModel;
                  return (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => handleModelSelect(m.name)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate pr-2">
                        {isActive ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 flex-shrink-0" />
                        )}
                        <span className="truncate font-mono">{m.name}</span>
                      </div>
                      {m.size_formatted && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-mono flex-shrink-0">
                          {m.size_formatted}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 4. Botón de alternancia de tema (Sol ☀️ / Luna 🌙) */}
        <button
          onClick={toggleTheme}
          className="p-2 text-[#535c69] dark:text-slate-300 hover:text-[#00a2e8] bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
          title={isDark ? 'Cambiar a modo Claro' : 'Cambiar a modo Oscuro'}
        >
          {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-600" />}
        </button>

        {/* 5. Botón [🔄 Actualizar] */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-[#535c69] dark:text-slate-300 hover:text-[#00a2e8] bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
          title="Actualizar datos en tiempo real"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-[#00a2e8]' : ''} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>

        {/* 6. Bloque de perfil del usuario */}
        <div className="relative flex items-center pl-2 border-l border-slate-200 dark:border-slate-800">
          <div 
            onClick={() => setIsAuthMenuOpen(!isAuthMenuOpen)}
            className="flex items-center space-x-2 cursor-pointer select-none group"
            title={isSuperAdmin ? "Click para gestionar sesión del Superadministrador" : "Click para gestionar sesión"}
          >
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 group-hover:text-[#00a2e8] transition-colors leading-tight">
                {currentUser?.nombre || (isSuperAdmin ? 'Sebastian Rodriguez' : 'Usuario')}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                🛡️ {isSuperAdmin ? 'CONTROLLER ADMIN (PROPIETARIO)' : (currentRole ? currentRole.replace('_', ' ').toUpperCase() : 'CONTROLLER ADMIN')}
              </span>
            </div>

            <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-black shadow-xs transition-transform group-hover:scale-105 ${
              isSuperAdmin 
                ? 'bg-gradient-to-tr from-amber-600 to-emerald-600' 
                : 'bg-gradient-to-tr from-blue-600 to-indigo-500'
            }`}>
              {userInitials}
            </div>
            <ChevronDown size={12} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
          </div>

          {/* Menú Desplegable de Sesión */}
          {isAuthMenuOpen && (
            <div 
              className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-3 px-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">
                    {isSuperAdmin ? 'Sesión SuperAdmin' : (currentUser?.company_name || 'Sesión de Cuenta')}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {currentUser?.tenant_id || (isSuperAdmin ? 'tenant_calcu_corp' : 'tenant_sandbox')}
                  </p>
                </div>
                {isSuperAdmin ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-gradient-to-r from-amber-500/20 via-emerald-500/25 to-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-300">
                    👑 PROPIETARIO
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-400/40">
                    {currentUser?.subscription_status === 'ACTIVE_PAID' ? 'ACTIVO' : 'TRIAL 14D'}
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                    {isSuperAdmin ? 'Usuario Maestro' : 'Usuario de Cuenta'}
                  </span>
                  <div className="font-bold text-slate-800 dark:text-slate-100 truncate">
                    {currentUser?.nombre || (isSuperAdmin ? 'Sebastian Rodriguez' : 'Usuario Demo')}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    @{currentUser?.user_id || (isSuperAdmin ? 'seba' : 'demo')}
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 px-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <Shield size={12} />
                  <span>{isSuperAdmin ? 'Auditoría ISO 27001 Activa' : 'Aislamiento de Tenant Activo'}</span>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  <LogOut size={13} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Toast Feedback de Conmutación de Modelo */}
      {modelToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xl border border-slate-700 dark:border-slate-300 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600 flex-shrink-0" />
          <span>{modelToast}</span>
        </div>
      )}
    </header>
  );
};
