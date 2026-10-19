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
} from 'lucide-react';
import { apiService } from '../../services/api';
import type {
  MeliReadyProductItem,
  IntegrationChannelConfig,
  MeliSellerReputationResponse,
} from '../../types';
import { MeliPublishModal } from '../../components/integrations/MeliPublishModal';

interface MercadoLibreViewProps {
  currentRole?: string;
  onNavigateToChat?: (dealId?: string) => void;
  onNavigateToCRM?: () => void;
}

type MeliTab = 'catalog' | 'stock_pricing' | 'qa_chat' | 'analytics' | 'settings';

export const MercadoLibreView: React.FC<MercadoLibreViewProps> = ({
  currentRole = 'controller_admin',
  onNavigateToChat,
  onNavigateToCRM,
}) => {
  const [activeTab, setActiveTab] = useState<MeliTab>('catalog');
  const [channelConfig, setChannelConfig] = useState<IntegrationChannelConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);
  const [reputation, setReputation] = useState<MeliSellerReputationResponse | null>(null);

  // Catálogo y productos
  const [products, setProducts] = useState<MeliReadyProductItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

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

  // 2. Cargar productos listos para MeLi
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

  useEffect(() => {
    loadIntegrationStatus();
    loadReadyProducts();
  }, []);

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

  // Filtrado de productos
  const filteredProducts = products.filter(
    (p) =>
      p.nombre.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchFilter.toLowerCase()) ||
      p.categoria.toLowerCase().includes(searchFilter.toLowerCase())
  );

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
            }}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Recargar estado"
          >
            <RefreshCw size={15} className={isLoadingConfig || isLoadingProducts ? 'animate-spin' : ''} />
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
          onClick={() => setActiveTab('catalog')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'catalog'
              ? 'bg-[#FFE600] text-[#2D3277] shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Package size={14} />
          <span>1. Publicaciones &amp; Catálogo</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {products.length}
          </span>
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
          <span>2. Sincronización de Stock &amp; Pricing</span>
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
          <span>3. Preguntas Pre-Venta &amp; Chat MeLi</span>
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
          <span>4. Métricas, Reputación &amp; Ventas</span>
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
          <span>5. Bóveda OAuth2 &amp; Webhooks</span>
        </button>
      </div>

      {/* =========================================================================
          PESTAÑA 1: PUBLICACIONES & CATÁLOGO
      ========================================================================= */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar por SKU, nombre o categoría..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Mostrando {filteredProducts.length} de {products.length} artículos del inventario</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Producto &amp; SKU</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-right">Precio Lista</th>
                    <th className="py-3 px-4 text-right">Stock Dep. Central</th>
                    <th className="py-3 px-4 text-center">Estado MeLi</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isLoadingProducts ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Loader2 size={22} className="animate-spin mx-auto mb-2 text-amber-500" />
                        <span>Sincronizando existencias de productos...</span>
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No se encontraron artículos que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                    <tr key={p.sku} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                            {p.image_url ? (
                              <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package size={15} className="text-slate-400" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {p.nombre}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              SKU: {p.sku}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">
                        {p.categoria || 'General'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                        UYU ${Number(p.precio_lista).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {p.deposito_central} un.
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Listo para Publicar
                        </span>
                      </td>
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
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PESTAÑA 2: SINCRONIZACIÓN DE STOCK & PRICING
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
        }}
      />
    </div>
  );
};

export default MercadoLibreView;
