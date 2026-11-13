/**
 * ==========================================================================
 * CALCUSUITEIA - MOTOR INTERACTIVO DE EXPERIENCIA (INTERACTIVE-SHOWROOM.JS)
 * Inspirado en Salesforce Customer 360 / Agentforce & Kommo Conversational CRM
 * Conmutadores Dinámicos: Módulos Operativos + Vistas por Rol Ejecutivo
 * ==========================================================================
 */

(function () {
  'use strict';

  // 1. Conmutador de Pestañas de Módulos (Showroom Operativo)
  window.switchShowroomTab = function (tabId) {
    const tabs = ['wms', 'logistica', 'meli', 'whatsapp', 'finanzas'];
    tabs.forEach(t => {
      const btn = document.getElementById('tab-btn-' + t);
      const panel = document.getElementById('tab-panel-' + t);
      if (btn && panel) {
        if (t === tabId) {
          btn.className = 'csia-tab-btn csia-tab-active';
          panel.classList.remove('hidden');
          panel.classList.add('csia-animate-fade-up');
        } else {
          btn.className = 'csia-tab-btn csia-tab-inactive';
          panel.classList.add('hidden');
          panel.classList.remove('csia-animate-fade-up');
        }
      }
    });
  };

  // 2. Conmutador de Soluciones por Rol Ejecutivo (Customer 360 Estilo Salesforce)
  const ROLE_DATA = {
    ceo: {
      title: 'Control Ejecutivo & Rentabilidad de Punta a Punta',
      badge: 'Para Directores Generales & CEOs',
      desc: 'Supervisa tu empresa desde una única pantalla con gobernanza perimetral ISO/IEC 27001. Elimina la dispersión de información entre sucursales, camiones y depósitos con reportes consolidados en tiempo real.',
      kpis: [
        { label: 'Visibilidad Operativa', val: '100% en Vivo', desc: 'Sin planillas manuales' },
        { label: 'Reducción de Costos Fijos', val: '-32%', desc: 'Por automatización de procesos' },
        { label: 'Aislamiento de Datos', val: 'Multi-Tenant', desc: 'PostgreSQL 16 dedicado' }
      ],
      points: [
        'Dashboard ejecutivo con alertas predictivas de desvíos de presupuesto.',
        'Trazabilidad total de accesos y auditoría de cambios por usuario con RBAC.',
        'Soporte directo prioritario VIP y acompañamiento de ingeniería.'
      ]
    },
    operaciones: {
      title: 'WMS Espacial, Racks 3D y Ruteo de Flota 3PL',
      badge: 'Para Gerentes de Operaciones & Logística',
      desc: 'Gestiona la entrada, almacenamiento y despacho de mercadería con detección de colisiones 3D. Controla la flota de camiones con telemetría GPS, geocercas y costos automáticos de combustible por km.',
      kpis: [
        { label: 'Precisión de Inventario', val: '99.8%', desc: 'Con escaneo de códigos QR' },
        { label: 'Tiempo de Despacho', val: '-45 min', desc: 'Rutas optimizadas por satélite' },
        { label: 'Cálculo de Fletes', val: 'En el Acto', desc: 'Con precios ANCAP actualizados' }
      ],
      points: [
        'Gemelo Digital 3D de depósito con asignación inteligente de pasillos y racks.',
        'APK móvil Android para choferes y operarios con prueba de entrega fotográfica.',
        'Cálculo dinámico de stock mínimo (ROP) y alertas tempranas de quiebre.'
      ]
    },
    comercial: {
      title: 'Omnicanalidad, Mercado Libre & WhatsApp con IA',
      badge: 'Para Directores Comerciales & Ventas B2B',
      desc: 'Centraliza todas las conversaciones de ventas en una bandeja omnicanal con WhatsApp QR nativo y notas de voz .opus reales. Sincroniza publicaciones de Mercado Libre en un Kanban de 5 etapas.',
      kpis: [
        { label: 'Tiempo de Respuesta', val: '< 15 seg', desc: 'Con Copilot IA 24/7' },
        { label: 'Tasa de Cierre de Leads', val: '+40%', desc: 'Flujo conversacional sin fricción' },
        { label: 'Control de SLA MeLi', val: '100% en Plazo', desc: 'Etiquetas automáticas de envío' }
      ],
      points: [
        'Chat Omnicanal multi-número para atender ventas y soporte sin riesgo de baneo.',
        'Publicación asistida en Mercado Libre con cálculo de comisiones y envíos 3 vías.',
        'Asesor comercial inteligente entrenado en tu catálogo de productos.'
      ]
    },
    finanzas: {
      title: 'Facturación CFE DGI, Cobranzas en 5 Etapas & Mesa de Dinero',
      badge: 'Para CFOs, Contadores & Finanzas',
      desc: 'Emite comprobantes fiscales electrónicos oficiales (e-Facturas 111) validados en el acto ante DGI. Automatiza el cobro con intimaciones legales fehacientes y monitorea el arbitraje cambiario de tesorería.',
      kpis: [
        { label: 'Días de Calle (DSO)', val: '-28 Días', desc: 'Aceleración del flujo de caja' },
        { label: 'Emisión de CFE', val: 'Instantánea', desc: 'Con CAE oficial autorizado' },
        { label: 'Partida Doble', val: '100% Cuadrada', desc: 'Sincronizada con el Libro Diario' }
      ],
      points: [
        'Cobranzas automatizadas con links directos de pago QR de Mercado Pago.',
        'Mesa de Dinero con spreads transparentes y muralla china (Chinese Wall).',
        'Liquidación fiscal asistida para formularios DGI 2178 y nómina BPS.'
      ]
    }
  };

  window.switchRoleView = function (roleId) {
    const roles = ['ceo', 'operaciones', 'comercial', 'finanzas'];
    roles.forEach(r => {
      const btn = document.getElementById('role-btn-' + r);
      if (btn) {
        if (r === roleId) {
          btn.className = 'csia-tab-btn csia-tab-active';
        } else {
          btn.className = 'csia-tab-btn csia-tab-inactive';
        }
      }
    });

    const data = ROLE_DATA[roleId];
    if (!data) return;

    const badgeEl = document.getElementById('roleBadge');
    const titleEl = document.getElementById('roleTitle');
    const descEl = document.getElementById('roleDesc');
    const kpisEl = document.getElementById('roleKpisContainer');
    const pointsEl = document.getElementById('rolePointsContainer');

    if (badgeEl) badgeEl.textContent = data.badge;
    if (titleEl) titleEl.textContent = data.title;
    if (descEl) descEl.textContent = data.desc;

    const { clear, el } = window.csiaDom;
    if (kpisEl) {
      clear(kpisEl);
      data.kpis.forEach(k => {
        kpisEl.appendChild(
          el('div', { className: 'p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center' },
            el('span', { className: 'text-2xl font-black text-cyan-400 font-mono block', text: k.val }),
            el('span', { className: 'text-xs font-bold text-white block mt-1', text: k.label }),
            el('span', { className: 'text-[10px] text-slate-400 block', text: k.desc })
          )
        );
      });
    }

    if (pointsEl) {
      clear(pointsEl);
      data.points.forEach(p => {
        pointsEl.appendChild(
          el('li', { className: 'flex items-start gap-2.5 text-xs text-slate-300' },
            el('span', { className: 'text-cyan-400 font-bold shrink-0 mt-0.5', text: '✓' }),
            el('span', { text: p })
          )
        );
      });
    }
  };

  // 3. Simulador 1: WMS & Depósito 3D
  window.toggleWmsRackSlot = function (slotId) {
    const slot = document.getElementById(slotId);
    const badge = document.getElementById('wmsSlotStatus');
    const occText = document.getElementById('wmsOccupancyText');
    const occBar = document.getElementById('wmsOccupancyBar');
    if (!slot) return;
    const { clear, el } = window.csiaDom;

    const isOccupied = slot.dataset.occupied === 'true';
    clear(slot);
    if (isOccupied) {
      slot.dataset.occupied = 'false';
      slot.className = 'wms-slot p-2 rounded-lg border border-dashed border-slate-700 bg-slate-950/60 text-center cursor-pointer transition-all hover:border-cyan-500';
      slot.appendChild(el('span', { className: 'text-[10px] text-slate-500 block', text: 'Vacío' }));
      slot.appendChild(el('span', { className: 'text-xs text-slate-600 font-mono', text: slotId }));
    } else {
      slot.dataset.occupied = 'true';
      slot.className = 'wms-slot p-2 rounded-lg border border-cyan-500/80 bg-cyan-950/40 text-center cursor-pointer transition-all shadow-md shadow-cyan-950/40 hover:scale-105';
      slot.appendChild(el('span', { className: 'text-[10px] text-cyan-300 font-bold block', text: 'Pallet OK' }));
      slot.appendChild(el('span', { className: 'text-xs text-white font-mono font-bold', text: slotId }));
    }

    const allSlots = document.querySelectorAll('.wms-slot');
    const occ = document.querySelectorAll('.wms-slot[data-occupied="true"]').length;
    const total = allSlots.length;
    const pct = Math.round((occ / total) * 100);

    if (occText) occText.textContent = pct + '% Ocupado (' + occ + '/' + total + ' ubicaciones)';
    if (occBar) occBar.style.width = pct + '%';
    if (badge) {
      badge.textContent = isOccupied ? 'Pallet retirado de ubicación ' + slotId : 'Pallet ingresado en ubicación ' + slotId;
      badge.className = isOccupied ? 'text-xs text-amber-400 font-medium' : 'text-xs text-emerald-400 font-medium';
    }
  };

  // 4. Simulador 2: Logística 3PL & Flota
  window.update3plSimulator = function () {
    const kmInput = document.getElementById('srKm');
    const gasoilInput = document.getElementById('srGasoil');
    const margenInput = document.getElementById('srMargen');

    if (!kmInput || !gasoilInput || !margenInput) return;

    const km = parseFloat(kmInput.value) || 0;
    const gasoil = parseFloat(gasoilInput.value) || 0;
    const margen = parseFloat(margenInput.value) || 0;

    const litros = (km * 32) / 100;
    const costoCombustible = litros * gasoil;
    const costoMantenimiento = km * 18.5;
    const costoChofer = 1400;
    const costoOperativo = Math.round(costoCombustible + costoMantenimiento + costoChofer);
    const precioVenta = Math.round(costoOperativo * (1 + margen / 100));
    const ganancia = precioVenta - costoOperativo;

    const kmVal = document.getElementById('srKmVal');
    const gasoilVal = document.getElementById('srGasoilVal');
    const margenVal = document.getElementById('srMargenVal');
    const costoOp = document.getElementById('srCostoOp');
    const precioVentaEl = document.getElementById('srPrecioVenta');
    const gananciaEl = document.getElementById('srGanancia');

    if (kmVal) kmVal.textContent = km + ' km';
    if (gasoilVal) gasoilVal.textContent = '$' + gasoil + ' UYU';
    if (margenVal) margenVal.textContent = margen + '%';

    if (costoOp) costoOp.textContent = '$' + costoOperativo.toLocaleString('es-UY') + ' UYU';
    if (precioVentaEl) precioVentaEl.textContent = '$' + precioVenta.toLocaleString('es-UY') + ' UYU';
    if (gananciaEl) gananciaEl.textContent = '+$' + ganancia.toLocaleString('es-UY') + ' UYU';
  };

  // 5. Simulador 3: Mercado Libre Kanban
  let meliStep = 0;
  const meliStages = ['Nuevas Órdenes', 'Picking en Depósito', 'Embalaje & Etiqueta', 'Despacho en Ruta', 'Entregado con Éxito'];
  const meliIcons = ['📥', '📦', '🏷️', '🚚', '✅'];

  window.advanceMeliOrder = function () {
    meliStep = (meliStep + 1) % meliStages.length;
    const stageName = meliStages[meliStep];
    const stageIcon = meliIcons[meliStep];

    const card = document.getElementById('meliCardContainer');
    const badge = document.getElementById('meliStatusBadge');
    const stepText = document.getElementById('meliStepNumber');
    const logList = document.getElementById('meliAuditLog');

    if (badge) {
      badge.textContent = stageIcon + ' ' + stageName;
      if (meliStep === 4) {
        badge.className = 'px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-xs';
      } else {
        badge.className = 'px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold text-xs';
      }
    }

    if (stepText) stepText.textContent = 'Etapa ' + (meliStep + 1) + ' de 5';

    if (card) {
      card.classList.add('scale-95', 'opacity-75');
      setTimeout(() => {
        card.classList.remove('scale-95', 'opacity-75');
      }, 150);
    }

    if (logList) {
      const { el } = window.csiaDom;
      const time = new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const li = el('li', { className: 'text-[11px] text-slate-300 flex items-center justify-between py-1 border-b border-slate-800/80' },
        el('span', null, `${stageIcon} Orden #MLU-9842 → `, el('strong', { text: stageName })),
        el('span', { className: 'text-slate-500 font-mono text-[10px]', text: time })
      );
      logList.insertBefore(li, logList.firstChild);
      if (logList.children.length > 4) {
        logList.removeChild(logList.lastChild);
      }
    }
  };

  // 6. Simulador 4: WhatsApp Omnicanal Copilot
  window.askShowroomCopilot = function (queryType) {
    const box = document.getElementById('waChatMessages');
    if (!box) return;

    let userMsg = '';
    let botReply = '';

    if (queryType === 'stock') {
      userMsg = '¿Tienen stock del SKU-8842 para despachar hoy 50 bultos a Montevideo?';
      botReply = '📦 **Stock Verificado en WMS:** Contamos con 124 unidades en Rack B2 (Depósito Central). Si confirmas antes de las 16:30 hs, se incluye en la ruta de las 18:00 hs con chofer asignado.';
    } else if (queryType === 'flete') {
      userMsg = 'Cotizame un flete de 6 pallets a Ciudad de la Costa con entrega en 24 hs.';
      botReply = '🚚 **Cotización Automática 3PL:** Flete directo de 6 pallets (3.200 kg) a Ciudad de la Costa: **$4.850 UYU + IVA**. Incluye seguro de carga en tránsito y tracking satelital GPS en tiempo real.';
    } else {
      userMsg = '¿Cómo funciona la facturación electrónica CFE con DGI?';
      botReply = '📊 **Facturación CFE Inmediata:** Emitimos e-Factura 111 con CAE oficial validado en el acto ante DGI y enviamos el PDF con Código QR fiscal al WhatsApp del cliente automáticamente.';
    }

    const { el, appendFormatted } = window.csiaDom;
    const userDiv = el('div', { className: 'flex justify-end mb-2.5 animate-in fade-in duration-200' },
      el('div', { className: 'bg-blue-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 text-xs max-w-[85%] shadow-sm', text: userMsg })
    );
    box.appendChild(userDiv);
    box.scrollTop = box.scrollHeight;

    setTimeout(() => {
      const bubble = el('div', { className: 'bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2 text-xs max-w-[85%] shadow-sm leading-relaxed' });
      appendFormatted(bubble, botReply);
      bubble.appendChild(
        el('div', { className: 'text-[9px] text-cyan-400 font-semibold mt-1.5 flex items-center gap-1' },
          el('span', { text: '🤖 CalcuSuiteIA Copilot' }),
          el('span', { text: '•' }),
          el('span', { text: 'Respuesta en 0.4s' })
        )
      );
      const botDiv = el('div', { className: 'flex justify-start mb-2.5 animate-in fade-in duration-200' }, bubble);
      box.appendChild(botDiv);
      box.scrollTop = box.scrollHeight;
    }, 450);
  };

  // 6. Simulador 3: Mesa de Dinero OTC & Spread Broker
  const FIN_RATES = {
    'USDT/UYU': { label: 'USDT / UYU', rateBps: 4235, unit: 'UYU' },
    'USD/UYU': { label: 'USD / UYU e-BROU', rateBps: 4200, unit: 'UYU' },
    'XAU/USD': { label: 'Oro Spot XAU / USD', rateBps: 268500, unit: 'USD (oz)' }
  };

  window.updateFinanzasSimulator = function () {
    const pairEl = document.getElementById('finPair');
    const amtEl = document.getElementById('finAmountUsd');
    const spreadEl = document.getElementById('finSpreadBps');
    if (!pairEl || !amtEl || !spreadEl) return;

    const cfg = FIN_RATES[pairEl.value] || FIN_RATES['USDT/UYU'];
    const amountUsd = Math.max(500, parseInt(amtEl.value, 10) || 15000);
    const spreadBps = Math.max(5, parseInt(spreadEl.value, 10) || 45);

    const grossLocalCents = Math.round(amountUsd * cfg.rateBps);
    const feeUsdCents = Math.round(amountUsd * spreadBps / 100);
    const netSpreadPct = (spreadBps / 100).toFixed(2);

    const amtVal = document.getElementById('finAmountVal');
    const sprVal = document.getElementById('finSpreadVal');
    const refOut = document.getElementById('finOutRefRate');
    const grossOut = document.getElementById('finOutGross');
    const feeOut = document.getElementById('finOutFeeUsd');

    if (amtVal) amtVal.textContent = '$' + amountUsd.toLocaleString('es-UY') + ' USD';
    if (sprVal) sprVal.textContent = spreadBps + ' bps (' + netSpreadPct + '%)';
    if (refOut) refOut.textContent = (cfg.rateBps / 100).toFixed(2) + ' ' + cfg.unit;
    if (grossOut) {
      grossOut.textContent = cfg.unit === 'UYU'
        ? '$U ' + Math.round(grossLocalCents / 100).toLocaleString('es-UY')
        : (amountUsd / (cfg.rateBps / 100)).toFixed(2) + ' oz';
    }
    if (feeOut) feeOut.textContent = 'USD ' + (feeUsdCents / 100).toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Inicialización
  document.addEventListener('DOMContentLoaded', () => {
    update3plSimulator();
    window.updateFinanzasSimulator();
    if (typeof switchRoleView === 'function') {
      switchRoleView('ceo');
    }
  });
})();
