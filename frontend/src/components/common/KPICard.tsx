import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type KPIVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'amber';

export interface KPICardProps {
  title: string;
  value: string | number | React.ReactNode;
  secondaryValue?: string | number | React.ReactNode;
  subtitle?: string | React.ReactNode;
  icon?: LucideIcon;
  variant?: KPIVariant;
  trend?: {
    value: string | number;
    positive?: boolean;
    label?: string;
  };
  badge?: {
    text: string;
    variant?: 'success' | 'danger' | 'warning' | 'info';
  };
  onClick?: () => void;
  className?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  secondaryValue,
  subtitle,
  icon: Icon,
  variant = 'default',
  trend,
  badge,
  onClick,
  className = '',
}) => {
  const getVariantStyles = (v: KPIVariant) => {
    switch (v) {
      case 'success':
        return {
          iconColor: 'text-emerald-600 dark:text-emerald-400',
          iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
          valueColor: 'text-emerald-600 dark:text-emerald-400',
          badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300',
        };
      case 'danger':
        return {
          iconColor: 'text-rose-600 dark:text-rose-400',
          iconBg: 'bg-rose-50 dark:bg-rose-950/40',
          valueColor: 'text-rose-600 dark:text-rose-400',
          badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300',
        };
      case 'warning':
      case 'amber':
        return {
          iconColor: 'text-amber-600 dark:text-amber-400',
          iconBg: 'bg-amber-50 dark:bg-amber-950/40',
          valueColor: 'text-amber-600 dark:text-amber-400',
          badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300',
        };
      case 'info':
        return {
          iconColor: 'text-sky-600 dark:text-sky-400',
          iconBg: 'bg-sky-50 dark:bg-sky-950/40',
          valueColor: 'text-sky-600 dark:text-sky-400',
          badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300',
        };
      case 'purple':
        return {
          iconColor: 'text-violet-600 dark:text-violet-400',
          iconBg: 'bg-violet-50 dark:bg-violet-950/40',
          valueColor: 'text-violet-600 dark:text-violet-400',
          badgeClass: 'bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300',
        };
      default:
        return {
          iconColor: 'text-slate-700 dark:text-slate-300',
          iconBg: 'bg-slate-100 dark:bg-slate-800',
          valueColor: 'text-slate-900 dark:text-slate-100',
          badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        };
    }
  };

  const styles = getVariantStyles(variant);

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div>
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {title}
          </span>
          {Icon && (
            <div className={`p-2 rounded-lg ${styles.iconBg} ${styles.iconColor} shrink-0`}>
              <Icon size={16} />
            </div>
          )}
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className={`text-2xl font-bold font-mono tracking-tight ${styles.valueColor}`}>
            {value}
          </span>
          {secondaryValue && (
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
              {secondaryValue}
            </span>
          )}
          {badge && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                badge.variant ? getVariantStyles(badge.variant as KPIVariant).badgeClass : styles.badgeClass
              }`}
            >
              {badge.text}
            </span>
          )}
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          {subtitle && (
            <p className="text-[10px] text-slate-400 truncate max-w-full">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center space-x-1 shrink-0 ml-auto">
              <span
                className={`inline-flex items-center space-x-0.5 font-semibold text-[10px] px-1.5 py-0.5 rounded ${
                  trend.positive === true
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                    : trend.positive === false
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {trend.positive === true && <TrendingUp size={10} className="mr-0.5" />}
                {trend.positive === false && <TrendingDown size={10} className="mr-0.5" />}
                {trend.positive === undefined && <Minus size={10} className="mr-0.5" />}
                {trend.value}
              </span>
              {trend.label && (
                <span className="text-slate-400 text-[10px]">{trend.label}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
