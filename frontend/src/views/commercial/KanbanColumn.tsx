import React, { useState } from 'react';
import type { CommercialDeal, DealStage } from '../../types';
import { KanbanCard } from './KanbanCard';

interface StageConfig {
  key: DealStage;
  label: string;
  color: string;
  borderClass: string;
  dotColor: string;
}

interface KanbanColumnProps {
  config: StageConfig;
  deals: CommercialDeal[];
  allStages: DealStage[];
  onSelectDeal: (deal: CommercialDeal) => void;
  onMoveStage: (dealId: string, newStage: DealStage) => void;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onDropDeal: (targetStage: DealStage) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  config,
  deals,
  allStages,
  onSelectDeal,
  onMoveStage,
  onDragStart,
  onDropDeal,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const totalAmount = deals.reduce((sum, d) => sum + (Number(d.monto_total) || 0), 0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDropDeal(config.key);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col rounded-2xl bg-slate-50/80 dark:bg-slate-900/40 border transition-all duration-200 min-w-[280px] max-w-[340px] flex-1 ${
        isDragOver
          ? 'border-[#00a2e8] ring-2 ring-[#00a2e8]/40 bg-sky-50/30 dark:bg-sky-950/20'
          : config.borderClass
      }`}
    >
      {/* Cabecera de la Columna */}
      <div className="p-3 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`} />
            <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 tracking-tight">
              {config.label}
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
            {deals.length}
          </span>
        </div>

        <div className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          US$ {totalAmount.toLocaleString('es-UY', { maximumFractionDigits: 0 })}
        </div>
      </div>

      {/* Contenedor de Tarjetas */}
      <div className="p-2 flex-1 space-y-2.5 overflow-y-auto max-h-[calc(100vh-290px)] min-h-[160px]">
        {deals.length === 0 ? (
          <div className="h-28 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-600 text-[11px] font-medium">
            Sin tratos en etapa
          </div>
        ) : (
          deals.map((deal) => (
            <KanbanCard
              key={deal.id}
              deal={deal}
              stages={allStages}
              onSelectDeal={onSelectDeal}
              onMoveStage={onMoveStage}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
