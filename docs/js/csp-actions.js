/*
 * csp-actions.js — Reemplazo CSP-safe de los atributos inline on* (onclick, onsubmit, ...).
 *
 * Cada elemento declara sus acciones como JSON en data-on-<evento>, por ejemplo:
 *   <button data-on-click='[["call","openAccountModal",["PIONERO"]]]'>
 * Operaciones soportadas (sin eval / new Function):
 *   ["call", nombreFuncionGlobal, [args]]   args: literales JSON, {"$":"event"} o {"$":"this"}
 *   ["self"]                                 continúa sólo si event.target === elemento
 *   ["stop"]                                 event.stopPropagation()
 *   ["set", idElemento, valor]               document.getElementById(id).value = valor
 * Los listeners se enlazan directamente al elemento (misma semántica que un handler inline),
 * incluido el HTML inyectado dinámicamente (MutationObserver).
 */
(function () {
  'use strict';

  var EVENTS = ['click', 'submit', 'change', 'input'];
  var BOUND = '__calcuCspBound';

  function resolveArg(arg, ev, el) {
    if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
      if (arg.$ === 'event') return ev;
      if (arg.$ === 'this') return el;
    }
    return arg;
  }

  function runOps(ops, ev, el) {
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (!Array.isArray(op)) continue;
      switch (op[0]) {
        case 'self':
          if (ev.target !== el) return;
          break;
        case 'stop':
          ev.stopPropagation();
          break;
        case 'set': {
          var target = document.getElementById(String(op[1]));
          if (target) target.value = String(op[2]);
          break;
        }
        case 'call': {
          var name = String(op[1]);
          if (!/^[A-Za-z_$][\w$]*$/.test(name)) return;
          var fn = window[name];
          if (typeof fn !== 'function') {
            if (window.console) console.warn('[csp-actions] función no disponible:', name);
            return;
          }
          var args = (op[2] || []).map(function (a) { return resolveArg(a, ev, el); });
          fn.apply(el, args);
          break;
        }
        default:
          break;
      }
    }
  }

  function bindElement(el) {
    if (!el || el.nodeType !== 1) return;
    var bound = el[BOUND] || (el[BOUND] = {});
    EVENTS.forEach(function (type) {
      var attr = 'data-on-' + type;
      if (bound[type] || !el.hasAttribute(attr)) return;
      var ops;
      try {
        ops = JSON.parse(el.getAttribute(attr));
      } catch (e) {
        if (window.console) console.warn('[csp-actions] JSON inválido en', attr, el);
        return;
      }
      if (!Array.isArray(ops)) return;
      bound[type] = true;
      el.addEventListener(type, function (ev) { runOps(ops, ev, el); });
    });
  }

  var SELECTOR = EVENTS.map(function (t) { return '[data-on-' + t + ']'; }).join(',');

  function bindTree(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) bindElement(root);
    var list = root.querySelectorAll(SELECTOR);
    for (var i = 0; i < list.length; i++) bindElement(list[i]);
  }

  function start() {
    bindTree(document);
    if (typeof MutationObserver === 'function') {
      new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          for (var i = 0; i < m.addedNodes.length; i++) bindTree(m.addedNodes[i]);
        });
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
