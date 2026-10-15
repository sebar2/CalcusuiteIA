/**
 * ==========================================================================
 * CALCU SUITE 2026 - MODULO PRINCIPAL (MAIN.JS)
 * Control de Galería de Pantallas, Lightbox Modal y Navegación
 * ==========================================================================
 */

// Diccionario de datos para las pestañas de inspección visual
const GALLERY_DATA = {
  '3pl': {
    image: './screenshots/12_3pl_tracking_gps_mapa.png',
    url: 'https://calcu.enterprise.app/logistics/tracking',
    badge: 'Módulo 3PL Logística & WMS',
    title: 'Tracking GPS Satelital y Control de Flota',
    desc: 'Visualización geográfica en tiempo real de unidades de reparto en ruta y barcos portacontenedores en alta mar con tiempos estimados de arribo (ETA), estado de carga y cálculo de costos por viaje.',
    bullets: [
      'Georreferenciación en mapa interactivo con rutas activas',
      'Integración directa con app móvil de choferes (APK)',
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
      'Detección anticipada de roturas de stock crítico',
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
};

let currentTabKey = '3pl';

/**
 * Cambia la pestaña activa de la galería visual
 * @param {string} tabKey 
 */
function switchTab(tabKey) {
  currentTabKey = tabKey;
  const data = GALLERY_DATA[tabKey];
  if (!data) return;

  // Actualizar estilos de los botones de pestañas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabKey) {
      btn.className = 'tab-btn px-4 py-2 rounded-xl text-xs font-semibold tab-active transition-all shadow-md';
    } else {
      btn.className = 'tab-btn px-4 py-2 rounded-xl text-xs font-semibold tab-inactive transition-all';
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
    bulletsContainer.innerHTML = data.bullets.map(bullet => `
      <div class="flex items-center gap-2 text-xs text-slate-300">
        <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i>
        <span>${bullet}</span>
      </div>
    `).join('');
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

// Inicialización de componentes al cargar la ventana
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

// Exportar globalmente
window.switchTab = switchTab;
window.expandCurrentScreenshot = expandCurrentScreenshot;
window.openScreenshotModal = openScreenshotModal;
window.closeScreenshotModal = closeScreenshotModal;
