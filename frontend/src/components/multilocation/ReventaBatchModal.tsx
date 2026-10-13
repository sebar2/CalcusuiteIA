import React, { useState } from 'react';
import { X, PackagePlus, AlertCircle, ShieldCheck } from 'lucide-react';
import { apiService } from '../../services/api';
import type { SupplierItem, StockBatchItem } from '../../types';

interface ReventaBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (batch: StockBatchItem) => void;
  uySuppliers: SupplierItem[];
  canManageCost: boolean;
}

export const ReventaBatchModal: React.FC<ReventaBatchModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  uySuppliers,
  canManageCost,
}) => {
  const [supplierId, setSupplierId] = useState<string>(
    uySuppliers.length > 0 ? String(uySuppliers[0].id) : ''
  );
  const [sku, setSku] = useState('');
  const [skuProveedor, setSkuProveedor] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState<number>(100);
  const [precioVenta, setPrecioVenta] = useState<number>(50);
  const [costoCompra, setCostoCompra] = useState<number>(30);
  const [observaciones, setObservaciones] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      setErrorMsg('Debe seleccionar un proveedor de plaza/reventa.');
      return;
    }
    if (!sku.trim() || !descripcion.trim() || cantidad <= 0 || precioVenta <= 0) {
      setErrorMsg('SKU local, descripción, cantidad y precio de venta son requeridos.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await apiService.createReventaBatch({
        supplier_id: Number(supplierId),
        sku: sku.trim().toUpperCase(),
        sku_proveedor: skuProveedor.trim() || undefined,
        descripcion: descripcion.trim(),
        cantidad: Number(cantidad),
        precio_venta: Number(precioVenta),
        costo_compra: canManageCost ? Number(costoCompra) : undefined,
        observaciones: observaciones.trim() || undefined,
      });

      onSuccess(res.batch);
      onClose();
    } catch (err: any) {
      console.error('Error al crear lote de reventa:', err);
      setErrorMsg(err.response?.data?.detail || 'No se pudo crear el lote de reventa.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <PackagePlus size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Cargar Lote - Proveedor Reventa / Plaza
              </h3>
              <p className="text-[11px] text-slate-500">
                Genera un lote en estado pendiente de aprobación comercial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Proveedor Uy */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Proveedor de Uruguay / Reventa *
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            >
              {uySuppliers.length === 0 && (
                <option value="">No hay proveedores locales registrados</option>
              )}
              {uySuppliers.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nombre} ({s.tipo_proveedor || 'PROVEEDOR_UY'}) - RUT: {s.rut || 'N/A'}
                </option>
              ))}
            </select>
          </div>

          {/* SKU Dual */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                SKU Local Montevideo *
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="ej: LUM-6060-PRO"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 uppercase"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                SKU / Lote Proveedor
              </label>
              <input
                type="text"
                value={skuProveedor}
                onChange={(e) => setSkuProveedor(e.target.value)}
                placeholder="ej: REV-FOS-99"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descripción del Producto / Lote *
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="ej: Panel LED Cuadrado 60x60cm 40W para obra"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              required
            />
          </div>

          {/* Cantidad y Precios */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cantidad (u.) *
              </label>
              <input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Precio Venta (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={precioVenta}
                onChange={(e) => setPrecioVenta(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100"
                required
              />
            </div>
            {canManageCost ? (
              <div>
                <label className="block text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center space-x-1">
                  <ShieldCheck size={12} />
                  <span>Costo Compra</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costoCompra}
                  onChange={(e) => setCostoCompra(Number(e.target.value))}
                  className="w-full bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-900 dark:text-emerald-200"
                />
              </div>
            ) : (
              <div className="flex flex-col justify-end">
                <span className="text-[10px] text-slate-400 italic">Costo Confidencial (Oculto)</span>
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observaciones / Destino de Reventa
            </label>
            <input
              type="text"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="ej: Lote adquirido para licitación UTE o reventa directa"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar Lote Reventa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
