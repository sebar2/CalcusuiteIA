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
        return 'bg-red-50 dark:bg-red-950/40 text-[#e74c3c] dark:text-rose-400 border-red-200 dark:border-rose-900/50';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-950/40 text-[#f39c12] dark:text-amber-400 border-amber-200 dark:border-amber-900/50';
      case 'success':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-[#2ecc71] dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50';
      default:
        return 'bg-sky-50 dark:bg-sky-950/40 text-[#00a2e8] dark:text-sky-400 border-sky-200 dark:border-sky-900/50';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
      {/* Top Header Card */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-semibold text-[#535c69] dark:text-slate-400 tracking-wide uppercase">
          {title}
        </span>
        {Icon && (
          <div className={`p-2 rounded-lg ${iconBg} dark:bg-slate-800/80 ${iconColor} shrink-0`}>
            <Icon size={18} />
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="my-1 flex items-baseline space-x-2">
        <span className="text-2xl font-bold tracking-tight text-[#333333] dark:text-slate-100">
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
      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
        {trend && (
          <div className="flex items-center space-x-1">
            <span
              className={`inline-flex items-center space-x-0.5 font-semibold text-[11px] px-1.5 py-0.5 rounded ${
                trend.positive === true
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-[#2ecc71] dark:text-emerald-400'
                  : trend.positive === false
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-[#e74c3c] dark:text-rose-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {trend.positive === true && <TrendingUp size={11} className="mr-0.5" />}
              {trend.positive === false && <TrendingDown size={11} className="mr-0.5" />}
              {trend.positive === undefined && <Minus size={11} className="mr-0.5" />}
              {trend.value}
            </span>
            {trend.label && (
              <span className="text-slate-400 dark:text-slate-500 text-[11px]">{trend.label}</span>
            )}
          </div>
        )}
        {subtitle && !trend && (
          <span className="text-slate-400 dark:text-slate-500 text-[11px]">{subtitle}</span>
        )}
      </div>
    </div>
  );
};
