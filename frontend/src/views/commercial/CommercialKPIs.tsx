import React from 'react';
import { DollarSign, Briefcase, TrendingUp, AlertCircle } from 'lucide-react';
import type { CommercialDeal } from '../../types';

interface CommercialKPIsProps {
  deals: CommercialDeal[];
}

export const CommercialKPIs: React.FC<CommercialKPIsProps> = ({ deals }) => {
  const totalMontoUSD = deals.reduce((acc, d) => {
    return acc + (Number(d.monto_total) || 0);
  }, 0);

  const dealsGanados = deals.filter((d) => d.etapa === 'ganada');
  const dealsEnCurso = deals.filter((d) => d.etapa !== 'ganada' && d.etapa !== 'perdida');
  const winRate = deals.length > 0 ? Math.round((dealsGanados.length / deals.length) * 100) : 0;
  const warningsCount = deals.filter((d) => Boolean(d.stock_reservation_warning)).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* KPI: Total Pipeline */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Pipeline Activo
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            US$ {totalMontoUSD.toLocaleString('es-UY', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {dealsEnCurso.length} negocios en curso
          </div>
        </div>
        <div className="w-9 h-9 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-[#00a2e8] flex items-center justify-center">
          <DollarSign size={18} />
        </div>
      </div>

      {/* KPI: Total Negocios */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Total Tratos
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {deals.length}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            {dealsGanados.length} ganados
          </div>
        </div>
        <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <Briefcase size={18} />
        </div>
      </div>

      {/* KPI: Tasa de Conversión */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Conversión B2B
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {winRate}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Ratio ganados vs total
          </div>
        </div>
        <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <TrendingUp size={18} />
        </div>
      </div>

      {/* KPI: Alertas de Stock */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Riesgo de Quiebre
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {warningsCount}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            {warningsCount > 0 ? 'Con advertencia de stock' : 'Stock garantizado'}
          </div>
        </div>
        <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <AlertCircle size={18} />
        </div>
      </div>
    </div>
  );
};

export default CommercialKPIs;
