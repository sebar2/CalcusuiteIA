import React, { useState, useEffect } from 'react';
import {
  CircleDollarSign,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Plus,
  Edit2,
  Trash2,
  X,
  Lock,
} from 'lucide-react';
import { logisticsApi } from '../../services/logisticsApi';
import { getStoredUser } from '../../services/api';
import type {
  FinanceSummaryResponse,
  LogisticsCostItem,
  EbitdaAnalysisResponse,
} from '../../services/logisticsApi';

export const LogisticsFinanceView: React.FC = () => {
  const currentUser = getStoredUser();
  const isOperario = currentUser?.role === 'operario_3pl';
  const [activeTab, setActiveTab] = useState<'ebitda' | 'costs'>('ebitda');
  const [finance, setFinance] = useState<FinanceSummaryResponse | null>(null);
  const [ebitda, setEbitda] = useState<EbitdaAnalysisResponse | null>(null);
  const [costItems, setCostItems] = useState<LogisticsCostItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Cost Filter & Modal State
  const [costTypeFilter, setCostTypeFilter] = useState<'ALL' | 'FIJO' | 'VARIABLE'>('ALL');
  const [isCostModalOpen, setIsCostModalOpen] = useState<boolean>(false);
  const [editingCostId, setEditingCostId] = useState<number | null>(null);
  const [costForm, setCostForm] = useState({
    tipo: 'FIJO' as 'FIJO' | 'VARIABLE',
    categoria: 'ALQUILER',
    nombre: '',
    monto_mensual: 1000.0,
    moneda: 'UYU',
    descripcion: '',
    activo: true,
  });

  const loadAll = async () => {
    try {
      setLoading(true);
      const [finData, ebitdaData, costsData] = await Promise.all([
        logisticsApi.getFinanceSummary(),
        logisticsApi.getEbitdaAnalysis(),
        logisticsApi.getCostItems(),
      ]);
      setFinance(finData);
      setEbitda(ebitdaData);
      setCostItems(costsData);
    } catch (err) {
      console.error('Error al cargar balances y costos 3PL:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Cost Handlers
  const handleOpenCreateCost = () => {
    setEditingCostId(null);
    setCostForm({
      tipo: 'FIJO',
      categoria: 'ALQUILER',
      nombre: '',
      monto_mensual: 1500.0,
      moneda: 'UYU',
      descripcion: '',
      activo: true,
    });
    setIsCostModalOpen(true);
  };

  const handleOpenEditCost = (item: LogisticsCostItem) => {
    setEditingCostId(item.id);
    setCostForm({
      tipo: item.tipo,
      categoria: item.categoria,
      nombre: item.nombre,
      monto_mensual: item.monto_mensual,
      moneda: item.moneda,
      descripcion: item.descripcion || '',
      activo: item.activo,
    });
    setIsCostModalOpen(true);
  };

  const handleSaveCost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCostId) {
        await logisticsApi.updateCostItem(editingCostId, {
          tipo: costForm.tipo,
          categoria: costForm.categoria,
          nombre: costForm.nombre,
          monto_mensual: Number(costForm.monto_mensual),
          moneda: costForm.moneda,
          descripcion: costForm.descripcion,
          activo: costForm.activo,
        });
      } else {
        await logisticsApi.createCostItem({
          tipo: costForm.tipo,
          categoria: costForm.categoria,
          nombre: costForm.nombre,
          monto_mensual: Number(costForm.monto_mensual),
          moneda: costForm.moneda,
          descripcion: costForm.descripcion,
        });
      }
      setIsCostModalOpen(false);
      loadAll();
    } catch (err: any) {
      alert(`Error al guardar costo: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleDeleteCost = async (costId: number) => {
    if (!confirm('¿Desea dar de baja este concepto de costo?')) return;
    try {
      await logisticsApi.deleteCostItem(costId);
      loadAll();
    } catch (err: any) {
      alert(`Error al eliminar costo: ${err.response?.data?.detail || err.message}`);
    }
  };

  const filteredCosts = costItems.filter((c) => {
    if (costTypeFilter === 'ALL') return true;
    return c.tipo === costTypeFilter;
  });

  if (isOperario) {
    return (
      <div className="p-6 max-w-2xl mx-auto my-12 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
          <Lock size={32} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Acceso Financiero Restringido
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
            El perfil <b>Operario de Logística y Depósito</b> cuenta con permisos para gestión de stock, picking y kanban operativo. El balance financiero de rentabilidad, tarifas y costos fijos de alquiler está reservado exclusivamente para el <b>Administrador 3PL</b>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <CircleDollarSign size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Costos, Liquidación a Fleteros & Rentabilidad 3PL
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Punto de Equilibrio, EBITDA neto, acumulación de viajes/km y gestión de costos fijos y variables
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Tab Switcher */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('ebitda')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ebitda'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              📊 EBITDA & Rentabilidad
            </button>
            <button
              onClick={() => setActiveTab('costs')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'costs'
                  ? 'bg-white dark:bg-slate-900 text-[#00a2e8] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              ⚙️ Costos Fijos & Variables ({costItems.length})
            </button>
          </div>

          <button
            onClick={loadAll}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
            title="Recargar Métricas"
          >
            <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {activeTab === 'ebitda' ? (
        /* ========================================================================= */
        /*                          TAB: EBITDA & RENTABILIDAD                       */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Main KPI Cards */}
          {ebitda && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Despachos & Kilometraje
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {ebitda.total_viajes} viajes
                  </span>
                  <span className="text-xs text-sky-600 font-bold">
                    {ebitda.total_km_recorridos.toFixed(1)} km
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Acumulador total de rutas 3PL</p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Facturación Total Servicios
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    ${ebitda.ingresos_servicios_totales.toLocaleString()}
                  </span>
                  <span className="text-xs text-emerald-700 font-medium">Ingresos Brutos</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Almacenaje, VAS y Fletes</p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Costos Operativos Totales
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
                    ${(ebitda.costos_fijos_totales + ebitda.costos_variables_operativos + ebitda.costos_directos_choferes).toLocaleString()}
                  </span>
                  <span className="text-xs text-rose-500 font-medium">Fijos + Var + Fleteros</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Fijos: ${ebitda.costos_fijos_totales.toLocaleString()} | Variables: ${(ebitda.costos_variables_operativos + ebitda.costos_directos_choferes).toLocaleString()}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  EBITDA Neto Operativo
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span
                    className={`text-2xl font-bold font-mono ${
                      ebitda.ebitda_neto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    ${ebitda.ebitda_neto.toLocaleString()}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      ebitda.ebitda_neto >= 0
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                    }`}
                  >
                    {ebitda.ebitda_pct.toFixed(1)}%
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Beneficio antes de amortizaciones</p>
              </div>
            </div>
          )}

          {/* Break-Even Point / Punto de Equilibrio Banner */}
          {ebitda && (
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-5 text-white shadow-md border border-indigo-900/40 flex flex-col md:flex-row items-center justify-between gap-5">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded-full">
                  Análisis de Punto de Equilibrio (Break-Even Point)
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  Ingreso Mensual Necesario para Cubrir la Estructura 3PL
                </h3>
                <p className="text-xs text-slate-300 max-w-xl">
                  Para absorber ${ebitda.costos_fijos_totales.toLocaleString()} de costos fijos (depósito, luz, salarios) con un margen de contribución del {ebitda.margen_contribucion > 0 ? ((ebitda.margen_contribucion / (ebitda.ingresos_servicios_totales || 1)) * 100).toFixed(1) : 40}%, se requiere facturar:
                </p>
              </div>

              <div className="text-right shrink-0 bg-white/10 p-4 rounded-xl border border-white/15 text-center sm:text-right">
                <span className="text-[11px] text-indigo-200 block uppercase font-semibold">
                  Punto de Equilibrio:
                </span>
                <span className="text-2xl font-bold font-mono text-emerald-300 block">
                  ${ebitda.punto_equilibrio_ingresos.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-300 mt-0.5 block">
                  Aprox. <b>{Math.ceil(ebitda.punto_equilibrio_ingresos / ((ebitda.ingresos_servicios_totales / (ebitda.total_viajes || 1)) || 50))} despachos/mes</b>
                </span>
              </div>
            </div>
          )}

          {/* Routes Profitability Detailed Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Desglose de Margen por Despacho & Orden ({finance?.rutas_detalle.length || 0})
              </h3>
              <span className="text-xs text-slate-400">Total Despachos Auditados: {finance?.total_ordenes || 0}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                    <th className="py-3 px-4">Nº Orden</th>
                    <th className="py-3 px-4 text-right">Tarifa Flete Cliente</th>
                    <th className="py-3 px-4 text-right">Pago Conductor</th>
                    <th className="py-3 px-4 text-right">Variables / Peajes</th>
                    <th className="py-3 px-4 text-right">Costo Operativo</th>
                    <th className="py-3 px-4 text-right">Margen Bruto</th>
                    <th className="py-3 px-4 text-center">Margen %</th>
                    <th className="py-3 px-4">Semáforo & Diagnóstico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {finance?.rutas_detalle.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-sky-700 dark:text-sky-300">
                        {r.numero_orden}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                        ${r.tarifa_flete_cliente.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-600 dark:text-amber-400">
                        ${r.pago_conductor.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        ${r.peajes_combustible_variables.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                        ${r.costo_total_operativo.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        ${r.margen_bruto.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            r.semaforo === 'VERDE'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : r.semaforo === 'AMARILLO'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                          }`}
                        >
                          {r.margen_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-400">
                          {r.semaforo === 'VERDE' ? (
                            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                          ) : (
                            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                          )}
                          <span className="truncate max-w-xs">{r.diagnostico}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /*                     TAB: GESTIÓN DE COSTOS FIJOS & VARIABLES              */
        /* ========================================================================= */
        <div className="space-y-5">
          {/* Top Bar for Costs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mr-1">Filtrar:</span>
              <button
                onClick={() => setCostTypeFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  costTypeFilter === 'ALL'
                    ? 'bg-slate-800 text-white dark:bg-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Todos ({costItems.length})
              </button>
              <button
                onClick={() => setCostTypeFilter('FIJO')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  costTypeFilter === 'FIJO'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Costos Fijos ({costItems.filter((c) => c.tipo === 'FIJO').length})
              </button>
              <button
                onClick={() => setCostTypeFilter('VARIABLE')}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  costTypeFilter === 'VARIABLE'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Costos Variables ({costItems.filter((c) => c.tipo === 'VARIABLE').length})
              </button>
            </div>

            <button
              onClick={handleOpenCreateCost}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>+ Nuevo Concepto de Costo</span>
            </button>
          </div>

          {/* Costs Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                    <th className="py-3 px-4">Concepto / Nombre</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-right">Monto Mensual</th>
                    <th className="py-3 px-4">Descripción</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredCosts.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {item.nombre}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.tipo === 'FIJO'
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300'
                          }`}
                        >
                          {item.tipo}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        <div className="flex items-center space-x-1.5">
                          <span>{item.categoria.replace('_', ' ')}</span>
                          {item.categoria === 'ALQUILER' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                              HUB Base
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        ${item.monto_mensual.toLocaleString()} {item.moneda}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">
                        {item.descripcion || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.activo ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                            Activo
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleOpenEditCost(item)}
                            className="p-1.5 text-slate-400 hover:text-sky-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Editar Costo"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteCost(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Desactivar Costo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Alta / Edición de Costo */}
      {isCostModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <CircleDollarSign className="text-emerald-500" size={18} />
                <span>{editingCostId ? 'Editar Concepto de Costo' : 'Nuevo Concepto de Costo 3PL'}</span>
              </h2>
              <button
                onClick={() => setIsCostModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCost} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tipo de Costo</label>
                  <select
                    value={costForm.tipo}
                    onChange={(e) => setCostForm({ ...costForm, tipo: e.target.value as 'FIJO' | 'VARIABLE' })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="FIJO">Costo Fijo Mensual</option>
                    <option value="VARIABLE">Costo Variable Operativo</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Categoría</label>
                  <select
                    value={costForm.categoria}
                    onChange={(e) => setCostForm({ ...costForm, categoria: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="ALQUILER">Alquiler de Depósito</option>
                    <option value="SERVICIOS_PUBLICOS">Luz / UTE / Agua / Redes</option>
                    <option value="SALARIOS">Salarios Operarios / Encargados</option>
                    <option value="INSUMOS_VAS">Insumos (Film, Toner, Etiquetas)</option>
                    <option value="SEGUROS">Seguros de Mercadería / Flota</option>
                    <option value="MANTENIMIENTO">Mantenimiento de Racks / Zorra</option>
                    <option value="GENERAL">Gastos Generales</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Nombre / Detalle del Concepto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Alquiler Depósito Central Nave 1"
                  value={costForm.nombre}
                  onChange={(e) => setCostForm({ ...costForm, nombre: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Monto Mensual Estimado</label>
                  <input
                    type="number"
                    step="50"
                    required
                    value={costForm.monto_mensual}
                    onChange={(e) => setCostForm({ ...costForm, monto_mensual: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Moneda</label>
                  <select
                    value={costForm.moneda}
                    onChange={(e) => setCostForm({ ...costForm, moneda: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="UYU">Pesos Uruguayos ($)</option>
                    <option value="USD">Dólares Americanos (US$)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Descripción / Notas</label>
                <input
                  type="text"
                  placeholder="Ej: Contrato anual con ajuste semestral"
                  value={costForm.descripcion}
                  onChange={(e) => setCostForm({ ...costForm, descripcion: e.target.value })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {editingCostId && (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="cost_activo"
                    checked={costForm.activo}
                    onChange={(e) => setCostForm({ ...costForm, activo: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <label htmlFor="cost_activo" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Costo Activo (Computable en el cálculo de EBITDA)
                  </label>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCostModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer shadow-sm"
                >
                  {editingCostId ? 'Actualizar Costo' : 'Guardar Costo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default LogisticsFinanceView;
