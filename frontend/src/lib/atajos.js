/**
 * Atajos por defecto de la consola de administración (spec 004, T10). Módulo
 * puro, sin React ni navegador: la tabla es la fuente única de las teclas, de
 * `aria-keyshortcuts`, de la ayuda y del resumen hablado. Las teclas se
 * guardan por posición de la pestaña (`Digit1`…) y se resuelven por acción:
 * si una pestaña no está visible, su tecla no hace nada y las demás no se
 * corren.
 */
import { PESTANAS } from './consola.js';

const ORDEN_MODIFICADORES = [['ctrlKey', 'Ctrl'], ['altKey', 'Alt'], ['shiftKey', 'Shift'], ['metaKey', 'Meta']];

/** Combinación de un evento de teclado: 'Digit2', 'Shift+Digit2'. Null si la tecla se mantiene pulsada. */
export const deEvento = (e) => {
  if (!e || e.repeat || !e.code) return null;
  const prefijo = ORDEN_MODIFICADORES.filter(([campo]) => e[campo]).map(([, nombre]) => `${nombre}+`).join('');
  return `${prefijo}${e.code}`;
};

const sinCodigo = (parte) => parte.replace(/^Digit(\d)$/, '$1').replace(/^Key([A-Z])$/, '$1');

/** Formato de `aria-keyshortcuts`: 'Digit2' pasa a '2'. */
export const aAria = (combo) => combo.split('+').map(sinCodigo).join('+');

/** Texto que se muestra y se lee: 'Digit2' pasa a '2'. */
export const aTexto = (combo) => combo.split('+').map(sinCodigo).join(' + ');

const ACCIONES = {
  inicio: 'pestana_inicio',
  content: 'pestana_libros',
  users: 'pestana_usuarios',
  import: 'pestana_importar',
  tareas: 'pestana_tareas',
  papelera: 'pestana_papelera',
  audit: 'pestana_auditoria',
};

export const ATAJOS_ADMIN = PESTANAS.map((p, i) => ({
  zona: 'admin',
  accion: ACCIONES[p.id],
  pestana: p.id,
  nombre: p.nombre,
  descripcion: `Ir a la pestaña ${p.nombre}`,
  alcance: 'pestanas',
  teclas: `Digit${i + 1}`,
  obligatoria: false,
}));

const idsVisibles = (visibles) => visibles.map((v) => (typeof v === 'string' ? v : v.id));

/** Atajos del catálogo cuya pestaña está visible, en el orden del catálogo. */
const atajosVisibles = (visibles, catalogo = ATAJOS_ADMIN) => {
  const ids = idsVisibles(visibles);
  return catalogo.filter((a) => ids.includes(a.pestana));
};

/**
 * Qué hace una combinación con el foco en la lista de pestañas.
 * Devuelve { tipo: 'ir' | 'misma', id } o null si no corresponde a una pestaña visible.
 */
export const pestanaDeTecla = (combo, { activa, visibles, catalogo = ATAJOS_ADMIN }) => {
  if (!combo) return null;
  const atajo = atajosVisibles(visibles, catalogo).find((a) => a.teclas === combo);
  if (!atajo) return null;
  return { tipo: atajo.pestana === activa ? 'misma' : 'ir', id: atajo.pestana };
};

const numeroDe = (a) => Number(a.teclas.replace('Digit', ''));

// '1 a 7', o '1, 2 y 4 a 7' cuando falta alguna pestaña
const rangos = (numeros) => {
  const grupos = [];
  numeros.forEach((n) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo[1] === n - 1) ultimo[1] = n;
    else grupos.push([n, n]);
  });
  const textos = grupos.map(([a, b]) => (a === b ? `${a}` : b === a + 1 ? `${a} y ${b}` : `${a} a ${b}`));
  return textos.length > 1 ? `${textos.slice(0, -1).join(', ')} y ${textos[textos.length - 1]}` : textos[0];
};

/**
 * Filas de la ventana de ayuda para las pestañas. Primera vía: ← → Inicio y
 * Fin (patrón de pestañas; Tab entra en la sección). Segunda vía: los
 * dígitos. Lista vacía si no hay pestañas visibles.
 */
export const filasAyudaConsola = (visibles) => {
  const atajos = atajosVisibles(visibles);
  if (!atajos.length) return [];
  return [
    {
      teclas: ['←', '→', 'Inicio', 'Fin'],
      accion: 'Con el foco en las pestañas: cambian de sección; Tab entra en la sección',
    },
    {
      teclas: [rangos(atajos.map(numeroDe))],
      accion: `Con el foco en las pestañas, también: ${atajos.map((a) => `${numeroDe(a)} ${a.nombre}`).join(', ')}`,
    },
  ];
};

/** Frase del resumen hablado de atajos. Cadena vacía si no hay pestañas visibles. */
export const resumenConsola = (visibles) => {
  const atajos = atajosVisibles(visibles);
  if (!atajos.length) return '';
  return 'En Administración, con el foco en las pestañas: las flechas izquierda y derecha, Inicio y Fin cambian de sección, y Tab entra en la sección; '
    + `también ${atajos.map((a) => `${numeroDe(a)} para ${a.nombre}`).join(', ')}.`;
};
