import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Calculator,
  Printer,
  FileText,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  X,
  Sparkles,
} from 'lucide-react';
import { logisticsApi } from '../../services/logisticsApi';
import type {
  LogisticsClientItem,
  ServiceSettlementResponse,
  LogisticsOrderItem,
} from '../../services/logisticsApi';

export const LogisticsOrdersView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'settlement'>('orders');
  const [clients, setClients] = useState<LogisticsClientItem[]>([]);
  const [orders, setOrders] = useState<LogisticsOrderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [clientFilter, setClientFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Remito Modal State
  const [selectedOrderForRemito, setSelectedOrderForRemito] = useState<LogisticsOrderItem | null>(null);
  const [isRemitoModalOpen, setIsRemitoModalOpen] = useState<boolean>(false);

  // Settlement Form State
  const [settlementClientId, setSettlementClientId] = useState<string>('');
  const [quoteForm, setQuoteForm] = useState({
    dias_almacenaje: 15,
    pallets: 4,
    total_bultos: 0,
    total_unidades: 0,
    distancia_km: 0.0,
    iva_pct: 22.0,
  });

  const [settlementResult, setSettlementResult] = useState<ServiceSettlementResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cliData, ordData] = await Promise.all([
        logisticsApi.getClients(),
        logisticsApi.getOrders(),
      ]);
      setClients(cliData);
      setOrders(ordData);

      if (cliData.length > 0 && !settlementClientId) {
        setSettlementClientId(String(cliData[0].id));
      }
    } catch (err) {
      console.error('Error al cargar órdenes de servicio 3PL:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    if (clientFilter !== 'ALL' && String(o.client_id) !== clientFilter) return false;
    if (stageFilter !== 'ALL' && o.etapa_kanban !== stageFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = o.numero_orden.toLowerCase().includes(q);
      const matchRem = (o.remito_numero || '').toLowerCase().includes(q);
      const matchCli = (o.client_nombre || '').toLowerCase().includes(q);
      const matchDest = (o.destino_direccion || '').toLowerCase().includes(q);
      if (!matchNum && !matchRem && !matchCli && !matchDest) return false;
    }
    return true;
  });

  // Delivered orders for selected client in settlement tab
  const deliveredOrdersForClient = orders.filter(
    (o) => String(o.client_id) === String(settlementClientId) && o.etapa_kanban === 'ENTREGADO'
  );

  const clientDeliveredTrips = deliveredOrdersForClient.length;
  const clientDeliveredKm = deliveredOrdersForClient.reduce((acc, o) => acc + (o.kilometros_recorrido || 0), 0);
  const clientDeliveredBultos = deliveredOrdersForClient.reduce((acc, o) => acc + (o.total_bultos || 0), 0);
  const clientDeliveredFreight = deliveredOrdersForClient.reduce((acc, o) => acc + (o.tarifa_flete_cliente || 0), 0);

  // Auto-sync or manual load real delivered orders into settlement calculator
  const handleLoadRealDeliveredData = () => {
    const totalUnits = deliveredOrdersForClient.reduce((acc, o) => {
      const itemsUnits = o.items.reduce((iAcc, item) => iAcc + (item.bultos * 12), 0);
      return acc + itemsUnits;
    }, 0);

    setQuoteForm((prev) => ({
      ...prev,
      total_bultos: clientDeliveredBultos || 10,
      total_unidades: totalUnits || (clientDeliveredBultos * 12) || 120,
      distancia_km: parseFloat(clientDeliveredKm.toFixed(1)) || 10.0,
    }));
  };

  // Run calculation when settlementClientId or form changes
  const handleCalculateQuote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!settlementClientId) return;
    try {
      setIsCalculating(true);
      const res = await logisticsApi.calculateQuote({
        client_id: Number(settlementClientId),
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
    if (settlementClientId) {
      handleLoadRealDeliveredData();
    }
  }, [settlementClientId, orders]);

  useEffect(() => {
    if (settlementClientId) {
      handleCalculateQuote();
    }
  }, [settlementClientId, quoteForm.total_bultos, quoteForm.distancia_km, quoteForm.dias_almacenaje, quoteForm.pallets]);

  const selectedClientObj = clients.find((c) => String(c.id) === String(settlementClientId));

  // Handler for Remito actions
  const handleOpenRemito = (o: LogisticsOrderItem) => {
    setSelectedOrderForRemito(o);
    setIsRemitoModalOpen(true);
  };

  const handleDownloadRemitoPdf = async (o: LogisticsOrderItem) => {
    try {
      await logisticsApi.downloadOrderRemitoPdf(o.id, o.numero_orden);
    } catch (err: any) {
      alert(`Error al descargar remito PDF: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handlePrintDocument = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
            <Receipt size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Órdenes de Servicio, Remitos & Liquidaciones 3PL
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Control de despachos, picking parcial, remitos oficiales con QR y liquidación mensual acumulada
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-white dark:bg-slate-900 text-[#00a2e8] shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            📋 Despachos & Remitos ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('settlement')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'settlement'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            🧾 Liquidación Acumulada por Cliente
          </button>
        </div>
      </div>

      {activeTab === 'orders' ? (
        /* ========================================================================= */
        /*                     TAB 1: HISTORIAL DE DESPACHOS & REMITOS               */
        /* ========================================================================= */
        <div className="space-y-4">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Órdenes</span>
              <p className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">{orders.length}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Viajes Entregados</span>
              <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {orders.filter((o) => o.etapa_kanban === 'ENTREGADO').length}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Km Recorridos</span>
              <p className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400 mt-1">
                {orders.reduce((acc, o) => acc + (o.kilometros_recorrido || 0), 0).toFixed(1)} km
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Bultos Despachados</span>
              <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {orders.reduce((acc, o) => acc + (o.total_bultos || 0), 0)}
              </p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs no-print">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">Todos los Clientes</option>
                {clients.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre_comercial}
                  </option>
                ))}
              </select>

              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">Todas las Etapas</option>
                <option value="INGRESO">1. Ingreso & Descarga</option>
                <option value="ETIQUETADO_VAS">2. Acondicionamiento (VAS)</option>
                <option value="LISTO_DESPACHO">3. Listo para Despacho</option>
                <option value="EN_DISTRIBUCION">4. En Distribución</option>
                <option value="ENTREGADO">5. Entregado Conforme</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por orden, remito, cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs no-print">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500">
                    <th className="py-3 px-4">Nº Orden & Remito</th>
                    <th className="py-3 px-4">Cliente & Destino</th>
                    <th className="py-3 px-4">Transportista & Unidad</th>
                    <th className="py-3 px-4 text-center">Carga & Km</th>
                    <th className="py-3 px-4 text-right">Flete & Margen</th>
                    <th className="py-3 px-4 text-center">Estado Kanban</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                        Cargando despachos y órdenes 3PL...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                        No se encontraron órdenes de despacho registradas con los filtros actuales.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => {
                      const isPicking = o.numero_orden.includes('PICK');
                      const isDelivered = o.etapa_kanban === 'ENTREGADO';

                      return (
                        <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                  {o.numero_orden}
                                </span>
                                {isPicking && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                                    Picking
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">{o.remito_numero}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-col max-w-xs">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {o.client_nombre}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate" title={o.destino_direccion}>
                                {o.branch_nombre ? `${o.branch_nombre} • ` : ''}{o.destino_direccion}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {o.driver ? o.driver.nombre : 'Sin Conductor'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {o.vehicle ? `${o.vehicle.matricula} (${o.vehicle.tipo})` : 'Sin Vehículo'}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                              {o.total_bultos} bultos
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {o.kilometros_recorrido?.toFixed(1) || '0.0'} km • {o.total_kg.toFixed(0)} kg
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block">
                              ${o.tarifa_flete_cliente.toFixed(2)}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                              Margen: +${o.margen_neto_estimado.toFixed(2)}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {isDelivered ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                                <CheckCircle2 size={11} />
                                <span>Entregado</span>
                              </span>
                            ) : o.etapa_kanban === 'EN_DISTRIBUCION' ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 animate-pulse">
                                <Truck size={11} />
                                <span>En Ruta</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                <Clock size={11} />
                                <span>{o.etapa_kanban.replace('_', ' ')}</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => handleOpenRemito(o)}
                                className="px-2 py-1 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 rounded-lg text-[11px] font-bold flex items-center space-x-1 cursor-pointer"
                                title="Ver Remito Oficial"
                              >
                                <FileText size={12} />
                                <span>Remito</span>
                              </button>
                              <button
                                onClick={() => handleDownloadRemitoPdf(o)}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title="Descargar PDF"
                              >
                                <Download size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /*                     TAB 2: LIQUIDACIÓN ACUMULADA POR CLIENTE              */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Card Resumen de Órdenes Reales Entregadas */}
          <div className="bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-transparent p-5 rounded-2xl border border-emerald-500/20 dark:border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print shadow-xs">
            <div className="space-y-1">
              <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span>Gestión Logística & Viajes Entregados de {selectedClientObj?.nombre_comercial}</span>
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Se detectaron <b>{clientDeliveredTrips} viajes entregados</b> ({clientDeliveredKm.toFixed(1)} km), <b>{clientDeliveredBultos} bultos</b> procesados{clientDeliveredFreight > 0 ? ` y $ ${clientDeliveredFreight.toLocaleString('es-UY', { minimumFractionDigits: 2 })} en fletes asociados` : ''} en la cuenta de este cliente.
              </p>
            </div>

            <button
              onClick={handleLoadRealDeliveredData}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              <Sparkles size={14} />
              <span>Sincronizar Órdenes Reales al Liquidador</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Interactive Form (5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs no-print">
              <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <Calculator className="text-sky-500" size={18} />
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Parámetros de Liquidación Mensual
                </h2>
              </div>

              <form onSubmit={handleCalculateQuote} className="mt-4 space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Empresa Cliente 3PL
                  </label>
                  <select
                    value={settlementClientId}
                    onChange={(e) => setSettlementClientId(e.target.value)}
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
                      Tarifario Acordado ({selectedClientObj.nombre_comercial}):
                    </span>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                      <span>Almacenaje: <b>${selectedClientObj.pricing.tarifa_almacenaje_pallet_dia}/pallet día</b></span>
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
                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
                      <span>Bultos (Handling)</span>
                      {clientDeliveredBultos > 0 && <span className="text-emerald-600 font-bold">Auto</span>}
                    </label>
                    <input
                      type="number"
                      value={quoteForm.total_bultos}
                      onChange={(e) => setQuoteForm({ ...quoteForm, total_bultos: parseInt(e.target.value, 10) || 0 })}
                      className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Unidades (VAS)</label>
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
                    <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center justify-between">
                      <span>Distancia Total (km)</span>
                      {clientDeliveredKm > 0 && <span className="text-emerald-600 font-bold">Auto</span>}
                    </label>
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
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between printable-document">
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
                    <p className="text-xs text-slate-400">{selectedClientObj?.direccion_central}</p>
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

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between no-print">
                <span className="text-[11px] text-slate-400">
                  Formato de liquidación electrónica oficial 3PL
                </span>
                <button
                  onClick={handlePrintDocument}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
                >
                  <Printer size={14} />
                  <span>Imprimir Liquidación Oficial</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/*               MODAL / VISTA DE REMITO OFICIAL IMPRIMIBLE                  */}
      {/* ========================================================================= */}
      {isRemitoModalOpen && selectedOrderForRemito && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Controls (No Print) */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 no-print">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
                <FileText size={15} className="text-sky-500" />
                <span>Hoja de Remito Oficial de Despacho 3PL</span>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownloadRemitoPdf(selectedOrderForRemito)}
                  className="px-2.5 py-1 text-xs font-bold text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded-lg flex items-center space-x-1 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Descargar PDF</span>
                </button>
                <button
                  onClick={handlePrintDocument}
                  className="px-2.5 py-1 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center space-x-1 cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Imprimir</span>
                </button>
                <button
                  onClick={() => setIsRemitoModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="printable-document p-4 mt-3 bg-white text-slate-900 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between border-b pb-3 border-slate-200">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">CALCU 3PL LOGISTICS</h2>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                    Remito Oficial de Entrega & Despacho de Mercadería
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-sky-600 block">
                    REMITO: {selectedOrderForRemito.remito_numero}
                  </span>
                  <span className="text-[11px] text-slate-500">Orden: {selectedOrderForRemito.numero_orden}</span>
                </div>
              </div>

              {/* Info Blocks */}
              <div className="grid grid-cols-2 gap-4 text-xs border rounded-xl p-3 border-slate-200 bg-slate-50/50">
                <div>
                  <span className="font-bold text-slate-900 block mb-1 text-[11px]">DATOS DE ENTREGA</span>
                  <p><b>Cliente:</b> {selectedOrderForRemito.client_nombre}</p>
                  <p><b>Destino:</b> {selectedOrderForRemito.destino_direccion}</p>
                  <p><b>Contacto:</b> {selectedOrderForRemito.contacto_receptor_nombre || 'Recepción'} (Tel: {selectedOrderForRemito.contacto_receptor_telefono || 'S/D'})</p>
                  <p><b>Armado / Picking:</b> {selectedOrderForRemito.responsable_armado || 'Supervisor Depósito'}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-900 block mb-1 text-[11px]">TRANSPORTE & RUTA</span>
                  <p><b>Conductor:</b> {selectedOrderForRemito.driver?.nombre || 'Chofer Tercerizado'}</p>
                  <p><b>Vehículo:</b> {selectedOrderForRemito.vehicle?.matricula || 'S/M'}</p>
                  <p><b>Distancia:</b> {selectedOrderForRemito.kilometros_recorrido?.toFixed(1) || '0.0'} km</p>
                  <p><b>Ventana:</b> {selectedOrderForRemito.ventana_horaria || '08:00 - 13:00'}</p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <span className="font-bold text-xs text-slate-900 block mb-1.5">DETALLE DE BULTOS / ARTÍCULOS</span>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
                      <th className="py-1.5 px-2">SKU</th>
                      <th className="py-1.5 px-2">Descripción</th>
                      <th className="py-1.5 px-2 text-center">Bultos</th>
                      <th className="py-1.5 px-2 text-right">Peso (kg)</th>
                      <th className="py-1.5 px-2 text-right">Volumen (m³)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedOrderForRemito.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 px-2 font-mono font-bold text-slate-800">{it.sku}</td>
                        <td className="py-1.5 px-2">{it.descripcion}</td>
                        <td className="py-1.5 px-2 text-center font-bold">{it.bultos}</td>
                        <td className="py-1.5 px-2 text-right font-mono">{it.kg.toFixed(1)} kg</td>
                        <td className="py-1.5 px-2 text-right font-mono">{it.m3.toFixed(2)} m³</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-bold text-xs bg-slate-50">
                      <td colSpan={2} className="py-2 px-2">TOTALES:</td>
                      <td className="py-2 px-2 text-center">{selectedOrderForRemito.total_bultos} bultos</td>
                      <td className="py-2 px-2 text-right font-mono">{selectedOrderForRemito.total_kg.toFixed(1)} kg</td>
                      <td className="py-2 px-2 text-right font-mono">{selectedOrderForRemito.total_m3.toFixed(2)} m³</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Footer: Sign Box & QR */}
              <div className="grid grid-cols-12 gap-3 pt-2">
                <div className="col-span-4 border rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
                  <div className="p-1 bg-white border border-slate-300 rounded shadow-xs mb-1">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=85x85&data=CALCU-3PL-REMITO:${selectedOrderForRemito.numero_orden}`}
                      alt="QR Remito"
                      className="w-18 h-18"
                    />
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Verificación Oficial</span>
                </div>

                <div className="col-span-8 border rounded-xl p-3 flex flex-col justify-between text-xs">
                  <span className="font-bold text-[11px] text-slate-900">CONSTANCIA DE CONFORMIDAD</span>
                  {selectedOrderForRemito.firma_digital_receptor ? (
                    <div className="space-y-1">
                      <p className="text-emerald-700 font-bold text-[11px]">✓ FIRMADO DIGITALMENTE EN APP MÓVIL</p>
                      <p className="text-slate-600">Aclaración: <b>{selectedOrderForRemito.firma_aclaracion || selectedOrderForRemito.contacto_receptor_nombre}</b></p>
                      <p className="text-slate-400 text-[10px]">Fecha: {selectedOrderForRemito.firma_fecha_hora || 'Registrada'}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <div className="border-t border-slate-400 pt-1 text-center text-[10px] text-slate-500">
                        Firma del Receptor
                      </div>
                      <div className="border-t border-slate-400 pt-1 text-center text-[10px] text-slate-500">
                        Aclaración & C.I.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[10px] text-center text-slate-400 pt-2 border-t border-slate-100">
                Calcu 3PL Logística & Distribución • Documento de entrega para control administrativo y liquidación de servicios.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogisticsOrdersView;
