import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Save,
  Users,
} from 'lucide-react';
import type {
  CostCenterBudgetReportResponse,
  CostCenterItem,
  CostCenterSummaryItem,
  CostCenterBatchItem,
  UserRole,
  AreaItem,
  ResponsibleUserItem,
} from '../../types';
import { MetricCard } from '../common/MetricCard';
import { apiService } from '../../services/api';
import { safeNumber, safeToFixed, formatCurrency } from '../../utils/formatters';

interface CostCentersBudgetGridProps {
  selectedPeriod: string;
  currentRole?: UserRole;
}

export const CostCentersBudgetGrid: React.FC<CostCentersBudgetGridProps> = ({
  selectedPeriod,
  currentRole = 'controller_admin',
}) => {
  const [report, setReport] = useState<CostCenterBudgetReportResponse | null>(null);
  const [costCenters, setCostCenters] = useState<CostCenterItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [expandedCC, setExpandedCC] = useState<Record<number, boolean>>({});
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal para agregar partida
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [selectedCCId, setSelectedCCId] = useState<number>(0);
  const [newConcepto, setNewConcepto] = useState<string>('');
  const [newMontoPresupuestado, setNewMontoPresupuestado] = useState<number>(0);
  const [newMontoReal, setNewMontoReal] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Áreas y Responsables para vinculación BCNF
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [users, setUsers] = useState<ResponsibleUserItem[]>([]);

  // Modal para crear centro de costo
  const [showCreateCCModal, setShowCreateCCModal] = useState<boolean>(false);
  const [newCCCodigo, setNewCCCodigo] = useState<string>('');
  const [newCCNombre, setNewCCNombre] = useState<string>('');
  const [newCCResponsable, setNewCCResponsable] = useState<string>('');
  const [newCCAreaId, setNewCCAreaId] = useState<number | ''>('');
  const [newCCResponsableId, setNewCCResponsableId] = useState<number | ''>('');

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setNotification(null);
    try {
      const [repData, ccList, areasList, usersList] = await Promise.all([
        apiService.getCostCenterBudgetReport(selectedPeriod),
        apiService.getCostCenters(),
        apiService.getAreas(),
        apiService.getUsers(),
      ]);
      setReport(repData);
      setCostCenters(ccList);
      setAreas(areasList);
      setUsers(usersList);

      // Expandir todos por defecto
      const initialExpanded: Record<number, boolean> = {};
      repData.centros_costo.forEach((c) => {
        initialExpanded[c.centro_costo_id] = true;
      });
      setExpandedCC(initialExpanded);
    } catch (err: unknown) {
      console.error('Error fetching cost centers budget report:', err);
      setNotification({
        type: 'error',
        message: 'No se pudo cargar el reporte de centros de costo.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const toggleExpand = (id: number) => {
    setExpandedCC((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddBudgetLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCCId || !newConcepto.trim()) {
      setNotification({ type: 'error', message: 'Centro de costo y concepto son requeridos.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const newItem: CostCenterBatchItem = {
        centro_costo_id: selectedCCId,
        concepto_opex: newConcepto.trim(),
        monto_presupuestado: Number(newMontoPresupuestado),
        monto_real: Number(newMontoReal),
      };

      await apiService.saveCostCenterBudgetBatch({
        periodo: selectedPeriod,
        items: [newItem],
      });

      setNotification({ type: 'success', message: 'Partida OPEX guardada con éxito.' });
      setShowAddModal(false);
      setNewConcepto('');
      setNewMontoPresupuestado(0);
      setNewMontoReal(0);
      await fetchReport();
    } catch (err: unknown) {
      console.error('Error saving budget line:', err);
      setNotification({ type: 'error', message: 'Error al registrar la partida.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCostCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCCCodigo.trim() || !newCCNombre.trim()) {
      setNotification({ type: 'error', message: 'Código y nombre de centro de costo son obligatorios.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedUser = users.find((u) => u.id === Number(newCCResponsableId));
      const responsableName = selectedUser?.nombre || newCCResponsable.trim() || 'No asignado';

      await apiService.createCostCenter({
        codigo: newCCCodigo.trim(),
        nombre: newCCNombre.trim(),
        responsable: responsableName,
        area_id: newCCAreaId !== '' ? Number(newCCAreaId) : undefined,
        responsable_id: newCCResponsableId !== '' ? Number(newCCResponsableId) : undefined,
      });

      setNotification({ type: 'success', message: 'Centro de costo creado con éxito.' });
      setShowCreateCCModal(false);
      setNewCCCodigo('');
      setNewCCNombre('');
      setNewCCResponsable('');
      setNewCCAreaId('');
      setNewCCResponsableId('');
      await fetchReport();
    } catch (err: unknown) {
      console.error('Error creating cost center:', err);
      setNotification({ type: 'error', message: 'Error al crear el centro de costo.' });
    } finally {
      setIsSubmitting(false);
    }
  };


  const getStatusBadge = (estado: string) => {
    if (estado === 'AHORRO') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-[#2ecc71] border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 size={12} />
          <span>Ahorro</span>
        </span>
      );
    }
    if (estado === 'EXCESO_GASTO') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-[#e74c3c] border border-rose-200 dark:border-rose-800">
          <AlertTriangle size={12} />
          <span>Exceso</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] border border-sky-200 dark:border-sky-800">
        <span>En Presupuesto</span>
      </span>
    );
  };

  const totalPresupuestado = report?.total_opex_presupuestado ?? 0;
  const totalReal = report?.total_opex_real ?? 0;
  const variacionTotal = report?.variacion_total ?? 0;
  const variacionPct = report?.variacion_total_pct ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Botones de Acción */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] rounded-xl border border-sky-100 dark:border-sky-900/50">
            <Building2 size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Presupuestos & OPEX por Centros de Costo (BCNF)
            </h3>
            <p className="text-xs text-[#535c69] dark:text-slate-400">
              Control granular de partidas operativas para el período <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedPeriod}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchReport}
            disabled={isLoading}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Actualizar</span>
          </button>

          {currentRole === 'controller_admin' && (
            <>
              <button
                onClick={() => {
                  if (costCenters.length > 0) setSelectedCCId(costCenters[0].id);
                  setShowAddModal(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-[#00a2e8] hover:bg-[#0092d0] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Nueva Partida OPEX</span>
              </button>

              <button
                onClick={() => setShowCreateCCModal(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <Building2 size={14} />
                <span>Nuevo Centro Costo</span>
              </button>
            </>
          )}
        </div>
      </div>

      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold hover:underline ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="OPEX Total Presupuestado"
          value={formatCurrency(totalPresupuestado)}
          icon={DollarSign}
          subtitle={`Meta OPEX para ${selectedPeriod}`}
        />
        <MetricCard
          title="OPEX Real Ejecutado"
          value={formatCurrency(totalReal)}
          icon={Building2}
          subtitle="Gastos incurridos a la fecha"
        />
        <MetricCard
          title="Desvío Neto OPEX"
          value={formatCurrency(variacionTotal)}
          icon={safeNumber(variacionTotal) < 0 ? TrendingDown : TrendingUp}
          badge={{
            text: safeNumber(variacionTotal) < 0 ? 'Exceso' : 'Ahorro',
            variant: safeNumber(variacionTotal) < 0 ? 'danger' : 'success',
          }}
          subtitle="Presupuesto - Real ($)"
        />
        <MetricCard
          title="Desvío Porcentual"
          value={`${safeNumber(variacionPct) >= 0 ? '+' : ''}${safeToFixed(variacionPct, 1)}%`}
          icon={safeNumber(variacionPct) < 0 ? AlertTriangle : CheckCircle2}
          badge={{
            text: Math.abs(safeNumber(variacionPct)) < 5 ? 'Alineado' : safeNumber(variacionPct) < 0 ? 'Desviado' : 'Favorable',
            variant: safeNumber(variacionPct) < 0 ? 'warning' : 'success',
          }}
          subtitle="Tolerancia estándar +/- 5%"
        />
      </div>

      {/* Tabla Matricial Acordeón por Centro de Costo */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users size={16} className="text-[#00a2e8]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Desglose Matricial por Centros de Costo y Partidas Operativas
            </h4>
          </div>
          <span className="text-xs text-slate-500">
            {report?.centros_costo?.length ?? 0} centros configurados
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {(report?.centros_costo || []).map((cc: CostCenterSummaryItem) => {
            const isExpanded = !!expandedCC[cc.centro_costo_id];
            return (
              <div key={cc.centro_costo_id} className="transition-colors">
                {/* Cabecera del Centro de Costo */}
                <div
                  onClick={() => toggleExpand(cc.centro_costo_id)}
                  className="px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 cursor-pointer select-none"
                >
                  <div className="flex items-center space-x-3">
                    <button className="text-slate-400 hover:text-slate-600 transition-colors">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-[#00a2e8]">
                          {cc.codigo}
                        </span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {cc.nombre}
                        </span>
                        {cc.area_nombre && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[10px]">
                            🏢 {cc.area_nombre}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>Responsable:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {cc.responsable_nombre || cc.responsable || 'No asignado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Presupuesto</span>
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
                        {formatCurrency(cc?.total_presupuestado)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Real</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                        {formatCurrency(cc?.total_real)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Desvío $</span>
                      <span
                        className={`font-mono font-semibold ${
                          safeNumber(cc?.variacion_neta) < 0 ? 'text-[#e74c3c]' : 'text-[#2ecc71]'
                        }`}
                      >
                        {formatCurrency(cc?.variacion_neta)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Desvío %</span>
                      <span
                        className={`font-mono font-semibold ${
                          safeNumber(cc?.variacion_pct) < 0 ? 'text-[#e74c3c]' : 'text-[#2ecc71]'
                        }`}
                      >
                        {safeNumber(cc?.variacion_pct) >= 0 ? `+${safeToFixed(cc?.variacion_pct, 1)}%` : `${safeToFixed(cc?.variacion_pct, 1)}%`}
                      </span>
                    </div>
                    <div>
                      {getStatusBadge(cc?.estado)}
                    </div>
                  </div>
                </div>

                {/* Sub-tabla de partidas */}
                {isExpanded && (
                  <div className="bg-white dark:bg-slate-900 px-8 py-3 overflow-x-auto">
                    {(!cc.partidas || cc.partidas.length === 0) ? (
                      <div className="text-xs text-slate-400 py-3 italic">
                        No hay partidas OPEX registradas para este centro de costo en el período actual.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="py-2">Concepto OPEX</th>
                            <th className="py-2 text-right">Presupuestado</th>
                            <th className="py-2 text-right">Real Ejecutado</th>
                            <th className="py-2 text-right">Desvío $</th>
                            <th className="py-2 text-right">Desvío %</th>
                            <th className="py-2 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                          {cc.partidas.map((p, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="py-2 font-sans font-medium text-slate-800 dark:text-slate-200">
                                {p?.concepto_opex || 'Partida general'}
                              </td>
                              <td className="py-2 text-right text-slate-600 dark:text-slate-300">
                                {formatCurrency(p?.monto_presupuestado)}
                              </td>
                              <td className="py-2 text-right text-slate-800 dark:text-slate-100 font-semibold">
                                {formatCurrency(p?.monto_real)}
                              </td>
                              <td
                                className={`py-2 text-right font-semibold ${
                                  safeNumber(p?.variacion_monto) < 0 ? 'text-[#e74c3c]' : 'text-[#2ecc71]'
                                }`}
                              >
                                {formatCurrency(p?.variacion_monto)}
                              </td>
                              <td
                                className={`py-2 text-right font-semibold ${
                                  safeNumber(p?.variacion_pct) < 0 ? 'text-[#e74c3c]' : 'text-[#2ecc71]'
                                }`}
                              >
                                {safeNumber(p?.variacion_pct) >= 0 ? `+${safeToFixed(p?.variacion_pct, 1)}%` : `${safeToFixed(p?.variacion_pct, 1)}%`}
                              </td>
                              <td className="py-2 text-center">
                                {getStatusBadge(p?.estado)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {(!report?.centros_costo || report.centros_costo.length === 0) && (
            <div className="p-8 text-center text-xs text-slate-400">
              No hay datos disponibles para el período {selectedPeriod}.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Agregar Partida OPEX */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <Plus size={16} className="text-[#00a2e8]" />
                <span>Registrar Partida de OPEX</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddBudgetLine} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Centro de Costo
                </label>
                <select
                  value={selectedCCId}
                  onChange={(e) => setSelectedCCId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                >
                  {costCenters.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.codigo} - {cc.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Concepto OPEX (ej. Fletes de última milla, SaaS ERP)
                </label>
                <input
                  type="text"
                  required
                  value={newConcepto}
                  onChange={(e) => setNewConcepto(e.target.value)}
                  placeholder="Descripción de la partida..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monto Presupuestado ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newMontoPresupuestado}
                    onChange={(e) => setNewMontoPresupuestado(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monto Real ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newMontoReal}
                    onChange={(e) => setNewMontoReal(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
                  <span>{isSubmitting ? 'Guardando...' : 'Guardar Partida'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear Centro de Costo */}
      {showCreateCCModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <Building2 size={16} className="text-[#00a2e8]" />
                <span>Nuevo Centro de Costo (BCNF)</span>
              </h3>
              <button
                onClick={() => setShowCreateCCModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCostCenter} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Código (ej. CC-RRHH, CC-IT)
                </label>
                <input
                  type="text"
                  required
                  value={newCCCodigo}
                  onChange={(e) => setNewCCCodigo(e.target.value.toUpperCase())}
                  placeholder="CC-..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Centro
                </label>
                <input
                  type="text"
                  required
                  value={newCCNombre}
                  onChange={(e) => setNewCCNombre(e.target.value)}
                  placeholder="ej. Recursos Humanos, Tecnología..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Área / Sector Funcional (BCNF)
                </label>
                <select
                  value={newCCAreaId}
                  onChange={(e) => setNewCCAreaId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                >
                  <option value="">-- Sin área asignada --</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.codigo} - {a.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Responsable Asignado
                </label>
                <select
                  value={newCCResponsableId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewCCResponsableId(val ? Number(val) : '');
                    if (val) {
                      const u = users.find((usr) => usr.id === Number(val));
                      if (u) setNewCCResponsable(u.nombre);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                >
                  <option value="">-- Seleccionar usuario gestor o escribir manual abajo --</option>
                  {users
                    .filter((u) => !newCCAreaId || u.area_id === Number(newCCAreaId))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} ({u.cargo || 'Responsable'})
                      </option>
                    ))}
                </select>
              </div>

              {newCCResponsableId === '' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Responsable Manual (Opcional)
                  </label>
                  <input
                    type="text"
                    value={newCCResponsable}
                    onChange={(e) => setNewCCResponsable(e.target.value)}
                    placeholder="Nombre del director / gerente de área"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#00a2e8]"
                  />
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateCCModal(false)}
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
                  <span>{isSubmitting ? 'Creando...' : 'Crear Centro'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
