import React, { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Calendar, CheckCircle2, MapPin, X, AlertCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import type { LocalPurchaseOrder, SupplierItem, WarehouseItem } from '../../types';

interface LocalPurchaseOrdersSectionProps {
  uySuppliers: SupplierItem[];
  uyWarehouses: WarehouseItem[];
  canManageOrders?: boolean;
}

export const LocalPurchaseOrdersSection: React.FC<LocalPurchaseOrdersSectionProps> = ({
  uySuppliers,
  uyWarehouses,
  canManageOrders = true,
}) => {
  const [orders, setOrders] = useState<LocalPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    uySuppliers.length > 0 ? String(uySuppliers[0].id) : ''
  );
  const [fechaDisponible, setFechaDisponible] = useState<string>(
    new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
  );
  const [destinoWhId, setDestinoWhId] = useState<string>('DEP-CENTRAL-MVD');
  const [observaciones, setObservaciones] = useState<string>('');
  const [items, setItems] = useState<{
    sku: string;
    sku_proveedor: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    precio_venta_sugerido: number;
  }[]>([
    {
      sku: 'LUM-UY-01',
      sku_proveedor: 'ART-LOC-101',
      descripcion: 'Luminaria Panel Reventa Plaza',
      cantidad: 50,
      precio_unitario: 22,
      precio_venta_sugerido: 38,
    },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await apiService.getLocalPurchaseOrders();
      setOrders(data);
    } catch (err) {
      console.error('Error fetching local purchase orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        sku: '',
        sku_proveedor: '',
        descripcion: '',
        cantidad: 10,
        precio_unitario: 10,
        precio_venta_sugerido: 18,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, val: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = val;
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      setErrorMsg('Debe seleccionar un proveedor de plaza.');
      return;
    }
    if (items.length === 0 || items.some((it) => !it.sku.trim() || it.cantidad <= 0)) {
      setErrorMsg('Cada ítem debe tener SKU local y cantidad mayor a cero.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await apiService.createLocalPurchaseOrder({
        supplier_id: Number(selectedSupplierId),
        fecha_disponible: fechaDisponible,
        destino_warehouse_id: destinoWhId,
        observaciones: observaciones.trim() || undefined,
        items: items.map((it) => ({
          sku: it.sku.trim().toUpperCase(),
          sku_proveedor: it.sku_proveedor.trim() || undefined,
          descripcion: it.descripcion.trim(),
          cantidad: Number(it.cantidad),
          precio_unitario: Number(it.precio_unitario),
          precio_venta_sugerido: Number(it.precio_venta_sugerido),
        })),
      });

      setSuccessMsg(res.message || 'Orden de compra local registrada exitosamente.');
      setTimeout(() => setSuccessMsg(null), 5000);
      setIsModalOpen(false);
      await fetchOrders();
    } catch (err: any) {
      console.error('Error creating local purchase order:', err);
      setErrorMsg(err.response?.data?.detail || 'No se pudo generar la orden de compra local.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <ShoppingBag size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Órdenes de Compra - Proveedores Uruguay (Plaza & Reventa)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300">
                {orders.length} órdenes
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gestión de compras rápidas a proveedores locales para licitaciones B2B o reposición inmediata en plaza.
            </p>
          </div>
        </div>

        {canManageOrders && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-sm hover:scale-[1.02]"
          >
            <Plus size={14} />
            <span>+ Nueva OC Proveedor Uy</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Orders Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-2.5 px-3">N° Orden</th>
              <th className="py-2.5 px-3">Proveedor Plaza</th>
              <th className="py-2.5 px-3">Fecha Disponible</th>
              <th className="py-2.5 px-3 text-right">Monto Total USD</th>
              <th className="py-2.5 px-3">Almacén Destino</th>
              <th className="py-2.5 px-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                  Cargando órdenes de compra de plaza...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                  No hay órdenes de compra registradas con proveedores de Uruguay.
                </td>
              </tr>
            ) : (
              orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-purple-700 dark:text-purple-300">
                    {ord.numero_orden}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                    {ord.supplier_nombre}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="flex items-center space-x-1 text-slate-600 dark:text-slate-300">
                      <Calendar size={12} className="text-purple-500" />
                      <span>{ord.fecha_disponible || 'Inmediato'}</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    ${(ord.monto_total || 0).toLocaleString('es-UY', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 flex items-center space-x-1">
                    <MapPin size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate max-w-[140px]">
                      {ord.destino_warehouse_nombre || ord.destino_warehouse_id || 'Depósito Central'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      {ord.estado}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Nueva Orden Compra Local */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Nueva Orden de Compra - Proveedor de Uruguay
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Genera la orden con fecha de disponibilidad e ingresa lote a la columna Proveedores Uy
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Proveedor Uruguay / Reventa *
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    {uySuppliers.length === 0 ? (
                      <option value="">No hay proveedores locales registrados</option>
                    ) : (
                      uySuppliers.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.nombre} ({s.tipo_proveedor || 'PROVEEDOR_UY'}) - RUT: {s.rut || 'N/A'}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Fecha Disponible en Plaza *
                  </label>
                  <input
                    type="date"
                    value={fechaDisponible}
                    onChange={(e) => setFechaDisponible(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Depósito de Destino Previsto
                  </label>
                  <select
                    value={destinoWhId}
                    onChange={(e) => setDestinoWhId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  >
                    {uyWarehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.nombre} ({w.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Observaciones / Proyecto B2B
                  </label>
                  <input
                    type="text"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="ej: Compra para licitación UTE o reventa"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Ítems de la Orden de Compra
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1"
                  >
                    <Plus size={12} />
                    <span>+ Agregar Ítem</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-2"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">SKU Local *</label>
                          <input
                            type="text"
                            value={it.sku}
                            onChange={(e) => handleUpdateItem(idx, 'sku', e.target.value)}
                            placeholder="LUM-6060"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono uppercase"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">SKU Proveedor</label>
                          <input
                            type="text"
                            value={it.sku_proveedor}
                            onChange={(e) => handleUpdateItem(idx, 'sku_proveedor', e.target.value)}
                            placeholder="REF-PLAZA-01"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">Descripción *</label>
                          <input
                            type="text"
                            value={it.descripcion}
                            onChange={(e) => handleUpdateItem(idx, 'descripcion', e.target.value)}
                            placeholder="Panel LED 60x60"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 items-end">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">Cantidad *</label>
                          <input
                            type="number"
                            min="1"
                            value={it.cantidad}
                            onChange={(e) => handleUpdateItem(idx, 'cantidad', Number(e.target.value))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">Precio Unit. (USD) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.precio_unitario}
                            onChange={(e) => handleUpdateItem(idx, 'precio_unitario', Number(e.target.value))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">P. Venta Sugerido (USD)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.precio_venta_sugerido}
                            onChange={(e) => handleUpdateItem(idx, 'precio_venta_sugerido', Number(e.target.value))}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono"
                          />
                        </div>
                        {items.length > 1 && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-slate-500">Total Orden: </span>
                  <strong className="font-mono text-purple-700 dark:text-purple-300">
                    ${items.reduce((acc, it) => acc + (it.cantidad * it.precio_unitario || 0), 0).toFixed(2)} USD
                  </strong>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm disabled:opacity-50"
                  >
                    {isSaving ? 'Generando OC...' : 'Generar Orden de Compra'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
