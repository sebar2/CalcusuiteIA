import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  PlusCircle, 
  CheckCircle2, 
  FileText, 
  DollarSign, 
  Layers, 
  Printer, 
  X, 
  Search, 
  AlertTriangle, 
  RotateCcw, 
  ShoppingBag 
} from 'lucide-react';
import { apiService } from '../services/api';
import type { Invoice, InvoiceSummary, ClientSearchResult, ProductSearchResult } from '../types';
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

  // Selector de Orden de Venta
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [showOrderPicker, setShowOrderPicker] = useState(false);

  // Búsqueda predictiva de Clientes (>2 letras)
  const [clientSearchText, setClientSearchText] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<ClientSearchResult[]>([]);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const [selectedClientMeta, setSelectedClientMeta] = useState<ClientSearchResult | null>(null);

  // Búsqueda predictiva de Productos (>2 letras)
  const [activeItemSearchIdx, setActiveItemSearchIdx] = useState<number | null>(null);
  const [productSuggestions, setProductSuggestions] = useState<ProductSearchResult[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    cliente_nombre: '',
    cliente_rut: '',
    cliente_documento: '',
    tipo_documento_receptor: 'RUT',
    es_consumidor_final: false,
    cliente_direccion: 'Montevideo, Uruguay',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    forma_pago: 'CREDITO_30_DIAS',
    tipo_cfe: '111_E_FACTURA',
    orden_compra_ref: '',
    factura_referencia_id: undefined as number | undefined,
    moneda: 'UYU',
    tipo_cambio: 1.0,
    notas: 'Comprobante Fiscal Electrónico (CFE) emitido bajo normativa DGI.',
  });

  const [formItems, setFormItems] = useState<Array<{
    sku_id?: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    tasa_iva_pct: number;
  }>>([
    { sku_id: 'SKU-LED-P6060', descripcion: 'Panel LED 60x60 40W 4000K Backlight', cantidad: 50, precio_unitario: 29.90, tasa_iva_pct: 22.0 }
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

  // Cargar órdenes de venta para el selector
  useEffect(() => {
    if (showCreateModal) {
      apiService.getSalesOrdersAvailable()
        .then(res => setSalesOrders(res))
        .catch(err => console.error('Error fetching sales orders:', err));
    }
  }, [showCreateModal]);

  // Autocompletado de Clientes (>2 letras)
  useEffect(() => {
    if (clientSearchText.trim().length >= 2) {
      setIsSearchingClients(true);
      const timer = setTimeout(async () => {
        try {
          const res = await apiService.searchClientsPredictive(clientSearchText.trim());
          setClientSuggestions(res);
        } catch (err) {
          console.error(err);
        } finally {
          setIsSearchingClients(false);
        }
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setClientSuggestions([]);
    }
  }, [clientSearchText]);

  const handleSelectClient = (c: ClientSearchResult) => {
    setSelectedClientMeta(c);
    setClientSearchText(c.razon_social || c.nombre);
    setFormData(prev => ({
      ...prev,
      cliente_nombre: c.razon_social || c.nombre,
      cliente_rut: c.rut || c.documento,
      cliente_documento: c.documento || c.rut,
      tipo_documento_receptor: c.tipo_documento || (c.es_consumidor_final ? 'CI' : 'RUT'),
      es_consumidor_final: c.es_consumidor_final,
      cliente_direccion: c.address || prev.cliente_direccion,
      forma_pago: c.es_consumidor_final ? 'CONTADO' : prev.forma_pago
    }));
    setClientSuggestions([]);
  };

  const handleToggleConsumidorFinal = (isConsumer: boolean) => {
    setFormData(prev => ({
      ...prev,
      es_consumidor_final: isConsumer,
      tipo_documento_receptor: isConsumer ? 'CI' : 'RUT',
      forma_pago: isConsumer ? 'CONTADO' : 'CREDITO_30_DIAS'
    }));
  };

  // Autocompletado de Productos (>2 letras)
  const handleProductSearchChange = async (idx: number, text: string) => {
    const updated = [...formItems];
    updated[idx].descripcion = text;
    setFormItems(updated);
    setActiveItemSearchIdx(idx);

    if (text.trim().length >= 2) {
      setIsSearchingProducts(true);
      try {
        const res = await apiService.searchProductsPredictive(text.trim());
        setProductSuggestions(res);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingProducts(false);
      }
    } else {
      setProductSuggestions([]);
    }
  };

  const handleSelectProduct = (idx: number, p: ProductSearchResult) => {
    const updated = [...formItems];
    updated[idx] = {
      sku_id: p.sku,
      descripcion: p.nombre,
      cantidad: updated[idx].cantidad || 1,
      precio_unitario: p.precio_unitario,
      tasa_iva_pct: p.tasa_iva_pct || 22.0
    };
    setFormItems(updated);
    setProductSuggestions([]);
    setActiveItemSearchIdx(null);
  };

  const handleLoadSalesOrder = (so: any) => {
    setFormData(prev => ({
      ...prev,
      cliente_nombre: so.cliente,
      cliente_rut: so.rut || prev.cliente_rut,
      orden_compra_ref: so.numero_ov,
      notas: `Facturación de Orden de Venta ${so.numero_ov} aprobada.`
    }));
    if (so.items && so.items.length > 0) {
      setFormItems(so.items.map((it: any) => ({
        sku_id: it.sku,
        descripcion: `Producto SKU: ${it.sku}`,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        tasa_iva_pct: 22.0
      })));
    }
    setShowOrderPicker(false);
  };

  const handleSelectReferenceInvoice = (refInvId: number) => {
    const ref = invoices.find(i => i.id === refInvId);
    if (!ref) return;

    setFormData(prev => ({
      ...prev,
      factura_referencia_id: ref.id,
      cliente_nombre: ref.cliente_nombre,
      cliente_rut: ref.cliente_rut,
      cliente_documento: ref.cliente_documento || ref.cliente_rut,
      tipo_documento_receptor: ref.tipo_documento_receptor || 'RUT',
      es_consumidor_final: !!ref.es_consumidor_final,
      cliente_direccion: ref.cliente_direccion || prev.cliente_direccion,
      notas: `Nota de Crédito correspondiente a ${ref.numero_factura}. Anulación/Ajuste total.`
    }));

    if (ref.items && ref.items.length > 0) {
      setFormItems(ref.items.map(it => ({
        sku_id: it.sku_id,
        descripcion: `Ajuste/Devolución: ${it.descripcion}`,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        tasa_iva_pct: it.tasa_iva_pct
      })));
    }
  };

  const handleAddItem = () => {
    setFormItems([...formItems, { descripcion: '', cantidad: 1, precio_unitario: 0.0, tasa_iva_pct: 22.0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], [field]: value };
    setFormItems(updated);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let iva = 0;
    formItems.forEach((it) => {
      const lineSubtotal = (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0);
      const lineIva = lineSubtotal * ((Number(it.tasa_iva_pct) || 0) / 100);
      subtotal += lineSubtotal;
      iva += lineIva;
    });
    return { subtotal, iva, total: subtotal + iva };
  };

  const totals = calculateTotals();

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    // Validación de Consumidor Final con Crédito
    if (formData.es_consumidor_final && formData.forma_pago.includes('CREDITO')) {
      setFormError('Los clientes Consumidor Final sólo pueden operar al Contado.');
      setIsSubmitting(false);
      return;
    }

    try {
      await apiService.createInvoice({
        ...formData,
        items: formItems.map(it => ({
          sku_id: it.sku_id,
          descripcion: it.descripcion,
          cantidad: Number(it.cantidad) || 1,
          precio_unitario: Number(it.precio_unitario) || 0,
          tasa_iva_pct: Number(it.tasa_iva_pct) || 22
        }))
      });

      setShowCreateModal(false);
      // Reset form
      setFormData({
        cliente_nombre: '',
        cliente_rut: '',
        cliente_documento: '',
        tipo_documento_receptor: 'RUT',
        es_consumidor_final: false,
        cliente_direccion: 'Montevideo, Uruguay',
        fecha_emision: new Date().toISOString().split('T')[0],
        fecha_vencimiento: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        forma_pago: 'CREDITO_30_DIAS',
        tipo_cfe: '111_E_FACTURA',
        orden_compra_ref: '',
        factura_referencia_id: undefined,
        moneda: 'UYU',
        tipo_cambio: 1.0,
        notas: 'Comprobante Fiscal Electrónico (CFE) emitido bajo normativa DGI.',
      });
      setSelectedClientMeta(null);
      setClientSearchText('');
      fetchInvoices();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || err.message || 'Error al emitir comprobante');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (invoiceId: number, newStatus: string) => {
    try {
      await apiService.updateInvoiceStatus(invoiceId, newStatus);
      fetchInvoices();
      if (selectedInvoice && selectedInvoice.id === invoiceId) {
        setSelectedInvoice({ ...selectedInvoice, estado: newStatus });
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const q = searchQuery.toLowerCase();
    return (
      inv.numero_factura.toLowerCase().includes(q) ||
      inv.cliente_nombre.toLowerCase().includes(q) ||
      inv.cliente_rut.toLowerCase().includes(q)
    );
  });

  return (
    <ErrorBoundary>
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-[#00a2e8]/10 text-[#00a2e8] rounded-xl font-mono text-xs font-bold">
                DGI CFE 2026
              </span>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Facturación B2B & Comprobantes Fiscales
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Emisión de e-Facturas (111), Notas de Crédito (112), cálculo de IVA 22%/10% y control de crédito B2B.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setFormData(prev => ({ ...prev, tipo_cfe: '111_E_FACTURA' }));
                setShowCreateModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#00a2e8] hover:bg-[#008ecb] text-white text-xs font-semibold shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <PlusCircle size={15} />
              <span>Emitir Factura</span>
            </button>
            <button
              onClick={() => {
                setFormData(prev => ({ ...prev, tipo_cfe: '112_NOTA_CREDITO' }));
                setShowCreateModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <RotateCcw size={15} />
              <span>Nota de Crédito</span>
            </button>
          </div>
        </div>

        {/* KPIs Consolidados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Facturado (Neto NC)"
            value={`$${(summary?.total_facturado || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle={`${summary?.cantidad_facturas || 0} comprobantes emitidos`}
            icon={DollarSign}
            iconColor="text-sky-600"
            iconBg="bg-sky-50 dark:bg-sky-950/40"
          />
          <MetricCard
            title="IVA Débito Fiscal (DGI)"
            value={`$${(summary?.iva_debito_fiscal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle="Obligación fiscal por ventas"
            icon={Layers}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
          />
          <MetricCard
            title="Cuentas por Cobrar"
            value={`$${(summary?.cuentas_por_cobrar || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle="Crédito B2B emitido pendiente"
            icon={Receipt}
            iconColor="text-amber-600"
            iconBg="bg-amber-50 dark:bg-amber-950/40"
          />
          <MetricCard
            title="Total Cobrado"
            value={`$${(summary?.total_cobrado || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle={`${summary?.cantidad_anuladas || 0} anuladas / acreditadas`}
            icon={CheckCircle2}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50 dark:bg-indigo-950/40"
          />
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nro de factura, cliente o RUT/CI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#00a2e8]"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#00a2e8]"
            >
              <option value="">Todos los Estados</option>
              <option value="EMITIDA">Emitidas (Pendientes)</option>
              <option value="COBRADA">Cobradas</option>
              <option value="ANULADA">Anuladas / Acreditadas</option>
            </select>

            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#00a2e8]"
            >
              <option value="2026-07">Julio 2026 (Demo)</option>
              <option value="2026-08">Agosto 2026 (Demo)</option>
              <option value="2026-09">Setiembre 2026 (Demo)</option>
              <option value="2026-10">Octubre 2026 (Demo)</option>
              <option value="">Ver Todo</option>
            </select>
          </div>
        </div>

        {/* Tabla de Facturas */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
              Comprobantes Fiscales Registrados ({filteredInvoices.length})
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Homologación DGI: Serie A (e-Factura) / NC (Nota de Crédito)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#f5f7f8] dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Comprobante</th>
                  <th className="py-3 px-4">Fecha Emisión</th>
                  <th className="py-3 px-4">Cliente / Razón Social</th>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Condición</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">IVA</th>
                  <th className="py-3 px-4 text-right">Total ($)</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      Cargando comprobantes fiscales de DGI...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      No se encontraron facturas ni notas de crédito registradas para este filtro.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const isNC = inv.tipo_cfe?.includes('NOTA_CREDITO') || inv.numero_factura.startsWith('NC');
                    return (
                      <tr 
                        key={inv.id} 
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                          isNC ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
                          {isNC ? (
                            <span className="p-1 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">NC</span>
                          ) : (
                            <span className="p-1 rounded bg-sky-100 text-sky-700 text-[10px] font-bold">CFE</span>
                          )}
                          <span>{inv.numero_factura}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                          {inv.fecha_emision}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {inv.cliente_nombre}
                          </span>
                          {inv.orden_compra_ref && (
                            <span className="text-[10px] text-indigo-500 font-mono">Ref OV: {inv.orden_compra_ref}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 mr-1 font-bold">
                            {inv.tipo_documento_receptor || (inv.es_consumidor_final ? 'CI' : 'RUT')}
                          </span>
                          {inv.cliente_documento || inv.cliente_rut}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {inv.forma_pago === 'CONTADO' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Contado
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Crédito 30d
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                          ${inv.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                          ${(inv.monto_iva_basico + inv.monto_iva_minimo).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          <span className={isNC ? 'text-rose-600 dark:text-rose-400' : ''}>
                            {isNC ? '-' : ''}${inv.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {inv.estado === 'COBRADA' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Cobrada
                            </span>
                          )}
                          {inv.estado === 'EMITIDA' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              Emitida
                            </span>
                          )}
                          {inv.estado === 'ANULADA' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              Anulada
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="p-1 text-slate-500 hover:text-[#00a2e8] transition-colors cursor-pointer"
                            title="Ver CFE DGI Impreso"
                          >
                            <FileText size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* MODAL: Emitir Nueva Factura / Nota de Crédito                         */}
        {/* ===================================================================== */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-sky-50/50 dark:bg-slate-900">
                <div className="flex items-center space-x-2.5">
                  <span className={`p-2 rounded-xl ${formData.tipo_cfe.includes('NOTA_CREDITO') ? 'bg-rose-500/10 text-rose-600' : 'bg-[#00a2e8]/10 text-[#00a2e8]'}`}>
                    {formData.tipo_cfe.includes('NOTA_CREDITO') ? <RotateCcw size={20} /> : <Receipt size={20} />}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      {formData.tipo_cfe.includes('NOTA_CREDITO') ? 'Emitir Nota de Crédito (CFE 112)' : 'Emitir Factura Comercial B2B (CFE 111)'}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formData.tipo_cfe.includes('NOTA_CREDITO') 
                        ? 'Invierte el asiento contable y reduce la deuda del cliente en Cobranzas.'
                        : 'Genera el asiento de venta, liquida IVA y valida el límite de crédito del cliente.'}
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
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center space-x-2">
                    <AlertTriangle size={16} className="shrink-0 text-rose-600" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Tipo de Comprobante & Acciones Rápidas */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tipo_cfe: '111_E_FACTURA' })}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                        formData.tipo_cfe === '111_E_FACTURA'
                          ? 'bg-[#00a2e8] text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200'
                      }`}
                    >
                      e-Factura (111)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, tipo_cfe: '112_NOTA_CREDITO' })}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                        formData.tipo_cfe === '112_NOTA_CREDITO'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 border border-slate-200'
                      }`}
                    >
                      Nota de Crédito (112)
                    </button>
                  </div>

                  {/* Botón Cargar desde Orden de Venta */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowOrderPicker(!showOrderPicker)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <ShoppingBag size={14} />
                      <span>Cargar desde Orden de Venta</span>
                    </button>
                    {showOrderPicker && (
                      <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 px-2">Órdenes Disponibles:</span>
                        {salesOrders.length === 0 ? (
                          <div className="p-2 text-slate-400 text-center">No hay órdenes pendientes</div>
                        ) : (
                          salesOrders.map((so) => (
                            <button
                              key={so.id}
                              type="button"
                              onClick={() => handleLoadSalesOrder(so)}
                              className="w-full text-left p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer"
                            >
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-100 block">{so.numero_ov}</span>
                                <span className="text-[10px] text-slate-500">{so.cliente}</span>
                              </div>
                              <span className="font-mono font-semibold text-emerald-600">${so.total.toLocaleString()}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Si es Nota de Crédito: Selector de Factura a Referenciar */}
                {formData.tipo_cfe === '112_NOTA_CREDITO' && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900 space-y-2">
                    <label className="block font-bold text-rose-800 dark:text-rose-300">
                      Seleccionar Factura a Anular / Acreditar:
                    </label>
                    <select
                      value={formData.factura_referencia_id || ''}
                      onChange={(e) => handleSelectReferenceInvoice(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-lg p-2 font-mono text-slate-800 dark:text-slate-100 focus:outline-none"
                    >
                      <option value="">-- Seleccionar comprobante original --</option>
                      {invoices.filter(i => !i.tipo_cfe?.includes('NOTA_CREDITO')).map(i => (
                        <option key={i.id} value={i.id}>
                          {i.numero_factura} - {i.cliente_nombre} (${i.total.toLocaleString()} UYU)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Tipo de Receptor: Empresa B2B (RUT) vs Consumidor Final (CI) */}
                <div className="flex items-center space-x-4 pt-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Tipo de Receptor:</span>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="receptorType"
                      checked={!formData.es_consumidor_final}
                      onChange={() => handleToggleConsumidorFinal(false)}
                      className="text-[#00a2e8] focus:ring-[#00a2e8]"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Empresa B2B (RUT)</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="receptorType"
                      checked={formData.es_consumidor_final}
                      onChange={() => handleToggleConsumidorFinal(true)}
                      className="text-[#00a2e8] focus:ring-[#00a2e8]"
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Consumidor Final (CI)</span>
                  </label>
                </div>

                {/* Cliente / Razón Social & RUT / CI con Búsqueda Predictiva (>2 letras) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {formData.es_consumidor_final ? 'Nombre del Consumidor Final' : 'Razón Social / Nombre Comercial'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Escribe más de 2 letras para sugerencias..."
                        value={clientSearchText || formData.cliente_nombre}
                        onChange={(e) => {
                          setClientSearchText(e.target.value);
                          setFormData({ ...formData, cliente_nombre: e.target.value });
                        }}
                        className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                      />
                      {isSearchingClients && (
                        <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">Buscando...</span>
                      )}
                    </div>

                    {/* Dropdown de Sugerencias de Clientes */}
                    {clientSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {clientSuggestions.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectClient(c)}
                            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-100 block">{c.razon_social || c.nombre}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{c.tipo_documento}: {c.documento || c.rut}</span>
                            </div>
                            <div className="text-right">
                              {c.es_consumidor_final ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">Final (Contado)</span>
                              ) : (
                                <span className="text-[10px] text-emerald-600 font-mono block">Cupo: ${c.cupo_disponible.toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {formData.es_consumidor_final ? 'Cédula de Identidad (CI)' : 'RUT del Cliente (12 dígitos)'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={formData.es_consumidor_final ? 'e.g. 4.567.890-1' : '219998880017'}
                      value={formData.cliente_rut}
                      onChange={(e) => setFormData({ ...formData, cliente_rut: e.target.value, cliente_documento: e.target.value })}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                    />
                  </div>
                </div>

                {/* Banner de Límite de Crédito del Cliente */}
                {selectedClientMeta && (
                  <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
                    selectedClientMeta.es_consumidor_final 
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : selectedClientMeta.bloqueo_credito
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    <div>
                      <span className="font-bold block">
                        {selectedClientMeta.es_consumidor_final 
                          ? 'Cliente Consumidor Final: Crédito Bloqueado por Política Corporativa'
                          : `Límite de Crédito: $${selectedClientMeta.limite_credito.toLocaleString()} UYU`}
                      </span>
                      {!selectedClientMeta.es_consumidor_final && (
                        <span className="text-[11px] opacity-90">
                          Deuda actual: ${selectedClientMeta.deuda_acumulada.toLocaleString()} | Cupo disponible: ${selectedClientMeta.cupo_disponible.toLocaleString()}
                        </span>
                      )}
                    </div>
                    {totals.total > selectedClientMeta.cupo_disponible && !selectedClientMeta.es_consumidor_final && (
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-rose-200 text-rose-900">
                        Excede Cupo
                      </span>
                    )}
                  </div>
                )}

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
                      disabled={formData.es_consumidor_final}
                      className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8] disabled:opacity-60"
                    >
                      <option value="CONTADO">Contado Inmediato</option>
                      <option value="CREDITO_30_DIAS">Crédito 30 días</option>
                      <option value="CREDITO_60_DIAS">Crédito 60 días</option>
                      <option value="TRANSFERENCIA_BROU">Transferencia Bancaria BROU</option>
                    </select>
                    {formData.es_consumidor_final && (
                      <span className="text-[10px] text-amber-600 block mt-0.5">
                        * Consumidor Final restringido a Contado.
                      </span>
                    )}
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

                {/* Ítems de la Factura con Búsqueda Predictiva de SKU/Nombre */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Líneas de Facturación ({formItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-[#00a2e8] hover:text-[#008ecb] font-semibold text-xs flex items-center space-x-1 cursor-pointer"
                    >
                      <PlusCircle size={13} />
                      <span>Agregar Ítem</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {formItems.map((item, idx) => (
                      <div key={idx} className="relative p-3 bg-[#f5f7f8] dark:bg-slate-800/60 rounded-xl space-y-2">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-6 relative">
                            <input
                              type="text"
                              required
                              placeholder="Buscar producto por SKU o nombre (>2 letras)..."
                              value={item.descripcion}
                              onChange={(e) => handleProductSearchChange(idx, e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                            />
                            {activeItemSearchIdx === idx && isSearchingProducts && (
                              <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-mono">Buscando...</span>
                            )}
                            {/* Dropdown de Sugerencias de Productos */}
                            {activeItemSearchIdx === idx && productSuggestions.length > 0 && (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                                {productSuggestions.map((p) => (
                                  <div
                                    key={p.sku}
                                    onClick={() => handleSelectProduct(idx, p)}
                                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between"
                                  >
                                    <div>
                                      <span className="font-bold text-slate-800 dark:text-slate-100 block">{p.nombre}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">SKU: {p.sku} | Stock: {p.stock_actual} un.</span>
                                    </div>
                                    <span className="font-mono font-semibold text-emerald-600 text-xs">${p.precio_unitario.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              min="1"
                              required
                              placeholder="Cant"
                              value={item.cantidad}
                              onChange={(e) => handleItemChange(idx, 'cantidad', e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-right text-slate-800 dark:text-slate-100"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              placeholder="Precio"
                              value={item.precio_unitario}
                              onChange={(e) => handleItemChange(idx, 'precio_unitario', e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono text-right text-slate-800 dark:text-slate-100"
                            />
                          </div>

                          <div className="col-span-1">
                            <select
                              value={item.tasa_iva_pct}
                              onChange={(e) => handleItemChange(idx, 'tasa_iva_pct', Number(e.target.value))}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-1 py-1.5 text-[10px] text-slate-800 dark:text-slate-100 font-mono"
                            >
                              <option value="22">22%</option>
                              <option value="10">10%</option>
                              <option value="0">0%</option>
                            </select>
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              disabled={formItems.length === 1}
                              className="text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-30 cursor-pointer"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resumen de Totales e Impuestos */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl space-y-1.5 font-mono text-xs border border-slate-200/80 dark:border-slate-800">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal Neto:</span>
                    <span>${totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>IVA Total (22% / 10%):</span>
                    <span>${totals.iva.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1.5 border-t border-slate-200 dark:border-slate-700 text-sm">
                    <span>Total Comprobante:</span>
                    <span>${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {formData.moneda}</span>
                  </div>
                </div>

                {/* Botón de Enviar */}
                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-5 py-2 rounded-xl font-bold text-white shadow-sm transition-all cursor-pointer ${
                      formData.tipo_cfe.includes('NOTA_CREDITO')
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : 'bg-[#00a2e8] hover:bg-[#008ecb]'
                    }`}
                  >
                    {isSubmitting ? 'Homologando con DGI...' : formData.tipo_cfe.includes('NOTA_CREDITO') ? 'Emitir Nota de Crédito' : 'Emitir Factura Electrónica'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* MODAL: Vista Previa Comprobante Impreso DGI                            */}
        {/* ===================================================================== */}
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 text-slate-900 animate-in fade-in zoom-in-95 space-y-4">
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                <div>
                  <h2 className="font-black text-lg tracking-wider text-slate-900">CALCU S.A.</h2>
                  <p className="text-[11px] text-slate-500">RUT: 219988770014 | Soluciones de Abastecimiento & Finanzas B2B</p>
                  <p className="text-[10px] text-slate-400">Ruta 101 Km 24.5, Parque de las Ciencias, Canelones, Uruguay</p>
                </div>
                <div className="border-2 border-slate-900 p-2 text-center rounded-lg min-w-[150px]">
                  <span className="text-[10px] font-bold block uppercase tracking-wider">
                    {selectedInvoice.tipo_cfe?.includes('NOTA_CREDITO') ? 'NOTA DE CRÉDITO CFE' : 'e-FACTURA DGI'}
                  </span>
                  <span className="font-mono font-black text-sm block">{selectedInvoice.numero_factura}</span>
                  <span className="text-[9px] font-mono text-slate-500">Constancia DGI Homologada</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] block">RECEPTOR / CLIENTE:</span>
                  <strong className="block text-slate-900">{selectedInvoice.cliente_nombre}</strong>
                  <span className="font-mono text-slate-600">
                    {selectedInvoice.tipo_documento_receptor || 'RUT'}: {selectedInvoice.cliente_documento || selectedInvoice.cliente_rut}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] block">FECHA & VENCIMIENTO:</span>
                  <span className="block font-mono">Emisión: {selectedInvoice.fecha_emision}</span>
                  <span className="block font-mono font-semibold text-rose-600">Vence: {selectedInvoice.fecha_vencimiento}</span>
                </div>
              </div>

              {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                <table className="w-full text-xs">
                  <thead className="border-b border-slate-300 font-bold text-slate-600">
                    <tr>
                      <th className="text-left py-1">Descripción</th>
                      <th className="text-right py-1">Cant.</th>
                      <th className="text-right py-1">Precio Unit.</th>
                      <th className="text-right py-1">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {selectedInvoice.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-1 font-sans">{it.descripcion}</td>
                        <td className="py-1 text-right">{it.cantidad}</td>
                        <td className="py-1 text-right">${it.precio_unitario.toLocaleString()}</td>
                        <td className="py-1 text-right font-bold">${it.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="border-t border-slate-200 pt-2 flex justify-between font-mono text-xs">
                <div>
                  <span>IVA Débito: <strong>${(selectedInvoice.monto_iva_basico + selectedInvoice.monto_iva_minimo).toLocaleString()}</strong></span>
                  <span className="block text-[10px] text-slate-400">Condición: {selectedInvoice.forma_pago}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-slate-900">TOTAL: ${selectedInvoice.total.toLocaleString()} {selectedInvoice.moneda}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedInvoice.id, 'COBRADA')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center space-x-1 cursor-pointer"
                  >
                    <CheckCircle2 size={13} />
                    <span>Marcar Cobrada</span>
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedInvoice.id, 'ANULADA')}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center space-x-1 cursor-pointer"
                  >
                    <X size={13} />
                    <span>Anular Comprobante</span>
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center space-x-1 cursor-pointer"
                  >
                    <Printer size={13} />
                    <span>Imprimir CFE</span>
                  </button>
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="px-3 py-1.5 rounded-lg text-slate-500 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default InvoicesB2BView;
