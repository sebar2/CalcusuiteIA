import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Boxes, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw
} from 'lucide-react';
import type { InventoryAlertItem, InventoryQuickUpdatePayload } from '../../types';
import { apiService } from '../../services/api';

interface InventoryQuickEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryAlertItem | null;
  onSuccess: (updated: InventoryAlertItem) => void;
}

export const InventoryQuickEditModal: React.FC<InventoryQuickEditModalProps> = ({
  isOpen,
  onClose,
  item,
  onSuccess,
}) => {
  if (!isOpen || !item) return null;

  // Estados locales de los campos editables
  const [stockActual, setStockActual] = useState<number>(item.stock_actual);
  const [costoUnitario, setCostoUnitario] = useState<number>(Number(item.costo_unitario || 100));
  const [leadTimeDias, setLeadTimeDias] = useState<number>(Number(item.lead_time_dias || 30));
  const [stockSeguridad, setStockSeguridad] = useState<number>(item.stock_seguridad || 10);
  const [demandaDiaria, setDemandaDiaria] = useState<number>(Number(item.demanda_diaria_promedio || 5));

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sincronizar al abrir con un nuevo ítem
  useEffect(() => {
    if (item) {
      setStockActual(item.stock_actual);
      setCostoUnitario(Number(item.costo_unitario || 100));
      setLeadTimeDias(Number(item.lead_time_dias || 30));
      setStockSeguridad(item.stock_seguridad || 10);
      setDemandaDiaria(Number(item.demanda_diaria_promedio || 5));
      setErrorMsg(null);
    }
  }, [item]);

  // Recálculo dinámico en caliente para previsualización inmediata
  const previewRop = Math.round(((demandaDiaria * leadTimeDias) + stockSeguridad) * 10) / 10;
  const previewDoh = demandaDiaria > 0 ? Math.round((stockActual / demandaDiaria) * 10) / 10 : 0;
  const previewIsAlert = stockActual <= previewRop;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);

    const payload: InventoryQuickUpdatePayload = {
      stock_actual: stockActual,
      costo_unitario: costoUnitario,
      lead_time_dias: leadTimeDias,
      stock_seguridad: stockSeguridad,
      demanda_diaria_promedio: demandaDiaria,
    };

    try {
      const res = await apiService.updateInventoryQuick(item.sku, payload);
      onSuccess(res.item);
      onClose();
    } catch (err: any) {
      console.error('Error al actualizar inventario:', err);
      const detail = err.response?.data?.detail || 'Error al persistir cambios en el inventario.';
      setErrorMsg(detail);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Cabecera Bitrix24 */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-100 dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-800/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] rounded-xl">
              <Boxes size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <span>Ajuste Rápido de Abastecimiento</span>
                <span className="font-mono text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-md font-semibold text-slate-700 dark:text-slate-300">
                  {item.sku}
                </span>
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-[280px]">
                {item.nombre} ({item.categoria})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Panel de Previsualización en Vivo de Métricas */}
        <div className="p-4 px-6 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-3 gap-3 text-center">
            {/* Nuevo ROP */}
            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Nuevo ROP</span>
              <span className="text-base font-bold font-mono text-slate-800 dark:text-slate-100">
                {previewRop} <span className="text-[10px] font-normal text-slate-400">u</span>
              </span>
            </div>

            {/* Nuevo DOH */}
            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Nuevo DOH</span>
              <span className={`text-base font-bold font-mono ${
                previewDoh < 30 ? 'text-rose-600' : 'text-emerald-600'
              }`}>
                {previewDoh} <span className="text-[10px] font-normal text-slate-400">días</span>
              </span>
            </div>

            {/* Estado Estimado */}
            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Estado Stock</span>
              {previewIsAlert ? (
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center justify-center space-x-1 mt-1">
                  <AlertTriangle size={13} />
                  <span>Quiebre (≤ ROP)</span>
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center space-x-1 mt-1">
                  <CheckCircle2 size={13} />
                  <span>Abastecido</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Formulario de Inputs */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 flex items-center space-x-2">
              <AlertTriangle size={15} className="shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Stock Actual Físico */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Stock Total Disponible
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={stockActual}
                  onChange={(e) => setStockActual(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                />
                <span className="absolute right-3 top-2 text-[10px] text-slate-400">unidades</span>
              </div>
            </div>

            {/* Costo Unitario de Reposición */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Costo Unitario ($ UYU / USD)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={costoUnitario}
                  onChange={(e) => setCostoUnitario(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                />
                <span className="absolute right-3 top-2 text-[10px] text-slate-400">$</span>
              </div>
            </div>

            {/* Lead Time (Días de Reposición) */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Lead Time (Días de Proveedor)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={leadTimeDias}
                  onChange={(e) => setLeadTimeDias(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                />
                <span className="absolute right-3 top-2 text-[10px] text-slate-400">días</span>
              </div>
            </div>

            {/* Stock de Seguridad */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Stock de Seguridad Mínimo
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={stockSeguridad}
                  onChange={(e) => setStockSeguridad(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                />
                <span className="absolute right-3 top-2 text-[10px] text-slate-400">unidades</span>
              </div>
            </div>
          </div>

          {/* Demanda Diaria Promedio */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Demanda Diaria Promedio (Ventas / Día)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0.1"
                step="0.1"
                required
                value={demandaDiaria}
                onChange={(e) => setDemandaDiaria(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="w-full bg-[#f8fafc] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
              />
              <span className="absolute right-3 top-2 text-[10px] text-slate-400">u / día</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Al guardar, se recalcula el Punto de Reorden ($ROP$) y se sincroniza automáticamente el pipeline Kanban.
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-xl font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl font-bold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RotateCcw size={14} className="animate-spin" />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Guardar y Recalcular</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
