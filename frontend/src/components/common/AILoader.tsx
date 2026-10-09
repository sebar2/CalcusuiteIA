import React, { useState, useEffect } from 'react';
import { Cpu, Clock, Sparkles } from 'lucide-react';

interface AILoaderProps {
  isLoading: boolean;
  title?: string;
  subtitle?: string;
  engineMode?: string;
}

export const AILoader: React.FC<AILoaderProps> = ({
  isLoading,
  title = 'Procesando con Inteligencia Artificial',
  subtitle,
  engineMode = 'auto',
}) => {
  const [seconds, setSeconds] = useState<number>(0);

  useEffect(() => {
    let interval: any = null;
    if (isLoading) {
      setSeconds(0);
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  // Mensajes dinámicos rotativos basados en el cronómetro
  const getPhaseMessage = () => {
    if (seconds <= 5) {
      return 'Recopilando datos y consolidando métricas de mercado...';
    } else if (seconds <= 15) {
      return 'Consultando modelo local Qwen 2.5:7b y analizando dispersión de competidores...';
    } else {
      return 'Calculando sensibilidades cuantitativas y redactando dictamen ejecutivo en tu equipo...';
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-sky-200/80 dark:border-sky-900 shadow-md flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-200">
      {/* Spinner con Pulso Cyan */}
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-[#eef2f4] dark:border-slate-800 border-t-[#00a2e8] animate-spin" />
        <div className="absolute w-10 h-10 rounded-full bg-[#00a2e8]/10 dark:bg-[#00a2e8]/20 flex items-center justify-center animate-pulse">
          <Cpu className="text-[#00a2e8]" size={20} />
        </div>
      </div>

      <div className="space-y-1 max-w-md">
        <h4 className="text-sm font-bold text-[#333333] dark:text-slate-100 flex items-center justify-center space-x-1.5">
          <Sparkles size={16} className="text-[#00a2e8]" />
          <span>{title}</span>
        </h4>
        <p className="text-xs text-[#00a2e8] font-medium transition-all">
          {getPhaseMessage()}
        </p>
        {subtitle && (
          <p className="text-[11px] text-[#535c69] dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>

      {/* Cronómetro Activo en Tiempo Real */}
      <div className="flex items-center space-x-3 bg-[#eef2f4] dark:bg-slate-800/80 px-3.5 py-1.5 rounded-full border border-slate-200/60 dark:border-slate-700 text-xs">
        <Clock size={13} className="text-[#00a2e8]" />
        <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
          Tiempo transcurrido: <strong className="text-[#00a2e8]">{seconds}s</strong>
        </span>
        {engineMode === 'force_llm' && (
          <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md font-semibold">
            Modo Inferencia Profunda
          </span>
        )}
      </div>
    </div>
  );
};
