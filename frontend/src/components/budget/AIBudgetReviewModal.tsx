import React, { useState, useEffect } from 'react';
import { 
  X, 
  BrainCircuit, 
  Sparkles, 
  AlertCircle,
  Save,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  ArrowUpRight
} from 'lucide-react';
import { apiService } from '../../services/api';
import type { 
  BudgetCategorySuggestion, 
  BudgetManualItem, 
  BusinessUnitDistribution,
  SkuPrioritarioItem 
} from '../../types';

interface AIBudgetReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodo: string;
  suggestions: BudgetCategorySuggestion[];
  analisisResumen: string;
  distribucionUnidades?: BusinessUnitDistribution[];
  crecimientoGlobalPct?: number;
  onSuccess: () => void;
}

interface EditableCategoryRow {
  categoria_id: number;
  categoria_nombre: string;
  monto: number;
  unidades: number;
  crecimiento_pct: number;
  ventas_historicas: number;
  stock_actual: number;
  avg_doh: number;
  justificacion: string;
  diagnostico_tag?: string;
  fundamento_estrategico?: string;
  skus_prioritarios?: SkuPrioritarioItem[];
}

export const AIBudgetReviewModal: React.FC<AIBudgetReviewModalProps> = ({
  isOpen,
  onClose,
  periodo,
  suggestions,
  analisisResumen,
  distribucionUnidades,
  crecimientoGlobalPct: _crecimientoProp,
  onSuccess,
}) => {
  const [rows, setRows] = useState<EditableCategoryRow[]>([]);
  const [expandedSkus, setExpandedSkus] = useState<Record<number, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (suggestions && suggestions.length > 0) {
      setRows(
        suggestions.map((s) => ({
          categoria_id: s.categoria_id,
          categoria_nombre: s.categoria_nombre,
          monto: Number(s.monto_sugerido),
          unidades: Number(s.unidades_sugeridas),
          crecimiento_pct: Number(s.crecimiento_pct),
          ventas_historicas: Number(s.ventas_historicas),
          stock_actual: Number(s.stock_actual),
          avg_doh: Number(s.avg_doh),
          justificacion: s.justificacion,
          diagnostico_tag: s.diagnostico_tag || (Number(s.avg_doh) > 60 ? 'Inmovilización de Capital' : (s.stock_actual === 0 || s.justificacion.includes('alerta') || s.justificacion.includes('quiebre') ? 'Quiebre Inminente' : 'Operación Balanceada')),
          fundamento_estrategico: s.fundamento_estrategico,
          skus_prioritarios: s.skus_prioritarios || [],
        }))
      );
    }
  }, [suggestions]);

  if (!isOpen) return null;

  const toggleExpandSkus = (catId: number) => {
    setExpandedSkus((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const handleRowChange = (index: number, field: 'monto' | 'unidades', value: number) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [field]: value >= 0 ? value : 0,
      };
      return copy;
    });
  };

  const totalMonto = rows.reduce((acc, r) => acc + (Number(r.monto) || 0), 0);
  const totalUnidades = rows.reduce((acc, r) => acc + (Number(r.unidades) || 0), 0);
  const totalHistorico = rows.reduce((acc, r) => acc + (Number(r.ventas_historicas) || 0), 0);
  const calcCrecimientoGlobalPct = totalHistorico > 0 ? ((totalMonto - totalHistorico) / totalHistorico) * 100 : 0;

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const items: BudgetManualItem[] = rows.map((r) => ({
        categoria_id: r.categoria_id,
        categoria_nombre: r.categoria_nombre,
        monto_presupuestado: r.monto,
        unidades_presupuestadas: r.unidades,
      }));

      await apiService.saveBudgetManualBatch({
        periodo,
        version: 'V0_IA_Asistido',
        items,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving AI budget suggestions', err);
      setErrorMessage(err.response?.data?.detail || 'Error al persistir el presupuesto sugerido.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Estilo Modern SaaS */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-sky-50/50 via-white to-sky-50/20 dark:from-sky-950/20 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-center space-x-3">
            <span className="p-2 bg-[#00a2e8]/10 text-[#00a2e8] rounded-xl">
              <BrainCircuit size={22} />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-[#333333] dark:text-slate-100">
                  Revisión de Metas Asistidas por IA
                </h3>
                <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-950/60 text-[#00a2e8] font-bold text-[10px] rounded-full">
                  Período {periodo}
                </span>
              </div>
              <p className="text-xs text-[#535c69] dark:text-slate-400 mt-0.5">
                Cruce de ventas históricas, DOH y alertas ROP con asignación por Unidades de Negocio y SKUs prioritarios.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Resumen Cualitativo de la IA */}
        {analisisResumen && (
          <div className="px-5 py-3 bg-[#f8fafc] dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-start space-x-2">
            <Sparkles size={16} className="text-[#00a2e8] shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-slate-900 dark:text-slate-100">Dictamen Estratégico:</strong> {analisisResumen}
            </div>
          </div>
        )}

        {/* Unidades de Negocio Estratégicas */}
        {distribucionUnidades && distribucionUnidades.length > 0 && (
          <div className="px-5 py-3 bg-slate-50/60 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Desglose Estratégico por Unidades de Negocio
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {distribucionUnidades.map((u, i) => (
                <div 
                  key={i} 
                  className="p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-2xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                      {u.unidad}
                    </span>
                    <span className="px-2 py-0.5 bg-sky-50 dark:bg-sky-950/50 text-[#00a2e8] font-bold text-[10px] rounded-full font-mono">
                      {Number(u.participacion_pct).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {u.enfoque}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Banner de Totales en Tiempo Real */}
        <div className="px-5 py-3 bg-white dark:bg-slate-900 grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs text-[#535c69] dark:text-slate-400">Total Presupuestado:</span>
            <span className="text-sm font-bold font-mono text-[#00a2e8]">
              ${totalMonto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs text-[#535c69] dark:text-slate-400">Total Unidades:</span>
            <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
              {totalUnidades.toLocaleString()} un.
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs text-[#535c69] dark:text-slate-400">Crecimiento vs Histórico:</span>
            <span className={`text-sm font-bold font-mono ${calcCrecimientoGlobalPct >= 0 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'}`}>
              {calcCrecimientoGlobalPct >= 0 ? '+' : ''}{calcCrecimientoGlobalPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {errorMessage && (
          <div className="m-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center space-x-2">
            <AlertCircle size={15} className="text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tabla Editable */}
        <div className="p-5 flex-1 overflow-y-auto">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f5f7f8] dark:bg-slate-800 text-[#535c69] dark:text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-right">Histórico Real</th>
                  <th className="py-2.5 px-3 text-center">Stock / DOH</th>
                  <th className="py-2.5 px-3 w-36 text-right">Meta Ventas ($)</th>
                  <th className="py-2.5 px-3 w-28 text-right">Meta Unidades</th>
                  <th className="py-2.5 px-3">Fundamento Estratégico</th>
                  <th className="py-2.5 px-3 text-center w-28">SKUs Críticos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                {rows.map((row, idx) => {
                  const isExpanded = !!expandedSkus[row.categoria_id];
                  const skus = row.skus_prioritarios || [];

                  return (
                    <React.Fragment key={row.categoria_id}>
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col space-y-1">
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {row.categoria_nombre}
                            </span>
                            <div>
                              {row.diagnostico_tag === 'Quiebre Inminente' ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                                  🚨 Quiebre Inminente
                                </span>
                              ) : row.diagnostico_tag === 'Inmovilización de Capital' ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                                  ⚠️ Inmovilización de Capital
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                                  ✓ Operación Balanceada
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400">
                          ${Number(row.ventas_historicas).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400">
                          <span className="font-mono">{row.stock_actual} un.</span>
                          <span className="text-[10px] text-slate-400 ml-1">({Number(row.avg_doh).toFixed(0)}d)</span>
                        </td>

                        <td className="py-2 px-3 text-right">
                          <div className="relative">
                            <span className="absolute left-2 top-1.5 text-slate-400 font-mono text-[11px]">$</span>
                            <input
                              type="number"
                              step="100"
                              min="0"
                              value={row.monto}
                              onChange={(e) => handleRowChange(idx, 'monto', Number(e.target.value))}
                              className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-5 pr-2 py-1 font-mono font-bold text-xs text-[#00a2e8] text-right focus:outline-none focus:border-[#00a2e8]"
                            />
                          </div>
                        </td>

                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={row.unidades}
                            onChange={(e) => handleRowChange(idx, 'unidades', Number(e.target.value))}
                            className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-mono text-xs text-slate-800 dark:text-slate-200 text-right focus:outline-none focus:border-[#00a2e8]"
                          />
                        </td>

                        <td className="py-2.5 px-3 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="line-clamp-2" title={row.fundamento_estrategico || row.justificacion}>
                            {row.fundamento_estrategico || row.justificacion}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => toggleExpandSkus(row.categoria_id)}
                            className="inline-flex items-center space-x-1 px-2 py-1 text-[10px] font-semibold text-[#00a2e8] hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Desplegar SKUs de acción prioritaria"
                          >
                            <span>{isExpanded ? 'Ocultar' : 'Ver SKUs'}</span>
                            {skus.length > 0 && (
                              <span className="px-1.5 py-0.2 bg-sky-100 dark:bg-sky-900/60 rounded-full text-[9px] font-mono">
                                {skus.length}
                              </span>
                            )}
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </td>
                      </tr>

                      {/* Acordeón de SKUs Prioritarios PUSH / PULL */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                          <td colSpan={7} className="p-3">
                            {skus.length === 0 ? (
                              <div className="text-[11px] text-slate-400 italic text-center py-1">
                                Sin desvíos críticos de inventario o quiebres detectados para esta categoría.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  SKUs Prioritarios Asignados (Acciones PUSH & PULL):
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                  {skus.map((skuItem, sIdx) => {
                                    const isPush = skuItem.tipo_accion === 'PUSH_SOBRESTOCK';
                                    return (
                                      <div
                                        key={sIdx}
                                        className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                                          isPush
                                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                                            : 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/60 text-sky-900 dark:text-sky-200'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-mono font-bold text-[11px]">
                                            {skuItem.sku}
                                          </span>
                                          <span
                                            className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                              isPush
                                                ? 'bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                                                : 'bg-sky-200/80 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200'
                                            }`}
                                          >
                                            {isPush ? (
                                              <>
                                                <TrendingDown size={10} />
                                                <span>PUSH</span>
                                              </>
                                            ) : (
                                              <>
                                                <ArrowUpRight size={10} />
                                                <span>PULL</span>
                                              </>
                                            )}
                                          </span>
                                        </div>
                                        <div className="font-semibold text-[11px] truncate" title={skuItem.nombre}>
                                          {skuItem.nombre}
                                        </div>
                                        <p className="text-[10px] opacity-85 leading-tight">
                                          {skuItem.motivo}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer con Acciones */}
        <div className="p-4 bg-[#f8fafc] dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {rows.length} categorías comerciales activas
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || rows.length === 0}
              className="inline-flex items-center space-x-2 px-5 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              <Save size={14} />
              <span>{isSaving ? 'Guardando metas...' : 'Guardar y Aplicar Presupuesto V0'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
