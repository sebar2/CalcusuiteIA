import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  Lock, 
  User, 
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
  X,
  RefreshCw,
  KeyRound,
  Building2,
} from 'lucide-react';
import { login, apiService, type StoredUser, getApiBaseUrl, setCustomApiBaseUrl } from '../../services/api';

interface LoginViewProps {
  onLoginSuccess: (user: StoredUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const isUrl3PL = typeof window !== 'undefined' && window.location.search.includes('mode=3pl');
  const [authMode, setAuthMode] = useState<'3pl' | 'suite'>(isUrl3PL ? '3pl' : 'suite');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Captcha Criptográfico Anti-Bot
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [captchaSvg, setCaptchaSvg] = useState<string>('');
  const [captchaAnswer, setCaptchaAnswer] = useState<string>('');
  const [loadingCaptcha, setLoadingCaptcha] = useState<boolean>(false);

  // Segundo Factor de Autenticación (2FA / MFA TOTP)
  const [showMfaInput, setShowMfaInput] = useState<boolean>(false);
  const [totpCode, setTotpCode] = useState<string>('');

  // Modal para configuración de conexión VPN Tailscale / Servidor Remoto
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [currentServerUrl, setCurrentServerUrl] = useState('');

  const loadCaptcha = useCallback(async () => {
    setLoadingCaptcha(true);
    try {
      const data = await apiService.getCaptcha();
      setCaptchaToken(data.captcha_token);
      setCaptchaSvg(data.captcha_svg);
      setCaptchaAnswer('');
    } catch {
      setCaptchaToken('');
      setCaptchaSvg('');
    } finally {
      setLoadingCaptcha(false);
    }
  }, []);

  useEffect(() => {
    setCurrentServerUrl(getApiBaseUrl());
    setServerUrlInput(getApiBaseUrl());
    loadCaptcha();
  }, [loadCaptcha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Por favor ingrese usuario/correo y contraseña.');
      return;
    }
    if (captchaToken && !captchaAnswer.trim()) {
      setErrorMessage('Por favor complete el código Captcha de verificación humana.');
      return;
    }
    await executeLogin(username.trim(), password, captchaToken || undefined, captchaAnswer.trim() || undefined, totpCode.trim() || undefined);
  };

  const executeLogin = async (
    u: string,
    p: string,
    cToken?: string,
    cAnswer?: string,
    mfaCode?: string
  ) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const user = await login(u, p, cToken, cAnswer, mfaCode);
      if (user.mfa_required) {
        setShowMfaInput(true);
        setErrorMessage('Su cuenta tiene 2FA activo. Ingrese el código de 6 dígitos de su app autenticadora.');
        return;
      }
      onLoginSuccess(user);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Credenciales inválidas o servidor no disponible.';
      setErrorMessage(detail);
      loadCaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveServerUrl = () => {
    setCustomApiBaseUrl(serverUrlInput.trim());
    setCurrentServerUrl(getApiBaseUrl());
    setShowServerModal(false);
    loadCaptcha();
  };

  const handleResetServerUrl = () => {
    setCustomApiBaseUrl('');
    setCurrentServerUrl(getApiBaseUrl());
    setServerUrlInput(getApiBaseUrl());
    setShowServerModal(false);
    loadCaptcha();
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
        {/* Columna Izquierda: Branding & Value Props Multi-Tenant SaaS */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80">
          <div>
            <div className="flex items-center space-x-3 mb-6">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                authMode === '3pl'
                  ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-indigo-500/25'
                  : 'bg-gradient-to-tr from-[#00a2e8] to-blue-600 shadow-blue-500/25'
              }`}>
                {authMode === '3pl' ? <Truck className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  Calcu <span className="text-[#00a2e8] text-sm font-semibold tracking-normal">{authMode === '3pl' ? '| 3PL Logistics' : '| Suite SaaS'}</span>
                </h1>
                <p className="text-[11px] text-slate-400 font-medium">
                  Multi-Tenant B2B &bull; Esquemas PostgreSQL Aislados
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

                <div className="mt-6 space-y-2.5">
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
                  CRM Omnicanal, IA & Control Financiero
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Cada empresa opera en su propia base de datos aislada con integraciones AdTech (Google Ads, Meta, WhatsApp, Email y Web) y Copiloto IA.
                </p>

                <div className="mt-6 space-y-2.5">
                  <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300">
                    <Building2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>Aislamiento Multi-Tenant por Cuenta y Licencia</span>
                  </div>
                  <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300">
                    <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Ingesta de Leads en 1. Prospección & ROAS</span>
                  </div>
                  <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-300">
                    <Cpu className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span>Chat Omnicanal Unificado + Agente IA Gratuito</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>© 2026 Calcu SaaS v3.0</span>
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

        {/* Columna Derecha: Formulario con Detección Automática de Cuenta + Captcha + 2FA */}
        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between">
          <div>
            {/* Header con Switch de Modo */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Iniciar Sesión Corporativa</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Detección automática de su cuenta empresarial y base de datos aislada.
                </p>
              </div>

              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
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
              </div>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Formulario Multi-Tenant + Captcha + 2FA */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Usuario o Correo de la Cuenta
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ej. admin, comercial, admin_distsur o demo"
                    disabled={isLoading}
                    className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00a2e8] focus:ring-1 focus:ring-[#00a2e8] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
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

              {/* Bloque Captcha Criptográfico Anti-Bot */}
              {captchaSvg && (
                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      Verificación Humana (Captcha Anti-Bot)
                    </span>
                    <button
                      type="button"
                      onClick={loadCaptcha}
                      disabled={loadingCaptcha}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingCaptcha ? 'animate-spin' : ''}`} />
                      <span>Nuevo código</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <img
                      src={captchaSvg}
                      alt="Captcha de Seguridad"
                      className="h-11 rounded-lg border border-slate-700 select-none flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value.toUpperCase())}
                      placeholder="Escriba los 5 caracteres"
                      maxLength={6}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono uppercase tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              )}

              {/* Segundo Factor 2FA (TOTP) Opcional o Requerido */}
              <div className="pt-0.5">
                {!showMfaInput ? (
                  <button
                    type="button"
                    onClick={() => setShowMfaInput(true)}
                    className="text-[11px] text-slate-400 hover:text-cyan-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                    <span>¿Tiene activado el Identificador a 2 Factores (2FA / Google Authenticator)?</span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-800/40 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" />
                        Código de 2 Factores (6 dígitos TOTP)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMfaInput(false);
                          setTotpCode('');
                        }}
                        className="text-[10px] text-slate-400 hover:text-white"
                      >
                        Ocultar
                      </button>
                    </div>
                    <input
                      type="text"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full bg-slate-950 border border-indigo-500/40 rounded-xl px-3 py-2 text-xs font-mono tracking-[0.35em] text-center text-white placeholder-slate-600 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-[#00a2e8] hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-bold shadow-lg shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                <span>{isLoading ? 'Verificando Cuenta y Licencia...' : 'Acceder a mi Cuenta Aislada'}</span>
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {/* Bloques Informativos: Acceso SuperAdmin, Prueba 14 Días Enterprise & 3PL y Soporte */}
            <div className="mt-5 space-y-3">
              {/* Acceso 1-Tap Superadministrador Propietario */}
              <div 
                onClick={() => {
                  setUsername('seba');
                  setPassword('seba2026!');
                }}
                className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/30 to-amber-900/20 border border-amber-500/40 hover:border-amber-400/80 cursor-pointer transition-all flex items-center justify-between group active:scale-[0.99]"
              >
                <div>
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span>👑 Acceso Superadministrador (Sebastián - Propietario)</span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Usuario: <span className="text-amber-400 font-mono font-bold">seba</span> &bull; 100% de módulos desbloqueados
                  </div>
                  <div className="text-[10px] text-amber-400/80 mt-0.5">
                    Toque aquí para autorrellenar credenciales de SuperAdmin
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex-shrink-0 group-hover:bg-amber-500/30">
                  SuperAdmin
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-800/40 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-cyan-200">Cuenta Trial 14 Días (Licencia Enterprise & 3PL)</div>
                  <div className="text-[11px] text-slate-300">
                    Usuario: <span className="text-cyan-400 font-mono font-bold">demo</span> &bull; Clave: <span className="text-cyan-400 font-mono font-bold">demo123</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Permite alternar entre planes Starter, Pro y Enterprise durante los 14 días.
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex-shrink-0">
                  Trial 14d
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-900/40 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200">¿Desea adquirir una Licencia o recuperar acceso?</div>
                  <div className="text-[11px] text-slate-400">Cada licencia crea su propio esquema PostgreSQL aislado.</div>
                </div>
                <a
                  href="https://wa.me/59894858791?text=Hola%20Sebasti%C3%A1n%2C%20quiero%20activar%20una%20licencia%20aislada%20de%20Calcu%20Suite"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors flex-shrink-0"
                >
                  <span>Solicitar Licencia</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>Captcha HMAC + 2FA TOTP RFC 6238</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> Multi-Tenant ISO 27001
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
