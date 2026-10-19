import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Package,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Percent,
  Warehouse,
  TrendingUp,
  KeyRound,
  Clock,
  Loader2,
  SlidersHorizontal,
  PauseCircle,
  PlayCircle,
  Edit3,
  Save,
  X,
  Truck,
  Search,
  Printer,
  Download,
  LayoutGrid,
  List,
  DollarSign,
  Calendar,
  MapPin,
  CheckSquare,
  FileText,
  ArrowUpRight,
} from 'lucide-react';
import { apiService } from '../../services/api';
import type {
  MeliReadyProductItem,
  IntegrationChannelConfig,
  MeliSellerReputationResponse,
  MeliMyItem,
  MeliOrder,
  MeliFpaMetrics,
  MeliKanbanStage,
} from '../../types';
import { MeliPublishModal } from '../../components/integrations/MeliPublishModal';

interface MercadoLibreViewProps {
  currentRole?: string;
  onNavigateToChat?: (dealId?: string) => void;
  onNavigateToCRM?: () => void;
}

type MeliTab = 'publications' | 'catalog' | 'orders' | 'stock_pricing' | 'qa_chat' | 'analytics' | 'settings';

export const MercadoLibreView: React.FC<MercadoLibreViewProps> = ({
  currentRole = 'controller_admin',
  onNavigateToChat,
  onNavigateToCRM,
}) => {
  const [activeTab, setActiveTab] = useState<MeliTab>('publications');
  const [channelConfig, setChannelConfig] = useState<IntegrationChannelConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);
  const [reputation, setReputation] = useState<MeliSellerReputationResponse | null>(null);

  // Publicaciones oficiales del vendedor en MeLi (En Vivo)
  const [myItems, setMyItems] = useState<MeliMyItem[]>([]);
  const [isLoadingMyItems, setIsLoadingMyItems] = useState<boolean>(false);
  const [myItemsStatusFilter, setMyItemsStatusFilter] = useState<string>('all');
  const [myItemsSearch, setMyItemsSearch] = useState<string>('');
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  // Edición rápida inline (precio / stock)
  const [editingItem, setEditingItem] = useState<{ id: string; price: number; available_quantity: number } | null>(null);

  // Selector de columnas personalizables para Mis Publicaciones
  const [myItemsColumns, setMyItemsColumns] = useState({
    image: true,
    title: true,
    category: true,
    price: true,
    stock: true,
    sold: true,
    status: true,
    shipping: true,
    dates: false,
    actions: true,
  });
  const [showMyItemsColMenu, setShowMyItemsColMenu] = useState<boolean>(false);

  // Catálogo interno y productos Calcu
  const [products, setProducts] = useState<MeliReadyProductItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Selector de columnas personalizables para Catálogo Calcu
  const [catalogColumns, setCatalogColumns] = useState({
    image: true,
    product: true,
    category: true,
    cost: false,
    price: true,
    stock: true,
    status: true,
    actions: true,
  });
  const [showCatalogColMenu, setShowCatalogColMenu] = useState<boolean>(false);

  // Modal de publicación
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<MeliReadyProductItem | null>(null);

  // Sincronización en curso
  const [syncingSku, setSyncingSku] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  // Simulador de Pricing & Comisiones MeLi
  const [simPrice, setSimPrice] = useState<number>(1500);
  const [simCost, setSimCost] = useState<number>(850);
  const [simListingType, setSimListingType] = useState<'gold_special' | 'gold_pro'>('gold_special');

  // Órdenes Operativas, Kanban y FP&A
  const [orders, setOrders] = useState<MeliOrder[]>([]);
  const [fpaMetrics, setFpaMetrics] = useState<MeliFpaMetrics | null>(null);
  const [stagesCount, setStagesCount] = useState<Record<MeliKanbanStage, number>>({
    por_preparar: 0,
    en_transito: 0,
    entregado: 0,
    reclamos: 0,
    cancelado: 0,
  });
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);
  const [ordersDays, setOrdersDays] = useState<number>(30);
  const [ordersViewMode, setOrdersViewMode] = useState<'kanban' | 'table'>('kanban');
  const [ordersSearch, setOrdersSearch] = useState<string>('');
  const [ordersStageFilter, setOrdersStageFilter] = useState<string>('all');
  const [ordersSortBy, setOrdersSortBy] = useState<string>('date_desc');
  const [selectedOrderForRemito, setSelectedOrderForRemito] = useState<MeliOrder | null>(null);

  // Columnas personalizables para Tabla de Órdenes
  const [ordersColumns, setOrdersColumns] = useState({
    order_id: true,
    date: true,
    buyer: true,
    city: true,
    products: true,
    quantity: true,
    shipping_status: true,
    tracking: true,
    sla: true,
    monto_bruto: true,
    comision_meli: true,
    costo_envio: false,
    cogs: false,
    ingreso_neto: true,
    margen_pct: true,
    crm_deal: true,
    actions: true,
  });
  const [showOrdersColMenu, setShowOrdersColMenu] = useState<boolean>(false);

  const isAdmin = currentRole === 'controller_admin';

  // 1. Cargar estado de la integración y reputación
  const loadIntegrationStatus = async () => {
    setIsLoadingConfig(true);
    try {
      const channels = await apiService.getIntegrationChannels();
      const meli = channels.find((c) => c.channel === 'MERCADO_LIBRE');
      if (meli) {
        setChannelConfig(meli);
        if (meli.status === 'CONNECTED') {
          apiService
            .getMeliSellerReputation()
            .then((rep) => setReputation(rep))
            .catch(() => setReputation(null));
        } else {
          setReputation(null);
        }
      }
    } catch (err) {
      console.warn('Error cargando configuración de MeLi:', err);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  // 2. Cargar publicaciones en vivo del vendedor en Mercado Libre
  const loadMyMeliItems = async (statusFilter?: string) => {
    setIsLoadingMyItems(true);
    try {
      const res = await apiService.getMyMeliItems({
        status: statusFilter && statusFilter !== 'all' ? statusFilter : undefined,
      });
      setMyItems(res.items || []);
    } catch (err: any) {
      console.warn('Error cargando publicaciones de MeLi:', err);
    } finally {
      setIsLoadingMyItems(false);
    }
  };

  // 3. Cargar productos listos para MeLi del inventario interno
  const loadReadyProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const items = await apiService.getMeliReadyProducts();
      setProducts(items);
    } catch (err) {
      console.warn('Error cargando productos MeLi:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // 4. Cargar órdenes de venta oficiales de MeLi
  const loadOrders = async (days: number = ordersDays, stage?: string) => {
    setIsLoadingOrders(true);
    try {
      const res = await apiService.getMeliOrders({
        days,
        stage: stage && stage !== 'all' ? stage : undefined,
      });
      setOrders(res.orders || []);
      setFpaMetrics(res.fpa_metrics || null);
      if (res.stages_count) {
        setStagesCount(res.stages_count);
      }
    } catch (err: any) {
      console.warn('Error cargando órdenes de MeLi:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadIntegrationStatus();
    loadReadyProducts();
    loadMyMeliItems();
    loadOrders();
  }, []);

  // Alternar estado activo / pausado en 1 clic
  const handleToggleStatus = async (item: MeliMyItem) => {
    const newStatus = item.status === 'active' ? 'paused' : 'active';
    setUpdatingItemId(item.id);
    try {
      await apiService.updateMeliItem(item.id, { status: newStatus });
      setMyItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: newStatus } : it))
      );
      setBannerMsg({
        type: 'success',
        text: `Publicación ${item.id} actualizada: estado cambiado a ${newStatus === 'active' ? 'ACTIVA' : 'PAUSADA'}.`,
      });
    } catch (err: any) {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.detail || `Error al cambiar estado de la publicación ${item.id}.`,
      });
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Guardar edición rápida inline de precio y stock
  const handleSaveQuickEdit = async (itemId: string) => {
    if (!editingItem || editingItem.id !== itemId) return;
    setUpdatingItemId(itemId);
    try {
      await apiService.updateMeliItem(itemId, {
        price: editingItem.price,
        available_quantity: editingItem.available_quantity,
      });
      setMyItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? { ...it, price: editingItem.price, available_quantity: editingItem.available_quantity }
            : it
        )
      );
      setBannerMsg({
        type: 'success',
        text: `Publicación ${itemId} actualizada: Precio UYU $${editingItem.price} | Stock: ${editingItem.available_quantity} un.`,
      });
      setEditingItem(null);
    } catch (err: any) {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.detail || `Error al actualizar precio/stock de ${itemId}.`,
      });
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Flujo OAuth 2.0 oficial
  const handleConnectOAuth = async () => {
    try {
      const res = await apiService.getMeliAuthUrl();
      if (res && res.auth_url) {
        const popup = window.open(
          res.auth_url,
          'MeliOAuthPopup',
          'width=650,height=750,scrollbars=yes,status=yes'
        );
        const timer = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(timer);
            loadIntegrationStatus();
            setBannerMsg({
              type: 'success',
              text: 'Flujo OAuth 2.0 finalizado. Verificando estado de vinculación en Bóveda...',
            });
          }
        }, 1500);
      }
    } catch (err: any) {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.detail || 'No se pudo iniciar la autorización de Mercado Libre.',
      });
    }
  };

  // Sincronizar stock de un producto con MeLi
  const handleSyncStock = async (product: MeliReadyProductItem) => {
    setSyncingSku(product.sku);
    try {
      const res = await apiService.syncMeliItemStock(`MLU-SKU-${product.sku}`, product.sku);
      setBannerMsg({
        type: 'success',
        text: `Stock de ${product.nombre} sincronizado: ${res.deposito_central_stock} unidades en Depósito Central.`,
      });
    } catch (err: any) {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.detail || `Error al sincronizar existencias de ${product.sku}.`,
      });
    } finally {
      setSyncingSku(null);
    }
  };

  const isConnected = channelConfig?.status === 'CONNECTED';

  // Cálculos del simulador de pricing
  const commissionRate = simListingType === 'gold_pro' ? 0.18 : 0.14;
  const commissionAmount = simPrice * commissionRate;
  const netRevenue = simPrice - commissionAmount;
  const contributionMargin = netRevenue - simCost;
  const marginPct = simPrice > 0 ? ((contributionMargin / simPrice) * 100).toFixed(1) : '0';

  // Filtrado de productos del inventario interno
  const filteredProducts = products.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.categoria.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Filtrado de publicaciones de Mercado Libre (En Vivo)
  const filteredMyItems = myItems.filter((it: MeliMyItem) => {
    const s = myItemsSearch.toLowerCase().trim();
    const matchesSearch =
      !s ||
      (it.title && it.title.toLowerCase().includes(s)) ||
      (it.id && it.id.toLowerCase().includes(s)) ||
      (it.category_id && it.category_id.toLowerCase().includes(s));

    const matchesStatus =
      myItemsStatusFilter === 'all' || it.status === myItemsStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filtrado y ordenamiento de órdenes operativas MeLi
  const filteredOrders = orders
    .filter((o) => {
      const s = ordersSearch.toLowerCase().trim();
      const matchesSearch =
        !s ||
        o.id.toLowerCase().includes(s) ||
        o.buyer_name.toLowerCase().includes(s) ||
        o.buyer_nickname.toLowerCase().includes(s) ||
        o.primary_sku.toLowerCase().includes(s) ||
        o.primary_item_title.toLowerCase().includes(s) ||
        (o.tracking_number && o.tracking_number.toLowerCase().includes(s));

      const matchesStage =
        ordersStageFilter === 'all' || o.kanban_stage === ordersStageFilter;

      return matchesSearch && matchesStage;
    })
    .sort((a, b) => {
      if (ordersSortBy === 'date_desc') {
        return new Date(b.date_created || 0).getTime() - new Date(a.date_created || 0).getTime();
      }
      if (ordersSortBy === 'date_asc') {
        return new Date(a.date_created || 0).getTime() - new Date(b.date_created || 0).getTime();
      }
      if (ordersSortBy === 'amount_desc') {
        return b.monto_bruto - a.monto_bruto;
      }
      if (ordersSortBy === 'margin_desc') {
        return b.margen_pct - a.margen_pct;
      }
      return 0;
    });

  // Exportar reporte de órdenes a Excel/CSV con BOM UTF-8
  const handleExportOrdersCsv = () => {
    if (!filteredOrders.length) return;
    const headers = [
      'ID Orden',
      'Fecha Venta',
      'Etapa Kanban',
      'Estado Envio',
      'Tracking',
      'SLA Despacho',
      'Comprador',
      'Ciudad',
      'Direccion',
      'SKU Principal',
      'Producto',
      'Cantidad Total',
      'Monto Bruto UYU',
      'Comision MeLi',
      'Costo Envio',
      'Costo Calcu COGS',
      'Ingreso Neto',
      'Margen %',
      'Estado Payout',
      'Tiene Reclamo',
      'ID Trato CRM'
    ];

    const rows = filteredOrders.map((o) => [
      `"${o.id}"`,
      `"${o.date_created ? new Date(o.date_created).toLocaleString() : ''}"`,
      `"${o.kanban_stage_name}"`,
      `"${o.shipping_status}"`,
      `"${o.tracking_number || ''}"`,
      `"${o.sla_status === 'DELAYED' ? 'VENCIDO' : (o.sla_hours_remaining != null ? `${o.sla_hours_remaining}h` : 'OK')}"`,
      `"${(o.buyer_name || o.buyer_nickname).replace(/"/g, '""')}"`,
      `"${(o.buyer_city || '').replace(/"/g, '""')}"`,
      `"${(o.shipping_address || '').replace(/"/g, '""')}"`,
      `"${o.primary_sku || ''}"`,
      `"${(o.primary_item_title || '').replace(/"/g, '""')}"`,
      o.items_count,
      o.monto_bruto.toFixed(2),
      o.comision_meli.toFixed(2),
      o.costo_envio.toFixed(2),
      o.cogs.toFixed(2),
      o.ingreso_neto.toFixed(2),
      `${o.margen_pct.toFixed(1)}%`,
      `"${o.payout_status}"`,
      o.has_claim ? 'SI' : 'NO',
      `"${o.deal_id || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MeLi_Ordenes_Calcu_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal de Mercado Libre Uruguay */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FFE600] text-[#2D3277] flex items-center justify-center font-bold shadow-lg shadow-amber-500/10">
            <ShoppingBag size={28} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Mercado Libre Uruguay (MLU)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#FFE600] text-[#2D3277]">
                App Oficial 5376694505612300
              </span>
              {isConnected ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  <span>Conectado · Bóveda AES-256</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  <span>Requiere Vinculación OAuth2</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Catálogo sincronizado, prospección en tiempo real, chat pre/post venta con IA y reputación oficial.
            </p>
          </div>
        </div>

        {/* Acciones Rápidas de la Cabecera */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isConnected ? (
            <button
              type="button"
              onClick={() => {
                setSelectedProductForModal(null);
                setIsPublishModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFE600] hover:bg-[#ffe100] text-[#2D3277] font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer transition-all"
            >
              <Sparkles size={14} />
              <span>Nueva Publicación (1 Clic)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnectOAuth}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFE600] hover:bg-[#ffe100] text-[#2D3277] font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer transition-all animate-pulse"
            >
              <KeyRound size={14} />
              <span>Vincular Cuenta MeLi (OAuth 2.0)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              loadIntegrationStatus();
              loadReadyProducts();
              loadMyMeliItems();
              loadOrders();
            }}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Recargar estado general"
          >
            <RefreshCw size={15} className={isLoadingConfig || isLoadingProducts || isLoadingOrders || isLoadingMyItems ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Banner de Notificaciones */}
      {bannerMsg && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            bannerMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : bannerMsg.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <span>{bannerMsg.text}</span>
          <button
            onClick={() => setBannerMsg(null)}
            className="font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Alerta Preventiva si la Bóveda no tiene token activo */}
      {!isConnected && (
        <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <span className="font-bold block">Autorización OAuth 2.0 Requerida</span>
              <span>
                Para publicar artículos, sincronizar inventario y recibir preguntas pre-venta en &ldquo;1. Prospección&rdquo;, autorice la cuenta oficial de Mercado Libre.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleConnectOAuth}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFE600] hover:bg-[#ffe100] text-[#2D3277] font-bold text-xs shadow-xs cursor-pointer"
          >
            <KeyRound size={13} />
            <span>Autorizar con MeLi</span>
          </button>
        </div>
      )}

      {/* Selector de Pestañas Temáticas */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('publications')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'publications'
              ? 'bg-[#FFE600] text-[#2D3277] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShoppingBag size={14} />
          <span>1. Mis Publicaciones MeLi (En Vivo)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {myItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'catalog'
              ? 'bg-[#FFE600] text-[#2D3277] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Package size={14} />
          <span>2. Catálogo Calcu (Inventario)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {products.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('orders');
            loadOrders();
          }}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-[#FFE600] text-[#2D3277] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Truck size={14} />
          <span>3. Ventas, Envíos &amp; Reclamos (Kanban / Tabla)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {orders.length}
          </span>
          {stagesCount.reclamos > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-extrabold animate-pulse">
              {stagesCount.reclamos} Reclamo{stagesCount.reclamos > 1 ? 's' : ''}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stock_pricing')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'stock_pricing'
              ? 'bg-[#FFE600] text-[#2D3277] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <RefreshCw size={14} />
          <span>4. Sincronización de Stock &amp; Pricing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('qa_chat')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'qa_chat'
              ? 'bg-[#FFE600] text-[#2D3277] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <MessageSquare size={14} />
          <span>5. Preguntas Pre-Venta &amp; Chat MeLi</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-[#FFE600] text-[#2D3277] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp size={14} />
          <span>6. Métricas, Reputación &amp; Ventas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-[#FFE600] text-[#2D3277] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <KeyRound size={14} />
          <span>7. Bóveda OAuth2 &amp; Webhooks</span>
        </button>
      </div>

      {/* =========================================================================
          PESTAÑA 1: MIS PUBLICACIONES MELI (EN VIVO)
      ========================================================================= */}
      {activeTab === 'publications' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {/* Buscador */}
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={myItemsSearch}
                  onChange={(e) => setMyItemsSearch(e.target.value)}
                  placeholder="Buscar por título, ID (MLU...) o categoría..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Filtro por Estado */}
              <select
                value={myItemsStatusFilter}
                onChange={(e) => {
                  setMyItemsStatusFilter(e.target.value);
                  loadMyMeliItems(e.target.value);
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
              >
                <option value="all">Todos los estados ({myItems.length})</option>
                <option value="active">Activas</option>
                <option value="paused">Pausadas</option>
                <option value="closed">Cerradas / Finalizadas</option>
              </select>

              {/* Selector de Columnas Visibles */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMyItemsColMenu(!showMyItemsColMenu)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors cursor-pointer"
                >
                  <SlidersHorizontal size={13} />
                  <span>Columnas</span>
                </button>
                {showMyItemsColMenu && (
                  <div className="absolute left-0 mt-1.5 z-30 w-48 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl space-y-1 text-xs">
                    <span className="font-bold text-[10px] text-slate-400 px-1 uppercase tracking-wider block">
                      Columnas Visibles
                    </span>
                    {Object.entries({
                      image: 'Foto',
                      title: 'Título & ID',
                      category: 'Categoría',
                      price: 'Precio',
                      stock: 'Stock MeLi',
                      sold: 'Ventas',
                      status: 'Estado',
                      shipping: 'Envíos',
                      dates: 'Fechas',
                      actions: 'Acciones',
                    }).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(myItemsColumns as any)[key]}
                          onChange={(e) => setMyItemsColumns((prev) => ({ ...prev, [key]: e.target.checked }))}
                          className="w-3.5 h-3.5 text-amber-500 rounded border-slate-300"
                        />
                        <span className="text-slate-800 dark:text-slate-200">{label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadMyMeliItems(myItemsStatusFilter)}
                disabled={isLoadingMyItems}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Refrescar publicaciones en vivo"
              >
                <RefreshCw size={14} className={isLoadingMyItems ? 'animate-spin' : ''} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedProductForModal(null);
                  setIsPublishModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFE600] hover:bg-[#ffe100] text-[#2D3277] font-bold text-xs shadow-xs cursor-pointer"
              >
                <Sparkles size={13} />
                <span>Nueva Publicación</span>
              </button>
            </div>
          </div>

          {/* Tabla de Publicaciones MeLi */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    {myItemsColumns.image && <th className="py-3 px-3 w-12 text-center">Foto</th>}
                    {myItemsColumns.title && <th className="py-3 px-4">Publicación MeLi</th>}
                    {myItemsColumns.category && <th className="py-3 px-3">Categoría</th>}
                    {myItemsColumns.price && <th className="py-3 px-3 text-right">Precio</th>}
                    {myItemsColumns.stock && <th className="py-3 px-3 text-right">Stock MeLi</th>}
                    {myItemsColumns.sold && <th className="py-3 px-3 text-right">Ventas</th>}
                    {myItemsColumns.status && <th className="py-3 px-3 text-center">Estado</th>}
                    {myItemsColumns.shipping && <th className="py-3 px-3">Envíos</th>}
                    {myItemsColumns.dates && <th className="py-3 px-3">Fechas</th>}
                    {myItemsColumns.actions && <th className="py-3 px-4 text-center">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoadingMyItems ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <Loader2 size={22} className="animate-spin mx-auto mb-2 text-amber-500" />
                        <span>Consultando publicaciones en vivo de Mercado Libre...</span>
                      </td>
                    </tr>
                  ) : filteredMyItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-400">
                        <ShoppingBag size={28} className="mx-auto mb-2 opacity-40 text-amber-500" />
                        <span className="block font-semibold">No se encontraron publicaciones oficiales de Mercado Libre.</span>
                        <span className="text-[11px] text-slate-400">Haga clic en &ldquo;Nueva Publicación&rdquo; o verifique que su cuenta esté vinculada en la pestaña Bóveda.</span>
                      </td>
                    </tr>
                  ) : (
                    filteredMyItems.map((item) => {
                      const isEditing = editingItem?.id === item.id;
                      const isUpdating = updatingItemId === item.id;
                      const thumb = item.thumbnail || (item.pictures && item.pictures.length > 0 ? (item.pictures[0].secure_url || item.pictures[0].url) : null);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          {myItemsColumns.image && (
                            <td className="py-3 px-3 text-center">
                              <div className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0 mx-auto">
                                {thumb ? (
                                  <img src={thumb} alt="" className="w-full h-full object-contain" />
                                ) : (
                                  <Package size={16} className="text-slate-400" />
                                )}
                              </div>
                            </td>
                          )}

                          {myItemsColumns.title && (
                            <td className="py-3 px-4">
                              <div className="max-w-md">
                                <span className="font-bold text-slate-900 dark:text-white block truncate" title={item.title}>
                                  {item.title}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-[10px] text-slate-400">
                                    {item.id}
                                  </span>
                                  {item.permalink && (
                                    <a
                                      href={item.permalink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 text-[10px]"
                                    >
                                      <ExternalLink size={10} />
                                      <span>Ver en MeLi</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </td>
                          )}

                          {myItemsColumns.category && (
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                              {item.category_id || '-'}
                            </td>
                          )}

                          {myItemsColumns.price && (
                            <td className="py-3 px-3 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editingItem.price}
                                  onChange={(e) => setEditingItem((prev) => prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : null)}
                                  className="w-20 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-right font-bold text-xs"
                                />
                              ) : (
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {item.currency_id} ${item.price.toFixed(2)}
                                </span>
                              )}
                            </td>
                          )}

                          {myItemsColumns.stock && (
                            <td className="py-3 px-3 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={editingItem.available_quantity}
                                  onChange={(e) => setEditingItem((prev) => prev ? { ...prev, available_quantity: parseInt(e.target.value, 10) || 0 } : null)}
                                  className="w-16 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-right font-bold text-xs"
                                />
                              ) : (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  {item.available_quantity} un.
                                </span>
                              )}
                            </td>
                          )}

                          {myItemsColumns.sold && (
                            <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-400 font-semibold">
                              {item.sold_quantity}
                            </td>
                          )}

                          {myItemsColumns.status && (
                            <td className="py-3 px-3 text-center">
                              {item.status === 'active' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  Activa
                                </span>
                              ) : item.status === 'paused' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  Pausada
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  {item.status}
                                </span>
                              )}
                            </td>
                          )}

                          {myItemsColumns.shipping && (
                            <td className="py-3 px-3">
                              <div className="flex flex-wrap gap-1">
                                {item.shipping_mode === 'me2' && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-0.5">
                                    <Truck size={9} /> ME2
                                  </span>
                                )}
                                {item.free_shipping && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    Envío Gratis
                                  </span>
                                )}
                                {item.local_pick_up && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    Retiro
                                  </span>
                                )}
                              </div>
                            </td>
                          )}

                          {myItemsColumns.dates && (
                            <td className="py-3 px-3 text-[10px] text-slate-400">
                              <div>Creada: {item.date_created?.slice(0, 10)}</div>
                              <div>Modif: {item.last_updated?.slice(0, 10)}</div>
                            </td>
                          )}

                          {myItemsColumns.actions && (
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {isEditing ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => handleSaveQuickEdit(item.id)}
                                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                                      title="Guardar cambios"
                                    >
                                      <Save size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingItem(null)}
                                      className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                                      title="Cancelar"
                                    >
                                      <X size={13} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {/* Botón 1-clic Pausar / Reactivar */}
                                    {item.status === 'active' ? (
                                      <button
                                        type="button"
                                        disabled={isUpdating}
                                        onClick={() => handleToggleStatus(item)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 text-[11px] font-semibold cursor-pointer"
                                        title="Pausar publicación en Mercado Libre"
                                      >
                                        <PauseCircle size={12} className={isUpdating ? 'animate-spin' : ''} />
                                        <span>Pausar</span>
                                      </button>
                                    ) : item.status === 'paused' ? (
                                      <button
                                        type="button"
                                        disabled={isUpdating}
                                        onClick={() => handleToggleStatus(item)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 text-[11px] font-semibold cursor-pointer"
                                        title="Reactivar publicación en Mercado Libre"
                                      >
                                        <PlayCircle size={12} className={isUpdating ? 'animate-spin' : ''} />
                                        <span>Reactivar</span>
                                      </button>
                                    ) : null}

                                    {/* Botón Edición Rápida Inline */}
                                    <button
                                      type="button"
                                      onClick={() => setEditingItem({ id: item.id, price: item.price, available_quantity: item.available_quantity })}
                                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                      title="Editar precio y stock rápidamente"
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 2: CATÁLOGO CALCU (INVENTARIO)
      ========================================================================= */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative w-full sm:w-80">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filtrar por SKU, nombre o categoría..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Selector de Columnas Catálogo */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCatalogColMenu(!showCatalogColMenu)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors cursor-pointer"
                >
                  <SlidersHorizontal size={13} />
                  <span>Columnas</span>
                </button>
                {showCatalogColMenu && (
                  <div className="absolute left-0 mt-1.5 z-30 w-48 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl space-y-1 text-xs">
                    <span className="font-bold text-[10px] text-slate-400 px-1 uppercase tracking-wider block">
                      Columnas Visibles
                    </span>
                    {Object.entries({
                      image: 'Foto',
                      product: 'Producto & SKU',
                      category: 'Categoría',
                      cost: 'Costo Base',
                      price: 'Precio Lista',
                      stock: 'Stock Depósito',
                      status: 'Estado MeLi',
                      actions: 'Acciones',
                    }).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(catalogColumns as any)[key]}
                          onChange={(e) => setCatalogColumns((prev) => ({ ...prev, [key]: e.target.checked }))}
                          className="w-3.5 h-3.5 text-amber-500 rounded border-slate-300"
                        />
                        <span className="text-slate-800 dark:text-slate-200">{label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <button
                type="button"
                onClick={loadReadyProducts}
                disabled={isLoadingProducts}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Refrescar catálogo"
              >
                <RefreshCw size={14} className={isLoadingProducts ? 'animate-spin' : ''} />
              </button>
              <span>Mostrando {filteredProducts.length} de {products.length} artículos del inventario</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    {catalogColumns.image && <th className="py-3 px-3 w-12 text-center">Foto</th>}
                    {catalogColumns.product && <th className="py-3 px-4">Producto &amp; SKU</th>}
                    {catalogColumns.category && <th className="py-3 px-4">Categoría</th>}
                    {catalogColumns.cost && <th className="py-3 px-4 text-right">Costo Base</th>}
                    {catalogColumns.price && <th className="py-3 px-4 text-right">Precio Lista</th>}
                    {catalogColumns.stock && <th className="py-3 px-4 text-right">Stock Dep. Central</th>}
                    {catalogColumns.status && <th className="py-3 px-4 text-center">Estado MeLi</th>}
                    {catalogColumns.actions && <th className="py-3 px-4 text-center">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoadingProducts ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Loader2 size={22} className="animate-spin mx-auto mb-2 text-amber-500" />
                        <span>Sincronizando existencias de productos...</span>
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No se encontraron artículos que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                    <tr key={p.sku} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      {catalogColumns.image && (
                        <td className="py-3.5 px-3 text-center">
                          <div className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0 mx-auto">
                            {p.image_url ? (
                              <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package size={15} className="text-slate-400" />
                            )}
                          </div>
                        </td>
                      )}
                      {catalogColumns.product && (
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {p.nombre}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            SKU: {p.sku}
                          </span>
                        </td>
                      )}
                      {catalogColumns.category && (
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">
                          {p.categoria || 'General'}
                        </td>
                      )}
                      {catalogColumns.cost && (
                        <td className="py-3.5 px-4 text-right text-slate-500 dark:text-slate-400">
                          UYU ${Number(p.costo_base).toFixed(2)}
                        </td>
                      )}
                      {catalogColumns.price && (
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                          UYU ${Number(p.precio_lista).toFixed(2)}
                        </td>
                      )}
                      {catalogColumns.stock && (
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {p.deposito_central} un.
                          </span>
                        </td>
                      )}
                      {catalogColumns.status && (
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Listo para Publicar
                          </span>
                        </td>
                      )}
                      {catalogColumns.actions && (
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProductForModal(p);
                                setIsPublishModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#FFE600] hover:bg-[#ffe100] text-[#2D3277] font-bold text-[11px] shadow-xs cursor-pointer"
                            >
                              <Sparkles size={12} />
                              <span>Publicar</span>
                            </button>

                            <button
                              type="button"
                              disabled={syncingSku === p.sku}
                              onClick={() => handleSyncStock(p)}
                              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Sincronizar existencias de depósito central con MeLi"
                            >
                              <RefreshCw size={13} className={syncingSku === p.sku ? 'animate-spin' : ''} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 3: VENTAS, ENVÍOS, RECLAMOS & RENTABILIDAD FP&A (KANBAN / TABLA)
      ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Tarjetas Ejecutivas de Rentabilidad FP&A y Reputación */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1.5">
                <span className="font-medium">Ventas Brutas MeLi</span>
                <DollarSign size={14} className="text-amber-500" />
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                ${fpaMetrics ? fpaMetrics.total_ventas_brutas.toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {orders.length} órdenes ({ordersDays}d)
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1.5">
                <span className="font-medium">Comisión MeLi</span>
                <Percent size={14} className="text-sky-500" />
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                ${fpaMetrics ? fpaMetrics.total_comisiones_meli.toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Retención ~{fpaMetrics && fpaMetrics.total_ventas_brutas > 0 ? ((fpaMetrics.total_comisiones_meli / fpaMetrics.total_ventas_brutas) * 100).toFixed(1) : '14.0'}%
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1.5">
                <span className="font-medium">Costo COGS Calcu</span>
                <Package size={14} className="text-purple-500" />
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                ${fpaMetrics ? fpaMetrics.total_cogs.toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Costo base inventario
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1.5">
                <span className="font-medium">Ingreso Neto Real</span>
                <TrendingUp size={14} className="text-emerald-500" />
              </div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                ${fpaMetrics ? fpaMetrics.total_ingreso_neto.toLocaleString() : '0'}
              </div>
              <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-bold mt-1">
                Margen {fpaMetrics ? fpaMetrics.margen_neto_promedio_pct : 0}%
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1.5">
                <span className="font-medium">SLA Logístico</span>
                <Truck size={14} className="text-blue-500" />
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                {fpaMetrics ? fpaMetrics.ordenes_a_tiempo_pct : 100}%
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                Despacho en tiempo
              </div>
            </div>

            <div className={`rounded-2xl p-3.5 shadow-xs border ${
              fpaMetrics?.reputacion_objetivo_verde
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
            }`}>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1.5">
                <span className="font-medium">Tasa Reclamos</span>
                <ShieldCheck size={14} className={fpaMetrics?.reputacion_objetivo_verde ? 'text-emerald-500' : 'text-rose-500'} />
              </div>
              <div className={`text-lg font-black ${
                fpaMetrics?.reputacion_objetivo_verde ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {fpaMetrics ? fpaMetrics.tasa_reclamos_pct : 0}%
              </div>
              <div className="text-[10px] font-bold mt-1">
                {fpaMetrics?.reputacion_objetivo_verde ? (
                  <span className="text-emerald-700 dark:text-emerald-300">✓ Objetivo verde &lt;1%</span>
                ) : (
                  <span className="text-rose-700 dark:text-rose-300">⚠️ Supera 1% límite</span>
                )}
              </div>
            </div>
          </div>

          {/* Barra de Filtros, Conmutador Kanban/Tabla y Acciones */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Conmutador Tablero Kanban / Vista Tabla */}
              <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setOrdersViewMode('kanban')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ordersViewMode === 'kanban'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid size={13} />
                  <span>Tablero Kanban</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrdersViewMode('table')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ordersViewMode === 'table'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <List size={13} />
                  <span>Vista Lista / Tabla</span>
                </button>
              </div>

              {/* Selector de Rango de Días */}
              <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-xl border border-slate-200/70 dark:border-slate-700/70 text-xs">
                <Calendar size={13} className="text-slate-400" />
                <span className="text-[11px] text-slate-500 font-medium mr-1">Historial:</span>
                {[7, 15, 30, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setOrdersDays(d);
                      loadOrders(d, ordersStageFilter);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                      ordersDays === d
                        ? 'bg-[#FFE600] text-[#2D3277]'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>

              {/* Buscador de Órdenes */}
              <div className="relative w-48 sm:w-60">
                <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={ordersSearch}
                  onChange={(e) => setOrdersSearch(e.target.value)}
                  placeholder="Buscar orden, comprador, SKU..."
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                {ordersSearch && (
                  <button
                    type="button"
                    onClick={() => setOrdersSearch('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro por Etapa si está en vista Tabla */}
              {ordersViewMode === 'table' && (
                <>
                  <select
                    value={ordersStageFilter}
                    onChange={(e) => {
                      setOrdersStageFilter(e.target.value);
                      loadOrders(ordersDays, e.target.value);
                    }}
                    className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value="all">Todas las Etapas ({orders.length})</option>
                    <option value="por_preparar">1. Por Preparar ({stagesCount.por_preparar})</option>
                    <option value="en_transito">2. En Tránsito ({stagesCount.en_transito})</option>
                    <option value="entregado">3. Entregado ({stagesCount.entregado})</option>
                    <option value="reclamos">4. Reclamos ({stagesCount.reclamos})</option>
                    <option value="cancelado">5. Cancelado ({stagesCount.cancelado})</option>
                  </select>

                  <select
                    value={ordersSortBy}
                    onChange={(e) => setOrdersSortBy(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                    title="Criterio de ordenamiento"
                  >
                    <option value="date_desc">Más recientes primero</option>
                    <option value="date_asc">Más antiguas primero</option>
                    <option value="amount_desc">Mayor monto bruto</option>
                    <option value="margin_desc">Mayor margen neto %</option>
                  </select>
                </>
              )}

              {/* Selector de Columnas Visibles (para Vista Tabla) */}
              {ordersViewMode === 'table' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowOrdersColMenu(!showOrdersColMenu)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <SlidersHorizontal size={13} />
                    <span>Columnas</span>
                  </button>

                  {showOrdersColMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-30 space-y-2 text-xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                        <span>Columnas Visibles</span>
                        <button
                          type="button"
                          onClick={() => setShowOrdersColMenu(false)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operativas</div>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.order_id}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, order_id: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Nº de Orden MeLi</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.date}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, date: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Fecha de Venta</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.buyer}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, buyer: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Comprador</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.city}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, city: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Ciudad / Destino</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.products}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, products: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Producto / SKU</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.quantity}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, quantity: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Cantidad</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.shipping_status}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, shipping_status: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Estado Envío</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.tracking}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, tracking: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Tracking ME2</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.sla}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, sla: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>SLA Despacho</span>
                      </label>

                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-1 border-t border-slate-100 dark:border-slate-800">Financieras</div>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.monto_bruto}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, monto_bruto: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Monto Bruto</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.comision_meli}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, comision_meli: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Comisión MeLi</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.costo_envio}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, costo_envio: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Costo Envío Asumido</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.cogs}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, cogs: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Costo COGS Calcu</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.ingreso_neto}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, ingreso_neto: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Ingreso Neto Real</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.margen_pct}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, margen_pct: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Margen Neto %</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={ordersColumns.crm_deal}
                          onChange={(e) => setOrdersColumns({ ...ordersColumns, crm_deal: e.target.checked })}
                          className="rounded text-amber-500"
                        />
                        <span>Trato CRM</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Botón Exportar CSV / Excel */}
              <button
                type="button"
                onClick={handleExportOrdersCsv}
                disabled={!filteredOrders.length}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-40"
                title="Exportar órdenes filtradas a Excel/CSV con BOM UTF-8"
              >
                <Download size={13} />
                <span>Exportar CSV</span>
              </button>

              {/* Botón Refrescar */}
              <button
                type="button"
                onClick={() => loadOrders(ordersDays, ordersStageFilter)}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Recargar órdenes de MeLi"
              >
                <RefreshCw size={14} className={isLoadingOrders ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* ESTADO DE CARGA DE ÓRDENES */}
          {isLoadingOrders ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-amber-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Sincronizando órdenes oficiales de Mercado Libre Uruguay (últimos {ordersDays} días)...
              </p>
              <p className="text-xs text-slate-400">
                Calculando comisiones, SLAs de despacho y márgenes FP&A en tiempo real.
              </p>
            </div>
          ) : ordersViewMode === 'kanban' ? (
            /* ===================================================================
               VISTA 1: TABLERO KANBAN DE 5 ETAPAS OPERATIVAS
            =================================================================== */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
              {/* ETAPA 1: POR PREPARAR / PENDIENTE DE DESPACHO */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-amber-300/40 dark:border-amber-700/40 p-3 flex flex-col gap-3 min-h-[420px]">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200/40 dark:border-amber-700/30">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                      1. Por Preparar
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    {stagesCount.por_preparar}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Esperando empaque en Depósito Central
                </div>

                <div className="space-y-3">
                  {filteredOrders
                    .filter((o) => o.kanban_stage === 'por_preparar')
                    .map((o) => (
                      <div
                        key={o.id}
                        className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-400 transition-all space-y-2.5"
                      >
                        {/* Cabecera Tarjeta: Orden + SLA Clock */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-extrabold text-slate-900 dark:text-white">
                            #{o.id}
                          </span>
                          {/* SLA Clock Badge */}
                          {o.sla_status === 'DELAYED' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 flex items-center gap-1">
                              <Clock size={10} />
                              <span>VENCIDO</span>
                            </span>
                          ) : o.sla_status === 'WARNING_LIMIT' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 flex items-center gap-1 animate-pulse">
                              <Clock size={10} />
                              <span>{o.sla_hours_remaining != null ? `${o.sla_hours_remaining}h rest.` : 'Límite'}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 flex items-center gap-1">
                              <Clock size={10} />
                              <span>{o.sla_hours_remaining != null ? `${o.sla_hours_remaining}h` : 'En plazo'}</span>
                            </span>
                          )}
                        </div>

                        {/* Comprador y Destino */}
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {o.buyer_name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                            <MapPin size={10} className="shrink-0" />
                            <span>{o.buyer_city || 'Montevideo'}</span>
                          </div>
                        </div>

                        {/* Producto y SKU */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg text-xs space-y-1 border border-slate-100 dark:border-slate-800">
                          <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                            {o.primary_item_title}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded">
                              {o.primary_sku}
                            </span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              x{o.items_count} un.
                            </span>
                          </div>
                        </div>

                        {/* Montos y Margen */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Total Bruto</span>
                            <span className="font-black text-slate-900 dark:text-white">
                              ${o.monto_bruto.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Neto Real</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400">
                              ${o.ingreso_neto.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Botones Operativos: Remito, Etiqueta y CRM */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForRemito(o)}
                            className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[#FFE600] hover:bg-[#ffe100] text-[#2D3277] font-bold text-[11px] shadow-xs cursor-pointer transition-colors"
                            title="Imprimir o visualizar Remito Interno de Despacho Calcu"
                          >
                            <Printer size={11} />
                            <span>Remito</span>
                          </button>
                          {o.label_url && (
                            <a
                              href={o.label_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              title="Descargar etiqueta oficial de Mercado Envíos"
                            >
                              <FileText size={12} />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (onNavigateToCRM) {
                                onNavigateToCRM();
                              } else {
                                alert(`Orden vinculada al trato comercial ID: ${o.deal_id}`);
                              }
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Ver en Pipeline Comercial CRM"
                          >
                            <ArrowUpRight size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  {filteredOrders.filter((o) => o.kanban_stage === 'por_preparar').length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400">
                      Sin órdenes por preparar
                    </div>
                  )}
                </div>
              </div>

              {/* ETAPA 2: EN TRÁNSITO / DESPACHADO */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-sky-300/40 dark:border-sky-700/40 p-3 flex flex-col gap-3 min-h-[420px]">
                <div className="flex items-center justify-between pb-2 border-b border-sky-200/40 dark:border-sky-700/30">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                      2. En Tránsito
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
                    {stagesCount.en_transito}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  En correo o colecta de Mercado Envíos
                </div>

                <div className="space-y-3">
                  {filteredOrders
                    .filter((o) => o.kanban_stage === 'en_transito')
                    .map((o) => (
                      <div
                        key={o.id}
                        className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-sky-400 transition-all space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-slate-900 dark:text-white">
                            #{o.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200">
                            Despachado
                          </span>
                        </div>

                        {/* Tracking Badge Oficial MeLi */}
                        {o.tracking_number ? (
                          <a
                            href={o.tracking_url || `https://www.mercadolibre.com.uy/envios/seguimiento/${o.tracking_number}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-[11px] font-mono hover:underline cursor-pointer"
                            title="Abrir tracking oficial en Mercado Libre"
                          >
                            <Truck size={11} />
                            <span>{o.tracking_number}</span>
                            <ExternalLink size={9} />
                          </a>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic">Tracking en generación</div>
                        )}

                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {o.buyer_name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {o.shipping_address}
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg text-xs space-y-1">
                          <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                            {o.primary_item_title}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-mono text-[10px]">{o.primary_sku}</span>
                            <span>x{o.items_count} un.</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-slate-400 text-[10px]">Total:</span>
                          <span className="font-black text-slate-900 dark:text-white">
                            ${o.monto_bruto.toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForRemito(o)}
                            className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[11px] cursor-pointer"
                          >
                            <Printer size={11} />
                            <span>Remito</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigateToCRM ? onNavigateToCRM() : alert(`Trato CRM: ${o.deal_id}`)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Ver en CRM Pipeline"
                          >
                            <ArrowUpRight size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  {filteredOrders.filter((o) => o.kanban_stage === 'en_transito').length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400">
                      Sin órdenes en tránsito
                    </div>
                  )}
                </div>
              </div>

              {/* ETAPA 3: ENTREGADO / CONCLUIDO */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-emerald-300/40 dark:border-emerald-700/40 p-3 flex flex-col gap-3 min-h-[420px]">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/40 dark:border-emerald-700/30">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                      3. Entregado / Concluido
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    {stagesCount.entregado}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Paquete recibido satisfactoriamente
                </div>

                <div className="space-y-3">
                  {filteredOrders
                    .filter((o) => o.kanban_stage === 'entregado')
                    .map((o) => (
                      <div
                        key={o.id}
                        className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-400 transition-all space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-slate-900 dark:text-white">
                            #{o.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            <span>Entregado</span>
                          </span>
                        </div>

                        {/* Estado de Liquidación en Mercado Pago */}
                        <div className="text-[11px] bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 p-2 rounded-lg text-emerald-800 dark:text-emerald-300">
                          {o.payout_status === 'released' ? (
                            <span className="font-bold">✓ Fondos liberados en Mercado Pago</span>
                          ) : (
                            <span>
                              Liberación estimada:{' '}
                              <strong>
                                {o.payout_release_date ? new Date(o.payout_release_date).toLocaleDateString() : 'En proceso'}
                              </strong>
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {o.buyer_name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {o.primary_item_title} (x{o.items_count})
                          </div>
                        </div>

                        {/* Margen y Ganancia Neta */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Ingreso Neto</span>
                            <span className="font-black text-emerald-600 dark:text-emerald-400">
                              ${o.ingreso_neto.toLocaleString()}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Margen FP&A</span>
                            <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                              {o.margen_pct}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedOrderForRemito(o)}
                            className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[11px] cursor-pointer"
                          >
                            <Printer size={11} />
                            <span>Remito</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigateToCRM ? onNavigateToCRM() : alert(`Trato CRM: ${o.deal_id}`)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Ver en CRM Pipeline"
                          >
                            <ArrowUpRight size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  {filteredOrders.filter((o) => o.kanban_stage === 'entregado').length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400">
                      Sin órdenes entregadas aún
                    </div>
                  )}
                </div>
              </div>

              {/* ETAPA 4: RECLAMOS & DEVOLUCIONES */}
              <div className="bg-rose-50/40 dark:bg-rose-950/20 rounded-2xl border border-rose-300/60 dark:border-rose-700/60 p-3 flex flex-col gap-3 min-h-[420px]">
                <div className="flex items-center justify-between pb-2 border-b border-rose-200 dark:border-rose-800/40">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <h3 className="font-bold text-xs text-rose-900 dark:text-rose-200">
                      4. Reclamos &amp; Devoluciones
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-200 dark:bg-rose-900/80 text-rose-900 dark:text-rose-100 border border-rose-400">
                    {stagesCount.reclamos}
                  </span>
                </div>
                <div className="text-[10px] text-rose-700 dark:text-rose-300 font-medium">
                  Atención prioritaria para no afectar reputación
                </div>

                <div className="space-y-3">
                  {filteredOrders
                    .filter((o) => o.kanban_stage === 'reclamos')
                    .map((o) => (
                      <div
                        key={o.id}
                        className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border-2 border-rose-400 dark:border-rose-700 shadow-md space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-rose-700 dark:text-rose-300">
                            #{o.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 flex items-center gap-1">
                            <AlertTriangle size={10} />
                            <span>Reclamo Abierto</span>
                          </span>
                        </div>

                        {/* Detalle o Razón de Reclamo */}
                        <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200">
                          <span className="font-bold block text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400">
                            Motivo / Mediación:
                          </span>
                          <span>{o.claim_details?.reason || o.shipping_substatus || 'Mediación post-venta iniciada por el comprador'}</span>
                        </div>

                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {o.buyer_name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {o.primary_item_title}
                          </div>
                        </div>

                        {/* Acciones de Mediación */}
                        <div className="space-y-1.5 pt-1">
                          <a
                            href={
                              o.claim_details?.claim_id
                                ? `https://www.mercadolibre.com.uy/claims/detail/${o.claim_details.claim_id}`
                                : 'https://www.mercadolibre.com.uy/resumen'
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                          >
                            <span>Responder Mediación en MeLi</span>
                            <ExternalLink size={12} />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              if (onNavigateToChat) {
                                onNavigateToChat(o.deal_id);
                              } else {
                                alert(`Iniciar chat con comprador de orden #${o.id}`);
                              }
                            }}
                            className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer"
                          >
                            <MessageSquare size={12} />
                            <span>Contactar Comprador</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  {filteredOrders.filter((o) => o.kanban_stage === 'reclamos').length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400 flex flex-col items-center gap-1.5">
                      <ShieldCheck size={20} className="text-emerald-500" />
                      <span>Sin reclamos abiertos. Reputación 100% protegida.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ETAPA 5: CANCELADO / REEMBOLSADO */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-300/40 dark:border-slate-700/40 p-3 flex flex-col gap-3 min-h-[420px]">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/30">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <h3 className="font-bold text-xs text-slate-700 dark:text-slate-300">
                      5. Cancelado / Reembolsado
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {stagesCount.cancelado}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Reversión automática al Depósito Central
                </div>

                <div className="space-y-3">
                  {filteredOrders
                    .filter((o) => o.kanban_stage === 'cancelado')
                    .map((o) => (
                      <div
                        key={o.id}
                        className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 opacity-80"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500">
                            #{o.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200">
                            Cancelada
                          </span>
                        </div>

                        {/* Reversión de existencias */}
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-[10px] text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
                          <Warehouse size={12} className="text-amber-500" />
                          <span>Stock revertido a Depósito Central</span>
                        </div>

                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {o.buyer_name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {o.primary_item_title} (x{o.items_count})
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-slate-400 text-[10px]">Monto anulado:</span>
                          <span className="font-bold line-through text-slate-500">
                            ${o.monto_bruto.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  {filteredOrders.filter((o) => o.kanban_stage === 'cancelado').length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400">
                      Sin órdenes canceladas
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ===================================================================
               VISTA 2: LISTA / TABLA CON FILTROS Y COLUMNAS EDITABLES
            =================================================================== */
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 select-none">
                    <tr>
                      {ordersColumns.order_id && (
                        <th className="py-3 px-3.5 font-bold">ID Orden</th>
                      )}
                      {ordersColumns.date && (
                        <th className="py-3 px-3.5 font-bold">Fecha</th>
                      )}
                      {ordersColumns.buyer && (
                        <th className="py-3 px-3.5 font-bold">Comprador</th>
                      )}
                      {ordersColumns.city && (
                        <th className="py-3 px-3.5 font-bold">Destino</th>
                      )}
                      {ordersColumns.products && (
                        <th className="py-3 px-3.5 font-bold">Producto / SKU</th>
                      )}
                      {ordersColumns.quantity && (
                        <th className="py-3 px-3.5 font-bold text-center">Cant.</th>
                      )}
                      {ordersColumns.shipping_status && (
                        <th className="py-3 px-3.5 font-bold">Estado Envío</th>
                      )}
                      {ordersColumns.tracking && (
                        <th className="py-3 px-3.5 font-bold">Tracking ME2</th>
                      )}
                      {ordersColumns.sla && (
                        <th className="py-3 px-3.5 font-bold">SLA Despacho</th>
                      )}
                      {ordersColumns.monto_bruto && (
                        <th className="py-3 px-3.5 font-bold text-right">Monto Bruto</th>
                      )}
                      {ordersColumns.comision_meli && (
                        <th className="py-3 px-3.5 font-bold text-right">Comisión MeLi</th>
                      )}
                      {ordersColumns.costo_envio && (
                        <th className="py-3 px-3.5 font-bold text-right">Costo Envío</th>
                      )}
                      {ordersColumns.cogs && (
                        <th className="py-3 px-3.5 font-bold text-right">COGS Calcu</th>
                      )}
                      {ordersColumns.ingreso_neto && (
                        <th className="py-3 px-3.5 font-bold text-right">Ingreso Neto</th>
                      )}
                      {ordersColumns.margen_pct && (
                        <th className="py-3 px-3.5 font-bold text-right">Margen %</th>
                      )}
                      {ordersColumns.crm_deal && (
                        <th className="py-3 px-3.5 font-bold text-center">Trato CRM</th>
                      )}
                      {ordersColumns.actions && (
                        <th className="py-3 px-3.5 font-bold text-center">Acciones</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="py-12 text-center text-slate-400">
                          No se encontraron órdenes con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((o) => (
                        <tr
                          key={o.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {ordersColumns.order_id && (
                            <td className="py-3 px-3.5 font-mono font-bold text-slate-900 dark:text-white">
                              #{o.id}
                            </td>
                          )}

                          {ordersColumns.date && (
                            <td className="py-3 px-3.5 text-slate-500 whitespace-nowrap">
                              {o.date_created ? new Date(o.date_created).toLocaleDateString() : '-'}
                            </td>
                          )}

                          {ordersColumns.buyer && (
                            <td className="py-3 px-3.5">
                              <div className="font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                                {o.buyer_name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                @{o.buyer_nickname}
                              </div>
                            </td>
                          )}

                          {ordersColumns.city && (
                            <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300">
                              {o.buyer_city || 'Montevideo'}
                            </td>
                          )}

                          {ordersColumns.products && (
                            <td className="py-3 px-3.5">
                              <div className="font-semibold text-slate-900 dark:text-white line-clamp-1 max-w-[200px]">
                                {o.primary_item_title}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                SKU: {o.primary_sku}
                              </div>
                            </td>
                          )}

                          {ordersColumns.quantity && (
                            <td className="py-3 px-3.5 text-center font-bold text-slate-800 dark:text-slate-200">
                              {o.items_count}
                            </td>
                          )}

                          {ordersColumns.shipping_status && (
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                o.kanban_stage === 'por_preparar'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : o.kanban_stage === 'en_transito'
                                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                                  : o.kanban_stage === 'entregado'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : o.kanban_stage === 'reclamos'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                              }`}>
                                {o.kanban_stage_name}
                              </span>
                            </td>
                          )}

                          {ordersColumns.tracking && (
                            <td className="py-3 px-3.5 font-mono text-[11px]">
                              {o.tracking_number ? (
                                <a
                                  href={o.tracking_url || `https://www.mercadolibre.com.uy/envios/seguimiento/${o.tracking_number}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                                >
                                  <span>{o.tracking_number}</span>
                                  <ExternalLink size={10} />
                                </a>
                              ) : (
                                <span className="text-slate-400 italic">-</span>
                              )}
                            </td>
                          )}

                          {ordersColumns.sla && (
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              {o.sla_status === 'DELAYED' ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 flex items-center gap-1">
                                  <Clock size={10} />
                                  <span>VENCIDO</span>
                                </span>
                              ) : o.sla_status === 'WARNING_LIMIT' ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center gap-1 animate-pulse">
                                  <Clock size={10} />
                                  <span>{o.sla_hours_remaining != null ? `${o.sla_hours_remaining}h` : 'Límite'}</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                  <Clock size={10} />
                                  <span>{o.sla_hours_remaining != null ? `${o.sla_hours_remaining}h` : 'OK'}</span>
                                </span>
                              )}
                            </td>
                          )}

                          {ordersColumns.monto_bruto && (
                            <td className="py-3 px-3.5 text-right font-black text-slate-900 dark:text-white">
                              ${o.monto_bruto.toLocaleString()}
                            </td>
                          )}

                          {ordersColumns.comision_meli && (
                            <td className="py-3 px-3.5 text-right font-mono text-slate-600 dark:text-slate-400">
                              -${o.comision_meli.toLocaleString()}
                            </td>
                          )}

                          {ordersColumns.costo_envio && (
                            <td className="py-3 px-3.5 text-right font-mono text-slate-600 dark:text-slate-400">
                              -${o.costo_envio.toLocaleString()}
                            </td>
                          )}

                          {ordersColumns.cogs && (
                            <td className="py-3 px-3.5 text-right font-mono text-purple-600 dark:text-purple-400">
                              -${o.cogs.toLocaleString()}
                            </td>
                          )}

                          {ordersColumns.ingreso_neto && (
                            <td className="py-3 px-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                              ${o.ingreso_neto.toLocaleString()}
                            </td>
                          )}

                          {ordersColumns.margen_pct && (
                            <td className="py-3 px-3.5 text-right">
                              <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                                {o.margen_pct}%
                              </span>
                            </td>
                          )}

                          {ordersColumns.crm_deal && (
                            <td className="py-3 px-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => onNavigateToCRM ? onNavigateToCRM() : alert(`Trato CRM: ${o.deal_id}`)}
                                className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer inline-flex items-center gap-1"
                                title="Abrir en CRM Comercial"
                              >
                                <span>CRM</span>
                                <ArrowUpRight size={10} />
                              </button>
                            </td>
                          )}

                          {ordersColumns.actions && (
                            <td className="py-3 px-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderForRemito(o)}
                                  className="p-1.5 rounded-lg bg-[#FFE600] hover:bg-[#ffe100] text-[#2D3277] cursor-pointer"
                                  title="Imprimir Remito Interno de Despacho"
                                >
                                  <Printer size={13} />
                                </button>
                                {o.label_url && (
                                  <a
                                    href={o.label_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                    title="Descargar etiqueta oficial de Mercado Envíos"
                                  >
                                    <FileText size={13} />
                                  </a>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 4: SINCRONIZACIÓN DE STOCK & PRICING
      ========================================================================= */}
      {activeTab === 'stock_pricing' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Simulador de Rentabilidad y Comisiones MeLi */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Percent size={18} className="text-amber-500" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Simulador de Comisiones &amp; Margen MeLi
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Precio de Venta Simulado (UYU)
                </label>
                <input
                  type="number"
                  value={simPrice}
                  onChange={(e) => setSimPrice(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Costo Base Unitario (Calcu)
                </label>
                <input
                  type="number"
                  value={simCost}
                  onChange={(e) => setSimCost(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Tipo de Publicación
                </label>
                <select
                  value={simListingType}
                  onChange={(e) => setSimListingType(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium"
                >
                  <option value="gold_special">Clásica (Comisión ~14%)</option>
                  <option value="gold_pro">Premium (Cuotas sin interés ~18%)</option>
                </select>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Comisión MeLi ({commissionRate * 100}%):</span>
                  <span className="font-bold text-rose-600">-UYU ${commissionAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Neto a Percibir:</span>
                  <span className="font-bold text-slate-900 dark:text-white">UYU ${netRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Margen de Contribución:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    UYU ${contributionMargin.toFixed(2)} ({marginPct}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Paridad de Inventario Central vs 3PL */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Warehouse size={18} className="text-indigo-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Paridad de Existencias: Depósito Central vs. Mercado Libre
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Aislamiento 3PL Activo
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cada venta concretada en Mercado Libre descuenta atómicamente de <code>Inventory.deposito_central</code>. Los inventarios de clientes en depósitos 3PL o aduaneros quedan 100% blindados sin mutación.
            </p>

            <div className="space-y-3 pt-2">
              {products.slice(0, 5).map((p) => (
                <div
                  key={p.sku}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">{p.nombre}</span>
                    <span className="font-mono text-[11px] text-slate-400">SKU: {p.sku}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Dep. Central</span>
                      <span className="font-bold text-slate-900 dark:text-white">{p.deposito_central} un.</span>
                    </div>

                    <button
                      type="button"
                      disabled={syncingSku === p.sku}
                      onClick={() => handleSyncStock(p)}
                      className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 font-bold text-[11px] hover:bg-indigo-100 cursor-pointer transition-colors"
                    >
                      {syncingSku === p.sku ? 'Sincronizando...' : 'Sincronizar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 3: PREGUNTAS & CHAT ME-LI
      ========================================================================= */}
      {activeTab === 'qa_chat' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Bandeja de Preguntas Pre-Venta &amp; Mensajería MeLi
              </h3>
              <p className="text-xs text-slate-500">
                Las preguntas ingresan directamente a la columna <b>1. Prospección</b> de su Pipeline Comercial.
              </p>
            </div>

            {onNavigateToChat && (
              <button
                type="button"
                onClick={() => onNavigateToChat()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                <MessageSquare size={14} />
                <span>Abrir Chat Omnicanal Completo</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
              <span className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1.5">
                <Clock size={14} /> SLA de Respuesta MeLi
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                Responder en menos de <b>15 minutos</b> maximiza la tasa de conversión y sube el posicionamiento orgánico en el buscador de Mercado Libre.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs space-y-1">
              <span className="text-purple-800 dark:text-purple-300 font-bold flex items-center gap-1.5">
                <Sparkles size={14} /> Copiloto IA Consultivo
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                Calcu sugiere respuestas automáticas profesionales basadas en el stock real y la ficha técnica del producto.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
              <span className="text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                <ShieldCheck size={14} /> Linter Anti-Penalización
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                Bloquea números telefónicos, correos y URLs externas antes del despacho para evitar suspensiones de cuenta.
              </p>
            </div>
          </div>

          <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
            <MessageSquare size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
            <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
              Canal de Comunicación Conectado
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Las notificaciones de preguntas y ventas se reciben a través del Webhook seguro Funnel y se sincronizan en tiempo real con el Pipeline Comercial.
            </p>
            {onNavigateToCRM && (
              <button
                type="button"
                onClick={onNavigateToCRM}
                className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
              >
                <span>Ver Pipeline Comercial</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 4: MÉTRICAS & REPUTACIÓN
      ========================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-3xl shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Nivel de Reputación
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {reputation?.reputation_level || 'Nivel 5 (Verde)'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {reputation?.power_seller_status || 'MercadoLíder'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Sin mediaciones ni reclamos críticos</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-3xl shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Ventas Concretadas
              </span>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                {reputation?.transactions_completed || channelConfig?.deals_won_count || 0}
              </div>
              <p className="text-[11px] text-slate-400">Calificaciones positivas: 99.2%</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-3xl shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Leads Captados (Preguntas)
              </span>
              <div className="text-xl font-extrabold text-[#00a2e8]">
                {channelConfig?.leads_captured_count || 0}
              </div>
              <p className="text-[11px] text-slate-400">Inyectados en 1. Prospección</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-3xl shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Facturación Cerrada Est.
              </span>
              <div className="text-xl font-extrabold text-emerald-600">
                USD ${Number(channelConfig?.revenue_closed_usd || 0).toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-400">ROAS Est.: {channelConfig?.estimated_roas || 0}x</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Termómetro de Reputación Oficial de Mercado Libre
            </h3>
            <div className="grid grid-cols-5 gap-1.5 pt-2">
              <div className="h-2.5 rounded-full bg-rose-400 opacity-30" title="Rojo" />
              <div className="h-2.5 rounded-full bg-orange-400 opacity-30" title="Naranja" />
              <div className="h-2.5 rounded-full bg-yellow-400 opacity-30" title="Amarillo" />
              <div className="h-2.5 rounded-full bg-lime-400 opacity-50" title="Verde Claro" />
              <div className="h-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/30" title="Verde Oscuro (Óptimo)" />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 pt-1">
              <span>Bajo Rendimiento</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Excelente Reputación (Posicionamiento Máximo)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 5: BÓVEDA OAUTH2 & WEBHOOKS
      ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Configuración Criptográfica &amp; Bóveda AES-256 (ISO 27001) - {isAdmin ? 'Modo Administrador' : 'Modo Operador'}
              </h3>
              <p className="text-xs text-slate-500">
                Tokens de acceso y refresco protegidos con cifrado autenticado AES-CTR + HMAC-SHA256.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
              <ShieldCheck size={13} />
              <span>CWE-312 / CWE-532 Safe</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Credenciales de Aplicación
              </span>
              <div className="flex justify-between">
                <span className="text-slate-500">Mercado Libre App ID:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">5376694505612300</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Client Secret:</span>
                <span className="font-mono text-slate-400">••••••••••••••••••••••••••••••••</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Site Marketplace:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">MLU (Uruguay)</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Túnel Tailscale Funnel Activo
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-slate-500">Webhook URL:</span>
                <code className="text-[10px] font-mono p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 truncate">
                  https://sebahost.taild84e22.ts.net/api/v1/integrations/webhooks/mercado_libre
                </code>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-500">OAuth Callback URI:</span>
                <code className="text-[10px] font-mono p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 truncate">
                  https://sebahost.taild84e22.ts.net/api/v1/integrations/meli/callback
                </code>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Estado de Autorización:</span>
              <span
                className={`font-bold text-xs ${
                  isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {isConnected ? 'Cuenta Vinculada & Token Activo' : 'Pendiente de Autorización'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleConnectOAuth}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFE600] hover:bg-[#ffe100] text-[#2D3277] font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer transition-all"
            >
              <KeyRound size={14} />
              <span>{isConnected ? 'Reconectar / Renovar Token' : 'Vincular con Mercado Libre (OAuth 2.0)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Publicación Oficial */}
      <MeliPublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        preselectedProduct={selectedProductForModal}
        onPublished={(item) => {
          setBannerMsg({
            type: 'success',
            text: `¡Artículo "${item.title}" (${item.item_id}) publicado con éxito en Mercado Libre Uruguay!`,
          });
          loadReadyProducts();
          loadIntegrationStatus();
          loadMyMeliItems();
        }}
      />

      {/* Modal de Remito Interno de Despacho Calcu */}
      {selectedOrderForRemito && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8 text-slate-900 dark:text-slate-100 print:m-0 print:p-4 print:border-none print:shadow-none print:w-full print:max-w-none">
            {/* Cabecera del Remito */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FFE600] text-[#2D3277] flex items-center justify-center font-black text-xl shadow-xs">
                  C
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white uppercase">
                    Calcu S.A. · Logística &amp; Expedición
                  </h2>
                  <p className="text-xs text-slate-500">
                    R.U.T. 219999990019 · Depósito Central Montevideo · Uruguay
                  </p>
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    REMITO INTERNO DE DESPACHO Y CONTROL DE CALIDAD E-COMMERCE
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-sm bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl">
                  REM-MLU-{selectedOrderForRemito.id}
                </span>
                <div className="text-[11px] text-slate-400 mt-1">
                  Emisión: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString().slice(0, 5)}
                </div>
              </div>
            </div>

            {/* Datos de la Venta y Envío */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800">
              <div className="space-y-1.5">
                <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                  Datos de la Venta (Mercado Libre)
                </div>
                <div>
                  <span className="text-slate-500">Nº de Orden MeLi: </span>
                  <strong className="font-mono">#{selectedOrderForRemito.id}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Fecha de Venta: </span>
                  <strong>{selectedOrderForRemito.date_created ? new Date(selectedOrderForRemito.date_created).toLocaleString() : '-'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Comprador: </span>
                  <strong>{selectedOrderForRemito.buyer_name}</strong> (@{selectedOrderForRemito.buyer_nickname})
                </div>
                <div>
                  <span className="text-slate-500">Teléfono: </span>
                  <strong>{selectedOrderForRemito.buyer_phone || 'Registrado en perfil MeLi'}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                  Destino &amp; Logística
                </div>
                <div>
                  <span className="text-slate-500">Dirección de Entrega: </span>
                  <strong>{selectedOrderForRemito.shipping_address || 'Retiro en Depósito Central'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Ciudad / Depto: </span>
                  <strong>{selectedOrderForRemito.buyer_city || 'Montevideo'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Método de Envío: </span>
                  <strong>{selectedOrderForRemito.shipping_mode === 'me2' ? 'Mercado Envíos Colecta' : 'A Convenir / Retiro'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Código de Seguimiento (Tracking): </span>
                  <strong className="font-mono text-sky-600 dark:text-sky-400">
                    {selectedOrderForRemito.tracking_number || 'Pendiente de emisión'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Detalle de Artículos a Despachar */}
            <div className="space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                Mercadería a Preparar y Embalar
              </h3>
              <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">SKU</th>
                    <th className="py-2.5 px-3 font-bold">Descripción del Artículo</th>
                    <th className="py-2.5 px-3 font-bold text-center">Cant.</th>
                    <th className="py-2.5 px-3 font-bold">Ubicación Picking</th>
                    <th className="py-2.5 px-3 font-bold text-center">Control Físico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedOrderForRemito.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3 font-mono font-bold">{it.sku || '-'}</td>
                      <td className="py-2 px-3 font-medium">{it.title}</td>
                      <td className="py-2 px-3 text-center font-bold text-base">{it.quantity} un.</td>
                      <td className="py-2 px-3 text-slate-500">Depósito Central (Rack A-01)</td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-block w-4 h-4 rounded border-2 border-slate-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Protocolo de Control de Calidad y Embalaje */}
            <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 text-xs space-y-2">
              <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
                <ShieldCheck size={14} className="text-amber-600" />
                <span>Protocolo de Aseguramiento Operativo (ISO 27001 / Control Calcu)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-1.5">
                  <CheckSquare size={13} className="text-emerald-600 mt-0.5 shrink-0" />
                  <span>1. Verificación física sin golpes ni fallas cosméticas.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckSquare size={13} className="text-emerald-600 mt-0.5 shrink-0" />
                  <span>2. Validación unívoca de SKU y código de barras.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckSquare size={13} className="text-emerald-600 mt-0.5 shrink-0" />
                  <span>3. Embalaje protegido y etiqueta MeLi visible y legible.</span>
                </div>
              </div>
            </div>

            {/* Firmas de Expedición y Transportista */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-xs text-center">
              <div>
                <div className="border-b border-slate-400 dark:border-slate-600 h-10 mb-2" />
                <span className="font-bold block text-slate-800 dark:text-slate-200">
                  Responsable de Expedición Calcu
                </span>
                <span className="text-[10px] text-slate-400">Firma, Aclaración y Hora de Despacho</span>
              </div>

              <div>
                <div className="border-b border-slate-400 dark:border-slate-600 h-10 mb-2" />
                <span className="font-bold block text-slate-800 dark:text-slate-200">
                  Transportista / Colecta Mercado Envíos
                </span>
                <span className="text-[10px] text-slate-400">Firma, Aclaración de Retiro y Nº Matrícula</span>
              </div>
            </div>

            {/* Acciones del Modal (Ocultas al Imprimir) */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 print:hidden">
              <button
                type="button"
                onClick={() => setSelectedOrderForRemito(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>

              {selectedOrderForRemito.label_url && (
                <a
                  href={selectedOrderForRemito.label_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/60 text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-100 cursor-pointer"
                >
                  <FileText size={13} />
                  <span>Etiqueta Oficial MeLi</span>
                  <ExternalLink size={11} />
                </a>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#FFE600] hover:bg-[#ffe100] text-[#2D3277] font-bold text-xs shadow-md shadow-amber-500/20 cursor-pointer transition-all"
              >
                <Printer size={14} />
                <span>Imprimir Remito</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MercadoLibreView;
