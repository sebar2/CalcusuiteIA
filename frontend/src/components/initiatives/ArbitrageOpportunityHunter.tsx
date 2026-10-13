import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  ExternalLink, 
  TrendingUp, 
  Percent, 
  RefreshCw, 
  Sparkles, 
  Cpu, 
  CheckCircle2,
  AlertTriangle,
  Building2,
  ShoppingBag,
  Globe2
} from 'lucide-react';
import { apiService } from '../../services/api';
import type { 
  MluCategoryInfo, 
  ArbitrageScanResponse 
} from '../../types';

export const ArbitrageOpportunityHunter: React.FC = () => {
  // Estado de Filtros
  const [categories, setCategories] = useState<MluCategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [articleName, setArticleName] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [currency, setCurrency] = useState<'UYU' | 'USD'>('UYU');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('qwen2.5:7b');
  const [limit, setLimit] = useState<number>(100);

  // Estado de Ejecución
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ArbitrageScanResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtro de tabla local
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedProfitTier, setSelectedProfitTier] = useState<string>('ALL');

  // Carga inicial de categorías y modelos Ollama
  useEffect(() => {
    const fetchInitData = async () => {
      try {
        const [cats, models] = await Promise.all([
          apiService.getMluCategories(),
          apiService.getArbitrageModels()
        ]);
        setCategories(cats);
        if (models && models.length > 0) {
          setOllamaModels(models);
          // Preferir qwen2.5 si existe, sino el primero
          const preferred = models.find(m => m.includes('qwen2.5') || m.includes('gemma')) || models[0];
          setSelectedModel(preferred);
        }
      } catch (err) {
        console.error('Error al inicializar filtros de arbitraje:', err);
      }
    };
    fetchInitData();
  }, []);

  const handleScan = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const payload = {
        category_id: selectedCategory,
        article_name: articleName.trim() || undefined,
        min_price: minPrice ? parseFloat(minPrice) : undefined,
        max_price: maxPrice ? parseFloat(maxPrice) : undefined,
        currency,
        ollama_model: selectedModel,
        limit,
      };
      const result = await apiService.scanArbitrage(payload);
      setScanResult(result);
    } catch (err: any) {
      console.error('Error en escaneo de arbitraje:', err);
      setErrorMsg(err.response?.data?.detail || 'Ocurrió un error al ejecutar el rastreo de arbitraje.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (!scanResult) return;
    setIsExporting(true);
    try {
      await apiService.exportArbitrageExcel({
        category_id: selectedCategory,
        article_name: articleName.trim() || undefined,
        min_price: minPrice ? parseFloat(minPrice) : undefined,
        max_price: maxPrice ? parseFloat(maxPrice) : undefined,
        currency,
        ollama_model: selectedModel,
        limit,
      });
    } catch (err) {
      console.error('Error al exportar planilla Excel:', err);
      alert('Error al descargar la planilla Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  // Filtrado reactivo en la tabla
  const filteredItems = (scanResult?.items || []).filter(item => {
    const matchesText = !searchFilter || 
      item.mlu_title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.b2b_english_query.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.mlu_seller_name.toLowerCase().includes(searchFilter.toLowerCase());

    const matchesTier = selectedProfitTier === 'ALL' ||
      (selectedProfitTier === 'HIGH' && item.net_margin_pct >= 40) ||
      (selectedProfitTier === 'MEDIUM' && item.net_margin_pct >= 20 && item.net_margin_pct < 40) ||
      (selectedProfitTier === 'LOW' && item.net_margin_pct < 20);

    return matchesText && matchesTier;
  });

  return (
    <div className="space-y-6">
      {/* PANEL SUPERIOR: FILTROS Y CONTROLES DE BÚSQUEDA */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] rounded-xl">
                <Globe2 size={20} />
              </span>
              <div>
                <h3 className="text-base font-bold text-[#333333] dark:text-slate-100 flex items-center gap-2">
                  <span>Cazador de Oportunidades: Mercado Libre UY vs. Alibaba B2B</span>
                  <span className="text-[11px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800">
                    28 Categorías Retail MLU
                  </span>
                </h3>
                <p className="text-xs text-[#535c69] dark:text-slate-400">
                  Rastrea líderes en ventas de Uruguay, traduce a especificaciones industriales con IA local y costea importaciones FOB con fórmulas vivas.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={handleExportExcel}
              disabled={!scanResult || isExporting}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                scanResult && !isExporting
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer hover:shadow'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Download size={14} className={isExporting ? 'animate-bounce' : ''} />
              <span>{isExporting ? 'Generando Excel...' : 'Descargar Excel (100 Artículos)'}</span>
            </button>

            <button
              onClick={handleScan}
              disabled={isLoading}
              className="flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold bg-[#00a2e8] hover:bg-sky-600 text-white shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Rastreando & Costeando...' : 'Escanear Oportunidades'}</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center space-x-2">
            <AlertTriangle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* CONTROLES DE FILTRO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs">
          {/* Categoría Oficial */}
          <div className="lg:col-span-4">
            <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">
              Categoría Oficial Mercado Libre UY
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
            >
              <option value="ALL">🌟 Todas las Categorías (Top Retail Cross-Category)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} ({cat.id})
                </option>
              ))}
            </select>
          </div>

          {/* Nombre / Palabra Clave (Opcional) */}
          <div className="lg:col-span-3">
            <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">
              Artículo o Palabra Clave (Opcional)
            </label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={articleName}
                onChange={(e) => setArticleName(e.target.value)}
                placeholder="Ej. auricular, taladro, silla gamer..."
                className="w-full pl-8 bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pr-3 py-2 text-xs font-medium text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
              />
            </div>
          </div>

          {/* Rango de Precios */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-[#535c69] dark:text-slate-300">
                Rango Precio ({currency})
              </label>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setCurrency('UYU')}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition-all ${
                    currency === 'UYU'
                      ? 'bg-[#00a2e8] text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  $ UYU
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-1.5 py-0.5 text-[10px] rounded font-bold transition-all ${
                    currency === 'USD'
                      ? 'bg-[#00a2e8] text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  US$ USD
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Mínimo"
                className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
              />
              <input
                type="number"
                min="0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Máximo"
                className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
              />
            </div>
          </div>

          {/* Modelo Ollama & Límite */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-[#535c69] dark:text-slate-300 flex items-center gap-1">
                <Cpu size={12} className="text-[#00a2e8]" />
                <span>Modelo IA</span>
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="bg-slate-100 dark:bg-slate-700 text-[10px] font-bold rounded px-1.5 py-0.5 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 focus:outline-none"
              >
                <option value={25}>25 items</option>
                <option value={50}>50 items</option>
                <option value={100}>100 items</option>
              </select>
            </div>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-medium text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
            >
              {ollamaModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* MÉTRICAS CONSOLIDADAS DEL ESCANEO */}
      {scanResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-semibold">Artículos Costeados</span>
              <ShoppingBag size={15} className="text-sky-500" />
            </div>
            <div className="text-xl font-bold font-mono text-[#333333] dark:text-slate-100">
              {scanResult.total_items}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Tiempo: {scanResult.execution_time_seconds}s
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-semibold">Margen Neto Promedio</span>
              <Percent size={15} className="text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {scanResult.summary_metrics.avg_net_margin_pct}%
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Neto de comisiones MLU
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-semibold">Markup Promedio</span>
              <TrendingUp size={15} className="text-[#00a2e8]" />
            </div>
            <div className="text-xl font-bold font-mono text-[#00a2e8]">
              {scanResult.summary_metrics.avg_markup}x
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Multiplicador sobre Landed Cost
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-semibold">Alta Rentabilidad</span>
              <CheckCircle2 size={15} className="text-emerald-500" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {scanResult.summary_metrics.high_profit_opportunities}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Margen neto &gt; 40%
            </p>
          </div>
        </div>
      )}

      {/* TABLA PRINCIPAL DE 100 ARTÍCULOS */}
      {scanResult && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-5">
          {/* Barra de Búsqueda y Filtros Rápidos de Tabla */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-bold text-[#333333] dark:text-slate-100">
                Comparativa de Artículos ({filteredItems.length} de {scanResult.total_items})
              </h4>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filtrar en tabla..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#00a2e8]"
                />
              </div>

              <select
                value={selectedProfitTier}
                onChange={(e) => setSelectedProfitTier(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#00a2e8]"
              >
                <option value="ALL">Todos los Márgenes</option>
                <option value="HIGH">Alta Rentabilidad (&gt;= 40%)</option>
                <option value="MEDIUM">Rentabilidad Media (20-40%)</option>
                <option value="LOW">Margen Ajustado (&lt; 20%)</option>
              </select>
            </div>
          </div>

          {/* TABLA RESPONSIVA */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-[#535c69] dark:text-slate-300 font-semibold border-b border-slate-200/80 dark:border-slate-800">
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th className="py-3 px-3 min-w-[240px]">Producto en Mercado Libre UY</th>
                  <th className="py-3 px-3 text-right">Precio Venta (UYU / USD)</th>
                  <th className="py-3 px-3 min-w-[220px]">Contraparte B2B Alibaba</th>
                  <th className="py-3 px-3 text-right">Costo FOB (USD)</th>
                  <th className="py-3 px-3 text-right">Landed Cost MVD</th>
                  <th className="py-3 px-3 text-right">Comisión MLU</th>
                  <th className="py-3 px-3 text-right">Margen Neto</th>
                  <th className="py-3 px-3 text-center">Dictamen</th>
                  <th className="py-3 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => (
                  <tr 
                    key={item.mlu_id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Rank */}
                    <td className="py-3 px-3 text-center font-bold text-slate-400 font-mono">
                      {item.ranking}
                    </td>

                    {/* Producto MLU */}
                    <td className="py-3 px-3">
                      <div className="flex items-start space-x-2.5">
                        {item.mlu_thumbnail ? (
                          <img
                            src={item.mlu_thumbnail}
                            alt=""
                            className="w-10 h-10 object-contain rounded border border-slate-200 dark:border-slate-700 bg-white shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-400">
                            <ShoppingBag size={18} />
                          </div>
                        )}
                        <div className="space-y-0.5">
                          <a
                            href={item.mlu_permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[#333333] dark:text-slate-100 line-clamp-2 hover:text-[#00a2e8] hover:underline transition-colors"
                            title="Abrir en Mercado Libre Uruguay"
                          >
                            {item.mlu_title}
                          </a>
                          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                            <span className="font-medium text-sky-600 dark:text-sky-400">
                              {item.mlu_seller_name}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              {item.trend_signal}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Precios MLU */}
                    <td className="py-3 px-3 text-right font-mono">
                      <div className="font-bold text-[#333333] dark:text-slate-100">
                        ${item.mlu_price_uyu.toLocaleString()} UYU
                      </div>
                      <div className="text-[11px] text-slate-500">
                        US$ {item.mlu_price_usd.toFixed(2)}
                      </div>
                    </td>

                    {/* Contraparte Alibaba */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <a
                          href={item.alibaba_search_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1 hover:text-orange-600 dark:hover:text-orange-400 hover:underline transition-colors"
                          title="Abrir fábricas verificadas en Alibaba"
                        >
                          <Sparkles size={11} className="text-amber-500 shrink-0" />
                          <span className="line-clamp-1">{item.b2b_english_query}</span>
                        </a>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                          <Building2 size={11} className="shrink-0 text-slate-400" />
                          <span className="truncate max-w-[150px]">{item.alibaba_supplier}</span>
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
                            {item.alibaba_years}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Costo FOB */}
                    <td className="py-3 px-3 text-right font-mono">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        US$ {item.alibaba_fob_price_usd.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        MOQ: {item.alibaba_moq} pcs
                      </div>
                    </td>

                    {/* Landed Cost */}
                    <td className="py-3 px-3 text-right font-mono">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        US$ {item.landed_cost_usd.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Flete+Ad: +US${item.shipping_logistics_usd.toFixed(2)}
                      </div>
                    </td>

                    {/* Comisión MLU */}
                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      US$ {item.mlu_fee_usd.toFixed(2)}
                    </td>

                    {/* Margen Neto */}
                    <td className="py-3 px-3 text-right font-mono">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">
                        US$ {item.net_margin_usd.toFixed(2)}
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        {item.net_margin_pct.toFixed(1)}% ({item.markup.toFixed(2)}x)
                      </div>
                    </td>

                    {/* Dictamen */}
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        item.status_color === 'emerald'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : item.status_color === 'blue'
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      }`}>
                        {item.recommendation}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <a
                          href={item.mlu_permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver en Mercado Libre Uruguay"
                          className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <ShoppingBag size={14} />
                        </a>
                        <a
                          href={item.alibaba_search_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver Fábricas en Alibaba"
                          className="p-1.5 text-slate-400 hover:text-orange-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
