import React from 'react';
import { 
  Building2, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle, 
  User, 
  Layers,
  MessageSquare,
  Flame,
  Sparkles,
  Globe,
  Mail,
  Megaphone,
  QrCode
} from 'lucide-react';
import type { CommercialDeal, DealStage } from '../../types';
import { ProductThumbnail } from '../../components/common/ProductThumbnail';

interface KanbanCardProps {
  deal: CommercialDeal;
  stages: DealStage[];
  onSelectDeal: (deal: CommercialDeal) => void;
  onMoveStage: (dealId: string, newStage: DealStage) => void;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onOpenChat?: (deal: CommercialDeal) => void;
}

export const getOriginBadgeConfig = (canal?: string) => {
  const key = (canal || 'MANUAL').toUpperCase();
  switch (key) {
    case 'GOOGLE_ADS':
      return {
        label: 'Google Ads',
        className: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        icon: Megaphone,
      };
    case 'META_ADS':
      return {
        label: 'Meta / Facebook',
        className: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        icon: Megaphone,
      };
    case 'WHATSAPP':
      return {
        label: 'WhatsApp API',
        className: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        icon: MessageSquare,
      };
    case 'WHATSAPP_QR':
      return {
        label: 'WhatsApp QR',
        className: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        icon: QrCode,
      };
    case 'EMAIL':
      return {
        label: 'Email Corp.',
        className: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        icon: Mail,
      };
    case 'WEB_FORM':
      return {
        label: 'Página Web',
        className: 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
        icon: Globe,
      };
    default:
      return {
        label: 'CRM Directo',
        className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        icon: Building2,
      };
  }
};

export const KanbanCard: React.FC<KanbanCardProps> = ({
  deal,
  stages,
  onSelectDeal,
  onMoveStage,
  onDragStart,
  onOpenChat,
}) => {
  const currentIndex = stages.indexOf(deal.etapa);
  const canMovePrev = currentIndex > 0;
  const canMoveNext = currentIndex < stages.length - 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canMovePrev) {
      onMoveStage(deal.id, stages[currentIndex - 1]);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canMoveNext) {
      onMoveStage(deal.id, stages[currentIndex + 1]);
    }
  };

  const originBadge = getOriginBadgeConfig(deal.canal_origen);
  const OriginIcon = originBadge.icon;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      onClick={() => onSelectDeal(deal)}
      className="group relative p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 hover:border-[#00a2e8]/60 dark:hover:border-[#00a2e8]/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing select-none"
    >
      {/* Fila Superior: Etiqueta de Fuente de Origen + Score IA */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${originBadge.className}`}
          title={deal.utm_campaign ? `Campaña: ${deal.utm_campaign}` : `Origen: ${originBadge.label}`}
        >
          <OriginIcon size={10} />
          <span>{originBadge.label}</span>
        </span>

        <div className="flex items-center gap-1">
          {deal.ai_classification === 'AMIGOS_FAMILIA' && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800"
              title="Contacto Personal: Amigos / Familiares"
            >
              <span>👨‍👩‍👧‍👦 Amigos / Familia</span>
            </span>
          )}
          {deal.ai_classification === 'HOT' && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800"
              title={`Lead Score IA: ${deal.ai_score || 85}/100 (Alta Prioridad)`}
            >
              <Flame size={9} />
              <span>HOT {deal.ai_score ? `${deal.ai_score}` : ''}</span>
            </span>
          )}
          {deal.ai_classification === 'WARM' && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
              title={`Lead Score IA: ${deal.ai_score || 60}/100`}
            >
              <Sparkles size={9} />
              <span>WARM</span>
            </span>
          )}
          {onOpenChat && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChat(deal);
              }}
              title="Abrir Chat Omnicanal con este prospecto"
              className="p-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-[#00a2e8] hover:bg-[#00a2e8] hover:text-white border border-sky-200/70 dark:border-sky-800/70 transition-colors cursor-pointer"
            >
              <MessageSquare size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Cabecera del Deal: Cliente & Micro-acciones */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {deal.logo_url ? (
            <img
              src={deal.logo_url}
              alt={deal.cliente}
              className="w-6 h-6 rounded-md object-contain bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 p-0.5 shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
              <Building2 size={12} />
            </div>
          )}
          <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate" title={deal.cliente}>
            {deal.cliente}
          </span>
        </div>

        {/* Micro-acciones de etapa (Flechas) */}
        <div className="flex items-center space-x-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
          {canMovePrev && (
            <button
              onClick={handlePrev}
              title="Mover a etapa anterior"
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
          )}
          {canMoveNext && (
            <button
              onClick={handleNext}
              title="Avanzar etapa"
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-[#00a2e8] transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Nombre del Proyecto */}
      <div className="mt-1 font-bold text-xs text-slate-900 dark:text-slate-50 line-clamp-1">
        {deal.proyecto_nombre}
      </div>

      {/* Campaña UTM si existe */}
      {deal.utm_campaign && (
        <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 truncate font-mono">
          🎯 {deal.utm_campaign}
        </div>
      )}

      {/* Monto y Moneda */}
      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
          <span className="text-[10px] text-slate-400 font-normal mr-1">{deal.moneda || 'USD'}</span>
          ${Number(deal.monto_total || 0).toLocaleString('es-UY', { maximumFractionDigits: 0 })}
        </div>
        <div className="flex items-center text-[10px] text-slate-400 gap-1">
          <User size={10} />
          <span className="truncate max-w-[80px]">{deal.vendedor || 'General'}</span>
        </div>
      </div>

      {/* Progressive Disclosure: Chips de SKUs con miniaturas */}
      {deal.items && deal.items.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-1.5">
          {deal.items.slice(0, 3).map((item, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-[10px] text-slate-600 dark:text-slate-300"
              title={`${item.producto_nombre || item.sku} (${item.cantidad} un)`}
            >
              <ProductThumbnail src={item.image_url} alt={item.sku} size="xs" />
              <span className="font-mono font-medium">{item.sku}</span>
              <span className="text-slate-400">×{item.cantidad}</span>
            </div>
          ))}
          {deal.items.length > 3 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[9px] font-semibold text-slate-500 dark:text-slate-400">
              <Layers size={10} />
              +{deal.items.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Advertencia de stock si existe */}
      {deal.stock_reservation_warning && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/40 px-2 py-1 rounded-md border border-amber-200/60 dark:border-amber-800/60">
          <AlertTriangle size={12} className="shrink-0" />
          <span className="truncate">{deal.stock_reservation_warning}</span>
        </div>
      )}
    </div>
  );
};

export default KanbanCard;

