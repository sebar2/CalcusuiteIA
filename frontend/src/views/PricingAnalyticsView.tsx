import { useState, useEffect } from 'react';
import { 
  Sliders, 
  CheckCircle2 
} from 'lucide-react';
import { WaterfallChart } from '../components/pricing/WaterfallChart';
import type { MarginSummaryItem, DiscountSimulationResponse } from '../types';
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
