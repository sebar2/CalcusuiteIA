import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Sparkles, 
  BrainCircuit, 
  Save, 
  FileEdit, 
  AlertCircle,
  RotateCw,
  TrendingUp,
  Trash2
} from 'lucide-react';
import { apiService } from '../../services/api';
import { AIBudgetReviewModal } from './AIBudgetReviewModal';
import { CreatableCategorySelect } from '../common/CreatableCategorySelect';
import type { 
  BudgetManualItem, 
  BudgetCategorySuggestion, 
  EngineMode 
} from '../../types';

interface BudgetEmptyStateProps {
  periodo: string;
  engineMode?: EngineMode;
  onRefresh: () => void;
}

interface ManualRow {
  categoria_id: number;
  categoria_nombre: string;
  monto: number;
  unidades: number;
}

export const BudgetEmptyState: React.FC<BudgetEmptyStateProps> = ({
  periodo,
  engineMode: _engineMode = 'auto',
  onRefresh,
}) => {
  const [activeMode, setActiveMode] = useState<'hub' | 'manual'>('hub');
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isSuggestingAI, setIsSuggestingAI] = useState(false);
  const [isSeedingHistory, setIsSeedingHistory] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estado para Modal de IA
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<BudgetCategorySuggestion[]>([]);
  const [aiRationale, setAiRationale] = useState<string>('');
  const [allCategories, setAllCategories] = useState<string[]>([]);

  // Cargar categorías disponibles para la grilla manual
  useEffect(() => {
    apiService.getCategories()
      .then((cats) => {
        if (cats && cats.length > 0) {
          setAllCategories(cats);
          setManualRows(
            cats.map((c, idx) => ({
              categoria_id: idx + 1,
              categoria_nombre: c,
              monto: 10000,
              unidades: 200,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const handleAddCategoryRow = (catName: string) => {
    if (!catName.trim()) return;
    if (!allCategories.includes(catName)) {
      setAllCategories((prev) => [...prev, catName]);
    }
    if (manualRows.some((r) => r.categoria_nombre.toLowerCase() === catName.toLowerCase())) {
      return;
    }
    setManualRows((prev) => [
      ...prev,
      {
        categoria_id: prev.length + 1,
        categoria_nombre: catName,
        monto: 10000,
        unidades: 200,
      },
    ]);
  };

  const handleRemoveRow = (idx: number) => {
    setManualRows((prev) => prev.filter((_, i) => i !== idx));
  };

  // Opción A: Guardar Grilla Manual
  const handleSaveManualBatch = async () => {
    setIsSavingManual(true);
    setErrorMessage(null);
    try {
      const items: BudgetManualItem[] = manualRows.map((r) => ({
        categoria_id: r.categoria_id,
        categoria_nombre: r.categoria_nombre,
        monto_presupuestado: Number(r.monto),
        unidades_presupuestadas: Number(r.unidades),
      }));

      await apiService.saveBudgetManualBatch({
        periodo,
        version: 'V0_Manual',
        items,
      });

      setSuccessMessage('Presupuesto base manual guardado con éxito.');
      onRefresh();
    } catch (err: any) {
      console.error('Error saving manual budget batch', err);
      setErrorMessage(err.response?.data?.detail || 'Error al persistir presupuesto manual.');
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleManualRowChange = (index: number, field: 'monto' | 'unidades', val: number) => {
    setManualRows((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: val >= 0 ? val : 0,
      };
      return copy;
    });
  };

  // Opción B: Sugerencia con IA
  const handleRequestAISuggestions = async () => {
    setIsSuggestingAI(true);
    setErrorMessage(null);
    try {
      const res = await apiService.getAIBudgetSuggestions(periodo);
      setAiSuggestions(res.suggestions || []);
      setAiRationale(res.analisis_resumen || '');
      setIsAIModalOpen(true);
    } catch (err: any) {
      console.error('Error fetching AI budget suggestions', err);
      setErrorMessage(err.response?.data?.detail || 'Error al invocar la sugerencia de IA para presupuestos.');
    } finally {
      setIsSuggestingAI(false);
    }
  };

  // Opción C: Autosembrado Rápido (+5%)
  const handleSeedHistory = async () => {
    setIsSeedingHistory(true);
    setErrorMessage(null);
    try {
      const res = await apiService.seedBudgetFromActuals(periodo);
      setSuccessMessage(res.message);
      onRefresh();
    } catch (err: any) {
      console.error('Error seeding history', err);
      setErrorMessage(err.response?.data?.detail || 'Error al autogenerar presupuesto base desde ventas históricas.');
    } finally {
      setIsSeedingHistory(false);
    }
  };

  const totalManualMonto = manualRows.reduce((acc, r) => acc + (Number(r.monto) || 0), 0);
  const totalManualUnidades = manualRows.reduce((acc, r) => acc + (Number(r.unidades) || 0), 0);

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center space-x-2">
          <AlertCircle size={15} className="shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
          ✓ {successMessage}
        </div>
      )}

      {activeMode === 'hub' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-8 shadow-sm space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] flex items-center justify-center font-bold text-2xl shadow-xs">
              📊
            </div>
            <h3 className="text-base font-bold text-[#333333] dark:text-slate-100">
              Sin Presupuesto Asignado para el Período {periodo}
            </h3>
            <p className="text-xs text-[#535c69] dark:text-slate-400 leading-relaxed">
              El período no cuenta con metas en la base de datos BCNF. Elige una de las tres metodologías para inicializar la línea base (Versión V0):
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto pt-2">
            {/* Tarjeta 1: Sugerencia Asistida por IA */}
            <div className="p-5 rounded-2xl border-2 border-[#00a2e8] bg-sky-50/20 dark:bg-sky-950/20 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow relative">
              <span className="absolute -top-2.5 right-4 px-2 py-0.5 bg-[#00a2e8] text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
                Recomendado
              </span>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="p-2 bg-[#00a2e8]/10 text-[#00a2e8] rounded-xl">
                    <BrainCircuit size={18} />
                  </span>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                    Sugerencia Asistida por IA
                  </h4>
                </div>
                <p className="text-[11px] text-[#535c69] dark:text-slate-400 leading-relaxed">
                  Cruza ventas reales históricas con stock actual, DOH y alertas ROP para sugerir metas balanceadas por categoría con justificación estratégica.
                </p>
              </div>

              <button
                onClick={handleRequestAISuggestions}
                disabled={isSuggestingAI}
                className="w-full py-2.5 px-3 bg-[#00a2e8] hover:bg-[#008ecb] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={14} className={isSuggestingAI ? 'animate-spin' : ''} />
                <span>{isSuggestingAI ? 'Consultando IA...' : 'Generar Metas con IA'}</span>
              </button>
            </div>

            {/* Tarjeta 2: Carga Manual V0 */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl">
                    <FileEdit size={18} />
                  </span>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                    Carga Manual en Grilla (V0)
                  </h4>
                </div>
                <p className="text-[11px] text-[#535c69] dark:text-slate-400 leading-relaxed">
                  Pizarra en blanco interactiva para ingresar montos de ventas y unidades por cada categoría de producto de forma directa y flexible.
                </p>
              </div>

              <button
                onClick={() => setActiveMode('manual')}
                className="w-full py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#333333] dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <PlusCircle size={14} />
                <span>Cargar Manualmente</span>
              </button>
            </div>

            {/* Tarjeta 3: Autosembrado Rápido Histórico */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <TrendingUp size={18} />
                  </span>
                  <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                    Histórico +5% Crecimiento
                  </h4>
                </div>
                <p className="text-[11px] text-[#535c69] dark:text-slate-400 leading-relaxed">
                  Autogeneración estándar en 1 clic aplicando un target lineal de +5% de crecimiento sobre las ventas reales ejecutadas del período anterior.
                </p>
              </div>

              <button
                onClick={handleSeedHistory}
                disabled={isSeedingHistory}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <RotateCw size={14} className={isSeedingHistory ? 'animate-spin' : ''} />
                <span>{isSeedingHistory ? 'Autogenerando...' : 'Sembrar Base (+5%)'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Modo Manual: Grilla Editable */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-[#333333] dark:text-slate-100 flex items-center space-x-2">
                <FileEdit size={16} className="text-[#00a2e8]" />
                <span>Carga Manual de Presupuesto Base (Versión V0) - {periodo}</span>
              </h3>
              <p className="text-xs text-[#535c69] dark:text-slate-400 mt-0.5">
                Ingresa el target proyectado en ventas y unidades para cada categoría.
              </p>
            </div>

            <button
              onClick={() => setActiveMode('hub')}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
            >
              ← Volver al Hub
            </button>
          </div>

          {/* Totales en vivo */}
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="p-3 bg-sky-50/50 dark:bg-sky-950/20 rounded-xl border border-sky-100 dark:border-sky-900/40">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Presupuestado ($)</span>
              <span className="text-base font-bold font-mono text-[#00a2e8]">
                ${totalManualMonto.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Unidades Target</span>
              <span className="text-base font-bold font-mono text-slate-800 dark:text-slate-200">
                {totalManualUnidades.toLocaleString()} un.
              </span>
            </div>
          </div>

          {/* Grilla Densa */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f5f7f8] dark:bg-slate-800 text-[#535c69] dark:text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-4">Categoría</th>
                  <th className="py-2.5 px-4 w-48 text-right">Meta Ventas ($ USD)</th>
                  <th className="py-2.5 px-4 w-40 text-right">Meta Unidades</th>
                  <th className="py-2.5 px-2 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                {manualRows.map((row, idx) => (
                  <tr key={row.categoria_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-100">
                      {row.categoria_nombre}
                    </td>

                    <td className="py-2 px-4 text-right">
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-400 font-mono text-xs">$</span>
                        <input
                          type="number"
                          step="100"
                          min="0"
                          value={row.monto}
                          onChange={(e) => handleManualRowChange(idx, 'monto', Number(e.target.value))}
                          className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-7 pr-3 py-1.5 font-mono font-bold text-xs text-[#00a2e8] text-right focus:outline-none focus:border-[#00a2e8]"
                        />
                      </div>
                    </td>

                    <td className="py-2 px-4 text-right">
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={row.unidades}
                        onChange={(e) => handleManualRowChange(idx, 'unidades', Number(e.target.value))}
                        className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono text-xs text-slate-800 dark:text-slate-200 text-right focus:outline-none focus:border-[#00a2e8]"
                      />
                    </td>

                    <td className="py-2 px-2 text-center">
                      {manualRows.length > 1 && (
                        <button
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
                          title="Quitar categoría de la grilla"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Selector de categorías dinámico */}
          <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium shrink-0">
              Agregar o crear categoría:
            </span>
            <div className="flex-1 max-w-xs">
              <CreatableCategorySelect
                value=""
                onChange={handleAddCategoryRow}
                categories={allCategories}
                onCategoryCreated={(newCat) => handleAddCategoryRow(newCat)}
                placeholder="+ Seleccionar o escribir nueva..."
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setActiveMode('hub')}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              onClick={handleSaveManualBatch}
              disabled={isSavingManual || manualRows.length === 0}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-[#00a2e8] hover:bg-[#008ecb] text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save size={14} />
              <span>{isSavingManual ? 'Guardando...' : 'Guardar y Publicar Presupuesto V0'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Revisión de IA */}
      <AIBudgetReviewModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        periodo={periodo}
        suggestions={aiSuggestions}
        analisisResumen={aiRationale}
        onSuccess={onRefresh}
      />
    </div>
  );
};
