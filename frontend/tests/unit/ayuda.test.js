// Ventana de ayuda y resumen hablado (variante S3): sin atajos globales.
import test from 'node:test';
import assert from 'node:assert/strict';
import { filasAyuda, RESUMEN_ATAJOS, resumenAyuda, SECCIONES_AYUDA } from '../../src/lib/ayuda.js';
import { TECLAS_REPRODUCTOR } from '../../src/lib/reproductor.js';
import { PESTANAS } from '../../src/lib/consola.js';
import { resumenGlobales } from '../../src/lib/atajosGlobales.js';

const RETIRADAS = ['S', 'G', 'H', '?', '1', '2', '3', '4'];

// Sin S, G ni H sueltas, sin "?" y sin dígitos sueltos del 1 al 4 ("15 segundos" y "10 %" no cuentan)
const sinNavegacionGlobal = (texto) => {
  assert.doesNotMatch(texto, /(^|[^\p{L}])[SGH]([^\p{L}]|$)/u, texto);
  assert.doesNotMatch(texto, /\?/, texto);
  assert.doesNotMatch(texto, /(^|\D)[1-4](\D|$)/, texto);
};

test('la tabla de un socio lista solo las teclas del reproductor', () => {
  const filas = filasAyuda(false);
  assert.equal(filas.length, TECLAS_REPRODUCTOR.length);
  const teclas = filas.flatMap((f) => f.teclas);
  RETIRADAS.forEach((t) => assert.ok(!teclas.includes(t), `la tabla no debe tener ${t}`));
  ['Espacio', '←', '→', '↑', '↓', 'N', 'P', 'M'].forEach((t) => assert.ok(teclas.includes(t), `falta ${t}`));
  filas.forEach((f) => sinNavegacionGlobal(`${f.teclas.join(' ')} ${f.accion}`));
});

test('la tabla de un Admin suma dos filas de pestañas: flechas, Inicio y Fin primero; los dígitos 1 a 7 como segunda vía', () => {
  const filas = filasAyuda(true);
  assert.equal(filas.length, TECLAS_REPRODUCTOR.length + 2);
  const [flechas, digitos] = filas.slice(-2);
  assert.deepEqual(flechas.teclas, ['←', '→', 'Inicio', 'Fin']);
  assert.match(flechas.accion, /^Con el foco en las pestañas: /);
  assert.match(flechas.accion, /cambian de sección/);
  assert.match(flechas.accion, /Tab entra en la sección/);
  assert.deepEqual(digitos.teclas, ['1 a 7']);
  assert.match(digitos.accion, /^Con el foco en las pestañas, también: /);
  PESTANAS.forEach((p, i) => assert.ok(digitos.accion.includes(`${i + 1} ${p.nombre}`), p.nombre));
  filas.slice(0, -2).forEach((f) => sinNavegacionGlobal(`${f.teclas.join(' ')} ${f.accion}`));
});

test('el resumen hablado nombra el reproductor y no promete teclas retiradas', () => {
  assert.match(RESUMEN_ATAJOS, /reproductor/);
  assert.match(RESUMEN_ATAJOS, /Espacio/);
  assert.match(RESUMEN_ATAJOS, /N y P/);
  sinNavegacionGlobal(RESUMEN_ATAJOS);
  sinNavegacionGlobal(resumenAyuda(false).replace(resumenGlobales(false), ''));
  assert.ok(resumenAyuda(false).includes(RESUMEN_ATAJOS));
  assert.doesNotMatch(resumenAyuda(false), /Administración|pestañas/);
});

test('para un Admin, el resumen nombra las pestañas 1 a 7 solo con el foco en ellas', () => {
  const texto = resumenAyuda(true);
  const corte = texto.indexOf('En Administración, con el foco en las pestañas');
  assert.ok(corte > 0, texto);
  sinNavegacionGlobal(texto.slice(0, corte).replace(resumenGlobales(true), ''));
  PESTANAS.forEach((p, i) => assert.ok(texto.includes(`${i + 1} para ${p.nombre}`), p.nombre));
  assert.doesNotMatch(texto, /El 3/);
  // Las flechas van primero; los dígitos son la segunda vía
  const frase = texto.slice(corte);
  assert.match(frase, /flechas izquierda y derecha, Inicio y Fin/);
  assert.match(frase, /Tab entra en la sección/);
  assert.ok(frase.indexOf('flechas') < frase.indexOf('1 para Inicio'), frase);
});

test('la ayuda explica cómo moverse con lector, teclado, toque y mouse', () => {
  const titulos = SECCIONES_AYUDA.map((s) => s.titulo);
  [/lector de pantalla/i, /teclado/i, /toque/i, /mouse/i].forEach((re) => assert.ok(titulos.some((t) => re.test(t)), String(re)));
  const texto = (re) => SECCIONES_AYUDA.find((s) => re.test(s.titulo)).texto;
  assert.match(texto(/lector/i), /encabezados/);
  assert.match(texto(/lector/i), /regiones/);
  assert.match(texto(/lector/i), /propio lector|tu lector/);
  assert.match(texto(/teclado/i), /enlaces de salto/);
  SECCIONES_AYUDA.forEach((s) => assert.doesNotMatch(s.texto, /tecla S|Ayuda de Atajos|4 o G/, s.titulo));
});

test('criterio 7: la ayuda con teclado menciona ←, →, Inicio, Fin y que Tab entra en la sección', () => {
  const t = SECCIONES_AYUDA.find((s) => /teclado/i.test(s.titulo)).texto;
  ['←', '→', 'Inicio', 'Fin'].forEach((k) => assert.ok(t.includes(k), `falta ${k}`));
  assert.match(t, /Tab entra en la sección/);
  assert.match(t, /al menú/);
  assert.match(t, /Saltar a las secciones/);
  // Los dígitos, si se mencionan, van después de las flechas
  if (t.includes('1 a 7')) assert.ok(t.indexOf('1 a 7') > t.indexOf('←'));
});
