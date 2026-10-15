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
  Check,
  X,
  BookOpen,
  Briefcase,
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
  const [currentPeriod, setCurrentPeriod] = useState<string>(selectedPeriod || '2025-09');
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [variances, setVariances] = useState<BudgetVarianceItem[]>([]);
  const [multilevelData, setMultilevelData] = useState<MultilevelVarianceResponse | null>(null);
  const [isLoadingVariance, setIsLoadingVariance] = useState(false);

  // Sincronizar si cambia desde props
  useEffect(() => {
    if (selectedPeriod) setCurrentPeriod(selectedPeriod);
  }, [selectedPeriod]);

  // Cargar períodos disponibles desde la base de datos
  useEffect(() => {
    apiService.getAvailablePeriods().then((res) => {
      if (res.periods && res.periods.length > 0) {
        setAvailablePeriods(res.periods);
      }
    }).catch(() => {});
  }, []);

  // Interfaces para soporte normalizado de escenarios
  interface CostCenterBreakdownItem {
    centro_costo_id: number;
    nombre: string;
    monto_sugerido: number;
    justificacion: string;
  }

  interface NormalizedScenario {
    name: string;
    focus: string;
    ingresos: number;
    cogs: number;
    margen_bruto: number;
    ebitda: number;
    opex: number;
    doh: number;
    plan_accion: {
      compras_abastecimiento?: string;
      politica_pricing?: string;
      logistica_inventario?: string;
    };
    desglose_centros_costo: CostCenterBreakdownItem[];
    riesgos_mitigacion: {
      riesgo: string;
      mitigacion: string;
    }[];
  }

  const normalizeScenario = (raw: any, defaultDoh = 45): NormalizedScenario | null => {
    if (!raw) return null;
    const num = (v: any) => typeof v === 'number' ? v : (parseFloat(String(v).replace(/[^0-9.-]/g, '')) || 0);
    const sales = num(raw.projected_sales ?? raw.ingresos ?? raw.ingresos_totales ?? 0);
    const cogs = num(raw.projected_cogs ?? raw.cogs ?? raw.cogs_total ?? 0);
    let margin = num(raw.gross_margin_pct ?? raw.margen_bruto ?? raw.margen_bruto_pct ?? 0);
    if (margin > 0 && margin <= 1) margin = margin * 100;
    else if (margin === 0 && sales > 0) margin = ((sales - cogs) / sales) * 100;

    return {
      name: raw.name || '',
      focus: raw.focus || raw.racional || '',
      ingresos: sales,
      cogs: cogs,
      margen_bruto: Number(margin.toFixed(1)),
      ebitda: num(raw.contribution_margin ?? raw.ebitda ?? (sales - cogs)),
      opex: num(raw.projected_opex ?? 0),
      doh: Math.round(num(raw.doh_objetivo ?? raw.doh ?? raw.doh_objetivo_dias ?? defaultDoh)),
      plan_accion: raw.plan_accion || {},
      desglose_centros_costo: raw.desglose_centros_costo || [],
      riesgos_mitigacion: raw.riesgos_mitigacion || []
    };
  };

  // Estado del Generador de 3 Escenarios
  const [scenariosData, setScenariosData] = useState<BudgetScenarioResponse | null>(null);
  const [scenarios, setScenarios] = useState<{
    conservador: NormalizedScenario | null;
    base: NormalizedScenario | null;
    agresivo: NormalizedScenario | null;
  } | null>(null);
  const [isGeneratingScenarios, setIsGeneratingScenarios] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  // Estados de Progressive Disclosure (Acordeones por Escenario)
  const [activeAccordion, setActiveAccordion] = useState<Record<string, 'plan' | 'centros' | 'riesgos' | null>>({
    conservador: null,
    base: 'centros',
    agresivo: null,
  });

  // Estado para Adopción y Cierre Contable de Escenario
  const [selectedScenarioForAdoption, setSelectedScenarioForAdoption] = useState<{
    key: 'conservador' | 'base' | 'agresivo';
    data: NormalizedScenario;
  } | null>(null);
  const [isApplyingScenario, setIsApplyingScenario] = useState(false);
  const [adoptionMessage, setAdoptionMessage] = useState<string | null>(null);

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
          periodo: currentPeriod,
          categoria: selectedCategory !== 'Todas' ? selectedCategory : undefined,
        }).catch(() => []),
        apiService.getMultilevelVariance(currentPeriod).catch(() => null),
      ]);
      setVariances(varData || []);
      setMultilevelData(multiData);
    } catch (err) {
      console.error('Error fetching variances', err);
    } finally {
      setIsLoadingVariance(false);
    }
  }, [currentPeriod, selectedCategory]);

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
    setAdoptionMessage(null);
    try {
      const res = await apiService.getBudgetScenarios({
        target_period: currentPeriod || selectedPeriod,
      });
      setScenariosData(res);
      const sc = (res as any)?.scenarios || (res as any)?.escenarios || res;
      setScenarios({
        conservador: normalizeScenario(sc.conservative || sc.conservador, 60),
        base: normalizeScenario(sc.base || sc.moderado, 45),
        agresivo: normalizeScenario(sc.aggressive || sc.agresivo, 35)
      });
    } catch (err: any) {
      setScenarioError(err.response?.data?.detail || 'Error al generar escenarios presupuestarios');
    } finally {
      setIsGeneratingScenarios(false);
    }
  };

  // Adopción Presupuestaria Oficial
  const handleConfirmAdoptScenario = async () => {
    if (!selectedScenarioForAdoption) return;
    setIsApplyingScenario(true);
    try {
      const partidas = (selectedScenarioForAdoption.data.desglose_centros_costo || []).map((cc) => ({
        centro_costo_id: cc.centro_costo_id,
        monto_presupuestado: cc.monto_sugerido,
        concepto_opex: `Presupuesto Oficial ${selectedScenarioForAdoption.data.name || selectedScenarioForAdoption.key.toUpperCase()} - ${cc.justificacion || 'OPEX'}`
      }));

      const res = await apiService.applyBudgetScenario({
        periodo: currentPeriod,
        scenario_name: selectedScenarioForAdoption.key,
        partidas
      });

      setAdoptionMessage(res.message || `Presupuesto oficial para ${currentPeriod} grabado exitosamente.`);
      setSelectedScenarioForAdoption(null);
      await fetchVariances();
    } catch (err: any) {
      console.error('Error applying budget scenario', err);
      alert(err.response?.data?.detail || 'Error al grabar el presupuesto oficial.');
    } finally {
      setIsApplyingScenario(false);
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

          <div className="flex items-center space-x-2">
            {/* Selector de Períodos Disponibles */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs shadow-2xs">
              <span className="text-slate-400 font-medium">Período:</span>
              <select
                value={currentPeriod}
                onChange={(e) => setCurrentPeriod(e.target.value)}
                className="bg-transparent font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
                title="Seleccionar período presupuestario"
              >
                {availablePeriods.length === 0 ? (
                  <option value={currentPeriod}>{currentPeriod}</option>
                ) : (
                  availablePeriods.map((p) => (
                    <option key={p} value={p} className="dark:bg-slate-900">
                      {p}
                    </option>
                  ))
                )}
              </select>
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

                {/* Guía Metodológica: Los 4 Efectos Económicos */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="p-1.5 bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] rounded-lg">
                        <BookOpen size={18} />
                      </span>
                      <div>
                        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                          Descomposición Multinivel: Guía de Interpretación de los 4 Efectos
                        </h4>
                        <p className="text-[11px] text-[#535c69] dark:text-slate-400">
                          Aislamiento econométrico riguroso para separar fallas comerciales de ineficiencias de compras o logística
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
                      Metodología FP&A Estándar
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Efecto Precio */}
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">1. Efecto Precio</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${(multilevelData.total_price_variance ?? 0) >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {(multilevelData.total_price_variance ?? 0) >= 0 ? 'Favorable' : 'Desfavorable'}
                        </span>
                      </div>
                      <code className="block text-[10px] bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 font-mono">
                        (P_real - P_pres) × Q_real
                      </code>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        Aísla el poder de fijación de precios y descuentos comerciales otorgados, sin contaminación del volumen vendido.
                      </p>
                    </div>

                    {/* Efecto Volumen */}
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">2. Efecto Volumen</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${(multilevelData.total_volume_variance ?? 0) >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {(multilevelData.total_volume_variance ?? 0) >= 0 ? 'Favorable' : 'Desfavorable'}
                        </span>
                      </div>
                      <code className="block text-[10px] bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 font-mono">
                        (Q_real - Q_pres) × P_pres
                      </code>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        Cuantifica el impacto de la mayor o menor cantidad física de bultos o unidades transaccionadas en el mercado.
                      </p>
                    </div>

                    {/* Efecto Mix de Cartera */}
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">3. Efecto Mix</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${(multilevelData.total_mix_variance ?? 0) >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {(multilevelData.total_mix_variance ?? 0) >= 0 ? 'Favorable' : 'Alerta'}
                        </span>
                      </div>
                      <code className="block text-[10px] bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 font-mono">
                        Σ (w_real - w_pres) × M_pres
                      </code>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        Mide si los clientes adquirieron más productos de alto margen o si las ventas migraron a categorías de bajo margen.
                      </p>
                    </div>

                    {/* Efecto Costo / CMV */}
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">4. Efecto Costo / OPEX</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                          Eficiencia
                        </span>
                      </div>
                      <code className="block text-[10px] bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 font-mono">
                        (C_pres - C_real) × Q_real
                      </code>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        Detecta sobrecostos de importación, variaciones en fletes 3PL y desvíos de compras frente a cotizaciones acordadas.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Síntesis Ejecutiva IA para el Directorio */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
                        <Briefcase size={20} />
                      </span>
                      <div>
                        <h4 className="font-bold text-sm text-white">
                          Dictamen de Síntesis Ejecutiva para el Directorio (Board Copilot)
                        </h4>
                        <p className="text-xs text-indigo-200/70">
                          Diagnóstico automatizado consolidado para el período {selectedPeriod}
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-indigo-600/30 border border-indigo-400/40 text-indigo-200 text-xs font-semibold rounded-full self-start sm:self-auto">
                      Dictamen Trimestral Calcu FP&A
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-2">
                      <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-300">1. Diagnóstico de Margen</span>
                      <p className="text-slate-300 leading-relaxed">
                        El desvío consolidado de <strong>${Math.abs(multilevelData.net_variance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> ({multilevelData.net_variance_pct >= 0 ? '+' : ''}{Number(multilevelData.net_variance_pct || 0).toFixed(1)}%) refleja que {(multilevelData.total_price_variance || 0) >= 0 ? 'la política tarifaria protegió la rentabilidad' : 'hubo una erosión por descuentos comerciales excesivos'}.
                      </p>
                    </div>

                    <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-2">
                      <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-300">2. Comportamiento de Demanda</span>
                      <p className="text-slate-300 leading-relaxed">
                        El efecto volumen ({Number(multilevelData.total_volume_variance || 0) >= 0 ? 'expansivo' : 'contractivo'}) combinado con el efecto mix indica que {(multilevelData.total_mix_variance || 0) >= 0 ? 'la cartera se inclinó hacia productos premium con mayor contribución' : 'la rotación migró hacia categorías básicas de menor margen unitario'}.
                      </p>
                    </div>

                    <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-2">
                      <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-300">3. Directiva Estratégica</span>
                      <p className="text-slate-300 leading-relaxed">
                        {multilevelData.requires_mitigation 
                          ? 'Se activó protocolo de mitigación estricto: congelar ampliaciones OPEX no esenciales y auditar licitaciones de reposición en DEP-CENTRAL-MVD y DEP-SALTO.' 
                          : 'Operación dentro de los límites de tolerancia presupuestaria (±5%). Autorizar avances de inversión en expansión comercial y logística 3PL.'}
                      </p>
                    </div>
                  </div>
                </div>
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

            {/* Notificación de Adopción Oficial Exitosa */}
            {adoptionMessage && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-in fade-in">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-semibold">{adoptionMessage}</span>
                </div>
                <button
                  onClick={() => setAdoptionMessage(null)}
                  className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-emerald-600 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Escenarios Table and Qualitative Analysis */}
            {scenarios && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {(['conservador', 'base', 'agresivo'] as const).map((key) => {
                    const s = scenarios[key];
                    if (!s) return null;
                    const isBase = key === 'base';
                    const activeTabKey = activeAccordion[key];

                    return (
                      <div
                        key={key}
                        className={`bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all ${
                          isBase
                            ? 'border-2 border-[#00a2e8] ring-4 ring-sky-500/10'
                            : 'border border-slate-200/80 dark:border-slate-800'
                        }`}
                      >
                        {/* Cabecera */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                {key === 'conservador' && '🛡️ Conservador'}
                                {key === 'base' && '🎯 Base / Moderado'}
                                {key === 'agresivo' && '🚀 Agresivo'}
                              </span>
                              {isBase && (
                                <span className="px-2 py-0.5 bg-[#00a2e8] text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
                                  Recomendado
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                              {key === 'conservador' && 'Caja & Defensivo'}
                              {key === 'base' && 'Tendencial'}
                              {key === 'agresivo' && 'Expansión'}
                            </span>
                          </div>

                          <p className="text-[11px] text-[#535c69] dark:text-slate-400 italic leading-snug">
                            {s.focus || 'Estrategia presupuestaria equilibrada.'}
                          </p>
                        </div>

                        {/* KPIs Principales en USD */}
                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 text-xs border border-slate-100 dark:border-slate-800">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400">Ingresos Proyectados:</span>
                            <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                              {formatCurrency(s.ingresos)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400">CMV / COGS:</span>
                            <span className="font-mono text-slate-600 dark:text-slate-400">
                              {formatCurrency(s.cogs)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400">Margen Bruto:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {s.margen_bruto}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400">OPEX Proyectado:</span>
                            <span className="font-mono font-medium text-amber-600 dark:text-amber-400">
                              {formatCurrency(s.opex)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 dark:border-slate-700">
                            <span className="text-slate-500 dark:text-slate-400">EBITDA Proyectado:</span>
                            <span className="font-bold font-mono text-[#00a2e8]">
                              {formatCurrency(s.ebitda)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400">DOH Objetivo:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {s.doh} días
                            </span>
                          </div>
                        </div>

                        {/* Acordeón Plegable "Estrategia & Desglose OPEX" */}
                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <span>Estrategia &amp; Desglose OPEX</span>
                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveAccordion((prev) => ({
                                    ...prev,
                                    [key]: prev[key] === 'plan' ? null : 'plan',
                                  }))
                                }
                                className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                                  activeTabKey === 'plan'
                                    ? 'bg-[#00a2e8] text-white font-bold'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                Plan
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveAccordion((prev) => ({
                                    ...prev,
                                    [key]: prev[key] === 'centros' ? null : 'centros',
                                  }))
                                }
                                className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                                  activeTabKey === 'centros'
                                    ? 'bg-[#00a2e8] text-white font-bold'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                11 CCs
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveAccordion((prev) => ({
                                    ...prev,
                                    [key]: prev[key] === 'riesgos' ? null : 'riesgos',
                                  }))
                                }
                                className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                                  activeTabKey === 'riesgos'
                                    ? 'bg-[#00a2e8] text-white font-bold'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                Riesgos
                              </button>
                            </div>
                          </div>

                          {/* Pestaña 1: Plan Operativo */}
                          {activeTabKey === 'plan' && (
                            <div className="p-3 bg-sky-50/50 dark:bg-sky-950/20 rounded-xl space-y-2 border border-sky-100 dark:border-sky-900/40 text-[11px] animate-in fade-in">
                              <div>
                                <span className="font-bold text-[#00a2e8] block">📦 Compras &amp; Abastecimiento:</span>
                                <p className="text-slate-600 dark:text-slate-300 leading-snug">
                                  {s.plan_accion.compras_abastecimiento || 'Reposición balanceada según ROP.'}
                                </p>
                              </div>
                              <div>
                                <span className="font-bold text-[#00a2e8] block">🏷️ Política de Pricing:</span>
                                <p className="text-slate-600 dark:text-slate-300 leading-snug">
                                  {s.plan_accion.politica_pricing || 'Margen objetivo del 38%.'}
                                </p>
                              </div>
                              <div>
                                <span className="font-bold text-[#00a2e8] block">🚚 Logística &amp; Inventario:</span>
                                <p className="text-slate-600 dark:text-slate-300 leading-snug">
                                  {s.plan_accion.logistica_inventario || 'DOH objetivo de rotación continua.'}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Pestaña 2: Desglose por Centro de Costo (11 CCs) */}
                          {activeTabKey === 'centros' && (
                            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl space-y-1.5 border border-slate-200 dark:border-slate-700 max-h-56 overflow-y-auto text-[11px] animate-in fade-in">
                              <div className="flex justify-between font-bold text-slate-500 pb-1 border-b border-slate-200 dark:border-slate-700">
                                <span>Centro de Costo</span>
                                <span>Monto USD</span>
                              </div>
                              {(s.desglose_centros_costo || []).map((cc, ccIdx) => (
                                <div key={cc.centro_costo_id ?? `cc-scen-${ccIdx}`} className="py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-slate-700 dark:text-slate-200">
                                      {cc.nombre}
                                    </span>
                                    <span className="font-mono font-bold text-[#00a2e8]">
                                      {formatCurrency(cc.monto_sugerido)}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-400 line-clamp-1">
                                    {cc.justificacion}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Pestaña 3: Matriz de Riesgos y Mitigación */}
                          {activeTabKey === 'riesgos' && (
                            <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl space-y-2 border border-amber-200 dark:border-amber-900/40 text-[11px] animate-in fade-in">
                              {(s.riesgos_mitigacion || []).map((rm, idx) => (
                                <div key={idx} className="space-y-0.5">
                                  <span className="font-bold text-amber-700 dark:text-amber-400 block">
                                    ⚠️ {rm.riesgo}
                                  </span>
                                  <p className="text-slate-600 dark:text-slate-300 leading-snug">
                                    🛡️ {rm.mitigacion}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Botón de Acción Principal: Adoptar y Grabar Presupuesto */}
                        <button
                          type="button"
                          onClick={() => setSelectedScenarioForAdoption({ key, data: s })}
                          className={`w-full mt-2 py-2.5 px-4 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                            isBase
                              ? 'bg-gradient-to-r from-[#00a2e8] to-[#008ecb] hover:from-[#008ecb] text-white hover:shadow-bitrix-glow'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <Sparkles size={14} className={isBase ? 'text-amber-300' : 'text-[#00a2e8]'} />
                          <span>✨ Adoptar y Grabar Presupuesto Oficial</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Modal de Confirmación de Adopción Oficial */}
                {selectedScenarioForAdoption && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in zoom-in-95">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center space-x-2.5">
                          <span className="p-2 bg-sky-100 dark:bg-sky-950/60 text-[#00a2e8] rounded-xl">
                            <Sparkles size={20} />
                          </span>
                          <div>
                            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                              Adoptar y Grabar Presupuesto Oficial
                            </h3>
                            <p className="text-xs text-slate-500">
                              Período: <span className="font-bold text-[#00a2e8]">{currentPeriod}</span> • Escenario: <span className="font-bold uppercase">{selectedScenarioForAdoption.key}</span>
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedScenarioForAdoption(null)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 cursor-pointer"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                        <p>
                          Esta acción grabará formalmente en la base de datos (<code className="font-mono text-[#00a2e8]">presupuestos_centros_costo</code>) las siguientes <span className="font-bold text-slate-800 dark:text-slate-100">{selectedScenarioForAdoption.data.desglose_centros_costo.length} partidas de gasto operativo</span> con un monto consolidado de <span className="font-bold font-mono text-[#00a2e8]">{formatCurrency(selectedScenarioForAdoption.data.opex)}</span>:
                        </p>

                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto space-y-1.5">
                          {selectedScenarioForAdoption.data.desglose_centros_costo.map((cc, ccIdx) => (
                            <div key={cc.centro_costo_id ?? `adopt-cc-${ccIdx}`} className="flex justify-between items-center text-[11px] py-0.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                              <span className="text-slate-700 dark:text-slate-200">{cc.nombre}</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatCurrency(cc.monto_sugerido)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-center space-x-2">
                          <AlertTriangle size={16} className="shrink-0" />
                          <span>Si ya existen partidas para este período, los montos presupuestados serán actualizados de forma segura (Upsert).</span>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setSelectedScenarioForAdoption(null)}
                          disabled={isApplyingScenario}
                          className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmAdoptScenario}
                          disabled={isApplyingScenario}
                          className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#00a2e8] to-[#008ecb] hover:from-[#008ecb] rounded-xl shadow-sm hover:shadow-bitrix-glow flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                        >
                          <Check size={14} />
                          <span>{isApplyingScenario ? 'Grabando en Base de Datos...' : 'Confirmar y Grabar Presupuesto'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dictamen Cualitativo de IA */}
                {scenariosData?.analisis_ia && (
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
            selectedPeriod={currentPeriod}
            currentRole={currentRole}
          />
        )}

        {/* Pestaña: Estructura Organizacional: Áreas & Responsables */}
        {activeTab === 'organization' && (
          <OrganizationStructureView />
        )}

        {/* Pestaña: Compromisos Presupuestarios & Tareas IA */}
        {activeTab === 'commitments' && (
          <BudgetCommitmentsManager selectedPeriod={currentPeriod} />
        )}
      </div>
    </ErrorBoundary>
  );
};
