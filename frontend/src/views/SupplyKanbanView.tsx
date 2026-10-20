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
  Plus, 
  Info, 
  X, 
  Save, 
  Package, 
  Layers,
  Building2,
} from 'lucide-react';
import { apiService, getCurrentRole } from '../services/api';

import { OrderDetailModal } from '../components/supply/OrderDetailModal';
import { ColumnMultiSelect } from '../components/multilocation/ColumnMultiSelect';
import type {
  SupplyKanbanResponse,
  SupplyKanbanStage,
  SupplyOrder,
  SupplyOrderUpdate,
  PurchaseOrderSuggestionsResponse,
  PurchaseOrderSuggestionItem,
  SupplierItem,
  SupplierCreatePayload,
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
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [movingOrderId, setMovingOrderId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SupplyOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Filtros de proveedores por cada columna / etapa (uno, varios o todos)
  const [stageSupplierFilters, setStageSupplierFilters] = useState<Record<string, string[]>>({});

  // Modal para Crear / Editar Proveedor con todos los datos y catálogo
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);
  const [supFormTipo, setSupFormTipo] = useState<string>('PROVEEDOR_UY');
  const [supFormNombre, setSupFormNombre] = useState<string>('');
  const [supFormRazonSocial, setSupFormRazonSocial] = useState<string>('');
  const [supFormRut, setSupFormRut] = useState<string>('');
  const [supFormPais, setSupFormPais] = useState<string>('Uruguay');
  const [supFormContacto, setSupFormContacto] = useState<string>('');
  const [supFormCargo, setSupFormCargo] = useState<string>('');
  const [supFormEmail, setSupFormEmail] = useState<string>('');
  const [supFormPhone, setSupFormPhone] = useState<string>('');
  const [supFormAddress, setSupFormAddress] = useState<string>('');
  const [supFormDesc, setSupFormDesc] = useState<string>('');
  const [isSavingSupplier, setIsSavingSupplier] = useState<boolean>(false);

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

  const fetchSuppliers = async () => {
    try {
      const list = await apiService.getSuppliers();
      setSuppliers(list);
    } catch (err: any) {
      console.error('Error fetching suppliers for kanban:', err);
    }
  };

  useEffect(() => {
    fetchKanban();
    fetchSuppliers();
  }, []);

  const handleAdvanceStage = async (order: SupplyOrder, targetStageOverride?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Mapeo determinístico de transición entre etapas
    const stageFlow: Record<string, string> = {
      sugerido: 'aprobacion',
      aprobacion: 'fabricacion',
      fabricacion: 'transito',
      transito: 'ingresado',
      proveedor_uy: 'ingresado',
    };

    const nextStage = targetStageOverride || stageFlow[order.etapa];
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

  // Abrir Modal de Proveedor (Nuevo o Edición)
  const handleOpenNewSupplier = (tipo: string = 'PROVEEDOR_UY') => {
    setEditingSupplier(null);
    setSupFormTipo(tipo);
    setSupFormNombre('');
    setSupFormRazonSocial('');
    setSupFormRut('');
    setSupFormPais(tipo === 'FABRICA' ? 'China' : tipo === 'PROVEEDOR_UY' ? 'Uruguay' : 'Internacional');
    setSupFormContacto('');
    setSupFormCargo('');
    setSupFormEmail('');
    setSupFormPhone('');
    setSupFormAddress('');
    setSupFormDesc('');
    setIsSupplierModalOpen(true);
  };

  const handleEditSupplier = (sup: SupplierItem) => {
    setEditingSupplier(sup);
    setSupFormTipo(sup.tipo_proveedor || 'PROVEEDOR_UY');
    setSupFormNombre(sup.nombre || '');
    setSupFormRazonSocial(sup.razon_social || '');
    setSupFormRut(sup.rut || '');
    setSupFormPais(sup.pais || 'Uruguay');
    setSupFormContacto(sup.contacto_nombre || '');
    setSupFormCargo(sup.contacto_cargo || '');
    setSupFormEmail(sup.email || '');
    setSupFormPhone(sup.phone || '');
    setSupFormAddress(sup.address || '');
    setSupFormDesc(sup.descripcion || '');
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supFormNombre.trim()) {
      alert('El nombre comercial del proveedor es obligatorio.');
      return;
    }

    setIsSavingSupplier(true);
    try {
      const payload: SupplierCreatePayload = {
        nombre: supFormNombre.trim(),
        razon_social: supFormRazonSocial.trim() || undefined,
        rut: supFormRut.trim() || undefined,
        tipo_proveedor: supFormTipo,
        pais: supFormPais.trim() || undefined,
        contacto_nombre: supFormContacto.trim() || undefined,
        contacto_cargo: supFormCargo.trim() || undefined,
        email: supFormEmail.trim() || undefined,
        phone: supFormPhone.trim() || undefined,
        address: supFormAddress.trim() || undefined,
        descripcion: supFormDesc.trim() || undefined,
      };

      if (editingSupplier) {
        await apiService.updateSupplier(editingSupplier.id, payload);
        setActionSuccess(`Proveedor "${supFormNombre}" actualizado correctamente.`);
      } else {
        await apiService.createSupplier(payload);
        setActionSuccess(`Proveedor "${supFormNombre}" dado de alta exitosamente.`);
      }

      setIsSupplierModalOpen(false);
      await fetchSuppliers();
      await fetchKanban();
    } catch (err: any) {
      console.error('Error al guardar proveedor:', err);
      alert(err.response?.data?.detail || 'Error al guardar los datos del proveedor.');
    } finally {
      setIsSavingSupplier(false);
    }
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

  // Helper para mapear configuración de proveedores por etapa
  const getStageSupplierConfig = (stageId: string) => {
    if (stageId === 'fabricacion') {
      const list = suppliers.filter(s => s.tipo_proveedor === 'FABRICA' || (!s.tipo_proveedor && s.pais !== 'Uruguay'));
      return {
        enabled: true,
        title: 'Fábricas',
        addBtnText: 'Fábrica',
        targetType: 'FABRICA',
        accentClass: 'text-amber-600',
        options: (list.length > 0 ? list : suppliers).map(s => ({
          id: String(s.id),
          label: s.nombre,
          subLabel: s.pais || 'Fábrica'
        }))
      };
    }
    if (stageId === 'transito') {
      const list = suppliers.filter(s => s.tipo_proveedor === 'NAVIERA_BUQUE' || s.tipo_proveedor === 'LOGISTICA');
      return {
        enabled: true,
        title: 'Buques/Navieras',
        addBtnText: 'Buque',
        targetType: 'NAVIERA_BUQUE',
        accentClass: 'text-blue-600',
        options: (list.length > 0 ? list : suppliers).map(s => ({
          id: String(s.id),
          label: s.nombre,
          subLabel: s.pais || 'Naviera'
        }))
      };
    }
    if (stageId === 'proveedor_uy') {
      const list = suppliers.filter(s => s.tipo_proveedor === 'PROVEEDOR_UY' || s.pais === 'Uruguay' || s.pais === 'UY');
      return {
        enabled: true,
        title: 'Proveedores Uy',
        addBtnText: 'Prov. Uy',
        targetType: 'PROVEEDOR_UY',
        accentClass: 'text-purple-600',
        options: (list.length > 0 ? list : suppliers).map(s => ({
          id: String(s.id),
          label: s.nombre,
          subLabel: s.pais || 'Plaza'
        }))
      };
    }
    return {
      enabled: false,
      title: '',
      addBtnText: '',
      targetType: '',
      accentClass: '',
      options: []
    };
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
                Flujo operativo de 6 etapas: Sugerido, Aprobación, Fabricación, En Alta Mar, Proveedores Uy y Depósito Uruguay.
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
            onClick={() => {
              fetchKanban();
              fetchSuppliers();
            }}
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

      <div className="space-y-6">
{/* Kanban Board Container: 6 Etapas con scroll horizontal suave */}
      <div className="overflow-x-auto pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 min-w-[1450px]">
          {kanban?.stages.map((stage: SupplyKanbanStage) => {
            const stageConf = getStageSupplierConfig(stage.id);
            const selectedSupplierIds = stageSupplierFilters[stage.id] || ['ALL'];

            // Filtrado de órdenes
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
                const today = new Date();
                const eta = new Date(ord.fecha_arribo_estimada);
                const diffDays = Math.ceil((eta.getTime() - today.getTime()) / (1000 * 3600 * 24));
                if (diffDays <= 30) return false;
              }

              // Filtro multi-select por proveedor en esta etapa
              if (stageConf.enabled && selectedSupplierIds.length > 0 && !selectedSupplierIds.includes('ALL')) {
                const matches = selectedSupplierIds.some((fid) => {
                  const sup = suppliers.find((s) => String(s.id) === fid);
                  if (!sup) return false;
                  const provLower = ord.proveedor.toLowerCase();
                  return (
                    provLower.includes(sup.nombre.toLowerCase()) ||
                    (sup.razon_social && provLower.includes(sup.razon_social.toLowerCase()))
                  );
                });
                if (!matches) return false;
              }

              return true;
            });

            return (
              <div
                key={stage.id}
                className="bg-[#f8fafc] dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col min-w-[235px] shadow-2xs"
              >
                {/* Header de Etapa con Color, Contador y Capital */}
                <div 
                  className="p-3.5 rounded-t-2xl border-b border-slate-200/80 dark:border-slate-800 space-y-2.5"
                  style={{ borderTop: `4px solid ${stage.color_hex}` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#333333] dark:text-slate-100 flex items-center space-x-1.5 truncate">
                      <span className="truncate">{stage.name}</span>
                    </span>
                    <span className="px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-full border border-slate-200 dark:border-slate-700 shrink-0">
                      {filteredOrders.length}
                    </span>
                  </div>

                  {/* Acumulador de Capital Inmovilizado en Cabecera */}
                  <div className="bg-white/80 dark:bg-slate-800/80 rounded-lg px-2.5 py-1.5 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-[10px] text-[#535c69] dark:text-slate-400 font-medium uppercase tracking-tight">
                      Capital:
                    </span>
                    <span 
                      className="text-xs font-bold font-mono"
                      style={{ color: stage.color_hex === '#2fc6f6' ? '#0284c7' : stage.color_hex }}
                    >
                      ${Number(stage.total_capital).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Selector Multi-Select de Proveedores y Botón + Agregar Proveedor */}
                  {stageConf.enabled && (
                    <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                      <div className="flex-1 min-w-0">
                        <ColumnMultiSelect
                          label={stageConf.title}
                          allLabel={`Todos (${stageConf.options.length})`}
                          options={stageConf.options}
                          selectedIds={selectedSupplierIds}
                          onChange={(ids) =>
                            setStageSupplierFilters((prev) => ({ ...prev, [stage.id]: ids }))
                          }
                          accentClass={stageConf.accentClass}
                        />
                      </div>

                      {/* Si hay 1 proveedor seleccionado, botón para editar su ficha y catálogo */}
                      {selectedSupplierIds.length === 1 && selectedSupplierIds[0] !== 'ALL' && (() => {
                        const sup = suppliers.find((s) => String(s.id) === selectedSupplierIds[0]);
                        if (!sup) return null;
                        return (
                          <button
                            onClick={() => handleEditSupplier(sup)}
                            className="p-1 text-slate-500 hover:text-indigo-600 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors shrink-0"
                            title="Ver o editar ficha de proveedor y catálogo"
                          >
                            <Info size={13} />
                          </button>
                        );
                      })()}

                      {/* Botón para dar de alta nuevo proveedor en esta etapa */}
                      <button
                        onClick={() => handleOpenNewSupplier(stageConf.targetType)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold shrink-0 flex items-center space-x-0.5 shadow-2xs transition-colors"
                        title={`Registrar nuevo proveedor en ${stageConf.title}`}
                      >
                        <Plus size={11} />
                        <span>+{stageConf.addBtnText}</span>
                      </button>
                    </div>
                  )}
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
                            <span className="truncate max-w-[120px] font-medium text-slate-900 dark:text-slate-200" title={order.proveedor}>
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
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-col gap-1.5 text-[10px]">
                          <div className="flex items-center justify-between text-slate-400 dark:text-slate-500">
                            <div className="flex items-center space-x-1">
                              <Calendar size={12} />
                              <span>ETA: {order.fecha_arribo_estimada}</span>
                            </div>
                          </div>

                          {order.etapa !== 'ingresado' && (() => {
                            const effectiveRole = currentRole || getCurrentRole();
                            const isRestrictedForOps = effectiveRole === 'analista_operaciones' && Number(order.monto_total) > 5000;
                            
                            if (isRestrictedForOps) {
                              return (
                                <button
                                  disabled={true}
                                  className="w-full py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-md font-semibold text-[10px] cursor-not-allowed border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-1"
                                  title="Requiere aprobación de Controller Admin (Monto > $5,000)"
                                >
                                  <span className="line-through">Avanzar</span>
                                  <span className="text-[9px]">🔒 &gt;$5k</span>
                                </button>
                              );
                            }

                            // Si está en aprobación: puede avanzar a Fabricación (Fábrica) o a Proveedores Uy
                            if (order.etapa === 'aprobacion') {
                              return (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => handleAdvanceStage(order, 'fabricacion', e)}
                                    disabled={movingOrderId === order.id}
                                    className="flex-1 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded font-semibold text-[9px] border border-amber-200 dark:border-amber-800 transition-colors"
                                    title="Aprobar para fabricación internacional"
                                  >
                                    → A Fábrica
                                  </button>
                                  <button
                                    onClick={(e) => handleAdvanceStage(order, 'proveedor_uy', e)}
                                    disabled={movingOrderId === order.id}
                                    className="flex-1 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded font-semibold text-[9px] border border-purple-200 dark:border-purple-800 transition-colors"
                                    title="Canalizar a proveedor local de plaza"
                                  >
                                    → A Prov. Uy
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <button
                                onClick={(e) => handleAdvanceStage(order, undefined, e)}
                                disabled={movingOrderId === order.id}
                                className="w-full py-1 bg-slate-50 dark:bg-slate-700 hover:bg-[#00a2e8] dark:hover:bg-[#00a2e8] text-slate-600 dark:text-slate-200 hover:text-white rounded-md font-semibold transition-colors border border-slate-200 dark:border-slate-600 hover:border-transparent flex items-center justify-center space-x-1"
                                title="Avanzar a siguiente etapa del pipeline"
                              >
                                <span>Avanzar</span>
                                <span>→</span>
                              </button>
                            );
                          })()}

                          {order.etapa === 'ingresado' && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center space-x-0.5 py-0.5">
                              <CheckCircle2 size={12} />
                              <span>En Stock Físico</span>
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
      </div>

      {/* Modal de Detalle y Edición de Orden */}
              </div>

      <OrderDetailModal
        isOpen={isModalOpen}
        order={selectedOrder}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrder(null);
        }}
        onSave={handleSaveOrderModal}
      />

      {/* Modal de Proveedor (Alta / Edición con Datos Completos y Catálogo) */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {editingSupplier ? `Editar Proveedor: ${editingSupplier.nombre}` : 'Registrar Nuevo Proveedor'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gestión comercial, datos fiscales, catálogo de SKUs y órdenes de compra.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Formulario con Scroll */}
            <form onSubmit={handleSaveSupplier} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Proveedor
                  </label>
                  <select
                    value={supFormTipo}
                    onChange={(e) => setSupFormTipo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="PROVEEDOR_UY">Proveedor Uy (Plaza / Reventa)</option>
                    <option value="FABRICA">Fábrica de Origen</option>
                    <option value="NAVIERA_BUQUE">Naviera / Buque Internacional</option>
                    <option value="LOGISTICA">Logística / Flete Terrestre</option>
                    <option value="GENERAL">General / Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre Comercial *
                  </label>
                  <input
                    type="text"
                    required
                    value={supFormNombre}
                    onChange={(e) => setSupFormNombre(e.target.value)}
                    placeholder="Ej: Distribuidora Central Uy"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Razón Social
                  </label>
                  <input
                    type="text"
                    value={supFormRazonSocial}
                    onChange={(e) => setSupFormRazonSocial(e.target.value)}
                    placeholder="Ej: S.A. o S.R.L."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    RUT / Tax ID
                  </label>
                  <input
                    type="text"
                    value={supFormRut}
                    onChange={(e) => setSupFormRut(e.target.value)}
                    placeholder="Ej: 219999990014"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    País
                  </label>
                  <input
                    type="text"
                    value={supFormPais}
                    onChange={(e) => setSupFormPais(e.target.value)}
                    placeholder="Uruguay, China, etc."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre del Contacto
                  </label>
                  <input
                    type="text"
                    value={supFormContacto}
                    onChange={(e) => setSupFormContacto(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cargo del Contacto
                  </label>
                  <input
                    type="text"
                    value={supFormCargo}
                    onChange={(e) => setSupFormCargo(e.target.value)}
                    placeholder="Ej: Gerente Comercial"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={supFormEmail}
                    onChange={(e) => setSupFormEmail(e.target.value)}
                    placeholder="contacto@proveedor.com"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={supFormPhone}
                    onChange={(e) => setSupFormPhone(e.target.value)}
                    placeholder="+598 99 123 456"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={supFormAddress}
                    onChange={(e) => setSupFormAddress(e.target.value)}
                    placeholder="Ruta 101 Km 23.5"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descripción u Observaciones
                </label>
                <textarea
                  rows={2}
                  value={supFormDesc}
                  onChange={(e) => setSupFormDesc(e.target.value)}
                  placeholder="Detalles sobre tiempos de entrega, acuerdos o condiciones comerciales..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Si estamos editando un proveedor existente: Mostrar Catálogo y Órdenes asociadas */}
              {editingSupplier && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                      <Layers size={14} className="text-indigo-600" />
                      <span>Catálogo de Productos Vinculados ({editingSupplier.productos?.length || 0})</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Total SKUs: {editingSupplier.total_skus || 0}</span>
                  </div>

                  {editingSupplier.productos && editingSupplier.productos.length > 0 ? (
                    <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                      {editingSupplier.productos.map((prod) => (
                        <div key={prod.product_id || prod.sku} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <div>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">{prod.sku}</span>
                            <span className="text-slate-500 ml-2">{prod.nombre}</span>
                          </div>
                          <div className="text-right font-mono">
                            <span className="text-slate-700 dark:text-slate-300 font-bold">Costo: ${(prod.costo_unitario || 0).toFixed(2)}</span>
                            {prod.lead_time_dias && (
                              <span className="text-slate-400 text-[10px] ml-2">({prod.lead_time_dias}d lead time)</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center text-xs text-slate-400">
                      Sin productos vinculados directamente a este proveedor.
                    </div>
                  )}

                  {/* Órdenes de compra registradas */}
                  {editingSupplier.ordenes_compra && editingSupplier.ordenes_compra.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                        <Package size={14} className="text-emerald-600" />
                        <span>Órdenes de Compra ({editingSupplier.ordenes_compra.length})</span>
                      </span>
                      <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                        {editingSupplier.ordenes_compra.map((oc) => (
                          <div key={oc.id} className="p-2 flex items-center justify-between text-xs">
                            <span className="font-mono text-slate-700 dark:text-slate-300">OC #{oc.id} — SKU {oc.sku_id}</span>
                            <span className="font-mono font-semibold">${Number(oc.monto_total).toLocaleString()}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 uppercase">{oc.etapa}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botones Acciones Formulario */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition-all"
                >
                  <Save size={14} />
                  <span>{isSavingSupplier ? 'Guardando...' : editingSupplier ? 'Actualizar Proveedor' : 'Guardar Proveedor'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
