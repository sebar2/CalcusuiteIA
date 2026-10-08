import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string | number;
    positive?: boolean; // true = verde, false = rojo, undefined = neutro
    label?: string;
  };
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  badge?: {
    text: string;
    variant: 'danger' | 'warning' | 'success' | 'info';
  };
}

export const MetricCard = ({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  iconColor = 'text-[#00a2e8]',
  iconBg = 'bg-sky-50',
  badge,
}: MetricCardProps) => {
  const getBadgeStyle = (variant: string) => {
    switch (variant) {
      case 'danger':
        return 'bg-red-50 text-[#e74c3c] border-red-200';
      case 'warning':
        return 'bg-amber-50 text-[#f39c12] border-amber-200';
      case 'success':
        return 'bg-emerald-50 text-[#2ecc71] border-emerald-200';
      default:
        return 'bg-sky-50 text-[#00a2e8] border-sky-200';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
      {/* Top Header Card */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-semibold text-[#535c69] tracking-wide uppercase">
          {title}
        </span>
        {Icon && (
          <div className={`p-2 rounded-lg ${iconBg} ${iconColor} shrink-0`}>
            <Icon size={18} />
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="my-1 flex items-baseline space-x-2">
        <span className="text-2xl font-bold tracking-tight text-[#333333]">
          {value}
        </span>
        {badge && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeStyle(
              badge.variant
            )}`}
          >
            {badge.text}
          </span>
        )}
      </div>

      {/* Footer / Trend Subtitle */}
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
        {trend && (
          <div className="flex items-center space-x-1">
            <span
              className={`inline-flex items-center space-x-0.5 font-semibold text-[11px] px-1.5 py-0.5 rounded ${
                trend.positive === true
                  ? 'bg-emerald-50 text-[#2ecc71]'
                  : trend.positive === false
                  ? 'bg-rose-50 text-[#e74c3c]'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {trend.positive === true && <TrendingUp size={11} className="mr-0.5" />}
              {trend.positive === false && <TrendingDown size={11} className="mr-0.5" />}
              {trend.positive === undefined && <Minus size={11} className="mr-0.5" />}
              {trend.value}
            </span>
            {trend.label && (
              <span className="text-slate-400 text-[11px]">{trend.label}</span>
            )}
          </div>
        )}
        {subtitle && !trend && (
          <span className="text-slate-400 text-[11px]">{subtitle}</span>
        )}
      </div>
    </div>
  );
};
