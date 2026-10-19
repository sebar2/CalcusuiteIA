import React, { useState, useEffect } from 'react';
import {
  Plug,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  Send,
  Megaphone,
  MessageSquare,
  Mail,
  Globe,
  Bot,
  ExternalLink,
  Lock,
  Sparkles,
  TrendingUp,
  Copy,
  Check,
  QrCode,
  Smartphone,
  Unplug,
  ShoppingBag,
} from 'lucide-react';
import { apiService } from '../services/api';
import type { IntegrationChannelConfig, WhatsAppQRSessionResponse } from '../types';
import { MeliPublishModal } from '../components/integrations/MeliPublishModal';

interface IntegrationsViewProps {
  currentRole?: string;
  onNavigateToCRM?: () => void;
  onNavigateToChat?: (dealId?: string) => void;
}

const CHANNEL_FIELDS_SCHEMA: Record<
  string,
  { key: string; label: string; placeholder: string; type: 'password' | 'text' }[]
> = {
  GOOGLE_ADS: [
    { key: 'developer_token', label: 'Google Ads Developer Token *', placeholder: 'AIzaSyD-xxxx...', type: 'password' },
    { key: 'client_id', label: 'OAuth2 Client ID *', placeholder: '123456-abc.apps.googleusercontent.com', type: 'text' },
    { key: 'client_secret', label: 'OAuth2 Client Secret', placeholder: 'GOCSPX-xxxx...', type: 'password' },
    { key: 'customer_id', label: 'Customer Account ID', placeholder: '849-201-9921', type: 'text' },
  ],
  META_ADS: [
    { key: 'access_token', label: 'Meta Graph API System User Token *', placeholder: 'EAABsbCS1iHgBO...', type: 'password' },
    { key: 'page_id', label: 'Facebook / Instagram Page ID *', placeholder: '1049281928371', type: 'text' },
    { key: 'app_secret', label: 'Meta App Secret (HMAC X-Hub-Signature-256)', placeholder: 'a8f9d0e1...', type: 'password' },
  ],
  WHATSAPP: [
    { key: 'access_token', label: 'WhatsApp Cloud API Permanent Token *', placeholder: 'EAAGm0PX4ZCps...', type: 'password' },
    { key: 'phone_number_id', label: 'Phone Number ID *', placeholder: '1092837465123', type: 'text' },
    { key: 'waba_id', label: 'WhatsApp Business Account ID (WABA)', placeholder: '998877665544', type: 'text' },
  ],
  WHATSAPP_QR: [
    { key: 'linked_phone', label: 'Número de Teléfono Vinculado *', placeholder: '+598 94 858 791', type: 'text' },
    { key: 'device_label', label: 'Etiqueta del Dispositivo Multi-Device', placeholder: 'WhatsApp Web Corporativo', type: 'text' },
    { key: 'session_auth_bundle', label: 'Token / Bundle de Sesión Multi-Device *', placeholder: 'wa_md_aes256_...', type: 'password' },
  ],
  EMAIL: [
    { key: 'smtp_host', label: 'Servidor SMTP (Host) *', placeholder: 'smtp.office365.com / smtp.gmail.com', type: 'text' },
    { key: 'smtp_port', label: 'Puerto SMTP', placeholder: '587', type: 'text' },
    { key: 'smtp_user', label: 'Usuario / Casilla Corporativa *', placeholder: 'ventas@empresa.com.uy', type: 'text' },
    { key: 'smtp_password', label: 'Contraseña de Aplicación SMTP *', placeholder: '••••••••••••••••', type: 'password' },
    { key: 'imap_host', label: 'Servidor IMAP (Recepción)', placeholder: 'outlook.office365.com', type: 'text' },
  ],
  WEB_FORM: [
    { key: 'webhook_secret', label: 'Secreto de Firma HMAC para Formulario Web *', placeholder: 'whsec_calcu_998877...', type: 'password' },
    { key: 'allowed_origin', label: 'Dominio Web Autorizado (CORS)', placeholder: 'https://www.miempresa.com.uy', type: 'text' },
  ],
  MERCADO_LIBRE: [
    { key: 'app_id', label: 'Mercado Libre App ID (Oficial Developer Center) *', placeholder: '5376694505612300', type: 'text' },
    { key: 'client_secret', label: 'Client Secret Oficial (Developers MeLi) *', placeholder: 't9hBq41DBS8d8Z1...', type: 'password' },
    { key: 'seller_id', label: 'ID de Cuenta / Vendedor MeLi (Opcional)', placeholder: '182736452', type: 'text' },
    { key: 'site_id', label: 'Site Marketplace', placeholder: 'MLU (Uruguay)', type: 'text' },
  ],
};

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({
  currentRole = 'controller_admin',
  onNavigateToCRM,
  onNavigateToChat,
}) => {
  const [channels, setChannels] = useState<IntegrationChannelConfig[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);

  // Modal de Configuración de Credenciales (Bóveda AES-256)
  const [selectedChannelForConfig, setSelectedChannelForConfig] = useState<IntegrationChannelConfig | null>(null);
  const [defaultSeller, setDefaultSeller] = useState<string>('Martín Gómez');
  const [costPerLead, setCostPerLead] = useState<string>('15.0');
  const [credentialsForm, setCredentialsForm] = useState<Record<string, string>>({});
  const [autoReplyEnabled, setAutoReplyEnabled] = useState<boolean>(false);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Modal de Publicación y Catálogo Oficial MeLi (MLU)
  const [isMeliPublishModalOpen, setIsMeliPublishModalOpen] = useState<boolean>(false);

  // Modal de Vinculación de WhatsApp Directo por Código QR
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [qrSession, setQrSession] = useState<WhatsAppQRSessionResponse | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState<boolean>(false);
  const [qrLinkedPhone, setQrLinkedPhone] = useState<string>('+598 94 858 791');
  const [qrDeviceLabel, setQrDeviceLabel] = useState<string>('WhatsApp Web Multi-Dispositivo (Calcu CRM)');
  const [isConfirmingQR, setIsConfirmingQR] = useState<boolean>(false);

  // Modal de Simulación / Ingesta de Lead en 1. Prospección
  const [selectedChannelForWebhook, setSelectedChannelForWebhook] = useState<IntegrationChannelConfig | null>(null);
  const [leadNombre, setLeadNombre] = useState<string>('Constructora Atlántida S.A.');
  const [leadProyecto, setLeadProyecto] = useState<string>('Cotización 450 Luminarias Industriales HighBay');
  const [leadEmail, setLeadEmail] = useState<string>('compras@atlantidaconstrucciones.uy');
  const [leadTelefono, setLeadTelefono] = useState<string>('+598 99 412 880');
  const [leadMensaje, setLeadMensaje] = useState<string>(
    'Hola, vimos su campaña y necesitamos cotizar urgente 450 luminarias industriales LUM-6060 con entrega en obra Ruta 101.'
  );
  const [leadCampaign, setLeadCampaign] = useState<string>('Q4_B2B_Iluminacion_Industrial');
  const [leadMonto, setLeadMonto] = useState<string>('18500');
  const [isInjectingLead, setIsInjectingLead] = useState<boolean>(false);
  const [lastInjectedDealId, setLastInjectedDealId] = useState<string | null>(null);

  const isAdmin = currentRole === 'controller_admin';

  const loadChannels = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getIntegrationChannels();
      setChannels(data);
    } catch (err: any) {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.detail || 'No se pudo cargar el estado del Hub de Integraciones.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'GOOGLE_ADS':
        return <Megaphone className="text-blue-600 dark:text-blue-400" size={22} />;
      case 'META_ADS':
        return <Megaphone className="text-indigo-600 dark:text-indigo-400" size={22} />;
      case 'WHATSAPP':
        return <MessageSquare className="text-emerald-600 dark:text-emerald-400" size={22} />;
      case 'WHATSAPP_QR':
        return <QrCode className="text-teal-600 dark:text-teal-400" size={22} />;
      case 'EMAIL':
        return <Mail className="text-purple-600 dark:text-purple-400" size={22} />;
      case 'MERCADO_LIBRE':
        return <ShoppingBag className="text-amber-500 dark:text-yellow-400" size={22} />;
      default:
        return <Globe className="text-cyan-600 dark:text-cyan-400" size={22} />;
    }
  };

  const handleOpenQRModal = async () => {
    if (!isAdmin) {
      setBannerMsg({
        type: 'warning',
        text: 'Control RBAC ISO 27001: Solo el rol controller_admin puede vincular o desvincular dispositivos WhatsApp QR.',
      });
      return;
    }
    setIsQRModalOpen(true);
    setIsGeneratingQR(true);
    try {
      const session = await apiService.generateWhatsAppQR();
      setQrSession(session);
      if (session.bridge_linked_phone) {
        setQrLinkedPhone(session.bridge_linked_phone);
      }
    } catch (err: any) {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.detail || 'No se pudo generar el código QR de vinculación.',
      });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // Polling en tiempo real cada 2.5s mientras el modal QR está abierto:
  // 1) Refresca el código QR oficial de WhatsApp Web si Baileys lo rota (~20s)
  // 2) Detecta automáticamente apenas el usuario escanea el QR con su celular
  useEffect(() => {
    if (!isQRModalOpen) return;
    const interval = setInterval(async () => {
      try {
        const st = await apiService.getWhatsAppQRStatus();
        if (st.qr_svg) {
          setQrSession((prev) =>
            prev
              ? {
                  ...prev,
                  qr_svg: st.qr_svg || prev.qr_svg,
                  bridge_online: st.bridge_online,
                  bridge_connection: st.bridge_connection,
                  current_status: st.status,
                }
              : prev
          );
        }
        if (st.bridge_connection === 'open' || (st.status === 'CONNECTED' && st.bridge_online)) {
          if (st.channel_config) {
            setChannels((prev) =>
              prev.map((c) => (c.channel === 'WHATSAPP_QR' ? st.channel_config! : c))
            );
          } else {
            loadChannels();
          }
          setIsQRModalOpen(false);
          setBannerMsg({
            type: 'success',
            text: `¡Escaneo desde celular completado en vivo (${st.linked_phone || qrLinkedPhone})! WhatsApp Multi-Dispositivo conectado y cifrado en bóveda AES-256.`,
          });
        }
      } catch {
        // Silencioso durante polling
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [isQRModalOpen, qrLinkedPhone]);

  const handleConfirmQRScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrSession) return;
    setIsConfirmingQR(true);
    try {
      const updated = await apiService.confirmWhatsAppQRScan({
        qr_token: qrSession.qr_token,
        linked_phone: qrLinkedPhone.trim() || '+598 94 858 791',
        device_label: qrDeviceLabel.trim() || 'WhatsApp Web Multi-Dispositivo (Calcu CRM)',
      });
      setChannels((prev) => prev.map((c) => (c.channel === updated.channel ? updated : c)));
      setIsQRModalOpen(false);
      setBannerMsg({
        type: 'success',
        text: `¡WhatsApp Directo vinculado por Código QR (${qrLinkedPhone.trim()})! Sesión cifrada en bóveda AES-256.`,
      });
    } catch (err: any) {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Error al confirmar escaneo de código QR.',
      });
    } finally {
      setIsConfirmingQR(false);
    }
  };

  const handleDisconnectQR = async () => {
    if (!isAdmin) return;
    try {
      const updated = await apiService.disconnectWhatsAppQR();
      setChannels((prev) => prev.map((c) => (c.channel === updated.channel ? updated : c)));
      setIsQRModalOpen(false);
      setBannerMsg({
        type: 'warning',
        text: 'Sesión de WhatsApp QR desvinculada y revocada de la bóveda AES-256.',
      });
    } catch (err: any) {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.detail || 'No se pudo desvincular la sesión de WhatsApp QR.',
      });
    }
  };

  const handleConnectMeliOAuth = async () => {
    if (!isAdmin) {
      setBannerMsg({
        type: 'warning',
        text: 'Control RBAC ISO 27001: Solo el rol controller_admin puede autorizar la vinculación OAuth 2.0 con Mercado Libre.',
      });
      return;
    }
    try {
      const res = await apiService.getMeliAuthUrl();
      if (res && res.auth_url) {
        const popup = window.open(
          res.auth_url,
          'MeliOAuthWindow',
          'width=650,height=750,scrollbars=yes,status=yes'
        );
        const timer = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(timer);
            loadChannels();
          }
        }, 1500);
      }
    } catch (err: any) {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.detail || 'No se pudo generar la URL de autorización de Mercado Libre.',
      });
    }
  };

  const handleOpenConfigModal = (ch: IntegrationChannelConfig) => {
    if (!isAdmin) {
      setBannerMsg({
        type: 'warning',
        text: 'Control RBAC ISO 27001: Solo el rol controller_admin puede modificar llaves criptográficas de integración.',
      });
      return;
    }
    setSelectedChannelForConfig(ch);
    setDefaultSeller(ch.default_seller || 'Martín Gómez');
    setCostPerLead(String(ch.cost_per_lead_usd || 15));
    setAutoReplyEnabled(ch.auto_reply_enabled);
    setCredentialsForm({});
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannelForConfig) return;
    setIsSavingConfig(true);
    try {
      const updated = await apiService.updateIntegrationChannel(selectedChannelForConfig.channel, {
        is_enabled: true,
        credentials: credentialsForm,
        auto_reply_enabled: autoReplyEnabled,
        default_seller: defaultSeller,
        cost_per_lead_usd: parseFloat(costPerLead) || 0,
      });
      setChannels((prev) => prev.map((c) => (c.channel === updated.channel ? updated : c)));
      setSelectedChannelForConfig(null);
      setCredentialsForm({});
      setBannerMsg({
        type: updated.status === 'CONNECTED' ? 'success' : 'warning',
        text:
          updated.status === 'CONNECTED'
            ? `Credenciales de ${updated.display_name} cifradas en bóveda AES-256-CTR + HMAC. Canal CONECTADO.`
            : `${updated.display_name} actualizado (${updated.status}).`,
      });
    } catch (err: any) {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Error al guardar credenciales en bóveda.',
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTestChannel = async (ch: IntegrationChannelConfig) => {
    try {
      const res = await apiService.testIntegrationChannel(ch.channel);
      setBannerMsg({
        type: res.connected ? 'success' : 'warning',
        text: `[${ch.display_name}] ${res.message}`,
      });
      loadChannels();
    } catch (err: any) {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.detail || `Error al verificar canal ${ch.display_name}.`,
      });
    }
  };

  const handleOpenWebhookModal = (ch: IntegrationChannelConfig) => {
    setSelectedChannelForWebhook(ch);
    setLastInjectedDealId(null);
    if (ch.channel === 'GOOGLE_ADS') {
      setLeadCampaign('Google_Search_Luminarias_B2B_UY');
    } else if (ch.channel === 'META_ADS') {
      setLeadCampaign('Meta_LeadForm_Obras_2026');
    } else if (ch.channel === 'WHATSAPP') {
      setLeadCampaign('WhatsApp_CloudAPI_Flota');
    } else if (ch.channel === 'WHATSAPP_QR') {
      setLeadCampaign('WhatsApp_QR_Directo');
    } else if (ch.channel === 'EMAIL') {
      setLeadCampaign('Inbound_Email_Ventas');
    } else {
      setLeadCampaign('Formulario_Web_Corporativo');
    }
  };

  const handleInjectLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannelForWebhook) return;
    setIsInjectingLead(true);
    try {
      const res = await apiService.ingestWebhookLead(selectedChannelForWebhook.channel, {
        nombre_contacto: leadNombre.trim(),
        empresa: leadNombre.trim(),
        proyecto_o_interes: leadProyecto.trim(),
        email: leadEmail.trim() || undefined,
        telefono: leadTelefono.trim() || undefined,
        mensaje_inicial: leadMensaje.trim(),
        monto_estimado_usd: parseFloat(leadMonto) || 15000,
        utm_source: selectedChannelForWebhook.channel.toLowerCase(),
        utm_medium: 'cpc_webhook',
        utm_campaign: leadCampaign.trim() || undefined,
      });
      setLastInjectedDealId(res.deal_id);
      setBannerMsg({
        type: 'success',
        text: `${res.message} Etiqueta: [${res.canal_origen}] · Score IA: ${res.ai_classification} (${res.ai_score}/100).`,
      });
      loadChannels();
    } catch (err: any) {
      setBannerMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Error al inyectar lead en Pipeline Comercial.',
      });
    } finally {
      setIsInjectingLead(false);
    }
  };

  const totalLeadsCaptured = channels.reduce((acc, c) => acc + (c.leads_captured_count || 0), 0);
  const totalRevenueClosed = channels.reduce((acc, c) => acc + (c.revenue_closed_usd || 0), 0);
  const activeCount = channels.filter((c) => c.status === 'CONNECTED').length;

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#00a2e8] to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
            <Plug size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Hub de Integraciones Multicanal &amp; AdTech
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <ShieldCheck size={12} />
                <span>Bóveda AES-256 ISO 27001</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Conexión directa con Google Ads, Meta Lead Ads, WhatsApp Business, Email SMTP/IMAP y Webhooks con inyección automática en &ldquo;1. Prospección&rdquo;.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigateToCRM && (
            <button
              onClick={onNavigateToCRM}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <ExternalLink size={14} />
              <span>Ver Pipeline (1. Prospección)</span>
            </button>
          )}
          {onNavigateToChat && (
            <button
              onClick={() => onNavigateToChat()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#00a2e8] hover:bg-[#008ecb] text-white shadow-xs transition-all cursor-pointer"
            >
              <MessageSquare size={14} />
              <span>Abrir Chat Omnicanal IA</span>
            </button>
          )}
          <button
            onClick={loadChannels}
            disabled={isLoading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Refrescar estado de conectores"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPIs de Atribución & Seguridad */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Canales Conectados</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {activeCount} / {channels.length || 5}
            </span>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              Zero Silent Mocks Activo
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Leads Inyectados en CRM</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-[#00a2e8]">{totalLeadsCaptured}</span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <TrendingUp size={12} /> Etapa 1. Prospección
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Revenue Atribuido Cierre</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              USD ${totalRevenueClosed.toLocaleString('es-UY', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[11px] text-slate-400">ROAS Trazable</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Protección CWE-312 / 532</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Lock size={15} /> Secretos Enmascarados
            </span>
            <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">
              AES-CTR-256
            </span>
          </div>
        </div>
      </div>

      {/* Banner de Feedback */}
      {bannerMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
            bannerMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : bannerMsg.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMsg.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle size={16} className="shrink-0" />
            )}
            <span>{bannerMsg.text}</span>
          </div>
          <button onClick={() => setBannerMsg(null)} className="ml-4 font-bold text-sm">
            ×
          </button>
        </div>
      )}

      {/* Grid de los 5 Conectores Multicanal */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {channels.map((ch) => {
          const isConnected = ch.status === 'CONNECTED';
          const maskedEntries = Object.entries(ch.masked_credentials || {});

          return (
            <div
              key={ch.channel}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between p-5"
            >
              <div>
                {/* Cabecera de Tarjeta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 flex items-center justify-center shrink-0">
                      {getChannelIcon(ch.channel)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {ch.display_name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Vendedor asignado: {ch.default_seller || 'Martín Gómez'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${
                      isConnected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {isConnected ? '● CONECTADO' : '○ PENDIENTE CREDENCIALES'}
                  </span>
                </div>

                {/* Mensaje de Estado (No Silent Mocks) */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    Estado: {isConnected ? 'Conectado y verificado' : 'Desconectado / Pendiente de credenciales'}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Endpoint Webhook:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(window.location.origin + ch.webhook_url);
                        setCopiedWebhook(ch.channel);
                        setTimeout(() => setCopiedWebhook(null), 2000);
                      }}
                      className="inline-flex items-center gap-1 font-mono text-[#00a2e8] hover:underline cursor-pointer"
                    >
                      <span>{ch.webhook_url}</span>
                      {copiedWebhook === ch.channel ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>

                {/* Resumen de Llaves Enmascaradas */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <span>Bóveda Cifrada (CWE-312 Safe)</span>
                    {ch.auto_reply_enabled && (
                      <span className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400">
                        <Bot size={11} /> Auto-IA Activa
                      </span>
                    )}
                  </div>
                  {maskedEntries.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {maskedEntries.map(([k, v]) => (
                        <div
                          key={k}
                          className="px-2 py-1 rounded-lg bg-slate-100/80 dark:bg-slate-800 text-[10px] font-mono truncate border border-slate-200/60 dark:border-slate-700"
                        >
                          <span className="text-slate-400">{k}: </span>
                          <span className="text-slate-700 dark:text-slate-200 font-semibold">{v}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic py-1">
                      Sin llaves cargadas en la bóveda de este tenant.
                    </p>
                  )}
                </div>

                {/* Métricas de Captación del Canal */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Leads</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {ch.leads_captured_count}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">CPL Est.</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      USD ${Number(ch.cost_per_lead_usd || 0).toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">ROAS Est.</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {Number(ch.estimated_roas || 0).toFixed(1)}x
                    </span>
                  </div>
                </div>

                {ch.channel === 'MERCADO_LIBRE' && !isConnected && (
                  <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <span className="font-bold block">Vinculación OAuth2 Requerida</span>
                      <span>Autoriza Calcu-Benchmarking (App ID 5376694505612300) para recibir preguntas en 1. Prospección y responder desde el Chat Omnicanal.</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Botonera Inferior */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {ch.channel === 'WHATSAPP_QR' ? (
                    <button
                      type="button"
                      onClick={handleOpenQRModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer"
                    >
                      <QrCode size={13} />
                      <span>{isConnected ? 'Gestionar QR' : 'Vincular con QR'}</span>
                    </button>
                  ) : ch.channel === 'MERCADO_LIBRE' ? (
                    <div className="flex items-center gap-1.5">
                      {isConnected && (
                        <button
                          type="button"
                          onClick={() => setIsMeliPublishModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FFE600] hover:bg-[#ffe100] text-[#2D3277] shadow-xs transition-colors cursor-pointer"
                          title="Publicar producto del inventario en Mercado Libre Uruguay en 1 clic"
                        >
                          <ShoppingBag size={13} />
                          <span>Publicar SKU</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleConnectMeliOAuth}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer ${
                          isConnected
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
                            : 'bg-[#FFE600] hover:bg-[#ffe100] text-[#2D3277]'
                        }`}
                        title="Iniciar flujo oficial OAuth 2.0 con Mercado Libre Developers"
                      >
                        <ShoppingBag size={13} />
                        <span>{isConnected ? 'Reconectar' : 'Vincular MeLi'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenConfigModal(ch)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Ver credenciales enmascaradas o configurar llaves"
                      >
                        <KeyRound size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenConfigModal(ch)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <KeyRound size={13} />
                      <span>Credenciales</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleTestChannel(ch)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Verificar estado real de conexión"
                  >
                    Test
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenWebhookModal(ch)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-50 dark:bg-sky-950/60 text-[#00a2e8] hover:bg-[#00a2e8] hover:text-white border border-sky-200 dark:border-sky-800 transition-all cursor-pointer"
                >
                  <Send size={12} />
                  <span>Inyectar Lead</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Vinculación de WhatsApp Directo por Código QR */}
      {isQRModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <QrCode size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Vincular WhatsApp Directo por Código QR (Multi-Dispositivo)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Conecta cualquier línea WhatsApp o WhatsApp Business escaneando el QR sin necesidad de API Cloud de Meta.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQRModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
              {/* Columna Izquierda: Imagen QR Oficial de WhatsApp Multi-Dispositivo */}
              <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                {isGeneratingQR ? (
                  <div className="w-56 h-56 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
                    <RefreshCw size={24} className="animate-spin text-teal-500" />
                    <span>Conectando con WhatsApp Multi-Dispositivo...</span>
                  </div>
                ) : qrSession ? (
                  <>
                    <div className="mb-2">
                      {qrSession.bridge_online ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-300 dark:border-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          QR Oficial WhatsApp Web en Vivo (Auto-Refresco)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-700">
                          QR Estándar ISO-18004 (Modo Simulación Local)
                        </span>
                      )}
                    </div>
                    <img
                      src={qrSession.qr_svg}
                      alt="Código QR de vinculación WhatsApp"
                      className="w-56 h-56 rounded-xl shadow-sm border border-slate-200 bg-white p-1.5"
                    />
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 font-mono text-[11px] font-bold border border-teal-200 dark:border-teal-800">
                        Código: {qrSession.pairing_code}
                      </span>
                      <button
                        type="button"
                        onClick={handleOpenQRModal}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#00a2e8] hover:underline cursor-pointer"
                      >
                        <RefreshCw size={11} /> Nuevo QR
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-rose-500">No se pudo cargar el QR.</p>
                )}
              </div>

              {/* Columna Derecha: Instrucciones y Confirmación */}
              <form onSubmit={handleConfirmQRScan} className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/70 dark:border-teal-800/70 space-y-1.5">
                  <div className="font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                    <Smartphone size={14} /> Pasos en tu teléfono:
                  </div>
                  {(qrSession?.instructions || [
                    '1. Abre WhatsApp en tu teléfono.',
                    "2. Ve a Menú (⋮) > 'Dispositivos vinculados'.",
                    "3. Toca 'Vincular un dispositivo' y escanea este código QR.",
                  ]).map((step, i) => (
                    <p key={i} className="text-[11px] text-teal-800 dark:text-teal-300 leading-relaxed">
                      {step}
                    </p>
                  ))}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Número de WhatsApp Vinculado *
                  </label>
                  <input
                    type="text"
                    required
                    value={qrLinkedPhone}
                    onChange={(e) => setQrLinkedPhone(e.target.value)}
                    placeholder="+598 94 858 791"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre / Etiqueta del Dispositivo
                  </label>
                  <input
                    type="text"
                    required
                    value={qrDeviceLabel}
                    onChange={(e) => setQrDeviceLabel(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={isConfirmingQR || !qrSession}
                    className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={15} />
                    <span>
                      {isConfirmingQR
                        ? 'Cifrando sesión en Bóveda AES-256...'
                        : 'Confirmar Escaneo QR & Vincular'}
                    </span>
                  </button>

                  {qrSession?.current_status === 'CONNECTED' && (
                    <button
                      type="button"
                      onClick={handleDisconnectQR}
                      className="w-full py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Unplug size={13} />
                      <span>Desvincular Dispositivo Actual</span>
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                Puente local opcional Baileys: <code className="font-mono text-slate-600 dark:text-slate-300">node scripts/whatsapp_qr_bridge.js</code>
              </span>
              <button
                type="button"
                onClick={() => setIsQRModalOpen(false)}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configuración de Credenciales (Cifrado AES-256) */}
      {selectedChannelForConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                {getChannelIcon(selectedChannelForConfig.channel)}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Configurar Bóveda: {selectedChannelForConfig.display_name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cifrado autenticado AES-256-CTR + HMAC. Los secretos nunca se devuelven en texto plano.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedChannelForConfig(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vendedor Asignado por Defecto
                  </label>
                  <input
                    type="text"
                    value={defaultSeller}
                    onChange={(e) => setDefaultSeller(e.target.value)}
                    placeholder="ej. Martín Gómez"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Costo por Lead Est. (CPL USD)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={costPerLead}
                    onChange={(e) => setCostPerLead(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {(CHANNEL_FIELDS_SCHEMA[selectedChannelForConfig.channel] || []).map((field) => {
                const currentMasked = selectedChannelForConfig.masked_credentials?.[field.key];
                return (
                  <div key={field.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        {field.label}
                      </label>
                      {currentMasked && (
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                          Actual: {currentMasked}
                        </span>
                      )}
                    </div>
                    <input
                      type={field.type}
                      autoComplete={field.type === 'password' ? 'current-password' : 'off'}
                      value={credentialsForm[field.key] || ''}
                      onChange={(e) =>
                        setCredentialsForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={
                        currentMasked
                          ? `Dejar vacío para mantener (${currentMasked}) o ingresar nuevo`
                          : field.placeholder
                      }
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                );
              })}

              <label className="flex items-center gap-2.5 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoReplyEnabled}
                  onChange={(e) => setAutoReplyEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-[#00a2e8] focus:ring-[#00a2e8]"
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Habilitar Copiloto IA Gratuito (Ollama) para pre-calificar y sugerir respuestas automáticas
                </span>
              </label>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChannelForConfig(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-4 py-2 rounded-xl bg-[#00a2e8] hover:bg-[#008ecb] text-white font-bold shadow-sm cursor-pointer"
                >
                  {isSavingConfig ? 'Cifrando en Bóveda...' : 'Guardar en Bóveda AES-256'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Inyectar Lead Multicanal en Etapa "1. Prospección" */}
      {selectedChannelForWebhook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                {getChannelIcon(selectedChannelForWebhook.channel)}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Ingesta Automática de Prospecto ({selectedChannelForWebhook.display_name})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    El lead se inyectará en la etapa &ldquo;1. Prospección&rdquo; con etiqueta de origen y abrirá hilo en el Chat Omnicanal.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedChannelForWebhook(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleInjectLeadSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cliente / Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    value={leadNombre}
                    onChange={(e) => setLeadNombre(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Proyecto / Consulta *
                  </label>
                  <input
                    type="text"
                    required
                    value={leadProyecto}
                    onChange={(e) => setLeadProyecto(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email del Lead
                  </label>
                  <input
                    type="email"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={leadTelefono}
                    onChange={(e) => setLeadTelefono(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Campaña UTM
                  </label>
                  <input
                    type="text"
                    value={leadCampaign}
                    onChange={(e) => setLeadCampaign(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-900 dark:text-white font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monto Est. (USD)
                  </label>
                  <input
                    type="number"
                    value={leadMonto}
                    onChange={(e) => setLeadMonto(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mensaje Inicial del Prospecto (Se registrará en el Chat Omnicanal) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={leadMensaje}
                  onChange={(e) => setLeadMensaje(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              {lastInjectedDealId && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <span className="text-emerald-800 dark:text-emerald-200 font-semibold">
                    ¡Prospecto #{lastInjectedDealId} creado en 1. Prospección!
                  </span>
                  <div className="flex items-center gap-2">
                    {onNavigateToChat && (
                      <button
                        type="button"
                        onClick={() => {
                          const id = lastInjectedDealId;
                          setSelectedChannelForWebhook(null);
                          onNavigateToChat(id);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 cursor-pointer"
                      >
                        Responder en Chat IA
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChannelForWebhook(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={isInjectingLead}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00a2e8] hover:bg-[#008ecb] text-white font-bold shadow-sm cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>{isInjectingLead ? 'Inyectando...' : 'Inyectar en 1. Prospección'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Publicación Oficial en Mercado Libre Uruguay */}
      <MeliPublishModal
        isOpen={isMeliPublishModalOpen}
        onClose={() => setIsMeliPublishModalOpen(false)}
        onPublished={(item) => {
          setBannerMsg({
            type: 'success',
            text: `¡Artículo "${item.title}" (${item.item_id}) publicado con éxito en Mercado Libre Uruguay!`,
          });
          loadChannels();
        }}
      />
    </div>
  );
};

export default IntegrationsView;
