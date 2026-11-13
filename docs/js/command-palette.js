/*
 * command-palette.js — Paleta de Comandos Rápida (Ctrl+K / Cmd+K) 100% CSP-safe.
 * Usa window.csiaDom.el() y clear(); cero innerHTML ni eval.
 */
(function () {
  'use strict';

  var ITEMS = [
    { label: 'Inicio', desc: 'Portada principal CalcuSuiteIA 2026', href: 'index.html#inicio', cat: 'Navegación' },
    { label: 'Showroom Interactivo', desc: 'Simuladores WMS 3D, Logística 3PL y Mesa Broker OTC', href: 'index.html#showroom', cat: 'Experiencia' },
    { label: 'Soluciones por Rol', desc: 'Vistas para CEO, Operaciones, Comercial y Finanzas', href: 'index.html#roles', cat: 'Experiencia' },
    { label: 'Galería de Pantallas', desc: '19 capturas reales de la suite en producción', href: 'index.html#galeria', cat: 'Experiencia' },
    { label: 'Mesa de Dinero Broker OTC', desc: 'TradingView Quant ATR, PFI y Chinese Wall Multi-Tenant', href: 'modulo-mesa-dinero-broker.html', cat: 'Módulos' },
    { label: 'Gemelo Digital 3D & WMS', desc: 'Motor Three.js espacial y detección AABB', href: 'modulo-gemelo-digital-3d.html', cat: 'Módulos' },
    { label: 'Logística 3PL & App Móvil', desc: 'Tracking GPS y app Android 20:9 Offline-First', href: 'modulo-logistica-3pl.html', cat: 'Módulos' },
    { label: 'Facturación CFE DGI & Contabilidad', desc: 'e-Facturas, Libro Diario/Mayor y DGI/BPS', href: 'modulo-facturacion-cfe.html', cat: 'Módulos' },
    { label: 'Seguridad Zero-Trust & Vault v2', desc: 'Encrypt-then-MAC, JTI, RLS y Soporte JIT 60m', href: 'seguridad.html', cat: 'Seguridad' },
    { label: 'Manual Técnico 2026 (Web + PDF)', desc: '29 capítulos, Router IA Híbrido y canales', href: 'documentacion.html', cat: 'Documentación' },
    { label: 'Descargar Manual PDF Completo', desc: 'Edición Enterprise 2026 (29 capítulos offline)', href: 'MANUAL_COMPLETO_CALCU_2026.pdf', cat: 'Documentación' },
    { label: 'Blog de Ingeniería', desc: 'Artículos sobre Broker PFI, RTX 3080 y Hardening', href: 'blog.html', cat: 'Documentación' }
  ];

  var modal = null;
  var inputEl = null;
  var listEl = null;
  var filtered = ITEMS.slice();
  var selectedIdx = 0;

  function renderList() {
    if (!listEl || !window.csiaDom) return;
    var el = window.csiaDom.el;
    window.csiaDom.clear(listEl);

    if (filtered.length === 0) {
      listEl.appendChild(
        el('div', { className: 'px-4 py-8 text-center text-xs text-slate-400', text: 'Sin resultados para tu búsqueda.' })
      );
      return;
    }

    filtered.forEach(function (item, idx) {
      var active = idx === selectedIdx;
      var row = el('a', {
        href: item.href,
        className: 'flex items-center justify-between px-4 py-3 rounded-xl transition-colors ' +
          (active ? 'bg-cyan-500/15 border border-cyan-500/40 text-white' : 'hover:bg-slate-800/70 text-slate-300 border border-transparent'),
        on: {
          click: function () { closeCommandPalette(); },
          mouseenter: function () { selectedIdx = idx; }
        }
      },
        el('div', null,
          el('div', { className: 'text-sm font-bold text-white', text: item.label }),
          el('div', { className: 'text-xs text-slate-400 mt-0.5', text: item.desc })
        ),
        el('span', { className: 'text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 shrink-0', text: item.cat })
      );
      listEl.appendChild(row);
    });
  }

  function buildModal() {
    if (modal || !window.csiaDom) return;
    var el = window.csiaDom.el;

    inputEl = el('input', {
      type: 'text',
      placeholder: 'Buscar módulo, documentación, Broker OTC, Gemelo 3D, Seguridad...',
      className: 'w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none py-3 px-2',
      attrs: { 'aria-label': 'Buscar en CalcuSuiteIA' },
      on: {
        input: function () {
          var q = (inputEl.value || '').trim().toLowerCase();
          filtered = !q ? ITEMS.slice() : ITEMS.filter(function (it) {
            return (it.label + ' ' + it.desc + ' ' + it.cat).toLowerCase().indexOf(q) !== -1;
          });
          selectedIdx = 0;
          renderList();
        },
        keydown: function (ev) {
          if (ev.key === 'ArrowDown') {
            ev.preventDefault();
            if (filtered.length) selectedIdx = (selectedIdx + 1) % filtered.length;
            renderList();
          } else if (ev.key === 'ArrowUp') {
            ev.preventDefault();
            if (filtered.length) selectedIdx = (selectedIdx - 1 + filtered.length) % filtered.length;
            renderList();
          } else if (ev.key === 'Enter' && filtered[selectedIdx]) {
            ev.preventDefault();
            var href = filtered[selectedIdx].href;
            closeCommandPalette();
            window.location.href = href;
          }
        }
      }
    });

    listEl = el('div', { className: 'max-h-80 overflow-y-auto p-2 space-y-1' });

    var box = el('div', {
      className: 'w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden',
      on: { click: function (ev) { ev.stopPropagation(); } }
    },
      el('div', { className: 'flex items-center gap-2 px-4 border-b border-slate-800 bg-slate-950/60' },
        el('span', { className: 'text-cyan-400 font-mono text-xs font-bold', text: '⌘K' }),
        inputEl,
        el('button', {
          type: 'button',
          className: 'text-[10px] font-mono text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 border border-slate-700',
          text: 'ESC',
          on: { click: function () { closeCommandPalette(); } }
        })
      ),
      listEl
    );

    modal = el('div', {
      id: 'csiaCommandPaletteModal',
      className: 'hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm items-start justify-center pt-20 px-4',
      on: { click: function () { closeCommandPalette(); } }
    }, box);

    document.body.appendChild(modal);
  }

  function openCommandPalette() {
    buildModal();
    if (!modal) return;
    filtered = ITEMS.slice();
    selectedIdx = 0;
    if (inputEl) inputEl.value = '';
    renderList();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (inputEl) setTimeout(function () { inputEl.focus(); }, 20);
  }

  function closeCommandPalette() {
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  document.addEventListener('keydown', function (ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (modal && !modal.classList.contains('hidden')) {
        closeCommandPalette();
      } else {
        openCommandPalette();
      }
    } else if (ev.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeCommandPalette();
    }
  });

  window.openCommandPalette = openCommandPalette;
  window.closeCommandPalette = closeCommandPalette;
})();
