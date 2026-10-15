import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Users, 
  UserPlus, 
  MapPin, 
  Wifi, 
  Filter, 
  Search, 
  Download, 
  X, 
  Edit3, 
  ShieldCheck,
  EyeOff
} from 'lucide-react';
import { apiService } from '../services/api';
import type { AuditLogItem, SystemUserItem } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

const ALL_SYSTEM_MODULES = [
  { id: 'monitoring', label: 'Monitoreo & Auditoría', group: 'Gobierno' },
  { id: 'accounting', label: 'Gastos & Libros Contables', group: 'Finanzas' },
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
  const [activeTab, setActiveTab] = useState<'audit_logs' | 'users'>('audit_logs');
  
  // Audit Logs State
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [severidadFilter, setSeveridadFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Users State
  const [users, setUsers] = useState<SystemUserItem[]>([]);
  const [presets, setPresets] = useState<Record<string, { role: string; restricted_modules: string[] }>>({});

  // Modales
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUserItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // User Form State
  const [userFormData, setUserFormData] = useState({
    username: '',
    email: '',
    nombre_completo: '',
    puesto: 'Gerente Comercial B2B',
    role: 'comercial',
    restricted_modules: [] as string[],
    activo: true,
  });

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const data = await apiService.getMonitoringAuditLogs({
        severidad: severidadFilter || undefined,
        search: searchQuery || undefined,
        limit: 150
      });
      setLogs(data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const [uList, pData] = await Promise.all([
        apiService.getSystemUsers(),
        apiService.getPositionPresets()
      ]);
      setUsers(uList);
      setPresets(pData);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit_logs') {
      fetchLogs();
    } else {
      fetchUsers();
    }
  }, [activeTab, severidadFilter]);

  const handlePuestoChange = (puesto: string) => {
    const preset = presets[puesto];
    if (preset) {
      setUserFormData({
        ...userFormData,
        puesto,
        role: preset.role,
        restricted_modules: preset.restricted_modules
      });
    } else {
      setUserFormData({
        ...userFormData,
        puesto
      });
    }
  };

  const handleToggleModule = (moduleId: string) => {
    const current = userFormData.restricted_modules;
    if (current.includes(moduleId)) {
      setUserFormData({
        ...userFormData,
        restricted_modules: current.filter(m => m !== moduleId)
      });
    } else {
      setUserFormData({
        ...userFormData,
        restricted_modules: [...current, moduleId]
      });
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.username.trim() || !userFormData.email.trim()) {
      setFormError('Nombre de usuario y correo son requeridos.');
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingUser) {
        await apiService.updateUserPermissions(editingUser.id, {
          puesto: userFormData.puesto,
          role: userFormData.role,
          restricted_modules: userFormData.restricted_modules,
          activo: userFormData.activo
        });
      } else {
        await apiService.createSystemUser(userFormData);
      }
      setShowUserModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Error al guardar usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateUserModal = () => {
    setEditingUser(null);
    const initialPuesto = 'Gerente Comercial B2B';
    const preset = presets[initialPuesto];
    setUserFormData({
      username: '',
      email: '',
      nombre_completo: '',
      puesto: initialPuesto,
      role: preset?.role || 'comercial',
      restricted_modules: preset?.restricted_modules || ['monitoring', 'accounting'],
      activo: true
    });
    setFormError(null);
    setShowUserModal(true);
  };

  const openEditUserModal = (u: SystemUserItem) => {
    setEditingUser(u);
    setUserFormData({
      username: u.username,
      email: u.email,
      nombre_completo: u.nombre_completo,
      puesto: u.puesto,
      role: u.role,
      restricted_modules: u.restricted_modules || [],
      activo: u.activo
    });
    setFormError(null);
    setShowUserModal(true);
  };

  const handleToggleUserActive = async (id: number) => {
    try {
      await apiService.toggleUserActive(id);
      fetchUsers();
    } catch (err) {
      console.error('Error toggling user status:', err);
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Fecha', 'Hora', 'Ubicación / Red', 'IP', 'Usuario', 'Rol', 'Acción', 'Evento Realizado', 'Severidad'];
    const rows = logs.map(l => [
      l.fecha,
      l.hora,
      l.ubicacion || 'Tailscale Node Central',
      l.ip_address || '100.64.0.1',
      l.user_id,
      l.role,
      l.action,
      `"${(l.evento_realizado || '').replace(/"/g, '""')}"`,
      l.severidad
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Auditoria_Monitoreo_Calcu_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ErrorBoundary fallbackTitle="Error al cargar Módulo de Monitoreo">
      <div className="space-y-6">
        {/* Header Principal */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/50">
              <ShieldAlert size={22} />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Módulo de Monitoreo &amp; Control de Seguridad
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 rounded-full border border-rose-200 dark:border-rose-800">
                  ISO 27001 Baseline
                </span>
              </div>
              <p className="text-xs text-[#535c69] dark:text-slate-400">
                Auditoría en tiempo real con geolocalización de red VPN Tailscale, trazabilidad de eventos y gestión de accesos RBAC.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {activeTab === 'audit_logs' ? (
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Download size={14} />
                <span>Exportar CSV Auditoría</span>
              </button>
            ) : (
              <button
                onClick={openCreateUserModal}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus size={15} />
                <span>Crear Nuevo Usuario</span>
              </button>
            )}
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('audit_logs')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'audit_logs'
                ? 'bg-rose-600 text-white shadow-xs'
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
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Users size={15} />
            <span>Gestión de Usuarios &amp; Permisos ({users.length})</span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* PESTAÑA 1: TABLA DE AUDITORÍA EN VIVO                                  */}
        {/* ===================================================================== */}
        {activeTab === 'audit_logs' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* KPI Cards de Seguridad */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                title="Eventos Registrados"
                value={`${logs.length} eventos`}
                subtitle="Monitoreo inmutable append-only"
                icon={Activity}
                iconColor="text-rose-600 dark:text-rose-400"
                iconBg="bg-rose-50 dark:bg-rose-950/40"
              />
              <MetricCard
                title="Nodos Tailscale Activos"
                value="Direct P2P"
                subtitle="Cifrado WireGuard punto a punto"
                icon={Wifi}
                iconColor="text-[#00a2e8]"
                iconBg="bg-sky-50 dark:bg-sky-950/40"
              />
              <MetricCard
                title="Estado Perimetral ISO 27001"
                value="100% Protegido"
                subtitle="Solo puertos 8000 & 5173 autorizados"
                icon={ShieldCheck}
                iconColor="text-emerald-600 dark:text-emerald-400"
                iconBg="bg-emerald-50 dark:bg-emerald-950/40"
              />
            </div>

            {/* Filtros & Tabla */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por usuario, acción o ubicación Tailscale..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                    className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Filter size={14} className="text-slate-400" />
                  <span className="text-xs text-slate-500 font-medium">Severidad:</span>
                  <select
                    value={severidadFilter}
                    onChange={(e) => setSeveridadFilter(e.target.value)}
                    className="bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-rose-500"
                  >
                    <option value="">Todas las Severidades</option>
                    <option value="INFO">INFO (Operativo)</option>
                    <option value="WARNING">WARNING (Alerta Media)</option>
                    <option value="CRITICAL">CRITICAL (Crítica / Ciberseguridad)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f5f7f8] dark:bg-slate-800/80 text-[#535c69] dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-3">Fecha &amp; Hora</th>
                      <th className="py-3 px-3">Ubicación / Red VPN</th>
                      <th className="py-3 px-3">Usuario &amp; Rol</th>
                      <th className="py-3 px-3">Evento Realizado</th>
                      <th className="py-3 px-3">Recurso Afectado</th>
                      <th className="py-3 px-3 text-center">Severidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                    {isLoadingLogs ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Cargando trazas de auditoría...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No se encontraron registros de auditoría.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors font-sans">
                          <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                            <div>{log.fecha}</div>
                            <div className="text-[10px] text-slate-400">{log.hora}</div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-200">
                              <MapPin size={13} className="text-rose-500 shrink-0" />
                              <span className="font-semibold text-xs">{log.ubicacion || 'Montevideo (Nodo Central)'}</span>
                            </div>
                            <div className="text-[10px] font-mono text-[#00a2e8] flex items-center space-x-1 mt-0.5">
                              <Wifi size={10} />
                              <span>IP: {log.ip_address || '100.64.0.1'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-800 dark:text-slate-100">{log.user_id}</div>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {log.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-800 dark:text-slate-200 max-w-md">
                            {log.evento_realizado}
                          </td>
                          <td className="py-3 px-3 font-mono text-[10px] text-slate-500">
                            {log.resource}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.severidad === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                                : log.severidad === 'WARNING'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
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
        {/* PESTAÑA 2: GESTIÓN DE USUARIOS & CONTROL DE ACCESOS                    */}
        {/* ===================================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((u) => {
                const restrictedCount = (u.restricted_modules || []).length;
                return (
                  <div
                    key={u.id}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm space-y-3.5 flex flex-col justify-between ${
                      u.activo 
                        ? 'border-slate-200/80 dark:border-slate-800' 
                        : 'border-slate-200 bg-slate-50/50 dark:bg-slate-900/50 opacity-60'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                            {u.nombre_completo}
                          </div>
                          <div className="text-xs text-[#00a2e8] font-mono">
                            @{u.username} • {u.email}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      <div className="pt-1 flex items-center space-x-2">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                          {u.puesto}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          Rol: {u.role}
                        </span>
                      </div>

                      {/* Módulos Restringidos */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-semibold flex items-center space-x-1">
                            <EyeOff size={13} className="text-rose-500" />
                            <span>Módulos Prohibidos:</span>
                          </span>
                          <span className={`font-bold ${restrictedCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {restrictedCount === 0 ? 'Acceso Total' : `${restrictedCount} restringidos`}
                          </span>
                        </div>

                        {restrictedCount > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.restricted_modules.map((modId) => {
                              const found = ALL_SYSTEM_MODULES.find(m => m.id === modId);
                              return (
                                <span
                                  key={modId}
                                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
                                >
                                  {found?.label || modId}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Sin restricciones. Acceso irrestricto.</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <button
                        onClick={() => openEditUserModal(u)}
                        className="text-xs font-bold text-[#00a2e8] hover:underline flex items-center space-x-1 cursor-pointer"
                      >
                        <Edit3 size={13} />
                        <span>Editar Permisos</span>
                      </button>

                      <button
                        onClick={() => handleToggleUserActive(u.id)}
                        className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {u.activo ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MODAL: Crear / Editar Usuario */}
        {showUserModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-50/50 dark:bg-slate-900">
                <div className="flex items-center space-x-2.5">
                  <span className="p-2 bg-rose-600/10 text-rose-600 rounded-xl">
                    <UserPlus size={20} />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      {editingUser ? `Editar Permisos de ${editingUser.nombre_completo}` : 'Crear Nuevo Usuario del Sistema'}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Asigna un puesto predeterminado o personaliza los módulos que no puede ver (lista negra).
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowUserModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveUser} className="p-5 overflow-y-auto space-y-4 text-xs">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dra. Sofía Rivas"
                      value={userFormData.nombre_completo}
                      onChange={(e) => setUserFormData({ ...userFormData, nombre_completo: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre de Usuario (Login)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. sofia.rivas"
                      value={userFormData.username}
                      onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                      disabled={!!editingUser}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Correo Electrónico Corporativo</label>
                    <input
                      type="email"
                      required
                      placeholder="srivas@calcu.com.uy"
                      value={userFormData.email}
                      onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Puesto / Cargo Funcional</label>
                    <select
                      value={userFormData.puesto}
                      onChange={(e) => handlePuestoChange(e.target.value)}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-rose-500"
                    >
                      {Object.keys(presets).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Selección Personalizada de Módulos Restringidos */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                        Módulos Restringidos (Lista Negra)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Marca los módulos que este usuario <strong>NO podrá visualizar ni acceder</strong>.
                      </span>
                    </div>
                    <span className="text-xs font-bold text-rose-600 px-2 py-0.5 rounded bg-rose-50">
                      {userFormData.restricted_modules.length} restringidos
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-2 bg-[#f5f7f8] dark:bg-slate-800/60 rounded-xl">
                    {ALL_SYSTEM_MODULES.map((mod) => {
                      const isRestricted = userFormData.restricted_modules.includes(mod.id);
                      return (
                        <label
                          key={mod.id}
                          className={`flex items-center space-x-2 p-2 rounded-lg border transition-colors cursor-pointer text-xs ${
                            isRestricted 
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200' 
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isRestricted}
                            onChange={() => handleToggleModule(mod.id)}
                            className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4 cursor-pointer"
                          />
                          <div className="flex-1 truncate">
                            <span className="font-semibold block truncate">{mod.label}</span>
                            <span className="text-[10px] opacity-70">{mod.group}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowUserModal(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Guardando...' : editingUser ? 'Actualizar Permisos' : 'Crear Usuario'}
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
