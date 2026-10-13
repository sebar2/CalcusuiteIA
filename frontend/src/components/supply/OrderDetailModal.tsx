import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Calendar, DollarSign, Truck, User } from 'lucide-react';
import type { SupplyOrder, SupplyOrderUpdate } from '../../types';
import { ProductThumbnail } from '../common/ProductThumbnail';

interface OrderDetailModalProps {
  isOpen: boolean;
  order: SupplyOrder | null;
  onClose: () => void;
  onSave: (orderId: number, data: SupplyOrderUpdate) => Promise<void>;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  isOpen,
  order,
  onClose,
  onSave,
}) => {
  const [cantidad, setCantidad] = useState<number>(0);
  const [montoTotal, setMontoTotal] = useState<number>(0);
  const [proveedor, setProveedor] = useState<string>('');
  const [responsable, setResponsable] = useState<string>('');
  const [etapa, setEtapa] = useState<string>('sugerido');
  const [fechaArribo, setFechaArribo] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setCantidad(order.cantidad);
      setMontoTotal(order.monto_total);
      setProveedor(order.proveedor);
      setResponsable(order.responsable);
      setEtapa(order.etapa);
      setFechaArribo(order.fecha_arribo_estimada);
      setErrorMsg(null);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cantidad <= 0 || montoTotal <= 0) {
      setErrorMsg('La cantidad y el monto deben ser mayores a 0.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      await onSave(order.id, {
        cantidad,
        monto_total: montoTotal,
        proveedor,
        responsable,
        etapa,
        fecha_arribo_estimada: fechaArribo,
      });
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Error al actualizar la orden de reposición.';
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const isHighValue = montoTotal > 5000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center space-x-3">
            <ProductThumbnail
              sku={order.sku_id}
              alt={`SKU ${order.sku_id}`}
              size="md"
              className="border border-slate-200 dark:border-slate-700 shadow-2xs"
            />
            <div>
              <h3 className="text-base font-bold text-[#333333] dark:text-slate-100">
                Orden #{order.id} — SKU {order.sku_id}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detalle y configuración de reposición de inventario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
              <AlertCircle size={16} className="shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isHighValue && (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 flex items-center space-x-2">
              <AlertCircle size={14} className="shrink-0 text-amber-600" />
              <span>
                <strong>Control SoD:</strong> Orden &gt; $5,000 requiere autorización de Controller Financiero para avanzar a fabricación/tránsito.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                Cantidad a Reponer
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                  required
                  className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8] focus:bg-white dark:focus:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                Monto Total ($)
              </label>
              <div className="relative">
                <DollarSign size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={montoTotal}
                  onChange={(e) => setMontoTotal(Number(e.target.value))}
                  required
                  className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8] focus:bg-white dark:focus:bg-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                Proveedor
              </label>
              <div className="relative">
                <Truck size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  required
                  className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8] focus:bg-white dark:focus:bg-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                Responsable
              </label>
              <div className="relative">
                <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={responsable}
                  onChange={(e) => setResponsable(e.target.value)}
                  required
                  className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8] focus:bg-white dark:focus:bg-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                Etapa Pipeline
              </label>
              <select
                value={etapa}
                onChange={(e) => setEtapa(e.target.value)}
                className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
              >
                <option value="sugerido">1. Sugerido (Stock &lt;= ROP)</option>
                <option value="aprobacion">2. Pendiente de Aprobación</option>
                <option value="fabricacion">3. En Fabricación</option>
                <option value="transito">4. En Alta Mar / Aduana</option>
                <option value="proveedor_uy">5. Proveedores Uy (Plaza)</option>
                <option value="ingresado">6. Ingresado / Stock Central</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                Fecha Estimada de Arribo
              </label>
              <div className="relative">
                <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={fechaArribo}
                  onChange={(e) => setFechaArribo(e.target.value)}
                  required
                  className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8] focus:bg-white dark:focus:bg-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Footer Botones */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#00a2e8] hover:bg-[#008ecb] disabled:opacity-50 rounded-lg shadow-sm transition-all"
            >
              <Save size={14} />
              <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
