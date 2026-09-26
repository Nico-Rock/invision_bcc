/**
 * Lógica pura de accesibilidad del panel (spec 002, D10 y D16).
 *
 * Sin DOM ni estado: funciona igual en el navegador (window.A11yLogica) y en
 * Node (tests con `node --test`). Es la FUENTE ÚNICA de secciones y atajos:
 * de acá salen el manejador de teclas, la ventana de ayuda, los anuncios y
 * los aria-keyshortcuts (R39).
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else raiz.A11yLogica = modulo;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Texto: se guarda en px "equivalentes" sobre 16 y se aplica como FACTOR del
  // tamaño que la persona eligió en su navegador (R1). 32/16 = 200 %.
  const TEXTO_BASE = 16, TEXTO_MIN = 12, TEXTO_MAX = 32, TEXTO_PASO = 2;
  // Desde acá la barra lateral deja de ser fija y todo pasa a una columna (D5).
  const UMBRAL_AMPLIO = 24;

  // Decisión A3 de la reunión del 29/09: única constante a cambiar.
  const VOZ_POR_DEFECTO = true;

  const PREFS_POR_DEFECTO = Object.freeze({ texto: TEXTO_BASE, contraste: false, senales: true, voz: VOZ_POR_DEFECTO });
  const CLAVE = 'invision-panel-a11y';

  function acotarTexto(valor) {
    if (typeof valor !== 'number' || !Number.isFinite(valor)) return TEXTO_BASE;
    const redondeado = Math.round(valor / TEXTO_PASO) * TEXTO_PASO;
    return Math.min(TEXTO_MAX, Math.max(TEXTO_MIN, redondeado));
  }

  function siguienteTexto(actual, direccion) {
    return acotarTexto(acotarTexto(actual) + Math.sign(direccion) * TEXTO_PASO);
  }

  const factorTexto = (texto) => acotarTexto(texto) / TEXTO_BASE;
  const textoAmplio = (texto) => acotarTexto(texto) >= UMBRAL_AMPLIO;

  function siguienteVolumen(actual, direccion) {
    const base = Number.isFinite(actual) ? actual : 1;
    const nuevo = Math.round((base + Math.sign(direccion) * 0.1) * 10) / 10;
    return Math.min(1, Math.max(0, nuevo));
  }

  function pistaVecina(total, indice, direccion) {
    const siguiente = indice + Math.sign(direccion);
    return total > 0 && siguiente >= 0 && siguiente < total ? siguiente : null;
  }

  // Acepta solo números y booleanos; cualquier otra cosa deja el valor por
  // defecto sin lanzar error (CWE-20).
  function validarPrefs(entrada) {
    let datos = entrada;
    if (typeof datos === 'string') {
      try { datos = JSON.parse(datos); } catch (e) { datos = null; }
    }
    const p = { ...PREFS_POR_DEFECTO };
    if (!datos || typeof datos !== 'object') return p;
    if (typeof datos.texto === 'number') p.texto = acotarTexto(datos.texto);
    for (const clave of ['contraste', 'senales', 'voz']) {
      if (typeof datos[clave] === 'boolean') p[clave] = datos[clave];
    }
    return p;
  }

  const SECCIONES = [
    { id: 'overview', tecla: '1', nombre: 'Resumen ejecutivo' },
    { id: 'logs', tecla: '2', nombre: 'Registros de acceso' },
    { id: 'books', tecla: '3', nombre: 'Explorador de audios' },
    { id: 'users', tecla: '4', nombre: 'Usuarios y soporte' },
    { id: 'governance', tecla: '5', nombre: 'Gobernanza y reglas' },
    { id: 'carga', tecla: '6', nombre: 'Cargar audiolibro' },
  ];

  // `teclas`: valores de KeyboardEvent.key; `etiqueta`: lo que se muestra en <kbd>.
  const ATAJOS = [
    { id: 'secciones', teclas: ['1', '2', '3', '4', '5', '6'], etiqueta: ['1', 'a', '6'], ariaKeyshortcuts: '1 2 3 4 5 6',
      accion: 'Ir a Resumen, Registros, Explorador, Usuarios, Gobernanza o Cargar', voz: '1 a 6 para cambiar de sección' },
    { id: 'buscar', teclas: ['s', 'S'], etiqueta: ['S'], ariaKeyshortcuts: 'S',
      accion: 'Ir al buscador de audios', voz: 'S para buscar audios' },
    { id: 'pausa', teclas: [' ', 'Espacio'], etiqueta: ['Espacio'], ariaKeyshortcuts: 'Space', reproductor: true,
      accion: 'Reproducir o pausar', voz: 'Espacio para pausar' },
    { id: 'saltar', teclas: ['ArrowLeft', 'ArrowRight'], etiqueta: ['←', '/', '→'], ariaKeyshortcuts: 'ArrowLeft ArrowRight', reproductor: true,
      accion: 'Retroceder o adelantar 15 segundos', voz: 'flechas izquierda y derecha para moverte 15 segundos' },
    { id: 'volumen', teclas: ['ArrowUp', 'ArrowDown'], etiqueta: ['↑', '/', '↓'], ariaKeyshortcuts: 'ArrowUp ArrowDown', reproductor: true,
      accion: 'Subir o bajar el volumen de a 10 %', voz: 'flechas arriba y abajo para el volumen' },
    { id: 'pista', teclas: ['n', 'N', 'p', 'P'], etiqueta: ['N', '/', 'P'], ariaKeyshortcuts: 'N P', reproductor: true,
      accion: 'Pista siguiente o anterior del mismo libro', voz: 'N y P para la pista siguiente o anterior' },
    { id: 'silencio', teclas: ['m', 'M'], etiqueta: ['M'], ariaKeyshortcuts: 'M', reproductor: true,
      accion: 'Silenciar o restaurar el sonido', voz: 'M para silenciar' },
    { id: 'cerrar', teclas: ['Escape'], etiqueta: ['Esc'], ariaKeyshortcuts: 'Escape',
      accion: 'Cerrar esta ayuda o el reproductor', voz: 'Escape para cerrar' },
    { id: 'ayuda', teclas: ['h', 'H', '?'], etiqueta: ['H', 'o', '?'], ariaKeyshortcuts: 'H Shift+Slash',
      accion: 'Abrir y escuchar esta ayuda', voz: 'H o signo de pregunta para repetir esta ayuda' },
  ];

  function atajoDeTecla(tecla) {
    return ATAJOS.find((a) => a.teclas.includes(tecla)) || null;
  }

  function resumenAtajos() {
    const partes = ATAJOS.map((a) => a.voz);
    return `Atajos disponibles: ${partes.slice(0, -1).join(', ')}, y ${partes[partes.length - 1]}. `
      + 'Los atajos del reproductor funcionan con un audio abierto.';
  }

  const MENSAJES_DICTADO = {
    permiso: { texto: 'El navegador no tiene permiso para usar el micrófono. Habilitalo en el candado de la barra de direcciones y probá de nuevo.', urgente: true },
    'no-speech': { texto: 'No escuché ninguna palabra. Probá de nuevo más cerca del micrófono.', urgente: true },
    aborted: { texto: 'Dictado cancelado.', urgente: false },
    'audio-capture': { texto: 'No se encontró un micrófono conectado.', urgente: true },
    otro: { texto: 'No logré entender el dictado. Intentá de nuevo.', urgente: true },
  };

  function mensajeDictado(codigo) {
    if (codigo === 'not-allowed' || codigo === 'service-not-allowed') return MENSAJES_DICTADO.permiso;
    return MENSAJES_DICTADO[codigo] || MENSAJES_DICTADO.otro;
  }

  // Corre en <head>, antes del primer pintado (R37): sin parpadeo de modo ni tamaño.
  function aplicarTemprano(html, almacen) {
    let prefs = PREFS_POR_DEFECTO;
    try {
      const fuente = almacen || (typeof localStorage !== 'undefined' ? localStorage : null);
      if (fuente) prefs = validarPrefs(fuente.getItem(CLAVE));
    } catch (e) { /* storage bloqueado: valores por defecto */ }
    html.classList.toggle('high-contrast', prefs.contraste);
    html.classList.toggle('texto-amplio', textoAmplio(prefs.texto));
    html.style.setProperty('--font-factor', String(factorTexto(prefs.texto)));
    return prefs;
  }

  return {
    TEXTO_BASE, TEXTO_MIN, TEXTO_MAX, TEXTO_PASO, UMBRAL_AMPLIO, VOZ_POR_DEFECTO, PREFS_POR_DEFECTO, CLAVE,
    acotarTexto, siguienteTexto, factorTexto, textoAmplio, siguienteVolumen, pistaVecina, validarPrefs,
    SECCIONES, ATAJOS, atajoDeTecla, resumenAtajos, mensajeDictado, aplicarTemprano,
  };
});
