import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Users,
  Plus,
  Mail,
  Briefcase,
  Layers,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Edit2,
} from 'lucide-react';
import { apiService } from '../../services/api';
import type {
  AreaItem,
  AreaCreateRequest,
  AreaUpdatePayload,
  ResponsibleUserItem,
  ResponsibleUserCreateRequest,
  ResponsibleUserUpdatePayload,
} from '../../types';
import { MetricCard } from '../common/MetricCard';

export const OrganizationStructureView: React.FC = () => {
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [users, setUsers] = useState<ResponsibleUserItem[]>([]);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<number | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal Nueva Área
  const [showAreaModal, setShowAreaModal] = useState<boolean>(false);
  const [newAreaCodigo, setNewAreaCodigo] = useState<string>('');
  const [newAreaNombre, setNewAreaNombre] = useState<string>('');
  const [newAreaDesc, setNewAreaDesc] = useState<string>('');

  // Modal Nuevo Responsable
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserCargo, setNewUserCargo] = useState<string>('');
  const [newUserAreaId, setNewUserAreaId] = useState<number | ''>('');

  // Modal Edición de Área
  const [editingArea, setEditingArea] = useState<AreaItem | null>(null);
  const [editAreaCodigo, setEditAreaCodigo] = useState<string>('');
  const [editAreaNombre, setEditAreaNombre] = useState<string>('');
  const [editAreaDesc, setEditAreaDesc] = useState<string>('');

  // Modal Edición de Responsable
  const [editingUser, setEditingUser] = useState<ResponsibleUserItem | null>(null);
  const [editUserName, setEditUserName] = useState<string>('');
  const [editUserEmail, setEditUserEmail] = useState<string>('');
  const [editUserCargo, setEditUserCargo] = useState<string>('');
  const [editUserAreaId, setEditUserAreaId] = useState<number | ''>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setNotification(null);
    try {
      const [areasData, usersData] = await Promise.all([
        apiService.getAreas(),
        apiService.getUsers(),
      ]);
      setAreas(areasData);
      setUsers(usersData);
    } catch (err: unknown) {
      console.error('Error fetching organization structure:', err);
      setNotification({
        type: 'error',
        message: 'Error al cargar la estructura organizacional de Áreas y Responsables.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaCodigo.trim() || !newAreaNombre.trim()) {
      setNotification({ type: 'error', message: 'Código y nombre del área son requeridos.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: AreaCreateRequest = {
        codigo: newAreaCodigo.trim().toUpperCase(),
        nombre: newAreaNombre.trim(),
        descripcion: newAreaDesc.trim() || undefined,
      };
      await apiService.createArea(payload);
      setNotification({ type: 'success', message: `Área ${payload.codigo} creada correctamente.` });
      setShowAreaModal(false);
      setNewAreaCodigo('');
      setNewAreaNombre('');
      setNewAreaDesc('');
      await fetchData();
    } catch (err: unknown) {
      console.error('Error creating area:', err);
      setNotification({ type: 'error', message: 'No se pudo crear el área. Verifique que el código no esté duplicado.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      setNotification({ type: 'error', message: 'Nombre y correo electrónico son requeridos.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ResponsibleUserCreateRequest = {
        nombre: newUserName.trim(),
        email: newUserEmail.trim().toLowerCase(),
        cargo: newUserCargo.trim() || undefined,
        area_id: newUserAreaId !== '' ? Number(newUserAreaId) : undefined,
      };
      await apiService.createUser(payload);
      setNotification({ type: 'success', message: `Responsable ${payload.nombre} registrado correctamente.` });
      setShowUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserCargo('');
      setNewUserAreaId('');
      await fetchData();
    } catch (err: unknown) {
      console.error('Error creating responsible user:', err);
      setNotification({ type: 'error', message: 'No se pudo registrar el usuario. Verifique que el email no esté repetido.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditArea = (area: AreaItem) => {
    setEditingArea(area);
    setEditAreaCodigo(area.codigo);
    setEditAreaNombre(area.nombre);
    setEditAreaDesc(area.descripcion || '');
  };

  const handleUpdateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArea) return;
    if (!editAreaCodigo.trim() || !editAreaNombre.trim()) {
      setNotification({ type: 'error', message: 'Código y nombre son requeridos.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: AreaUpdatePayload = {
        codigo: editAreaCodigo.trim().toUpperCase(),
        nombre: editAreaNombre.trim(),
        descripcion: editAreaDesc.trim() || undefined,
      };
      await apiService.updateArea(editingArea.id, payload);
      setNotification({ type: 'success', message: `Área ${payload.codigo} actualizada correctamente.` });
      setEditingArea(null);
      await fetchData();
    } catch (err: unknown) {
      console.error('Error updating area:', err);
      setNotification({ type: 'error', message: 'No se pudo actualizar el área.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditUser = (user: ResponsibleUserItem) => {
    setEditingUser(user);
    setEditUserName(user.nombre);
    setEditUserEmail(user.email);
    setEditUserCargo(user.cargo || '');
    setEditUserAreaId(user.area_id ?? '');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editUserName.trim() || !editUserEmail.trim()) {
      setNotification({ type: 'error', message: 'Nombre y correo electrónico son requeridos.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ResponsibleUserUpdatePayload = {
        nombre: editUserName.trim(),
        email: editUserEmail.trim().toLowerCase(),
        cargo: editUserCargo.trim() || undefined,
        area_id: editUserAreaId !== '' ? Number(editUserAreaId) : null,
      };
      await apiService.updateUser(editingUser.id, payload);
      setNotification({ type: 'success', message: `Responsable ${payload.nombre} actualizado correctamente.` });
      setEditingUser(null);
      await fetchData();
    } catch (err: unknown) {
      console.error('Error updating responsible user:', err);
      setNotification({ type: 'error', message: 'No se pudo actualizar el responsable.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = selectedAreaFilter === 'ALL'
    ? users
    : users.filter((u) => u.area_id === selectedAreaFilter);

  const totalCentrosVinculados = areas.reduce((acc, a) => acc + (a.centros_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Notificación Toast */}
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center space-x-3 text-xs font-semibold ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#2ecc71] border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-[#e74c3c] border border-rose-200 dark:border-rose-800'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Tarjetas de Métricas de Gobernanza */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Áreas / Departamentos"
          value={areas.length.toString()}
          icon={Building2}
          badge={{ text: 'Gobernanza', variant: 'info' }}
          subtitle="Sectores organizacionales"
        />
        <MetricCard
          title="Responsables Asignados"
          value={users.length.toString()}
          icon={Users}
          badge={{ text: 'Activos', variant: 'success' }}
          subtitle="Gestores de gasto y OPEX"
        />
        <MetricCard
          title="Centros de Costo Vinculados"
          value={totalCentrosVinculados.toString()}
          icon={Layers}
          badge={{ text: 'BCNF Normalizado', variant: 'info' }}
          subtitle="Total centros articulados"
        />
        <MetricCard
          title="Cobertura Responsable"
          value={`${users.length > 0 ? Math.min(100, Math.round((totalCentrosVinculados / Math.max(1, areas.length)) * 20)) : 0}%`}
          icon={Briefcase}
          badge={{ text: 'Control', variant: 'success' }}
          subtitle="Imputación contable 1:N"
        />
      </div>

      {/* Barra de Acciones y Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Building2 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Estructura Organizacional & Responsabilidad Contable
            </h3>
            <p className="text-xs text-slate-500">
              Gestión centralizada de Áreas funcionales y asignación de Responsables de Presupuesto
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Recargar datos"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowAreaModal(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
          >
            <Plus size={14} />
            <span>Nueva Área</span>
          </button>
          <button
            onClick={() => setShowUserModal(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-[#00a2e8] hover:bg-[#0092d0] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
          >
            <Plus size={14} />
            <span>Nuevo Responsable</span>
          </button>
        </div>
      </div>

      {/* Tablas Coordinadas en Dos Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Áreas (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 size={16} className="text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Áreas / Sectores ({areas.length})
              </h4>
            </div>
            {selectedAreaFilter !== 'ALL' && (
              <button
                onClick={() => setSelectedAreaFilter('ALL')}
                className="text-[11px] text-indigo-600 hover:underline font-semibold"
              >
                Ver todos
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto max-h-[520px]">
            {areas.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No hay áreas registradas.
              </div>
            ) : (
              areas.map((area, aIdx) => {
                const isSelected = selectedAreaFilter === area.id;
                return (
                  <div
                    key={area.id ?? `area-${aIdx}`}
                    onClick={() => setSelectedAreaFilter(isSelected ? 'ALL' : area.id)}
                    className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                          {area.codigo}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {area.nombre}
                        </span>
                      </div>
                      {area.descripcion && (
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {area.descripcion}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex flex-col items-end space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {area.centros_count || 0} CCs
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditArea(area);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                          title="Editar Área"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {users.filter((u) => u.area_id === area.id).length} gestores
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Columna Derecha: Responsables / Usuarios (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users size={16} className="text-[#00a2e8]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Usuarios &amp; Responsables Asignados ({filteredUsers.length})
              </h4>
            </div>
            {selectedAreaFilter !== 'ALL' && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold">
                Filtrado por: {areas.find((a) => a.id === selectedAreaFilter)?.nombre}
              </span>
            )}
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Nombre &amp; Cargo</th>
                  <th className="px-4 py-3">Área de Pertenencia</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      No se encontraron responsables para el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, uIdx) => (
                    <tr
                      key={user.id ?? `user-${uIdx}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {user.nombre}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                          <Briefcase size={11} className="text-slate-400" />
                          <span>{user.cargo || 'Responsable de Presupuesto'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.area_nombre ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-medium text-[11px]">
                            {user.area_nombre}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">General / Sin área</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                          <Mail size={12} className="text-slate-400" />
                          <span>{user.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEditUser(user)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-[#00a2e8] rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-1 text-[11px] font-semibold"
                          title="Editar Responsable"
                        >
                          <Edit2 size={12} />
                          <span className="hidden sm:inline">Editar</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Crear Área */}
      {showAreaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <Building2 size={16} className="text-indigo-600" />
                <span>Nueva Área / Sector Funcional</span>
              </h3>
              <button
                onClick={() => setShowAreaModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateArea} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Código del Área (ej. SEC-LOG, SEC-MKT, SEC-IT)
                </label>
                <input
                  type="text"
                  required
                  value={newAreaCodigo}
                  onChange={(e) => setNewAreaCodigo(e.target.value.toUpperCase())}
                  placeholder="SEC-..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Área
                </label>
                <input
                  type="text"
                  required
                  value={newAreaNombre}
                  onChange={(e) => setNewAreaNombre(e.target.value)}
                  placeholder="ej. Logística & Distribución"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={newAreaDesc}
                  onChange={(e) => setNewAreaDesc(e.target.value)}
                  placeholder="Objetivos operativos o alcance del sector..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAreaModal(false)}
                  className="px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold cursor-pointer shadow-xs"
                >
                  <Save size={14} />
                  <span>{isSubmitting ? 'Guardando...' : 'Crear Área'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear Responsable */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <Users size={16} className="text-[#00a2e8]" />
                <span>Nuevo Responsable de Presupuesto</span>
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="ej. Lic. Sofía Rivas"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Corporativo
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="ej. srivas@calcu.com"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cargo / Rol Operativo
                </label>
                <input
                  type="text"
                  value={newUserCargo}
                  onChange={(e) => setNewUserCargo(e.target.value)}
                  placeholder="ej. Directora de Operaciones"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Área Vinculada (BCNF)
                </label>
                <select
                  value={newUserAreaId}
                  onChange={(e) => setNewUserAreaId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                >
                  <option value="">-- Sin área específica / Corporativo --</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.codigo} - {a.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#00a2e8] hover:bg-[#0092d0] text-white rounded-xl font-semibold cursor-pointer shadow-xs"
                >
                  <Save size={14} />
                  <span>{isSubmitting ? 'Registrando...' : 'Registrar Responsable'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Área */}
      {editingArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <Building2 size={16} className="text-indigo-600" />
                <span>Editar Área / Sector: {editingArea.codigo}</span>
              </h3>
              <button
                onClick={() => setEditingArea(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateArea} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Código del Área
                </label>
                <input
                  type="text"
                  required
                  value={editAreaCodigo}
                  onChange={(e) => setEditAreaCodigo(e.target.value.toUpperCase())}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Área
                </label>
                <input
                  type="text"
                  required
                  value={editAreaNombre}
                  onChange={(e) => setEditAreaNombre(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={editAreaDesc}
                  onChange={(e) => setEditAreaDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingArea(null)}
                  className="px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold cursor-pointer shadow-xs"
                >
                  <Save size={14} />
                  <span>{isSubmitting ? 'Guardando...' : 'Actualizar Área'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Responsable */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <Users size={16} className="text-[#00a2e8]" />
                <span>Editar Responsable: {editingUser.nombre}</span>
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Corporativo
                </label>
                <input
                  type="email"
                  required
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cargo / Rol Operativo
                </label>
                <input
                  type="text"
                  value={editUserCargo}
                  onChange={(e) => setEditUserCargo(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Área Vinculada
                </label>
                <select
                  value={editUserAreaId}
                  onChange={(e) => setEditUserAreaId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                >
                  <option value="">-- Sin área específica / Corporativo --</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.codigo} - {a.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#00a2e8] hover:bg-[#0092d0] text-white rounded-xl font-semibold cursor-pointer shadow-xs"
                >
                  <Save size={14} />
                  <span>{isSubmitting ? 'Guardando...' : 'Actualizar Responsable'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
