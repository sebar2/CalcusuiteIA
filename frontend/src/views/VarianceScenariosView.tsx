import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  TrendingDown, 
  TrendingUp,
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Building2,
  Users,
  Send,
  RefreshCw,
  Bot,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Check,
  X,
  PlusCircle
} from 'lucide-react';
import {
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';
import type { 
  UserRole,
  EngineMode,
  FpaSummaryResponse,
  FpaCostCenterSummary,
  FpaCopilotResponse,
  BudgetScenarioResponse
} from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { CostCentersBudgetGrid } from '../components/budget/CostCentersBudgetGrid';
import { OrganizationStructureView } from '../components/organization/OrganizationStructureView';
import { BudgetCommitmentsManager } from '../components/budget/BudgetCommitmentsManager';
import { apiService } from '../services/api';

interface VarianceScenariosViewProps {
  selectedPeriod: string;
  selectedCategory?: string;
  currentRole?: UserRole;
  engineMode?: EngineMode;
}

export const VarianceScenariosView: React.FC<VarianceScenariosViewProps> = ({
  selectedPeriod,
  selectedCategory: _selectedCategory,
  currentRole = 'controller_admin',
  engineMode: _engineMode,
}) => {
  // 4 Pestañas Principales Solicitadas
  const [activeTab, setActiveTab] = useState<'execution' | 'projections' | 'governance' | 'copilot'>('execution');
  
  // Estado general de período y resumen FP&A
  const [currentPeriod, setCurrentPeriod] = useState<string>(selectedPeriod || '2025-09');
  const [availablePeriods, setAvailablePeriods] = useState<string[]>(['2025-09', '2026-07', '2026-08', '2026-09', '2026-10']);
  const [fpaSummary, setFpaSummary] = useState<FpaSummaryResponse | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Sub-vistas y toggles
  const [viewModeTab1, setViewModeTab1] = useState<'matrix' | 'grid'>('matrix');
  const [expandedCCId, setExpandedCCId] = useState<number | null>(null);

  // Modal para Asignar Presupuesto / Nueva Partida OPEX
  const [showBudgetModal, setShowBudgetModal] = useState<boolean>(false);
  const [newCCId, setNewCCId] = useState<number>(0);
  const [newConcepto, setNewConcepto] = useState<string>('');
  const [newMontoPresupuestado, setNewMontoPresupuestado] = useState<number>(0);
  const [isSavingBudget, setIsSavingBudget] = useState<boolean>(false);

  // Modal para Editar Responsable y Alertas en Gobernanza
  const [editingCC, setEditingCC] = useState<FpaCostCenterSummary | null>(null);
  const [editResponsable, setEditResponsable] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editAlerta85, setEditAlerta85] = useState<boolean>(true);
  const [editAlerta100, setEditAlerta100] = useState<boolean>(true);
  const [isSavingGovernance, setIsSavingGovernance] = useState<boolean>(false);
  const [governanceSubTab, setGovernanceSubTab] = useState<'centros' | 'organizacion' | 'compromisos'>('centros');

  // Estado del Copiloto FP&A
  const [copilotPrompt, setCopilotPrompt] = useState<string>('');
  const [copilotResponse, setCopilotResponse] = useState<FpaCopilotResponse | null>(null);
  const [isLoadingCopilot, setIsLoadingCopilot] = useState<boolean>(false);

  // Estado de los 3 Escenarios Presupuestarios (Conservador, Base, Agresivo)
  const [scenariosData, setScenariosData] = useState<BudgetScenarioResponse | null>(null);
  const [isGeneratingScenarios, setIsGeneratingScenarios] = useState<boolean>(false);

  // Sincronizar período de props
  useEffect(() => {
    if (selectedPeriod) setCurrentPeriod(selectedPeriod);
  }, [selectedPeriod]);

  // Cargar períodos disponibles
  useEffect(() => {
    apiService.getAvailablePeriods().then((res) => {
      if (res.periods && res.periods.length > 0) {
        const combined = Array.from(new Set(['2025-09', ...res.periods]));
        setAvailablePeriods(combined);
      }
    }).catch(() => {});
  }, []);

  // Cargar resumen de FP&A consolidado desde backend
  const fetchSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    setSummaryError(null);
    try {
      const data = await apiService.getFpaSummary(currentPeriod);
      setFpaSummary(data);
    } catch (err: any) {
      console.error('Error fetching FPA summary:', err);
      setSummaryError(err.response?.data?.detail || 'No se pudo cargar el resumen financiero FP&A.');
    } finally {
      setIsLoadingSummary(false);
    }
  }, [currentPeriod]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Guardar nueva partida OPEX
  const handleSaveBudgetLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCCId || !newConcepto.trim() || newMontoPresupuestado <= 0) {
      alert('Por favor complete el centro de costo, concepto y monto presupuestado.');
      return;
    }

    setIsSavingBudget(true);
    try {
      await apiService.saveFpaBudgetLine({
        centro_costo_id: newCCId,
        periodo: currentPeriod,
        concepto_opex: newConcepto.trim(),
        monto_presupuestado: newMontoPresupuestado,
      });
      setShowBudgetModal(false);
      setNewConcepto('');
      setNewMontoPresupuestado(0);
      await fetchSummary();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error al guardar la partida presupuestaria.');
    } finally {
      setIsSavingBudget(false);
    }
  };

  // Guardar cambios de gobernanza
  const handleSaveGovernance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCC) return;

    setIsSavingGovernance(true);
    try {
      await apiService.updateFpaGovernance({
        centro_costo_id: editingCC.id,
        responsable: editResponsable,
        email_notificacion: editEmail,
        alerta_85_activa: editAlerta85,
        alerta_100_activa: editAlerta100,
      });
      setEditingCC(null);
      await fetchSummary();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error al actualizar gobernanza.');
    } finally {
      setIsSavingGovernance(false);
    }
  };

  // Consultar Copiloto FP&A
  const handleAskCopilot = async (promptText?: string) => {
    const query = promptText || copilotPrompt;
    if (!query.trim()) return;

    setIsLoadingCopilot(true);
    try {
      const res = await apiService.askFpaCopilot(query, currentPeriod);
      setCopilotResponse(res);
      if (!promptText) setCopilotPrompt('');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error al consultar al Copiloto FP&A.');
    } finally {
      setIsLoadingCopilot(false);
    }
  };

  // Generar 3 Escenarios Presupuestarios (Conservador, Base, Agresivo)
  const handleGenerateScenarios = async () => {
    setIsGeneratingScenarios(true);
    try {
      const res = await apiService.getBudgetScenarios({ target_period: currentPeriod });
      setScenariosData(res);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error al generar escenarios presupuestarios.');
    } finally {
      setIsGeneratingScenarios(false);
    }
  };

  // Datos para gráficos de flujo proyectado
  const projectionChartData = [
    {
      name: 'Actual',
      saldo: fpaSummary?.caja_actual || 1850000,
      ingresos: 0,
      egresos: 0,
    },
    {
      name: '+30 Días',
      saldo: fpaSummary?.proyecciones?.dias_30?.saldo_proyectado || 1876600,
      ingresos: fpaSummary?.proyecciones?.dias_30?.ingresos_est || 245000,
      egresos: fpaSummary?.proyecciones?.dias_30?.egresos_est || 218400,
    },
    {
      name: '+60 Días',
      saldo: fpaSummary?.proyecciones?.dias_60?.saldo_proyectado || 1908200,
      ingresos: fpaSummary?.proyecciones?.dias_60?.ingresos_est || 495000,
      egresos: fpaSummary?.proyecciones?.dias_60?.egresos_est || 436800,
    },
    {
      name: '+90 Días',
      saldo: fpaSummary?.proyecciones?.dias_90?.saldo_proyectado || 1954800,
      ingresos: fpaSummary?.proyecciones?.dias_90?.ingresos_est || 760000,
      egresos: fpaSummary?.proyecciones?.dias_90?.egresos_est || 655200,
    },
  ];

  // Helper de semáforo visual
  const getSemaforoBadge = (sem: string, pct: number) => {
    if (sem === 'VERDE') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 size={13} />
          <span>Alineado ({pct > 0 ? `+${pct}%` : `${pct}%`})</span>
        </span>
      );
    }
    if (sem === 'AMARILLO') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          <AlertTriangle size={13} />
          <span>Atención ({pct > 0 ? `+${pct}%` : `${pct}%`})</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
        <TrendingDown size={13} />
        <span>Desvío Crítico ({pct > 0 ? `+${pct}%` : `${pct}%`})</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* HEADER SUPERIOR & SELECTOR DE PERÍODO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
              <BarChart3 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Finanzas & Control FP&A
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sincronización Transaccional Contabilidad ➔ Centros de Costo OPEX & Copiloto IA
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Calendar size={15} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Período:</span>
            <select
              value={currentPeriod}
              onChange={(e) => setCurrentPeriod(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {availablePeriods.map((p) => (
                <option key={p} value={p} className="dark:bg-slate-900">
                  {p}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchSummary}
            disabled={isLoadingSummary}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
            title="Refrescar datos contables"
          >
            <RefreshCw size={14} className={isLoadingSummary ? 'animate-spin' : ''} />
            <span>Refrescar</span>
          </button>

          <button
            onClick={() => {
              if (fpaSummary?.centros_costo && fpaSummary.centros_costo.length > 0) {
                setNewCCId(fpaSummary.centros_costo[0].id);
              }
              setShowBudgetModal(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <PlusCircle size={14} />
            <span>Nueva Partida OPEX</span>
          </button>
        </div>
      </div>

      {/* 4 PESTAÑAS PRINCIPALES */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('execution')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'execution'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart3 size={16} />
          <span>📊 Control de Ejecución (Real vs. Budget)</span>
        </button>

        <button
          onClick={() => setActiveTab('projections')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'projections'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp size={16} />
          <span>🔮 Proyecciones Financieras & Runway (IA)</span>
        </button>

        <button
          onClick={() => setActiveTab('governance')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'governance'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 size={16} />
          <span>🏢 Gobernanza & Responsables</span>
        </button>

        <button
          onClick={() => setActiveTab('copilot')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'copilot'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bot size={16} />
          <span>🤖 Copiloto FP&A & Auditoría</span>
        </button>
      </div>

      {summaryError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
          ⚠️ {summaryError}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 1: CONTROL DE EJECUCIÓN (REAL VS. BUDGET) */}
      {/* ========================================================================= */}
      {activeTab === 'execution' && (
        <div className="space-y-6">
          {/* TARJETAS SUPERIORES DE KPI */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard
              title="OPEX Presupuestado"
              value={`$${(fpaSummary?.presupuesto_total || 220000).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon={Calendar}
              subtitle={`Budget Aprobado ${currentPeriod}`}
            />
            <MetricCard
              title="OPEX Real Ejecutado"
              value={`$${(fpaSummary?.real_ejecutado_total || 218400).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon={DollarSign}
              subtitle="Contabilidad & Libro Diario"
            />
            <MetricCard
              title="Desvío Neto ($)"
              value={`$${(fpaSummary?.desvio_neto || -1600).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon={(fpaSummary?.desvio_neto || -1600) <= 0 ? TrendingDown : TrendingUp}
              trend={{
                value: `${fpaSummary?.desvio_porcentual || -0.73}%`,
                positive: (fpaSummary?.desvio_neto || -1600) <= 0,
                label: (fpaSummary?.desvio_neto || -1600) <= 0 ? 'Ahorro / Superávit' : 'Sobregasto Operativo'
              }}
              subtitle={(fpaSummary?.desvio_neto || -1600) <= 0 ? 'Ahorro / Superávit' : 'Sobregasto Operativo'}
            />
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Desvío % & Semáforo</span>
                {getSemaforoBadge(fpaSummary?.semaforo || 'VERDE', fpaSummary?.desvio_porcentual || -0.73)}
              </div>
              <div className="my-2">
                <span className={`text-2xl font-bold ${
                  (fpaSummary?.desvio_porcentual || -0.73) <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {(fpaSummary?.desvio_porcentual || -0.73) > 0 ? `+${fpaSummary?.desvio_porcentual}%` : `${fpaSummary?.desvio_porcentual || -0.73}%`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tolerancia Contable: ±{fpaSummary?.tolerancia_pct || 5.0}%
              </p>
            </div>
          </div>

          {/* SELECTOR DE VISTA DE TABLA */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Desglose Matricial por Centros de Costo
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                {fpaSummary?.centros_costo?.length || 6} Centros Activos
              </span>
            </div>

            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewModeTab1('matrix')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewModeTab1 === 'matrix' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-500'
                }`}
              >
                Matriz Ejecutiva & Barras
              </button>
              <button
                onClick={() => setViewModeTab1('grid')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewModeTab1 === 'grid' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-500'
                }`}
              >
                Grilla Detallada Contable
              </button>
            </div>
          </div>

          {/* VISTA 1: MATRIZ EJECUTIVA CON BARRAS DE PROGRESO */}
          {viewModeTab1 === 'matrix' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(fpaSummary?.centros_costo || []).map((cc) => {
                const isExpanded = expandedCCId === cc.id;
                const pct = cc.porcentaje_consumido;
                
                // Color de barra dinámico
                let barColor = 'bg-emerald-500';
                if (pct > 100) barColor = 'bg-rose-500';
                else if (pct >= 85) barColor = 'bg-amber-500';

                return (
                  <div
                    key={cc.id}
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {cc.codigo}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {cc.nombre}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center space-x-1">
                          <Users size={12} />
                          <span>Responsable: {cc.responsable}</span>
                        </p>
                      </div>

                      <div className="text-right">
                        {cc.alerta_temprana === 'CRITICAL_100' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300">
                            Exceso &gt;100%
                          </span>
                        )}
                        {cc.alerta_temprana === 'WARNING_85' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300">
                            Alerta 85%
                          </span>
                        )}
                        {cc.alerta_temprana === 'OK' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300">
                            En Meta
                          </span>
                        )}
                      </div>
                    </div>

                    {/* VALORES DE EJECUCIÓN */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Presupuestado</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          ${cc.presupuesto.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Real Ejecutado</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          ${cc.real_ejecutado.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Desvío</span>
                        <span className={`font-semibold ${cc.desvio_neto <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {cc.desvio_neto <= 0 ? `-$${Math.abs(cc.desvio_neto).toFixed(0)}` : `+$${cc.desvio_neto.toFixed(0)}`}
                        </span>
                      </div>
                    </div>

                    {/* BARRA DE PROGRESO */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        <span>Consumo de Presupuesto</span>
                        <span className="font-bold">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} transition-all duration-500`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* BOTÓN VER PARTIDAS ASOCIADAS */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => setExpandedCCId(isExpanded ? null : cc.id)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 py-1 cursor-pointer"
                      >
                        <span className="flex items-center space-x-1.5">
                          <FileText size={13} />
                          <span>Partidas Contables Asociadas ({cc.partidas?.length || 0})</span>
                        </span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      {/* DRILL-DOWN ACORDEÓN DE PARTIDAS */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                          {(!cc.partidas || cc.partidas.length === 0) ? (
                            <p className="text-[11px] text-slate-400 italic py-2">No hay partidas registradas en el período.</p>
                          ) : (
                            cc.partidas.map((p, idx) => (
                              <div
                                key={p.id || idx}
                                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 text-[11px]"
                              >
                                <div className="space-y-0.5">
                                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                                    {p.concepto}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center space-x-2">
                                    <span>{p.fecha}</span>
                                    <span>•</span>
                                    <span>{p.proveedor}</span>
                                    <span>•</span>
                                    <span className="font-mono">{p.comprobante}</span>
                                  </div>
                                </div>
                                <div className="font-mono font-bold text-slate-900 dark:text-white">
                                  ${p.monto.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VISTA 2: GRILLA DETALLADA CONTABLE (COMPONENTE EXISTENTE) */}
          {viewModeTab1 === 'grid' && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <CostCentersBudgetGrid
                selectedPeriod={currentPeriod}
                currentRole={currentRole}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: PROYECCIONES FINANCIERAS & RUNWAY (IA) */}
      {/* ========================================================================= */}
      {activeTab === 'projections' && (
        <div className="space-y-6">
          {/* TARJETAS DE LIQUIDEZ Y RUNWAY */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard
              title="Caja Actual Líquida"
              value={`$${(fpaSummary?.caja_actual || 1850000).toLocaleString(undefined, { minimumFractionDigits: 2 })} UYU`}
              icon={DollarSign}
              subtitle="Saldo en Cuentas BROU / Caja"
            />
            <MetricCard
              title="Burn Rate Mensual"
              value={`$${(fpaSummary?.burn_rate_mensual || 218400).toLocaleString(undefined, { minimumFractionDigits: 2 })} UYU`}
              icon={TrendingDown}
              subtitle="Gasto OPEX Real Mensual"
            />
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Runway Operacional</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  Estable &gt; 6m
                </span>
              </div>
              <div className="my-2">
                <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                  {fpaSummary?.runway_meses || 8.5} <span className="text-sm font-semibold text-slate-500">meses</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Caja Actual / Burn Rate</p>
            </div>
            <MetricCard
              title="Ciclo CCC"
              value={`${fpaSummary?.proyecciones?.ccc_dias || 42.5} Días`}
              icon={Clock}
              subtitle={`DSO: ${fpaSummary?.proyecciones?.dso_dias || 35}d | DIO: ${fpaSummary?.proyecciones?.dio_dias || 45}d | DPO: ${fpaSummary?.proyecciones?.dpo_dias || 37.5}d`}
            />
          </div>

          {/* GRÁFICO DE TENDENCIA Y ESTIMACIÓN DE CAJA */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <TrendingUp size={16} className="text-blue-500" />
                  <span>Proyección de Flujo de Fondos & Liquidez (30, 60 y 90 Días)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Estimación basada en Ciclo de Conversión de Efectivo (CCC), cuentas por cobrar y compromisos OPEX.
                </p>
              </div>

              <button
                onClick={handleGenerateScenarios}
                disabled={isGeneratingScenarios}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
              >
                <Sparkles size={14} className={isGeneratingScenarios ? 'animate-spin' : ''} />
                <span>Simular 3 Escenarios IA</span>
              </button>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: any) => [`$${Number(val).toLocaleString()} UYU`, '']}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="saldo"
                    name="Saldo de Caja Proyectado ($)"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSaldo)"
                  />
                  <Bar dataKey="ingresos" name="Ingresos Cobranzas ($)" fill="#10b981" />
                  <Bar dataKey="egresos" name="Egresos OPEX ($)" fill="#ef4444" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* TABLA DE DETALLE 30 / 60 / 90 DÍAS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white block mb-1">
                  Horizonte 30 Días
                </span>
                <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                  ${fpaSummary?.proyecciones?.dias_30?.saldo_proyectado.toLocaleString()} UYU
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                  <span>Flujo Neto:</span>
                  <span className="font-semibold text-emerald-600">+${fpaSummary?.proyecciones?.dias_30?.flujo_neto.toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white block mb-1">
                  Horizonte 60 Días
                </span>
                <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                  ${fpaSummary?.proyecciones?.dias_60?.saldo_proyectado.toLocaleString()} UYU
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                  <span>Flujo Neto Acum:</span>
                  <span className="font-semibold text-emerald-600">+${fpaSummary?.proyecciones?.dias_60?.flujo_neto.toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white block mb-1">
                  Horizonte 90 Días
                </span>
                <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                  ${fpaSummary?.proyecciones?.dias_90?.saldo_proyectado.toLocaleString()} UYU
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                  <span>Flujo Neto Acum:</span>
                  <span className="font-semibold text-emerald-600">+${fpaSummary?.proyecciones?.dias_90?.flujo_neto.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* SECCIÓN ESCENARIOS IA SI FUERON GENERADOS */}
            {scenariosData && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl mt-4 space-y-2">
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center space-x-1.5">
                  <Sparkles size={14} />
                  <span>Escenarios FP&A Proyectados (Ollama Contable)</span>
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Escenario Base proyectado con OPEX controlado y punto de reorden optimizado.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: GOBERNANZA & RESPONSABLES */}
      {/* ========================================================================= */}
      {activeTab === 'governance' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Gobernanza Presupuestaria & Umbrales de Alerta Temprana
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Asignación de propietarios por Centro de Costo y reglas automáticas de notificación preventiva.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setGovernanceSubTab('centros')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  governanceSubTab === 'centros' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                }`}
              >
                Centros de Costo
              </button>
              <button
                onClick={() => setGovernanceSubTab('organizacion')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  governanceSubTab === 'organizacion' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                }`}
              >
                Estructura Organizacional (BCNF)
              </button>
              <button
                onClick={() => setGovernanceSubTab('compromisos')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  governanceSubTab === 'compromisos' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                }`}
              >
                Compromisos de Gasto
              </button>
            </div>
          </div>

          {governanceSubTab === 'centros' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">Código</th>
                      <th className="p-3.5">Centro de Costo</th>
                      <th className="p-3.5">Responsable Asignado</th>
                      <th className="p-3.5">Email Notificación</th>
                      <th className="p-3.5 text-center">Alerta 85%</th>
                      <th className="p-3.5 text-center">Alerta 100%</th>
                      <th className="p-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(fpaSummary?.centros_costo || []).map((cc) => (
                      <tr key={cc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {cc.codigo}
                        </td>
                        <td className="p-3.5 font-semibold text-slate-900 dark:text-white">
                          {cc.nombre}
                        </td>
                        <td className="p-3.5 text-slate-700 dark:text-slate-300">
                          {cc.responsable}
                        </td>
                        <td className="p-3.5 text-slate-500 font-mono text-[11px]">
                          {cc.email_notificacion || `${cc.codigo.toLowerCase()}@calcu.com.uy`}
                        </td>
                        <td className="p-3.5 text-center">
                          {cc.alerta_85_activa ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                              Activa
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">
                              Inactiva
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          {cc.alerta_100_activa ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                              Activa
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">
                              Inactiva
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => {
                              setEditingCC(cc);
                              setEditResponsable(cc.responsable);
                              setEditEmail(cc.email_notificacion || `${cc.codigo.toLowerCase()}@calcu.com.uy`);
                              setEditAlerta85(cc.alerta_85_activa);
                              setEditAlerta100(cc.alerta_100_activa);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition cursor-pointer"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {governanceSubTab === 'organizacion' && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <OrganizationStructureView />
            </div>
          )}

          {governanceSubTab === 'compromisos' && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <BudgetCommitmentsManager selectedPeriod={currentPeriod} />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 4: COPILOTO FP&A & AUDITORÍA */}
      {/* ========================================================================= */}
      {activeTab === 'copilot' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900">
                <Bot size={24} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Copiloto Financiero FP&A & Auditor Forense Contable
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Auditoría inteligente del Libro Diario, detección de anomalías en facturas y sugerencias de recortes OPEX.
                </p>
              </div>
            </div>

            {/* BOTONES DE AUDITORÍA RÁPIDA */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => handleAskCopilot('Auditar Libro Diario, balance de asientos y desvíos presupuestarios')}
                disabled={isLoadingCopilot}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center space-x-1.5 cursor-pointer"
              >
                <span>🔍 Auditar Libro Diario</span>
              </button>
              <button
                onClick={() => handleAskCopilot('Detectar posibles duplicaciones de gastos o facturas de proveedores')}
                disabled={isLoadingCopilot}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center space-x-1.5 cursor-pointer"
              >
                <span>⚠️ Detectar Duplicaciones</span>
              </button>
              <button
                onClick={() => handleAskCopilot('Sugerir recortes de OPEX inmediatos por centro de costo basados en márgenes')}
                disabled={isLoadingCopilot}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center space-x-1.5 cursor-pointer"
              >
                <span>✂️ Sugerir Recortes OPEX</span>
              </button>
              <button
                onClick={() => handleAskCopilot('Calcular impacto en runway de caja ante caída de ventas del 15%')}
                disabled={isLoadingCopilot}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition flex items-center space-x-1.5 cursor-pointer"
              >
                <span>🛡️ Simular Estrés de Caja</span>
              </button>
            </div>

            {/* INPUT DE CONSULTA LIBRE */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskCopilot();
              }}
              className="flex items-center space-x-2 pt-2"
            >
              <input
                type="text"
                value={copilotPrompt}
                onChange={(e) => setCopilotPrompt(e.target.value)}
                placeholder="Escribe una consulta para el Copiloto FP&A (ej. ¿Qué centro de costo tiene mayor sobregasto?)..."
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={isLoadingCopilot || !copilotPrompt.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
              >
                {isLoadingCopilot ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                <span>Auditar</span>
              </button>
            </form>

            {/* RESULTADOS DEL COPILOTO */}
            {copilotResponse && (
              <div className="mt-6 space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                {/* ANOMALÍAS DETECTADAS */}
                {copilotResponse.anomalies && copilotResponse.anomalies.length > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center space-x-1.5">
                      <AlertTriangle size={14} />
                      <span>Anomalías Forenses Detectadas en Contabilidad</span>
                    </h4>
                    <ul className="text-xs space-y-1 text-amber-700 dark:text-amber-400">
                      {copilotResponse.anomalies.map((anom, idx) => (
                        <li key={idx} className="flex items-start space-x-1.5">
                          <span>•</span>
                          <span>{anom}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* RECORTES SUGERIDOS */}
                {copilotResponse.suggested_cuts && copilotResponse.suggested_cuts.length > 0 && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-2">
                    <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                      <Sparkles size={14} />
                      <span>
                        Plan de Recortes Estratégicos (Extensión de Runway a {copilotResponse.runway_proyectado_con_ahorros} meses)
                      </span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                      {copilotResponse.suggested_cuts.map((cut, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900 text-xs flex justify-between items-center"
                        >
                          <div>
                            <span className="font-mono font-bold text-emerald-600 block">{cut.centro_costo}</span>
                            <span className="text-slate-600 dark:text-slate-400">{cut.concepto}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-emerald-600">-${cut.ahorro_estimado_uyu.toLocaleString()} UYU</span>
                            <span className="text-[10px] text-slate-400 block">Impacto: {cut.impacto}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TEXTO COMPLETO DEL INFORME */}
                <div className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans">
                  {copilotResponse.analysis}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NUEVA PARTIDA OPEX / ASIGNAR PRESUPUESTO */}
      {/* ========================================================================= */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <PlusCircle size={16} className="text-blue-600" />
                <span>Asignar Presupuesto / Partida OPEX</span>
              </h3>
              <button
                onClick={() => setShowBudgetModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveBudgetLine} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Centro de Costo Destino
                </label>
                <select
                  value={newCCId}
                  onChange={(e) => setNewCCId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                >
                  {(fpaSummary?.centros_costo || []).map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.codigo} - {cc.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Concepto de Gasto OPEX
                </label>
                <input
                  type="text"
                  value={newConcepto}
                  onChange={(e) => setNewConcepto(e.target.value)}
                  placeholder="ej. Mantenimiento Preventivo Servidores Cloud"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Monto Presupuestado ($ UYU)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={newMontoPresupuestado || ''}
                  onChange={(e) => setNewMontoPresupuestado(Number(e.target.value))}
                  placeholder="ej. 25000"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  required
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingBudget}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  {isSavingBudget ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Guardar Partida</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR GOBERNANZA & ALERTAS */}
      {/* ========================================================================= */}
      {editingCC && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Building2 size={16} className="text-blue-600" />
                <span>Gobernanza: {editingCC.codigo}</span>
              </h3>
              <button
                onClick={() => setEditingCC(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveGovernance} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Responsable Asignado
                </label>
                <input
                  type="text"
                  value={editResponsable}
                  onChange={(e) => setEditResponsable(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email de Notificación
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono"
                  required
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editAlerta85}
                    onChange={(e) => setEditAlerta85(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Alerta Preventiva Temprana al 85% de ejecución
                  </span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editAlerta100}
                    onChange={(e) => setEditAlerta100(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Alerta Crítica al 100% (Bloqueo de nuevas compras)
                  </span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCC(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingGovernance}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition flex items-center space-x-1 cursor-pointer"
                >
                  {isSavingGovernance ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Guardar Gobernanza</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VarianceScenariosView;
