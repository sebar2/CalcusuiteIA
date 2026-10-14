import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Calculator,
  Printer,
} from 'lucide-react';
import { logisticsApi } from '../../services/logisticsApi';
import type {
  LogisticsClientItem,
  ServiceSettlementResponse,
} from '../../services/logisticsApi';

export const LogisticsOrdersView: React.FC = () => {
  const [clients, setClients] = useState<LogisticsClientItem[]>([]);

  // Quote Calculator State
  const [quoteForm, setQuoteForm] = useState({
    client_id: '',
    dias_almacenaje: 15,
    pallets: 6,
    total_bultos: 150,
    total_unidades: 1800,
    distancia_km: 22.5,
    iva_pct: 22.0,
  });

  const [settlementResult, setSettlementResult] = useState<ServiceSettlementResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const cliData = await logisticsApi.getClients();
      setClients(cliData);
      if (cliData.length > 0 && !quoteForm.client_id) {
        setQuoteForm((prev) => ({ ...prev, client_id: String(cliData[0].id) }));
      }
    } catch (err) {
      console.error('Error al cargar órdenes de servicio 3PL:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCalculateQuote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quoteForm.client_id) return;
    try {
      setIsCalculating(true);
      const res = await logisticsApi.calculateQuote({
        client_id: Number(quoteForm.client_id),
        dias_almacenaje: Number(quoteForm.dias_almacenaje),
        pallets: Number(quoteForm.pallets),
        total_bultos: Number(quoteForm.total_bultos),
        total_unidades: Number(quoteForm.total_unidades),
        distancia_km: Number(quoteForm.distancia_km),
        iva_pct: Number(quoteForm.iva_pct),
      });
      setSettlementResult(res);
    } catch (err) {
      console.error('Error al cotizar liquidación 3PL:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    if (quoteForm.client_id) {
      handleCalculateQuote();
    }
  }, [quoteForm.client_id]);

  const selectedClientObj = clients.find((c) => String(c.id) === String(quoteForm.client_id));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
              <Receipt size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Órdenes de Venta & Liquidación de Servicios 3PL
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tarifación y liquidación discriminada: Almacenaje por posición/día, Handling, VAS y Fletes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Calculator / Settlement Generator + Active Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Settlement Form (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Calculator className="text-sky-500" size={18} />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Cotizador & Liquidador de Servicios 3PL
            </h2>
          </div>

          <form onSubmit={handleCalculateQuote} className="mt-4 space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cliente 3PL a Liquidar
              </label>
              <select
                value={quoteForm.client_id}
                onChange={(e) => setQuoteForm({ ...quoteForm, client_id: e.target.value })}
                className="w-full mt-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre_comercial} ({c.tipo})
                  </option>
                ))}
              </select>
            </div>

            {selectedClientObj?.pricing && (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">
                  Tarifas Base Acordadas con {selectedClientObj.nombre_comercial}:
                </span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  <span>Almacenaje: <b>${selectedClientObj.pricing.tarifa_almacenaje_pallet_dia}/día</b></span>
                  <span>Handling: <b>${selectedClientObj.pricing.tarifa_handling_bulto}/bulto</b></span>
                  <span>Etiquetado: <b>${selectedClientObj.pricing.tarifa_etiquetado_unidad}/u</b></span>
                  <span>Flete Base: <b>${selectedClientObj.pricing.tarifa_flete_base}</b></span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Días de Estadía</label>
                <input
                  type="number"
                  min="1"
                  value={quoteForm.dias_almacenaje}
                  onChange={(e) => setQuoteForm({ ...quoteForm, dias_almacenaje: parseInt(e.target.value, 10) || 1 })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Pallets Ocupados</label>
                <input
                  type="number"
                  min="1"
                  value={quoteForm.pallets}
                  onChange={(e) => setQuoteForm({ ...quoteForm, pallets: parseInt(e.target.value, 10) || 1 })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Bultos (Handling)</label>
                <input
                  type="number"
                  value={quoteForm.total_bultos}
                  onChange={(e) => setQuoteForm({ ...quoteForm, total_bultos: parseInt(e.target.value, 10) || 0 })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Unidades (VAS Etiquetado)</label>
                <input
                  type="number"
                  value={quoteForm.total_unidades}
                  onChange={(e) => setQuoteForm({ ...quoteForm, total_unidades: parseInt(e.target.value, 10) || 0 })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Distancia Reparto (km)</label>
                <input
                  type="number"
                  step="0.5"
                  value={quoteForm.distancia_km}
                  onChange={(e) => setQuoteForm({ ...quoteForm, distancia_km: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">IVA Aplicable (%)</label>
                <input
                  type="number"
                  value={quoteForm.iva_pct}
                  onChange={(e) => setQuoteForm({ ...quoteForm, iva_pct: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isCalculating}
              className="w-full mt-2 py-2 px-4 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center justify-center space-x-2"
            >
              <Calculator size={14} />
              <span>{isCalculating ? 'Calculando Liquidación...' : 'Recalcular Liquidación'}</span>
            </button>
          </form>
        </div>

        {/* Right: Printable Invoice / Settlement Specimen (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Liquidación Oficial de Servicios 3PL
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedClientObj ? selectedClientObj.razon_social : 'Cliente'}
                </h3>
                <p className="text-xs text-slate-500">RUT: {selectedClientObj?.rut}</p>
              </div>

              <div className="text-right">
                <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 block">
                  LIQ-3PL-{new Date().getFullYear()}-{Math.floor(1000 + Math.random() * 9000)}
                </span>
                <span className="text-[11px] text-slate-400">Fecha: {new Date().toLocaleDateString()}</span>
              </div>
            </div>

            {/* Breakdown Table */}
            {settlementResult && (
              <div className="mt-4">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/70 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                      <th className="py-2">Concepto Logístico</th>
                      <th className="py-2 text-center">Cantidad</th>
                      <th className="py-2 text-right">Tarifa Unitaria</th>
                      <th className="py-2 text-right">Subtotal ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {settlementResult.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                          {it.concepto}
                        </td>
                        <td className="py-2.5 text-center text-slate-600 dark:text-slate-400">
                          {it.cantidad} {it.unidad_medida}
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          ${it.tarifa_unitaria.toFixed(2)}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          ${it.subtotal.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Subtotals & Grand Total */}
                <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal Almacenaje & Custodia:</span>
                    <span className="font-mono font-semibold">${settlementResult.subtotal_almacenaje.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal Handling (In & Out):</span>
                    <span className="font-mono font-semibold">${settlementResult.subtotal_handling.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal Acondicionamiento (VAS):</span>
                    <span className="font-mono font-semibold">${settlementResult.subtotal_vas.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal Flete de Distribución Capilar:</span>
                    <span className="font-mono font-semibold">${settlementResult.subtotal_flete.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800 font-semibold">
                    <span>Total sin Impuestos:</span>
                    <span className="font-mono">${settlementResult.total_sin_impuestos.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>IVA (22%):</span>
                    <span className="font-mono">${settlementResult.iva_monto.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-baseline pt-2 border-t-2 border-slate-900 dark:border-slate-100 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <span>Total General a Facturar:</span>
                    <span className="text-lg font-mono text-[#00a2e8] dark:text-sky-400">
                      ${settlementResult.total_facturar.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Formato de facturación electrónica DGI compatible
            </span>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <Printer size={14} />
              <span>Imprimir Liquidación</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default LogisticsOrdersView;
