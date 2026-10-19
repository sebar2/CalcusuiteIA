import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Bot,
  Sparkles,
  Flame,
  Search,
  RefreshCw,
  Megaphone,
  Mail,
  Globe,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Plug,
  User,
  Phone,
  Target,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { apiService, getStoredUser } from '../services/api';
import type {
  OmnichannelConversationSummary,
  OmnichannelMessageItem,
  AIChatSuggestionResponse,
  DealStage,
} from '../types';
import { getOriginBadgeConfig } from './commercial/KanbanCard';

interface OmnichannelChatViewProps {
  initialDealId?: string | null;
  onNavigateToIntegrations?: () => void;
  onNavigateToCRM?: () => void;
}

const CHANNEL_OPTIONS = [
  { key: 'WHATSAPP', label: 'WhatsApp Business API' },
  { key: 'WHATSAPP_QR', label: 'WhatsApp Directo (QR)' },
  { key: 'EMAIL', label: 'Email Corporativo (SMTP)' },
  { key: 'META_ADS', label: 'Meta / Messenger' },
  { key: 'GOOGLE_ADS', label: 'Google Ads Lead' },
  { key: 'WEB_FORM', label: 'Chat / Webhook Web' },
];

const STAGES_LABELS: { key: DealStage; label: string }[] = [
  { key: 'prospeccion', label: '1. Prospección' },
  { key: 'cotizacion', label: '2. En Cotización' },
  { key: 'propuesta_enviada', label: '3. Propuesta Enviada' },
  { key: 'negociacion', label: '4. Negociación' },
  { key: 'ganada', label: '5. Ganada (Cierre)' },
  { key: 'perdida', label: '6. Perdida' },
];

export const OmnichannelChatView: React.FC<OmnichannelChatViewProps> = ({
  initialDealId,
  onNavigateToIntegrations,
  onNavigateToCRM,
}) => {
  const [conversations, setConversations] = useState<OmnichannelConversationSummary[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(initialDealId || null);
  const [messages, setMessages] = useState<OmnichannelMessageItem[]>([]);
  const [isLoadingConv, setIsLoadingConv] = useState<boolean>(true);
  const [isLoadingMsgs, setIsLoadingMsgs] = useState<boolean>(false);

  // Filtros en bandeja izquierda
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [originFilter, setOriginFilter] = useState<string>('ALL');

  // Redacción de mensaje
  const [replyChannel, setReplyChannel] = useState<string>('WHATSAPP');
  const [messageText, setMessageText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [deliveryFeedback, setDeliveryFeedback] = useState<{
    status: string;
    note: string;
  } | null>(null);

  // Agente Copiloto IA Gratuito (Ollama + Stock/Catálogo)
  const [aiSuggestion, setAiSuggestion] = useState<AIChatSuggestionResponse | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [selectedTone, setSelectedTone] = useState<string>('consultivo_b2b');

  // Edición rápida de teléfono en la Ficha CRM derecha
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [editablePhone, setEditablePhone] = useState<string>('');
  const [isSavingPhone, setIsSavingPhone] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConversation = conversations.find((c) => c.deal_id === selectedDealId) || null;

  const isDeliveredStatus = (st?: string) =>
    st === 'DELIVERED_WHATSAPP_QR_BRIDGE' ||
    st === 'DELIVERED_API' ||
    st === 'DISPATCHED_VIA_API';

  const loadConversations = async () => {
    setIsLoadingConv(true);
    try {
      const list = await apiService.getOmnichannelConversations();
      setConversations(list);
      if (!selectedDealId && list.length > 0) {
        const target = initialDealId ? list.find((x) => x.deal_id === initialDealId) : list[0];
        if (target) {
          setSelectedDealId(target.deal_id);
          setReplyChannel(
            target.canal_origen && target.canal_origen !== 'MANUAL'
              ? target.canal_origen
              : 'WHATSAPP_QR'
          );
        }
      }
    } catch (err) {
      console.error('Error cargando conversaciones omnicanal:', err);
    } finally {
      setIsLoadingConv(false);
    }
  };

  const loadMessages = async (dealId: string) => {
    setIsLoadingMsgs(true);
    try {
      const data = await apiService.getOmnichannelMessages(dealId);
      setMessages(data);
    } catch (err) {
      console.error('Error cargando mensajes:', err);
    } finally {
      setIsLoadingMsgs(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [initialDealId]);

  useEffect(() => {
    if (selectedDealId) {
      loadMessages(selectedDealId);
      setAiSuggestion(null);
      setIsEditingPhone(false);
      const conv = conversations.find((c) => c.deal_id === selectedDealId);
      if (conv) {
        setEditablePhone(conv.phone || '');
        if (conv.canal_origen && conv.canal_origen !== 'MANUAL') {
          setReplyChannel(conv.canal_origen);
        }
      }
    }
  }, [selectedDealId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Conexión WebSocket en tiempo real
  useEffect(() => {
    const user = getStoredUser();
    const tenantId = user?.tenant_id || 'tenant_default';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_API_BASE_URL
      ? import.meta.env.VITE_API_BASE_URL.replace(/^https?:\/\//, '')
      : `${window.location.hostname}:8000`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`${wsProtocol}//${wsHost}/api/v1/omnichannel/ws?tenant_id=${tenantId}`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'NEW_MESSAGE') {
            loadConversations();
            if (data.deal_id === selectedDealId) {
              loadMessages(data.deal_id);
            }
          }
        } catch {
          // ignore malformed event
        }
      };
    } catch {
      // Fallback silencioso si WS no está disponible
    }
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [selectedDealId]);

  const handleSendMessage = async (e?: React.FormEvent, overrideText?: string, aiFlag = false) => {
    if (e) e.preventDefault();
    const bodyToSend = (overrideText !== undefined ? overrideText : messageText).trim();
    if (!selectedDealId || !bodyToSend) return;

    setIsSending(true);
    try {
      const res = await apiService.sendOmnichannelMessage(selectedDealId, {
        channel: replyChannel,
        message_text: bodyToSend,
        is_ai_generated: aiFlag,
      });
      setMessages((prev) => [...prev, res.message]);
      if (overrideText === undefined) {
        setMessageText('');
      }
      setDeliveryFeedback({
        status: res.delivery_status,
        note: res.status_notice || '',
      });
      loadConversations();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'No se pudo enviar el mensaje.');
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateAISuggestions = async () => {
    if (!selectedDealId) return;
    setIsGeneratingAI(true);
    try {
      const res = await apiService.getAIChatSuggestions(selectedDealId, selectedTone);
      setAiSuggestion(res);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error al consultar el Agente Copiloto IA.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleStageUpdate = async (newStage: DealStage) => {
    if (!selectedDealId) return;
    try {
      await apiService.patchDealStage(selectedDealId, newStage);
      setConversations((prev) =>
        prev.map((c) => (c.deal_id === selectedDealId ? { ...c, etapa: newStage } : c))
      );
    } catch {
      alert('No se pudo actualizar la etapa del prospecto.');
    }
  };

  const handleSavePhone = async () => {
    if (!selectedDealId || !editablePhone.trim()) return;
    setIsSavingPhone(true);
    try {
      const res = await apiService.updateOmnichannelContact(selectedDealId, {
        phone: editablePhone.trim(),
      });
      setConversations((prev) =>
        prev.map((c) => (c.deal_id === selectedDealId ? { ...c, phone: res.phone || editablePhone.trim() } : c))
      );
      setIsEditingPhone(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'No se pudo actualizar el teléfono del prospecto.');
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleTogglePersonalCategory = async () => {
    if (!selectedDealId || !selectedConversation) return;
    const isCurrentlyPersonal = selectedConversation.ai_classification === 'AMIGOS_FAMILIA';
    const nextClass = isCurrentlyPersonal ? 'WARM' : 'AMIGOS_FAMILIA';
    try {
      const res = await apiService.updateOmnichannelContact(selectedDealId, {
        ai_classification: nextClass,
        clear_items: !isCurrentlyPersonal,
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.deal_id === selectedDealId
            ? {
                ...c,
                ai_classification: res.ai_classification || nextClass,
                ai_score: nextClass === 'AMIGOS_FAMILIA' ? 0 : 75,
                monto_total: !isCurrentlyPersonal ? 0 : c.monto_total,
              }
            : c
        )
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || 'No se pudo cambiar la categoría del contacto.');
    }
  };

  const handleDeleteConversationDeal = async () => {
    if (!selectedDealId || !selectedConversation) return;
    const ok = window.confirm(
      `¿Eliminar el prospecto "${selectedConversation.cliente}" y su historial de conversación del CRM?`
    );
    if (!ok) return;
    try {
      await apiService.deleteDeal(selectedDealId);
      const remaining = conversations.filter((c) => c.deal_id !== selectedDealId);
      setConversations(remaining);
      setSelectedDealId(remaining.length > 0 ? remaining[0].deal_id : null);
      setMessages([]);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'No se pudo eliminar el prospecto.');
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const matchSearch =
      c.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.proyecto_nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.utm_campaign && c.utm_campaign.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchOrigin =
      originFilter === 'ALL'
        ? true
        : originFilter === 'AMIGOS_FAMILIA'
        ? c.ai_classification === 'AMIGOS_FAMILIA'
        : originFilter === 'COMERCIAL_ONLY'
        ? c.ai_classification !== 'AMIGOS_FAMILIA'
        : (c.canal_origen || 'MANUAL') === originFilter;
    return matchSearch && matchOrigin;
  });

  const getChannelBadgeIcon = (ch: string) => {
    switch (ch) {
      case 'GOOGLE_ADS':
        return <Megaphone size={11} className="text-blue-500" />;
      case 'META_ADS':
        return <Megaphone size={11} className="text-indigo-500" />;
      case 'WHATSAPP':
      case 'WHATSAPP_QR':
        return <MessageSquare size={11} className="text-emerald-500" />;
      case 'EMAIL':
        return <Mail size={11} className="text-purple-500" />;
      default:
        return <Globe size={11} className="text-cyan-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabecera Superior */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-[#00a2e8] flex items-center justify-center text-white shadow-md">
            <MessageSquare size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Centro de Chat Omnicanal &amp; Copiloto Comercial IA
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                <Bot size={11} />
                <span>Agente IA Gratuito (Ollama + Catálogo en Vivo)</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Responda por WhatsApp (API o QR Directo), Email, Meta, Google Ads o Web con respuestas inteligentes basadas en el origen del prospecto y stock real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToIntegrations && (
            <button
              onClick={onNavigateToIntegrations}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Plug size={14} />
              <span>Configurar Canales</span>
            </button>
          )}
          {onNavigateToCRM && (
            <button
              onClick={onNavigateToCRM}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <span>Pipeline CRM</span>
              <ArrowRight size={13} />
            </button>
          )}
          <button
            onClick={loadConversations}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
            title="Refrescar conversaciones"
          >
            <RefreshCw size={15} className={isLoadingConv ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Layout de 3 Paneles */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-210px)] min-h-[580px]">
        {/* PANEL 1: Lista de Prospectos / Conversaciones (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar prospecto o campaña..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#00a2e8]"
              />
            </div>

            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">Todas las fuentes ({conversations.length})</option>
              <option value="COMERCIAL_ONLY">🏢 Solo Comerciales B2B</option>
              <option value="AMIGOS_FAMILIA">👨‍👩‍👧‍👦 Amigos / Familiares (Personal)</option>
              <option value="GOOGLE_ADS">🎯 Google Ads</option>
              <option value="META_ADS">📣 Meta / Facebook</option>
              <option value="WHATSAPP">💬 WhatsApp Business API</option>
              <option value="WHATSAPP_QR">📱 WhatsApp Directo (QR)</option>
              <option value="EMAIL">✉️ Email Corporativo</option>
              <option value="WEB_FORM">🌐 Página Web</option>
              <option value="MANUAL">🏢 CRM Directo</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No se encontraron prospectos para este filtro.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.deal_id === selectedDealId;
                const badge = getOriginBadgeConfig(conv.canal_origen);
                const BadgeIcon = badge.icon;

                return (
                  <button
                    key={conv.deal_id}
                    type="button"
                    onClick={() => setSelectedDealId(conv.deal_id)}
                    className={`w-full text-left p-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-sky-50/90 dark:bg-sky-950/50 border-l-4 border-[#00a2e8]'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${badge.className}`}
                      >
                        <BadgeIcon size={9} />
                        <span>{badge.label}</span>
                      </span>

                      <div className="flex items-center gap-1">
                        {conv.ai_classification === 'AMIGOS_FAMILIA' ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            👨‍👩‍👧‍👦 Personal
                          </span>
                        ) : conv.ai_classification === 'HOT' ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            <Flame size={9} /> HOT
                          </span>
                        ) : null}
                        {conv.messages_count > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {conv.messages_count} msj
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {conv.cliente}
                    </div>
                    <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                      {conv.proyecto_nombre}
                    </div>
                    {conv.last_message_text && (
                      <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1">
                        {conv.last_message_text}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* PANEL 2: Hilo de Chat Central + Copiloto IA (6 cols) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col overflow-hidden">
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <MessageSquare size={36} className="mb-2 opacity-40" />
              <p className="text-sm font-semibold">Seleccione un prospecto para abrir el Chat Omnicanal</p>
            </div>
          ) : (
            <>
              {/* Cabecera de Conversación Activa */}
              <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {selectedConversation.cliente}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      #{selectedConversation.deal_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedConversation.proyecto_nombre} ·{' '}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {selectedConversation.moneda} ${Number(selectedConversation.monto_total || 0).toLocaleString('es-UY')}
                    </strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAISuggestions}
                  disabled={isGeneratingAI}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <Sparkles size={14} className={isGeneratingAI ? 'animate-spin' : ''} />
                  <span>{isGeneratingAI ? 'Analizando Lead + Stock...' : 'Generar Respuesta IA'}</span>
                </button>
              </div>

              {/* Mensajes del Hilo */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40 dark:bg-slate-950/30">
                {isLoadingMsgs ? (
                  <div className="text-center py-8 text-xs text-slate-400">Cargando historial...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400">
                    No hay mensajes registrados aún. Utilice el Copiloto IA para iniciar el contacto comercial.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOutbound = msg.direction === 'OUTBOUND';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs ${
                            isOutbound
                              ? 'bg-[#00a2e8] text-white rounded-br-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-bl-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-85">
                            <span className="font-bold flex items-center gap-1">
                              {getChannelBadgeIcon(msg.channel)}
                              <span>{msg.sender_name}</span>
                              <span className="uppercase">({msg.channel})</span>
                            </span>
                            {msg.is_ai_generated && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-white/20 text-[9px] font-bold">
                                <Bot size={10} /> IA
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-line leading-relaxed">{msg.message_text}</p>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 px-1">
                          <span>
                            {msg.created_at
                              ? new Date(msg.created_at).toLocaleTimeString('es-UY', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                          {isOutbound && (
                            <span
                              className={
                                isDeliveredStatus(msg.delivery_status)
                                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                  : 'text-amber-600 dark:text-amber-400'
                              }
                            >
                              {msg.delivery_status === 'DELIVERED_WHATSAPP_QR_BRIDGE'
                                ? '✓✓ Enviado en vivo a WhatsApp (QR Directo)'
                                : isDeliveredStatus(msg.delivery_status)
                                ? '✓✓ Enviado por Canal Conectado'
                                : '● Guardado en CRM (Canal pendiente de credenciales)'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Panel Desplegable del Agente Copiloto IA Gratuito */}
              {aiSuggestion && (
                <div className="p-3.5 bg-purple-50/90 dark:bg-purple-950/40 border-t border-purple-200 dark:border-purple-800 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-purple-200">
                      <Bot size={15} className="text-purple-600" />
                      <span>
                        Sugerencias del Agente IA ({aiSuggestion.ai_engine}) · Origen: {aiSuggestion.lead_analysis?.canal_origen}
                      </span>
                    </div>
                    <button
                      onClick={() => setAiSuggestion(null)}
                      className="text-xs text-purple-500 hover:text-purple-800 font-bold"
                    >
                      ×
                    </button>
                  </div>
                  <p className="text-[11px] text-purple-700 dark:text-purple-300">
                    Intención detectada: <strong>{aiSuggestion.lead_analysis?.detected_intent}</strong> ·Stock/Catálogo: {aiSuggestion.lead_analysis?.catalog_matched}
                  </p>
                  <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto">
                    {aiSuggestion.suggestions.map((sug, i) => (
                      <div
                        key={sug.id || i}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-200/80 dark:border-purple-800/80 flex items-start justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="inline-block text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">
                            {sug.title} ({sug.channel_recommended})
                          </span>
                          <p className="text-slate-700 dark:text-slate-200 text-[11px] leading-snug">
                            {sug.text}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setMessageText(sug.text)}
                            className="px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-200 text-[10px] font-bold hover:bg-purple-200 cursor-pointer"
                          >
                            Usar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendMessage(undefined, sug.text, true)}
                            className="px-2.5 py-1 rounded-lg bg-[#00a2e8] text-white text-[10px] font-bold hover:bg-[#008ecb] cursor-pointer"
                          >
                            Enviar Ya
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Banner de estado de entrega (Transparencia ISO 27001 No Silent Mocks) */}
              {deliveryFeedback && (
                <div
                  className={`px-3.5 py-2 text-[11px] flex items-center justify-between border-t ${
                    isDeliveredStatus(deliveryFeedback.status)
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {isDeliveredStatus(deliveryFeedback.status) ? (
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                    )}
                    <span>{deliveryFeedback.note}</span>
                  </div>
                  <button
                    onClick={() => setDeliveryFeedback(null)}
                    className="font-bold ml-2 text-xs"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Composer de Respuesta Multicanal */}
              <form
                onSubmit={(e) => handleSendMessage(e)}
                className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Responder vía:</span>
                    <select
                      value={replyChannel}
                      onChange={(e) => setReplyChannel(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-white"
                    >
                      {CHANNEL_OPTIONS.map((ch) => (
                        <option key={ch.key} value={ch.key}>
                          {ch.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">Tono IA:</span>
                    <select
                      value={selectedTone}
                      onChange={(e) => setSelectedTone(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200"
                    >
                      <option value="consultivo_b2b">Consultivo Técnico B2B</option>
                      <option value="cierre_agresivo">Cierre Rápido &amp; Descuento</option>
                      <option value="seguimiento_ejecutivo">Seguimiento Ejecutivo</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <textarea
                    rows={2}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={`Escribir mensaje para ${selectedConversation.cliente} por ${replyChannel}...`}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#00a2e8]"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !messageText.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00a2e8] hover:bg-[#008ecb] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    <Send size={14} />
                    <span>Enviar</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* PANEL 3: Ficha del Prospecto, Atribución ROAS/CAC & Etapa (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 flex flex-col justify-between overflow-y-auto">
          {selectedConversation ? (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Ficha de Atribución &amp; CRM
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
                  <Building2 size={15} className="text-[#00a2e8]" />
                  <span>{selectedConversation.cliente}</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedConversation.proyecto_nombre}
                </p>
              </div>

              {/* Datos de Contacto con Edición Directa de Teléfono */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <Mail size={13} className="text-slate-400 shrink-0" />
                  <span className="truncate">{selectedConversation.email || 'Sin email registrado'}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-200">
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-emerald-500 shrink-0" />
                      <span className="font-mono font-semibold">
                        {selectedConversation.phone || 'Sin teléfono registrado'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditablePhone(selectedConversation.phone || '+598 ');
                        setIsEditingPhone(!isEditingPhone);
                      }}
                      className="text-[10px] font-semibold text-[#00a2e8] hover:underline cursor-pointer"
                    >
                      {isEditingPhone ? 'Cancelar' : 'Editar'}
                    </button>
                  </div>
                  {isEditingPhone && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        value={editablePhone}
                        onChange={(e) => setEditablePhone(e.target.value)}
                        placeholder="+598 95 272 502"
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={isSavingPhone}
                        onClick={handleSavePhone}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                      >
                        {isSavingPhone ? '...' : 'Guardar'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <User size={13} className="text-slate-400 shrink-0" />
                  <span>Origen: {selectedConversation.canal_origen}</span>
                </div>
              </div>

              {/* Tarjeta de Score IA & Categoría Personal / Comercial */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-50/80 to-sky-50/80 dark:from-indigo-950/40 dark:to-sky-950/30 border border-indigo-200/60 dark:border-indigo-800/60 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1">
                    <Zap size={13} className="text-amber-500" /> Categoría / Score
                  </span>
                  {selectedConversation.ai_classification === 'AMIGOS_FAMILIA' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      👨‍👩‍👧‍👦 Amigos / Familia
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                      {selectedConversation.ai_score ?? 75} / 100 ({selectedConversation.ai_classification || 'WARM'})
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Target size={12} className="text-[#00a2e8] shrink-0" />
                  <span className="truncate">
                    UTM: {selectedConversation.utm_campaign || 'Tráfico Directo B2B'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleTogglePersonalCategory}
                  className={`w-full mt-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                    selectedConversation.ai_classification === 'AMIGOS_FAMILIA'
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800 hover:bg-sky-100'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                  }`}
                >
                  {selectedConversation.ai_classification === 'AMIGOS_FAMILIA'
                    ? '🏢 Pasar a Prospecto Comercial B2B'
                    : '👨‍👩‍👧‍👦 Marcar como Amigo / Familiar (0 SKUs)'}
                </button>
              </div>

              {/* Cambio Rápido de Etapa en Pipeline */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Etapa en Pipeline Comercial
                </label>
                <div className="space-y-1.5">
                  {STAGES_LABELS.map((st) => {
                    const active = selectedConversation.etapa === st.key;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => handleStageUpdate(st.key)}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left border transition-all cursor-pointer ${
                          active
                            ? 'bg-[#00a2e8] text-white border-[#00a2e8] shadow-2xs'
                            : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Botón de eliminación limpia (incluye mensajes omnicanal en cascada) */}
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleDeleteConversationDeal}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200/70 dark:border-rose-800/60 transition-colors cursor-pointer"
                >
                  🗑️ Eliminar Prospecto y Conversación
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center my-auto">
              Sin prospecto seleccionado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OmnichannelChatView;
