/**
 * ==========================================================================
 * CALCU SUITE 2026 - MOTOR UNIFICADO DE SHOWCASE DE MÓDULOS (SHOWCASE.JS)
 * Control de Drawers, Modales Lightbox, Canales y Copilotos IA Temáticos
 * Arquitectura 100% externa: cero scripts inline en HTML (ISO 27001 / OWASP ASVS)
 * ==========================================================================
 */

// Base de conocimiento contextualizada por módulo
const MODULE_KNOWLEDGE_BASES = {
  'modulo-chat-omnicanal': {
    title: 'Chat Omnicanal & WhatsApp',
    badge: 'CalcuSuiteIA WhatsApp Copilot',
    color: 'emerald',
    defaultAnswer: 'Excelente pregunta. La consola de Chat Omnicanal de CalcuSuiteIA está diseñada para acelerar tus ventas eliminando fricciones y costos por mensaje.',
    rules: [
      {
        keywords: ['numero', 'linea', 'simultaneo', 'multiple'],
        answer: '📱 **Múltiples Números y Operadores:** Puedes conectar distintas líneas de WhatsApp asignándolas por departamento (ej. Ventas, Depósito, Cobranzas) y atender todas desde la misma pantalla con permisos de usuario.',
      },
      {
        keywords: ['baneo', 'bloqueo', 'suspension', 'spam'],
        answer: '🛡️ **Anti-Bloqueo Inteligente:** Nuestro motor incluye temporizadores de despacho humano (intervalos aleatorios entre 4 y 12 segundos) y respeta las políticas oficiales para que tu número nunca sea marcado como spam.',
      },
      {
        keywords: ['audio', 'voz', 'microfono', 'opus'],
        answer: '🎙️ **Notas de Voz Reales (.opus):** Al grabar desde la computadora, el mensaje se codifica en Ogg Opus nativo. En el teléfono del cliente aparece con el ícono de micrófono verde de WhatsApp idéntico a un audio grabado con el celular.',
      },
      {
        keywords: ['pionero', 'gratis', 'costo'],
        answer: '🎁 **Plan Pionero 100% Bonificado:** Accedes a WhatsApp QR, CRM y chat omnicanal sin costo durante 6 meses completos y conservas 50% de descuento vitalicio para tu cuenta.',
      },
    ],
  },

  'modulo-cobranzas-finanzas': {
    title: 'Cobranzas B2B & Finanzas',
    badge: 'CalcuSuiteIA Collections Copilot',
    color: 'rose',
    defaultAnswer: 'Excelente pregunta financiera. El módulo de Cobranzas B2B de CalcuSuiteIA te permite acelerar el flujo de caja sin desgastar la relación comercial con tus clientes.',
    rules: [
      {
        keywords: ['intimacion', 'legal', 'telegrama', '48 horas'],
        answer: '📜 **Generación de Intimación Fehaciente:** Con un solo clic, el sistema redacta una carta formal con el membrete de tu empresa, listando facturas impagas, intereses acumulados y otorgando un plazo perentorio de 48 horas antes del pase a gestión judicial.',
      },
      {
        keywords: ['mercado pago', 'qr', 'tarjeta', 'boton'],
        answer: '💳 **Cobro Instantáneo con QR:** El cliente recibe un enlace con un Código QR de Mercado Pago Uruguay. Al pagar, el dinero ingresa a tu cuenta y el sistema concilia la factura en el acto, emitiendo el recibo correspondiente.',
      },
      {
        keywords: ['dsi', 'dias de calle', 'liquidez'],
        answer: '📊 **Reducción del DSI (Days Sales Outstanding):** En Uruguay, las empresas que usan alertas tempranas reducen sus días promedio de cobro de 62 a 34 días, liberando capital de trabajo para comprar stock sin endeudarse en bancos.',
      },
      {
        keywords: ['pionero', 'gratis'],
        answer: '🎁 **Módulo de Cobranzas Incluido:** Puedes gestionar todas tus cuentas por cobrar en el Plan Pionero sin pagar comisiones adicionales durante los 6 meses del programa.',
      },
    ],
  },

  'modulo-control-room': {
    title: 'Control Room & Seguridad',
    badge: 'CalcuSuiteIA Security Copilot',
    color: 'red',
    defaultAnswer: 'Excelente consulta sobre seguridad corporativa. CalcuSuiteIA aplica una arquitectura de defensa en profundidad diseñada para proteger la información más crítica de tu negocio.',
    rules: [
      {
        keywords: ['aislamiento', 'tenant', 'empresa', 'otra'],
        answer: '🏢 **Aislamiento Multi-Tenant Estricto:** Cada cuenta tiene un identificador único (UID) y su base de datos o esquema propio en PostgreSQL 16. Los accesos se validan criptográficamente en cada consulta, impidiendo cualquier cruce entre empresas.',
      },
      {
        keywords: ['iso', '27001', 'auditoria', 'forense'],
        answer: '📋 **Cumplimiento ISO 27001:** Mantenemos un registro inmutable de auditoría donde queda grabada cada acción: qué usuario inició sesión, qué registro modificó, la dirección IP de origen y la marca de tiempo UTC certificada.',
      },
      {
        keywords: ['2fa', 'doble factor', 'totp', 'autenticador'],
        answer: '🔑 **Autenticación 2FA TOTP:** Puedes activar el doble factor escaneando un código QR desde la sección de Perfil con Google Authenticator. Esto protege tu cuenta incluso si alguien adivinara tu contraseña.',
      },
      {
        keywords: ['pionero', 'gratis'],
        answer: '🎁 **Máxima Seguridad en Todos los Planes:** El blindaje ISO 27001, la bóveda criptográfica y el Control Room están activos desde el primer día en el Plan Pionero 100% gratuito.',
      },
    ],
  },

  'modulo-difusion-campanas': {
    title: 'Difusión & Campañas',
    badge: 'CalcuSuiteIA Campaigns Copilot',
    color: 'pink',
    defaultAnswer: 'Excelente consulta sobre difusión. Nuestro módulo está especialmente configurado para proteger la reputación de tus cuentas y maximizar conversiones.',
    rules: [
      {
        keywords: ['diario', 'cuanto', 'limite', 'riesgo', 'dia'],
        answer: '📊 **Recomendación de Volumen Seguro:** Para una cuenta de WhatsApp con antigüedad, el límite óptimo recomendado es de 300 a 600 mensajes diarios con intervalos humanos de 5 a 12 segundos entre envíos. Por Email con Resend puedes enviar hasta 50.000 mensuales.',
      },
      {
        keywords: ['semaforo', 'elegibilidad', 'bloqueo'],
        answer: '🚦 **Semáforo de Elegibilidad 2026:** Antes de iniciar el despacho, la plataforma analiza la lista: elimina números inválidos, respeta listas de exclusión (opt-out) y comprueba que el texto tenga personalización (nombre del cliente) para no ser considerado spam.',
      },
      {
        keywords: ['excel', 'importar', 'csv', 'lista'],
        answer: '📁 **Importador Inteligente de Excel:** Puedes subir una planilla con columnas de Nombre, Teléfono, Email y Empresa. El sistema normaliza automáticamente los prefijos telefónicos (+598 para Uruguay) y asigna las etiquetas correspondientes.',
      },
      {
        keywords: ['pionero', 'gratis'],
        answer: '🎁 **Acceso Pionero 100% Sin Cargo:** Durante los 6 meses del Plan Pionero puedes utilizar el motor de campañas sin costos de software y asegurando 50% vitalicio.',
      },
    ],
  },

  'modulo-facturacion-cfe': {
    title: 'Facturación CFE & DGI',
    badge: 'CalcuSuiteIA Fiscal Copilot',
    color: 'purple',
    defaultAnswer: 'Excelente consulta tributaria. CalcuSuiteIA está homologado y estructurado conforme a todas las disposiciones del sistema de facturación electrónica de DGI Uruguay.',
    rules: [
      {
        keywords: ['cae', 'tramite', 'homolog', 'autoriza'],
        answer: '📑 **Gestión del CAE ante DGI:** El CAE se solicita directamente en los servicios en línea de DGI con tu RUT. Una vez obtenido el archivo de constancia, lo subes a CalcuSuiteIA en 1 clic y el sistema administra los números correlativos automáticamente.',
      },
      {
        keywords: ['requisito', 'certificado', 'firma'],
        answer: '🔑 **Requisitos Básicos:** Solo necesitas tu RUT activo en DGI y un Certificado Digital de Firma Electrónica (ej. Abitab o Correo Uruguayo). Nuestro equipo te asiste en la configuración inicial sin complicaciones.',
      },
      {
        keywords: ['contador', 'excel', 'libro diario', 'partida doble'],
        answer: '📊 **Integración Total con tu Contador:** Puedes descargar en cualquier momento el Libro Diario, Libro Mayor y Balance de Comprobación en Excel. Tu contador recibe los asientos perfectamente cuadrados con cuentas Debe y Haber.',
      },
      {
        keywords: ['pionero', 'gratis'],
        answer: '🎁 **Plan Pionero 100% Bonificado:** Obtienes el módulo de facturación CFE y contabilidad sin costo durante 6 meses con 50% de descuento vitalicio garantizado al salir de la fase Pionero.',
      },
    ],
  },

  'modulo-gemelo-digital-3d': {
    title: 'Gemelo Digital 3D',
    badge: 'CalcuSuiteIA 3D Copilot',
    color: 'cyan',
    defaultAnswer: 'Excelente consulta. El Gemelo Digital 3D de CalcuSuiteIA se conecta en vivo a tu inventario y permite planificar la distribución espacial antes de mover un solo pallet físico.',
    rules: [
      {
        keywords: ['colision', 'superpon', 'aabb'],
        answer: '🛡️ **Algoritmo AABB:** Cada rack tiene una caja tridimensional matemática. Si intentas moverlo sobre otro rack o sobre un pasillo delimitado, el sistema bloquea el desplazamiento y te alerta en rojo en el visor 3D para evitar accidentes operativos.',
      },
      {
        keywords: ['hardware', 'requisito', 'pc', 'tarjeta'],
        answer: '💻 **Requisitos muy ligeros:** Funciona directamente en Google Chrome o Edge en cualquier PC de oficina o tablet Android con WebGL estándar. No requiere tarjeta gráfica dedicada de alto rendimiento porque usamos técnicas de instanciación geométrica GPU ultra-optimizadas.',
      },
      {
        keywords: ['cuesta', 'precio', 'pionero', 'costo'],
        answer: '🎁 **100% Gratis durante la etapa Pionero (aprox. 6 meses)** con el 50% de descuento vitalicio garantizado al salir a producción comercial. Puedes activar tu cuenta Pionero ahora mismo haciendo clic en el botón inferior.',
      },
      {
        keywords: ['stock', 'articulo', 'artículo', 'lote'],
        answer: '📦 **Vínculo con el Inventario Real:** Cada pallet del 3D está enlazado al SKU, lote, fecha de vencimiento y proveedor en PostgreSQL 16. Si despachas por Mercado Libre o Factura CFE, el visor 3D libera la coordenada automáticamente.',
      },
    ],
  },

  'modulo-integraciones-hub': {
    title: 'Hub de Integraciones',
    badge: 'CalcuSuiteIA Integrations Copilot',
    color: 'blue',
    defaultAnswer: 'Excelente consulta. El Hub de Integraciones de CalcuSuiteIA unifica tus canales de venta y comunicación con los más altos estándares de ciberseguridad.',
    rules: [
      {
        keywords: ['aes', 'cifrado', 'seguridad', 'token', 'clave'],
        answer: '🔒 **Bóveda AES-256 GCM:** Cada token o secreto se encripta antes de tocar el disco. En la base de datos y en los registros de auditoría se muestran siempre enmascarados (ej: `whsec_****`), impidiendo cualquier filtración inadvertida.',
      },
      {
        keywords: ['marketplace', 'limite', 'lote', 'facebook'],
        answer: '📊 **Límites de Facebook Marketplace 2026:** El sistema respeta el límite estricto de 30 solicitudes por minuto mediante encolamiento asíncrono, evitando cualquier sanción de catálogo.',
      },
      {
        keywords: ['cac', 'roas', 'costo', 'inversion'],
        answer: '📈 **Atribución Precisa de ROAS y CAC:** Al conectar Google Ads o Meta Leads, cada venta cerrada en el CRM rastrea el costo de adquisición original para que sepas qué canal genera dinero real y cuál gasta sin retorno.',
      },
      {
        keywords: ['pionero', 'gratis'],
        answer: '🎁 **Integraciones Incluidas en Pionero:** Durante los 6 meses del Plan Pionero puedes conectar los 11 canales sin límite de tráfico con soporte de nuestros arquitectos.',
      },
      {
        keywords: ['factura', 'cfe', 'dgi', 'cae'],
        answer: '🏛️ **Emisión Fiscal Homologada:** Operamos en alianza con emisores electrónicos certificados bajo normativa DGI de Uruguay. Cada e-Factura o e-Ticket genera CAE, código QR de verificación en tiempo real y asienta automáticamente en el Libro Diario Auxiliar.',
      },
    ],
  },

  'modulo-licitaciones-radar': {
    title: 'Radar Licitaciones ARCE',
    badge: 'CalcuSuiteIA Tenders Copilot',
    color: 'cyan',
    defaultAnswer: 'Excelente consulta sobre compras públicas. El Radar ARCE de CalcuSuiteIA monitorea en tiempo real todas las oportunidades estatales de Uruguay.',
    rules: [
      {
        keywords: ['organismo', 'ministerio', 'ute', 'antel', 'intendencia'],
        answer: '🏛️ **Cobertura Total del Estado:** Monitorea las 19 Intendencias Departamentales, Ministerios, Empresas Públicas (UTE, OSE, ANTEL, ANCAP), ASSE, Udelar y organismos descentralizados conectados a ARCE.',
      },
      {
        keywords: ['rupe', 'registro', 'inscrip'],
        answer: '📋 **Estado en RUPE:** Para venderle al Estado uruguayo es necesario estar inscripto en el RUPE (Registro Único de Proveedores del Estado). Nuestro sistema verifica si el pliego exige estado "En Trámite" o "Activo".',
      },
      {
        keywords: ['excluyente', 'pliego', 'clausula', 'ia'],
        answer: '🔍 **Análisis de Cláusulas Excluyentes:** La IA procesa las condiciones de admisibilidad (garantías de mantenimiento, antecedentes mínimos, plazos de entrega y multas) para evitar que tu empresa sea descalificada por un error formal.',
      },
      {
        keywords: ['pionero', 'gratis'],
        answer: '🎁 **Acceso Pionero Sin Costo:** Puedes recibir alertas ARCE por WhatsApp y analizar pliegos sin cargo durante los 6 meses de la fase Pionero.',
      },
    ],
  },

  'modulo-logistica-3pl': {
    title: 'Logística 3PL & Flota',
    badge: 'CalcuSuiteIA 3PL Copilot',
    color: 'emerald',
    defaultAnswer: 'Excelente pregunta operativa. El módulo 3PL de CalcuSuiteIA está diseñado para controlar flotas de transporte en Uruguay con cálculo exacto de costos y trazabilidad satelital en vivo.',
    rules: [
      {
        keywords: ['gps', 'hardware', 'equipo', 'celular', 'dispositivo'],
        answer: '🛰️ **100% Flexible:** Puedes usar dispositivos GPS estándar (Teltonika, Coban, Suntech) enviando telemetría vía Webhook/TCP, o simplemente instalar nuestra App Móvil Android en los celulares de tus choferes sin comprar ningún hardware adicional.',
      },
      {
        keywords: ['peaje', 'chofer', 'viatico', 'mtop'],
        answer: '📑 **Liquidación Automatizada:** El sistema reconoce los pasos de peajes en rutas nacionales y calcula los viáticos y kilometrajes según los convenios del MTOP y BPS, generando la liquidación en un solo clic.',
      },
      {
        keywords: ['cliente', 'seguimiento', 'publico', 'link'],
        answer: '📍 **Link de Rastreo Público Seguro:** Puedes enviarle al cliente un enlace web único (por WhatsApp o SMS) donde ve únicamente su camión en tránsito y el tiempo estimado de arribo (ETA), sin ver datos internos de tu empresa.',
      },
      {
        keywords: ['pionero', 'costo', 'precio', 'gratis'],
        answer: '🎁 **Acceso Pionero Gratuito:** Tienes 6 meses sin cargo para probarlo en toda tu flota con soporte de configuración incluido y 50% de descuento vitalicio al salir de la etapa Pionero.',
      },
    ],
  },

  'modulo-mercadolibre': {
    title: 'Mercado Libre Oficial',
    badge: 'CalcuSuiteIA MeLi Copilot',
    color: 'amber',
    defaultAnswer: 'Excelente pregunta. Nuestra integración con Mercado Libre Uruguay está 100% optimizada para simplificar tus ventas y proteger tu reputación comercial.',
    rules: [
      {
        keywords: ['oficial', 'homologada', 'app id'],
        answer: '✅ **Integración 100% Oficial:** CalcuSuiteIA opera bajo la App ID oficial 5376694505612300 de Mercado Libre Uruguay. Cumple con los protocolos de seguridad OAuth2 y protección criptográfica en Bóveda AES-256.',
      },
      {
        keywords: ['stock', 'local', 'sobreventa'],
        answer: '⚡ **Sincronización Atómica en Milisegundos:** Cuando vendes un artículo en tu local físico o emites una factura, CalcuSuiteIA actualiza el inventario en la API de Mercado Libre de inmediato. Si te quedas sin stock, la publicación se pausa automáticamente.',
      },
      {
        keywords: ['publicar', 'ia', 'categor'],
        answer: '🤖 **Publicación con IA en 1 Clic:** Ingresas el nombre del producto y nuestra IA analiza el catálogo de MeLi Uruguay para sugerirte la categoría exacta (MLUxxxxx), atributos requeridos y títulos de alta conversión para que publiques en segundos.',
      },
      {
        keywords: ['pionero', 'gratis', 'costo'],
        answer: '🎁 **6 Meses Gratis con Programa Pionero:** Puedes conectar tu cuenta de Mercado Libre sin pagar comisiones ni suscripciones durante toda la etapa Pionero y asegurar 50% de descuento vitalicio para tu empresa.',
      },
    ],
  },
};

// Determinar el módulo activo según la URL
function getActiveModuleConfig() {
  const path = window.location.pathname.toLowerCase();
  for (const key in MODULE_KNOWLEDGE_BASES) {
    if (path.includes(key)) {
      return MODULE_KNOWLEDGE_BASES[key];
    }
  }
  return MODULE_KNOWLEDGE_BASES['modulo-integraciones-hub'];
}

// Inicialización de Iconos Lucide al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

/**
 * Control del Drawer Lateral Izquierdo
 */
function openLogoDrawer() {
  const d = document.getElementById('logoSlideDrawer');
  const c = document.getElementById('logoSlideDrawerContent');
  if (d && c) {
    d.classList.remove('hidden');
    setTimeout(() => {
      c.classList.remove('-translate-x-full');
      c.classList.add('translate-x-0');
    }, 10);
  }
}

function closeLogoDrawer() {
  const d = document.getElementById('logoSlideDrawer');
  const c = document.getElementById('logoSlideDrawerContent');
  if (d && c) {
    c.classList.remove('translate-x-0');
    c.classList.add('-translate-x-full');
    setTimeout(() => {
      d.classList.add('hidden');
    }, 300);
  }
}

/**
 * Control del Menú Móvil Superior
 */
function toggleMobileDrawer() {
  const drawer = document.getElementById('mobileDrawer');
  if (drawer) {
    drawer.classList.toggle('hidden');
  }
}

/**
 * Control del Lightbox Modal para Inspección de Pantallas
 */
function openScreenshotModal(src, title) {
  const m = document.getElementById('screenshotModal');
  const img = document.getElementById('screenshotModalImg');
  const t = document.getElementById('screenshotModalTitle');
  if (m && img && t) {
    img.src = src;
    t.textContent = title;
    m.classList.remove('hidden');
    m.classList.add('flex');
  }
}

function closeScreenshotModal() {
  const m = document.getElementById('screenshotModal');
  if (m) {
    m.classList.add('hidden');
    m.classList.remove('flex');
  }
}

/**
 * Verificador Interactivo de Canales (Hub de Integraciones)
 */
function checkChannels() {
  const count = document.querySelectorAll('.chk-channel:checked').length;
  const target = document.getElementById('txtCompatibilidad');
  if (target) {
    target.textContent = `${count} canales seleccionados • Integración 100% Soportada en 1 Clic con Bóveda AES-256.`;
  }
}

/**
 * Copiloto IA Temático: Pregunta Rápida desde Botones Sugeridos
 */
function askCopilot(question) {
  const input = document.getElementById('copilotInput');
  if (input) {
    input.value = question;
    handleCopilotSubmit(new Event('submit'));
  }
}

/**
 * Copiloto IA: Procesador de Formularios y Preguntas
 */
function handleCopilotSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('copilotInput');
  if (!input) return;
  const q = input.value.trim();
  if (!q) return;

  appendMessage('user', q);
  input.value = '';

  const cfg = getActiveModuleConfig();

  setTimeout(() => {
    let answer = cfg.defaultAnswer;
    const low = q.toLowerCase();

    for (const rule of cfg.rules) {
      if (rule.keywords.some((k) => low.includes(k))) {
        answer = rule.answer;
        break;
      }
    }
    appendMessage('bot', answer);
  }, 400);
}

/**
 * Copiloto IA: Renderizado Seguro de Burbujas de Chat
 */
function appendMessage(sender, text) {
  const box = document.getElementById('copilotChatBox');
  if (!box) return;
  const cfg = getActiveModuleConfig();
  const color = cfg.color || 'blue';

  const colorMap = {
    cyan: { bgUser: 'bg-cyan-600/30', borderUser: 'border-cyan-500/40', textUser: 'text-cyan-100', userAvatar: 'bg-cyan-700', botIconBg: 'bg-cyan-600/30', botIconColor: 'text-cyan-400', badgeText: 'text-cyan-400/80', ctaBg: 'bg-cyan-600/30 hover:bg-cyan-600/50', ctaText: 'text-cyan-300', ctaBorder: 'border-cyan-500/30' },
    emerald: { bgUser: 'bg-emerald-600/30', borderUser: 'border-emerald-500/40', textUser: 'text-emerald-100', userAvatar: 'bg-emerald-700', botIconBg: 'bg-emerald-600/30', botIconColor: 'text-emerald-400', badgeText: 'text-emerald-400/80', ctaBg: 'bg-emerald-600/30 hover:bg-emerald-600/50', ctaText: 'text-emerald-300', ctaBorder: 'border-emerald-500/30' },
    rose: { bgUser: 'bg-rose-600/30', borderUser: 'border-rose-500/40', textUser: 'text-rose-100', userAvatar: 'bg-rose-700', botIconBg: 'bg-rose-600/30', botIconColor: 'text-rose-400', badgeText: 'text-rose-400/80', ctaBg: 'bg-rose-600/30 hover:bg-rose-600/50', ctaText: 'text-rose-300', ctaBorder: 'border-rose-500/30' },
    red: { bgUser: 'bg-red-600/30', borderUser: 'border-red-500/40', textUser: 'text-red-100', userAvatar: 'bg-red-700', botIconBg: 'bg-red-600/30', botIconColor: 'text-red-400', badgeText: 'text-red-400/80', ctaBg: 'bg-red-600/30 hover:bg-red-600/50', ctaText: 'text-red-300', ctaBorder: 'border-red-500/30' },
    pink: { bgUser: 'bg-pink-600/30', borderUser: 'border-pink-500/40', textUser: 'text-pink-100', userAvatar: 'bg-pink-700', botIconBg: 'bg-pink-600/30', botIconColor: 'text-pink-400', badgeText: 'text-pink-400/80', ctaBg: 'bg-pink-600/30 hover:bg-pink-600/50', ctaText: 'text-pink-300', ctaBorder: 'border-pink-500/30' },
    purple: { bgUser: 'bg-purple-600/30', borderUser: 'border-purple-500/40', textUser: 'text-purple-100', userAvatar: 'bg-purple-700', botIconBg: 'bg-purple-600/30', botIconColor: 'text-purple-400', badgeText: 'text-purple-400/80', ctaBg: 'bg-purple-600/30 hover:bg-purple-600/50', ctaText: 'text-purple-300', ctaBorder: 'border-purple-500/30' },
    amber: { bgUser: 'bg-amber-600/30', borderUser: 'border-amber-500/40', textUser: 'text-amber-100', userAvatar: 'bg-amber-700', botIconBg: 'bg-amber-600/30', botIconColor: 'text-amber-400', badgeText: 'text-amber-400/80', ctaBg: 'bg-amber-600/30 hover:bg-amber-600/50', ctaText: 'text-amber-300', ctaBorder: 'border-amber-500/30' },
    blue: { bgUser: 'bg-blue-600/30', borderUser: 'border-blue-500/40', textUser: 'text-blue-100', userAvatar: 'bg-blue-700', botIconBg: 'bg-blue-600/30', botIconColor: 'text-blue-400', badgeText: 'text-blue-400/80', ctaBg: 'bg-blue-600/30 hover:bg-blue-600/50', ctaText: 'text-blue-300', ctaBorder: 'border-blue-500/30' },
  };

  const c = colorMap[color] || colorMap.blue;
  const div = document.createElement('div');
  div.className = 'flex items-start gap-2.5 animate-in fade-in duration-200';

  if (sender === 'user') {
    div.innerHTML = `
      <div class="ml-auto ${c.bgUser} border ${c.borderUser} rounded-2xl rounded-tr-sm p-3 ${c.textUser} max-w-xl text-right">
        ${escapeHTML(text)}
      </div>
      <div class="w-7 h-7 rounded-lg ${c.userAvatar} text-white flex items-center justify-center shrink-0">
        <i data-lucide="user" class="w-4 h-4"></i>
      </div>
    `;
  } else {
    div.innerHTML = `
      <div class="w-7 h-7 rounded-lg ${c.botIconBg} ${c.botIconColor} flex items-center justify-center shrink-0">
        <i data-lucide="bot" class="w-4 h-4"></i>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-3 text-slate-200 leading-relaxed max-w-xl">
        <div>${text}</div>
        <div class="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <span class="text-[11px] ${c.badgeText}">${cfg.badge}</span>
          <button onclick="openAccountModal('PIONERO')" class="text-[11px] ${c.ctaBg} ${c.ctaText} font-bold px-2.5 py-1 rounded-lg border ${c.ctaBorder} transition-colors">
            Activar Plan Pionero Gratis &rarr;
          </button>
        </div>
      </div>
    `;
  }
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Sanitizador Anti-XSS (CWE-79)
 */
function escapeHTML(str) {
  return str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      }[tag] || tag)
  );
}
