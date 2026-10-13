import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Briefcase, 
  RotateCw, 
  Download,
  Lightbulb,
  Globe,
  BarChart2,
  ShoppingBag
} from 'lucide-react';
import { apiService } from '../services/api';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { InitiativesStepper } from '../components/initiatives/InitiativesStepper';
import { ArbitrageOpportunityHunter } from '../components/initiatives/ArbitrageOpportunityHunter';
import type { 
  InitiativeEvaluationResponse, 
  EngineMode 
} from '../types';

interface InitiativesEvaluatorViewProps {
  engineMode?: EngineMode;
}

const sanitizeMarkdown = (raw?: string) => {
  if (!raw) return '';
  return raw
    .replace(/^```markdown\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
};

export const InitiativesEvaluatorView: React.FC<InitiativesEvaluatorViewProps> = ({ 
  engineMode = 'auto' 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'arbitrage_hunter' | 'stepper' | 'capex_standalone'>('arbitrage_hunter');

  // Estado Pestaña Opcional: Factibilidad Financiera Standalone
  const [initiativeName, setInitiativeName] = useState<string>('Línea Nueva: Colchones Premium Dual-Foam');
  const [initialInvestment, setInitialInvestment] = useState<number>(45000);
  const [estimatedUnitCost, setEstimatedUnitCost] = useState<number>(115);
  const [estimatedUnitPrice, setEstimatedUnitPrice] = useState<number>(240);
  const [expectedDemand, setExpectedDemand] = useState<number>(650);
  const [fixedCosts, setFixedCosts] = useState<number>(7500);
  const [competitorsNotes, setCompetitorsNotes] = useState<string>(
    'Competidor líder vende a $260 con 45 días de entrega; posibilidad de capturar 20% del mercado local con despacho en 72hs.'
  );
  const [evaluation, setEvaluation] = useState<InitiativeEvaluationResponse | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setErrorMsg(null);
    try {
      const res = await apiService.evaluateInitiative({
        initiative_name: initiativeName,
        initial_investment: initialInvestment,
        estimated_unit_cost: estimatedUnitCost,
        estimated_unit_price: estimatedUnitPrice,
        expected_demand: expectedDemand,
        fixed_costs: fixedCosts,
        competitors_notes: competitorsNotes,
      });
      setEvaluation(res);
    } catch (err: any) {
      console.error('Error evaluating initiative', err);
      setErrorMsg(err.response?.data?.detail || 'Error al procesar la evaluación financiera del proyecto.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExportFinancial = () => {
    if (!evaluation) return;
    const blob = new Blob([evaluation.raw_markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Business_Case_${initiativeName.replace(/\s+/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ErrorBoundary fallbackTitle="Error al cargar el Evaluador de Iniciativas">
      <div className="space-y-6">
        {/* Selector de Sub-Pestaña */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Briefcase size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#333333] dark:text-slate-100">
                Cockpit de Nuevos Proyectos &amp; Benchmarking de Mercado
              </h2>
              <p className="text-xs text-[#535c69] dark:text-slate-400">
                Flujo guiado en 3 fases: rastreo sin LLM, curaduría de competidores y evaluación cuantitativa.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setActiveSubTab('arbitrage_hunter')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeSubTab === 'arbitrage_hunter'
                  ? 'bg-white dark:bg-slate-700 text-[#00a2e8] dark:text-sky-300 shadow-xs'
                  : 'text-[#535c69] dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ShoppingBag size={13} />
              <span>Cazador MLU vs. Alibaba</span>
            </button>
            <button
              onClick={() => setActiveSubTab('stepper')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeSubTab === 'stepper'
                  ? 'bg-white dark:bg-slate-700 text-[#00a2e8] dark:text-sky-300 shadow-xs'
                  : 'text-[#535c69] dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Globe size={13} />
              <span>Flujo Guiado (3 Fases)</span>
            </button>
            <button
              onClick={() => setActiveSubTab('capex_standalone')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeSubTab === 'capex_standalone'
                  ? 'bg-white dark:bg-slate-700 text-[#00a2e8] dark:text-sky-300 shadow-xs'
                  : 'text-[#535c69] dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <BarChart2 size={13} />
              <span>Factibilidad Financiera Pura</span>
            </button>
          </div>
        </div>

        {/* SUBTAB 0: CAZADOR DE OPORTUNIDADES MLU VS ALIBABA */}
        {activeSubTab === 'arbitrage_hunter' && (
          <ArbitrageOpportunityHunter />
        )}

        {/* SUBTAB 1: STEPPER INTERACTIVO EN 3 FASES */}
        {activeSubTab === 'stepper' && (
          <InitiativesStepper engineMode={engineMode} />
        )}

        {/* SUBTAB 2: FACTIBILIDAD STANDALONE */}
        {activeSubTab === 'capex_standalone' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in">
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-[#333333] dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span>Parámetros del Business Case</span>
                <span className="text-[11px] text-[#00a2e8] font-normal">Inversión &amp; Proyección</span>
              </h3>

              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">Nombre de la Iniciativa</label>
                  <input
                    type="text"
                    value={initiativeName}
                    onChange={(e) => setInitiativeName(e.target.value)}
                    className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">Inversión Inicial CAPEX ($)</label>
                    <input
                      type="number"
                      min="0"
                      value={initialInvestment}
                      onChange={(e) => setInitialInvestment(Number(e.target.value))}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">Costos Fijos Asignados ($)</label>
                    <input
                      type="number"
                      min="0"
                      value={fixedCosts}
                      onChange={(e) => setFixedCosts(Number(e.target.value))}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">Costo Unitario ($)</label>
                    <input
                      type="number"
                      min="0"
                      value={estimatedUnitCost}
                      onChange={(e) => setEstimatedUnitCost(Number(e.target.value))}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">Precio Target ($)</label>
                    <input
                      type="number"
                      min="0"
                      value={estimatedUnitPrice}
                      onChange={(e) => setEstimatedUnitPrice(Number(e.target.value))}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">Demanda Mensual</label>
                    <input
                      type="number"
                      min="1"
                      value={expectedDemand}
                      onChange={(e) => setExpectedDemand(Number(e.target.value))}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">Análisis de Competencia</label>
                  <textarea
                    rows={3}
                    value={competitorsNotes}
                    onChange={(e) => setCompetitorsNotes(e.target.value)}
                    className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                    placeholder="Ingresa notas cualitativas de mercado..."
                  />
                </div>
              </div>

              <button
                onClick={handleEvaluate}
                disabled={isEvaluating}
                className="w-full py-2.5 px-4 bg-[#00a2e8] hover:bg-[#008ecb] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                <RotateCw size={14} className={isEvaluating ? 'animate-spin' : ''} />
                <span>{isEvaluating ? 'Calculando y Evaluando con IA...' : 'Ejecutar Evaluación de Factibilidad'}</span>
              </button>
            </div>

            <div className="lg:col-span-7 space-y-4">
              {evaluation ? (
                <div className="space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                      <span className="text-[10px] text-[#535c69] dark:text-slate-400 uppercase font-semibold block">Margen Unitario</span>
                      <span className="text-base font-bold font-mono text-[#2ecc71]">
                        ${Number(evaluation.unit_contribution_margin).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {(Number(evaluation.marginal_ratio) * 100).toFixed(1)}% ratio
                      </span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                      <span className="text-[10px] text-[#535c69] dark:text-slate-400 uppercase font-semibold block">Punto Equilibrio</span>
                      <span className="text-base font-bold font-mono text-slate-800 dark:text-slate-100">
                        {evaluation.break_even_units.toLocaleString()} un.
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        ${Number(evaluation.break_even_revenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                      <span className="text-[10px] text-[#535c69] dark:text-slate-400 uppercase font-semibold block">Payback Estimado</span>
                      <span className="text-base font-bold font-mono text-[#00a2e8]">
                        {Number(evaluation.payback_cycles).toFixed(1)} meses
                      </span>
                      <span className="text-[10px] text-slate-400 block">Período de repago</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                      <span className="text-[10px] text-[#535c69] dark:text-slate-400 uppercase font-semibold block">Dictamen / ROI</span>
                      <span className={`text-base font-bold font-mono ${
                        evaluation.viability === 'Factible' ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {(Number(evaluation.roi_pct) * 100).toFixed(1)}%
                      </span>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block uppercase">
                        {evaluation.viability}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center space-x-2">
                        <span className="p-1.5 bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] rounded-lg">
                          <Lightbulb size={16} />
                        </span>
                        <h4 className="font-bold text-xs text-[#333333] dark:text-slate-100">Dictamen Financiero &amp; Sensibilidad</h4>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-mono text-slate-400">{evaluation.latency_ms} ms</span>
                        <button
                          onClick={handleExportFinancial}
                          className="p-1 text-slate-400 hover:text-[#00a2e8] transition-colors cursor-pointer"
                          title="Exportar Markdown"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-[#f8fafc] dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800 font-sans prose prose-slate dark:prose-invert max-w-none">
                      <ReactMarkdown>
                        {sanitizeMarkdown(evaluation.raw_markdown)}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[300px] bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                  <Briefcase size={36} className="text-slate-300 dark:text-slate-600" />
                  <h4 className="font-semibold text-sm text-[#333333] dark:text-slate-200">Sin Evaluación en Curso</h4>
                  <p className="text-xs text-[#535c69] dark:text-slate-400 max-w-sm">
                    Completa los supuestos de inversión, costos y precios en el panel izquierdo y haz clic en "Ejecutar Evaluación de Factibilidad".
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};
