/**
 * Recorrido del panel: las 6 secciones, los dos modos y varios tamaños de
 * texto, con un resumen compacto por combinación. Requiere medir.js.
 *
 * Uso en la consola del panel (http://localhost:8888):
 *   await RecorridoPanel.correr({ textos: [16, 24, 32] })
 */
(function () {
  'use strict';
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const SECCIONES = ['overview', 'logs', 'books', 'users', 'governance', 'carga'];

  function fijarPrefs(prefs) {
    localStorage.setItem('invision-panel-a11y', JSON.stringify({ senales: false, voz: false, ...prefs }));
    const html = document.documentElement;
    A11yLogica.aplicarTemprano(html);
    A11y.iniciar();
  }

  async function correr({ textos = [16], modos = [false, true], axeEn = ['overview', 'books'] } = {}) {
    const guardadas = localStorage.getItem('invision-panel-a11y');
    const salida = { fecha: new Date().toISOString(), ancho: innerWidth, combinaciones: {} };
    try {
      for (const contraste of modos) {
        for (const texto of textos) {
          fijarPrefs({ texto, contraste });
          for (const s of SECCIONES) {
            switchTab(s, { anunciar: false });
            await espera(450);
            const r = await Medir.todo({ app: 'panel', conAxe: axeEn.includes(s) });
            salida.combinaciones[`${contraste ? 'AC' : 'EST'}-${texto}-${s}`] = {
              bajoAAA: r.contraste.bajoAAA,
              contraste: r.contraste.fallas.slice(0, 2).map((f) => `${f.texto.slice(0, 20)} ${f.color}/${f.fondo} ${f.ratio}`),
              obj48: r.objetivosBajo48.length,
              obj48ej: r.objetivosBajo48.slice(0, 2).map((o) => `${o.texto} ${o.ancho}x${o.alto}`),
              fuera: r.reflow.fuera.length,
              fueraEj: r.reflow.fuera.slice(0, 2).map((o) => `${o.texto} ${o.derecha}`),
              scrollH: r.reflow.desplazamientoHorizontal,
              vivas: r.regionesVivas.length,
              invisibles: r.enfocablesInvisibles.length,
              etiqueta: r.etiquetaEnNombre.length,
              axe: r.axe ? r.axe.violaciones.map((v) => `${v.id}:${v.nodos}`) : null,
            };
          }
        }
      }
    } finally {
      if (guardadas === null) localStorage.removeItem('invision-panel-a11y');
      else localStorage.setItem('invision-panel-a11y', guardadas);
      A11yLogica.aplicarTemprano(document.documentElement);
      A11y.iniciar();
      switchTab('overview', { anunciar: false });
    }
    // Resumen: solo las combinaciones con algo para mirar
    const problemas = Object.fromEntries(Object.entries(salida.combinaciones).filter(([, v]) =>
      v.bajoAAA || v.obj48 || v.fuera || v.scrollH || v.vivas !== 2 || v.invisibles || v.etiqueta || (v.axe && v.axe.length)));
    salida.totales = {
      combinaciones: Object.keys(salida.combinaciones).length,
      conProblemas: Object.keys(problemas).length,
    };
    salida.problemas = problemas;
    return salida;
  }

  window.RecorridoPanel = { correr };
})();
