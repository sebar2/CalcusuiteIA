import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Users, 
  UserPlus, 
  MapPin, 
  Wifi, 
  Search, 
  Download, 
  X, 
  Edit3, 
  EyeOff,
  FileText,
  BarChart3,
  Sparkles,
  Send,
  Clock,
  TrendingUp,
  Package,
  CreditCard,
  Building2,
  Mail,
  Lock,
  Key,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { apiService } from '../services/api';
import type { AuditLogItem, SystemUserItem, DashboardMetricsResponse } from '../types';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

const ALL_SYSTEM_MODULES = [
  { id: 'monitoring', label: 'Monitoreo & Auditoría', group: 'Gobierno' },
  { id: 'accounting', label: 'Contabilidad & Cobranzas', group: 'Finanzas' },
  { id: 'variance', label: 'Control Presupuestario FP&A', group: 'Finanzas' },
  { id: 'initiatives', label: 'Evaluador de Iniciativas & CAPEX', group: 'Finanzas' },
  { id: 'reports', label: 'Minutas Ejecutivas IA', group: 'Finanzas' },
  { id: 'invoices', label: 'Facturación B2B (e-Facturas)', group: 'Comercial' },
  { id: 'crm', label: 'Pipeline Comercial CRM', group: 'Comercial' },
  { id: 'pricing', label: 'Pricing & Canales', group: 'Comercial' },
  { id: 'clients', label: 'Directorio Clientes B2B', group: 'Comercial' },
  { id: 'control_room', label: 'Control Room Abastecimiento', group: 'Supply Chain' },
  { id: 'kanban', label: 'Pipeline Kanban ROP', group: 'Supply Chain' },
  { id: 'stock_trace', label: 'Trazabilidad Multi-Depósito', group: 'Supply Chain' },
  { id: 'suppliers', label: 'Directorio Proveedores', group: 'Supply Chain' },
  { id: 'supplier-catalogs', label: 'Catálogos Proveedores', group: 'Supply Chain' },
  { id: 'logistics-clients', label: 'Clientes 3PL', group: '3PL Logística' },
  { id: 'logistics-fleet', label: 'Flota & Choferes 3PL', group: '3PL Logística' },
  { id: 'logistics-inventory', label: 'Depósito & Stock 3PL (WMS)', group: '3PL Logística' },
  { id: 'logistics-kanban', label: 'Kanban Operativo 3PL', group: '3PL Logística' },
  { id: 'logistics-tracking', label: 'Tracking GPS en Vivo', group: '3PL Logística' },
  { id: 'logistics-orders', label: 'Órdenes de Servicio 3PL', group: '3PL Logística' },
  { id: 'logistics-finance', label: 'Rentabilidad 3PL', group: '3PL Logística' },
  { id: 'tenders_radar', label: 'Radar de Licitaciones', group: 'Licitaciones' },
  { id: 'tenders_benchmarks', label: 'Precios & SICE', group: 'Licitaciones' },
  { id: 'tenders_competitors', label: 'Competidores Licitaciones', group: 'Licitaciones' },
  { id: 'tenders_buyers', label: 'Compradores Estatales', group: 'Licitaciones' },
  { id: 'tenders_calendar', label: 'Calendario Convocatorias', group: 'Licitaciones' },
  { id: 'tenders_cotizador', label: 'Cotizador B2B', group: 'Licitaciones' },
  { id: 'etl', label: 'Ingesta de Datos (ETL)', group: 'Sistema' },
];

export const MonitoringAuditView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit_logs' | 'users' | 'debtors_reports' | 'executive_dashboard'>('executive_dashboard');
  
  // Audit Logs State
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [severidadFilter, setSeveridadFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Users State
  const [users, setUsers] = useState<SystemUserItem[]>([]);
  const [presets, setPresets] = useState<Record<string, { role: string; restricted_modules: string[] }>>({});
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Reportes de Deudores State
  const [debtorsFilterDays, setDebtorsFilterDays] = useState<number | undefined>(undefined);
  const [debtorsReport, setDebtorsReport] = useState<any>(null);
  const [isLoadingDebtors, setIsLoadingDebtors] = useState(false);

  // Dashboard Ejecutivo State
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  // Copiloto IA Gemini Chat State
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotHistory, setCopilotHistory] = useState<Array<{ sender: 'user' | 'gemini'; text: string; time: string }>>([
    {
      sender: 'gemini',
      text: '¡Hola! Soy tu Agente IA Gemini para analítica ejecutiva y reportes. He examinado los datos de cobranzas, KPIs de vendedores, asistencia y productos. ¿Qué análisis o reporte deseas extraer?',
      time: 'Ahora'
    }
  ]);
  const [isCopilotTyping, setIsCopilotTyping] = useState(false);

  // Modales Usuario
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUserItem | null>(null);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [userFormError, setUserFormError] = useState<string | null>(null);

  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    nombre_completo: '',
    password: '',
    send_email: true,
    puesto: 'Ejecutivo de Cuentas B2B',
    role: 'analista_comercial',
    restricted_modules: [] as string[],
    activo: true,
  });
  const [editPassword, setEditPassword] = useState('');
  const [editSendEmail, setEditSendEmail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userToast, setUserToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pwd = 'Calcu-';
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const handleSendCredentials = async (u: SystemUserItem) => {
    try {
      const res = await apiService.sendUserCredentials(u.id);
      setUserToast({
        type: 'success',
        message: `Credenciales notificadas a ${u.email}. Clave: ${res.password}`
      });
      setTimeout(() => setUserToast(null), 6000);
    } catch (err: any) {
      setUserToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Error al enviar credenciales por correo'
      });
      setTimeout(() => setUserToast(null), 5000);
    }
  };

  // Carga de Datos
  const fetchAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const data = await apiService.getMonitoringAuditLogs({
        severidad: severidadFilter || undefined,
        search: searchQuery || undefined,
        limit: 100
      });
      setLogs(data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const [userList, presetList] = await Promise.all([
        apiService.getSystemUsers(),
        apiService.getPositionPresets()
      ]);
      setUsers(userList);
      setPresets(presetList);
    } catch (err) {
      console.error('Error fetching users/presets:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchDebtorsReport = async (days?: number) => {
    setIsLoadingDebtors(true);
    try {
      const data = await apiService.getDebtorsReport(days);
      setDebtorsReport(data);
    } catch (err) {
      console.error('Error fetching debtors report:', err);
    } finally {
      setIsLoadingDebtors(false);
    }
  };

  const fetchDashboardMetrics = async () => {
    setIsLoadingDashboard(true);
    try {
      const data = await apiService.getDashboardMetrics();
      setDashboardMetrics(data);
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    fetchUsers();
    fetchDebtorsReport(debtorsFilterDays);
    fetchDashboardMetrics();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit_logs') fetchAuditLogs();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'debtors_reports') fetchDebtorsReport(debtorsFilterDays);
    if (activeTab === 'executive_dashboard') fetchDashboardMetrics();
  }, [activeTab, severidadFilter, debtorsFilterDays]);

  // Consulta al Copiloto Gemini
  const handleAskCopilot = async (questionText?: string) => {
    const q = questionText || copilotPrompt;
    if (!q.trim()) return;

    const userMsg = { sender: 'user' as const, text: q, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setCopilotHistory(prev => [...prev, userMsg]);
    setCopilotPrompt('');
    setIsCopilotTyping(true);

    try {
      const res = await apiService.askMonitoringCopilot(q);
      const aiMsg = { 
        sender: 'gemini' as const, 
        text: res.respuesta, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      };
      setCopilotHistory(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('Error querying copilot:', err);
      setCopilotHistory(prev => [...prev, {
        sender: 'gemini' as const,
        text: 'Ocurrió un error al procesar tu solicitud con el modelo Gemini. Por favor intenta de nuevo.',
        time: 'Error'
      }]);
    } finally {
      setIsCopilotTyping(false);
    }
  };

  // Preset Selector
  const handlePuestoChange = (puesto: string) => {
    const preset = presets[puesto];
    setUserForm({
      ...userForm,
      puesto,
      role: preset?.role || 'operaciones',
      restricted_modules: preset?.restricted_modules || []
    });
  };

  const handleToggleModule = (moduleId: string) => {
    const exists = userForm.restricted_modules.includes(moduleId);
    const updated = exists
      ? userForm.restricted_modules.filter(m => m !== moduleId)
      : [...userForm.restricted_modules, moduleId];
    setUserForm({ ...userForm, restricted_modules: updated });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingUser(true);
    setUserFormError(null);
    try {
      const finalPassword = userForm.password.trim() || generateRandomPassword();
      await apiService.createSystemUser({
        ...userForm,
        password: finalPassword
      });
      setShowCreateUserModal(false);
      setUserToast({
        type: 'success',
        message: `Usuario @${userForm.username} creado exitosamente. Clave: ${finalPassword}${userForm.send_email ? ' (notificado al correo)' : ''}`
      });
      setTimeout(() => setUserToast(null), 6000);
      setUserForm({
        username: '',
        email: '',
        nombre_completo: '',
        password: '',
        send_email: true,
        puesto: 'Ejecutivo de Cuentas B2B',
        role: 'analista_comercial',
        restricted_modules: [],
        activo: true
      });
      fetchUsers();
    } catch (err: any) {
      setUserFormError(err.response?.data?.detail || err.message || 'Error al crear usuario');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleUpdatePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmittingUser(true);
    setUserFormError(null);
    try {
      await apiService.updateUserPermissions(editingUser.id, {
        puesto: editingUser.puesto,
        role: editingUser.role,
        password: editPassword.trim() || undefined,
        send_email: editSendEmail,
        restricted_modules: editingUser.restricted_modules,
        activo: editingUser.activo
      });
      setUserToast({
        type: 'success',
        message: `Permisos actualizados para @${editingUser.username}.${editPassword.trim() ? ' Nueva clave asignada.' : ''}`
      });
      setTimeout(() => setUserToast(null), 5000);
      setEditingUser(null);
      setEditPassword('');
      setEditSendEmail(false);
      fetchUsers();
    } catch (err: any) {
      setUserFormError(err.response?.data?.detail || err.message || 'Error al actualizar permisos');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleToggleActive = async (userId: number) => {
    try {
      await apiService.toggleUserActive(userId);
      fetchUsers();
    } catch (err) {
      console.error('Error toggling user active state:', err);
    }
  };

  const exportAuditLogsCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Fecha', 'Hora', 'Usuario', 'Rol', 'Acción', 'Ubicación', 'IP Tailscale', 'Evento Realizado', 'Severidad'];
    const rows = logs.map(l => [
      l.fecha,
      l.hora,
      l.user_id,
      l.role,
      l.action,
      `"${l.ubicacion || ''}"`,
      l.ip_address || '',
      `"${l.evento_realizado.replace(/"/g, '""')}"`,
      l.severidad
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Auditoria_ISO27001_Calcu_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDebtorsCSV = () => {
    if (!debtorsReport?.deudores || debtorsReport.deudores.length === 0) return;
    const headers = ['Cliente', 'Documento', 'Tipo Doc', 'Total Deuda UYU', 'Dias Vencido', 'Etapa Cobranza', 'Facturas Adeudadas'];
    const rows = debtorsReport.deudores.map((d: any) => [
      `"${d.cliente_nombre}"`,
      d.cliente_rut,
      d.tipo_documento,
      d.monto_total_deuda,
      d.dias_max_vencido,
      d.etapa,
      `"${d.facturas_numeros.join('; ')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Reporte_Deudores_Mora_${debtorsFilterDays ? `${debtorsFilterDays}d_` : ''}${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6 animate-in fade-in duration-200">
        {userToast && (
          <div className={`p-3.5 rounded-2xl flex items-center justify-between border shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
            userToast.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' 
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}>
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 size={18} className={userToast.type === 'success' ? 'text-emerald-600' : 'text-rose-600'} />
              <span className="text-xs font-semibold">{userToast.message}</span>
            </div>
            <button onClick={() => setUserToast(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Cabecera Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Monitoreo, Auditoría &amp; Inteligencia
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Tailscale VPN &amp; Gemini AI
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dashboard analítico, reportes de deudores, registro perimetral ISO 27001 y control de usuarios con RBAC granular.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {activeTab === 'audit_logs' && (
              <button
                onClick={exportAuditLogsCSV}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Download size={14} />
                <span>Exportar CSV</span>
              </button>
            )}

            {activeTab === 'debtors_reports' && (
              <button
                onClick={exportDebtorsCSV}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Download size={14} />
                <span>Exportar Deudores CSV</span>
              </button>
            )}

            {activeTab === 'users' && (
              <button
                onClick={() => setShowCreateUserModal(true)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus size={15} />
                <span>Crear Usuario</span>
              </button>
            )}
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('executive_dashboard')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'executive_dashboard'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <BarChart3 size={15} />
            <span>Dashboard Ejecutivo &amp; Copiloto IA</span>
          </button>

          <button
            onClick={() => setActiveTab('debtors_reports')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'debtors_reports'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <FileText size={15} />
            <span>Reporte de Deudores &amp; Facturas</span>
          </button>

          <button
            onClick={() => setActiveTab('audit_logs')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'audit_logs'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Activity size={15} />
            <span>Registro de Actividades en Vivo</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Users size={15} />
            <span>Control de Usuarios &amp; Permisos ({users.length})</span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* PESTAÑA 1: DASHBOARD EJECUTIVO & AGENTE IA GEMINI                      */}
        {/* ===================================================================== */}
        {activeTab === 'executive_dashboard' && isLoadingDashboard && (
          <div className="p-12 text-center text-slate-400 font-mono text-xs animate-pulse">
            Cargando Dashboard Ejecutivo y métricas consolidadas...
          </div>
        )}
        {activeTab === 'executive_dashboard' && dashboardMetrics && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* AGENTE IA DE GEMINI (Copiloto Conversacional & Explicativo) */}
            <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-5 text-white shadow-xl border border-indigo-500/20 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-indigo-800/40">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight flex items-center space-x-2">
                      <span>Agente IA Ejecutivo Gemini (Motor Antigravity)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                        En Línea
                      </span>
                    </h3>
                    <p className="text-[11px] text-indigo-200/80">
                      Pregúntame sobre deudores, metas de vendedores, anomalías en ingresos/egresos o cómo extraer reportes clave.
                    </p>
                  </div>
                </div>

                {/* Preguntas Frecuentes / Atajos Rápidos */}
                <div className="hidden md:flex items-center space-x-2">
                  <button
                    onClick={() => handleAskCopilot('¿Cuál es la situación actual de los deudores y qué cuentas tienen más de 60 días?')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-800/40 hover:bg-indigo-700/50 text-[10px] font-semibold text-indigo-200 border border-indigo-700/50 cursor-pointer transition-colors"
                  >
                    🔍 Deudores Críticos
                  </button>
                  <button
                    onClick={() => handleAskCopilot('¿Cómo van las ventas de cada vendedor y su cumplimiento de metas?')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-800/40 hover:bg-indigo-700/50 text-[10px] font-semibold text-indigo-200 border border-indigo-700/50 cursor-pointer transition-colors"
                  >
                    🏆 KPI Vendedores
                  </button>
                  <button
                    onClick={() => handleAskCopilot('¿Cuáles son los productos más facturados y su margen promedio?')}
                    className="px-2.5 py-1 rounded-lg bg-indigo-800/40 hover:bg-indigo-700/50 text-[10px] font-semibold text-indigo-200 border border-indigo-700/50 cursor-pointer transition-colors"
                  >
                    💡 Top Productos
                  </button>
                </div>
              </div>

              {/* Chat Historial */}
              <div className="max-h-56 overflow-y-auto space-y-3 pr-2 text-xs">
                {copilotHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl whitespace-pre-wrap leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-slate-800/90 text-slate-100 border border-slate-700/70 rounded-tl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 px-1">{msg.time}</span>
                  </div>
                ))}
                {isCopilotTyping && (
                  <div className="flex items-center space-x-2 text-indigo-300 text-xs italic">
                    <Sparkles size={13} className="animate-spin" />
                    <span>Gemini analizando métricas de la base de datos...</span>
                  </div>
                )}
              </div>

              {/* Input Chat */}
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="text"
                  placeholder="Escribe tu consulta ejecutiva a Gemini (ej. ¿Qué reporte debo generar para cobrar la cartera vencida?)..."
                  value={copilotPrompt}
                  onChange={(e) => setCopilotPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskCopilot()}
                  className="flex-1 bg-slate-800/80 border border-indigo-500/30 rounded-xl px-3.5 py-2 text-xs text-white placeholder-indigo-300/40 focus:outline-none focus:border-indigo-400"
                />
                <button
                  onClick={() => handleAskCopilot()}
                  disabled={isCopilotTyping || !copilotPrompt.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Send size={13} />
                  <span>Preguntar</span>
                </button>
              </div>
            </div>

            {/* LOS 6 CUADRANTES DEL DASHBOARD */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* CUADRANTE 1: Deudores & Mora */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Clock size={16} className="text-rose-600" />
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">1. Deudores &amp; Mora (Aging)</h4>
                  </div>
                  <span className="font-mono text-xs font-bold text-rose-600">
                    ${dashboardMetrics.deudores.resumen.total_cartera_vencida.toLocaleString()} UYU
                  </span>
                </div>
                <div className="space-y-2">
                  {dashboardMetrics.deudores.etapas.map((st) => (
                    <div key={st.etapa} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-slate-600 dark:text-slate-300 font-semibold">{st.titulo}</span>
                      <div className="text-right">
                        <span className="font-mono font-bold block text-slate-800 dark:text-slate-100">${st.monto.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{st.cantidad} clientes</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CUADRANTE 2: KPI de Vendedores */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    <TrendingUp size={16} className="text-emerald-600" />
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">2. KPI de Vendedores</h4>
                  </div>
                  <span className="text-[10px] text-slate-400">Metas Q3 2026</span>
                </div>
                <div className="space-y-2.5">
                  {dashboardMetrics.vendedores.map((v) => (
                    <div key={v.nombre} className="text-xs space-y-1 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex justify-between font-semibold">
                        <span className="text-slate-800 dark:text-slate-100">{v.nombre}</span>
                        <span className="text-emerald-600 font-mono font-bold">${v.ventas.toLocaleString()} ({v.cumplimiento_meta_pct}%)</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Cobrado: ${v.cobrado.toLocaleString()}</span>
                        <span className="text-rose-500">Mora: ${v.mora.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CUADRANTE 3: Horarios de Ingreso y Egreso */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Wifi size={16} className="text-indigo-600" />
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">3. Ingreso &amp; Egreso (Tailscale)</h4>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold">Activo Hoy</span>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {dashboardMetrics.asistencia_horarios.map((a) => (
                    <div key={a.username} className="text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-100 block">{a.usuario}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{a.nodo_tailscale}</span>
                      </div>
                      <div className="text-right font-mono text-[11px]">
                        <span className="text-emerald-600 block">{a.hora_ingreso}</span>
                        <span className="text-slate-400 text-[10px]">{a.hora_egreso}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CUADRANTE 4: KPIs de Productos */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Package size={16} className="text-amber-600" />
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">4. Productos Más Facturados</h4>
                  </div>
                  <span className="text-[10px] text-slate-400">Volumen &amp; Margen</span>
                </div>
                <div className="space-y-2">
                  {dashboardMetrics.top_productos.map((p) => (
                    <div key={p.sku} className="text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                      <div className="max-w-[65%]">
                        <span className="font-bold text-slate-800 dark:text-slate-100 block truncate">{p.descripcion}</span>
                        <span className="text-[10px] text-slate-400 font-mono">SKU: {p.sku} | {p.unidades_vendidas} un.</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-slate-900 dark:text-white block">${p.total_facturado.toLocaleString()}</span>
                        <span className="text-[10px] text-emerald-600 font-bold">{p.margen_estimado_pct}% mg</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CUADRANTE 5: Por Formas de Pago */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    <CreditCard size={16} className="text-sky-600" />
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">5. Por Formas de Pago</h4>
                  </div>
                  <span className="text-[10px] text-slate-400">Mix Financiero</span>
                </div>
                <div className="space-y-2">
                  {dashboardMetrics.formas_pago.map((fp) => (
                    <div key={fp.forma_pago} className="text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{fp.forma_pago}</span>
                      <div className="text-right font-mono">
                        <span className="font-bold text-slate-800 dark:text-slate-100 block">${fp.monto.toLocaleString()}</span>
                        <span className="text-[10px] text-indigo-500 font-bold">{fp.porcentaje}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CUADRANTE 6: Por Medio de Compra / Canal */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Building2 size={16} className="text-purple-600" />
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">6. Por Medio de Compra</h4>
                  </div>
                  <span className="text-[10px] text-slate-400">Canales B2B</span>
                </div>
                <div className="space-y-2">
                  {dashboardMetrics.medios_compra.map((mc) => (
                    <div key={mc.canal} className="text-xs p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-100 block">{mc.canal}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{mc.ordenes} operaciones</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-slate-900 dark:text-white block">${mc.monto.toLocaleString()}</span>
                        <span className="text-[10px] text-purple-600 font-bold">{mc.participacion_pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* PESTAÑA 2: REPORTE DE DEUDORES & FACTURAS (Filtros 1, 30, 45, 60d)     */}
        {/* ===================================================================== */}
        {activeTab === 'debtors_reports' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Filtros de Antigüedad Solicitados */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">Filtrar por Vencimiento:</span>
                <button
                  onClick={() => setDebtorsFilterDays(undefined)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                    debtorsFilterDays === undefined
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Todos los Deudores
                </button>
                <button
                  onClick={() => setDebtorsFilterDays(1)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                    debtorsFilterDays === 1
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  1 Día Vencido
                </button>
                <button
                  onClick={() => setDebtorsFilterDays(30)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                    debtorsFilterDays === 30
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  30 Días Vencido
                </button>
                <button
                  onClick={() => setDebtorsFilterDays(45)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                    debtorsFilterDays === 45
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  45 Días Vencido
                </button>
                <button
                  onClick={() => setDebtorsFilterDays(60)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                    debtorsFilterDays === 60
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  60+ Días Vencido (Crítico)
                </button>
              </div>

              <span className="font-mono text-xs font-semibold text-slate-500">
                {debtorsReport?.cantidad_deudores || 0} Cuentas Identificadas
              </span>
            </div>

            {/* Tabla Detallada de Deudores y Facturas */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#f5f7f8] dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Cliente / Razón Social</th>
                      <th className="py-3 px-4">Documento</th>
                      <th className="py-3 px-4">Límite Crédito</th>
                      <th className="py-3 px-4 text-right">Total Deuda ($)</th>
                      <th className="py-3 px-4 text-center">Días Mora</th>
                      <th className="py-3 px-4">Etapa Cobranza</th>
                      <th className="py-3 px-4">Números de Factura Asociadas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                    {isLoadingDebtors ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                          Cargando reporte de deudores...
                        </td>
                      </tr>
                    ) : debtorsReport?.deudores?.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                          No hay deudores en el tramo de vencimiento seleccionado.
                        </td>
                      </tr>
                    ) : (
                      debtorsReport?.deudores?.map((d: any) => (
                        <tr key={d.cliente_rut} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-white">
                            {d.cliente_nombre}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            <span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 mr-1 font-bold">
                              {d.tipo_documento}
                            </span>
                            {d.cliente_rut}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            ${d.limite_credito.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                            ${d.monto_total_deuda.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              +{d.dias_max_vencido} días
                            </span>
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {d.etapa}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-sans">
                            <div className="flex flex-wrap gap-1">
                              {d.facturas_numeros.map((fn: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                                  {fn}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* PESTAÑA 3: REGISTRO DE AUDITORÍA EN VIVO (ISO 27001)                  */}
        {/* ===================================================================== */}
        {activeTab === 'audit_logs' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar evento por usuario, acción o nodo Tailscale..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={severidadFilter}
                onChange={(e) => setSeveridadFilter(e.target.value)}
                className="bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Todas las Severidades</option>
                <option value="INFO">INFO (Operativo Normal)</option>
                <option value="WARNING">WARNING (Cambios de Permisos)</option>
                <option value="CRITICAL">CRITICAL (Alertas ISO 27001)</option>
              </select>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#f5f7f8] dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Fecha &amp; Hora</th>
                      <th className="py-3 px-4">Usuario</th>
                      <th className="py-3 px-4">Nodo Tailscale / IP</th>
                      <th className="py-3 px-4">Ubicación Física</th>
                      <th className="py-3 px-4">Evento / Cambio Realizado</th>
                      <th className="py-3 px-4 text-center">Severidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {isLoadingLogs ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          Consultando registro de auditoría en vivo...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          No se encontraron eventos registrados con este filtro.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {log.fecha} <span className="text-slate-400">{log.hora}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-900 dark:text-white block">{log.user_id}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{log.role}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                            {log.ip_address || '100.64.0.1'}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span>{log.ubicacion || 'Montevideo Central'}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-medium">
                            {log.evento_realizado}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.severidad === 'CRITICAL' 
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' 
                                : log.severidad === 'WARNING'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {log.severidad}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* PESTAÑA 4: CONTROL DE USUARIOS & RBAC GRANULAR                        */}
        {/* ===================================================================== */}
        {activeTab === 'users' && isLoadingUsers && (
          <div className="p-12 text-center text-slate-400 font-mono text-xs animate-pulse">
            Cargando nómina de usuarios y políticas de acceso...
          </div>
        )}
        {activeTab === 'users' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((u) => (
                <div key={u.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{u.nombre_completo}</h4>
                      <span className="text-[11px] text-slate-400 font-mono block">@{u.username} | {u.email}</span>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
                        {u.puesto}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleActive(u.id)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer ${
                        u.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Módulos Bloqueados ({u.restricted_modules?.length || 0}):
                    </span>
                    {u.restricted_modules && u.restricted_modules.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {u.restricted_modules.map((m) => (
                          <span key={m} className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-mono flex items-center space-x-1">
                            <EyeOff size={10} />
                            <span>{m}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-emerald-600 font-semibold block">
                        Acceso Total (Sin restricciones)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setEditPassword('');
                        setEditSendEmail(false);
                      }}
                      className="py-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                    >
                      <Edit3 size={13} />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => handleSendCredentials(u)}
                      className="py-1.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                      title="Notificar o reenviar credenciales al email corporativo"
                    >
                      <Mail size={13} />
                      <span>Enviar Clave</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODAL: Crear Usuario */}
        {showCreateUserModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 text-xs animate-in fade-in zoom-in-95 space-y-4 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Crear Nuevo Usuario Corporativo</h3>
                <button onClick={() => setShowCreateUserModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {userFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {userFormError}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-3 overflow-y-auto flex-1 pr-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Username</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. javier.gomez"
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Email Corporativo</label>
                    <input
                      type="email"
                      required
                      placeholder="jgomez@calcu.com.uy"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lic. Javier Gómez"
                    value={userForm.nombre_completo}
                    onChange={(e) => setUserForm({ ...userForm, nombre_completo: e.target.value })}
                    className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                      <Lock size={12} className="text-indigo-500" />
                      <span>Contraseña de Acceso</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setUserForm({ ...userForm, password: generateRandomPassword() })}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-bold underline cursor-pointer"
                    >
                      Generar Clave Aleatoria
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Dejar vacío para autogenerar o escribir una..."
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 pr-9 font-mono text-slate-800 dark:text-slate-100 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <label className="mt-2 flex items-center space-x-2 cursor-pointer bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={userForm.send_email}
                      onChange={(e) => setUserForm({ ...userForm, send_email: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-[11px] text-slate-600 dark:text-slate-300">
                      Notificar credenciales de acceso automáticamente por correo a <span className="font-mono font-semibold">{userForm.email || 'la casilla indicada'}</span>
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Puesto &amp; Preset Automático</label>
                  <select
                    value={userForm.puesto}
                    onChange={(e) => handlePuestoChange(e.target.value)}
                    className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                  >
                    {Object.keys(presets).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                {/* Checkboxes de Módulos Restringidos */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Seleccionar Módulos Prohibidos (Blacklist Checkboxes):
                  </span>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700">
                    {ALL_SYSTEM_MODULES.map((m) => (
                      <label key={m.id} className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                        <input
                          type="checkbox"
                          checked={userForm.restricted_modules.includes(m.id)}
                          onChange={() => handleToggleModule(m.id)}
                          className="rounded text-rose-600 focus:ring-rose-500"
                        />
                        <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">{m.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button type="button" onClick={() => setShowCreateUserModal(false)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer">
                    Cancelar
                  </button>
                  <button type="submit" disabled={isSubmittingUser} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer">
                    {isSubmittingUser ? 'Creando...' : 'Crear Usuario'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Editar Permisos de Usuario */}
        {editingUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 text-xs animate-in fade-in zoom-in-95 space-y-4 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  Editar Permisos de {editingUser.nombre_completo}
                </h3>
                <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdatePermissions} className="space-y-3 overflow-y-auto flex-1 pr-1">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Puesto</label>
                  <select
                    value={editingUser.puesto}
                    onChange={(e) => {
                      const pst = e.target.value;
                      const preset = presets[pst];
                      setEditingUser({
                        ...editingUser,
                        puesto: pst,
                        role: preset?.role || editingUser.role,
                        restricted_modules: preset?.restricted_modules || editingUser.restricted_modules
                      });
                    }}
                    className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-100"
                  >
                    {Object.keys(presets).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                      <Key size={12} className="text-amber-500" />
                      <span>Cambiar Contraseña (Opcional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditPassword(generateRandomPassword())}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-bold underline cursor-pointer"
                    >
                      Generar Clave
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Dejar en blanco para mantener la actual..."
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 pr-9 font-mono text-slate-800 dark:text-slate-100 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {editPassword.trim() && (
                    <label className="mt-2 flex items-center space-x-2 cursor-pointer bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700">
                      <input
                        type="checkbox"
                        checked={editSendEmail}
                        onChange={(e) => setEditSendEmail(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">
                        Enviar nueva clave por correo a <span className="font-mono font-semibold">{editingUser.email}</span>
                      </span>
                    </label>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Módulos Restringidos (Marcar para ocultar y bloquear):
                  </span>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700">
                    {ALL_SYSTEM_MODULES.map((m) => {
                      const isRestricted = editingUser.restricted_modules.includes(m.id);
                      return (
                        <label key={m.id} className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                          <input
                            type="checkbox"
                            checked={isRestricted}
                            onChange={() => {
                              const updated = isRestricted
                                ? editingUser.restricted_modules.filter(x => x !== m.id)
                                : [...editingUser.restricted_modules, m.id];
                              setEditingUser({ ...editingUser, restricted_modules: updated });
                            }}
                            className="rounded text-rose-600 focus:ring-rose-500"
                          />
                          <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">{m.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer">
                    Cancelar
                  </button>
                  <button type="submit" disabled={isSubmittingUser} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer">
                    {isSubmittingUser ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default MonitoringAuditView;
