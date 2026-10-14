import React, { useState, useEffect } from 'react';
import {
  CircleDollarSign,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { logisticsApi } from '../../services/logisticsApi';
import type { FinanceSummaryResponse } from '../../services/logisticsApi';

export const LogisticsFinanceView: React.FC = () => {
  const [finance, setFinance] = useState<FinanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadFinance = async () => {
    try {
      setLoading(true);
      const data = await logisticsApi.getFinanceSummary();
      setFinance(data);
    } catch (err) {
      console.error('Error al cargar métricas financieras 3PL:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinance();
  }, []);

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
                Margen de contribución por ruta, control de pagos a conductores tercerizados y absorción de variables
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadFinance}
          className="inline-flex items-center space-x-2 px-3.5 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Actualizar Balances</span>
        </button>
      </div>

      {/* KPI Cards */}
      {finance && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Facturación Fletes Cliente
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                ${finance.facturacion_fletes_total.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-600 font-medium">Ingresos Brutos</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Liquidación a Conductores
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                ${finance.costo_choferes_total.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400">Fleteros Tercerizados</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Gastos Variables Ruta
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
                ${finance.gastos_variables_total.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400">Peajes & Combustible</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Margen de Contribución
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#00a2e8] dark:text-sky-400 font-mono">
                ${finance.margen_bruto_total.toLocaleString()}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300">
                {finance.margen_pct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Profitability Formula Banner */}
      <div className="bg-gradient-to-r from-sky-900 to-slate-900 rounded-2xl p-4 text-white text-xs flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-white/10">
            <TrendingUp size={20} className="text-sky-300" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Fórmula de Rentabilidad Neta del Flete 3PL</h4>
            <p className="text-slate-300 text-[11px] mt-0.5">
              Margen Bruto Reparto = Tarifa Flete Cliente - (Liquidación Fletero + Peajes/Variables)
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[10px] text-slate-300 uppercase font-semibold">Umbral Saludable:</span>
          <span className="text-sm font-bold text-emerald-400 block">&gt; 25.0% Margen</span>
        </div>
      </div>

      {/* Routes Profitability Detailed Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Desglose de Margen por Despacho & Orden
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
  );
};
export default LogisticsFinanceView;
