/**
 * ==========================================================================
 * CALCU SUITE 2026 - MODULO PRINCIPAL (MAIN.JS)
 * Control de Galería de Pantallas, Lightbox Modal y Navegación
 * ==========================================================================
 */

// Diccionario de datos para las pestañas de inspección visual de capturas reales
const GALLERY_DATA = {
  'gemelo3d': {
    image: './screenshots/27_gemelo_digital_3d_rack_spatial.png',
    url: 'https://calcu.enterprise.app/wms/digital-twin-3d',
    badge: 'Módulo Gemelo Digital 3D & WMS Espacial',
    title: 'Gemelo Digital 3D: Traslado Espacial de Racks en Bloque y Cajas',
    desc: 'Motor 3D Three.js acelerado por hardware para depósito inteligente. Selección activa por raycasting, traslado de estructuras completas en coordenadas espaciales (X, Z), rotación 0°/90°, detección AABB de colisiones físicas y persistencia ACID en Numeric(14, 4).',
    bullets: [
      'Desplazamiento del rack entero con persistencia espacial en base de datos Numeric(14, 4)',
      'Algoritmo AABB anticolisión en tiempo real que previene superposiciones físicas de estructuras',
      'Configuración de slots, cajas volumétricas y mapa dinámico de coordenadas disponibles'
    ]
  },
  'rack_editor': {
    image: './screenshots/28_gemelo_digital_3d_rack_editor.png',
    url: 'https://calcu.enterprise.app/wms/rack-editor',
    badge: 'Editor Dimensional de Almacén',
    title: 'Panel de Configuración Dimensional de Racks y Cajas',
    desc: 'Inspector lateral en vivo con ajuste milimétrico de ancho, alto y profundidad del cuerpo seleccionado, conteo de niveles y capacidad de carga máxima en kilogramos.',
    bullets: [
      'Actualización instantánea en el lienzo 3D sin recargas de página vía WebGL InstancedMesh',
      'Cálculo automático de volumen cúbico y cubicaje m3 ocupado vs libre',
      'Auditoría y trazabilidad de reubicaciones de estructuras de estantería'
    ]
  },
  'fpa_variance': {
    image: './screenshots/14_budget_variance.png',
    url: 'https://calcu.enterprise.app/finance/fpa',
    badge: 'Módulo Finanzas & Control FP&A',
    title: 'Sincronización Automática Contabilidad ➔ Presupuestos Real vs Budget',
    desc: 'Vínculo nativo entre asientos contables del Libro Diario y Centros de Costo OPEX (CC-LOG, CC-WMS, CC-TI, CC-COM). Monitoreo de desvíos en tiempo real con Copiloto Financiero IA.',
    bullets: [
      'Cálculos matemáticos estrictos en decimal.Decimal (ROUND_HALF_UP) y Numeric(14, 4)',
      'Alertas tempranas de sobrecosto por partida presupuestaria',
      'Reporte consolidado de ejecución mensual y proyecciones de flujo de caja'
    ]
  },
  'tenders': {
    image: './screenshots/19_licitaciones_radar_arce.png',
    url: 'https://calcu.enterprise.app/procurement/intendencias',
    badge: 'Módulo Licitaciones & Compras Estatales',
    title: 'Radar de Licitaciones ARCE & Análisis de las 19 Intendencias de Uruguay',
    desc: 'Monitoreo automatizado de compras del Estado, pliegos SICE y radar consolidado de las 19 Intendencias Departamentales con detección de competidores, dispersión de precios y quórum.',
    bullets: [
      'Radar consolidado de las 19 Intendencias Departamentales de Uruguay',
      'Detección de patrones de compra y dispersión de precios de adjudicación',
      'Alertas de convocatorias abiertas y generación de ofertas B2B en un clic'
    ]
  },

  'meli': {
    image: './screenshots/21_mercadolibre_kanban_5etapas.png',
    url: 'https://calcu.enterprise.app/ecommerce/mercadolibre',
    badge: 'Módulo E-Commerce Mercado Libre',
    title: 'Mercado Libre Uruguay: Tablero Kanban 5 Etapas & Catálogo',
    desc: 'Sincronización oficial con API de Mercado Libre Uruguay (App Oficial 5376694505612300) mediante Bóveda AES-256. Gestión de publicaciones activas/pausadas, inventario unificado, chat pre y post venta, y métricas de reputación oficial.',
    bullets: [
      'Kanban operativo de pedidos: Pendiente, Preparación, Despacho, Entregado y Reclamos',
      'Sincronización bidireccional automática de precios y stock con Depósito Central',
      'Atención centralizada de preguntas de prospectos con respuestas sugeridas por IA'
    ]
  },
  'meli_modal': {
    image: './screenshots/24_meli_publicacion_modal.png',
    url: 'https://calcu.enterprise.app/ecommerce/mercadolibre/publicar',
    badge: 'Publicación Asistida MeLi 1-Clic',
    title: 'Publicación Asistida MeLi con Clasificador IA de Categorías',
    desc: 'Ventana modal para publicar productos en Mercado Libre Uruguay en un solo clic. Clasificador semántico que predice la categoría oficial MeLi, detecta atributos obligatorios (Marca, Modelo, Rosca) y sincroniza stock de depósito.',
    bullets: [
      'Predicción inteligente de categorías MeLi mediante IA local',
      'Detección y validación dinámica de atributos obligatorios requeridos por categoría',
      'Selector de tipo de publicación (Clásica/Premium), condición (Nuevo/Usado) y moneda'
    ]
  },
  'omnichannel': {
    image: './screenshots/23_omnichannel_chat_multimedia.png',
    url: 'https://calcu.enterprise.app/crm/omnichannel',
    badge: 'Módulo CRM & Chat Omnicanal IA',
    title: 'Chat Omnicanal WhatsApp Directo QR con Audio .opus & Portapapeles',
    desc: 'Consola unificada de comunicación comercial que centraliza WhatsApp Directo QR (sin costos por mensaje), Google Ads, Meta Leads y Web. Soporte nativo de notas de voz en formato .opus con reproductor web integrado y portapapeles multimedia (copiar y pegar imágenes, audios o videos sin adjuntar).',
    bullets: [
      'Reproducción y grabación de notas de voz en formato nativo .opus compatible con móviles',
      'Pegado directo desde el portapapeles (Ctrl+V) de capturas, fotos y videos en el chat',
      'Clasificador inteligente de leads con scoring comercial y sugerencias de IA local'
    ]
  },
  'integraciones': {
    image: './screenshots/22_integraciones_whatsapp_qr.png',
    url: 'https://calcu.enterprise.app/integrations/hub',
    badge: 'Módulo Hub Integraciones & AdTech',
    title: 'Hub de Integraciones Multicanal & Atribución ROAS / CAC',
    desc: 'Centro de conexiones corporativas cifradas con Bóveda AES-256 (CWE-312 / CWE-532 safe). Endpoints directos para webhooks de Google Ads, Meta Lead Ads, WhatsApp Business API, WhatsApp Directo QR, Email Corporativo y Formularios Web.',
    bullets: [
      'Atribución de retorno publicitario (ROAS) y costo por lead (CPL/CAC) por canal comercial',
      'Bóveda de credenciales con cifrado seguro y protección de secretos en logs',
      'Inyección automática de prospectos en la etapa 1 (Prospección) del Pipeline CRM'
    ]
  },
  'tenants': {
    image: './screenshots/25_licencias_multitenant_pioneros.png',
    url: 'https://calcu.enterprise.app/admin/licensing',
    badge: 'Módulo SaaS Multi-Tenant & Licenciamiento',
    title: 'Licenciamiento SaaS Multi-Tenant & Aislamiento de Base de Datos',
    desc: 'Aislamiento de base de datos por cliente (estrategia "Schema-per-Tenant"). Conmutador interactivo de licencias (Starter USD 79, Pro USD 190, Enterprise USD 490), autenticación de dos factores (2FA / TOTP RFC 6238) y aprovisionamiento automatizado vía script CLI.',
    bullets: [
      'Base de datos aislada e independiente para cada empresa cliente con backups diarios',
      'Programa Pioneros: 100% gratis hasta culminar desarrollo (aprox. 6 meses) y luego 50% de descuento por 6 meses',
      'Modo prueba gratuita de 14 días (ampliable a 1 mes) con acceso a todos los módulos'
    ]
  },
  'mobile': {
    image: './screenshots/26_mobile_redmi_note_9_pro_menu.png',
    url: 'https://calcu.enterprise.app/mobile/android-app',
    badge: 'Módulo UX Móvil & Android APK',
    title: 'Experiencia Móvil 20:9 (Menú Hamburguesa ☰)',
    desc: 'Interfaz optimizada para dispositivos móviles panorámicos 20:9 bajo Android 10 a 15. Menú hamburguesa superior que despliega un panel lateral tipo drawer ergonómico para uso con una sola mano.',
    bullets: [
      'Menú hamburguesa ☰ accesible que oculta la barra lateral para maximizar el área de trabajo',
      'Diseño táctil ergonómico con botones y elementos adaptados al alcance del pulgar',
      'Cliente móvil Android APK (5.95 MB) con sincronización Offline-First'
    ]
  },
  '3pl': {
    image: './screenshots/12_3pl_tracking_gps_mapa.png',
    url: 'https://calcu.enterprise.app/logistics/tracking',
    badge: 'Módulo 3PL Logística & WMS',
    title: 'Tracking GPS Satelital y Control de Flota 3PL',
    desc: 'Visualización geográfica en tiempo real de unidades de reparto en ruta y barcos portacontenedores en alta mar con tiempos estimados de arribo (ETA), estado de carga y cálculo de costos por viaje.',
    bullets: [
      'Georreferenciación en mapa interactivo con rutas activas y paradas programadas',
      'Integración directa con app móvil de choferes (APK) para remitos digitales',
      'Liquidación automática por distancia y tiempo de choferes'
    ]
  },
  'cobranzas': {
    image: './screenshots/05_cobranzas_kanban_5etapas.png',
    url: 'https://calcu.enterprise.app/accounting/cobranzas',
    badge: 'Módulo Facturación & Cobranzas',
    title: 'Kanban de Cobranzas en 5 Etapas Automatizadas',
    desc: 'Matriz visual que transfiere facturas vencidas: Nuevo Deudor (día 31), Contactado (día 30 post vencimiento), Deudor Advertido (día 45), Deudor Complicado (día 60) e Intimación Moroso / Estudio Jurídico (día 63).',
    bullets: [
      'Emisión con un solo clic de cartas de intimación formal en PDF',
      'Control de límite de crédito con sugerencias de clientes por RUT y CI',
      'Facturación B2B vinculada a órdenes de compra y notas de crédito'
    ]
  },
  'contabilidad': {
    image: './screenshots/09_liquidacion_fiscal_dgi_bps.png',
    url: 'https://calcu.enterprise.app/accounting/dgi-bps',
    badge: 'Módulo Contabilidad & Fiscal',
    title: 'Liquidación Fiscal DGI Formulario 2178 y BPS',
    desc: 'Asientos contables automáticos por partida doble. Motor impositivo para liquidación de IVA compras/ventas, retenciones de IRAE y nómina salarial con aportes jubilatorios y FONASA.',
    bullets: [
      'Libro Diario inmutable y Libro Mayor con cuentas en T',
      'Reporte formal exportable conforme a directrices de DGI Uruguay',
      'Conciliación bancaria y devengamiento automático de gastos'
    ]
  },
  'supply': {
    image: './screenshots/16_supply_control_room.png',
    url: 'https://calcu.enterprise.app/supply/control-room',
    badge: 'Módulo Abastecimiento & Finanzas',
    title: 'Supply Chain Control Room & Landed Costs',
    desc: 'Cálculo algorítmico del Punto de Reorden (ROP), días de inventario disponible (DOH) y descomposición de costos de importación marítima para una fijación de precios con rentabilidad neta asegurada.',
    bullets: [
      'Detección anticipada de roturas de stock crítico con alertas tempranas',
      'Catálogo de servicios implícitos (Fletes marítimos, seguros y aduanas)',
      'Simulador de precios mayoristas, distribuidores y retail'
    ]
  },
  'monitoreo': {
    image: './screenshots/03_monitoreo_auditoria_iso27001.png',
    url: 'https://calcu.enterprise.app/monitoring/audit-logs',
    badge: 'Módulo Ciberseguridad & Auditoría',
    title: 'Auditoría Perimetral ISO 27001 y Control RBAC',
    desc: 'Trazabilidad estricta append-only de cada transacción y cambio en el sistema. Registro de ubicación, IP de origen, usuario y severidad, junto con escaneo perimetral automático de puertos.',
    bullets: [
      'Historial inmutable con filtros por fecha, IP y severidad',
      'Gestor de usuarios con permisos predefinidos por puesto corporativo',
      'Restricción granular de acceso a módulos sensibles'
    ]
  }
,
  'broker_otc': {
    image: './screenshots/29_broker_mesa_dinero_otc_kanban.png',
    url: 'https://calcu.enterprise.app/broker/otc-kanban',
    badge: 'Módulo Mesa de Dinero, Cripto OTC & Forex',
    title: 'Pipeline Kanban 7 Etapas & Cotizador OTC Congelado 15 Minutos',
    desc: 'Gestión de operaciones mayoristas OTC (USDT/USD, BTC, Oro) con cotizaciones instantáneas fijadas a 15 minutos, 100% de comisión neta para la mesa y carteras privadas aisladas por Chinese Wall.',
    bullets: [
      'Tablero Kanban con 7 etapas: Captación, KYC, Cotización Congelada, Fondeo, Ejecución, Liquidación y Cerrado',
      'Cálculo en vivo de comisiones netas y spreads calibrables en basis points (bps)',
      'Generación de recibos criptográficos congelados y bitácora SENACLAFT'
    ]
  },
  'broker_quant': {
    image: './screenshots/30_broker_tradingview_quant_backtester.png',
    url: 'https://calcu.enterprise.app/broker/quant-backtesting',
    badge: 'Laboratorio Cuantitativo & TradingView',
    title: 'TradingView Lightweight Charts & Backtesting con Volatilidad ATR',
    desc: 'Gráficos profesionales TradingView con osciladores y medias Golden Cross (SMA 50/200), canales Donchian y backtester algorítmico institucional con Stop Loss dinámico por Average True Range (ATR).',
    bullets: [
      'Gráficos reactivos en tiempo real con velas japonesas e indicadores técnicos',
      'Simulador histórico con métricas institucionales: Win Rate, Profit Factor, Max Drawdown y Sharpe Ratio',
      'Blindaje dinámico por ATR para filtrar falsas rupturas (whipsaws) en zonas laterales'
    ]
  },
  'broker_radar': {
    image: './screenshots/31_broker_radar_predictivo_noticias_pfi.png',
    url: 'https://calcu.enterprise.app/broker/predictive-radar',
    badge: 'Radar Predictivo & Previsiones IA',
    title: 'Radar Predictivo Macroeconómico, Impacto ΔP e Índice PFI',
    desc: 'Ingesta en vivo de noticias con enlaces directos a fuentes verificables (Federal Reserve, CoinDesk, ForexLive, BCU). Cálculo del diferencial estimado ΔP y del Índice Predictivo PFI (0 a 100).',
    bullets: [
      'Fórmula PFI: 40% Tendencia EMA + 35% Sentimiento Noticias + 25% Flujo de Liquidez P2P',
      'Detección automática de régimen de mercado: Alcista, Rango o Presión Bajista',
      'Protocolo de arbitraje preventivo: alerta automática para congelar cotizaciones'
    ]
  },
  'broker_gemini': {
    image: './screenshots/32_broker_gemini2_copilot_infografia_hd.png',
    url: 'https://calcu.enterprise.app/broker/ai-debate-infographic',
    badge: 'Debate Multi-Agente & Copiloto Gemini 2.0',
    title: 'Debate Multi-Agente en Vivo, Copiloto Gemini 2.0 e Infografías HD',
    desc: 'Deliberación colaborativa entre Gemini 2.0, Ollama Local (qwen2.5:7b) y el Agente Broker. Copiloto interactivo para consultas macro y generador de infografías ejecutivas HD con firma SHA-256.',
    bullets: [
      'Consenso colegiado entre 3 agentes de IA con rangos de precios objetivo y directivas',
      'Copiloto macroeconómico integrado con Gemini 2.0 para consultas en lenguaje natural',
      'Generación y exportación de infografías ejecutivas HD 1200x675 para inversores VIP'
    ]
  }
};

let currentTabKey = 'meli';

/**
 * Cambia la pestaña activa de la galería visual
 * @param {string} tabKey 
 */
function switchTab(tabKey) {
  currentTabKey = tabKey;
  const data = GALLERY_DATA[tabKey];
  if (!data) return;

  // Actualizar estilos de los botones de pestañas (preservando filtro de categoría si está oculto)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isHidden = btn.classList.contains('hidden');
    if (btn.dataset.tab === tabKey) {
      btn.className = 'tab-btn px-4 py-2 rounded-xl text-xs font-semibold tab-active transition-all shadow-md' + (isHidden ? ' hidden' : '');
    } else {
      btn.className = 'tab-btn px-4 py-2 rounded-xl text-xs font-semibold tab-inactive transition-all' + (isHidden ? ' hidden' : '');
    }
  });

  // Actualizar contenido visual del mockup
  const imgEl = document.getElementById('showcaseImage');
  const urlEl = document.getElementById('showcaseUrl');
  const badgeEl = document.getElementById('showcaseBadge');
  const titleEl = document.getElementById('showcaseTitle');
  const descEl = document.getElementById('showcaseDesc');
  const bulletsContainer = document.getElementById('showcaseBullets');

  if (imgEl) imgEl.src = data.image;
  if (urlEl) urlEl.textContent = data.url;
  if (badgeEl) badgeEl.textContent = data.badge;
  if (titleEl) titleEl.textContent = data.title;
  if (descEl) descEl.textContent = data.desc;

  if (bulletsContainer) {
    const { clear, el, icon } = window.csiaDom;
    clear(bulletsContainer);
    data.bullets.forEach(bullet => {
      bulletsContainer.appendChild(
        el('div', { className: 'flex items-center gap-2 text-xs text-slate-300' },
          icon('check-circle-2', 'w-4 h-4 text-emerald-400'),
          el('span', { text: bullet })
        )
      );
    });
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Expande la captura de la pestaña actualmente visible en el modal
 */
function expandCurrentScreenshot() {
  const data = GALLERY_DATA[currentTabKey];
  if (data) {
    openScreenshotModal(data.image, data.title);
  }
}

/**
 * Abre el modal Lightbox con la imagen y título proporcionados
 * @param {string} imgSrc 
 * @param {string} title 
 */
function openScreenshotModal(imgSrc, title) {
  const modal = document.getElementById('imageModal');
  const modalImg = document.getElementById('modalImg');
  const modalTitle = document.getElementById('modalTitle');

  if (!modal || !modalImg) return;

  modalImg.src = imgSrc;
  if (modalTitle) modalTitle.textContent = title || 'Captura del Sistema Calcu';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

/**
 * Cierra el modal Lightbox
 */
function closeScreenshotModal() {
  const modal = document.getElementById('imageModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function navigateScreenshotModal(delta) {
  const keys = Object.keys(GALLERY_DATA);
  if (!keys.length) return;
  const idx = keys.indexOf(currentTabKey);
  const nextIdx = idx === -1 ? 0 : (idx + delta + keys.length) % keys.length;
  const nextKey = keys[nextIdx];
  switchTab(nextKey);
  const data = GALLERY_DATA[nextKey];
  if (data) openScreenshotModal(data.image, data.title);
}

function switchGalleryCategory(category) {
  document.querySelectorAll('.gallery-cat-btn').forEach(btn => {
    if (btn.dataset.catFilter === category) {
      btn.className = 'gallery-cat-btn px-3 py-1.5 rounded-lg text-[11px] font-bold bg-cyan-600 text-white shadow-sm transition-all cursor-pointer';
    } else {
      btn.className = 'gallery-cat-btn px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition-all cursor-pointer';
    }
  });
  let firstVisible = null;
  let activeStillVisible = false;
  document.querySelectorAll('#galleryTabs .tab-btn').forEach(btn => {
    const match = category === 'all' || btn.dataset.cat === category;
    btn.classList.toggle('hidden', !match);
    if (match) {
      if (!firstVisible) firstVisible = btn.dataset.tab;
      if (btn.dataset.tab === currentTabKey) activeStillVisible = true;
    }
  });
  if (!activeStillVisible && firstVisible) {
    switchTab(firstVisible);
  }
}

document.addEventListener('keydown', (ev) => {
  const modal = document.getElementById('imageModal');
  if (!modal || modal.classList.contains('hidden')) return;
  if (ev.key === 'Escape') closeScreenshotModal();
  else if (ev.key === 'ArrowRight') navigateScreenshotModal(1);
  else if (ev.key === 'ArrowLeft') navigateScreenshotModal(-1);
});

// Inicializar Lucide Icons y pestaña por defecto al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  // Pestaña inicial destacada
  if (typeof switchTab === 'function') {
    switchTab('meli');
  }
});

/**
 * Control del Drawer Móvil
 */
function toggleMobileDrawer() {
  const drawer = document.getElementById('mobileDrawer');
  if (drawer) {
    drawer.classList.toggle('hidden');
  }
}

/**
 * Control del Drawer Lateral de Logo / Módulos
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
 * ==========================================================================
 * HARDENING Y POLÍTICA DE COOKIES (OWASP / ISO 27001)
 * En cumplimiento de la política de seguridad:
 * - Prohibida la persistencia a 1 año (2027) en el navegador del cliente.
 * - Toda cookie del cliente debe ser de sesión efímera o con max-age <= 3600s,
 *   con directivas obligatorias Secure y SameSite=Strict.
 * ==========================================================================
 */
const CookieGuardian = {
  set(name, value, maxAgeSeconds = 3600) {
    const safeMaxAge = Math.min(Number(maxAgeSeconds) || 3600, 3600);
    const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; max-age=${safeMaxAge}; path=/; SameSite=Strict${secureFlag}`;
  },
  get(name) {
    const matches = document.cookie.match(new RegExp('(?:^|; )' + encodeURIComponent(name).replace(/[-.\+*]/g, '\\$&') + '=([^;]*)'));
    return matches ? decodeURIComponent(matches[1]) : null;
  },
  delete(name) {
    document.cookie = `${encodeURIComponent(name)}=; max-age=0; path=/; SameSite=Strict`;
  }
};
window.CookieGuardian = CookieGuardian;
window.switchTab = switchTab;
window.expandCurrentScreenshot = expandCurrentScreenshot;
window.openScreenshotModal = openScreenshotModal;
window.closeScreenshotModal = closeScreenshotModal;
window.toggleMobileDrawer = toggleMobileDrawer;
window.openLogoDrawer = openLogoDrawer;
window.closeLogoDrawer = closeLogoDrawer;
window.switchGalleryCategory = switchGalleryCategory;
window.navigateScreenshotModal = navigateScreenshotModal;
