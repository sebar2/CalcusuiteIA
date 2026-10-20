import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Activity,
  Cpu,
  Key,
  Globe,
  Radio,
  Building2,
  Lock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Send,
  Sparkles,
  Server,
  Zap,
  Clock,
  Check,
  X,
} from 'lucide-react';
import { apiService, getStoredUser } from '../services/api';
import type {
  NetworkTelemetryResponse,
  AIVaultConfigResponse,
  JITSupportSessionItem,
  TenantOperationalParams,
  TenantAccountItem,
} from '../types';

export const SettingsView: React.FC = () => {
  const storedUser = getStoredUser();

  // Determinar si es Superadmin (Sebastian Rodriguez / tenant_calcu_corp)
  const cleanUser = (storedUser?.user_id || '').toLowerCase();
  const isSuperAdmin = Boolean(
    storedUser?.is_master_superadmin === true ||
    (storedUser?.tenant_id === 'tenant_calcu_corp' && (cleanUser === 'seba' || cleanUser === 'sebar_2@hotmail.com'))
  );

  const [currentTenant, setCurrentTenant] = useState<TenantAccountItem | null>(null);
  const [activeTab, setActiveTab] = useState<'superadmin_telemetry' | 'superadmin_ai_vault' | 'superadmin_jit' | 'superadmin_copilot' | 'tenant_regional' | 'tenant_params' | 'tenant_jit_auth'>(
    isSuperAdmin ? 'superadmin_telemetry' : 'tenant_regional'
  );

  // Estados de datos
  const [telemetry, setTelemetry] = useState<NetworkTelemetryResponse | null>(null);
  const [aiVault, setAiVault] = useState<AIVaultConfigResponse | null>(null);
  const [jitSessions, setJitSessions] = useState<JITSupportSessionItem[]>([]);
  const [tenantParams, setTenantParams] = useState<TenantOperationalParams>({
    idioma: 'es',
    moneda_base: 'UYU',
    formato_numerico: '1.234,56',
    tema_visual: 'light_bitrix',
    rut_dgi: '218994020015',
    razon_social: 'Calcu Corporación Central S.A.',
    cfe_serie: 'A',
    cfe_sucursal: '001',
    logo_url: '',
    rop_min_days_alert: 7,
    doh_critical_alert: 15,
    whatsapp_notifications: true,
    email_notifications: true,
  });

  // Estados de carga y feedback
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRotatingKeys, setIsRotatingKeys] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  // Formulario Solicitud JIT (SuperAdmin)
  const [jitTargetTenant, setJitTargetTenant] = useState<string>('tenant_distsur');
  const [jitReason, setJitReason] = useState<string>('Auditoría de sincronización de catálogo y verificación de e-Factura DGI');
  const [isRequestingJIT, setIsRequestingJIT] = useState<boolean>(false);

  // Parámetros IA
  const [aiEndpoint, setAiEndpoint] = useState<string>('http://127.0.0.1:11434');
  const [aiTemperature, setAiTemperature] = useState<number>(0.20);
  const [isSavingAIParams, setIsSavingAIParams] = useState<boolean>(false);

  // Copiloto SecOps State
  const [copilotPrompt, setCopilotPrompt] = useState<string>('');
  const [isCopilotThinking, setIsCopilotThinking] = useState<boolean>(false);
  const [copilotChat, setCopilotChat] = useState<Array<{ sender: 'user' | 'guardian'; text: string; time: string; cardType?: string }>>([
    {
      sender: 'guardian',
      text: '🛡️ **Cybersec AI Guardian inicializado (ISO/IEC 27001:2022).**\nSupervisando perímetro ZTNA de Sebastian Rodriguez, aislamiento `Schema-per-Tenant` y baseline de puertos (:8000 y :5173). ¿Qué análisis deseas ejecutar?',
      time: 'Ahora',
      cardType: 'OVERVIEW_SHIELD'
    }
  ]);

  // Cargar datos al montar
  const loadAllSettings = async () => {
    setIsLoading(true);
    try {
      const promises: Promise<any>[] = [
        apiService.getCurrentTenant().catch(() => null),
        apiService.getJITSupportSessions().catch(() => []),
        apiService.getTenantOperationalParams().catch(() => null),
      ];

      if (isSuperAdmin) {
        promises.push(apiService.getNetworkTelemetry().catch(() => null));
        promises.push(apiService.getAIVaultConfig().catch(() => null));
      }

      const results = await Promise.all(promises);
      const currTenant = results[0];
      const jitRes = results[1];
      const paramsRes = results[2];
      const teleRes = isSuperAdmin ? results[3] : null;
      const vaultRes = isSuperAdmin ? results[4] : null;

      if (currTenant) setCurrentTenant(currTenant);
      if (jitRes) setJitSessions(jitRes);
      if (paramsRes) setTenantParams(paramsRes);
      if (teleRes) setTelemetry(teleRes);
      if (vaultRes) {
        setAiVault(vaultRes);
        setAiEndpoint(vaultRes.ai_engine?.endpoint || 'http://127.0.0.1:11434');
        setAiTemperature(vaultRes.ai_engine?.default_temperature ?? 0.20);
      }

      // Si no es Superadmin, activar por defecto la pestaña de parámetros de tenant
      if (!isSuperAdmin) {
        setActiveTab('tenant_regional');
      }
    } catch {
      setFeedbackBanner({
        type: 'error',
        text: 'Error al cargar la configuración del sistema.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllSettings();
  }, []);

  // Rotar Llaves AES-256
  const handleRotateVaultKeys = async () => {
    setIsRotatingKeys(true);
    try {
      const res = await apiService.rotateVaultKeys();
      setFeedbackBanner({
        type: 'success',
        text: `Bóveda AES-256 rotada exitosamente. Nueva huella registrada en auditoría ISO 27001: ${res.new_fingerprint}`,
      });
      loadAllSettings();
    } catch {
      setFeedbackBanner({
        type: 'error',
        text: 'Fallo al rotar claves criptográficas.',
      });
    } finally {
      setIsRotatingKeys(false);
    }
  };

  // Guardar Parámetros IA
  const handleSaveAIParams = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAIParams(true);
    try {
      await apiService.updateAIVaultParams({
        endpoint: aiEndpoint,
        temperature: aiTemperature,
      });
      setFeedbackBanner({
        type: 'success',
        text: 'Parámetros del motor Ollama actualizados exitosamente.',
      });
    } catch {
      setFeedbackBanner({
        type: 'error',
        text: 'No se pudieron actualizar los parámetros IA.',
      });
    } finally {
      setIsSavingAIParams(false);
    }
  };

  // Solicitar Acceso JIT (SuperAdmin)
  const handleRequestJIT = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRequestingJIT(true);
    try {
      const res = await apiService.requestJITSupport(jitTargetTenant, jitReason);
      setFeedbackBanner({
        type: 'success',
        text: res.message,
      });
      setJitSessions(prev => [res.record, ...prev]);
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.response?.data?.detail || 'Error al emitir solicitud de soporte JIT.',
      });
    } finally {
      setIsRequestingJIT(false);
    }
  };

  // Acción JIT (Aprobar 60 min o Revocar)
  const handleJITAction = async (sessionId: string, action: 'approve' | 'revoke') => {
    try {
      const res = await apiService.actionJITSupport(sessionId, action);
      setFeedbackBanner({
        type: action === 'approve' ? 'success' : 'warning',
        text: res.message,
      });
      setJitSessions(prev => prev.map(s => s.session_id === sessionId ? res.record : s));
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.response?.data?.detail || 'Error al procesar acción JIT.',
      });
    }
  };

  // Guardar Parámetros Operativos del Tenant
  const handleSaveTenantParams = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiService.updateTenantOperationalParams(tenantParams);
      setFeedbackBanner({
        type: 'success',
        text: res.message,
      });
    } catch (err: any) {
      setFeedbackBanner({
        type: 'error',
        text: err.response?.data?.detail || 'Error al guardar parámetros operativos.',
      });
    }
  };

  // Consultar Copiloto SecOps Guardian
  const handleAskCopilot = async (customPrompt?: string) => {
    const q = (customPrompt || copilotPrompt).trim();
    if (!q) return;

    setCopilotChat(prev => [...prev, {
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setCopilotPrompt('');
    setIsCopilotThinking(true);

    try {
      const res = await apiService.askCybersecCopilot(q);
      setCopilotChat(prev => [...prev, {
        sender: 'guardian',
        text: res.respuesta,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        cardType: res.card_type,
      }]);
    } catch {
      setCopilotChat(prev => [...prev, {
        sender: 'guardian',
        text: '⚠️ No se pudo contactar con el motor de Ciberseguridad. Verifique que el servicio local esté en línea.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsCopilotThinking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal del Módulo de Configuraciones */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <Settings size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {isSuperAdmin
                  ? "⚙️ Centro de Control & Configuraciones (SuperAdmin Maestro)"
                  : "⚙️ Preferencias & Parámetros Operativos del Tenant"}
              </h1>
              {currentTenant?.id === 'tenant_calcu_corp' && (
                <span className="px-3 py-1 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500/20 via-emerald-500/25 to-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-400/60 shadow-xs">
                  👑 PROPIETARIO • ACTIVE_PAID (PERPETUO)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isSuperAdmin
                ? "Telemetría ZTNA en tiempo real, gestión de LLM & bóveda criptográfica AES-256, consola de soporte asistido JIT y Copiloto SecOps."
                : "Preferencias regionales, datos fiscales DGI, alertas operativas de inventario y autorización de soporte técnico con consentimiento JIT."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAllSettings}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-colors"
            title="Refrescar datos del módulo"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refrescar</span>
          </button>
        </div>
      </div>

      {/* Banner de Feedback */}
      {feedbackBanner && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-150 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : feedbackBanner.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackBanner.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{feedbackBanner.text}</span>
          </div>
          <button onClick={() => setFeedbackBanner(null)} className="font-bold ml-4 cursor-pointer text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>
      )}

      {/* Selector de Pestañas según Rol (Dual SuperAdmin vs Tenant) */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {isSuperAdmin && (
          <>
            <button
              onClick={() => setActiveTab('superadmin_telemetry')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'superadmin_telemetry'
                  ? 'bg-sky-50 dark:bg-sky-950/60 text-[#00a2e8] border border-sky-200 dark:border-sky-800 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Activity size={15} />
              <span>Telemetría de Red &amp; Paquetes</span>
            </button>

            <button
              onClick={() => setActiveTab('superadmin_ai_vault')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'superadmin_ai_vault'
                  ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Cpu size={15} />
              <span>Motor IA &amp; Bóveda AES-256</span>
            </button>

            <button
              onClick={() => setActiveTab('superadmin_jit')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'superadmin_jit'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Shield size={15} />
              <span>Consola Soporte Asistido (JIT)</span>
            </button>

            <button
              onClick={() => setActiveTab('superadmin_copilot')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'superadmin_copilot'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles size={15} />
              <span>Copiloto SecOps Guardian</span>
            </button>
          </>
        )}

        {/* Pestañas para Todos / Tenant Estándar */}
        <button
          onClick={() => setActiveTab('tenant_regional')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'tenant_regional'
              ? 'bg-sky-50 dark:bg-sky-950/60 text-[#00a2e8] border border-sky-200 dark:border-sky-800 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Globe size={15} />
          <span>Preferencias Regionales</span>
        </button>

        <button
          onClick={() => setActiveTab('tenant_params')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'tenant_params'
              ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 size={15} />
          <span>Parámetros Operativos DGI</span>
        </button>

        <button
          onClick={() => setActiveTab('tenant_jit_auth')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'tenant_jit_auth'
              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Lock size={15} />
          <span>Autorización Soporte (JIT)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. SECCIÓN SUPERADMIN: TELEMETRÍA DE RED Y PAQUETES EN VIVO */}
      {/* ========================================================================= */}
      {activeTab === 'superadmin_telemetry' && isSuperAdmin && telemetry && (
        <div className="space-y-6">
          {/* Tarjetas de Throughput y Baseline de Puertos */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">API FastAPI Core</span>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {telemetry.api_core_metrics.throughput_rps} <span className="text-xs font-normal text-slate-400">req/s</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
                ● Puerto :8000 Activo (Latencia P95: {telemetry.api_core_metrics.p95_response_time_ms}ms)
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Auditoría Puertos ISO 27001</span>
              <div className="text-xl font-black text-emerald-600 mt-1">
                {telemetry.ports_perimeter_audit.iso_compliance_score}%
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
                {telemetry.ports_perimeter_audit.status_label}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tailscale Mesh Nodes</span>
              <div className="text-xl font-black text-indigo-600 mt-1">
                {telemetry.mesh_telemetry.direct_p2p_count} Direct P2P
              </div>
              <span className="text-[11px] text-slate-500 font-medium mt-1 inline-block">
                1 Relay Standby (0% paquetes perdidos)
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">WebSockets Concurrencia</span>
              <div className="text-xl font-black text-purple-600 mt-1">
                18.2 <span className="text-xs font-normal text-slate-400">KB/s</span>
              </div>
              <span className="text-[11px] text-purple-600 font-semibold mt-1 inline-block">
                Compresión Gzip Activa (78% ahorro)
              </span>
            </div>
          </div>

          {/* Monitor de Nodos Mesh Tailscale */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Radio size={18} className="text-[#00a2e8]" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Topología Tailscale ZTNA &amp; Estado P2P vs. DERP
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                WireGuard Encriptado
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400">
                    <th className="py-2 px-3">Nodo / Dispositivo</th>
                    <th className="py-2 px-3">IP Tailscale</th>
                    <th className="py-2 px-3">Tipo de Conexión</th>
                    <th className="py-2 px-3">Latencia</th>
                    <th className="py-2 px-3">Estado</th>
                    <th className="py-2 px-3 text-right">Último Handshake</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {telemetry.mesh_telemetry.mesh_nodes.map(node => (
                    <tr key={node.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        <div>{node.hostname}</div>
                        <div className="text-[10px] text-slate-400">{node.os}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {node.tailscale_ip}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          node.connection_type === 'DIRECT_P2P'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          {node.connection_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {node.latency_ms} ms
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-emerald-600 font-bold">● {node.status}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500 font-mono text-[11px]">
                        {node.last_handshake}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Inspector de Tráfico WebSockets */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Server size={18} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Inspector de Tráfico WebSockets en Vivo (Telemetría 3PL &amp; Omnicanal)
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {telemetry.websockets_telemetry.streams.map((stream, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{stream.channel}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                      {stream.status}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">{stream.endpoint}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div>Paquetes/seg: <strong>{stream.packets_per_sec}</strong></div>
                    <div>Throughput: <strong>{stream.throughput_kbs} KB/s</strong></div>
                    <div>Clientes Conectados: <strong>{stream.connected_clients}</strong></div>
                    <div>Compresión: <strong>{stream.compression}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SECCIÓN SUPERADMIN: MOTOR IA & BÓVEDA CRIPTOGRÁFICA */}
      {/* ========================================================================= */}
      {activeTab === 'superadmin_ai_vault' && isSuperAdmin && aiVault && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gestión del Motor Ollama Local */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Cpu size={18} className="text-purple-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Configuración de Motor LLM (Ollama Local)
                  </h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700">
                  Online
                </span>
              </div>

              <form onSubmit={handleSaveAIParams} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Endpoint del Servidor Ollama
                  </label>
                  <input
                    type="text"
                    value={aiEndpoint}
                    onChange={(e) => setAiEndpoint(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Temperatura de Generación: {aiTemperature}
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">0.0 (Determinístico) - 1.0 (Creativo)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={aiTemperature}
                    onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-[#00a2e8]"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                  <div>• Modelo Activo por Defecto: <strong>{aiVault.ai_engine.active_model}</strong></div>
                  <div>• Context Window: <strong>{aiVault.ai_engine.context_window} tokens</strong></div>
                  <div>• Modelos Disponibles: {aiVault.ai_engine.available_models.join(', ')}</div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingAIParams}
                  className="w-full py-2.5 rounded-xl bg-[#00a2e8] hover:bg-[#008ecb] text-white font-bold cursor-pointer transition-all"
                >
                  {isSavingAIParams ? 'Guardando...' : 'Aplicar Parámetros de Inferencia'}
                </button>
              </form>
            </div>

            {/* Bóveda Criptográfica AES-256 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Key size={18} className="text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Bóveda Criptográfica AES-256 (ISO 27001)
                  </h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">
                  AES-CTR + HMAC
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Huella de Clave Activa</span>
                  <code className="text-emerald-600 font-mono font-bold break-all">
                    {aiVault.cryptographic_vault.key_fingerprint}
                  </code>
                  <div className="text-[10px] text-slate-400 pt-1">
                    Última rotación: {new Date(aiVault.cryptographic_vault.last_rotation).toLocaleString()}
                  </div>
                </div>

                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Las credenciales de Mercado Libre, Meta Ads, WhatsApp y Google Ads se almacenan cifradas en reposo con salting dinámico. La rotación de claves no interrumpe sesiones en curso.
                </p>

                <button
                  type="button"
                  onClick={handleRotateVaultKeys}
                  disabled={isRotatingKeys}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-tr from-amber-600 to-emerald-600 hover:from-amber-700 hover:to-emerald-700 text-white font-bold cursor-pointer transition-all shadow-xs"
                >
                  <RefreshCw size={14} className={isRotatingKeys ? 'animate-spin' : ''} />
                  <span>{isRotatingKeys ? 'Rotando Claves...' : 'Rotar Claves AES-256 en 1-Clic'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Estado de Webhooks Multicanal */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Zap size={16} className="text-[#00a2e8]" />
              <span>Estado de Webhooks Conectados</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {aiVault.webhooks_summary.map((wh, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-white">{wh.display_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      wh.is_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {wh.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">Canal: {wh.channel}</div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-2">
                    Leads capturados: <strong>{wh.leads_count}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SECCIÓN SUPERADMIN: CONSOLA DE SOPORTE ASISTIDO (JIT IMPERSONATION) */}
      {/* ========================================================================= */}
      {activeTab === 'superadmin_jit' && isSuperAdmin && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Shield size={18} className="text-indigo-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Consola de Soporte Técnico Asistido (Just-In-Time Impersonation)
                </h3>
                <p className="text-xs text-slate-500">
                  Solicite acceso temporal de 60 minutos a la cuenta de cualquier empresa cliente con estricto consentimiento del administrador bajo ISO 27001.
                </p>
              </div>
            </div>

            <form onSubmit={handleRequestJIT} className="space-y-3 text-xs max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Empresa Cliente Destino (Tenant ID)
                  </label>
                  <select
                    value={jitTargetTenant}
                    onChange={(e) => setJitTargetTenant(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold"
                  >
                    <option value="tenant_distsur">Distribuidora del Sur (tenant_distsur)</option>
                    <option value="tenant_demo_sandbox">Demo Sandbox (tenant_demo_sandbox)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Duración Solicitada
                  </label>
                  <input
                    type="text"
                    disabled
                    value="60 Minutos (Límite estricto TTL)"
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Motivo Justificado de Soporte Técnico *
                </label>
                <textarea
                  required
                  rows={2}
                  value={jitReason}
                  onChange={(e) => setJitReason(e.target.value)}
                  placeholder="ej. Diagnóstico de sincronización de stock y verificación de catálogo"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
                />
              </div>

              <button
                type="submit"
                disabled={isRequestingJIT}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer transition-all shadow-xs"
              >
                {isRequestingJIT ? 'Enviando Solicitud...' : 'Solicitar Acceso de Soporte a Empresa'}
              </button>
            </form>
          </div>

          {/* Historial de Sesiones JIT */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              <span>Registro de Sesiones de Soporte JIT ({jitSessions.length})</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase text-slate-400">
                    <th className="py-2 px-3">ID Sesión</th>
                    <th className="py-2 px-3">Empresa Destino</th>
                    <th className="py-2 px-3">Motivo</th>
                    <th className="py-2 px-3">Estado</th>
                    <th className="py-2 px-3">Solicitada</th>
                    <th className="py-2 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {jitSessions.map(sess => (
                    <tr key={sess.session_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {sess.session_id}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-indigo-600">
                        {sess.target_tenant_id}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-600 dark:text-slate-300">
                        {sess.reason}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sess.status.includes('APPROVED')
                            ? 'bg-emerald-100 text-emerald-700'
                            : sess.status.includes('PENDING')
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {sess.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {new Date(sess.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {sess.status.includes('APPROVED') && (
                          <button
                            onClick={() => handleJITAction(sess.session_id, 'revoke')}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-[11px] cursor-pointer"
                          >
                            Revocar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SECCIÓN SUPERADMIN: COPILOTO IA DE CIBERSEGURIDAD (SECOPS COPILOT) */}
      {/* ========================================================================= */}
      {activeTab === 'superadmin_copilot' && isSuperAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>SecOps Copilot • Cybersec AI Guardian</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-mono">
                    ISO/IEC 27001:2022
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Agente autónomo para inspección de paquetes, detección de anomalías de puertos y custodia de aislamiento PostgreSQL.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Prompts de Diagnóstico Rápido */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => handleAskCopilot('¿Detectas alguna anomalía o puerto fuera de :8000 y :5173?')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              🔍 Escaneo de Puertos Autorizados
            </button>
            <button
              onClick={() => handleAskCopilot('Auditar aislamiento de esquemas Schema-per-Tenant y estado del Propietario')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              🔐 Aislamiento Multi-Tenant &amp; Propietario
            </button>
            <button
              onClick={() => handleAskCopilot('Inspeccionar tráfico de paquetes y estado ZTNA en Tailscale y WebSockets')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              📡 Diagnóstico de Paquetes ZTNA
            </button>
            <button
              onClick={() => handleAskCopilot('Auditar intentos de login, eventos críticos y trazabilidad 2FA TOTP')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              📋 Auditoría de Login &amp; 2FA
            </button>
          </div>

          {/* Chat Window */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 min-h-[300px] max-h-[460px] overflow-y-auto space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
            {copilotChat.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-bold text-slate-400">
                    {msg.sender === 'user' ? 'Sebastian Rodriguez' : '🛡️ Cybersec Guardian'}
                  </span>
                  <span className="text-[9px] text-slate-400">{msg.time}</span>
                </div>
                <div
                  className={`p-3.5 rounded-2xl text-xs max-w-xl leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-[#00a2e8] text-white rounded-br-xs font-medium'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs shadow-xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isCopilotThinking && (
              <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
                <RefreshCw size={14} className="animate-spin text-emerald-500" />
                <span>Analizando logs de auditoría y tráfico en vivo...</span>
              </div>
            )}
          </div>

          {/* Input Chat */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={copilotPrompt}
              onChange={(e) => setCopilotPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskCopilot()}
              placeholder="Pregunta a SecOps Copilot sobre seguridad, puertos, paquetes o aislamiento..."
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00a2e8]"
            />
            <button
              onClick={() => handleAskCopilot()}
              disabled={isCopilotThinking || !copilotPrompt.trim()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Send size={13} />
              <span>Analizar</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SECCIÓN TENANT: PREFERENCIAS REGIONALES Y VISUALES */}
      {/* ========================================================================= */}
      {activeTab === 'tenant_regional' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Globe size={18} className="text-[#00a2e8]" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Preferencias Regionales y Visuales
              </h3>
              <p className="text-xs text-slate-500">
                Personalice el idioma, la moneda base de visualización y el formato numérico de su empresa.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveTenantParams} className="space-y-4 text-xs max-w-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Idioma de la Interfaz
                </label>
                <select
                  value={tenantParams.idioma}
                  onChange={(e) => setTenantParams(prev => ({ ...prev, idioma: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
                >
                  <option value="es">Español (Uruguay / LATAM)</option>
                  <option value="en">English (US)</option>
                  <option value="pt">Português (Brasil)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Moneda Base de Visualización
                </label>
                <select
                  value={tenantParams.moneda_base}
                  onChange={(e) => setTenantParams(prev => ({ ...prev, moneda_base: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
                >
                  <option value="UYU">Peso Uruguayo ($ UYU)</option>
                  <option value="USD">Dólar Estadounidense (USD $)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Formato Numérico y Separador Decimal
                </label>
                <select
                  value={tenantParams.formato_numerico}
                  onChange={(e) => setTenantParams(prev => ({ ...prev, formato_numerico: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono"
                >
                  <option value="1.234,56">1.234,56 (Estándar UY/ES)</option>
                  <option value="1,234.56">1,234.56 (Estándar US/EN)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tema Visual de la Suite
                </label>
                <select
                  value={tenantParams.tema_visual}
                  onChange={(e) => setTenantParams(prev => ({ ...prev, tema_visual: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
                >
                  <option value="light_bitrix">Bitrix Light (Claro)</option>
                  <option value="dark">Dark Professional (Oscuro)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#00a2e8] hover:bg-[#008ecb] text-white font-bold cursor-pointer transition-all shadow-xs"
            >
              Guardar Preferencias Regionales
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SECCIÓN TENANT: PARÁMETROS OPERATIVOS DGI & ALERTAS */}
      {/* ========================================================================= */}
      {activeTab === 'tenant_params' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Building2 size={18} className="text-amber-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Parámetros Operativos del Tenant &amp; Datos Fiscales DGI
              </h3>
              <p className="text-xs text-slate-500">
                Configure datos para e-Facturas/Remitos, umbrales de alerta ROP/DOH y canales de notificación.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveTenantParams} className="space-y-4 text-xs max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  RUT DGI (12 Dígitos)
                </label>
                <input
                  type="text"
                  value={tenantParams.rut_dgi}
                  onChange={(e) => setTenantParams(prev => ({ ...prev, rut_dgi: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Razón Social Registrada
                </label>
                <input
                  type="text"
                  value={tenantParams.razon_social}
                  onChange={(e) => setTenantParams(prev => ({ ...prev, razon_social: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Serie CFE (e-Factura)
                </label>
                <input
                  type="text"
                  value={tenantParams.cfe_serie}
                  onChange={(e) => setTenantParams(prev => ({ ...prev, cfe_serie: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alerta ROP Mínimo (Días)
                </label>
                <input
                  type="number"
                  value={tenantParams.rop_min_days_alert}
                  onChange={(e) => setTenantParams(prev => ({ ...prev, rop_min_days_alert: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Umbral DOH Crítico (Días)
                </label>
                <input
                  type="number"
                  value={tenantParams.doh_critical_alert}
                  onChange={(e) => setTenantParams(prev => ({ ...prev, doh_critical_alert: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">Canales de Notificación Operativa</span>
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tenantParams.whatsapp_notifications}
                    onChange={(e) => setTenantParams(prev => ({ ...prev, whatsapp_notifications: e.target.checked }))}
                    className="rounded accent-emerald-600"
                  />
                  <span>Notificaciones por WhatsApp Cloud</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tenantParams.email_notifications}
                    onChange={(e) => setTenantParams(prev => ({ ...prev, email_notifications: e.target.checked }))}
                    className="rounded accent-blue-600"
                  />
                  <span>Notificaciones por Email Corporativo</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer transition-all shadow-xs"
            >
              Guardar Parámetros Fiscales &amp; Alertas
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. SECCIÓN TENANT: AUTORIZACIÓN DE SOPORTE TÉCNICO (CONSENTIMIENTO JIT) */}
      {/* ========================================================================= */}
      {activeTab === 'tenant_jit_auth' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Lock size={18} className="text-rose-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Autorización de Soporte Técnico Remoto (Consentimiento JIT)
              </h3>
              <p className="text-xs text-slate-500">
                Ningún administrador externo puede ingresar a su cuenta sin su autorización explícita. Autorice acceso temporal bajo auditoría ISO/IEC 27001:2022.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {jitSessions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No hay solicitudes de soporte técnico pendientes en este momento.
              </div>
            ) : (
              jitSessions.map(sess => (
                <div
                  key={sess.session_id}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        Solicitud de: {sess.requested_by}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        sess.status.includes('APPROVED')
                          ? 'bg-emerald-100 text-emerald-700'
                          : sess.status.includes('REVOKED')
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {sess.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Motivo declarado: <strong>"{sess.reason}"</strong>
                    </p>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Sesión ID: {sess.session_id} • Duración: {sess.duration_minutes} min • Fecha: {new Date(sess.requested_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {sess.status.includes('PENDING') && (
                      <button
                        onClick={() => handleJITAction(sess.session_id, 'approve')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                      >
                        <Check size={14} />
                        <span>Aprobar Acceso Temporal (60 min)</span>
                      </button>
                    )}

                    {!sess.status.includes('REVOKED') && (
                      <button
                        onClick={() => handleJITAction(sess.session_id, 'revoke')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                      >
                        <X size={14} />
                        <span>Revocar Acceso</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
