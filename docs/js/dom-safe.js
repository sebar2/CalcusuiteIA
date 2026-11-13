/*
 * dom-safe.js — Constructores DOM seguros (cero innerHTML / outerHTML / insertAdjacentHTML).
 */
(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function safeUrl(raw, fallback) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return fallback || '#';
    if (s.charAt(0) === '#' || s.charAt(0) === '/' || s.indexOf('./') === 0) return s;
    try {
      var u = new URL(s, window.location.origin);
      if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
        return s;
      }
    } catch (e) {}
    return fallback || '#';
  }

  function clear(node) {
    if (!node) return node;
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function appendChild(parent, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) {
      for (var i = 0; i < child.length; i++) appendChild(parent, child[i]);
      return;
    }
    if (child instanceof Node) {
      parent.appendChild(child);
    } else {
      parent.appendChild(document.createTextNode(String(child)));
    }
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'className' || k === 'class') {
          node.className = String(v);
        } else if (k === 'text') {
          node.textContent = String(v);
        } else if (k === 'style' && typeof v === 'string') {
          node.setAttribute('style', v);
        } else if (k === 'href') {
          node.setAttribute('href', safeUrl(v, '#'));
        } else if (k === 'checked' || k === 'disabled' || k === 'required') {
          node[k] = Boolean(v);
        } else if (k === 'value') {
          node.value = String(v);
        } else if (k === 'htmlFor' || k === 'for') {
          node.setAttribute('for', String(v));
        } else if (k === 'on') {
          Object.keys(v).forEach(function (ev) { node.addEventListener(ev, v[ev]); });
        } else if (v === true) {
          node.setAttribute(k, '');
        } else {
          node.setAttribute(k, String(v));
        }
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      appendChild(node, arguments[i]);
    }
    return node;
  }

  function icon(name, className) {
    return el('i', { 'data-lucide': name, className: className || 'w-4 h-4' });
  }

  function svg(viewBox, className, paths) {
    var s = document.createElementNS(SVG_NS, 'svg');
    if (className) s.setAttribute('class', className);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('viewBox', viewBox || '0 0 24 24');
    (paths || []).forEach(function (def) {
      var p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      p.setAttribute('stroke-width', String(def.width || 2));
      p.setAttribute('d', typeof def === 'string' ? def : def.d);
      s.appendChild(p);
    });
    return s;
  }

  function appendFormatted(parent, rawText) {
    var lines = String(rawText == null ? '' : rawText).split('\n');
    lines.forEach(function (line, idx) {
      if (idx > 0) parent.appendChild(document.createElement('br'));
      var re = /\*\*(.+?)\*\*/g;
      var last = 0;
      var m;
      while ((m = re.exec(line)) !== null) {
        if (m.index > last) parent.appendChild(document.createTextNode(line.slice(last, m.index)));
        var strong = document.createElement('strong');
        strong.textContent = m[1];
        parent.appendChild(strong);
        last = m.index + m[0].length;
      }
      if (last < line.length) parent.appendChild(document.createTextNode(line.slice(last)));
    });
    return parent;
  }

  global.csiaDom = {
    safeUrl: safeUrl,
    clear: clear,
    el: el,
    icon: icon,
    svg: svg,
    appendFormatted: appendFormatted,
  };
})(window);
