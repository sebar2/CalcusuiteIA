/**
 * ==========================================================================
 * CALCU SUITE 2026 - WEBCHAT IA CORPORATIVO & TELEMETRÍA DE NAVEGACIÓN
 * Motor de Memoria Slot-Filling, Telemetría Web y Avance Automático Kanban CRM
 * ==========================================================================
 */

(function () {
  // 1. SISTEMA DE TELEMETRÍA DE NAVEGACIÓN WEB
  const TELEMETRY_STORAGE_KEY = 'calcu_telemetry_data';

  class TelemetryTracker {
    constructor() {
      this.init();
    }

    init() {
      const stored = this.loadStored();
      const currentPath = window.location.pathname || '/';

      let pages = stored.pages_visited || [];
      if (!pages.includes(currentPath)) {
        pages.push(currentPath);
      }

      this.data = {
        session_id: stored.session_id || this.generateUUID(),
        start_time: stored.start_time || Date.now(),
        pages_visited: pages,
        interacted_elements: stored.interacted_elements || [],
        max_scroll_depth: stored.max_scroll_depth || 0,
        referrer: document.referrer || stored.referrer || 'Directo / Orgánico',
      };

      this.save();
      this.bindEvents();
    }

    generateUUID() {
      return 'web-anon-' + 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }

    loadStored() {
      try {
        const item = sessionStorage.getItem(TELEMETRY_STORAGE_KEY);
        return item ? JSON.parse(item) : {};
      } catch {
        return {};
      }
    }

    save() {
      try {
        sessionStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(this.data));
      } catch {}
    }

    bindEvents() {
      // Cálculo de scroll depth
      window.addEventListener('scroll', () => {
        const h = document.documentElement;
        const b = document.body;
        const st = 'scrollTop';
        const sh = 'scrollHeight';
        const percent = Math.round(((h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight)) * 100) || 0;
        if (percent > (this.data.max_scroll_depth || 0)) {
          this.data.max_scroll_depth = Math.min(100, percent);
          this.save();
        }
      }, { passive: true });

      // Registro de clicks en elementos interactivos
      document.addEventListener('click', (e) => {
        const target = e.target.closest('a, button');
        if (target) {
          const identifier = target.getAttribute('id') || target.getAttribute('href') || target.innerText.trim().slice(0, 30);
          if (identifier && !this.data.interacted_elements.includes(identifier)) {
            this.data.interacted_elements.push(identifier);
            if (this.data.interacted_elements.length > 20) {
              this.data.interacted_elements.shift();
            }
            this.save();
          }
        }
      }, { passive: true });
    }

    getMetrics() {
      const now = Date.now();
      const elapsedSeconds = Math.round((now - (this.data.start_time || now)) / 1000);
      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
      const deviceType = isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop';

      return {
        current_page: window.location.pathname || '/',
        pages_visited: this.data.pages_visited || [window.location.pathname],
        time_on_site_seconds: elapsedSeconds,
        scroll_depth_pct: this.data.max_scroll_depth || 0,
        interacted_elements: this.data.interacted_elements || [],
        referrer: this.data.referrer,
        device_type: deviceType,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      };
    }
  }

  window.CalcuTelemetry = new TelemetryTracker();

  // 2. WIDGET DE WEBCHAT IA NATIVO
  const isProduction =
    window.location.hostname === 'calcusuiteia.com' ||
    window.location.hostname === 'www.calcusuiteia.com' ||
    window.location.hostname === 'app.calcusuiteia.com';

  const WEBCHAT_CONFIG = {
    endpoints: isProduction
      ? ['https://app.calcusuiteia.com/api/v1/public/webchat']
      : [
          'https://app.calcusuiteia.com/api/v1/public/webchat',
          'http://127.0.0.1:8000/api/v1/public/webchat',
          'http://localhost:8000/api/v1/public/webchat',
        ],
    officialWhatsapp: '59894858791',
    officialEmail: 'contacto@calcusuiteia.com',
  };

  class CalcuWebChatUI {
    constructor() {
      this.isOpen = false;
      this.isBusy = false;
      this.sessionId = this.getOrCreateSessionId();
      this.knownFields = this.loadKnownFields();
      this.isEscalated = false;
      this.buildDOM();
    }

    getOrCreateSessionId() {
      let sid = sessionStorage.getItem('calcu_webchat_session_id');
      if (!sid) {
        sid = window.CalcuTelemetry.data.session_id || window.CalcuTelemetry.generateUUID();
        sessionStorage.setItem('calcu_webchat_session_id', sid);
      }
      return sid;
    }

    loadKnownFields() {
      try {
        const raw = sessionStorage.getItem('calcu_webchat_known_fields');
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }

    saveKnownFields(fields) {
      this.knownFields = Object.assign({}, this.knownFields, fields);
      try {
        sessionStorage.setItem('calcu_webchat_known_fields', JSON.stringify(this.knownFields));
      } catch {}
      this.updateHeaderBadge();
    }

    buildDOM() {
      // 1. Botón Flotante
      const triggerBtn = document.createElement('div');
      triggerBtn.id = 'calcuChatTrigger';
      triggerBtn.className = 'fixed bottom-6 right-6 z-50 flex items-center gap-3 cursor-pointer group';
      triggerBtn.innerHTML = `
        <div class="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/95 border border-cyan-500/40 text-xs text-slate-200 shadow-xl shadow-cyan-950/40 backdrop-blur-md group-hover:border-cyan-400 transition-all">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="font-medium">¿Dudas? Chatea con IA</span>
        </div>
        <button aria-label="Abrir Asistente Comercial IA" class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 p-0.5 shadow-2xl shadow-cyan-600/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-all focus:outline-none">
          <div class="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-white">
            <svg class="w-7 h-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
            </svg>
          </div>
        </button>
      `;

      // 2. Ventana de Chat
      const chatModal = document.createElement('div');
      chatModal.id = 'calcuChatModal';
      chatModal.className = 'hidden fixed bottom-24 right-4 sm:right-6 z-50 w-[92vw] sm:w-[410px] max-w-[430px] h-[580px] max-h-[85vh] rounded-2xl bg-slate-950/98 border border-slate-800 shadow-2xl shadow-black/80 flex flex-col overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200';
      chatModal.innerHTML = `
        <!-- Header -->
        <div class="px-4 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-white tracking-tight">CalcuSuiteIA Copilot</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">CSIA</span>
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="En línea"></span>
              </div>
              <p id="chatHeaderSub" class="text-[11px] text-cyan-400 font-medium">Asesor Inteligente • calcusuiteia.com</p>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button id="closeChatBtn" aria-label="Cerrar chat" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Banner de Calificación / Escalación -->
        <div id="escalationBanner" class="hidden px-4 py-2 bg-emerald-950/60 border-b border-emerald-500/30 text-[11px] text-emerald-300 flex items-center gap-2">
          <span class="text-emerald-400 font-bold">🔥 Lead Calificado:</span>
          <span>Derivado a Dirección para Demo Ejecutiva</span>
        </div>

        <!-- Messages Thread -->
        <div id="chatMessages" class="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs text-slate-200 scroll-smooth">
          <!-- Welcome Bubble -->
          <div class="flex gap-2.5 items-start">
            <div class="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shrink-0 text-[10px] font-bold">
              IA
            </div>
            <div class="p-3 rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800/80 max-w-[85%] leading-relaxed text-slate-200">
              ¡Hola! 👋 Soy el asistente inteligente de **CalcuSuiteIA (CSIA)**. Puedo orientarte sobre nuestro **Gemelo Digital 3D**, la logística 3PL o coordinar tu acceso prioritario al **Programa Pioneros (6 meses 100% gratis + 50% vitalicio)**.<br><br>
              ¿De qué empresa nos visitas o qué módulo te gustaría explorar hoy?
            </div>
          </div>
        </div>

        <!-- Quick Pills -->
        <div id="quickPills" class="px-3 py-2 bg-slate-950 border-t border-slate-900 flex gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
          <button onclick="if(window.openAccountModal) window.openAccountModal('PIONERO')" class="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 font-bold flex items-center gap-1 transition-all">🚀 Crear Cuenta</button>
          <button class="quick-pill shrink-0 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-cyan-950 text-cyan-300 border border-slate-800 hover:border-cyan-700 transition-all" data-msg="Quiero información sobre el Gemelo Digital 3D">📦 Gemelo 3D</button>
          <button class="quick-pill shrink-0 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-cyan-950 text-cyan-300 border border-slate-800 hover:border-cyan-700 transition-all" data-msg="¿Cómo funciona el Programa Pioneros (50% de por vida)?">💎 Programa Pioneros</button>
          <button class="quick-pill shrink-0 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-cyan-950 text-cyan-300 border border-slate-800 hover:border-cyan-700 transition-all" data-msg="Quiero coordinar una reunión o cotización formal">👤 Hablar con Ejecutivo</button>
        </div>

        <!-- Input Bar -->
        <form id="chatForm" class="p-3 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2">
          <input 
            type="text" 
            id="chatInput" 
            placeholder="Escribe tu consulta o datos aquí..." 
            autocomplete="off"
            class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
          />
          <button 
            type="submit" 
            id="chatSendBtn"
            class="p-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 shadow-md shadow-cyan-600/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
            </svg>
          </button>
        </form>
      `;

      document.body.appendChild(triggerBtn);
      document.body.appendChild(chatModal);

      this.triggerBtn = triggerBtn;
      this.chatModal = chatModal;
      this.messagesContainer = document.getElementById('chatMessages');
      this.chatInput = document.getElementById('chatInput');
      this.chatForm = document.getElementById('chatForm');

      this.bindUIEvents();
    }

    bindUIEvents() {
      this.triggerBtn.addEventListener('click', () => this.toggleChat());
      document.getElementById('closeChatBtn').addEventListener('click', () => this.toggleChat());

      // Envío de mensaje
      this.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.chatInput.value.trim();
        if (text && !this.isBusy) {
          this.sendMessage(text);
          this.chatInput.value = '';
        }
      });

      // Quick pills
      document.querySelectorAll('.quick-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
          const msg = btn.getAttribute('data-msg');
          if (msg && !this.isBusy) {
            this.sendMessage(msg);
          }
        });
      });
    }

    toggleChat() {
      this.isOpen = !this.isOpen;
      if (this.isOpen) {
        this.chatModal.classList.remove('hidden');
        setTimeout(() => this.chatInput.focus(), 100);
      } else {
        this.chatModal.classList.add('hidden');
      }
    }

    updateHeaderBadge() {
      const banner = document.getElementById('escalationBanner');
      if (this.isEscalated && banner) {
        banner.classList.remove('hidden');
      }
    }

    appendMessage(text, isUser = false) {
      const row = document.createElement('div');
      row.className = isUser ? 'flex justify-end' : 'flex gap-2.5 items-start';

      const bubble = document.createElement('div');
      if (isUser) {
        bubble.className = 'p-3 rounded-2xl rounded-tr-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white max-w-[85%] leading-relaxed shadow-md shadow-blue-900/30';
        bubble.textContent = text;
      } else {
        bubble.className = 'p-3 rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800/80 max-w-[85%] leading-relaxed text-slate-200';
        bubble.innerHTML = this.formatMarkdown(text);
      }

      if (isUser) {
        row.appendChild(bubble);
      } else {
        const avatar = document.createElement('div');
        avatar.className = 'w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shrink-0 text-[10px] font-bold';
        avatar.textContent = 'IA';
        row.appendChild(avatar);
        row.appendChild(bubble);
      }

      this.messagesContainer.appendChild(row);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    showTyping() {
      const row = document.createElement('div');
      row.id = 'chatTypingIndicator';
      row.className = 'flex gap-2.5 items-start my-1';
      row.innerHTML = `
        <div class="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 shrink-0 text-[10px] font-bold">IA</div>
        <div class="p-3 rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800/80 text-slate-300 flex items-center gap-2 text-xs">
          <span class="flex gap-1 items-center">
            <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style="animation-delay: 0.2s"></span>
            <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style="animation-delay: 0.4s"></span>
          </span>
          <span class="text-[11px] text-cyan-300 font-medium">CalcuSuiteIA Copilot está escribiendo...</span>
        </div>
      `;
      this.messagesContainer.appendChild(row);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    hideTyping() {
      const indicator = document.getElementById('chatTypingIndicator');
      if (indicator) indicator.remove();
    }

    formatMarkdown(text) {
      if (!text) return '';
      let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      // Negrita **texto**
      escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
      // Enlaces markdown [texto](url)
      escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-cyan-400 underline hover:text-cyan-300">$1</a>');
      // Saltos de línea
      escaped = escaped.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
      return escaped;
    }

    appendNetworkRetryMessage(failedText) {
      const row = document.createElement('div');
      row.className = 'flex gap-2.5 items-start my-2';
      row.innerHTML = `
        <div class="w-7 h-7 rounded-lg bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400 shrink-0 text-[10px] font-bold">⚠️</div>
        <div class="p-3 rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800/80 max-w-[85%] text-xs leading-relaxed text-slate-300">
          <p class="mb-2">Parece haber una intermitencia temporal en la red. Puedes reintentar enviar tu consulta o contactarnos directamente por WhatsApp:</p>
          <div class="flex flex-wrap gap-2 mt-2">
            <button id="retryWebchatBtn" class="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700 text-[11px] font-semibold transition-all">
              🔄 Reintentar
            </button>
            <a href="https://wa.me/59894858791?text=${encodeURIComponent('Hola CalcuSuiteIA, tengo una consulta sobre la suite: ' + failedText)}" target="_blank" rel="noopener" class="px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 text-[11px] font-semibold flex items-center gap-1 transition-all">
              💬 Abrir WhatsApp
            </a>
          </div>
        </div>
      `;
      this.messagesContainer.appendChild(row);
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

      const retryBtn = row.querySelector('#retryWebchatBtn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          row.remove();
          this.sendMessage(failedText);
        });
      }
    }

    async sendMessage(text) {
      this.appendMessage(text, true);
      this.isBusy = true;
      this.showTyping();

      const payload = {
        session_id: this.sessionId,
        visitor_name: this.knownFields.full_name || null,
        visitor_email: this.knownFields.email || null,
        visitor_phone: this.knownFields.phone || null,
        company_name: this.knownFields.company_name || null,
        message: text,
        page_metrics: window.CalcuTelemetry.getMetrics(),
        known_fields: this.knownFields,
      };

      let reply = null;

      // Intento por lista de endpoints
      for (const endpoint of WEBCHAT_CONFIG.endpoints) {
        try {
          const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (resp.ok) {
            const data = await resp.json();
            reply = data.reply;
            if (data.known_fields) {
              this.saveKnownFields(data.known_fields);
            }
            if (data.is_escalated || data.was_promoted) {
              this.isEscalated = true;
              this.updateHeaderBadge();
            }
            break;
          }
        } catch {}
      }

      this.hideTyping();
      this.isBusy = false;

      if (reply) {
        this.appendMessage(reply, false);
      } else {
        // En caso de corte total de conectividad, ofrecer reintento interactivo
        this.appendNetworkRetryMessage(text);
      }
    }
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.CalcuChat = new CalcuWebChatUI();
    });
  } else {
    window.CalcuChat = new CalcuWebChatUI();
  }
})();
