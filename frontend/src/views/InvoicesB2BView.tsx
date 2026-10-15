import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  PlusCircle, 
  CheckCircle2, 
  FileText, 
  Calendar, 
  DollarSign, 
  Layers, 
  Printer, 
  X,
  Search,
  Filter
} from 'lucide-react';
import { apiService } from '../services/api';
import type { Invoice, InvoiceSummary } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

export const InvoicesB2BView: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-07');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    cliente_nombre: '',
    cliente_rut: '',
    cliente_direccion: 'Montevideo, Uruguay',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    forma_pago: 'CREDITO_30_DIAS',
    tipo_cfe: '111_E_FACTURA',
    moneda: 'UYU',
    notas: 'Comprobante Fiscal Electrónico (CFE) emitido bajo normativa DGI.',
  });

  const [formItems, setFormItems] = useState<Array<{
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    tasa_iva_pct: number;
  }>>([
    { descripcion: 'Panel LED 60x60 40W 4000K', cantidad: 50, precio_unitario: 29.90, tasa_iva_pct: 22.0 }
  ]);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      const [list, sum] = await Promise.all([
        apiService.getInvoices({
          periodo: selectedPeriod || undefined,
          estado: statusFilter || undefined,
        }),
        apiService.getInvoicesSummary({
          periodo: selectedPeriod || undefined
        })
      ]);
      setInvoices(list);
      setSummary(sum);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [selectedPeriod, statusFilter]);

  const handleAddItem = () => {
    setFormItems([
      ...formItems,
      { descripcion: '', cantidad: 1, precio_unitario: 0, tasa_iva_pct: 22.0 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], [field]: value };
    setFormItems(updated);
  };

  const calculatedSubtotal = formItems.reduce((acc, it) => acc + (it.cantidad * it.precio_unitario), 0);
  const calculatedIva = formItems.reduce((acc, it) => acc + ((it.cantidad * it.precio_unitario * it.tasa_iva_pct) / 100), 0);
  const calculatedTotal = calculatedSubtotal + calculatedIva;

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cliente_nombre.trim() || !formData.cliente_rut.trim()) {
      setFormError('El nombre del cliente y el RUT son obligatorios.');
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      await apiService.createInvoice({
        ...formData,
        items: formItems
      });
      setShowCreateModal(false);
      setFormItems([{ descripcion: 'Panel LED 60x60 40W 4000K', cantidad: 50, precio_unitario: 29.90, tasa_iva_pct: 22.0 }]);
      fetchInvoices();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Error al emitir e-Factura');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id: number, estado: string) => {
    try {
      await apiService.updateInvoiceStatus(id, estado);
      fetchInvoices();
      if (selectedInvoice && selectedInvoice.id === id) {
        setSelectedInvoice({ ...selectedInvoice, estado });
      }
    } catch (err) {
      console.error('Error changing invoice status:', err);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.numero_factura.toLowerCase().includes(q) ||
      inv.cliente_nombre.toLowerCase().includes(q) ||
      inv.cliente_rut.toLowerCase().includes(q)
    );
  });

  return (
    <ErrorBoundary fallbackTitle="Error al cargar Facturación B2B">
      <div className="space-y-6">
        {/* Cabecera & Selector de Período */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] rounded-xl border border-sky-100 dark:border-sky-900/50">
              <Receipt size={22} />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Facturación Comercial B2B (e-Facturas CFE)
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
                  DGI Uruguay
                </span>
              </div>
              <p className="text-xs text-[#535c69] dark:text-slate-400">
                Emisión de Comprobantes Fiscales Electrónicos (e-Factura 111 y e-Ticket 101) con integración directa a Libro Diario.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2 cursor-pointer focus:outline-none focus:border-[#00a2e8]"
            >
              <option value="">Consolidado 2026 (Todos)</option>
              <option value="2026-07">M7 - Julio 2026 (Demo)</option>
              <option value="2026-08">M8 - Agosto 2026 (Demo)</option>
              <option value="2026-09">M9 - Setiembre 2026 (Demo)</option>
              <option value="2026-10">M10 - Octubre 2026 (Demo)</option>
            </select>

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <PlusCircle size={15} />
              <span>Emitir e-Factura</span>
            </button>
          </div>
        </div>

        {/* KPIs Resumen */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Facturado Bruto"
              value={`$${summary.total_facturado.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              subtitle={`Período: ${selectedPeriod || 'Todos'}`}
              icon={DollarSign}
              iconColor="text-[#00a2e8]"
              iconBg="bg-sky-50 dark:bg-sky-950/40"
            />
            <MetricCard
              title="IVA Débito Fiscal (DGI)"
              value={`$${summary.iva_debito_fiscal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              subtitle="Tasa Básica 22% & Mínima 10%"
              icon={Layers}
              iconColor="text-indigo-600 dark:text-indigo-400"
              iconBg="bg-indigo-50 dark:bg-indigo-950/40"
            />
            <MetricCard
              title="Cuentas por Cobrar B2B"
              value={`$${summary.cuentas_por_cobrar.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              subtitle="Comprobantes pendientes de cobro"
              icon={Calendar}
              iconColor="text-amber-600 dark:text-amber-400"
              iconBg="bg-amber-50 dark:bg-amber-950/40"
            />
            <MetricCard
              title="Comprobantes Emitidos"
              value={`${summary.cantidad_facturas} CFE`}
              subtitle={`${summary.cantidad_anuladas} anulados`}
              icon={Receipt}
              iconColor="text-emerald-600 dark:text-emerald-400"
              iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            />
          </div>
        )}

        {/* Filtros & Tabla de Facturas */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, RUT o número de e-Factura..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#00a2e8]"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter size={14} className="text-slate-400" />
              <span className="text-xs text-slate-500 font-medium">Estado:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-[#00a2e8]"
              >
                <option value="">Todos los Estados</option>
                <option value="EMITIDA">Emitida (Pendiente)</option>
                <option value="COBRADA">Cobrada</option>
                <option value="ANULADA">Anulada</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f5f7f8] dark:bg-slate-800/80 text-[#535c69] dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">Número / CFE</th>
                  <th className="py-3 px-3">Fecha Emisión</th>
                  <th className="py-3 px-3">Cliente B2B / RUT</th>
                  <th className="py-3 px-3 text-right">Subtotal</th>
                  <th className="py-3 px-3 text-right">IVA Débito</th>
                  <th className="py-3 px-3 text-right">Total Factura</th>
                  <th className="py-3 px-3 text-center">Estado</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Cargando comprobantes fiscales...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No se encontraron e-Facturas en este período.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {inv.numero_factura}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {inv.fecha_emision}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{inv.cliente_nombre}</div>
                        <div className="text-[11px] font-mono text-slate-500">RUT: {inv.cliente_rut}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        ${inv.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-indigo-600 dark:text-indigo-400">
                        ${(inv.monto_iva_basico + inv.monto_iva_minimo).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#00a2e8]">
                        ${inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.estado === 'COBRADA' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : inv.estado === 'ANULADA'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                        }`}>
                          {inv.estado}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#00a2e8] hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Ver CFE y Descargar Simulación"
                          >
                            <FileText size={15} />
                          </button>
                          {inv.estado === 'EMITIDA' && (
                            <button
                              onClick={() => handleStatusChange(inv.id, 'COBRADA')}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                              title="Marcar como Cobrada"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL: Emitir Nueva e-Factura */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-sky-50/50 dark:bg-slate-900">
                <div className="flex items-center space-x-2.5">
                  <span className="p-2 bg-[#00a2e8]/10 text-[#00a2e8] rounded-xl">
                    <Receipt size={20} />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      Emitir Nueva e-Factura Comercial B2B (DGI)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Calcula automáticamente IVA 22% y genera el asiento contable por partida doble.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateInvoice} className="p-5 overflow-y-auto space-y-4 text-xs">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Razón Social del Cliente</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Supermercados Ta-Ta S.A."
                      value={formData.cliente_nombre}
                      onChange={(e) => setFormData({ ...formData, cliente_nombre: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">RUT del Cliente (12 dígitos)</label>
                    <input
                      type="text"
                      required
                      placeholder="219998880017"
                      value={formData.cliente_rut}
                      onChange={(e) => setFormData({ ...formData, cliente_rut: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Fecha Emisión</label>
                    <input
                      type="date"
                      value={formData.fecha_emision}
                      onChange={(e) => setFormData({ ...formData, fecha_emision: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Condición de Pago</label>
                    <select
                      value={formData.forma_pago}
                      onChange={(e) => setFormData({ ...formData, forma_pago: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                    >
                      <option value="CREDITO_30_DIAS">Crédito 30 días</option>
                      <option value="CREDITO_60_DIAS">Crédito 60 días</option>
                      <option value="CONTADO">Contado Inmediato</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Moneda</label>
                    <select
                      value={formData.moneda}
                      onChange={(e) => setFormData({ ...formData, moneda: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                    >
                      <option value="UYU">Pesos Uruguayos ($ UYU)</option>
                      <option value="USD">Dólares Americanos (US$)</option>
                    </select>
                  </div>
                </div>

                {/* Ítems de la Factura */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Líneas de Facturación</span>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-xs font-bold text-[#00a2e8] hover:underline cursor-pointer flex items-center space-x-1"
                    >
                      <PlusCircle size={13} />
                      <span>Agregar Ítem</span>
                    </button>
                  </div>

                  {formItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-[#f5f7f8] dark:bg-slate-800/60 rounded-xl grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <input
                          type="text"
                          required
                          placeholder="Descripción del producto o servicio"
                          value={item.descripcion}
                          onChange={(e) => handleItemChange(idx, 'descripcion', e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="Cant"
                          value={item.cantidad}
                          onChange={(e) => handleItemChange(idx, 'cantidad', Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 font-mono text-right text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Precio Unit"
                          value={item.precio_unitario}
                          onChange={(e) => handleItemChange(idx, 'precio_unitario', Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 font-mono text-right text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        {formItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totales Resumen */}
                <div className="p-3 bg-sky-50/60 dark:bg-slate-800 rounded-xl space-y-1 font-mono text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal Neto:</span>
                    <span>${calculatedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>IVA Tasa Básica (22%):</span>
                    <span>${calculatedIva.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-[#00a2e8] pt-1 border-t border-sky-200 dark:border-slate-700">
                    <span>Total Factura CFE:</span>
                    <span>${calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Emitiendo...' : 'Confirmar & Emitir CFE'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Visualización de CFE / Simulación de Comprobante Impreso */}
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Printer size={18} className="text-[#00a2e8]" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    Comprobante Fiscal Electrónico (DGI Uruguay)
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Plantilla CFE DGI */}
              <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-950 font-mono text-xs space-y-3">
                <div className="flex justify-between items-start pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">CALCU S.A.</div>
                    <div className="text-[11px] text-slate-500">RUT: 219998880017 • CFE e-Factura</div>
                    <div className="text-[10px] text-slate-400">Ruta 1 Km 28, Montevideo, Uruguay</div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-950 text-[#00a2e8] text-[10px] font-bold rounded">
                      {selectedInvoice.numero_factura}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">{selectedInvoice.fecha_emision}</div>
                  </div>
                </div>

                <div className="text-[11px] space-y-0.5">
                  <div><strong>Receptor:</strong> {selectedInvoice.cliente_nombre}</div>
                  <div><strong>RUT:</strong> {selectedInvoice.cliente_rut}</div>
                  <div><strong>Condición:</strong> {selectedInvoice.forma_pago}</div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal Gravado (22%):</span>
                    <span>${selectedInvoice.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>IVA Débito Fiscal:</span>
                    <span>${(selectedInvoice.monto_iva_basico + selectedInvoice.monto_iva_minimo).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-slate-100 pt-1 border-t border-slate-300 dark:border-slate-700">
                    <span>TOTAL CFE:</span>
                    <span>${selectedInvoice.total.toLocaleString(undefined, { minimumFractionDigits: 2 })} {selectedInvoice.moneda}</span>
                  </div>
                </div>

                <div className="pt-2 text-center text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                  Constancia CFE DGI Nº 2026-998822 • Asiento Libro Diario generado en partida doble
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};
