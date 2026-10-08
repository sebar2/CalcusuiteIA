/**
 * Utilidades de formateo numérico y financiero blindadas contra nulos,
 * cadenas no numéricas, undefined y desbordes.
 */

export const safeNumber = (val: unknown, defaultVal: number = 0): number => {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const parsed = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(parsed) ? defaultVal : parsed;
};

export const safeToFixed = (val: unknown, decimals: number = 2): string => {
  if (val === null || val === undefined) return (0).toFixed(decimals);
  const num = safeNumber(val, 0);
  return num.toFixed(decimals);
};

export const formatCurrency = (val: unknown, currency: string = 'UYU'): string => {
  const num = safeNumber(val, 0);
  const isNegative = num < 0;
  const absVal = Math.abs(num).toLocaleString('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return isNegative ? `-${currency} $ ${absVal}` : `${currency} $ ${absVal}`;
};

export const formatPercent = (val: unknown, decimals: number = 1): string => {
  const num = safeNumber(val, 0);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
};
