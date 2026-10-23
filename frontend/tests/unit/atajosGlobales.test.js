// Atajos globales con Alt (módulo puro).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATAJOS_GLOBALES, accionGlobal, aAriaGlobal, filasAyudaGlobales, filasAyudaPestanasAlt, resumenGlobales, textoTeclaPestana, aAriaPestana,
} from '../../src/lib/atajosGlobales.js';
import { PESTANAS } from '../../src/lib/consola.js';

const ev = (code, extra = {}) => ({
  code, altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, defaultPrevented: false,
  getModifierState: () => false, ...extra,
});
const ctxAdmin = { esAdmin: true, hayLibro: true, enAdmin: true };
const ctxSocio = { esAdmin: false, hayLibro: true, enAdmin: false };

test('Alt+1 a Alt+7 dan su acción', () => {
  const ids = ['perfil', 'catalogo', 'admin', 'buscador', 'generos', 'reproductor', 'ayuda'];
  ids.forEach((id, i) => {
    const a = accionGlobal(ev(`Digit${i + 1}`), ctxAdmin);
    assert.equal(a?.id, id);
    assert.equal(a?.tipo, 'ir');
  });
});

test('Alt+3 solo para Admin; Alt+6 solo con libro', () => {
  assert.equal(accionGlobal(ev('Digit3'), ctxSocio), null);
  assert.equal(accionGlobal(ev('Digit6'), { ...ctxSocio, hayLibro: false }), null);
  assert.equal(accionGlobal(ev('Digit6'), ctxSocio)?.id, 'reproductor');
});

test('Alt+Mayús+1…7 abren la pestaña en Administración, solo Admin', () => {
  PESTANAS.forEach((p, i) => {
    const a = accionGlobal(ev(`Digit${i + 1}`, { shiftKey: true }), ctxAdmin);
    assert.deepEqual([a.tipo, a.id], ['pestana', p.id]);
  });
  assert.equal(accionGlobal(ev('Digit3', { shiftKey: true }), { ...ctxAdmin, enAdmin: false }), null);
  assert.equal(accionGlobal(ev('Digit3', { shiftKey: true }), { ...ctxAdmin, esAdmin: false }), null);
});

test('combinaciones que no corresponden dan null', () => {
  assert.equal(accionGlobal(ev('Digit1', { ctrlKey: true }), ctxAdmin), null);
  assert.equal(accionGlobal(ev('Digit1', { metaKey: true }), ctxAdmin), null);
  assert.equal(accionGlobal(ev('Digit1', { getModifierState: (k) => k === 'AltGraph' }), ctxAdmin), null);
  assert.equal(accionGlobal(ev('Digit1', { repeat: true }), ctxAdmin), null);
  assert.equal(accionGlobal(ev('Digit1', { defaultPrevented: true }), ctxAdmin), null);
  assert.equal(accionGlobal(ev('Digit1', { altKey: false }), ctxAdmin), null);
  assert.equal(accionGlobal(ev('Digit1', { dialogoAbierto: true }), { ...ctxAdmin, dialogoAbierto: true }), null);
  ['Digit8', 'Digit9', 'KeyS', 'KeyG', 'KeyH'].forEach((c) => {
    assert.equal(accionGlobal(ev(c), ctxAdmin), null, c);
    assert.equal(accionGlobal(ev(c, { shiftKey: true }), ctxAdmin), null, c);
  });
  assert.equal(accionGlobal(null, ctxAdmin), null);
});

test('formato aria, ayuda y resumen salen de la tabla', () => {
  assert.equal(aAriaGlobal('perfil'), 'Alt+1');
  assert.equal(aAriaGlobal('ayuda'), 'Alt+7');
  assert.equal(aAriaGlobal('inexistente'), undefined);
  assert.equal(ATAJOS_GLOBALES.length, 10);
  assert.equal(filasAyudaGlobales(false).length, 9);
  assert.equal(filasAyudaGlobales(true).length, 10);
  assert.equal(filasAyudaPestanasAlt(false).length, 0);
  assert.equal(filasAyudaPestanasAlt(true).length, 1);
  assert.match(resumenGlobales(true), /Alt \+ 3/);
  assert.doesNotMatch(resumenGlobales(false), /Administración/);
});

test('etiqueta visible y aria de cada pestaña coinciden con la tecla que la abre', () => {
  assert.equal(textoTeclaPestana(1), 'Alt+Mayús+1');
  assert.equal(aAriaPestana(7), 'Alt+Shift+7');
  PESTANAS.forEach((p, i) => {
    const e = { altKey: true, shiftKey: true, code: `Digit${i + 1}` };
    const a = accionGlobal(e, { esAdmin: true, enAdmin: true });
    assert.equal(a.id, p.id);
    assert.equal(textoTeclaPestana(i + 1).replace('Mayús', 'Shift'), aAriaPestana(i + 1));
  });
});

test('Alt+8 y Alt+9: páginas solo si existen', () => {
  const pag = { anterior: true, siguiente: true };
  assert.equal(accionGlobal(ev('Digit8'), { ...ctxSocio, paginas: pag })?.id, 'paginaAnterior');
  assert.equal(accionGlobal(ev('Digit9'), { ...ctxSocio, paginas: pag })?.id, 'paginaSiguiente');
  assert.equal(accionGlobal(ev('Digit8'), { ...ctxSocio, paginas: { anterior: false, siguiente: true } }), null);
  assert.equal(accionGlobal(ev('Digit9'), { ...ctxSocio, paginas: { anterior: true, siguiente: false } }), null);
  assert.equal(accionGlobal(ev('Digit8'), ctxSocio), null);
  assert.equal(accionGlobal(ev('Digit9'), { ...ctxSocio, paginas: null }), null);
  assert.equal(accionGlobal(ev('Digit9'), { ...ctxAdmin, enAdmin: true }), null);
});

test('Alt+8/9 respetan modificadores, repeat y diálogo', () => {
  const c = { ...ctxSocio, paginas: { anterior: true, siguiente: true } };
  assert.equal(accionGlobal(ev('Digit9', { ctrlKey: true }), c), null);
  assert.equal(accionGlobal(ev('Digit9', { metaKey: true }), c), null);
  assert.equal(accionGlobal(ev('Digit9', { repeat: true }), c), null);
  assert.equal(accionGlobal(ev('Digit9', { getModifierState: () => true }), c), null);
  assert.equal(accionGlobal(ev('Digit9', { shiftKey: true }), c), null);
  assert.equal(accionGlobal(ev('Digit9'), { ...c, dialogoAbierto: true }), null);
});
