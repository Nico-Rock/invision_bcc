/**
 * Teclas del reproductor (spec 003, R10 y D10; variante S3 de la simulación
 * de 75 recorridos). Módulo puro, sin React ni navegador: la tabla es la
 * fuente única de las teclas, de la ayuda y del resumen hablado, y la
 * decisión se prueba con `node --test`.
 *
 * Las teclas actúan solo con el foco dentro del reproductor. Fuera de él no
 * hacen nada y el navegador o el lector conservan su comportamiento.
 */

/** Contenedor del reproductor (AudioPlayer.jsx). */
export const SELECTOR_REPRODUCTOR = '.player-dock';

// `claves` va de `event.key` (las letras en minúscula) al valor de la acción
export const TECLAS_REPRODUCTOR = [
  {
    id: 'alternar',
    teclas: ['Espacio'],
    claves: { ' ': null },
    accion: 'Reproducir o pausar',
    corto: 'pausa',
    hablado: 'Espacio para reproducir o pausar',
  },
  {
    id: 'saltar',
    teclas: ['←', '→'],
    claves: { ArrowLeft: -15, ArrowRight: 15 },
    accion: 'Retroceder o adelantar 15 segundos',
    corto: '15 s',
    hablado: 'flechas izquierda y derecha para moverte 15 segundos',
  },
  {
    id: 'volumen',
    teclas: ['↑', '↓'],
    claves: { ArrowUp: 1, ArrowDown: -1 },
    accion: 'Subir o bajar el volumen de a 10 %',
    corto: 'volumen',
    hablado: 'flechas arriba y abajo para el volumen',
  },
  {
    id: 'capitulo',
    teclas: ['N', 'P'],
    claves: { n: 1, p: -1 },
    accion: 'Capítulo siguiente o anterior',
    corto: 'capítulo',
    hablado: 'N y P para cambiar de capítulo',
  },
  {
    id: 'silencio',
    teclas: ['M'],
    claves: { m: null },
    accion: 'Silenciar o restaurar el sonido',
    corto: 'silencio',
    hablado: 'M para silenciar',
  },
];

const CAMPOS = ['INPUT', 'TEXTAREA', 'SELECT'];

/**
 * Describe el elemento con el foco: si está dentro del reproductor, si es un
 * campo (texto, rango o selector, que manejan sus propias teclas) y si es un
 * botón o enlace (Espacio ya lo activa).
 */
export const describirFoco = (el, selector = SELECTOR_REPRODUCTOR) => {
  if (!el) return { dentro: false, escribiendo: false, sobreControl: false };
  const rol = typeof el.getAttribute === 'function' ? el.getAttribute('role') : null;
  return {
    dentro: typeof el.closest === 'function' && !!el.closest(selector),
    escribiendo: CAMPOS.includes(el.tagName) || !!el.isContentEditable,
    sobreControl: el.tagName === 'BUTTON' || el.tagName === 'A' || rol === 'button',
  };
};

/**
 * Qué hace una tecla según dónde está el foco. Devuelve { id, valor } o null.
 * Nunca con modificadores (Ctrl, Alt, Meta, Mayúscula), con la tecla
 * mantenida, con un evento que otro control ya usó, mientras se escribe ni en
 * un rango o un selector. Espacio sobre un botón no se toma: el botón se
 * activa solo (así "Pausar" no pausa dos veces).
 */
export const accionReproductor = (e, foco) => {
  if (!e || !foco || !foco.dentro) return null;
  if (e.defaultPrevented || e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return null;
  if (foco.escribiendo) return null;
  const clave = typeof e.key === 'string' && e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const fila = TECLAS_REPRODUCTOR.find((f) => Object.prototype.hasOwnProperty.call(f.claves, clave));
  if (!fila) return null;
  if (fila.id === 'alternar' && foco.sobreControl) return null;
  return { id: fila.id, valor: fila.claves[clave] };
};

/**
 * Al elegir un libro: ¿hay que cargarlo? No si ya es el libro cuya pista quedó
 * asignada (`libroCargadoId` del contexto de audio): Espacio sobre la tarjeta
 * recién elegida lo reiniciaba desde 0:00. Sí si es otro libro o si la carga
 * anterior falló (playChapter limpia `libroCargadoId` al comenzar y solo lo
 * fija cuando la pista se asignó), para que se pueda reintentar.
 */
export const debeRecargar = ({ libroCargadoId = null, libro = null } = {}) => {
  if (!libro) return false;
  return libroCargadoId == null || String(libroCargadoId) !== String(libro.id);
};
