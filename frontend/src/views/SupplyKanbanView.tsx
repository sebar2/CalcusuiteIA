import React, { useState, useEffect } from 'react';
import { 
  GitPullRequest, 
  Clock, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  RotateCw,
  Edit2,
  ShoppingCart,
} from 'lucide-react';
import { apiService, getCurrentRole } from '../services/api';
import { OrderDetailModal } from '../components/supply/OrderDetailModal';
import type {
  SupplyKanbanResponse,
  SupplyKanbanStage,
  SupplyOrder,
  SupplyOrderUpdate,
  PurchaseOrderSuggestionsResponse,
  PurchaseOrderSuggestionItem,
} from '../types';

interface SupplyKanbanViewProps {
  onlyAlerts?: boolean;
  leadTimeFilter?: boolean;
  searchQuery?: string;
  currentRole?: string;
}

export const SupplyKanbanView: React.FC<SupplyKanbanViewProps> = ({
  onlyAlerts = false,
  leadTimeFilter = false,
  searchQuery = '',
  currentRole,
}) => {
  const [kanban, setKanban] = useState<SupplyKanbanResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [movingOrderId, setMovingOrderId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SupplyOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Modal de Órdenes de Compra Sugeridas (Cruce Stock x CRM)
  const [poSuggestionsModalOpen, setPoSuggestionsModalOpen] = useState<boolean>(false);
  const [poSuggestions, setPoSuggestions] = useState<PurchaseOrderSuggestionsResponse | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(false);

  const fetchKanban = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const data = await apiService.getSupplyKanban();
      setKanban(data);
    } catch (err: any) {
      console.error('Error fetching supply kanban', err);
      setActionError('Error al sincronizar el pipeline Kanban de abastecimiento.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKanban();
  }, []);

  const handleAdvanceStage = async (order: SupplyOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    const stageFlow: Record<string, string> = {
      sugerido: 'aprobacion',
      aprobacion: 'fabricacion',
      fabricacion: 'transito',
      transito: 'ingresado',
    };

    const nextStage = stageFlow[order.etapa];
    if (!nextStage) return;

    setMovingOrderId(order.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      await apiService.updateSupplyOrderStage(order.id, nextStage);
      setActionSuccess(`Orden #${order.id} (${order.sku_id}) avanzada a '${nextStage}' correctamente.`);
      await fetchKanban();
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Error al procesar la transición de etapa.';
      setActionError(`⛔ Segregación de Funciones: ${detail}`);
    } finally {
      setMovingOrderId(null);
    }
  };

  const handleCardClick = (order: SupplyOrder) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const handleSaveOrderModal = async (orderId: number, data: SupplyOrderUpdate) => {
    await apiService.updateOrder(orderId, data);
    setActionSuccess(`Orden #${orderId} actualizada exitosamente.`);
    await fetchKanban();
  };

  const handleOpenPoSuggestions = async () => {
    setIsLoadingSuggestions(true);
    setPoSuggestionsModalOpen(true);
    try {
      const res = await apiService.getPurchaseOrderSuggestions();
      setPoSuggestions(res);
    } catch (err: any) {
      console.error('Error fetching PO suggestions:', err);
      setActionError('Error al calcular sugerencias de compra cruzando Stock y CRM.');
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Pipeline Summary */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] rounded-lg">
              <GitPullRequest size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#333333] dark:text-slate-100">
                Pipeline Kanban de Reposición y Capital Inmovilizado
              </h2>
              <p className="text-xs text-[#535c69] dark:text-slate-400">
                Flujo operativo de compras según ROP, autorizaciones por segregación de roles y trazabilidad por lote.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleOpenPoSuggestions}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-[1.02]"
            title="Cálculo inteligente de compras cruzando ROP, Stock real y Demanda activa de CRM"
          >
            <ShoppingCart size={15} />
            <span>🛒 Órdenes de Compra Sugeridas</span>
          </button>

          <div className="text-right pl-2 border-l border-slate-200 dark:border-slate-800">
            <span className="text-[10px] font-semibold text-[#535c69] dark:text-slate-400 block uppercase tracking-wider">
              Capital en Pipeline
            </span>
            <span className="text-lg font-bold font-mono text-[#00a2e8]">
              ${Number(kanban?.total_pipeline_capital ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <button
            onClick={fetchKanban}
            disabled={isLoading}
            className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#535c69] dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
            title="Refrescar Kanban"
          >
            <RotateCw size={16} className={isLoading ? 'animate-spin text-[#00a2e8]' : ''} />
          </button>
        </div>
      </div>

      {/* Alertas de Operación / RBAC Feedback */}
      {actionError && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start space-x-2.5 text-xs text-rose-800 dark:text-rose-300 animate-in fade-in">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Acción Bloqueada por Seguridad Financiera</span>
            <span>{actionError}</span>
          </div>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Kanban Board Container: 5 Etapas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {kanban?.stages.map((stage: SupplyKanbanStage) => {
          // Filtrado de órdenes según chips de la barra superior
          const filteredOrders = stage.orders.filter((ord: SupplyOrder) => {
            if (onlyAlerts && ord.etapa !== 'sugerido') return false;
            if (searchQuery) {
              const q = searchQuery.toLowerCase();
              const matchSku = ord.sku_id.toLowerCase().includes(q);
              const matchProv = ord.proveedor.toLowerCase().includes(q);
              const matchResp = ord.responsable.toLowerCase().includes(q);
              if (!matchSku && !matchProv && !matchResp) return false;
            }
            if (leadTimeFilter) {
              // si tiene lead time > 30d (fecha arribo estimada futura > 30 días)
              const today = new Date();
              const eta = new Date(ord.fecha_arribo_estimada);
              const diffDays = Math.ceil((eta.getTime() - today.getTime()) / (1000 * 3600 * 24));
              if (diffDays <= 30) return false;
            }
            return true;
          });

          return (
            <div
              key={stage.id}
              className="bg-[#f8fafc] dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col min-w-[260px] shadow-2xs"
            >
              {/* Header de Etapa con Color y Total Acumulado */}
              <div 
                className="p-3.5 rounded-t-2xl border-b border-slate-200/80 dark:border-slate-800"
                style={{ borderTop: `4px solid ${stage.color_hex}` }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-[#333333] dark:text-slate-100 flex items-center space-x-1.5">
                    <span>{stage.name}</span>
                  </span>
                  <span className="px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-full border border-slate-200 dark:border-slate-700">
                    {filteredOrders.length}
                  </span>
                </div>

                {/* Acumulador de Capital Inmovilizado en Cabecera */}
                <div className="bg-white/80 dark:bg-slate-800/80 rounded-lg px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-[10px] text-[#535c69] dark:text-slate-400 font-medium uppercase tracking-tight">
                    Capital Acum.:
                  </span>
                  <span 
                    className="text-xs font-bold font-mono"
                    style={{ color: stage.color_hex === '#2fc6f6' ? '#0284c7' : stage.color_hex }}
                  >
                    ${Number(stage.total_capital).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Lista de Tarjetas de Órdenes */}
              <div className="p-3 space-y-3 flex-1 min-h-[350px]">
                {filteredOrders.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-600">
                    <Clock size={20} className="mb-1 opacity-50" />
                    <span className="text-[11px]">Sin órdenes en esta etapa</span>
                  </div>
                ) : (
                  filteredOrders.map((order: SupplyOrder) => (
                    <div
                      key={order.id}
                      onClick={() => handleCardClick(order)}
                      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 p-3.5 shadow-2xs hover:shadow-md hover:border-[#00a2e8] transition-all space-y-2.5 cursor-pointer group"
                    >
                      {/* SKU Header & Amount */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[#00a2e8] bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded flex items-center space-x-1">
                          <span>{order.sku_id}</span>
                          <Edit2 size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                          ${Number(order.monto_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="space-y-1 text-[11px] text-[#535c69] dark:text-slate-400">
                        <div className="flex items-center justify-between">
                          <span>Unidades:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{order.cantidad} un.</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Proveedor:</span>
                          <span className="truncate max-w-[130px] font-medium" title={order.proveedor}>
                            {order.proveedor}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Responsable:</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{order.responsable}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span>Trazabilidad:</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                            {(order as any).lote || `LOT-2026-${order.sku_id}`}
                          </span>
                        </div>
                      </div>

                      {/* Footer & Actions */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px]">
                        <div className="flex items-center space-x-1 text-slate-400 dark:text-slate-500">
                          <Calendar size={12} />
                          <span>ETA: {order.fecha_arribo_estimada}</span>
                        </div>

                        {order.etapa !== 'ingresado' && (() => {
                          const effectiveRole = currentRole || getCurrentRole();
                          const isRestrictedForOps = effectiveRole === 'analista_operaciones' && Number(order.monto_total) > 5000;
                          
                          if (isRestrictedForOps) {
                            return (
                              <button
                                disabled={true}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-md font-semibold text-[10px] cursor-not-allowed border border-slate-200 dark:border-slate-700 flex items-center space-x-1"
                                title="Requiere aprobación de Controller Admin (Monto > $5,000)"
                              >
                                <span className="line-through">Avanzar</span>
                                <span className="text-[9px]">🔒 &gt;$5k</span>
                              </button>
                            );
                          }

                          return (
                            <button
                              onClick={(e) => handleAdvanceStage(order, e)}
                              disabled={movingOrderId === order.id}
                              className="px-2 py-1 bg-slate-50 dark:bg-slate-700 hover:bg-[#00a2e8] dark:hover:bg-[#00a2e8] text-slate-600 dark:text-slate-200 hover:text-white rounded-md font-semibold transition-colors border border-slate-200 dark:border-slate-600 hover:border-transparent flex items-center space-x-1"
                              title="Avanzar etapa (Requiere Controller Admin si > $5,000)"
                            >
                              <span>Avanzar</span>
                              <span>→</span>
                            </button>
                          );
                        })()}
                        {order.etapa === 'ingresado' && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-0.5">
                            <CheckCircle2 size={12} />
                            <span>En Stock</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Detalle y Edición de Orden */}
      <OrderDetailModal
        isOpen={isModalOpen}
        order={selectedOrder}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrder(null);
        }}
        onSave={handleSaveOrderModal}
      />

      {/* Modal de Órdenes de Compra Sugeridas (Cruce Stock x CRM) */}
      {poSuggestionsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Motor de Órdenes de Compra Inteligentes
                  </h3>
                  <p className="text-xs text-slate-500">
                    Algoritmo determinístico: Cruce de Punto de Pedido (ROP) + Demanda Activa CRM vs Stock Físico y Tránsito.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPoSuggestionsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* KPI Summary */}
            {poSuggestions && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">SKUs Evaluados</span>
                  <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                    {poSuggestions.total_skus_evaluados}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                  <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider">SKUs en Déficit / Comprar</span>
                  <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                    {poSuggestions.total_skus_deficit}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Inversión Estimada Total</span>
                  <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    ${poSuggestions.inversion_total_sugerida_usd.toLocaleString('es-UY', { minimumFractionDigits: 2 })} USD
                  </div>
                </div>
              </div>
            )}

            {/* Tabla de Sugerencias */}
            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
              {isLoadingSuggestions ? (
                <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                  <RotateCw size={24} className="animate-spin text-indigo-600 mx-auto" />
                  <p>Cruzando inventarios y acuerdos comerciales en CRM...</p>
                </div>
              ) : poSuggestions?.sugerencias.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  🎉 No hay déficit en inventario. Todo el stock físico y en tránsito cubre holgadamente el ROP y los tratos de CRM.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-500 font-semibold uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="px-3.5 py-3">SKU & Nombre</th>
                      <th className="px-3 py-3 text-right">Stock Dep.</th>
                      <th className="px-3 py-3 text-right">Tránsito</th>
                      <th className="px-3 py-3 text-right">Demanda CRM</th>
                      <th className="px-3 py-3 text-right">ROP</th>
                      <th className="px-3.5 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">Sugerido</th>
                      <th className="px-3 py-3 text-right">Costo Unit.</th>
                      <th className="px-3 py-3 text-right">Total USD</th>
                      <th className="px-3.5 py-3">Lote Asignado</th>
                      <th className="px-3 py-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {poSuggestions?.sugerencias.map((sug: PurchaseOrderSuggestionItem) => (
                      <tr key={sug.sku} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-3.5 py-2.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-white block">{sug.sku}</span>
                          <span className="text-[11px] text-slate-500 line-clamp-1">{sug.nombre}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">{sug.stock_actual} u.</td>
                        <td className="px-3 py-2.5 text-right font-mono">{sug.stock_transito} u.</td>
                        <td className="px-3 py-2.5 text-right font-mono text-amber-600 font-semibold">{sug.demanda_crm_comprometida} u.</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">{sug.rop} u.</td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                          +{sug.cantidad_sugerida_compra}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">${sug.costo_unitario_usd.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-100">
                          ${sug.monto_total_usd.toLocaleString('es-UY', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {sug.lote_sugerido}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => {
                              alert(`Orden de compra generada para ${sug.sku} (${sug.cantidad_sugerida_compra} u.) con lote ${sug.lote_sugerido}.`);
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors inline-flex items-center space-x-1"
                          >
                            <span>📝 Generar PO</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0 text-xs">
              <span className="text-slate-500">
                Fórmula: Deficit = max(0, (ROP + Demanda CRM) - (Stock Depósito + Tránsito))
              </span>
              <button
                onClick={() => setPoSuggestionsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
