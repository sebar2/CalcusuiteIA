/**
 * ==========================================================================
 * CALCUSUITEIA - SHOWROOM OPERATIVO INTERACTIVO EN VIVO (HERO 2.0)
 * Benchmarks: Apollo.io + Vestta.io + Kommo.com
 * Simuladores en tiempo real de WMS 3D, Flota 3PL, Mercado Libre y WhatsApp IA
 * ==========================================================================
 */

(function () {
  'use strict';

  // 1. Conmutador de Pestañas del Showroom
  window.switchShowroomTab = function (tabId) {
    const tabs = ['wms', 'logistica', 'meli', 'whatsapp', 'finanzas'];
    tabs.forEach(t => {
      const btn = document.getElementById('tab-btn-' + t);
      const panel = document.getElementById('tab-panel-' + t);
      if (btn && panel) {
        if (t === tabId) {
          btn.className = 'showroom-tab-active px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30 transition-all flex items-center gap-2 cursor-pointer';
          panel.classList.remove('hidden');
          panel.classList.add('animate-in', 'fade-in', 'duration-300');
        } else {
          btn.className = 'showroom-tab-inactive px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-all flex items-center gap-2 cursor-pointer';
          panel.classList.add('hidden');
        }
      }
    });
  };

  // 2. Simulador Interactivo 1: WMS & Depósito 3D
  window.toggleWmsRackSlot = function (slotId) {
    const slot = document.getElementById(slotId);
    const badge = document.getElementById('wmsSlotStatus');
    const occText = document.getElementById('wmsOccupancyText');
    const occBar = document.getElementById('wmsOccupancyBar');
    if (!slot) return;

    const isOccupied = slot.dataset.occupied === 'true';
    if (isOccupied) {
      slot.dataset.occupied = 'false';
      slot.className = 'wms-slot p-2 rounded-lg border border-dashed border-slate-700 bg-slate-950/60 text-center cursor-pointer transition-all hover:border-cyan-500';
      slot.innerHTML = '<span class="text-[10px] text-slate-500 block">Vacío</span><span class="text-xs text-slate-600 font-mono">' + slotId + '</span>';
    } else {
      slot.dataset.occupied = 'true';
      slot.className = 'wms-slot p-2 rounded-lg border border-cyan-500/80 bg-cyan-950/40 text-center cursor-pointer transition-all shadow-md shadow-cyan-950/40 hover:scale-105';
      slot.innerHTML = '<span class="text-[10px] text-cyan-300 font-bold block">Pallet OK</span><span class="text-xs text-white font-mono font-bold">' + slotId + '</span>';
    }

    // Recalcular ocupación
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

  // 3. Simulador Interactivo 2: Logística 3PL & Flota
  window.update3plSimulator = function () {
    const kmInput = document.getElementById('srKm');
    const gasoilInput = document.getElementById('srGasoil');
    const margenInput = document.getElementById('srMargen');

    if (!kmInput || !gasoilInput || !margenInput) return;

    const km = parseFloat(kmInput.value) || 0;
    const gasoil = parseFloat(gasoilInput.value) || 0;
    const margen = parseFloat(margenInput.value) || 0;

    // Fórmula logística: Consumo 32L/100km + mantenimiento $18/km + chofer fijo $1200
    const litros = (km * 32) / 100;
    const costoCombustible = litros * gasoil;
    const costoMantenimiento = km * 18.5;
    const costoChofer = 1400;
    const costoOperativo = Math.round(costoCombustible + costoMantenimiento + costoChofer);
    const precioVenta = Math.round(costoOperativo * (1 + margen / 100));
    const ganancia = precioVenta - costoOperativo;

    document.getElementById('srKmVal').textContent = km + ' km';
    document.getElementById('srGasoilVal').textContent = '$' + gasoil + ' UYU';
    document.getElementById('srMargenVal').textContent = margen + '%';

    document.getElementById('srCostoOp').textContent = '$' + costoOperativo.toLocaleString('es-UY') + ' UYU';
    document.getElementById('srPrecioVenta').textContent = '$' + precioVenta.toLocaleString('es-UY') + ' UYU';
    document.getElementById('srGanancia').textContent = '+$' + ganancia.toLocaleString('es-UY') + ' UYU';
  };

  // 4. Simulador Interactivo 3: Mercado Libre Kanban
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

    // Animación visual
    if (card) {
      card.classList.add('scale-95', 'opacity-75');
      setTimeout(() => {
        card.classList.remove('scale-95', 'opacity-75');
      }, 150);
    }

    if (logList) {
      const time = new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const li = document.createElement('li');
      li.className = 'text-[11px] text-slate-300 flex items-center justify-between py-1 border-b border-slate-800/80';
      li.innerHTML = '<span>' + stageIcon + ' Orden #MLU-9842 &rarr; <strong>' + stageName + '</strong></span><span class="text-slate-500 font-mono text-[10px]">' + time + '</span>';
      logList.insertBefore(li, logList.firstChild);
      if (logList.children.length > 4) {
        logList.removeChild(logList.lastChild);
      }
    }
  };

  // 5. Simulador Interactivo 4: WhatsApp Omnicanal Copilot
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

    // Agregar mensaje usuario
    const userDiv = document.createElement('div');
    userDiv.className = 'flex justify-end mb-2.5 animate-in fade-in duration-200';
    userDiv.innerHTML = '<div class="bg-cyan-700 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 text-xs max-w-[85%] shadow-sm">' + userMsg + '</div>';
    box.appendChild(userDiv);
    box.scrollTop = box.scrollHeight;

    // Simular escritura bot
    setTimeout(() => {
      const botDiv = document.createElement('div');
      botDiv.className = 'flex justify-start mb-2.5 animate-in fade-in duration-200';
      botDiv.innerHTML = '<div class="bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2 text-xs max-w-[85%] shadow-sm leading-relaxed">' + botReply + '<div class="text-[9px] text-cyan-400 font-semibold mt-1.5 flex items-center gap-1"><span>🤖 CalcuSuiteIA Copilot</span><span>•</span><span>Respuesta en 0.4s</span></div></div>';
      box.appendChild(botDiv);
      box.scrollTop = box.scrollHeight;
    }, 450);
  };

  // Inicialización al cargar la página
  document.addEventListener('DOMContentLoaded', () => {
    update3plSimulator();
  });
})();
