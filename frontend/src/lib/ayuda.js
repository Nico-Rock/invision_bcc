/**
 * Contenido de la ventana de ayuda y del resumen hablado (variante S3).
 * Módulo puro. La ayuda explica cómo moverse con lector de pantalla, con
 * teclado, con toque y con mouse; después lista los pocos atajos que quedan,
 * generados de sus tablas: el reproductor y, para cuentas Admin, las
 * pestañas de Administración. Los atajos globales llevan siempre Alt (no hay atajos de una sola tecla).
 */
import { TECLAS_REPRODUCTOR } from './reproductor.js';
import { filasAyudaConsola, resumenConsola } from './atajos.js';
import { PESTANAS } from './consola.js';
import { filasAyudaGlobales, filasAyudaPestanasAlt, resumenGlobales } from './atajosGlobales.js';

export const SECCIONES_AYUDA = [
  {
    titulo: 'Con lector de pantalla',
    texto: 'Usá las teclas de tu propio lector para saltar por encabezados, regiones y enlaces: en NVDA y JAWS, '
      + 'la H del lector lleva al encabezado siguiente; en VoiceOver, el rotor reúne encabezados, regiones y enlaces. '
      + 'Al cambiar de sección o elegir un género, el foco pasa al encabezado principal de la vista nueva. '
      + 'Al elegir un libro, el foco pasa al botón Pausar del reproductor.',
  },
  {
    titulo: 'Con teclado',
    texto: 'Tab avanza y Mayúscula + Tab retrocede; Enter activa enlaces y botones. Los primeros Tab de cada página '
      + 'son enlaces de salto: al contenido principal, al menú, al buscador, a los géneros y, si hay un libro cargado, '
      + 'al reproductor. En Administración hay además «Saltar a las secciones», que lleva a la pestaña activa. '
      + 'Con el foco en las pestañas de Administración, las flechas ← y → pasan de una sección a otra; Inicio y Fin '
      + 'van a la primera y a la última; Tab entra en la sección. En la lista de libros, Tab entra una sola vez; '
      + '↓ y → pasan al libro siguiente, ↑ y ← al anterior, Inicio y Fin al primero y al último de la página; '
      + 'Enter o Espacio lo reproducen. Esc cierra esta ventana.',
  },
  {
    titulo: 'Con toque',
    texto: 'Tocá un género, el buscador o la tarjeta de un libro para elegirlo. Con VoiceOver o TalkBack, deslizá '
      + 'un dedo a la derecha o a la izquierda para pasar de un elemento a otro y tocá dos veces para activarlo. '
      + 'En el iPhone y el iPad, el volumen se cambia con los botones del equipo.',
  },
  {
    titulo: 'Con mouse',
    texto: 'Hacé clic en un género de la lista Géneros o escribí en el buscador, y después hacé clic en la tarjeta '
      + 'de un libro para escucharlo. Los botones de la barra superior agrandan el texto, activan el alto contraste '
      + 'y encienden o apagan la lectura en voz.',
  },
];

/** Tabla corta de atajos con Alt, que va primero en la ayuda (y la de Alt+Mayús para Admin). */
export const filasAyudaAlt = (esAdmin) => [...filasAyudaGlobales(esAdmin), ...filasAyudaPestanasAlt(esAdmin)];

/** Aclaración que acompaña a la tabla de atajos. */
export const ALCANCE_ATAJOS = 'Los atajos con Alt funcionan desde cualquier vista. Las teclas del reproductor funcionan solo con el foco dentro del reproductor.';

/** Filas de la tabla: { teclas: [...], accion }. Las de la consola, solo para cuentas Admin. */
export const filasAyuda = (esAdmin) => {
  const filas = TECLAS_REPRODUCTOR.map(({ teclas, accion }) => ({ teclas, accion }));
  return esAdmin ? [...filas, ...filasAyudaConsola(PESTANAS)] : filas;
};

// 'a, b y c'
const enumerar = (partes) => (partes.length > 1
  ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
  : partes[0] || '');

/** Resumen hablado de las teclas del reproductor, generado de su tabla. */
export const RESUMEN_ATAJOS = `Con el foco dentro del reproductor: ${enumerar(TECLAS_REPRODUCTOR.map((f) => f.hablado))}.`;

const RESUMEN_NAVEGACION = 'Para moverte, usá los encabezados y las regiones con las teclas de tu lector, '
  + 'o Tab y los enlaces de salto.';

/** Lo que se anuncia al abrir la ayuda. La frase de la consola, solo para cuentas Admin. */
export const resumenAyuda = (esAdmin) => {
  const consola = esAdmin ? resumenConsola(PESTANAS) : '';
  return [resumenGlobales(esAdmin), RESUMEN_NAVEGACION, RESUMEN_ATAJOS, consola].filter(Boolean).join(' ');
};
