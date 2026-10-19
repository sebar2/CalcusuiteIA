import React from 'react';
import { 
  X, 
  FileText, 
  ShoppingCart, 
  AlertTriangle,
  User,
  Clock,
  Edit3,
  Trash2,
  MessageSquare,
  Flame,
  Target
} from 'lucide-react';
import type { CommercialDeal, DealStage } from '../../types';
import { ProductThumbnail } from '../../components/common/ProductThumbnail';
import { CompanyContactCard } from '../../components/common/CompanyContactCard';
import { getOriginBadgeConfig } from './KanbanCard';

interface DealDetailDrawerProps {
  deal: CommercialDeal | null;
  isOpen: boolean;
  onClose: () => void;
  onStageChange: (dealId: string, stage: DealStage) => void;
  onGenerateSalesOrder?: (deal: CommercialDeal) => void;
  onEditDeal?: (deal: CommercialDeal) => void;
  onDeleteDeal?: (dealId: string) => void;
  onOpenChat?: (deal: CommercialDeal) => void;
}

const STAGES_LIST: { key: DealStage; label: string }[] = [
  { key: 'prospeccion', label: 'Prospección' },
  { key: 'cotizacion', label: 'Cotización' },
  { key: 'propuesta_enviada', label: 'Propuesta Enviada' },
  { key: 'negociacion', label: 'Negociación' },
  { key: 'ganada', label: 'Ganada (Cierre)' },
  { key: 'perdida', label: 'Perdida' },
];

export const DealDetailDrawer: React.FC<DealDetailDrawerProps> = ({
  deal,
  isOpen,
  onClose,
  onStageChange,
  onGenerateSalesOrder,
  onEditDeal,
  onDeleteDeal,
  onOpenChat,
}) => {
  if (!isOpen || !deal) return null;

  const originBadge = getOriginBadgeConfig(deal.canal_origen);
  const OriginIcon = originBadge.icon;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl z-10 flex flex-col h-full border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
        {/* Cabecera del Drawer */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-200/60 dark:border-sky-800/60">
                Trato Comercial #{deal.id}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${originBadge.className}`}>
                <OriginIcon size={11} />
                <span>{originBadge.label}</span>
              </span>
              {deal.ai_classification === 'AMIGOS_FAMILIA' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800">
                  <span>👨‍👩‍👧‍👦 Amigos / Familiares (Personal)</span>
                </span>
              ) : deal.ai_classification ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                  <Flame size={10} />
                  <span>IA {deal.ai_classification} ({deal.ai_score || 75}/100)</span>
                </span>
              ) : null}
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 mt-1.5">
              {deal.proyecto_nombre}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span className="flex items-center gap-1">
                <User size={13} /> {deal.vendedor || 'Equipo Comercial'}
              </span>
              {deal.created_at && (
                <span className="flex items-center gap-1">
                  <Clock size={13} /> {new Date(deal.created_at).toLocaleDateString('es-UY')}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Atribución de Marketing & Chat Rápido */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-sky-50/90 to-indigo-50/70 dark:from-sky-950/40 dark:to-indigo-950/30 border border-sky-200/70 dark:border-sky-800/60 flex items-center justify-between gap-3">
            <div className="text-xs space-y-0.5">
              <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Target size={14} className="text-[#00a2e8]" />
                <span>Fuente de Captación: {originBadge.label}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {deal.utm_campaign ? `Campaña: ${deal.utm_campaign}` : 'Captación directa en Pipeline'}
                {deal.costo_adquisicion_estimado ? ` · CAC Est.: USD $${Number(deal.costo_adquisicion_estimado).toFixed(2)}` : ''}
              </div>
            </div>
            {onOpenChat && (
              <button
                type="button"
                onClick={() => onOpenChat(deal)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00a2e8] hover:bg-[#008ecb] text-white text-xs font-bold shadow-xs transition-all shrink-0 cursor-pointer"
              >
                <MessageSquare size={14} />
                <span>Chatear</span>
              </button>
            )}
          </div>

          {/* Ficha de Empresa / Contacto */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Ficha del Cliente & Empresa
            </h4>
            <CompanyContactCard
              variant="full"
              company={{
                nombre: deal.cliente,
                rut: deal.rut,
                logo_url: deal.logo_url,
                email: deal.email,
                phone: deal.phone,
                address: deal.address,
              }}
            />
          </div>

          {/* Selector de Etapa Comercial */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Etapa en el Pipeline
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STAGES_LIST.map((st) => (
                <button
                  key={st.key}
                  onClick={() => onStageChange(deal.id, st.key)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold text-left border transition-all ${
                    deal.etapa === st.key
                      ? 'bg-[#00a2e8] text-white border-[#00a2e8] shadow-xs ring-2 ring-[#00a2e8]/30'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Alerta de Stock si existe */}
          {deal.stock_reservation_warning && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex items-start gap-2.5 text-xs">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <strong className="font-bold">Advertencia de Disponibilidad:</strong>
                <p className="mt-0.5 leading-relaxed">{deal.stock_reservation_warning}</p>
              </div>
            </div>
          )}

          {/* Lista de SKUs / Productos Cotizados */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Productos Cotizados ({deal.items?.length || 0})
              </h4>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Total: {deal.moneda || 'USD'} ${Number(deal.monto_total || 0).toLocaleString('es-UY', { maximumFractionDigits: 0 })}
              </span>
            </div>

            <div className="space-y-2">
              {deal.items && deal.items.length > 0 ? (
                deal.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ProductThumbnail src={item.image_url} alt={item.sku} size="sm" />
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                          {item.sku}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {item.producto_nombre || 'Producto de catálogo'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.cantidad} un.
                      </div>
                      <div className="text-[11px] text-slate-400">
                        ${Number(item.precio_unitario || 0).toFixed(2)} c/u
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  No hay productos registrados en este trato.
                </div>
              )}
            </div>
          </div>

          {/* Observaciones */}
          {deal.observaciones && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold block text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                <FileText size={13} /> Notas Comerciales:
              </span>
              <p className="whitespace-pre-line leading-relaxed">{deal.observaciones}</p>
            </div>
          )}
        </div>

        {/* Footer con Acciones */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {onEditDeal && (
              <button
                onClick={() => onEditDeal(deal)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Editar Trato"
              >
                <Edit3 size={14} />
                <span>Editar</span>
              </button>
            )}
            {onDeleteDeal && (
              <button
                onClick={() => onDeleteDeal(deal.id)}
                className="p-2 rounded-xl border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 text-xs hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Eliminar Trato"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onGenerateSalesOrder && (
              <button
                onClick={() => onGenerateSalesOrder(deal)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00a2e8] hover:bg-[#008ecb] text-white text-xs font-bold shadow-sm transition-all"
              >
                <ShoppingCart size={14} />
                <span>Emitir OV</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DealDetailDrawer;
