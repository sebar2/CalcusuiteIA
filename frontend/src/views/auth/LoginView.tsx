import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  User, 
  Package, 
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
                  Ingrese con sus credenciales autorizadas asignadas por el Administrador.
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
                    placeholder="Usuario asignado o 'demo'"
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

            {/* Aviso de Ciberseguridad ISO 27001 & Trazabilidad de Auditoría */}
            <div className="mt-8 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2.5">
                <div className="flex items-center gap-2 text-blue-400 font-bold">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span>Acceso Corporativo Auditado (ISO 27001)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Para resguardar la confidencialidad de la información financiera y operativa, el acceso requiere autenticación obligatoria. Cada evento de inicio de sesión queda registrado en el historial inmutable de auditoría.
                </p>
              </div>

              {/* Acceso Evaluador Sandbox Aislado */}
              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-800/40 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-cyan-200">Acceso Evaluador / Modo Demo</div>
                  <div className="text-[11px] text-slate-300">
                    Usuario: <span className="text-cyan-400 font-mono font-bold">demo</span> &bull; Clave: <span className="text-cyan-400 font-mono font-bold">demo123</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Sandbox Aislado
                </span>
              </div>

              {/* Asistencia con Credenciales & Soporte */}
              <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-900/40 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200">¿No tienes credenciales o las olvidaste?</div>
                  <div className="text-[11px] text-slate-400">Solicítalas al Controller General o soporte directo.</div>
                </div>
                <a
                  href="https://wa.me/59894858791?text=Hola%20Sebasti%C3%A1n%2C%20necesito%20mis%20credenciales%20de%20acceso%20para%20Calcu%20Suite"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <span>Pedir Credenciales</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
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
