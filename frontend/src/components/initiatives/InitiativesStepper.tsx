import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Search,
  CheckSquare,
  Square,
  Download,
  BrainCircuit,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Store,
  MapPin,
  Globe,
  DollarSign,
  BarChart2,
  Briefcase,
  AlertCircle,
  RotateCw,
  Lightbulb,
  X,
  Sliders
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine
} from 'recharts';
import { apiService } from '../../services/api';
import { AILoader } from '../common/AILoader';
import { CreatableCategorySelect } from '../common/CreatableCategorySelect';
import type {
  CompetitorItemResponse,
  CompetitorSelectionEvaluationResponse,
  CapexBreakdown,
  OpexBreakdown,
  EngineMode
} from '../../types';

interface InitiativesStepperProps {
  engineMode?: EngineMode;
}

const COUNTRY_DEPARTMENTS: Record<string, string[]> = {
  Uruguay: ['Todo el país', 'Montevideo', 'Canelones', 'Maldonado', 'Colonia', 'Salto', 'Paysandú'],
  Argentina: ['Todo el país', 'Buenos Aires', 'Córdoba', 'Santa Fe', 'Mendoza', 'Tucumán'],
  Chile: ['Todo el país', 'Santiago', 'Valparaíso', 'Biobío', 'Antofagasta'],
  Brasil: ['Todo el país', 'São Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Paraná']
};

const sanitizeMarkdown = (raw?: string) => {
  if (!raw) return '';
  return raw
    .replace(/^```markdown\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
};

export const InitiativesStepper: React.FC<InitiativesStepperProps> = ({ engineMode = 'auto' }) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Categorías de la base de datos
  const [categories, setCategories] = useState<string[]>(['Electrónica', 'Industrial', 'Insumos', 'General']);

  // FASE 1: Parámetros del Proyecto y Búsqueda
  const [productName, setProductName] = useState<string>('Auriculares Inalámbricos Pro');
  const [selectedCategory, setSelectedCategory] = useState<string>('Electrónica');
  const [proposedPrice, setProposedPrice] = useState<number>(185);
  const [country, setCountry] = useState<string>('Uruguay');
  const [department, setDepartment] = useState<string>('Todo el país');
  const [platform, setPlatform] = useState<'google_serper' | 'web_ddgs' | 'mercadolibre' | 'hybrid'>('google_serper');
  const [searchQuery, setSearchQuery] = useState<string>('auriculares inalambricos bluetooth pro');

  // FASE 2: Muestra de Competidores y Curaduría
  const [competitors, setCompetitors] = useState<CompetitorItemResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Parámetros Financieros Complementarios
  const [proposedCost, setProposedCost] = useState<number>(95);
  const [expectedDemand, setExpectedDemand] = useState<number>(400);
  const [initialInvestment, setInitialInvestment] = useState<number>(25000);
  const [monthlyOpex, setMonthlyOpex] = useState<number>(3500);

  // Desglose de Inversión (CAPEX) y Costos Fijos Operativos (OPEX)
  const [showBreakdownModal, setShowBreakdownModal] = useState<boolean>(false);
  const [capexBreakdown, setCapexBreakdown] = useState<CapexBreakdown>({
    maquinaria_equipos: 15000,
    adecuacion_local: 5000,
    marketing_lanzamiento: 3000,
    habilitaciones_marcas: 1000,
    otros_capex: 1000,
  });
  const [opexBreakdown, setOpexBreakdown] = useState<OpexBreakdown>({
    sueldos_personal: 2000,
    alquiler_deposito: 800,
    publicidad_mensual: 400,
    seguros_servicios: 200,
    otros_opex: 100,
  });

  // Sincronización Bidireccional de Desgloses
  const updateCapexField = (field: keyof CapexBreakdown, value: number) => {
    const updated = { ...capexBreakdown, [field]: value };
    setCapexBreakdown(updated);
    const total = Object.values(updated).reduce((acc, v) => acc + (Number(v) || 0), 0);
    setInitialInvestment(Math.round(total * 100) / 100);
  };

  const updateOpexField = (field: keyof OpexBreakdown, value: number) => {
    const updated = { ...opexBreakdown, [field]: value };
    setOpexBreakdown(updated);
    const total = Object.values(updated).reduce((acc, v) => acc + (Number(v) || 0), 0);
    setMonthlyOpex(Math.round(total * 100) / 100);
  };

  // Moneda Deseada y Cotización Oficial BROU
  const [targetCurrency, setTargetCurrency] = useState<'USD' | 'UYU'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(42.65);
  const [exchangeRateSource, setExchangeRateSource] = useState<string>('BROU');

  // FASE 3: Evaluación Cuantitativa e IA
  const [evaluation, setEvaluation] = useState<CompetitorSelectionEvaluationResponse | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cargar cotización oficial del BROU al montar
  useEffect(() => {
    apiService.getBROUExchangeRate()
      .then((rateData) => {
        if (rateData && rateData.rate_used) {
          setExchangeRate(rateData.rate_used);
          setExchangeRateSource(rateData.source);
        }
      })
      .catch(() => {});
  }, []);

  // Cargar categorías disponibles
  useEffect(() => {
    apiService.getCategories()
      .then((cats) => {
        if (cats && cats.length > 0) {
          setCategories(cats);
          if (!selectedCategory || !cats.includes(selectedCategory)) {
            setSelectedCategory(cats[0]);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleCurrencyChange = (newCurrency: 'USD' | 'UYU') => {
    if (newCurrency === targetCurrency) return;
    const rate = exchangeRate || 42.65;
    if (newCurrency === 'UYU') {
      // De USD a UYU: multiplicar valores por la cotización BROU
      setProposedPrice((prev) => Math.round(prev * rate));
      setProposedCost((prev) => Math.round(prev * rate));
      setInitialInvestment((prev) => Math.round(prev * rate));
      setMonthlyOpex((prev) => Math.round(prev * rate));
      setCapexBreakdown((prev) => ({
        maquinaria_equipos: Math.round(prev.maquinaria_equipos * rate),
        adecuacion_local: Math.round(prev.adecuacion_local * rate),
        marketing_lanzamiento: Math.round(prev.marketing_lanzamiento * rate),
        habilitaciones_marcas: Math.round(prev.habilitaciones_marcas * rate),
        otros_capex: Math.round(prev.otros_capex * rate),
      }));
      setOpexBreakdown((prev) => ({
        sueldos_personal: Math.round(prev.sueldos_personal * rate),
        alquiler_deposito: Math.round(prev.alquiler_deposito * rate),
        publicidad_mensual: Math.round(prev.publicidad_mensual * rate),
        seguros_servicios: Math.round(prev.seguros_servicios * rate),
        otros_opex: Math.round(prev.otros_opex * rate),
      }));
    } else {
      // De UYU a USD: dividir valores por la cotización BROU
      setProposedPrice((prev) => Math.round((prev / rate) * 100) / 100);
      setProposedCost((prev) => Math.round((prev / rate) * 100) / 100);
      setInitialInvestment((prev) => Math.round(prev / rate));
      setMonthlyOpex((prev) => Math.round(prev / rate));
      setCapexBreakdown((prev) => ({
        maquinaria_equipos: Math.round((prev.maquinaria_equipos / rate) * 100) / 100,
        adecuacion_local: Math.round((prev.adecuacion_local / rate) * 100) / 100,
        marketing_lanzamiento: Math.round((prev.marketing_lanzamiento / rate) * 100) / 100,
        habilitaciones_marcas: Math.round((prev.habilitaciones_marcas / rate) * 100) / 100,
        otros_capex: Math.round((prev.otros_capex / rate) * 100) / 100,
      }));
      setOpexBreakdown((prev) => ({
        sueldos_personal: Math.round((prev.sueldos_personal / rate) * 100) / 100,
        alquiler_deposito: Math.round((prev.alquiler_deposito / rate) * 100) / 100,
        publicidad_mensual: Math.round((prev.publicidad_mensual / rate) * 100) / 100,
        seguros_servicios: Math.round((prev.seguros_servicios / rate) * 100) / 100,
        otros_opex: Math.round((prev.otros_opex / rate) * 100) / 100,
      }));
    }
    setTargetCurrency(newCurrency);
  };

  const getNormalizedPrice = (item: CompetitorItemResponse): { amount: number; symbol: string } => {
    const rate = exchangeRate || 42.65;
    if (targetCurrency === 'UYU') {
      if (item.precio_uyu) {
        return { amount: Number(item.precio_uyu), symbol: 'UYU $' };
      }
      if (item.moneda === 'UYU' && item.precio_original) {
        return { amount: Number(item.precio_original), symbol: 'UYU $' };
      }
      return { amount: Math.round(Number(item.precio_usd) * rate), symbol: 'UYU $' };
    } else {
      return { amount: Number(item.precio_usd), symbol: 'USD $' };
    }
  };

  const handleCategoryCreated = (newCat: string) => {
    if (!categories.includes(newCat)) {
      setCategories((prev) => [...prev, newCat]);
    }
    setSelectedCategory(newCat);
  };

  // Sincronizar query de búsqueda al cambiar nombre de producto
  const handleProductNameChange = (val: string) => {
    setProductName(val);
    setSearchQuery(val.toLowerCase());
  };

  // FASE 1 -> FASE 2: Búsqueda rápida (< 3s, sin LLM)
  const handleSearchCompetitors = async () => {
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const res = await apiService.searchCompetitors({
        product_name: productName,
        category: selectedCategory,
        proposed_price: proposedPrice,
        search_query: searchQuery || productName,
        platform,
        country,
        department,
        target_currency: targetCurrency,
      });

      // Normalización defensiva de respuesta (Array directo u Objeto con status/message)
      const isArray = Array.isArray(res);
      const competitorsList = isArray ? res : (res?.competitors || []);
      const status = isArray ? 'success' : (res?.status || 'success');
      const apiMessage = isArray ? null : res?.message;

      if (!isArray && res && res.exchange_rate_used) {
        setExchangeRate(res.exchange_rate_used);
        if (res.exchange_rate_source) {
          setExchangeRateSource(res.exchange_rate_source);
        }
      }

      // Mostrar detalle real si la API devolvió un aviso o no hubo resultados
      if (status === 'error' || (competitorsList.length === 0 && apiMessage)) {
        setErrorMsg(apiMessage || 'No se encontraron tiendas locales para este término exacto. Prueba con un término más general o selecciona Mercado Libre.');
        setCompetitors([]);
        return;
      }

      if (competitorsList.length === 0) {
        setErrorMsg('No se encontraron tiendas locales para este término exacto. Prueba con un término más general o selecciona Mercado Libre.');
        setCompetitors([]);
        return;
      }

      setCompetitors(competitorsList);
      // Seleccionar todos por defecto
      setSelectedIds(new Set(competitorsList.map((c) => c.id)));
      setCurrentStep(2);
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('timeout'))) {
        setErrorMsg('La búsqueda en profundidad excedió el tiempo límite (10 min). Por favor, intenta con un término más específico.');
      } else {
        const apiDetail = err.response?.data?.message || err.response?.data?.detail || err.message;
        setErrorMsg(apiDetail || 'Error al rastrear competidores en el mercado.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle Checkbox Individual
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Seleccionar Todos / Invertir
  const toggleSelectAll = () => {
    if (selectedIds.size === competitors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(competitors.map((c) => c.id)));
    }
  };

  // Exportar Muestra a CSV con Sanitización Anti-CSV Injection
  const handleExportCSV = () => {
    if (competitors.length === 0) return;
    const sanitize = (val: any) => {
      if (val === null || val === undefined) return '""';
      let str = String(val).trim();
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      'Vendedor/Empresa',
      'Titulo del Producto',
      'Moneda Original',
      'Precio Original',
      'Precio USD',
      'Enlace Directo',
      'Seleccionado'
    ];

    const rows = competitors.map((c) => [
      sanitize(c.vendedor),
      sanitize(c.titulo),
      sanitize(c.moneda),
      c.precio_original !== undefined && c.precio_original !== null ? c.precio_original : '',
      c.precio_usd !== undefined && c.precio_usd !== null ? c.precio_usd : '',
      sanitize(c.url || ''),
      selectedIds.has(c.id) ? 'SI' : 'NO'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Muestra_Competidores_${productName.replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // FASE 2 -> FASE 3: Análisis Cuantitativo e Inferencia IA sobre la Muestra
  const handleEvaluateSelection = async () => {
    const selectedList = competitors.filter((c) => selectedIds.has(c.id));
    if (selectedList.length === 0) {
      setErrorMsg('Debes seleccionar al menos un competidor en la tabla para evaluar el Business Case.');
      return;
    }

    setIsEvaluating(true);
    setErrorMsg(null);
    try {
      const res = await apiService.evaluateCompetitorSelection({
        product_name: productName,
        category: selectedCategory,
        proposed_price: proposedPrice,
        proposed_cost: proposedCost,
        expected_demand: expectedDemand,
        initial_investment: initialInvestment,
        monthly_opex: monthlyOpex,
        capex_details: capexBreakdown,
        opex_details: opexBreakdown,
        selected_competitors: selectedList,
        engine_mode: engineMode,
        target_currency: targetCurrency,
      });
      setEvaluation(res);
      setCurrentStep(3);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error al evaluar el proyecto con Inteligencia Artificial.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!evaluation) return;
    const blob = new Blob([evaluation.raw_markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Business_Case_${productName.replace(/\s+/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Datos para gráfico comparativo en Fase 3
  const chartData = evaluation ? [
    { name: 'Mínimo Mercado', price: Number(evaluation.min_price), fill: '#64748b' },
    { name: 'Mediana Mercado', price: Number(evaluation.median_price), fill: '#94a3b8' },
    { name: 'Promedio Mercado', price: Number(evaluation.avg_price), fill: '#f59e0b' },
    { name: 'Propuesta Calcu', price: Number(evaluation.proposed_price), fill: '#00a2e8' },
    { name: 'Máximo Mercado', price: Number(evaluation.max_price), fill: '#ef4444' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Barra Superior del Stepper - Estilo Bitrix24 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] rounded-xl">
              <Briefcase size={22} />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#333333] dark:text-slate-100">
                Benchmarking de Mercado &amp; Business Case en 3 Fases
              </h2>
              <p className="text-xs text-[#535c69] dark:text-slate-400">
                Rastreo liviano sin latencia de LLM, curaduría de publicaciones y evaluación cuantitativa sobre la muestra.
              </p>
            </div>
          </div>

          {/* Stepper Wizard Bar */}
          <div className="flex items-center space-x-2">
            {/* Paso 1 */}
            <button
              onClick={() => setCurrentStep(1)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                currentStep === 1
                  ? 'bg-[#00a2e8] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">1</span>
              <span>Rastreo</span>
            </button>

            <span className="text-slate-300 dark:text-slate-700">→</span>

            {/* Paso 2 */}
            <button
              onClick={() => competitors.length > 0 && setCurrentStep(2)}
              disabled={competitors.length === 0}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 ${
                currentStep === 2
                  ? 'bg-[#00a2e8] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">2</span>
              <span>Curaduría ({selectedIds.size}/{competitors.length})</span>
            </button>

            <span className="text-slate-300 dark:text-slate-700">→</span>

            {/* Paso 3 */}
            <button
              onClick={() => evaluation && setCurrentStep(3)}
              disabled={!evaluation}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 ${
                currentStep === 3
                  ? 'bg-[#00a2e8] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">3</span>
              <span>Business Case &amp; IA</span>
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center space-x-2 animate-in fade-in">
          <AlertCircle size={16} className="shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FASE 1: PARÁMETROS Y RASTREO LIVIANO (SIN LLM, LATENCIA < 3s)            */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm max-w-4xl mx-auto space-y-5 animate-in fade-in">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-[#333333] dark:text-slate-100 flex items-center space-x-2">
              <Search size={16} className="text-[#00a2e8]" />
              <span>Fase 1: Parámetros del Producto y Rastreo Rápido de Competidores</span>
            </h3>
            <p className="text-xs text-[#535c69] dark:text-slate-400 mt-0.5">
              Consulta en tiempo real sin invocar modelos pesados (respuesta inmediata &lt; 3s).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Nombre del Producto */}
            <div className="md:col-span-2">
              <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                Nombre del Producto / Iniciativa
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => handleProductNameChange(e.target.value)}
                placeholder="ej. Auriculares Inalámbricos Pro"
                className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
              />
            </div>

            {/* Selector de Moneda y Cotización BROU */}
            <div className="md:col-span-2 bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-[#333333] dark:text-slate-200">Moneda Deseada:</span>
                <div className="inline-flex rounded-lg bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleCurrencyChange('USD')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      targetCurrency === 'USD'
                        ? 'bg-[#00a2e8] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCurrencyChange('UYU')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      targetCurrency === 'UYU'
                        ? 'bg-[#00a2e8] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    UYU ($)
                  </button>
                </div>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                Cotización aplicada: 1 USD = ${exchangeRate.toFixed(2)} UYU ({exchangeRateSource})
              </span>
            </div>

            {/* Categoría */}
            <div>
              <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                Categoría Analizada
              </label>
              <CreatableCategorySelect
                value={selectedCategory}
                onChange={setSelectedCategory}
                categories={categories}
                onCategoryCreated={handleCategoryCreated}
              />
            </div>

            {/* Precio Propuesto */}
            <div>
              <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                Precio Propuesto de Venta ({targetCurrency === 'USD' ? '$ USD' : 'UYU $'})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-mono text-[11px]">
                  {targetCurrency === 'USD' ? '$' : 'UYU'}
                </span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(Number(e.target.value))}
                  className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-3 py-2 font-mono font-bold text-xs text-[#00a2e8] focus:outline-none focus:border-[#00a2e8]"
                />
              </div>
            </div>

            {/* País */}
            <div>
              <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1 flex items-center space-x-1">
                <Globe size={13} className="text-[#00a2e8]" />
                <span>País de Búsqueda</span>
              </label>
              <select
                value={country}
                onChange={(e) => {
                  const newC = e.target.value;
                  setCountry(newC);
                  setDepartment('Todo el país');
                }}
                className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
              >
                <option value="Uruguay">Uruguay (.com.uy - MLU)</option>
                <option value="Argentina">Argentina (.com.ar - MLA)</option>
                <option value="Chile">Chile (.cl - MLC)</option>
                <option value="Brasil">Brasil (.com.br - MLB)</option>
              </select>
            </div>

            {/* Departamento / Región */}
            <div>
              <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1 flex items-center space-x-1">
                <MapPin size={13} className="text-[#00a2e8]" />
                <span>Departamento / Región</span>
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
              >
                {(COUNTRY_DEPARTMENTS[country] || ['Todo el país']).map((dep) => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
              </select>
            </div>

            {/* Plataforma */}
            <div>
              <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1 flex items-center space-x-1">
                <Store size={13} className="text-[#00a2e8]" />
                <span>Plataforma</span>
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
              >
                <option value="google_serper">Google Search (Serper.dev - Directo)</option>
                <option value="web_ddgs">Búsqueda Web Gratuita (DuckDuckGo)</option>
                <option value="mercadolibre">Mercado Libre (API Oficial)</option>
                <option value="hybrid">Ambos / Híbrido</option>
              </select>
            </div>

            {/* Query de Búsqueda */}
            <div>
              <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                Query de Búsqueda
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Términos clave de rastreo"
                className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSearchCompetitors}
              disabled={isSearching || !productName.trim()}
              className="py-2.5 px-6 bg-[#00a2e8] hover:bg-[#008ecb] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center space-x-2 disabled:opacity-50"
            >
              <RotateCw size={14} className={isSearching ? 'animate-spin' : ''} />
              <span>
                {isSearching
                  ? 'Rastreando tiendas uruguayas en profundidad (procesando en paralelo)...'
                  : 'Buscar Competidores en el Mercado'}
              </span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FASE 2: TABLA DE CURADURÍA, SELECCIÓN POR CHECKBOX Y EXPORTACIÓN          */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="space-y-5 animate-in fade-in">
          {/* Barra de Acciones de la Tabla */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[#333333] dark:text-slate-200 rounded-lg font-semibold transition-colors"
              >
                {selectedIds.size === competitors.length ? <CheckSquare size={14} className="text-[#00a2e8]" /> : <Square size={14} />}
                <span>
                  {selectedIds.size === competitors.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                </span>
              </button>

              <span className="text-slate-500 dark:text-slate-400">
                Seleccionados: <strong className="text-[#00a2e8]">{selectedIds.size}</strong> de {competitors.length} empresas
              </span>

              {/* Selector de Moneda en Fase 2 */}
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Moneda:</span>
                <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => handleCurrencyChange('USD')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                      targetCurrency === 'USD'
                        ? 'bg-[#00a2e8] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCurrencyChange('UYU')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                      targetCurrency === 'UYU'
                        ? 'bg-[#00a2e8] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    UYU ($)
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 italic hidden sm:inline">
                  ({exchangeRateSource}: 1 USD = ${exchangeRate.toFixed(2)} UYU)
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-lg font-semibold hover:bg-emerald-100 transition-colors"
                title="Descargar muestra en CSV"
              >
                <Download size={13} />
                <span>Descargar Muestra en CSV</span>
              </button>

              <button
                onClick={() => setCurrentStep(1)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200"
              >
                <ArrowLeft size={13} />
                <span>Modificar Búsqueda</span>
              </button>
            </div>
          </div>

          {/* Tabla Densa Bitrix24 con Scroll y Cabecera Sticky */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#f5f7f8] dark:bg-slate-800 text-[#535c69] dark:text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-700 z-10 shadow-xs">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === competitors.length && competitors.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded accent-[#00a2e8]"
                      />
                    </th>
                    <th className="py-3 px-3">Vendedor / Tienda</th>
                    <th className="py-3 px-3">Título de la Publicación</th>
                    <th className="py-3 px-3">Ubicación</th>
                    <th className="py-3 px-3 text-right">Precio Original</th>
                    <th className="py-3 px-3 text-right">Precio Normalizado ({targetCurrency})</th>
                    <th className="py-3 px-3 text-center">Enlace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {competitors.map((item) => {
                    const isSelected = selectedIds.has(item.id);
                    const normPrice = getNormalizedPrice(item);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => toggleSelect(item.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-sky-50/50 dark:bg-sky-950/20 hover:bg-sky-50 dark:hover:bg-sky-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-70'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                            className="rounded accent-[#00a2e8]"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100">
                          <div className="flex items-center space-x-1.5">
                            <Store size={12} className="text-[#00a2e8] shrink-0" />
                            <span className="truncate max-w-[140px]">{item.vendedor}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="line-clamp-1 max-w-[320px] font-medium" title={item.titulo}>
                            {item.titulo}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                          <span className="truncate max-w-[120px] block">{item.ubicacion || country}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {item.precio_original !== undefined
                            ? `${item.moneda} ${Number(item.precio_original).toLocaleString()}`
                            : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-sm text-[#00a2e8]">
                          {normPrice.symbol} {normPrice.amount.toLocaleString(undefined, { minimumFractionDigits: targetCurrency === 'USD' ? 2 : 0, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-[#00a2e8] inline-flex items-center p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Abrir publicación en nueva pestaña"
                            >
                              <ExternalLink size={13} />
                            </a>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel de Supuestos Financieros Complementarios & Botón Disparador */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-[#333333] dark:text-slate-100 uppercase tracking-wider flex items-center space-x-1.5">
                <DollarSign size={14} className="text-[#00a2e8]" />
                <span>Parámetros Financieros &amp; Estructura de Costos</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowBreakdownModal(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] hover:bg-sky-100 dark:hover:bg-sky-900/60 rounded-xl font-semibold text-xs transition-colors border border-sky-200 dark:border-sky-800"
              >
                <Sliders size={13} />
                <span>⚙️ Desglosar Inversión &amp; Costos Fijos</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                  Costo Directo Unitario ({targetCurrency === 'USD' ? '$ USD' : 'UYU $'})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={proposedCost}
                  onChange={(e) => setProposedCost(Number(e.target.value))}
                  className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                  Inversión Inicial CAPEX ({targetCurrency === 'USD' ? '$ USD' : 'UYU $'})
                </label>
                <input
                  type="number"
                  min="0"
                  value={initialInvestment}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setInitialInvestment(val);
                    setCapexBreakdown((prev) => ({
                      ...prev,
                      otros_capex: Math.max(0, val - (prev.maquinaria_equipos + prev.adecuacion_local + prev.marketing_lanzamiento + prev.habilitaciones_marcas)),
                    }));
                  }}
                  className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                  Costo Fijo Mensual OPEX ({targetCurrency === 'USD' ? '$ USD' : 'UYU $'})
                </label>
                <input
                  type="number"
                  min="0"
                  value={monthlyOpex}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMonthlyOpex(val);
                    setOpexBreakdown((prev) => ({
                      ...prev,
                      otros_opex: Math.max(0, val - (prev.sueldos_personal + prev.alquiler_deposito + prev.publicidad_mensual + prev.seguros_servicios)),
                    }));
                  }}
                  className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#535c69] dark:text-slate-300 mb-1">
                  Demanda Mensual Estimada (Unidades)
                </label>
                <input
                  type="number"
                  min="1"
                  value={expectedDemand}
                  onChange={(e) => setExpectedDemand(Number(e.target.value))}
                  className="w-full bg-[#f5f7f8] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-xs text-[#333333] dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
                />
              </div>
            </div>

            {/* AILoader si está procesando la inferencia */}
            {isEvaluating && (
              <AILoader
                isLoading={isEvaluating}
                title="Analizando Muestra con IA & Calculando Sensibilidades"
                subtitle="Inferencia sobre competidores elegidos y estimación de Break-Even / Payback."
                engineMode={engineMode}
              />
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500">
                Muestra activa: <strong>{selectedIds.size} empresas competidoras</strong> tildadas.
              </span>

              <button
                onClick={handleEvaluateSelection}
                disabled={isEvaluating || selectedIds.size === 0}
                className="py-2.5 px-6 bg-[#00a2e8] hover:bg-[#008ecb] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center space-x-2 disabled:opacity-50"
              >
                <BrainCircuit size={15} />
                <span>Analizar Selección con IA y Generar Business Case</span>
              </button>
            </div>
          </div>

          {/* Modal Interactivo de 2 Columnas: CAPEX vs OPEX */}
          {showBreakdownModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] rounded-xl">
                      <Sliders size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        Desglose Financiero: CAPEX Inicial vs OPEX Mensual
                      </h3>
                      <p className="text-xs text-slate-500">
                        Valores en {targetCurrency === 'USD' ? 'Dólares ($ USD)' : 'Pesos Uruguayos (UYU $)'} sincronizados en tiempo real.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowBreakdownModal(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  {/* Columna Izquierda: CAPEX */}
                  <div className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <span className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Inversión Inicial (CAPEX)
                      </span>
                      <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                        Total: {targetCurrency === 'USD' ? '$' : 'UYU $'}{initialInvestment.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                          Maquinaria / Equipos / Herramientas
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={capexBreakdown.maquinaria_equipos}
                          onChange={(e) => updateCapexField('maquinaria_equipos', Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                          Adecuación de Local / Matricería
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={capexBreakdown.adecuacion_local}
                          onChange={(e) => updateCapexField('adecuacion_local', Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                          Marketing de Lanzamiento &amp; Branding
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={capexBreakdown.marketing_lanzamiento}
                          onChange={(e) => updateCapexField('marketing_lanzamiento', Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                          Habilitaciones, Licencias &amp; Marcas
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={capexBreakdown.habilitaciones_marcas}
                          onChange={(e) => updateCapexField('habilitaciones_marcas', Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                          Otros Gastos de Capital Inicial
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={capexBreakdown.otros_capex}
                          onChange={(e) => updateCapexField('otros_capex', Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Columna Derecha: OPEX */}
                  <div className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <span className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Costos Fijos Operativos (OPEX Mensual)
                      </span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        Total: {targetCurrency === 'USD' ? '$' : 'UYU $'}{monthlyOpex.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                          Nómina / Sueldos Prorrateados
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={opexBreakdown.sueldos_personal}
                          onChange={(e) => updateOpexField('sueldos_personal', Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                          Alquiler de Depósito / Local
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={opexBreakdown.alquiler_deposito}
                          onChange={(e) => updateOpexField('alquiler_deposito', Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                          Publicidad Mensual Continua
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={opexBreakdown.publicidad_mensual}
                          onChange={(e) => updateOpexField('publicidad_mensual', Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                          Seguros, Servicios Públicos &amp; Software
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={opexBreakdown.seguros_servicios}
                          onChange={(e) => updateOpexField('seguros_servicios', Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                          Otros Gastos Fijos Operativos
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={opexBreakdown.otros_opex}
                          onChange={(e) => updateOpexField('otros_opex', Number(e.target.value))}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setShowBreakdownModal(false)}
                    className="px-5 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white font-bold rounded-xl text-xs transition-colors"
                  >
                    Confirmar y Sincronizar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* FASE 3: ANÁLISIS CUANTITATIVO E INFERENCIA IA SOBRE MUESTRA ELEGIDA      */}
      {/* ========================================================================= */}
      {currentStep === 3 && evaluation && (
        <div className="space-y-6 animate-in fade-in">
          {/* Tarjetas Métricas Superiores Enriquecidas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Margen */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
              <span className="text-[10px] text-[#535c69] dark:text-slate-400 uppercase font-bold block">
                Margen Contribución
              </span>
              <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {targetCurrency === 'USD' ? '$' : 'UYU $'}{Number(evaluation.unit_contribution_margin).toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400 block">
                Ratio: <strong>{Number(evaluation.proposed_margin_pct).toFixed(1)}%</strong>
              </span>
            </div>

            {/* Flujo Operativo Neto (FON) */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
              <span className="text-[10px] text-[#535c69] dark:text-slate-400 uppercase font-bold block">
                Flujo Operativo Neto
              </span>
              <span className={`text-xl font-bold font-mono ${
                (evaluation.net_operating_cashflow ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {targetCurrency === 'USD' ? '$' : 'UYU $'}{Number(evaluation.net_operating_cashflow ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[11px] text-slate-400 block truncate" title={`OPEX Fijo: ${targetCurrency === 'USD' ? '$' : 'UYU $'}${Number(evaluation.monthly_opex ?? monthlyOpex).toLocaleString()}`}>
                OPEX: {targetCurrency === 'USD' ? '$' : 'UYU $'}{Number(evaluation.monthly_opex ?? monthlyOpex).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mes
              </span>
            </div>

            {/* Rango de Precios Muestra */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
              <span className="text-[10px] text-[#535c69] dark:text-slate-400 uppercase font-bold block">
                Promedio Muestra ({targetCurrency})
              </span>
              <span className="text-xl font-bold font-mono text-[#00a2e8]">
                {targetCurrency === 'USD' ? '$' : 'UYU $'}{Number(evaluation.avg_price).toFixed(2)}
              </span>
              <span className={`text-[11px] font-semibold block ${
                evaluation.price_competitiveness_pct <= 0 ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {evaluation.price_competitiveness_pct > 0 ? '+' : ''}
                {Number(evaluation.price_competitiveness_pct).toFixed(1)}% vs Rivales
              </span>
            </div>

            {/* Break-Even */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
              <span className="text-[10px] text-[#535c69] dark:text-slate-400 uppercase font-bold block">
                Punto de Equilibrio
              </span>
              <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">
                {evaluation.break_even_units !== null && evaluation.break_even_units !== undefined
                  ? `${Number(evaluation.break_even_units).toLocaleString(undefined, { maximumFractionDigits: 1 })} un.`
                  : 'No alcanzable'}
              </span>
              <span className="text-[11px] text-slate-400 block truncate" title={evaluation.break_even_coverage_pct !== null && evaluation.break_even_coverage_pct !== undefined ? `${Number(evaluation.break_even_coverage_pct).toFixed(1)}% de demanda estimada` : 'Margen nulo o deficitario'}>
                {evaluation.break_even_coverage_pct !== null && evaluation.break_even_coverage_pct !== undefined
                  ? `${Number(evaluation.break_even_coverage_pct).toFixed(1)}% de demanda`
                  : 'Margen deficitario'}
              </span>
            </div>

            {/* Payback & Viabilidad */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-1">
              <span className="text-[10px] text-[#535c69] dark:text-slate-400 uppercase font-bold block">
                Payback / Retorno
              </span>
              <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100 line-clamp-1" title={evaluation.payback_status || (evaluation.payback_cycles !== null ? `${Number(evaluation.payback_cycles).toFixed(1)} meses` : 'N/A')}>
                {evaluation.payback_cycles !== null && evaluation.payback_cycles !== undefined
                  ? `${Number(evaluation.payback_cycles).toFixed(1)} meses`
                  : (evaluation.payback_status || 'Sin amortizar')}
              </span>
              <span className={`text-[11px] font-bold uppercase block ${
                evaluation.viability === 'Factible' ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {evaluation.viability} (ROI {Number(evaluation.roi_pct).toFixed(0)}%)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Gráfico Comparativo de Precios */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-[#333333] dark:text-slate-100 flex items-center space-x-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <BarChart2 size={14} className="text-[#00a2e8]" />
                  <span>Posicionamiento de Precios vs Muestra Elegida ({targetCurrency})</span>
                </h4>
                <p className="text-[11px] text-[#535c69] dark:text-slate-400 mt-1">
                  Comparativa de la propuesta de venta frente al rango muestral de los competidores filtrados.
                </p>
              </div>

              <div className="w-full h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 15, right: 10, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={(v) => `${targetCurrency === 'USD' ? '$' : 'UYU '}${v}`}
                    />
                    <Tooltip
                      formatter={(val: any) => [`${targetCurrency === 'USD' ? '$' : 'UYU $'}${Number(val).toFixed(2)}`, 'Precio']}
                    />
                    <ReferenceLine y={Number(evaluation.avg_price)} stroke="#f59e0b" strokeDasharray="3 3" />
                    <Bar dataKey="price" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <span>Rango: <strong>{targetCurrency === 'USD' ? '$' : 'UYU $'}{Number(evaluation.min_price).toFixed(2)} - {targetCurrency === 'USD' ? '$' : 'UYU $'}{Number(evaluation.max_price).toFixed(2)}</strong></span>
                <span className="font-mono text-[#00a2e8] font-bold">Muestra: {selectedIds.size} rivales</span>
              </div>
            </div>

            {/* Dictamen Ejecutivo IA (Markdown Limpio) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] rounded-lg">
                    <Lightbulb size={16} />
                  </span>
                  <div>
                    <h4 className="font-bold text-xs text-[#333333] dark:text-slate-100">
                      Dictamen Ejecutivo de Factibilidad &amp; Pricing
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      Motor: {evaluation.provider} ({evaluation.model || 'qwen2.5:7b'}) | {evaluation.latency_ms} ms
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExportMarkdown}
                    className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-lg text-xs flex items-center space-x-1"
                    title="Exportar Markdown"
                  >
                    <Download size={13} />
                    <span>Exportar MD</span>
                  </button>
                </div>
              </div>

              {/* Renderizado de Markdown sin bloques de código crudos */}
              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-[#f8fafc] dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800 font-sans prose prose-slate dark:prose-invert max-w-none">
                <ReactMarkdown>
                  {sanitizeMarkdown(evaluation.raw_markdown)}
                </ReactMarkdown>
              </div>

              {/* Botones de Navegación Final */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
                >
                  <ArrowLeft size={13} />
                  <span>Modificar Muestra Seleccionada</span>
                </button>

                <button
                  onClick={() => {
                    setEvaluation(null);
                    setCurrentStep(1);
                  }}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-[#00a2e8] hover:bg-[#008ecb] text-white rounded-xl text-xs font-bold transition-colors"
                >
                  <RotateCw size={13} />
                  <span>Evaluar Nuevo Proyecto</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
