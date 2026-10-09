import { useState, useEffect } from 'react';
import { 
  Sliders, 
  CheckCircle2,
  Package,
  Sparkles,
  Copy,
  Check,
  Warehouse,
  Loader2,
  ShieldAlert,
  Lightbulb
} from 'lucide-react';
import { WaterfallChart } from '../components/pricing/WaterfallChart';
import type { MarginSummaryItem, DiscountSimulationResponse, PricingAIBundlesResponse, AIBundleItem } from '../types';
import { DataTable } from '../components/common/DataTable';
import type { Column } from '../components/common/DataTable';
import { apiService, getCurrentRole } from '../services/api';

interface PricingAnalyticsViewProps {
  margins: MarginSummaryItem[];
  selectedCategory: string;
  searchQuery: string;
  currentRole?: string;
}

export const PricingAnalyticsView = ({
  margins,
  selectedCategory,
  searchQuery,
  currentRole,
}: PricingAnalyticsViewProps) => {
  // Estado del Agente de Pricing y Packs IA
  const [bundlesData, setBundlesData] = useState<PricingAIBundlesResponse | null>(null);
  const [loadingBundles, setLoadingBundles] = useState<boolean>(false);
  const [copiedBundleId, setCopiedBundleId] = useState<string | null>(null);

  const fetchAIBundles = async () => {
    setLoadingBundles(true);
    try {
      const data = await apiService.getAIBundles();
      setBundlesData(data);
    } catch (err) {
      console.error('Error fetching AI bundles', err);
    } finally {
      setLoadingBundles(false);
    }
  };

  useEffect(() => {
    fetchAIBundles();
  }, []);

  const handleCopyProposal = (bundle: AIBundleItem) => {
    const text = `📦 PROPUESTA COMERCIAL: ${bundle.nombre_pack}\n\n` +
      `Descripción: ${bundle.descripcion}\n\n` +
      `Productos incluidos:\n` +
      bundle.productos.map(p => ` - ${p.nombre} (${p.sku}) [Stock: ${p.stock_actual}u | DOH: ${p.doh}d]`).join('\n') +
      `\n\nPrecio Regular: $${bundle.precio_individual_total_usd.toFixed(2)} USD` +
      `\nPrecio Pack con ${bundle.descuento_bundle_pct}% OFF: $${bundle.precio_bundle_sugerido_usd.toFixed(2)} USD` +
      `\nMargen Neto Garantizado: ${bundle.margen_neto_pct}%` +
      `\nCapital Inmovilizado Liberado: $${bundle.capital_inmovilizado_liberado_usd.toFixed(2)} USD` +
      `\nEspacio en Bodega Liberado: ${bundle.m2_liberados_estimados.toFixed(1)} m²\n\n` +
      `Argumento de Venta:\n"${bundle.argumento_comercial}"`;

    navigator.clipboard.writeText(text);
    setCopiedBundleId(bundle.id);
    setTimeout(() => setCopiedBundleId(null), 3000);
  };

  // Estado del Simulador Interactivo
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('Mercado Libre');
  const [basePrice, setBasePrice] = useState<number>(1000);
  const [cost, setCost] = useState<number>(600);
  const [discountPct, setDiscountPct] = useState<number>(10);
  const [commissionPct, setCommissionPct] = useState<number>(12);
  const [freight, setFreight] = useState<number>(20);
  const [simulation, setSimulation] = useState<DiscountSimulationResponse | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Inicializar o sincronizar con SKU seleccionado
  useEffect(() => {
    if (margins.length > 0 && !selectedSku) {
      const first = margins[0];
      setSelectedSku(first.sku);
      setBasePrice(Number(first.precio_venta));
      setCost(Number(first.costo_unitario));
    }
  }, [margins]);

  const handleSkuChange = (sku: string) => {
    setSelectedSku(sku);
    const prod = margins.find((m) => m.sku === sku);
    if (prod) {
      setBasePrice(Number(prod.precio_venta));
      setCost(Number(prod.costo_unitario));
    }
  };

  const handleChannelChange = (channel: string) => {
    setSelectedChannel(channel);
    if (channel === 'Mercado Libre') setCommissionPct(12);
    else if (channel === 'Tienda Propia') setCommissionPct(4);
    else if (channel === 'Mayorista') setCommissionPct(2);
    else if (channel === 'Retail Físico') setCommissionPct(8);
  };

  // Simular descuento comercial
  useEffect(() => {
    const runSimulation = async () => {
      setIsSimulating(true);
      try {
        const res = await apiService.simulatePricing({
          base_price: basePrice,
          cost: cost,
          discount_pct: discountPct,
          channel: selectedChannel,
          commission_pct: commissionPct,
          freight: freight,
        });
        setSimulation(res);
      } catch (err) {
        console.error('Error running discount simulation', err);
      } finally {
        setIsSimulating(false);
      }
    };

    const timeout = setTimeout(runSimulation, 250);
    return () => clearTimeout(timeout);
  }, [basePrice, cost, discountPct, selectedChannel, commissionPct, freight]);

  // Filtrado de tabla
  const filteredMargins = margins.filter((item) => {
    if (selectedCategory !== 'Todas' && item.categoria.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.sku.toLowerCase().includes(q) ||
        item.nombre.toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const columns: Column<MarginSummaryItem>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: '120px',
      render: (row) => (
        <button
          onClick={() => handleSkuChange(row.sku)}
          className="font-mono font-bold text-[#00a2e8] hover:underline text-left"
        >
          {row.sku}
        </button>
      ),
    },
    {
      key: 'nombre',
      header: 'Producto',
      render: (row) => (
        <span className="font-medium text-[#333333]">{row.nombre}</span>
      ),
    },
    {
      key: 'precio_venta',
      header: 'Precio Venta',
      render: (row) => `$${Number(row.precio_venta).toFixed(2)}`,
    },
    {
      key: 'costo_unitario',
      header: 'Costo Unitario',
      render: (row) => {
        const effectiveRole = currentRole || getCurrentRole();
        if (effectiveRole === 'analista_comercial') {
          return <span className="font-mono text-slate-400 font-bold select-none" title="Confidencial para Analista Comercial">***</span>;
        }
        return `$${Number(row.costo_unitario).toFixed(2)}`;
      },
    },
    {
      key: 'gross_margin_pct',
      header: 'Margen Bruto %',
      render: (row) => {
        const val = Number(row.gross_margin_pct);
        return (
          <span
            className={`font-semibold ${
              val >= 35 ? 'text-[#2ecc71]' : val >= 20 ? 'text-[#f39c12]' : 'text-[#e74c3c]'
            }`}
          >
            {val.toFixed(1)}%
          </span>
        );
      },
    },
    {
      key: 'markup_pct',
      header: 'Markup %',
      render: (row) => `${Number(row.markup_pct).toFixed(1)}%`,
    },
    {
      key: 'unit_contribution_margin',
      header: 'Contribución Unit.',
      render: (row) => `$${Number(row.unit_contribution_margin).toFixed(2)}`,
    },
    {
      key: 'marginal_ratio',
      header: 'Ratio Marginal',
      render: (row) => (
        <span className="font-semibold text-slate-700">
          {(Number(row.marginal_ratio) * 100).toFixed(1)}%
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Simulator Card and Waterfall Graphic */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Slider Panel */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-sky-50 text-[#00a2e8] rounded-lg">
                <Sliders size={18} />
              </div>
              <h3 className="font-bold text-sm text-[#333333]">Simulador de Sensibilidad de Pricing</h3>
            </div>
            {simulation && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  isSimulating
                    ? 'bg-sky-50 text-[#00a2e8] border-sky-200'
                    : simulation.is_viable
                    ? 'bg-emerald-50 text-[#2ecc71] border-emerald-200'
                    : 'bg-rose-50 text-[#e74c3c] border-rose-200'
                }`}
              >
                {isSimulating
                  ? 'Recalculando...'
                  : simulation.is_viable
                  ? 'Operación Viable'
                  : 'Alerta Margen Crítico'}
              </span>
            )}
          </div>

          {/* Selector de SKU y Canal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#535c69] mb-1">
                Producto / SKU
              </label>
              <select
                value={selectedSku}
                onChange={(e) => handleSkuChange(e.target.value)}
                className="w-full bg-[#f5f7f8] border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-[#333333] focus:outline-none focus:border-[#00a2e8]"
              >
                <option value="">Entrada Manual</option>
                {margins.map((m) => (
                  <option key={m.sku} value={m.sku}>
                    {m.sku} - {m.nombre.slice(0, 16)}...
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#535c69] mb-1">
                Canal de Venta
              </label>
              <select
                value={selectedChannel}
                onChange={(e) => handleChannelChange(e.target.value)}
                className="w-full bg-[#f5f7f8] border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-[#333333] focus:outline-none focus:border-[#00a2e8]"
              >
                <option value="Mercado Libre">Mercado Libre (12% com.)</option>
                <option value="Tienda Propia">Tienda Propia (4% pasarela)</option>
                <option value="Retail Físico">Retail Físico (8% fees)</option>
                <option value="Mayorista">Canal Mayorista (2% fees)</option>
              </select>
            </div>
          </div>

          {/* Banner de Advertencia si Ratio Marginal < 15% */}
          {simulation && simulation.below_threshold_15pct && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2 animate-in fade-in">
              <span className="text-amber-500 text-sm">🚨</span>
              <div className="text-xs">
                <span className="font-bold text-amber-800 block">
                  Advertencia de Margen Crítico (&lt; 15%)
                </span>
                <span className="text-amber-700 leading-tight block mt-0.5">
                  El descuento de {discountPct}% en el canal {selectedChannel} sitúa el ratio marginal en{' '}
                  <strong>{(simulation.marginal_ratio * 100).toFixed(1)}%</strong>, comprometiendo la absorción de costos fijos.
                </span>
              </div>
            </div>
          )}

          {/* Slider Precio Base */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-[#535c69]">Precio de Venta Base ($)</span>
              <span className="font-bold font-mono text-[#333333]">${basePrice}</span>
            </div>
            <input
              type="range"
              min={10}
              max={50000}
              step={10}
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              className="w-full accent-[#00a2e8]"
            />
          </div>

          {/* Slider Costo Unitario */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-[#535c69]">Costo Unitario ($)</span>
              <span className="font-bold font-mono text-[#333333]">${cost}</span>
            </div>
            <input
              type="range"
              min={5}
              max={40000}
              step={5}
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              className="w-full accent-slate-600"
            />
          </div>

          {/* Slider Descuento Comercial */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-[#535c69]">Descuento Comercial (%)</span>
              <span className="font-bold font-mono text-[#e74c3c]">{discountPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={discountPct}
              onChange={(e) => setDiscountPct(Number(e.target.value))}
              className="w-full accent-[#e74c3c]"
            />
          </div>

          {/* Slider Comisión & Flete */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-medium text-[#535c69]">Comisión (%)</span>
                <span className="font-bold font-mono text-[#f39c12]">{commissionPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={25}
                step={0.5}
                value={commissionPct}
                onChange={(e) => setCommissionPct(Number(e.target.value))}
                className="w-full accent-[#f39c12]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-medium text-[#535c69]">Flete ($)</span>
                <span className="font-bold font-mono text-slate-700">${freight}</span>
              </div>
              <input
                type="range"
                min={0}
                max={500}
                step={5}
                value={freight}
                onChange={(e) => setFreight(Number(e.target.value))}
                className="w-full accent-slate-400"
              />
            </div>
          </div>

          {/* Quick Metrics from Simulation */}
          {simulation && (
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
              <div className="bg-[#f5f7f8] p-2 rounded-lg">
                <span className="text-[10px] text-[#535c69] block">Precio Efectivo</span>
                <span className="text-xs font-bold text-[#333333]">
                  ${Number(simulation.effective_price).toFixed(2)}
                </span>
              </div>
              <div className="bg-[#f5f7f8] p-2 rounded-lg">
                <span className="text-[10px] text-[#535c69] block">Margen Bruto %</span>
                <span
                  className={`text-xs font-bold ${
                    simulation.gross_margin_pct >= 25 ? 'text-[#2ecc71]' : 'text-[#e74c3c]'
                  }`}
                >
                  {Number(simulation.gross_margin_pct).toFixed(1)}%
                </span>
              </div>
              <div className="bg-[#f5f7f8] p-2 rounded-lg">
                <span className="text-[10px] text-[#535c69] block">Markup %</span>
                <span className="text-xs font-bold text-[#00a2e8]">
                  {Number(simulation.markup_pct).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Waterfall Chart Panel */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-bold text-sm text-[#333333] dark:text-slate-100">
                Desglose Waterfall de Margen &amp; Contribución Unitaria
              </h3>
              <p className="text-xs text-[#535c69] dark:text-slate-400 mt-0.5">
                Impacto escalonado de deducciones comerciales sobre la ganancia neta final
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#535c69] dark:text-slate-400 block uppercase tracking-wider">
                Margen Contribución
              </span>
              <span
                className={`text-lg font-bold font-mono ${
                  (simulation?.unit_contribution_margin ?? 0) >= 0
                    ? 'text-[#2ecc71]'
                    : 'text-[#e74c3c]'
                }`}
              >
                ${Number(simulation?.unit_contribution_margin ?? 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Renderizado de Cascada Flotante */}
          <WaterfallChart
            basePrice={basePrice}
            discountAmount={(basePrice * discountPct) / 100}
            effectivePrice={simulation?.effective_price ?? (basePrice - (basePrice * discountPct) / 100)}
            directCost={cost}
            channelAndFreight={
              simulation
                ? ((simulation.effective_price * commissionPct) / 100 + freight)
                : ((basePrice * (1 - discountPct / 100) * commissionPct) / 100 + freight)
            }
            netContribution={
              simulation?.unit_contribution_margin ??
              (basePrice - (basePrice * discountPct) / 100 - cost - ((basePrice * (1 - discountPct / 100) * commissionPct) / 100 + freight))
            }
          />

          <div className="p-3 bg-[#f5f7f8] dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs text-[#535c69] dark:text-slate-300 mt-2">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 size={14} className="text-[#00a2e8]" />
              <span>
                Ratio Marginal:{' '}
                <strong className="text-[#333333]">
                  {((simulation?.marginal_ratio ?? 0) * 100).toFixed(1)}%
                </strong>
              </span>
            </div>
            <span>
              {simulation?.is_viable
                ? '✅ Descuento absorbe costos variables satisfactoriamente.'
                : '⚠️ El descuento destruye el margen de contribución de la unidad.'}
            </span>
          </div>
        </div>
      </div>

      {/* Sección: Agente de Bundling Inteligente & Packs Anti-Sobrestock (IA Cross-Área) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-xs">
              <Package size={20} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-[#333333] dark:text-slate-100">
                  Agente de Bundling &amp; Packs Anti-Sobrestock (IA Cross-Área)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center space-x-1">
                  <Sparkles size={11} />
                  <span>Comité 360°</span>
                </span>
              </div>
              <p className="text-xs text-[#535c69] dark:text-slate-400 mt-0.5">
                Combina productos de baja rotación (DOH &gt; 90d) con productos ancla, liberando capital de trabajo y m² de bodega sin erosionar el margen neto.
              </p>
            </div>
          </div>

          <button
            onClick={fetchAIBundles}
            disabled={loadingBundles}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all hover:shadow-indigo-500/20 active:scale-95 shrink-0"
          >
            <Sparkles size={14} className={loadingBundles ? 'animate-spin' : ''} />
            <span>{loadingBundles ? 'Analizando Catálogo e Inventario...' : 'Regenerar Sugerencias IA'}</span>
          </button>
        </div>

        {/* Dictamen del CFO / Resumen Ejecutivo */}
        {bundlesData && (
          <div className="p-4 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-800/80 dark:to-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
              <ShieldAlert size={15} />
              <span>DICTAMEN DEL COMITÉ FINANCIERO (CFO &amp; SUPPLY CHAIN)</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
              {bundlesData.dictamen_cfo}
            </p>
          </div>
        )}

        {/* Grilla de Packs IA */}
        {loadingBundles ? (
          <div className="py-12 text-center space-y-2">
            <Loader2 size={24} className="animate-spin text-indigo-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-500">Evaluando curvas ABC de inventario, DOH y márgenes de contribución...</p>
          </div>
        ) : !bundlesData || bundlesData.bundles.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No hay sugerencias de packs disponibles actualmente. Haz clic en "Regenerar Sugerencias IA" para iniciar el escaneo.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {bundlesData.bundles.map((bundle) => {
              const isCopied = copiedBundleId === bundle.id;
              return (
                <div
                  key={bundle.id}
                  className="bg-[#fcfdfe] dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all group"
                >
                  <div className="space-y-3.5">
                    {/* Header del Pack */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                          {bundle.id}
                        </span>
                        <h4 className="font-bold text-sm text-[#333333] dark:text-slate-100 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {bundle.nombre_pack}
                        </h4>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          -{bundle.descuento_bundle_pct}% OFF
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
                          {bundle.margen_neto_pct}% Margen
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {bundle.descripcion}
                    </p>

                    {/* Lista de Productos del Bundle */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                        Composición del Pack ({bundle.productos.length} SKUs):
                      </span>
                      <div className="space-y-1">
                        {bundle.productos.map((prod) => (
                          <div
                            key={prod.sku}
                            className="p-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-mono font-bold text-[11px] text-[#00a2e8] block truncate">
                                {prod.sku}
                              </span>
                              <span className="text-[11px] text-[#333333] dark:text-slate-200 font-medium truncate block">
                                {prod.nombre}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              {prod.es_sobrestock ? (
                                <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  ⚠️ Sobrestock ({prod.doh}d)
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold rounded bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                  ⚡ Ancla ({prod.stock_actual}u)
                                </span>
                              )}
                              <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                                Reg: ${prod.precio_regular_usd.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Precios y Liberación de Recursos */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Precio Pack Sugerido</span>
                        <div className="flex items-baseline space-x-1.5 mt-0.5">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                            ${bundle.precio_bundle_sugerido_usd.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400 line-through font-mono">
                            ${bundle.precio_individual_total_usd.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Capital Liberado</span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono block mt-0.5">
                          +${bundle.capital_inmovilizado_liberado_usd.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="p-2 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-center justify-between text-[11px] text-indigo-700 dark:text-indigo-300">
                      <div className="flex items-center space-x-1.5">
                        <Warehouse size={13} className="text-indigo-600 dark:text-indigo-400" />
                        <span>Espacio liberado:</span>
                      </div>
                      <span className="font-bold font-mono">~{bundle.m2_liberados_estimados.toFixed(1)} m² de bodega</span>
                    </div>

                    {/* Evaluaciones de Comités */}
                    <div className="space-y-1.5 pt-1 text-[11px]">
                      <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl space-y-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                          <Lightbulb size={11} className="text-amber-500" />
                          <span>Evaluaciones Cross-Área:</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400"><strong className="text-slate-700 dark:text-slate-300">Mkt:</strong> {bundle.evaluacion_marketing}</p>
                        <p className="text-slate-600 dark:text-slate-400"><strong className="text-slate-700 dark:text-slate-300">Finanzas:</strong> {bundle.evaluacion_finanzas}</p>
                        <p className="text-slate-600 dark:text-slate-400"><strong className="text-slate-700 dark:text-slate-300">Logística:</strong> {bundle.evaluacion_logistica}</p>
                      </div>

                      {/* Argumento Comercial */}
                      <div className="p-2.5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 rounded-xl">
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block mb-1">
                          Pitch Comercial para Ejecutivos:
                        </span>
                        <p className="text-amber-900 dark:text-amber-200 italic leading-relaxed text-[11px]">
                          "{bundle.argumento_comercial}"
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Botón Copiar Propuesta */}
                  <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handleCopyProposal(bundle)}
                      className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-all flex items-center justify-center space-x-1.5"
                    >
                      {isCopied ? (
                        <>
                          <Check size={14} className="text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">¡Propuesta Copiada al Portapapeles!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copiar Propuesta Comercial</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pricing Matrix Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#333333]">
            Matriz de Rentabilidad Comercial por Catálogo
          </h3>
          <span className="text-xs text-[#535c69]">
            {filteredMargins.length} SKUs analizados
          </span>
        </div>

        <DataTable
          data={filteredMargins}
          columns={columns}
          keyExtractor={(row) => row.sku}
          pageSizeDefault={10}
          searchPlaceholder="Buscar por SKU o producto..."
        />
      </div>
    </div>
  );
};
