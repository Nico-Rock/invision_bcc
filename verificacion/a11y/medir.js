/**
 * Medición de accesibilidad en el navegador (spec 002, D12).
 *
 * Mide lo que axe no ve: contraste AAA texto por texto componiendo los fondos
 * con alfa (incluido el faro), objetivos de 48 px, controles fuera de vista,
 * regiones vivas, movimiento y el anillo de foco. Sin dependencias: axe se
 * carga de la copia fijada en vendor/ (CWE-829), nunca de un CDN.
 *
 * Uso: inyectar este archivo en la app y correr `await Medir.todo({ app: 'panel' })`.
 */
(function () {
  'use strict';

  // --- Color -----------------------------------------------------------------

  function parsear(color) {
    const m = color && color.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }

  function mezclar(arriba, abajo) {
    const a = arriba.a;
    return {
      r: arriba.r * a + abajo.r * (1 - a),
      g: arriba.g * a + abajo.g * (1 - a),
      b: arriba.b * a + abajo.b * (1 - a),
      a: 1,
    };
  }

  function luminancia(c) {
    const canal = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * canal(c.r) + 0.7152 * canal(c.g) + 0.0722 * canal(c.b);
  }

  function contraste(a, b) {
    const la = luminancia(a), lb = luminancia(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

  // Peor caso del faro (R37 de 001): su color más oscuro, a la opacidad de la capa.
  function capaFaro() {
    const faro = document.querySelector('.fondo-faro');
    if (!faro || getComputedStyle(faro).display === 'none') return null;
    const opacidad = Number(getComputedStyle(faro).opacity) || 0;
    return opacidad ? { r: 0xD3, g: 0x45, b: 0x00, a: opacidad } : null;
  }

  // Fondo efectivo: compone de arriba hacia abajo los fondos con alfa.
  function fondo(el) {
    const capas = [];
    let nodo = el;
    while (nodo && nodo.nodeType === 1) {
      const c = parsear(getComputedStyle(nodo).backgroundColor);
      if (c && c.a > 0) {
        capas.push(c);
        if (c.a >= 1) break;
      }
      nodo = nodo.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    const opaco = capas.length && capas[capas.length - 1].a >= 1;
    if (opaco) base = capas.pop();
    // Si ningún ancestro es opaco hasta <html>, el faro queda detrás del texto.
    if (!opaco || nodo === document.body || nodo === document.documentElement) {
      const faro = capaFaro();
      if (faro) base = mezclar(faro, base);
    }
    for (let i = capas.length - 1; i >= 0; i--) base = mezclar(capas[i], base);
    return base;
  }

  function visible(el) {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    if (el.closest('.sr-only, [aria-hidden="true"]')) return false;
    return true;
  }

  function textoPropio(el) {
    return Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent)
      .join('')
      .trim();
  }

  // Barrido AAA: 7:1 texto normal, 4,5:1 texto grande (≥ 24 px o ≥ 18,66 px en negrita).
  function barridoContraste(raiz = document.body) {
    const fallas = [];
    let medidos = 0;
    const todos = raiz.querySelectorAll('*');
    for (const el of todos) {
      if (['SCRIPT', 'STYLE', 'SVG', 'svg', 'OPTION'].includes(el.tagName)) continue;
      const texto = textoPropio(el) || ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? (el.value || '') : '');
      if (!/[\p{L}\p{N}]/u.test(texto)) continue;
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      const color = parsear(cs.color);
      if (!color) continue;
      const bg = fondo(el);
      const fg = color.a < 1 ? mezclar(color, bg) : color;
      const tam = parseFloat(cs.fontSize);
      const negrita = Number(cs.fontWeight) >= 700;
      const grande = tam >= 24 || (negrita && tam >= 18.66);
      const minimo = grande ? 4.5 : 7;
      const ratio = contraste(fg, bg);
      medidos++;
      if (ratio + 1e-9 < minimo) {
        fallas.push({
          texto: texto.slice(0, 60),
          selector: selector(el),
          color: hex(fg),
          fondo: hex(bg),
          ratio: Math.round(ratio * 100) / 100,
          minimo,
        });
      }
    }
    // Placeholders: el navegador no los expone como nodo; se mide su color declarado.
    for (const campo of raiz.querySelectorAll('input[placeholder], textarea[placeholder]')) {
      if (!visible(campo)) continue;
      const c = parsear(getComputedStyle(campo, '::placeholder').color);
      if (!c) continue;
      const bg = fondo(campo);
      const ratio = contraste(c.a < 1 ? mezclar(c, bg) : c, bg);
      medidos++;
      if (ratio < 7) {
        fallas.push({ texto: `placeholder: ${campo.placeholder.slice(0, 40)}`, selector: selector(campo), color: hex(c), fondo: hex(bg), ratio: Math.round(ratio * 100) / 100, minimo: 7 });
      }
    }
    return { medidos, fallas };
  }

  function selector(el) {
    if (el.id) return `#${el.id}`;
    const clase = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
    const padre = el.parentElement && el.parentElement !== document.body ? selector(el.parentElement) + ' > ' : '';
    return (padre.length > 120 ? '… > ' : padre) + el.tagName.toLowerCase() + clase;
  }

  // --- Objetivos, reflow y regiones -----------------------------------------

  const INTERACTIVOS = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"]), summary';

  function objetivos(minimo = 48) {
    const chicos = [];
    for (const el of document.querySelectorAll(INTERACTIVOS)) {
      if (!visible(el) || el.closest('dialog:not([open])')) continue;
      // Las regiones desplazables enfocables no son objetivos de puntero.
      if (el.matches('[role="region"], main, section')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < minimo - 0.5 || r.height < minimo - 0.5) {
        chicos.push({ selector: selector(el), texto: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40), ancho: Math.round(r.width), alto: Math.round(r.height) });
      }
    }
    return chicos;
  }

  // Controles cortados o fuera del ancho de la ventana (1.4.4 y 1.4.10).
  function reflow() {
    const fuera = [];
    const ancho = document.documentElement.clientWidth;
    for (const el of document.querySelectorAll(INTERACTIVOS)) {
      if (!el.getClientRects().length || el.closest('.sr-only, dialog:not([open]), .skip-link')) continue;
      const r = el.getBoundingClientRect();
      let cortado = r.right > ancho + 1 || r.left < -1;
      // Recortado por un ancestro con overflow oculto.
      for (let p = el.parentElement; p && !cortado && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) {
          const rp = p.getBoundingClientRect();
          if (r.right > rp.right + 1 || r.bottom > rp.bottom + 1) cortado = true;
        }
      }
      if (cortado) fuera.push({ selector: selector(el), texto: (el.innerText || '').trim().slice(0, 40), izquierda: Math.round(r.left), derecha: Math.round(r.right), ancho });
    }
    return {
      desplazamientoHorizontal: document.documentElement.scrollWidth > ancho + 1,
      fuera,
    };
  }

  function regionesVivas() {
    const nodos = document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"], output');
    return Array.from(nodos).map((n) => ({
      selector: selector(n),
      modo: n.getAttribute('aria-live') || { status: 'polite', alert: 'assertive', log: 'polite' }[n.getAttribute('role')] || 'polite',
    }));
  }

  function movimiento() {
    const animados = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const dur = (v) => Math.max(...v.split(',').map((s) => parseFloat(s) * (s.includes('ms') ? 0.001 : 1)));
      const anim = cs.animationName !== 'none' ? dur(cs.animationDuration) : 0;
      const trans = dur(cs.transitionDuration);
      if (anim > 0.02 || trans > 0.02) animados.push({ selector: selector(el), animacion: anim, transicion: trans });
    }
    return animados;
  }

  // Anillo de foco del elemento enfocado ahora (usar después de un Tab real).
  function foco() {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    const anillo = parsear(cs.outlineColor);
    const bg = fondo(el.parentElement || el);
    return {
      selector: selector(el),
      focusVisible: el.matches(':focus-visible'),
      estilo: cs.outlineStyle,
      ancho: parseFloat(cs.outlineWidth),
      separacion: parseFloat(cs.outlineOffset),
      sombra: cs.boxShadow,
      color: anillo ? hex(anillo) : null,
      contrasteContraFondo: anillo ? Math.round(contraste(anillo, bg) * 100) / 100 : null,
      fondo: hex(bg),
    };
  }

  // Enfocables que no se ven (V14).
  function enfocablesInvisibles() {
    return Array.from(document.querySelectorAll(INTERACTIVOS))
      .filter((el) => el.closest('.sr-only') && !el.closest('.skip-link'))
      .map((el) => ({ selector: selector(el), texto: (el.textContent || '').trim().slice(0, 40) }));
  }

  // Nombre accesible que no contiene el texto visible (2.5.3).
  function etiquetaEnNombre() {
    const fallas = [];
    for (const el of document.querySelectorAll('button[aria-label], a[aria-label], [role="button"][aria-label]')) {
      if (!visible(el)) continue;
      const visibleTxt = (el.innerText || '').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
      const nombre = el.getAttribute('aria-label').toLowerCase();
      if (visibleTxt && !nombre.includes(visibleTxt)) fallas.push({ selector: selector(el), visible: visibleTxt, nombre });
    }
    return fallas;
  }

  // --- axe -------------------------------------------------------------------

  function cargarAxe(base) {
    if (window.axe) return Promise.resolve();
    return new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = `${base}/vendor/axe.min.js`;
      s.onload = ok;
      s.onerror = () => mal(new Error('No se pudo cargar axe desde vendor/'));
      document.head.appendChild(s);
    });
  }

  async function axe(base) {
    await cargarAxe(base);
    // axe libera su bandera interna un instante después de resolver: dos
    // corridas seguidas fallan con "Axe is already running" sin esta espera.
    for (let i = 0; i < 50 && window.axe._running; i++) await new Promise((r) => setTimeout(r, 100));
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return {
      version: window.axe.version,
      violaciones: r.violations.map((v) => ({ id: v.id, impacto: v.impact, nodos: v.nodes.length, ejemplo: v.nodes[0] && v.nodes[0].target.join(' ') })),
    };
  }

  async function todo({ app = 'desconocida', base = Medir.base, conAxe = true } = {}) {
    const c = barridoContraste();
    const html = document.documentElement;
    return {
      app,
      fecha: new Date().toISOString(),
      url: location.href,
      ventana: { ancho: innerWidth, alto: innerHeight },
      textoBase: parseFloat(getComputedStyle(html).fontSize),
      altoContraste: html.classList.contains('high-contrast') || document.body.classList.contains('high-contrast'),
      contraste: { medidos: c.medidos, bajoAAA: c.fallas.length, fallas: c.fallas },
      objetivosBajo48: objetivos(48),
      reflow: reflow(),
      regionesVivas: regionesVivas(),
      enfocablesInvisibles: enfocablesInvisibles(),
      etiquetaEnNombre: etiquetaEnNombre(),
      axe: conAxe ? await axe(base) : null,
    };
  }

  const scriptActual = document.currentScript && document.currentScript.src;
  window.Medir = {
    base: scriptActual ? scriptActual.replace(/\/medir\.js.*$/, '') : '',
    todo, barridoContraste, objetivos, reflow, regionesVivas, movimiento, foco,
    enfocablesInvisibles, etiquetaEnNombre, axe, contraste: (a, b) => contraste(parsear(a), parsear(b)),
  };
})();
