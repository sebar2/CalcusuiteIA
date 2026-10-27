/**
 * ==========================================================================
 * CALCU SUITE 2026 - MODULO DE CAPTURA DE LEADS Y PROSPECCION
 * Comunicacion con FastAPI (/api/v1/public/leads), telemetria web,
 * honeypot anti-spam y contacto directo (contacto@calcusuiteia.com)
 * ==========================================================================
 */

const LEADS_CONFIG = {
  directEmail: "contacto@calcusuiteia.com",
  directWhatsapp: "59894858791",
  endpoints: [
    "https://app.calcusuiteia.com/api/v1/public/leads",
    "/api/v1/public/leads",
    "/api/v1/leads",
    "http://127.0.0.1:8000/api/v1/public/leads",
    "http://localhost:8000/api/v1/public/leads"
  ]
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

  // 1. Verificacion de Honeypot Anti-Bot
  const honeypotVal = document.getElementById('honeypot')?.value;
  if (honeypotVal) {
    alertBox.className = 'mb-6 p-4 rounded-xl text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 block';
    alertBox.innerHTML = '&#9989; &#161;Gracias! Tu solicitud ha sido registrada correctamente.';
    form.reset();
    return;
  }

  // 2. Extraccion y normalizacion de campos con Telemetria
  const telemetry = window.CalcuTelemetry ? window.CalcuTelemetry.getMetrics() : {};
  const payload = {
    nombre: document.getElementById('nombre').value.trim(),
    empresa: document.getElementById('empresa').value.trim(),
    email: document.getElementById('email').value.trim(),
    telefono: document.getElementById('telefono').value.trim(),
    interes: document.getElementById('interes').value,
    mensaje: document.getElementById('mensaje')?.value?.trim() || '',
    escala: document.getElementById('escala')?.value || 'Mediana',
    telemetry: telemetry
  };

  // 3. Estado de carga visual en boton
  submitBtn.disabled = true;
  if (btnText) btnText.textContent = 'Procesando solicitud...';

  let apiSuccess = false;
  let responseData = null;

  // 4. Intento de despacho a la API Backend
  for (const endpoint of LEADS_CONFIG.endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // 6. Renderizado de feedback al usuario
  if (apiSuccess) {
    alertBox.className = 'mb-6 p-4 rounded-xl text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 block';
    alertBox.innerHTML = `
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <strong class="text-sm font-bold text-white">&#127881; &#161;Excelente, ${payload.nombre}!</strong>
          <p class="mt-1">Tu solicitud para <strong>${payload.empresa}</strong> se registro exitosamente en el sistema de auditoria.</p>
        </div>
        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" 
           class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap shadow-md transition-all">
          <i data-lucide="message-circle" class="w-4 h-4"></i>
          <span>Confirmar por WhatsApp</span>
        </a>
      </div>
    `;
  } else {
    // Modo estatico (ej: GitHub Pages publico)
    alertBox.className = 'mb-6 p-4 rounded-xl text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/40 block';
    alertBox.innerHTML = `
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <strong class="text-sm font-bold text-white">&#128640; &#161;Datos listos, ${payload.nombre}!</strong>
          <p class="mt-1">Para recibir de inmediato tu usuario y contrasena de prueba, haz clic para sincronizar por WhatsApp o Correo:</p>
        </div>
        <div class="flex items-center gap-2">
          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" 
             class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap shadow">
            <i data-lucide="message-circle" class="w-4 h-4"></i>
            <span>WhatsApp</span>
          </a>
          <a href="${mailtoUrl}" 
             class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap border border-slate-600 shadow">
            <i data-lucide="mail" class="w-4 h-4"></i>
            <span>Email</span>
          </a>
        </div>
      </div>
    `;
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
