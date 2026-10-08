import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

export interface WaterfallStep {
  name: string;
  subtotal: number;      // El valor flotante base invisible
  amount: number;        // La altura de la barra visible
  displayValue: number;  // El valor real financiero (positivo o negativo)
  type: 'base' | 'deduction' | 'subtotal' | 'final';
  fill: string;
  tooltipDesc: string;
}

interface WaterfallChartProps {
  basePrice: number;
  discountAmount: number;
  effectivePrice: number;
  directCost: number;
  channelAndFreight: number;
  netContribution: number;
}

export const WaterfallChart: React.FC<WaterfallChartProps> = ({
  basePrice,
  discountAmount,
  effectivePrice,
  directCost,
  channelAndFreight,
  netContribution,
}) => {
  // Construcción de los 6 escalones con base flotante (floating bar technique)
  const steps: WaterfallStep[] = [
    {
      name: '1. Precio Base',
      subtotal: 0,
      amount: Math.max(0, basePrice),
      displayValue: basePrice,
      type: 'base',
      fill: '#00a2e8',
      tooltipDesc: 'Precio de lista base sin descuentos',
    },
    {
      name: '2. Descuento',
      subtotal: Math.max(0, effectivePrice),
      amount: Math.max(0, discountAmount),
      displayValue: -discountAmount,
      type: 'deduction',
      fill: '#e74c3c',
      tooltipDesc: 'Descuento promocional aplicado',
    },
    {
      name: '3. Precio Neto',
      subtotal: 0,
      amount: Math.max(0, effectivePrice),
      displayValue: effectivePrice,
      type: 'subtotal',
      fill: '#2fc6f6',
      tooltipDesc: 'Precio neto efectivamente facturado al cliente',
    },
    {
      name: '4. Costo CMV',
      subtotal: Math.max(0, effectivePrice - directCost),
      amount: Math.max(0, directCost),
      displayValue: -directCost,
      type: 'deduction',
      fill: '#64748b',
      tooltipDesc: 'Costo directo de adquisición / reposición',
    },
    {
      name: '5. Canal & Flete',
      subtotal: Math.max(0, netContribution > 0 ? netContribution : 0),
      amount: Math.max(0, channelAndFreight),
      displayValue: -channelAndFreight,
      type: 'deduction',
      fill: '#f39c12',
      tooltipDesc: 'Comisión del canal de venta y flete de última milla',
    },
    {
      name: '6. Contrib. Neta',
      subtotal: netContribution < 0 ? netContribution : 0,
      amount: Math.abs(netContribution),
      displayValue: netContribution,
      type: 'final',
      fill: netContribution >= 0 ? '#2ecc71' : '#e74c3c',
      tooltipDesc: 'Margen de contribución neto final retenido',
    },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: WaterfallStep = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-lg text-xs space-y-1">
          <p className="font-bold text-[#333333] dark:text-slate-100">{data.name}</p>
          <p className="text-slate-500 dark:text-slate-400 text-[11px]">{data.tooltipDesc}</p>
          <p className={`font-mono font-bold text-sm ${data.displayValue >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {data.displayValue >= 0 ? '+' : ''}${data.displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={steps}
          margin={{ top: 20, right: 15, left: -5, bottom: 30 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#64748b' }}
            angle={-15}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Barra flotante invisible de soporte */}
          <Bar dataKey="subtotal" stackId="waterfall" fill="transparent" isAnimationActive={false} />
          {/* Barra visible con color escalonado */}
          <Bar dataKey="amount" stackId="waterfall" radius={[4, 4, 0, 0]}>
            {steps.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
