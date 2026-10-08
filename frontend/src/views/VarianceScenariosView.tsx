import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  TrendingDown, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight,
  Zap,
  Trash2,
  AlertCircle,
  Building2,
  Users,
  ShieldAlert,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid
} from 'recharts';
import type { 
  BudgetVarianceItem, 
  BudgetScenarioResponse, 
  MultilevelVarianceResponse,
  UserRole,
  EngineMode 
} from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { DataTable } from '../components/common/DataTable';
import type { Column } from '../components/common/DataTable';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { BudgetEmptyState } from '../components/budget/BudgetEmptyState';
import { CostCentersBudgetGrid } from '../components/budget/CostCentersBudgetGrid';
import { OrganizationStructureView } from '../components/organization/OrganizationStructureView';
import { BudgetCommitmentsManager } from '../components/budget/BudgetCommitmentsManager';
import { apiService } from '../services/api';
import { safeNumber, safeToFixed, formatCurrency } from '../utils/formatters';

interface VarianceScenariosViewProps {
  selectedPeriod: string;
  selectedCategory: string;
  currentRole?: UserRole;
  engineMode?: EngineMode;
}

export const VarianceScenariosView: React.FC<VarianceScenariosViewProps> = ({
  selectedPeriod,
  selectedCategory,
  currentRole = 'controller_admin',
  engineMode = 'auto',
}) => {
  const [activeTab, setActiveTab] = useState<'cost_centers' | 'organization' | 'commitments' | 'variance' | 'multilevel' | 'scenarios'>('cost_centers');
  const [variances, setVariances] = useState<BudgetVarianceItem[]>([]);
  const [multilevelData, setMultilevelData] = useState<MultilevelVarianceResponse | null>(null);
  const [isLoadingVariance, setIsLoadingVariance] = useState(false);

  // Estado del Generador de 3 Escenarios
  const [scenariosData, setScenariosData] = useState<BudgetScenarioResponse | null>(null);
  const [isGeneratingScenarios, setIsGeneratingScenarios] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  // Estado para Reinicio / Eliminación de Período (Admin)
  const [isDeletingPeriod, setIsDeletingPeriod] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  // Cargar variaciones y desglose multinivel
  const fetchVariances = useCallback(async () => {
    setIsLoadingVariance(true);
    setDeleteMessage(null);
    try {
      const [varData, multiData] = await Promise.all([
        apiService.getBudgetVariance({
          periodo: selectedPeriod,
          categoria: selectedCategory !== 'Todas' ? selectedCategory : undefined,
        }).catch(() => []),
        apiService.getMultilevelVariance(selectedPeriod).catch(() => null),
      ]);
      setVariances(varData || []);
      setMultilevelData(multiData);
    } catch (err) {
      console.error('Error fetching variances', err);
    } finally {
      setIsLoadingVariance(false);
    }
  }, [selectedPeriod, selectedCategory]);

  useEffect(() => {
    fetchVariances();
  }, [fetchVariances]);

  // Manejo de reinicio de período (Admin only)
  const handleDeletePeriod = async () => {
    setIsDeletingPeriod(true);
    try {
      const res = await apiService.deleteBudgetPeriod(selectedPeriod);
      setDeleteMessage(res.message);
      setShowDeleteModal(false);
      await fetchVariances();
    } catch (err: any) {
      console.error('Error deleting budget period', err);
      alert(err.response?.data?.detail || 'Error al reiniciar el período presupuestario.');
    } finally {
      setIsDeletingPeriod(false);
    }
  };

  // Generar 3 Presupuestos FP&A
  const handleGenerateScenarios = async () => {
    setIsGeneratingScenarios(true);
    setScenarioError(null);
    try {
      const res = await apiService.getBudgetScenarios({
        target_period: selectedPeriod,
      });
      setScenariosData(res);
    } catch (err: any) {
      setScenarioError(err.response?.data?.detail || 'Error al generar escenarios presupuestarios');
    } finally {
      setIsGeneratingScenarios(false);
    }
  };

  // Métricas agregadas de variaciones defensivas
  const totalPresupuestado = (variances || []).reduce((acc, v) => acc + (Number(v?.monto_presupuestado) || 0), 0);
  const totalReal = (variances || []).reduce((acc, v) => acc + (Number(v?.monto_real) || 0), 0);
  const variacionNeta = totalReal - totalPresupuestado;
  const variacionPctNeta = totalPresupuestado > 0 ? (variacionNeta / totalPresupuestado) * 100 : 0;

  const varianceColumns: Column<BudgetVarianceItem>[] = [
    {
      key: 'periodo',
      header: 'Periodo',
      width: '100px',
      render: (row) => <span className="font-semibold text-slate-700 dark:text-slate-300">{row.periodo}</span>,
    },
    {
      key: 'categoria',
      header: 'Categoría',
      render: (row) => <span className="text-[#333333] dark:text-slate-100 font-medium">{row.categoria || 'Consolidado'}</span>,
    },
    {
      key: 'tipo',
      header: 'Tipo',
      width: '110px',
      render: (row) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {row.tipo}
        </span>
      ),
    },
    {
      key: 'monto_presupuestado',
      header: 'Presupuestado',
      render: (row) => `$${Number(row.monto_presupuestado || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'monto_real',
      header: 'Real Ejecutado',
      render: (row) => (
        <span className="font-semibold text-[#333333] dark:text-slate-100">
          ${Number(row.monto_real || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'variacion_absoluta',
      header: 'Desvío Absoluto',
      render: (row) => {
        const val = safeNumber(row?.variacion_absoluta, 0);
        return (
          <span className={`font-mono font-semibold ${val >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
            {formatCurrency(val)}
          </span>
        );
      },
    },
    {
      key: 'variacion_porcentual',
      header: 'Desvío %',
      render: (row) => {
        const val = safeNumber(row?.variacion_porcentual, 0);
        return (
          <span className={`font-semibold ${val >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
            {val >= 0 ? `+${safeToFixed(val, 1)}%` : `${safeToFixed(val, 1)}%`}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Semáforo Contable',
      width: '140px',
      render: (row) => {
        const s = (row.status || '').toUpperCase();
        if (s === 'GREEN') {
          return (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-[#2ecc71] border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 size={12} />
              <span>Alineado</span>
            </span>
          );
        }
        if (s === 'YELLOW') {
          return (
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-[#f39c12] border border-amber-200 dark:border-amber-800">
              <AlertTriangle size={12} />
              <span>Atención</span>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-[#e74c3c] border border-rose-200 dark:border-rose-800">
            <TrendingDown size={12} />
            <span>Desvío Crítico</span>
          </span>
        );
      },
    },
  ];

  return (
    <ErrorBoundary fallbackTitle="Error al visualizar el panel presupuestario">
      <div className="space-y-6">
        {/* Sub-Navbar Moderno de Presupuestos & Gobernanza */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={() => setActiveTab('cost_centers')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'cost_centers'
                  ? 'bg-white dark:bg-slate-900 text-[#00a2e8] shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Building2 size={14} className={activeTab === 'cost_centers' ? 'text-[#00a2e8]' : 'text-slate-400'} />
              <span>Matriz OPEX &amp; Centros de Costo</span>
            </button>

            <button
              onClick={() => setActiveTab('organization')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'organization'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users size={14} className={activeTab === 'organization' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
              <span>Estructura: Áreas &amp; Responsables</span>
            </button>

            <button
              onClick={() => setActiveTab('commitments')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'commitments'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ShieldAlert size={14} className={activeTab === 'commitments' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'} />
              <span>Compromisos &amp; Tareas IA</span>
            </button>

            <button
              onClick={() => setActiveTab('variance')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'variance'
                  ? 'bg-white dark:bg-slate-900 text-[#00a2e8] shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 size={14} className={activeTab === 'variance' ? 'text-[#00a2e8]' : 'text-slate-400'} />
              <span>Desvíos &amp; Variance Analysis</span>
            </button>

            <button
              onClick={() => setActiveTab('multilevel')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'multilevel'
                  ? 'bg-white dark:bg-slate-900 text-[#00a2e8] shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Zap size={14} className={activeTab === 'multilevel' ? 'text-[#00a2e8]' : 'text-slate-400'} />
              <span>Descomposición Multinivel</span>
            </button>

            <button
              onClick={() => setActiveTab('scenarios')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'scenarios'
                  ? 'bg-white dark:bg-slate-900 text-[#00a2e8] shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles size={14} className={activeTab === 'scenarios' ? 'text-[#00a2e8]' : 'text-slate-400'} />
              <span>Proyecciones IA (FP&amp;A)</span>
            </button>
          </div>

          {/* Acciones de Controller Admin (Reiniciar Período) */}
          {currentRole === 'controller_admin' && variances.length > 0 && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer shrink-0"
              title="Borrar metas y dejar período en blanco"
            >
              <Trash2 size={13} />
              <span>Reiniciar Período</span>
            </button>
          )}
        </div>

        {deleteMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
            ✓ {deleteMessage}
          </div>
        )}

        {/* Modal de Confirmación de Reinicio */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-w-md w-full space-y-4">
              <div className="flex items-center space-x-3 text-rose-600">
                <span className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
                  <AlertCircle size={22} />
                </span>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  ¿Reiniciar metas de {selectedPeriod}?
                </h3>
              </div>

              <p className="text-xs text-[#535c69] dark:text-slate-400 leading-relaxed">
                Esta acción eliminará todas las metas presupuestarias de la tabla <code className="text-slate-700 dark:text-slate-200">presupuestos_metas</code> para el período <strong>{selectedPeriod}</strong>. El período volverá a quedar en blanco para carga manual o autogeneración asistida.
              </p>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeletingPeriod}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeletePeriod}
                  disabled={isDeletingPeriod}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isDeletingPeriod ? 'Eliminando...' : 'Sí, Reiniciar Período'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* SUBTAB 1: VARIANCE ANALYSIS                                           */}
        {/* ===================================================================== */}
        {activeTab === 'variance' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {variances.length === 0 && !isLoadingVariance ? (
              <BudgetEmptyState
                periodo={selectedPeriod}
                engineMode={engineMode}
                onRefresh={fetchVariances}
              />
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <MetricCard
                    title="Monto Presupuestado"
                    value={`$${totalPresupuestado.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    subtitle={`Periodo ${selectedPeriod}`}
                    icon={DollarSign}
                    iconColor="text-slate-600 dark:text-slate-300"
                    iconBg="bg-slate-100 dark:bg-slate-800"
                  />

                  <MetricCard
                    title="Real Ejecutado (Actuals)"
                    value={`$${totalReal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    subtitle="Cierre consolidado"
                    icon={Layers}
                    iconColor="text-[#00a2e8]"
                    iconBg="bg-sky-50 dark:bg-sky-950/40"
                  />

                  <MetricCard
                    title="Variación Neta Consolidada"
                    value={`${variacionNeta >= 0 ? '+' : ''}$${variacionNeta.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    subtitle="Efecto sobre el target financiero"
                    icon={variacionNeta >= 0 ? ArrowUpRight : ArrowDownRight}
                    iconColor={variacionNeta >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}
                    iconBg={variacionNeta >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40'}
                    badge={{
                      text: `${safeNumber(variacionPctNeta) >= 0 ? '+' : ''}${safeToFixed(variacionPctNeta, 1)}%`,
                      variant: safeNumber(variacionPctNeta) >= 0 ? 'success' : 'danger',
                    }}
                  />
                </div>

                {/* Variance Table */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#333333] dark:text-slate-100">
                      Matriz de Desvíos Contables con Semáforos de Tolerancia
                    </h3>
                    <span className="text-xs text-[#535c69] dark:text-slate-400">
                      {variances.length} registros en {selectedPeriod}
                    </span>
                  </div>

                  <DataTable
                    data={variances}
                    columns={varianceColumns}
                    keyExtractor={(row) => String(row.id || row.categoria || Math.random())}
                    pageSizeDefault={10}
                    emptyMessage={isLoadingVariance ? 'Cargando variaciones contables...' : 'No se encontraron registros de presupuesto'}
                    searchPlaceholder="Buscar por categoría o tipo..."
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* SUBTAB 2: MULTILEVEL VARIANCE                                         */}
        {/* ===================================================================== */}
        {activeTab === 'multilevel' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {multilevelData ? (
              <>
                {/* Multilevel KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <MetricCard
                    title="Efecto Precio Neto"
                    value={`${(multilevelData.total_price_variance ?? 0) >= 0 ? '+' : ''}$${Number(multilevelData.total_price_variance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    subtitle="Impacto de modificaciones tarifarias"
                    icon={(multilevelData.total_price_variance ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight}
                    iconColor={(multilevelData.total_price_variance ?? 0) >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}
                    iconBg={(multilevelData.total_price_variance ?? 0) >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40'}
                  />

                  <MetricCard
                    title="Efecto Volumen Neto"
                    value={`${(multilevelData.total_volume_variance ?? 0) >= 0 ? '+' : ''}$${Number(multilevelData.total_volume_variance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    subtitle="Desvío en unidades comercializadas"
                    icon={(multilevelData.total_volume_variance ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight}
                    iconColor={(multilevelData.total_volume_variance ?? 0) >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}
                    iconBg={(multilevelData.total_volume_variance ?? 0) >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40'}
                  />

                  <MetricCard
                    title="Efecto Mix de Cartera"
                    value={`${(multilevelData.total_mix_variance ?? 0) >= 0 ? '+' : ''}$${Number(multilevelData.total_mix_variance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    subtitle="Cambio en participación de productos"
                    icon={(multilevelData.total_mix_variance ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight}
                    iconColor={(multilevelData.total_mix_variance ?? 0) >= 0 ? 'text-[#2ecc71]' : 'text-[#f39c12]'}
                    iconBg={(multilevelData.total_mix_variance ?? 0) >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-amber-50 dark:bg-amber-950/40'}
                  />

                  <MetricCard
                    title="Desvío Presupuestario Neto"
                    value={`${(multilevelData.net_variance ?? 0) >= 0 ? '+' : ''}$${Number(multilevelData.net_variance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    subtitle={`Desvío total ${safeToFixed(multilevelData.net_variance_pct, 1)}%`}
                    icon={DollarSign}
                    iconColor={safeNumber(multilevelData.net_variance) >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}
                    iconBg={safeNumber(multilevelData.net_variance) >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-rose-50 dark:bg-rose-950/40'}
                    badge={{
                      text: `${safeNumber(multilevelData.net_variance_pct) >= 0 ? '+' : ''}${safeToFixed(multilevelData.net_variance_pct, 1)}%`,
                      variant: Math.abs(safeNumber(multilevelData.net_variance_pct)) <= 5 ? 'success' : 'danger',
                    }}
                  />
                </div>

                {/* Gráfico Waterfall de Efectos */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
                  <div>
                    <h3 className="font-bold text-sm text-[#333333] dark:text-slate-100">
                      Cascada de Descomposición de Desvíos (Price / Volume / Mix)
                    </h3>
                    <p className="text-xs text-[#535c69] dark:text-slate-400">
                      Aislamiento matemático de causas de variación sobre el EBITDA presupuestado
                    </p>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: 'Presupuesto Target', amount: Number(multilevelData.total_budget || 0), fill: '#94a3b8' },
                          { name: 'Efecto Precio', amount: Number(multilevelData.total_price_variance || 0), fill: (multilevelData.total_price_variance || 0) >= 0 ? '#2ecc71' : '#e74c3c' },
                          { name: 'Efecto Volumen', amount: Number(multilevelData.total_volume_variance || 0), fill: (multilevelData.total_volume_variance || 0) >= 0 ? '#2ecc71' : '#e74c3c' },
                          { name: 'Efecto Mix', amount: Number(multilevelData.total_mix_variance || 0), fill: (multilevelData.total_mix_variance || 0) >= 0 ? '#2ecc71' : '#f39c12' },
                          { name: 'Real Ejecutado', amount: Number(multilevelData.total_actual || 0), fill: '#00a2e8' },
                        ]}
                        margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip formatter={(val: any) => [`$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Impacto']} />
                        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                          {[
                            '#94a3b8',
                            (multilevelData.total_price_variance || 0) >= 0 ? '#2ecc71' : '#e74c3c',
                            (multilevelData.total_volume_variance || 0) >= 0 ? '#2ecc71' : '#e74c3c',
                            (multilevelData.total_mix_variance || 0) >= 0 ? '#2ecc71' : '#f39c12',
                            '#00a2e8',
                          ].map((c, i) => (
                            <Cell key={`bar-${i}`} fill={c} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Panel de IA: Plan de Mitigación en 3 Pasos (Desvío > 5%) */}
                {multilevelData.requires_mitigation && (multilevelData.mitigation_plan_3_steps || []).length > 0 && (
                  <div className="bg-gradient-to-r from-rose-50/70 via-white to-amber-50/40 dark:from-rose-950/30 dark:via-slate-900 dark:to-amber-950/20 rounded-2xl border border-rose-200/80 dark:border-rose-900/50 p-5 shadow-sm space-y-3">
                    <div className="flex items-center space-x-2">
                      <span className="p-1.5 bg-rose-100 dark:bg-rose-900/60 text-[#e74c3c] rounded-lg">
                        <AlertTriangle size={18} />
                      </span>
                      <div>
                        <h4 className="font-bold text-xs text-rose-900 dark:text-rose-200">
                          Plan de Mitigación en 3 Pasos (Activado por Desvío &gt; 5%)
                        </h4>
                        <p className="text-[11px] text-rose-700 dark:text-rose-400">
                          Directiva inmediata de control de gestión financiero para restablecer el margen de seguridad
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      {multilevelData.mitigation_plan_3_steps.map((step, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-rose-100 dark:border-rose-900/40 shadow-2xs space-y-1">
                          <span className="text-[10px] font-bold text-[#00a2e8] uppercase">Paso {idx + 1}</span>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                {isLoadingVariance ? 'Cargando descomposición multinivel...' : 'No hay datos para la descomposición multinivel de este período.'}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* SUBTAB 3: FP&A SCENARIOS                                              */}
        {/* ===================================================================== */}
        {activeTab === 'scenarios' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header Action Card */}
            <div className="bg-gradient-to-r from-sky-50/70 via-white to-sky-50/30 dark:from-sky-950/20 dark:via-slate-900 dark:to-sky-950/20 rounded-2xl border border-sky-200/80 dark:border-sky-900/50 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <Sparkles size={18} className="text-[#00a2e8]" />
                  <h3 className="font-bold text-sm text-[#333333] dark:text-slate-100">
                    Simulador de 3 Presupuestos Inteligentes
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-800 text-[#00a2e8] border border-sky-200 dark:border-sky-800 rounded-full">
                    Defensivo • Tendencial • Expansivo
                  </span>
                </div>
                <p className="text-xs text-[#535c69] dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Calcula automáticamente tres estados de resultados proyectados con ajuste inflacionario, absorción de costos y recomendaciones cualitativas del LLM para el directorio.
                </p>
              </div>

              <button
                onClick={handleGenerateScenarios}
                disabled={isGeneratingScenarios}
                className="inline-flex items-center space-x-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#00a2e8] to-[#008ecb] hover:from-[#008ecb] rounded-xl shadow-sm hover:shadow-bitrix-glow transition-all shrink-0 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles size={15} className={isGeneratingScenarios ? 'animate-spin' : ''} />
                <span>{isGeneratingScenarios ? 'Generando Escenarios...' : '⚡ Correr Generador FP&A'}</span>
              </button>
            </div>

            {scenarioError && (
              <div className="p-3 bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-800 rounded-xl text-xs text-[#e74c3c]">
                {scenarioError}
              </div>
            )}

            {/* Escenarios Table and Qualitative Analysis */}
            {scenariosData && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Conservador */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-xs uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                        🛡️ Conservador
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                        Caja &amp; Defensivo
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#535c69] dark:text-slate-400">Ingresos:</span>
                        <span className="font-bold font-mono">
                          ${(scenariosData.escenarios?.conservador?.ingresos_totales || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#535c69] dark:text-slate-400">COGS:</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          ${(scenariosData.escenarios?.conservador?.cogs_total || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#535c69] dark:text-slate-400">Margen Bruto:</span>
                        <span className="font-semibold text-[#2ecc71]">
                          {safeToFixed(scenariosData.escenarios?.conservador?.margen_bruto_pct, 1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#535c69] dark:text-slate-400">EBITDA Proyectado:</span>
                        <span className="font-bold font-mono text-[#00a2e8]">
                          ${(scenariosData.escenarios?.conservador?.ebitda || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[#535c69] dark:text-slate-400">DOH Objetivo:</span>
                        <span className="font-bold">{scenariosData.escenarios?.conservador?.doh_objetivo_dias || 0} días</span>
                      </div>
                    </div>
                  </div>

                  {/* Base */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-[#00a2e8] p-5 shadow-sm space-y-3 relative">
                    <span className="absolute -top-2.5 right-4 px-2 py-0.5 bg-[#00a2e8] text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
                      Recomendado
                    </span>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-xs uppercase text-[#00a2e8] tracking-wider">
                        🎯 Base / Moderado
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] rounded-full">
                        Tendencial
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#535c69] dark:text-slate-400">Ingresos:</span>
                        <span className="font-bold font-mono">
                          ${(scenariosData.escenarios?.base?.ingresos_totales || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#535c69] dark:text-slate-400">COGS:</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          ${(scenariosData.escenarios?.base?.cogs_total || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#535c69] dark:text-slate-400">Margen Bruto:</span>
                        <span className="font-semibold text-[#2ecc71]">
                          {safeToFixed(scenariosData.escenarios?.base?.margen_bruto_pct, 1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#535c69] dark:text-slate-400">EBITDA Proyectado:</span>
                        <span className="font-bold font-mono text-[#00a2e8]">
                          ${(scenariosData.escenarios?.base?.ebitda || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[#535c69] dark:text-slate-400">DOH Objetivo:</span>
                        <span className="font-bold">{scenariosData.escenarios?.base?.doh_objetivo_dias || 0} días</span>
                      </div>
                    </div>
                  </div>

                  {/* Agresivo */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-xs uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
                        🚀 Agresivo
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-[#2ecc71] rounded-full">
                        Expansión
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#535c69] dark:text-slate-400">Ingresos:</span>
                        <span className="font-bold font-mono">
                          ${(scenariosData.escenarios?.agresivo?.ingresos_totales || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#535c69] dark:text-slate-400">COGS:</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          ${(scenariosData.escenarios?.agresivo?.cogs_total || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#535c69] dark:text-slate-400">Margen Bruto:</span>
                        <span className="font-semibold text-[#2ecc71]">
                          {safeToFixed(scenariosData.escenarios?.agresivo?.margen_bruto_pct, 1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#535c69] dark:text-slate-400">EBITDA Proyectado:</span>
                        <span className="font-bold font-mono text-[#00a2e8]">
                          ${(scenariosData.escenarios?.agresivo?.ebitda || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[#535c69] dark:text-slate-400">DOH Objetivo:</span>
                        <span className="font-bold">{scenariosData.escenarios?.agresivo?.doh_objetivo_dias || 0} días</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dictamen Cualitativo de IA */}
                {scenariosData.analisis_ia && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <h4 className="font-bold text-sm text-[#333333] dark:text-slate-100 flex items-center space-x-2">
                        <Sparkles size={16} className="text-[#00a2e8]" />
                        <span>Evaluación Estratégica &amp; Dictamen Asesor IA</span>
                      </h4>
                      <span className="text-xs text-slate-400">
                        Motor: {scenariosData.provider} ({safeToFixed(scenariosData.latency_ms, 0)} ms)
                      </span>
                    </div>

                    <div className="text-xs text-[#535c69] dark:text-slate-300 leading-relaxed bg-[#f5f7f8] dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                      <p className="font-medium text-[#333333] dark:text-slate-100">
                        {scenariosData.analisis_ia.resumen_ejecutivo}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <h5 className="font-bold text-[#333333] dark:text-slate-100 mb-2">📌 Supuestos Clave</h5>
                        <ul className="space-y-1.5 list-disc list-inside text-[#535c69] dark:text-slate-400">
                          {(scenariosData.analisis_ia.supuestos_clave || []).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                        <h5 className="font-bold text-[#f39c12] mb-2">⚠️ Riesgos Principales</h5>
                        <ul className="space-y-1.5 list-disc list-inside text-[#535c69] dark:text-slate-400">
                          {(scenariosData.analisis_ia.riesgos_principales || []).map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                        <h5 className="font-bold text-[#2ecc71] mb-2">🛡️ Plan de Contingencia</h5>
                        <ul className="space-y-1.5 list-disc list-inside text-[#535c69] dark:text-slate-400">
                          {(scenariosData.analisis_ia.plan_de_contingencia || []).map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pestaña: Centros de Costo & OPEX */}
        {activeTab === 'cost_centers' && (
          <CostCentersBudgetGrid
            selectedPeriod={selectedPeriod}
            currentRole={currentRole}
          />
        )}

        {/* Pestaña: Estructura Organizacional: Áreas & Responsables */}
        {activeTab === 'organization' && (
          <OrganizationStructureView />
        )}

        {/* Pestaña: Compromisos Presupuestarios & Tareas IA */}
        {activeTab === 'commitments' && (
          <BudgetCommitmentsManager selectedPeriod={selectedPeriod} />
        )}
      </div>
    </ErrorBoundary>
  );
};
