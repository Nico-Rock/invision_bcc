/**
 * Lo que el Inicio dice del almacenamiento (T-g, brecha 1, 2, 5, 8b y 11).
 * Módulo puro. Aquí se nombran, en un solo lugar, los campos nuevos que la API
 * entrega en GET /admin/pendientes (conciliados con admin_extras.py, T-c):
 *
 *   indice: { estado: 'vacio'|'indexando'|'listo'|'error', ultimo_ok, error,
 *             libros_con_audio, pistas, gb }
 *   sin_ficha: { calculando, cantidad, carpetas: [{ nombre, pistas }], error? }
 *   sin_audio: { calculando, cantidad, libros, error? }
 *
 * y la respuesta 503 de /admin/auditoria/sesiones/ cuando falta la tabla.
 */
import { plural } from './consola.js';

export const formatoGB = (gb) => Number(gb).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const esNumero = (n) => typeof n === 'number' && Number.isFinite(n);
const librosDe = (i) => (esNumero(i.libros_con_audio) ? i.libros_con_audio : i.libros);
const tieneCifras = (i) => i && esNumero(librosDe(i)) && esNumero(i.pistas) && esNumero(i.gb);

const textoCifras = (i) =>
  `${plural(librosDe(i), 'libro con audio', 'libros con audio')}, ${plural(i.pistas, 'pista', 'pistas').replace(/^(\d+)/, (m) => Number(m).toLocaleString('es-AR'))}, ${formatoGB(i.gb)} GB`;

const fechaDe = (iso) => {
  if (!iso) return '';
  const f = new Date(iso);
  return Number.isNaN(f.getTime()) ? '' : `${f.toLocaleDateString('es-AR')} a las ${f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
};

/** { tipo: 'cifras'|'error'|'preparando'|'ausente', texto, urgente } */
export function resumenIndice(indice) {
  if (!indice || !indice.estado) return { tipo: 'ausente', texto: '', urgente: false };
  if (indice.estado === 'error') {
    const base = `El índice del almacenamiento falló: ${indice.error || 'sin detalle'}.`;
    const previo = tieneCifras(indice) ? ` Las últimas cifras${fechaDe(indice.ultimo_ok) ? `, del ${fechaDe(indice.ultimo_ok)}` : ''}: ${textoCifras(indice)}.` : '';
    return { tipo: 'error', texto: base + previo, urgente: true };
  }
  if (indice.estado === 'listo') {
    if (!tieneCifras(indice)) return { tipo: 'ausente', texto: '', urgente: false };
    const cuando = fechaDe(indice.ultimo_ok);
    return { tipo: 'cifras', texto: `En el almacenamiento hay ${textoCifras(indice)}.${cuando ? ` Índice del ${cuando}.` : ''}`, urgente: false };
  }
  return { tipo: 'preparando', texto: 'Se está armando el índice del almacenamiento. Las cifras aparecen cuando termine.', urgente: false };
}

/** Carpetas de audio sin ficha; `ocultas` son las que la lista no trae. */
export function carpetasSinFicha(datos) {
  const a = datos && datos.sin_ficha;
  if (!a) return { cantidad: 0, carpetas: [], ocultas: 0 };
  // Cada carpeta llega como { nombre, pistas }; se acepta también el nombre solo
  const carpetas = Array.isArray(a.carpetas) ? a.carpetas.map((c) => (typeof c === 'string' ? c : c.nombre)) : [];
  const cantidad = esNumero(a.cantidad) ? a.cantidad : carpetas.length;
  return { cantidad, carpetas, ocultas: Math.max(0, cantidad - carpetas.length) };
}

export const textoVerCarpetas = (n) => `Ver ${plural(n, 'carpeta sin ficha', 'carpetas sin ficha')}`;

/** Los tres principios de operación que mostraba el panel (gobernanza). */
export const REGLAS_OPERACION = [
  { titulo: 'Continuidad y alta disponibilidad', texto: 'Monitoreo constante de la plataforma web y de los recursos del almacenamiento de audio.' },
  { titulo: 'Custodia de contenido accesible', texto: 'Estandarización de las pistas de audio para asegurar la compatibilidad total con la reproducción.' },
  { titulo: 'Principio de cero riesgo en producción', texto: 'Ningún cambio a bases de datos o código en producción sin validación formal previa del equipo de la BCC.' },
];

/** Respuesta de la auditoría de accesos: sin la tabla de sesiones es una nota. */
export function notaAccesos(status, detalle) {
  if (status === 503) {
    return { tipo: 'nota', texto: typeof detalle === 'string' && detalle ? detalle : 'Esta base todavía no registra los inicios y cierres de sesión.' };
  }
  return { tipo: 'error', texto: 'No se pudo cargar la auditoría de accesos.' };
}
