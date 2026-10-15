/**
 * ==========================================================================
 * CALCU SUITE 2026 - COMPONENTE WIDGET WHATSAPP INTERACTIVO
 * Manejo modular del chat flotante, respuestas rápidas y redirección directa
 * Teléfono Corporativo Oficial: +598 94 858 791 (Uruguay)
 * ==========================================================================
 */

const WHATSAPP_CONFIG = {
  phone: "59894858791",
  advisorName: "Sebastián",
  companyName: "Calcu Suite Enterprise",
  defaultGreeting: "¡Hola! 👋 Bienvenido a Calcu Suite. ¿Te gustaría coordinar una demostración guiada o probar el acceso demo para tu empresa?"
};

/**
 * Alterna la visibilidad de la ventana de chat flotante de WhatsApp
 */
function toggleWaChat() {
  const dialog = document.getElementById('waChatDialog');
  if (!dialog) return;
  
  const isHidden = dialog.classList.contains('hidden');
  if (isHidden) {
    dialog.classList.remove('hidden');
    const input = document.getElementById('waCustomMsg');
    if (input) setTimeout(() => input.focus(), 150);
  } else {
    dialog.classList.add('hidden');
  }
}

/**
 * Envía un mensaje rápido predefinido a WhatsApp
 * @param {string} messageText 
 */
function sendQuickWa(messageText) {
  const encoded = encodeURIComponent(messageText);
  const targetUrl = `https://wa.me/${WHATSAPP_CONFIG.phone}?text=${encoded}`;
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
  toggleWaChat();
}

/**
 * Captura y envía el mensaje escrito manualmente por el usuario en el widget
 */
function sendCustomWa() {
  const input = document.getElementById('waCustomMsg');
  if (!input) return;
  
  const text = input.value.trim();
  if (!text) return;
  
  sendQuickWa(text);
  input.value = '';
}

// Exportar globalmente para eventos en HTML
window.toggleWaChat = toggleWaChat;
window.sendQuickWa = sendQuickWa;
window.sendCustomWa = sendCustomWa;
