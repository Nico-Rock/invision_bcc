/**
 * Atajos globales con Alt. Módulo puro, sin React ni navegador. La tabla es la
 * fuente única de las teclas, las etiquetas visibles, `aria-keyshortcuts`, la
 * ayuda y el resumen hablado. Se resuelven por `e.code` (Digit1…Digit9), no por
 * `e.key`: en Mac, Option+dígito compone otros caracteres. Se ignoran los
 * eventos con Ctrl, Meta o AltGraph (en teclados en español AltGr llega como
 * Ctrl+Alt), con `repeat` o ya atendidos (`defaultPrevented`).
 */
import { PESTANAS } from './consola.js';

export const ATAJOS_GLOBALES = [
  { n: 1, id: 'perfil', nombre: 'Perfil', descripcion: 'Ir a Perfil', soloAdmin: false },
  { n: 2, id: 'catalogo', nombre: 'Catálogo', descripcion: 'Ir al Catálogo', soloAdmin: false },
  { n: 3, id: 'admin', nombre: 'Administración', descripcion: 'Ir a Administración', soloAdmin: true },
  { n: 4, id: 'buscador', nombre: 'Buscador', descripcion: 'Ir al buscador (en el catálogo)', soloAdmin: false },
  { n: 5, id: 'generos', nombre: 'Géneros', descripcion: 'Ir a la lista de géneros', soloAdmin: false },
  { n: 6, id: 'reproductor', nombre: 'Reproductor', descripcion: 'Ir al reproductor (con un libro cargado)', soloAdmin: false },
  { n: 7, id: 'ayuda', nombre: 'Ayuda', descripcion: 'Abrir la ayuda', soloAdmin: false },
  { n: 8, id: 'paginaAnterior', nombre: 'Página anterior', descripcion: 'Ir a la página anterior (en el catálogo)', soloAdmin: false },
  { n: 9, id: 'paginaSiguiente', nombre: 'Página siguiente', descripcion: 'Ir a la página siguiente (en el catálogo)', soloAdmin: false },
  { n: 0, id: 'continuar', nombre: 'Continuar escuchando', descripcion: 'Continuar escuchando el libro más reciente (en el catálogo)', soloAdmin: false },
];

const porId = (id) => ATAJOS_GLOBALES.find((a) => a.id === id);

/** Valor de `aria-keyshortcuts` para una acción global: 'Alt+1'. */
export const aAriaGlobal = (id) => {
  const a = porId(id);
  return a ? `Alt+${a.n}` : undefined;
};

/** Texto visible de la tecla: 'Alt+1'. */
export const textoTecla = aAriaGlobal;

/** Texto visible del atajo de la pestaña de Administración en la posición n (1…7): 'Alt+Mayús+3'. */
export const textoTeclaPestana = (n) => `Alt+Mayús+${n}`;

/** Valor de `aria-keyshortcuts` de la pestaña n (formato ARIA): 'Alt+Shift+3'. */
export const aAriaPestana = (n) => `Alt+Shift+${n}`;

/**
 * Qué hace un evento de teclado.
 * ctx: { esAdmin, hayLibro, enAdmin, dialogoAbierto, paginas }.
 * `paginas` = { anterior, siguiente } (booleanos) solo en el catálogo con paginación; si no, Alt+8/9 no hacen nada.
 * Devuelve { tipo: 'ir', id } | { tipo: 'pestana', id, nombre } | null.
 */
export const accionGlobal = (e, { esAdmin = false, hayLibro = false, enAdmin = false, dialogoAbierto = false, paginas = null, escribiendo = false } = {}) => {
  if (!e || e.repeat || e.defaultPrevented || dialogoAbierto) return null;
  if (!e.altKey || e.ctrlKey || e.metaKey) return null;
  if (typeof e.getModifierState === 'function' && e.getModifierState('AltGraph')) return null;
  const m = /^Digit([0-9])$/.exec(e.code || '');
  if (!m) return null;
  const n = Number(m[1]);
  // Alt+0 (Continuar escuchando): sin Mayúscula y nunca en un campo de texto,
  // donde Option+0 escribe un carácter en Mac.
  if (n === 0) {
    if (e.shiftKey || escribiendo) return null;
    return { tipo: 'ir', id: 'continuar', nombre: 'Continuar escuchando' };
  }
  if (e.shiftKey) {
    const p = PESTANAS[n - 1];
    return esAdmin && enAdmin && p ? { tipo: 'pestana', id: p.id, nombre: p.nombre } : null;
  }
  const a = ATAJOS_GLOBALES.find((x) => x.n === n);
  if (!a) return null;
  if (a.soloAdmin && !esAdmin) return null;
  if (a.id === 'reproductor' && !hayLibro) return null;
  if (a.id === 'paginaAnterior' && !(paginas && paginas.anterior)) return null;
  if (a.id === 'paginaSiguiente' && !(paginas && paginas.siguiente)) return null;
  return { tipo: 'ir', id: a.id, nombre: a.nombre };
};

const visibles = (esAdmin) => ATAJOS_GLOBALES.filter((a) => esAdmin || !a.soloAdmin);

/** Filas de la ayuda: { teclas: ['Alt+1'], accion }. */
export const filasAyudaGlobales = (esAdmin) => visibles(esAdmin)
  .map((a) => ({ teclas: [`Alt+${a.n}`], accion: a.descripcion }));

/** Fila de Alt+Mayús para Administración; vacía para quien no es Admin. */
export const filasAyudaPestanasAlt = (esAdmin) => (esAdmin
  ? [{
    teclas: ['Alt+Mayús+1 a 7'],
    accion: `Dentro de Administración, abre la pestaña: ${PESTANAS.map((p, i) => `${i + 1} ${p.nombre}`).join(', ')}`,
  }]
  : []);

// 'a, b y c'
const enumerar = (partes) => (partes.length > 1
  ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
  : partes[0] || '');

/** Frase del resumen hablado de los atajos con Alt. */
export const resumenGlobales = (esAdmin) => {
  const base = `Desde cualquier vista: ${enumerar(visibles(esAdmin).map((a) => `Alt + ${a.n} para ${a.nombre}`))}.`;
  return esAdmin
    ? `${base} Dentro de Administración, Alt + Mayúscula + 1 a 7 abren las pestañas.`
    : base;
};
