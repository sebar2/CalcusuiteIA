/**
 * ==========================================================================
 * CALCU SUITE 2026 - MODULO DE CAPTURA DE LEADS Y PROSPECCIÓN
 * Comunicación con FastAPI (/api/v1/leads), honeypot anti-spam,
 * fallback a WhatsApp (+59894858791) y correo (sebar_2@hotmail.com)
 * ==========================================================================
 */

const LEADS_CONFIG = {
  directEmail: "sebar_2@hotmail.com",
  directWhatsapp: "59894858791",
  endpoints: [
    "/api/v1/leads",
    "http://100.119.40.92:8000/api/v1/leads",
    "http://127.0.0.1:8000/api/v1/leads",
    "http://localhost:8000/api/v1/leads"
  ]
};

/**
 * Procesa el envío del formulario de solicitud de demo
 * @param {Event} event 
 */
async function handleLeadSubmit(event) {
  event.preventDefault();

  const form = document.getElementById('leadForm');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = document.getElementById('btnText');
  const alertBox = document.getElementById('formAlert');

  // 1. Verificación de Honeypot Anti-Bot
  const honeypotVal = document.getElementById('honeypot')?.value;
  if (honeypotVal) {
    alertBox.className = 'mb-6 p-4 rounded-xl text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 block';
    alertBox.innerHTML = '✅ ¡Gracias! Tu solicitud ha sido registrada correctamente.';
    form.reset();
    return;
  }

  // 2. Extracción y normalización de campos
  const payload = {
    nombre: document.getElementById('nombre').value.trim(),
    empresa: document.getElementById('empresa').value.trim(),
    email: document.getElementById('email').value.trim(),
    telefono: document.getElementById('telefono').value.trim(),
    interes: document.getElementById('interes').value,
    mensaje: document.getElementById('mensaje').value.trim()
  };

  // 3. Estado de carga visual en botón
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

  // 5. Generación de enlaces directos WhatsApp y Correo
  const leadSummaryText = 
    `Hola Sebastián, solicito acceso a la demo de Calcu Suite 2026.\n\n` +
    `👤 Nombre: ${payload.nombre}\n` +
    `🏢 Empresa: ${payload.empresa}\n` +
    `📧 Email: ${payload.email}\n` +
    `📱 Teléfono: ${payload.telefono}\n` +
    `🎯 Módulo de interés: ${payload.interes}\n` +
    (payload.mensaje ? `💬 Mensaje: ${payload.mensaje}` : '');

  const waUrl = `https://wa.me/${LEADS_CONFIG.directWhatsapp}?text=${encodeURIComponent(leadSummaryText)}`;
  const mailtoUrl = `mailto:${LEADS_CONFIG.directEmail}?subject=${encodeURIComponent('Solicitud Demo Calcu 2026 - ' + payload.empresa)}&body=${encodeURIComponent(leadSummaryText)}`;

  alertBox.classList.remove('hidden');

  // 6. Renderizado de feedback al usuario
  if (apiSuccess) {
    alertBox.className = 'mb-6 p-4 rounded-xl text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 block';
    alertBox.innerHTML = `
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <strong class="text-sm font-bold text-white">🎉 ¡Excelente, ${payload.nombre}!</strong>
          <p class="mt-1">Tu solicitud para <strong>${payload.empresa}</strong> se registró exitosamente en el sistema de auditoría.</p>
        </div>
        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" 
           class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap shadow-md transition-all">
          <i data-lucide="message-circle" class="w-4 h-4"></i>
          <span>Confirmar por WhatsApp</span>
        </a>
      </div>
    `;
  } else {
    // Modo estático (ej: GitHub Pages público sin servidor local corriendo en el dispositivo del visitante)
    alertBox.className = 'mb-6 p-4 rounded-xl text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/40 block';
    alertBox.innerHTML = `
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <strong class="text-sm font-bold text-white">🚀 ¡Datos listos, ${payload.nombre}!</strong>
          <p class="mt-1">Para recibir de inmediato tu usuario y contraseña de prueba, haz clic para sincronizar por WhatsApp o Correo:</p>
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

  // Re-inicializar iconos dinámicos
  if (window.lucide) {
    window.lucide.createIcons();
  }

  form.reset();
  submitBtn.disabled = false;
  if (btnText) btnText.textContent = 'Enviar Solicitud de Demo';
}

window.handleLeadSubmit = handleLeadSubmit;
