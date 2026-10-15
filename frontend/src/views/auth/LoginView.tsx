import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  User, 
  Zap, 
  Package, 
  Briefcase, 
  ArrowRight, 
  AlertCircle,
  Eye,
  EyeOff,
  TrendingUp,
  Cpu,
  Truck,
  Boxes,
  MapPin,
  Globe,
  CheckCircle2,
  X
} from 'lucide-react';
import { login, type StoredUser, getApiBaseUrl, setCustomApiBaseUrl } from '../../services/api';

interface LoginViewProps {
  onLoginSuccess: (user: StoredUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const isUrl3PL = typeof window !== 'undefined' && window.location.search.includes('mode=3pl');
  const [authMode, setAuthMode] = useState<'3pl' | 'suite'>(isUrl3PL ? '3pl' : '3pl');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal para configuración de conexión VPN Tailscale / Servidor Remoto
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [currentServerUrl, setCurrentServerUrl] = useState('');

  useEffect(() => {
    setCurrentServerUrl(getApiBaseUrl());
    setServerUrlInput(getApiBaseUrl());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Por favor ingrese usuario y contraseña.');
      return;
    }
    await executeLogin(username.trim(), password);
  };

  const executeLogin = async (u: string, p: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const user = await login(u, p);
      onLoginSuccess(user);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Credenciales inválidas o servidor no disponible.';
      setErrorMessage(`${detail} [Servidor: ${getApiBaseUrl()}]`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = (demoUser: string, demoPass: string) => {
    setUsername(demoUser);
    setPassword(demoPass);
    executeLogin(demoUser, demoPass);
  };

  const handleSaveServerUrl = () => {
    setCustomApiBaseUrl(serverUrlInput.trim());
    setCurrentServerUrl(getApiBaseUrl());
    setShowServerModal(false);
  };

  const handleResetServerUrl = () => {
    setCustomApiBaseUrl('');
    setCurrentServerUrl(getApiBaseUrl());
    setServerUrlInput(getApiBaseUrl());
    setShowServerModal(false);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none">
      {/* Luces y gradientes de fondo */}
      <div className="absolute top-1/4 -left-48 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-24 right-1/3 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Modal de Conexión Tailscale VPN */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowServerModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Globe size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Servidor & Tailscale VPN</h3>
                <p className="text-xs text-slate-400">Dirección IP del servidor Core API</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Para conectar la aplicación móvil o conductores a través de <strong className="text-cyan-400">Tailscale VPN</strong>, ingrese la IP de su nodo Tailscale con el puerto 8000:
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  URL del Servidor Backend (API)
                </label>
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="http://100.x.y.z:8000 o http://localhost:8000"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>URL actual activa:</span>
                  <span className="font-mono text-cyan-300 font-semibold">{currentServerUrl}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ejemplo Tailscale:</span>
                  <span className="font-mono text-slate-400">http://100.85.12.3:8000</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleResetServerUrl}
                className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Restablecer Local
              </button>
              <button
                type="button"
                onClick={handleSaveServerUrl}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Guardar y Conectar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl relative z-10">
        {/* Columna Izquierda: Branding & Value Props */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80">
          <div>
            <div className="flex items-center space-x-3 mb-8">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                authMode === '3pl'
                  ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-indigo-500/25'
                  : 'bg-gradient-to-tr from-[#00a2e8] to-blue-600 shadow-blue-500/25'
              }`}>
                {authMode === '3pl' ? <Truck className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  Calcu <span className="text-[#00a2e8] text-sm font-semibold tracking-normal">{authMode === '3pl' ? '| 3PL Logistics' : '| Suite'}</span>
                </h1>
                <p className="text-[11px] text-slate-400 font-medium">
                  {authMode === '3pl' ? 'WMS Multi-Cliente, Flota & GPS' : 'SupplyFinance & Corporate Analytics'}
                </p>
              </div>
            </div>

            {authMode === '3pl' ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-extrabold text-white leading-tight">
                  Logística & Distribución 3PL Desacoplada
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Administración de inventario de terceros (Supermercados y PyMEs), depósito WMS, despacho volumétrico y tracking en vivo para conductores.
                </p>

                {/* Feature Pills 3PL */}
                <div className="mt-8 space-y-3">
                  <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300">
                    <Boxes className="w-4 h-4 text-sky-400 flex-shrink-0" />
                    <span>Depósito WMS & Códigos QR / Code128</span>
                  </div>
                  <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300">
                    <Truck className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span>Capacidad Volumétrica de Flota Tercerizada</span>
                  </div>
                  <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300">
                    <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Ruteo GPS Leaflet & Firma Digital Móvil</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-2xl font-extrabold text-white leading-tight">
                  Control Operativo y Financiero Unificado
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Plataforma corporativa de abastecimiento ROP, FP&A de escenarios, pricing dinámico y licitaciones del estado.
                </p>

                {/* Feature Pills Suite */}
                <div className="mt-8 space-y-3">
                  <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300">
                    <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Simulador de Descuentos & Variaciones FP&A</span>
                  </div>
                  <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300">
                    <Package className="w-4 h-4 text-[#00a2e8] flex-shrink-0" />
                    <span>Kanban ROP con 5 Estadios Logísticos</span>
                  </div>
                  <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300">
                    <Cpu className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span>Auditoría e Inferencia con Modelos IA</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>© 2026 Calcu Logistics v2.4</span>
            <button
              onClick={() => setShowServerModal(true)}
              className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer"
              title="Configurar IP de Conexión Tailscale"
            >
              <Globe size={13} />
              <span>Tailscale: {currentServerUrl.replace(/^https?:\/\//, '')}</span>
            </button>
          </div>
        </div>

        {/* Columna Derecha: Formulario & Botones Demo 1-Clic */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between">
          <div>
            {/* Header con Switch de Modo */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Iniciar Sesión</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ingrese credenciales o seleccione un perfil demo.
                </p>
              </div>

              {/* Selector de Modo */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setAuthMode('3pl')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    authMode === '3pl'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  3PL Logística
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('suite')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    authMode === 'suite'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Suite Calcu
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Formulario Estándar */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Usuario o Correo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={authMode === '3pl' ? 'admin_3pl, operario_3pl, conductor_3pl' : 'admin, operaciones, comercial'}
                    disabled={isLoading}
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00a2e8] focus:ring-1 focus:ring-[#00a2e8] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00a2e8] focus:ring-1 focus:ring-[#00a2e8] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-[#00a2e8] hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                <span>{isLoading ? 'Autenticando...' : 'Acceder al Sistema'}</span>
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {/* Separador */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-slate-900 px-3 text-slate-500 font-bold">
                  {authMode === '3pl' ? 'Perfiles 3PL Logística (1-Clic)' : 'Perfiles Suite Corporativa (1-Clic)'}
                </span>
              </div>
            </div>

            {/* Panel de Acceso Rápido Demo (1-Clic) */}
            {authMode === '3pl' ? (
              <div className="space-y-2">
                {/* 1. Admin 3PL */}
                <button
                  type="button"
                  onClick={() => handleQuickDemo('admin_3pl', 'admin3pl123')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-purple-950/30 hover:bg-purple-950/50 border border-purple-800/40 text-left transition-all group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Admin 3PL Logística</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                          admin_3pl
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">Acceso total a los 7 submódulos 3PL y Costos/Rentabilidad</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-purple-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* 2. Operario Depósito */}
                <button
                  type="button"
                  onClick={() => handleQuickDemo('operario_3pl', 'operario123')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-amber-950/30 hover:bg-amber-950/50 border border-amber-800/40 text-left transition-all group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Boxes className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Operario de Depósito (Picking & WMS)</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                          operario_3pl
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">Stock, QR/Code128, Picking y Kanban (Finanzas bloqueadas)</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-amber-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>

                {/* 3. Conductor de Reparto */}
                <button
                  type="button"
                  onClick={() => handleQuickDemo('conductor_3pl', 'chofer123')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/30 hover:bg-emerald-950/50 border border-emerald-800/40 text-left transition-all group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Conductor / Chofer de Flota</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                          conductor_3pl
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">Vista móvil: Órdenes asignadas, Tracking GPS y Firma digital</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-emerald-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemo('admin', 'admin123')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-purple-950/30 hover:bg-purple-950/50 border border-purple-800/40 text-left transition-all group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Controller Admin</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                          admin
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">Acceso total a la suite, pricing y gobernanza</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-purple-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemo('operaciones', 'ops123')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-sky-950/30 hover:bg-sky-950/50 border border-sky-800/40 text-left transition-all group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-[#00a2e8] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Analista Operaciones</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono">
                          operaciones
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">Abastecimiento ROP, Multi-Depósito y ETL Ingest</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#00a2e8] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDemo('comercial', 'com123')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/30 hover:bg-emerald-950/50 border border-emerald-800/40 text-left transition-all group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Analista Comercial</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                          comercial
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">Pipeline CRM, Proveedores y Licitaciones</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-emerald-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>Autenticación JWT SHA-256</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> RBAC Multi-Rol Activo
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
