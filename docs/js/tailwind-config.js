/**
 * ==========================================================================
 * CALCU SUITE 2026 - CONFIGURACIÓN CENTRALIZADA DE TAILWIND CSS (CDN)
 * Arquitectura desacoplada: cero scripts inline en HTML (ISO 27001 / OWASP ASVS)
 * ==========================================================================
 */

// 1. Suprimir advertencias de producción de Tailwind CDN
(function () {
  const originalWarn = console.warn;
  console.warn = function (...args) {
    if (args[0] && String(args[0]).includes('cdn.tailwindcss.com')) return;
    return originalWarn.apply(console, args);
  };
})();

// 2. Definición global del objeto tailwind.config antes de la carga del motor
window.tailwind = window.tailwind || {};
window.tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#0a0f1d',
        },
      },
    },
  },
};
