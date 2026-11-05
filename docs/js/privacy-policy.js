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

    const banner = document.createElement('div');
    banner.id = 'csiaCookieBanner';
    banner.className =
      'fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-5 bg-slate-900/95 backdrop-blur-xl border-t border-cyan-500/30 shadow-2xl transition-all duration-300';
    banner.innerHTML = `
      <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div class="space-y-1.5 flex-1 pr-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              🛡️ ISO/IEC 27001:2022
            </span>
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
              ⚖️ Ley N° 18.331 (URCDP · Uruguay)
            </span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">
            Utilizamos almacenamiento de sesión estrictamente técnico y cookies esenciales para garantizar la seguridad (ISO 27001) y el funcionamiento de CalcuSuiteIA. Conforme a la <strong>Ley N° 18.331 de Protección de Datos Personales (Uruguay)</strong>, tus datos no se venden ni ceden a terceros.
          </p>
        </div>
        <div class="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          <button type="button" onclick="openPrivacyModal()" class="text-xs text-cyan-400 hover:text-cyan-300 underline font-semibold px-2 py-1.5">
            Política de Privacidad y Uso de Datos
          </button>
          <button type="button" onclick="handleCookieChoice('essential_only')" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all">
            Solo Esenciales
          </button>
          <button type="button" onclick="handleCookieChoice('accepted_all')" class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20 transition-all">
            Aceptar y Continuar
          </button>
        </div>
      </div>
    `;

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

    const modal = document.createElement('div');
    modal.id = 'csiaPrivacyModal';
    modal.className =
      'fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md hidden items-center justify-center p-3 sm:p-6 overflow-y-auto';
    modal.onclick = function (e) {
      if (e.target === modal) closePrivacyModal();
    };

    modal.innerHTML = `
      <div class="relative w-full max-w-3xl bg-slate-900 border border-cyan-500/30 rounded-3xl shadow-2xl p-6 sm:p-8 my-auto overflow-hidden text-slate-200" onclick="event.stopPropagation()">
        <!-- Header -->
        <div class="flex items-center justify-between pb-4 border-b border-slate-800">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-lg font-bold">
              📜
            </div>
            <div>
              <h3 class="text-base font-bold text-white">Política de Privacidad y Tratamiento de Datos Personales</h3>
              <p class="text-xs text-slate-400">CalcuSuiteIA • Montevideo, Uruguay • Ley N° 18.331 y URCDP</p>
            </div>
          </div>
          <button onclick="closePrivacyModal()" class="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors" aria-label="Cerrar modal">
            ✕
          </button>
        </div>

        <!-- Body -->
        <div class="py-5 space-y-4 max-h-[65vh] overflow-y-auto text-xs leading-relaxed text-slate-300 pr-2">
          <div class="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
            <span class="font-bold text-cyan-300 text-sm">🏛️ Responsable del Tratamiento y Sede Operativa</span>
            <p>
              El responsable del tratamiento de los datos es <strong>CalcuSuiteIA</strong>, con sede operativa en Montevideo, República Oriental del Uruguay. Canal oficial de atención y ejercicio de derechos ARCO: <a href="mailto:contacto@calcusuiteia.com" class="text-cyan-400 underline font-semibold">contacto@calcusuiteia.com</a>.
            </p>
          </div>

          <div class="space-y-2">
            <h4 class="font-bold text-white text-sm">1. Principio de Volatilidad Total y Seguridad de Sesión</h4>
            <p>
              En estricto apego a las directivas de seguridad perimetral ISO/IEC 27001:2022 y al principio de minimización de datos:
            </p>
            <ul class="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>
                <strong>Volatilidad al cerrar pestaña:</strong> Los datos de consultas interactivas, telemetría temporal de navegación e identificadores del chat corporativo se almacenan exclusivamente en <code>sessionStorage</code>. Al cerrar la pestaña o ventana del navegador, todos los identificadores de sesión efímera son destruidos automáticamente de tu equipo.
              </li>
              <li>
                <strong>Saneamiento de dispositivos compartidos:</strong> Nuestra plataforma ejecuta una rutina de purga activa en cada inicio para erradicar cualquier registro previo de datos en memorias persistentes locales.
              </li>
            </ul>
          </div>

          <div class="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200">
            <strong>Garantía de Confidencialidad:</strong> CalcuSuiteIA no comercializa, transfiere ni cede bajo ninguna circunstancia bases de datos ni información comercial a redes publicitarias o terceros ajenos al servicio.
          </div>

          <div class="space-y-2">
            <h4 class="font-bold text-white text-sm">2. Finalidad del Tratamiento de Datos Comerciales y Demos</h4>
            <p>
              Los datos recolectados en el formulario de solicitud de acceso guiado o demo (nombre, empresa, teléfono y correo electrónico) son procesados con la única finalidad de:
            </p>
            <ul class="list-disc pl-5 space-y-1 text-slate-300">
              <li>Proveer credenciales sandbox y coordinar sesiones de evaluación técnica del ERP/WMS.</li>
              <li>Atender requerimientos comerciales solicitados expresamente por el titular.</li>
              <li>Generar auditorías de seguridad perimetral y trazabilidad de acceso conforme a normativas de prevención de fraude.</li>
            </ul>
          </div>

          <div class="space-y-2">
            <h4 class="font-bold text-white text-sm">3. Ejercicio de Derechos ARCO (Ley N° 18.331)</h4>
            <p>
              El titular de los datos personales puede ejercer en cualquier momento sus derechos de <strong>Acceso, Rectificación, Cancelación y Oposición (ARCO)</strong> remitiendo una solicitud formal a:
            </p>
            <div class="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <strong>Canal Formal:</strong> <a href="mailto:contacto@calcusuiteia.com" class="text-cyan-400 underline font-semibold">contacto@calcusuiteia.com</a><br/>
              <strong>Asunto:</strong> <em>"Ejercicio Derechos ARCO — Ley 18.331"</em><br/>
              <strong>Organismo de Control:</strong> Unidad Reguladora y de Control de Datos Personales (URCDP - Uruguay).
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="pt-4 border-t border-slate-800 flex items-center justify-between">
          <span class="text-[11px] text-slate-500">Versión 1.4 • Conforme a ISO 27001 & Ley N° 18.331</span>
          <button onclick="closePrivacyModal()" class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 transition-all">
            Entendido y Cerrar
          </button>
        </div>
      </div>
    `;

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
