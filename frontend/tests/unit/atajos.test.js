// Atajos por defecto de las pestañas de la consola (spec 004, T10).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as atajos from '../../src/lib/atajos.js';
import {
  deEvento, aAria, aTexto, ATAJOS_ADMIN, pestanaDeTecla, filasAyudaConsola, resumenConsola,
} from '../../src/lib/atajos.js';
import { PESTANAS } from '../../src/lib/consola.js';

const ev = (code, extra = {}) => ({ code, key: code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, repeat: false, ...extra });
const ids = PESTANAS.map((p) => p.id);

test('deEvento: formato Digit2 y Shift+Digit2; null con repeat', () => {
  assert.equal(deEvento(ev('Digit2')), 'Digit2');
  assert.equal(deEvento(ev('Digit2', { shiftKey: true })), 'Shift+Digit2');
  assert.equal(deEvento(ev('Digit2', { repeat: true })), null);
});

test('aAria y aTexto', () => {
  assert.equal(aAria('Digit2'), '2');
  assert.equal(aAria('Shift+Digit2'), 'Shift+2');
  assert.equal(aTexto('Digit2'), '2');
  assert.equal(aTexto('KeyL'), 'L');
});

test('criterio 1: Digit1 a Digit7 llevan a las 7 pestañas en el orden de PESTANAS', () => {
  assert.equal(PESTANAS.length, 7);
  PESTANAS.forEach((p, i) => {
    const otra = ids.find((id) => id !== p.id);
    assert.deepEqual(pestanaDeTecla(`Digit${i + 1}`, { activa: otra, visibles: PESTANAS }), { tipo: 'ir', id: p.id });
  });
});

test('criterio 2: con Mayúscula, Alt, Ctrl, Meta o repeat no hay pestaña', () => {
  const ctx = { activa: 'inicio', visibles: PESTANAS };
  for (const extra of [{ shiftKey: true }, { altKey: true }, { ctrlKey: true }, { metaKey: true }, { repeat: true }]) {
    assert.equal(pestanaDeTecla(deEvento(ev('Digit2', extra)), ctx), null, JSON.stringify(extra));
  }
});

test('criterio 3: Digit8, Digit9, Digit0, Numpad2 y KeyL no hacen nada', () => {
  for (const c of ['Digit8', 'Digit9', 'Digit0', 'Numpad2', 'KeyL']) {
    assert.equal(pestanaDeTecla(c, { activa: 'inicio', visibles: PESTANAS }), null, c);
  }
});

test('criterio 4: el dígito de la pestaña activa da misma', () => {
  assert.deepEqual(pestanaDeTecla('Digit2', { activa: 'content', visibles: PESTANAS }), { tipo: 'misma', id: 'content' });
});

test('criterio 5: sin Usuarios, Digit3 no hace nada, la ayuda no la nombra y Digit4 sigue en Importar fichas', () => {
  const visibles = PESTANAS.filter((p) => p.id !== 'users');
  assert.equal(pestanaDeTecla('Digit3', { activa: 'inicio', visibles }), null);
  assert.deepEqual(pestanaDeTecla('Digit4', { activa: 'inicio', visibles }), { tipo: 'ir', id: 'import' });
  assert.ok(!JSON.stringify(filasAyudaConsola(visibles)).includes('Usuarios'));
  assert.ok(!resumenConsola(visibles).includes('Usuarios'));
});

test('criterio 6: catálogo con formato D2, sin teclas ni acciones repetidas, zona admin', () => {
  assert.equal(ATAJOS_ADMIN.length, PESTANAS.length);
  assert.equal(new Set(ATAJOS_ADMIN.map((a) => a.teclas)).size, ATAJOS_ADMIN.length);
  assert.equal(new Set(ATAJOS_ADMIN.map((a) => a.accion)).size, ATAJOS_ADMIN.length);
  ATAJOS_ADMIN.forEach((a) => {
    assert.match(a.teclas, /^Digit[1-9]$/);
    assert.equal(a.zona, 'admin');
    assert.equal(a.alcance, 'pestanas');
    assert.equal(a.obligatoria, false);
    assert.ok(a.nombre && a.descripcion);
  });
  PESTANAS.forEach((p, i) => {
    const a = ATAJOS_ADMIN.find((x) => x.pestana === p.id);
    assert.equal(a.teclas, `Digit${i + 1}`);
  });
});

test('criterio 7: la ayuda y el resumen nombran las 7 pestañas en orden', () => {
  const orden = (texto) => {
    const pos = PESTANAS.map((p) => texto.indexOf(p.nombre));
    assert.ok(pos.every((n) => n >= 0), texto);
    assert.deepEqual([...pos].sort((a, b) => a - b), pos, texto);
  };
  const [flechas, digitos] = filasAyudaConsola(PESTANAS);
  assert.deepEqual(flechas.teclas, ['←', '→', 'Inicio', 'Fin']);
  assert.equal(digitos.teclas[0], '1 a 7');
  orden(digitos.accion);
  orden(resumenConsola(PESTANAS));
});

test('la tecla 3 global se retiró (decisión de Nico, variante S3): sin nota ni frase del 3', () => {
  assert.equal(atajos.NOTA_TECLA_ADMINISTRACION, undefined);
  const resumen = resumenConsola(PESTANAS);
  assert.doesNotMatch(resumen, /El 3/);
  assert.doesNotMatch(resumen, /lleva el foco a las pestañas/);
  assert.match(resumen, /^En Administración, con el foco en las pestañas: las flechas izquierda y derecha, Inicio y Fin cambian de sección, y Tab entra en la sección; también 1 para Inicio, /);
  assert.ok(resumen.trim().endsWith('7 para Auditoría.'), resumen);
});

test('los dígitos solo actúan como pestañas: un dígito sin pestaña visible no devuelve nada', () => {
  assert.equal(pestanaDeTecla('Digit1', { activa: 'inicio', visibles: [] }), null);
  assert.equal(pestanaDeTecla(null, { activa: 'inicio', visibles: PESTANAS }), null);
});
