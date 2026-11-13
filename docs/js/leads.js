/**
 * ==========================================================================
 * CALCU SUITE 2026 - MODULO DE CAPTURA DE LEADS Y PROSPECCION
 * Comunicacion con FastAPI (/api/v1/public/leads), telemetria web,
 * honeypot anti-spam y contacto directo (contacto@calcusuiteia.com)
 * ==========================================================================
 */

const isLocalDev =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const LEADS_CONFIG = {
  directEmail: "contacto@calcusuiteia.com",
  directWhatsapp: "59894858791",
  endpoints: isLocalDev
    ? [
        "http://127.0.0.1:8000/api/v1/public/leads",
        "http://localhost:8000/api/v1/public/leads",
        "https://app.calcusuiteia.com/api/v1/public/leads"
      ]
    : ["https://app.calcusuiteia.com/api/v1/public/leads"]
};

/**
 * Procesa el envio del formulario de solicitud de demo
 * @param {Event} event 
 */
async function handleLeadSubmit(event) {
  event.preventDefault();

  const form = document.getElementById('leadForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const alertBox = document.getElementById('formAlert');

  // 1. Verificacion de Consentimiento Obligatorio Ley N° 18.331 (Uruguay)
  const consentCheckbox = document.getElementById('consentLey18331');
  if (consentCheckbox && !consentCheckbox.checked) {
    if (alertBox) {
      alertBox.className = 'mb-6 p-4 rounded-xl text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 block';
      alertBox.textContent = '⚠️ Debes aceptar la Política de Privacidad conforme a la Ley N° 18.331 para continuar.';
      alertBox.classList.remove('hidden');
    }
    consentCheckbox.focus();
    return;
  }

  // 1.1 Verificacion de Honeypot Anti-Bot
  const honeypotVal = document.getElementById('honeypot')?.value;
  if (honeypotVal) {
    alertBox.className = 'mb-6 p-4 rounded-xl text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 block';
    alertBox.textContent = '✅ ¡Gracias! Tu solicitud ha sido registrada correctamente.';
    form.reset();
    return;
  }

  // 2. Extraccion y normalizacion de campos con Telemetria y Consentimiento
  const telemetry = window.CalcuTelemetry ? window.CalcuTelemetry.getMetrics() : {};
  const payload = {
    nombre: document.getElementById('nombre').value.trim(),
    empresa: document.getElementById('empresa').value.trim(),
    email: document.getElementById('email').value.trim(),
    telefono: document.getElementById('telefono').value.trim(),
    interes: document.getElementById('interes').value,
    mensaje: document.getElementById('mensaje')?.value?.trim() || '',
    escala: document.getElementById('escala')?.value || 'Mediana',
    consent_ley_18331: true,
    consent_timestamp: new Date().toISOString(),
    telemetry: telemetry
  };

  // 3. Estado de carga visual en boton y sincronizacion con WebChat
  if (window.CalcuChat && typeof window.CalcuChat.saveKnownFields === 'function') {
    window.CalcuChat.saveKnownFields({
      full_name: payload.nombre,
      company_name: payload.empresa,
      email: payload.email,
      phone: payload.telefono,
      interest_module: payload.interes,
      operation_scale: payload.escala
    });
  }
  submitBtn.disabled = true;
  if (btnText) btnText.textContent = 'Procesando solicitud...';

  let apiSuccess = false;
  let responseData = null;

  // 4. Intento de despacho a la API Backend
  for (const endpoint of LEADS_CONFIG.endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        responseData = await res.json();
        apiSuccess = true;
        break;
      }
    } catch (err) {
      // Intentar siguiente endpoint o continuar al fallback seguro
    }
  }

  // 5. Generacion de enlaces directos WhatsApp y Correo
  const leadSummaryText = 
    `Hola Calcu Suite, solicito acceso a la demo de Calcu Suite 2026.\n\n` +
    `Nombre: ${payload.nombre}\n` +
    `Empresa: ${payload.empresa}\n` +
    `Email: ${payload.email}\n` +
    `Telefono: ${payload.telefono}\n` +
    `Modulo de interes: ${payload.interes}\n` +
    (payload.mensaje ? `Mensaje: ${payload.mensaje}` : '');

  const waUrl = `https://wa.me/${LEADS_CONFIG.directWhatsapp}?text=${encodeURIComponent(leadSummaryText)}`;
  const mailtoUrl = `mailto:${LEADS_CONFIG.directEmail}?subject=${encodeURIComponent('Solicitud Demo Calcu 2026 - ' + payload.empresa)}&body=${encodeURIComponent(leadSummaryText)}`;

  alertBox.classList.remove('hidden');

  // 6. Renderizado seguro (sin innerHTML) de feedback al usuario
  const { el, clear, icon } = window.csiaDom;
  clear(alertBox);
  if (apiSuccess) {
    alertBox.className = 'mb-6 p-4 rounded-xl text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 block';
    alertBox.appendChild(
      el('div', { className: 'flex flex-col sm:flex-row items-center justify-between gap-3' },
        el('div', null,
          el('strong', { className: 'text-sm font-bold text-white', text: `🎉 ¡Excelente, ${payload.nombre}!` }),
          el('p', { className: 'mt-1' },
            'Tu solicitud para ', el('strong', { text: payload.empresa }), ' se registró exitosamente en el sistema de auditoría.')
        ),
        el('a', {
          href: waUrl, target: '_blank', rel: 'noopener noreferrer',
          className: 'px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap shadow-md transition-all'
        }, icon('message-circle', 'w-4 h-4'), el('span', { text: 'Confirmar por WhatsApp' }))
      )
    );
  } else {
    // Modo estatico (ej: GitHub Pages publico)
    alertBox.className = 'mb-6 p-4 rounded-xl text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/40 block';
    alertBox.appendChild(
      el('div', { className: 'flex flex-col sm:flex-row items-center justify-between gap-3' },
        el('div', null,
          el('strong', { className: 'text-sm font-bold text-white', text: `🚀 ¡Datos listos, ${payload.nombre}!` }),
          el('p', { className: 'mt-1', text: 'Para recibir de inmediato tu usuario y contraseña de prueba, haz clic para sincronizar por WhatsApp o Correo:' })
        ),
        el('div', { className: 'flex items-center gap-2' },
          el('a', {
            href: waUrl, target: '_blank', rel: 'noopener noreferrer',
            className: 'px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap shadow'
          }, icon('message-circle', 'w-4 h-4'), el('span', { text: 'WhatsApp' })),
          el('a', {
            href: mailtoUrl,
            className: 'px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap border border-slate-600 shadow'
          }, icon('mail', 'w-4 h-4'), el('span', { text: 'Email' }))
        )
      )
    );
  }

  // Re-inicializar iconos dinamicos
  if (window.lucide) {
    window.lucide.createIcons();
  }

  form.reset();
  submitBtn.disabled = false;
  if (btnText) btnText.textContent = 'Enviar Solicitud de Demo';
}

window.handleLeadSubmit = handleLeadSubmit;
