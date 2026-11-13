/**
 * CalcuSuiteIA (CSIA) — Widget Corporativo de WebChat IA & Telemetría B2B
 * - Pre-Chat Gate Obligatorio (Nombre, Teléfono/WhatsApp, Correo, Empresa) -> CERO campos null
 * - Memoria Slot-Filling sin redundancia (sincronizada en localStorage: csia_visitor_profile & csia_known_fields)
 * - Telemetría de comportamiento web en tiempo real (tiempo en sitio, scroll, página activa, clics)
 * - Avance automático de etapa en el Kanban CRM y recepción de mensajes de operador humano en vivo
 */

(function () {
  'use strict';

  const CONFIG = {
    primaryEndpoint: 'https://app.calcusuiteia.com/api/v1/public/webchat',
    leadsEndpoint: 'https://app.calcusuiteia.com/api/v1/public/leads',
    localEndpoints: [
      'http://127.0.0.1:8080/api/v1/public/webchat',
      'http://localhost:8080/api/v1/public/webchat',
      'http://127.0.0.1:8000/api/v1/public/webchat',
      'http://localhost:8000/api/v1/public/webchat',
    ],
    localLeadsEndpoints: [
      'http://127.0.0.1:8080/api/v1/public/leads',
      'http://localhost:8080/api/v1/public/leads',
      'http://127.0.0.1:8000/api/v1/public/leads',
      'http://localhost:8000/api/v1/public/leads',
    ],
    contactEmail: 'contacto@calcusuiteia.com',
    appPortalUrl: 'https://app.calcusuiteia.com',
  };

  function getActiveChatEndpoints() {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return [...CONFIG.localEndpoints, CONFIG.primaryEndpoint];
    }
    return [CONFIG.primaryEndpoint];
  }

  function getActiveLeadsEndpoints() {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return [...CONFIG.localLeadsEndpoints, CONFIG.leadsEndpoint];
    }
    return [CONFIG.leadsEndpoint];
  }

  // --- 1. Motor de Telemetría de Navegación ---
  class PageTelemetryTracker {
    constructor() {
      this.startTime = Date.now();
      this.maxScrollPct = 0;
      this.ctaClicksCount = 0;
      this.pagesVisited = this.loadPagesVisited();
      this.initListeners();
    }

    loadPagesVisited() {
      try {
        const raw = sessionStorage.getItem('csia_pages_visited');
        const list = raw ? JSON.parse(raw) : [];
        const current = window.location.pathname || '/';
        if (!list.includes(current)) {
          list.push(current);
          sessionStorage.setItem('csia_pages_visited', JSON.stringify(list));
        }
        return list;
      } catch {
        return [window.location.pathname || '/'];
      }
    }

    initListeners() {
      window.addEventListener(
        'scroll',
        () => {
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          const docHeight =
            document.documentElement.scrollHeight - document.documentElement.clientHeight;
          if (docHeight > 0) {
            const pct = Math.min(100, Math.round((scrollTop / docHeight) * 100));
            if (pct > this.maxScrollPct) this.maxScrollPct = pct;
          }
        },
        { passive: true }
      );

      document.addEventListener('click', (e) => {
        const target = e.target.closest('a, button');
        if (target) {
          this.ctaClicksCount += 1;
        }
      });
    }

    getSnapshot() {
      const elapsedSeconds = Math.round((Date.now() - this.startTime) / 1000);
      return {
        current_page: window.location.pathname || '/',
        page_title: document.title,
        time_on_site_seconds: elapsedSeconds,
        scroll_depth_pct: this.maxScrollPct,
        cta_clicks: this.ctaClicksCount,
        pages_visited: this.pagesVisited,
        referrer: document.referrer || 'direct',
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // --- 2. Controlador del Widget de WebChat IA con Pre-Chat Gate Obligatorio ---
  class CalcuWebChatWidget {
    constructor(telemetry) {
      this.sanitizeStorage();
      this.telemetry = telemetry;
      this.sessionId = this.getOrCreateSessionId();
      this.knownFields = this.loadKnownFields();
      this.isOpen = false;
      this.isSending = false;
      this.pendingQuickMessage = null;
      this.lastSyncedMessageId = 0;
      this.seenHumanMessageIds = new Set();
      this.syncTimer = null;
      this.renderWidget();
      this.bindPageForms();
      this.startHumanReplySync();
    }

    sanitizeStorage() {
      const legacyKeys = [
        'csia_webchat_session_id',
        'csia_known_fields',
        'csia_visitor_profile',
        'calcu_lead_data',
        'calcu_visitor_name',
        'calcu_visitor_email',
        'calcu_visitor_phone',
        'calcu_visitor_company',
        'calcu_prospect_info'
      ];
      try {
        legacyKeys.forEach((k) => localStorage.removeItem(k));
      } catch (e) {}
    }

    clearAndResetSession() {
      try {
        sessionStorage.removeItem('csia_webchat_session_id');
        sessionStorage.removeItem('csia_known_fields');
        sessionStorage.removeItem('csia_visitor_profile');
        sessionStorage.removeItem('csia_pages_visited');
      } catch (e) {}
      this.knownFields = {};
      this.sessionId = this.getOrCreateSessionId();
      this.seenHumanMessageIds.clear();
      this.lastSyncedMessageId = 0;

      const msgContainer = document.getElementById('csiaChatMessages');
      if (msgContainer) {
        const { clear, el } = window.csiaDom;
        clear(msgContainer);
        msgContainer.appendChild(
          el('div', { className: 'flex items-start gap-2.5' },
            el('div', { className: 'w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold shrink-0', text: 'IA' }),
            el('div', { id: 'csiaWelcomeBubble', className: 'bg-slate-800/90 border border-slate-700/70 text-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 leading-relaxed shadow-sm' },
              '¡Sesión reiniciada y datos efímeros eliminados! Soy el asistente ejecutivo de ',
              el('strong', { text: 'CalcuSuiteIA' }),
              '. ¿Qué módulo te gustaría consultar hoy?'
            )
          )
        );
      }
      this.populateGateInputs();
      this.syncGateVisibility();
      this.updateProfileBadge();
    }

    getOrCreateSessionId() {
      try {
        let sid = sessionStorage.getItem('csia_webchat_session_id');
        if (!sid) {
          sid =
            'web-' +
            ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
              (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
            );
          sessionStorage.setItem('csia_webchat_session_id', sid);
        }
        return sid;
      } catch {
        return 'web-anon-' + Math.random().toString(36).substring(2, 11);
      }
    }

    loadKnownFields() {
      let merged = {};
      try {
        const rawKnown = sessionStorage.getItem('csia_known_fields');
        if (rawKnown) {
          merged = { ...merged, ...JSON.parse(rawKnown) };
        }
      } catch {}
      try {
        const rawProfile = sessionStorage.getItem('csia_visitor_profile');
        if (rawProfile) {
          const parsedProfile = JSON.parse(rawProfile);
          merged = { ...merged, ...parsedProfile };
        }
      } catch {}
      return merged;
    }

    hasCompleteIdentity() {
      const f = this.knownFields || {};
      const hasName = Boolean(f.full_name && String(f.full_name).trim().length >= 2);
      const hasPhone = Boolean(f.phone && String(f.phone).trim().length >= 6);
      const hasEmail = Boolean(
        f.email && String(f.email).includes('@') && String(f.email).trim().length >= 5
      );
      const hasCompany = Boolean(f.company_name && String(f.company_name).trim().length >= 2);
      return hasName && hasPhone && hasEmail && hasCompany;
    }

    saveKnownFields(newFields) {
      if (!newFields || typeof newFields !== 'object') return;
      const clean = {};
      Object.entries(newFields).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== '') {
          clean[k] = String(v).trim();
        }
      });
      this.knownFields = { ...this.knownFields, ...clean };
      try {
        sessionStorage.setItem('csia_known_fields', JSON.stringify(this.knownFields));
        const profilePayload = {
          full_name: this.knownFields.full_name || '',
          phone: this.knownFields.phone || '',
          email: this.knownFields.email || '',
          company_name: this.knownFields.company_name || '',
        };
        sessionStorage.setItem('csia_visitor_profile', JSON.stringify(profilePayload));
      } catch {}
      this.updateProfileBadge();
      this.syncGateVisibility();
    }

    renderWidget() {
      const { el, svg } = window.csiaDom;
      const gateField = (label, id, type, autocomplete, placeholder) =>
        el('div', null,
          el('label', { className: 'block text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1', text: label }),
          el('input', {
            id, type, autocomplete, required: true, placeholder,
            className: 'w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500'
          })
        );
      const quickPills = (cls) => [
        ['Quiero evaluar el Gemelo Digital 3D para mi depósito', 'text-cyan-300', '📦 Gemelo 3D'],
        ['Me interesa el Programa Pioneros con 6 meses gratis y 50% vitalicio', 'text-emerald-300', '💎 Programa Pioneros'],
        ['Quiero hablar con un asesor para agendar una demo corporativa', 'text-amber-300', '👤 Hablar con Ejecutivo'],
      ].map(p => el('button', {
        type: 'button',
        'data-quick-msg': p[0],
        className: `csia-quick-pill ${cls} px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 ${p[1]} border border-slate-700 transition-colors`,
        text: p[2]
      }));

      const container = el('div', { id: 'csia-webchat-root' },
        el('button', {
          id: 'csiaChatToggleBtn',
          'aria-label': 'Abrir WebChat IA CalcuSuiteIA',
          className: 'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white font-bold text-xs shadow-2xl shadow-cyan-500/30 hover:scale-[1.03] active:scale-95 transition-all border border-cyan-300/30'
        },
          el('span', { className: 'relative flex h-3 w-3' },
            el('span', { className: 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75' }),
            el('span', { className: 'relative inline-flex rounded-full h-3 w-3 bg-emerald-400' })
          ),
          svg('0 0 24 24', 'w-5 h-5', ['M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z']),
          el('span', { text: 'Asesor IA En Línea' })
        ),
        el('div', {
          id: 'csiaChatWindow',
          className: 'fixed bottom-24 right-6 z-50 hidden w-[390px] max-w-[calc(100vw-2rem)] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex-col',
          style: 'height: 560px; max-height: calc(100vh - 7.5rem);'
        },
          el('div', { className: 'px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/80 flex items-center justify-between' },
            el('div', { className: 'flex items-center gap-3' },
              el('div', { className: 'w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xs shadow-md border border-white/15' },
                'CS', el('span', { className: 'text-cyan-200', text: 'IA' })
              ),
              el('div', null,
                el('div', { className: 'text-sm font-bold text-white flex items-center gap-2' },
                  'Copilot Comercial B2B ',
                  el('span', { className: 'px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold', text: 'Online' })
                ),
                el('div', { className: 'text-[10px] text-cyan-400 font-medium tracking-tight', text: 'Asistente IA · Sesión efímera protegida bajo ISO 27001 y Ley N° 18.331' }),
                el('div', { id: 'csiaProfileStatusBadge', className: 'text-[11px] text-slate-400 truncate max-w-[235px]', text: 'CalcuSuiteIA • Atención Corporativa' })
              )
            ),
            el('div', { className: 'flex items-center gap-1' },
              el('button', {
                id: 'csiaResetSessionBtn',
                className: 'text-slate-400 hover:text-amber-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-xs flex items-center gap-1',
                title: 'Finalizar y Borrar Sesión',
                'aria-label': 'Finalizar y Borrar Sesión'
              }, el('span', { text: '🗑️' })),
              el('button', {
                id: 'csiaChatCloseBtn',
                className: 'text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors',
                'aria-label': 'Cerrar chat'
              }, svg('0 0 24 24', 'w-5 h-5', ['M6 18L18 6M6 6l12 12']))
            )
          ),
          el('div', { id: 'csiaPreChatGate', className: 'flex-1 overflow-y-auto p-5 bg-slate-950/85 flex flex-col justify-between' },
            el('div', null,
              el('div', { className: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold uppercase tracking-wider mb-3' },
                el('span', { text: '⚡ Atención Ejecutiva Personalizada' })
              ),
              el('h3', { className: 'text-sm font-extrabold text-white mb-1', text: 'Identificación Corporativa Rápida' }),
              el('p', { className: 'text-[11px] text-slate-400 leading-relaxed mb-3', text: 'Completa tus datos una única vez para asignarte prioridad en nuestro CRM y chatear en vivo con nuestro especialista.' }),
              el('div', { id: 'csiaGatePendingTopicBanner', className: 'hidden mb-3 px-3 py-2 rounded-xl bg-blue-950/60 border border-blue-500/40 text-[11px] text-blue-200' },
                'Consulta seleccionada: ', el('strong', { id: 'csiaGatePendingTopicText', className: 'text-white' })
              ),
              el('form', { id: 'csiaPreChatGateForm', className: 'space-y-2.5', novalidate: true },
                gateField('Nombre Completo *', 'csiaGateName', 'text', 'name', 'Ej: Martín Rodríguez'),
                gateField('Teléfono / WhatsApp *', 'csiaGatePhone', 'tel', 'tel', 'Ej: +598 99 123 456'),
                gateField('Correo Electrónico *', 'csiaGateEmail', 'email', 'email', 'nombre@empresa.com.uy'),
                gateField('Empresa / Razón Social *', 'csiaGateCompany', 'text', 'organization', 'Ej: Distribuidora del Plata S.A.'),
                el('div', { id: 'csiaGateError', className: 'hidden text-[11px] text-rose-300 bg-rose-950/60 border border-rose-500/40 rounded-xl px-3 py-2' }),
                el('button', {
                  type: 'submit',
                  className: 'w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/25 transition-all flex items-center justify-center gap-2'
                }, el('span', { text: 'Iniciar Chat con Especialista IA →' }))
              )
            ),
            el('div', { className: 'pt-3 mt-3 border-t border-slate-800/80' },
              el('div', { className: 'text-[10px] text-slate-500 mb-1.5 font-semibold', text: 'O selecciona un tema directo:' }),
              el('div', { className: 'flex flex-wrap gap-1.5' }, quickPills('text-[10px]'))
            )
          ),
          el('div', { id: 'csiaChatMessages', className: 'hidden flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/70 text-xs' },
            el('div', { className: 'flex items-start gap-2.5' },
              el('div', { className: 'w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold shrink-0', text: 'IA' }),
              el('div', { id: 'csiaWelcomeBubble', className: 'bg-slate-800/90 border border-slate-700/70 text-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 leading-relaxed shadow-sm' },
                '¡Hola! Soy el asistente ejecutivo de ', el('strong', { text: 'CalcuSuiteIA' }),
                '. ¿Qué módulo o proceso operativo te gustaría optimizar hoy (Gemelo 3D, Logística 3PL, Mercado Libre, Licitaciones ARCE o Finanzas)?'
              )
            )
          ),
          el('div', { id: 'csiaQuickPrompts', className: 'hidden px-4 py-2 bg-slate-900/90 border-t border-slate-800/80 flex gap-1.5 overflow-x-auto no-scrollbar' },
            quickPills('shrink-0 text-[11px]')
          ),
          el('form', { id: 'csiaChatForm', className: 'hidden p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2' },
            el('input', {
              id: 'csiaChatInput', type: 'text', placeholder: 'Escribe tu consulta aquí...', autocomplete: 'off',
              className: 'flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500'
            }),
            el('button', {
              type: 'submit',
              className: 'px-3.5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-colors shrink-0',
              text: 'Enviar'
            })
          )
        )
      );

      document.body.appendChild(container);
      this.updateProfileBadge();
      this.populateGateInputs();
      this.syncGateVisibility();

      const toggleBtn = document.getElementById('csiaChatToggleBtn');
      const closeBtn = document.getElementById('csiaChatCloseBtn');
      const chatForm = document.getElementById('csiaChatForm');
      const chatInput = document.getElementById('csiaChatInput');
      const gateForm = document.getElementById('csiaPreChatGateForm');

      toggleBtn.addEventListener('click', () => this.toggleChat());
      closeBtn.addEventListener('click', () => this.toggleChat(false));

      const resetBtn = document.getElementById('csiaResetSessionBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('¿Deseas finalizar la sesión y borrar de inmediato todos tus datos de este navegador?')) {
            this.clearAndResetSession();
          }
        });
      }

      if (gateForm) {
        gateForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleGateSubmit();
        });
      }

      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text || this.isSending) return;
        if (!this.hasCompleteIdentity()) {
          this.pendingQuickMessage = text;
          chatInput.value = '';
          this.syncGateVisibility();
          return;
        }
        chatInput.value = '';
        this.sendMessage(text);
      });

      container.querySelectorAll('.csia-quick-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
          const msg = btn.getAttribute('data-quick-msg');
          if (!msg) return;
          if (!this.hasCompleteIdentity()) {
            this.pendingQuickMessage = msg;
            const banner = document.getElementById('csiaGatePendingTopicBanner');
            const topicText = document.getElementById('csiaGatePendingTopicText');
            if (banner && topicText) {
              topicText.textContent = msg;
              banner.classList.remove('hidden');
            }
            const nameInput = document.getElementById('csiaGateName');
            if (nameInput) nameInput.focus();
            return;
          }
          this.sendMessage(msg);
        });
      });
    }

    populateGateInputs() {
      const f = this.knownFields || {};
      const nameEl = document.getElementById('csiaGateName');
      const phoneEl = document.getElementById('csiaGatePhone');
      const emailEl = document.getElementById('csiaGateEmail');
      const compEl = document.getElementById('csiaGateCompany');
      if (nameEl && f.full_name) nameEl.value = f.full_name;
      if (phoneEl && f.phone) phoneEl.value = f.phone;
      if (emailEl && f.email) emailEl.value = f.email;
      if (compEl && f.company_name) compEl.value = f.company_name;
    }

    syncGateVisibility() {
      const gateEl = document.getElementById('csiaPreChatGate');
      const msgsEl = document.getElementById('csiaChatMessages');
      const promptsEl = document.getElementById('csiaQuickPrompts');
      const formEl = document.getElementById('csiaChatForm');
      const welcomeEl = document.getElementById('csiaWelcomeBubble');

      if (!gateEl || !msgsEl || !promptsEl || !formEl) return;

      if (this.hasCompleteIdentity()) {
        gateEl.classList.add('hidden');
        msgsEl.classList.remove('hidden');
        promptsEl.classList.remove('hidden');
        formEl.classList.remove('hidden');
        if (welcomeEl && this.knownFields.full_name) {
          const { clear, el } = window.csiaDom;
          clear(welcomeEl);
          welcomeEl.append(
            '¡Hola ', el('strong', { text: this.knownFields.full_name }),
            '! Soy el asistente ejecutivo de ', el('strong', { text: 'CalcuSuiteIA' }),
            ' para ', el('strong', { text: this.knownFields.company_name }),
            '. ¿Qué módulo o proceso operativo te gustaría optimizar hoy?'
          );
        }
      } else {
        gateEl.classList.remove('hidden');
        msgsEl.classList.add('hidden');
        promptsEl.classList.add('hidden');
        formEl.classList.add('hidden');
        this.populateGateInputs();
      }
    }

    handleGateSubmit() {
      const nameVal = (document.getElementById('csiaGateName')?.value || '').trim();
      const phoneVal = (document.getElementById('csiaGatePhone')?.value || '').trim();
      const emailVal = (document.getElementById('csiaGateEmail')?.value || '').trim().toLowerCase();
      const companyVal = (document.getElementById('csiaGateCompany')?.value || '').trim();
      const errEl = document.getElementById('csiaGateError');

      if (nameVal.length < 2 || phoneVal.length < 6 || !emailVal.includes('@') || companyVal.length < 2) {
        if (errEl) {
          errEl.textContent =
            'Por favor completa tu Nombre, Teléfono/WhatsApp, Correo Corporativo válido y Empresa para iniciar el chat.';
          errEl.classList.remove('hidden');
        }
        return;
      }

      if (errEl) errEl.classList.add('hidden');

      this.saveKnownFields({
        full_name: nameVal,
        phone: phoneVal,
        email: emailVal,
        company_name: companyVal,
      });

      const initialMessage =
        this.pendingQuickMessage ||
        `Hola, soy ${nameVal} de la empresa ${companyVal}. Mi correo es ${emailVal} y mi WhatsApp es ${phoneVal}. Me gustaría recibir asesoramiento sobre CalcuSuiteIA.`;
      this.pendingQuickMessage = null;
      this.sendMessage(initialMessage);
    }

    updateHeaderBadge() {
      this.updateProfileBadge();
    }

    updateProfileBadge() {
      const badge = document.getElementById('csiaProfileStatusBadge');
      if (!badge) return;
      const name = this.knownFields.full_name;
      const company = this.knownFields.company_name;
      if (name && company) {
        badge.textContent = `${name} • ${company}`;
      } else if (name) {
        badge.textContent = `Sesión activa: ${name}`;
      } else {
        badge.textContent = 'CalcuSuiteIA • Atención Corporativa';
      }
    }

    toggleChat(forceState) {
      const win = document.getElementById('csiaChatWindow');
      if (!win) return;
      this.isOpen = typeof forceState === 'boolean' ? forceState : !this.isOpen;
      if (this.isOpen) {
        win.classList.remove('hidden');
        win.classList.add('flex');
        this.syncGateVisibility();
        if (this.hasCompleteIdentity()) {
          document.getElementById('csiaChatInput')?.focus();
        } else {
          document.getElementById('csiaGateName')?.focus();
        }
        this.pollHumanReplies();
      } else {
        win.classList.add('hidden');
        win.classList.remove('flex');
      }
    }

    escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    appendMessage(sender, text) {
      const container = document.getElementById('csiaChatMessages');
      if (!container) return;
      const { el, appendFormatted } = window.csiaDom;
      let row;
      if (sender === 'user') {
        row = el('div', { className: 'flex justify-end' },
          el('div', {
            className: 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[82%] leading-relaxed shadow-sm',
            text: String(text || '')
          })
        );
      } else if (sender === 'human') {
        const bubble = el('div', { className: 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%] leading-relaxed shadow-sm' },
          el('div', { className: 'text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1', text: 'Ejecutivo CalcuSuiteIA • En Vivo' })
        );
        appendFormatted(bubble, text);
        row = el('div', { className: 'flex items-start gap-2.5' },
          el('div', { className: 'w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold shrink-0', text: 'EJ' }),
          bubble
        );
      } else {
        const bubble = el('div', { className: 'bg-slate-800/90 border border-slate-700/70 text-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%] leading-relaxed shadow-sm' });
        appendFormatted(bubble, text);
        row = el('div', { className: 'flex items-start gap-2.5' },
          el('div', { className: 'w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold shrink-0', text: 'IA' }),
          bubble
        );
      }
      container.appendChild(row);
      container.scrollTop = container.scrollHeight;
    }

    async sendMessage(messageText) {
      if (!this.hasCompleteIdentity()) {
        this.pendingQuickMessage = messageText;
        this.syncGateVisibility();
        return;
      }

      this.appendMessage('user', messageText);
      this.isSending = true;

      const payload = {
        session_id: this.sessionId,
        visitor_name: this.knownFields.full_name,
        visitor_email: this.knownFields.email,
        visitor_phone: this.knownFields.phone,
        company_name: this.knownFields.company_name,
        message: messageText,
        page_metrics: this.telemetry.getSnapshot(),
        known_fields: this.knownFields,
      };

      let replyData = null;
      const endpoints = getActiveChatEndpoints();

      for (const ep of endpoints) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const resp = await fetch(ep, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (resp.ok) {
              replyData = await resp.json();
              break;
            }
          } catch (err) {
            if (attempt === 1) {
              await new Promise((r) => setTimeout(r, 400));
            }
          }
        }
        if (replyData) break;
      }

      this.isSending = false;

      if (replyData && replyData.reply) {
        const msgId = Number(replyData.message_id || replyData.last_message_id || 0);
        if (!isNaN(msgId) && msgId > 0) {
          this.lastSyncedMessageId = Math.max(this.lastSyncedMessageId, msgId);
        }
        if (replyData.known_fields) {
          this.saveKnownFields(replyData.known_fields);
        }
        this.appendMessage('ai', replyData.reply);
      }
    }

    startHumanReplySync() {
      if (this.syncTimer) clearInterval(this.syncTimer);
      this.syncTimer = setInterval(() => {
        this.pollHumanReplies();
      }, 4500);
    }

    async pollHumanReplies() {
      if (!this.sessionId || !this.hasCompleteIdentity()) return;
      const endpoints = getActiveChatEndpoints();
      for (const baseEp of endpoints) {
        const syncUrl = `${baseEp}/${encodeURIComponent(this.sessionId)}/sync?after_id=${this.lastSyncedMessageId}`;
        try {
          const resp = await fetch(syncUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });
          if (!resp.ok) continue;
          const data = await resp.json();
          if (data.known_fields && Object.keys(data.known_fields).length > 0) {
            this.saveKnownFields(data.known_fields);
          }
          const messages = Array.isArray(data.messages) ? data.messages : [];
          for (const m of messages) {
            const numericId = Number(m.id);
            if (!isNaN(numericId) && numericId > this.lastSyncedMessageId) {
              this.lastSyncedMessageId = numericId;
            }
            if (
              m.direction === 'OUTBOUND' &&
              m.sender_type !== 'AI_AGENT' &&
              (m.sender_type === 'HUMAN_AGENT' || m.is_ai_generated === false) &&
              !this.seenHumanMessageIds.has(m.id)
            ) {
              this.seenHumanMessageIds.add(m.id);
              this.appendMessage('human', m.content || m.message_text || '');
              if (!this.isOpen) {
                this.toggleChat(true);
              }
            }
          }
          break;
        } catch {
          // Silencioso en polling
        }
      }
    }

    // --- 3. Conexión de Formularios Web al Backend + Memoria del Chat ---
    bindPageForms() {
      const forms = document.querySelectorAll('form[data-csia-lead-form], #leadCaptureForm');
      forms.forEach((form) => {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const submitBtn = form.querySelector('button[type="submit"]');
          const statusBox = form.querySelector('.csia-form-status') || document.getElementById('leadFormStatus');

          const fd = new FormData(form);
          const honeypot = fd.get('website_url') || fd.get('honeypot') || '';
          if (honeypot) return;

          const leadPayload = {
            nombre: (fd.get('nombre') || '').toString().trim(),
            empresa: (fd.get('empresa') || '').toString().trim(),
            email: (fd.get('email') || '').toString().trim(),
            telefono: (fd.get('telefono') || '').toString().trim(),
            interes: (fd.get('interes') || 'Demo Completa Enterprise').toString().trim(),
            operation_scale: (fd.get('operation_scale') || '').toString().trim(),
            mensaje: (fd.get('mensaje') || '').toString().trim(),
            page_metrics: this.telemetry.getSnapshot(),
          };

          this.saveKnownFields({
            full_name: leadPayload.nombre,
            company_name: leadPayload.empresa,
            email: leadPayload.email,
            phone: leadPayload.telefono,
            interest_module: leadPayload.interes,
            operation_scale: leadPayload.operation_scale,
          });

          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.originalText = submitBtn.textContent;
            submitBtn.textContent = 'Procesando y asignando ejecutivo...';
          }

          let ok = false;
          const leadsEndpoints = getActiveLeadsEndpoints();
          for (const ep of leadsEndpoints) {
            try {
              const resp = await fetch(ep, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': 'application/json' },
                body: JSON.stringify(leadPayload),
              });
              if (resp.ok) {
                ok = true;
                break;
              }
            } catch {}
          }

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText || 'Solicitar Demo Corporativa';
          }

          if (statusBox) {
            const { clear, el } = window.csiaDom;
            clear(statusBox);
            statusBox.classList.remove('hidden');
            if (ok) {
              statusBox.className =
                'csia-form-status mt-4 p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs leading-relaxed';
              statusBox.append(
                el('strong', { text: '✅ ¡Solicitud registrada y priorizada en nuestro CRM!' }), el('br'),
                'Gracias ', el('strong', { text: leadPayload.nombre }),
                '. Un ejecutivo senior ya tiene asignada la ficha de ', el('strong', { text: leadPayload.empresa }),
                ' y se comunicará a ', el('strong', { text: leadPayload.email }), '.'
              );
              form.reset();
            } else {
              statusBox.className =
                'csia-form-status mt-4 p-4 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-200 text-xs leading-relaxed';
              statusBox.append(
                el('strong', { text: `✅ Datos guardados en tu sesión corporativa (${leadPayload.empresa}).` }), el('br'),
                'Puedes continuar la conversación directamente en nuestro WebChat IA o escribirnos a ',
                el('a', { className: 'underline font-bold', href: `mailto:${CONFIG.contactEmail}`, text: CONFIG.contactEmail }), '.'
              );
            }
          }
        });
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const telemetry = new PageTelemetryTracker();
    window.CalcuChat = new CalcuWebChatWidget(telemetry);
  });
})();
