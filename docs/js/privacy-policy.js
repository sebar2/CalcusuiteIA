/**
 * ==========================================================================
 * CALCUSUITEIA — MÓDULO LEGAL, PRIVACIDAD LEY N° 18.331 & COOKIE CONSENT
 * Conformidad con URCDP (Uruguay) e ISO/IEC 27001:2022
 * Sede operativa: Montevideo, Uruguay • contacto@calcusuiteia.com
 * ==========================================================================
 */

(function () {
  'use strict';

  const CONSENT_KEY = 'calcu_cookie_consent_status';

  function initPrivacyAndCookies() {
    // 1. Inyectar Modal de Política de Privacidad en el DOM
    injectPrivacyModal();

    // 2. Verificar consentimiento de Cookies
    let consent = null;
    try {
      consent = localStorage.getItem(CONSENT_KEY);
    } catch (e) {}

    if (!consent) {
      injectCookieBanner();
    }
  }

  function injectCookieBanner() {
    if (document.getElementById('csiaCookieBanner')) return;
    const { el } = window.csiaDom;

    const banner = el('div', {
      id: 'csiaCookieBanner',
      className: 'fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-5 bg-slate-900/95 backdrop-blur-xl border-t border-cyan-500/30 shadow-2xl transition-all duration-300'
    },
      el('div', { className: 'max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4' },
        el('div', { className: 'space-y-1.5 flex-1 pr-2' },
          el('div', { className: 'flex items-center gap-2 flex-wrap' },
            el('span', { className: 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30', text: '🛡️ ISO/IEC 27001:2022' }),
            el('span', { className: 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30', text: '⚖️ Ley N° 18.331 (URCDP · Uruguay)' })
          ),
          el('p', { className: 'text-xs text-slate-300 leading-relaxed' },
            'Utilizamos almacenamiento de sesión estrictamente técnico y cookies esenciales para garantizar la seguridad (ISO 27001) y el funcionamiento de CalcuSuiteIA. Conforme a la ',
            el('strong', { text: 'Ley N° 18.331 de Protección de Datos Personales (Uruguay)' }),
            ', tus datos no se venden ni ceden a terceros.'
          )
        ),
        el('div', { className: 'flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap' },
          el('button', { type: 'button', 'data-on-click': '[["call","openPrivacyModal",[]]]', className: 'text-xs text-cyan-400 hover:text-cyan-300 underline font-semibold px-2 py-1.5', text: 'Política de Privacidad y Uso de Datos' }),
          el('button', { type: 'button', 'data-on-click': '[["call","handleCookieChoice",["essential_only"]]]', className: 'px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all', text: 'Solo Esenciales' }),
          el('button', { type: 'button', 'data-on-click': '[["call","handleCookieChoice",["accepted_all"]]]', className: 'px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20 transition-all', text: 'Aceptar y Continuar' })
        )
      )
    );

    document.body.appendChild(banner);
  }

  function handleCookieChoice(choice) {
    try {
      localStorage.setItem(CONSENT_KEY, choice);
    } catch (e) {}

    const banner = document.getElementById('csiaCookieBanner');
    if (banner) {
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(100%)';
      setTimeout(() => banner.remove(), 300);
    }
  }

  function injectPrivacyModal() {
    if (document.getElementById('csiaPrivacyModal')) return;
    const { el } = window.csiaDom;

    const modal = el('div', {
      id: 'csiaPrivacyModal',
      className: 'fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md hidden items-center justify-center p-3 sm:p-6 overflow-y-auto',
      on: { click: function (e) { if (e.target === modal) closePrivacyModal(); } }
    },
      el('div', {
        className: 'relative w-full max-w-3xl bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-2xl p-6 sm:p-8 my-auto overflow-hidden text-slate-200',
        'data-on-click': '[["stop"]]'
      },
        el('div', { className: 'flex items-center justify-between pb-4 border-b border-slate-800' },
          el('div', { className: 'flex items-center gap-3' },
            el('div', { className: 'w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-lg font-bold', text: '📜' }),
            el('div', null,
              el('h3', { className: 'text-base font-bold text-white', text: 'Política de Privacidad y Tratamiento de Datos Personales' }),
              el('p', { className: 'text-xs text-slate-400', text: 'CalcuSuiteIA • Montevideo, Uruguay • Ley N° 18.331 y URCDP' })
            )
          ),
          el('button', { 'data-on-click': '[["call","closePrivacyModal",[]]]', className: 'text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors', 'aria-label': 'Cerrar modal', text: '✕' })
        ),
        el('div', { className: 'py-5 space-y-4 max-h-[65vh] overflow-y-auto text-xs leading-relaxed text-slate-300 pr-2' },
          el('div', { className: 'p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1' },
            el('span', { className: 'font-bold text-cyan-300 text-sm', text: '🏛️ Responsable del Tratamiento y Sede Operativa' }),
            el('p', null,
              'El responsable del tratamiento de los datos es ', el('strong', { text: 'CalcuSuiteIA' }),
              ', con sede operativa en Montevideo, República Oriental del Uruguay. Canal oficial de atención y ejercicio de derechos ARCO: ',
              el('a', { href: 'mailto:contacto@calcusuiteia.com', className: 'text-cyan-400 underline font-semibold', text: 'contacto@calcusuiteia.com' }), '.'
            )
          ),
          el('div', { className: 'space-y-2' },
            el('h4', { className: 'font-bold text-white text-sm', text: '1. Principio de Volatilidad Total y Seguridad de Sesión' }),
            el('p', { text: 'En estricto apego a las directivas de seguridad perimetral ISO/IEC 27001:2022 y al principio de minimización de datos:' }),
            el('ul', { className: 'list-disc pl-5 space-y-1.5 text-slate-300' },
              el('li', null, el('strong', { text: 'Volatilidad al cerrar pestaña:' }), ' Los datos de consultas interactivas, telemetría temporal de navegación e identificadores del chat corporativo se almacenan exclusivamente en ', el('code', { text: 'sessionStorage' }), '. Al cerrar la pestaña o ventana del navegador, todos los identificadores de sesión efímera son destruidos automáticamente de tu equipo.'),
              el('li', null, el('strong', { text: 'Saneamiento de dispositivos compartidos:' }), ' Nuestra plataforma ejecuta una rutina de purga activa en cada inicio para erradicar cualquier registro previo de datos en memorias persistentes locales.')
            )
          ),
          el('div', { className: 'p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200' },
            el('strong', { text: 'Garantía de Confidencialidad:' }), ' CalcuSuiteIA no comercializa, transfiere ni cede bajo ninguna circunstancia bases de datos ni información comercial a redes publicitarias o terceros ajenos al servicio.'
          ),
          el('div', { className: 'space-y-2' },
            el('h4', { className: 'font-bold text-white text-sm', text: '2. Finalidad del Tratamiento de Datos Comerciales y Demos' }),
            el('p', { text: 'Los datos recolectados en el formulario de solicitud de acceso guiado o demo (nombre, empresa, teléfono y correo electrónico) son procesados con la única finalidad de:' }),
            el('ul', { className: 'list-disc pl-5 space-y-1 text-slate-300' },
              el('li', { text: 'Proveer credenciales sandbox y coordinar sesiones de evaluación técnica del ERP/WMS.' }),
              el('li', { text: 'Atender requerimientos comerciales solicitados expresamente por el titular.' }),
              el('li', { text: 'Generar auditorías de seguridad perimetral y trazabilidad de acceso conforme a normativas de prevención de fraude.' })
            )
          ),
          el('div', { className: 'space-y-2' },
            el('h4', { className: 'font-bold text-white text-sm', text: '3. Ejercicio de Derechos ARCO (Ley N° 18.331)' }),
            el('p', null, 'El titular de los datos personales puede ejercer en cualquier momento sus derechos de ', el('strong', { text: 'Acceso, Rectificación, Cancelación y Oposición (ARCO)' }), ' remitiendo una solicitud formal a:'),
            el('div', { className: 'p-3 rounded-xl bg-slate-950/70 border border-slate-800' },
              el('strong', { text: 'Canal Formal:' }), ' ', el('a', { href: 'mailto:contacto@calcusuiteia.com', className: 'text-cyan-400 underline font-semibold', text: 'contacto@calcusuiteia.com' }), el('br'),
              el('strong', { text: 'Asunto:' }), ' ', el('em', { text: '"Ejercicio Derechos ARCO — Ley 18.331"' }), el('br'),
              el('strong', { text: 'Organismo de Control:' }), ' Unidad Reguladora y de Control de Datos Personales (URCDP - Uruguay).'
            )
          )
        ),
        el('div', { className: 'pt-4 border-t border-slate-800 flex items-center justify-between' },
          el('span', { className: 'text-[11px] text-slate-500', text: 'Versión 1.4 • Conforme a ISO 27001 & Ley N° 18.331' }),
          el('button', { 'data-on-click': '[["call","closePrivacyModal",[]]]', className: 'px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 transition-all', text: 'Entendido y Cerrar' })
        )
      )
    );

    document.body.appendChild(modal);
  }

  function openPrivacyModal() {
    const modal = document.getElementById('csiaPrivacyModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  function closePrivacyModal() {
    const modal = document.getElementById('csiaPrivacyModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  // Exportar al scope global
  window.openPrivacyModal = openPrivacyModal;
  window.closePrivacyModal = closePrivacyModal;
  window.handleCookieChoice = handleCookieChoice;

  // Auto-iniciar al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPrivacyAndCookies);
  } else {
    initPrivacyAndCookies();
  }
})();
