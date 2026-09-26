// Lógica pura de accesibilidad del panel (spec 002, T2). Correr: node --test admin-dashboard/tests/js/
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../static/a11y-logica.js');

test('texto: sube de a 2 y se detiene en el 200 % (32 px sobre 16)', () => {
  assert.equal(L.siguienteTexto(30, 1), 32);
  assert.equal(L.siguienteTexto(32, 1), 32);
  assert.equal(L.siguienteTexto(12, -1), 12);
  assert.equal(L.TEXTO_MAX / L.TEXTO_BASE, 2);
});

test('texto: un valor guardado fuera de paso se redondea al paso', () => {
  assert.ok([16, 18].includes(L.acotarTexto(17)));
  assert.equal(L.acotarTexto(99), 32);
  assert.equal(L.acotarTexto(-5), 12);
  assert.equal(L.acotarTexto('grande'), L.TEXTO_BASE);
  assert.equal(L.acotarTexto(NaN), L.TEXTO_BASE);
});

test('texto: el factor es proporción del tamaño del navegador', () => {
  assert.equal(L.factorTexto(16), 1);
  assert.equal(L.factorTexto(32), 2);
  assert.equal(L.textoAmplio(22), false);
  assert.equal(L.textoAmplio(L.UMBRAL_AMPLIO), true);
});

test('volumen: pasos de 10 % con límites en 0 y 1', () => {
  assert.equal(L.siguienteVolumen(0.5, 1), 0.6);
  assert.equal(L.siguienteVolumen(0.95, 1), 1);
  assert.equal(L.siguienteVolumen(1, 1), 1);
  assert.equal(L.siguienteVolumen(0.05, -1), 0);
  assert.equal(L.siguienteVolumen(NaN, 1), 1);
});

test('pista vecina: null en los extremos', () => {
  assert.equal(L.pistaVecina(12, 0, 1), 1);
  assert.equal(L.pistaVecina(12, 11, 1), null);
  assert.equal(L.pistaVecina(12, 0, -1), null);
  assert.equal(L.pistaVecina(0, 0, 1), null);
});

test('preferencias: solo números y booleanos válidos; lo demás cae al valor por defecto', () => {
  const p = L.validarPrefs({ texto: 17, contraste: 'si', senales: false, voz: 1, extra: '<img>' });
  assert.ok([16, 18].includes(p.texto));
  assert.equal(p.contraste, false);
  assert.equal(p.senales, false);
  assert.equal(p.voz, L.VOZ_POR_DEFECTO);
  assert.equal('extra' in p, false);
  assert.deepEqual(L.validarPrefs(null), L.PREFS_POR_DEFECTO);
  assert.deepEqual(L.validarPrefs('{roto'), L.PREFS_POR_DEFECTO);
});

test('fuente única: 6 secciones con tecla 1 a 6 y atajos con su texto de ayuda', () => {
  assert.equal(L.SECCIONES.length, 6);
  L.SECCIONES.forEach((s, i) => assert.equal(s.tecla, String(i + 1)));
  const teclas = L.ATAJOS.map((a) => a.teclas.join(' '));
  for (const esperado of ['S', 'H ?', 'Escape', 'Espacio', 'ArrowUp ArrowDown', 'N P', 'M']) {
    assert.ok(teclas.some((t) => t.includes(esperado.split(' ')[0])), `falta el atajo ${esperado}`);
  }
  const resumen = L.resumenAtajos();
  assert.match(resumen, /1 a 6/);
  assert.match(resumen, /volumen/i);
  for (const a of L.ATAJOS) assert.ok(a.accion && a.etiqueta, 'cada atajo tiene acción y etiqueta visible');
});

test('aria-keyshortcuts: valores válidos según ARIA (sin palabras en castellano)', () => {
  for (const a of L.ATAJOS) {
    for (const k of a.ariaKeyshortcuts.split(' ')) {
      assert.match(k, /^((Shift|Control|Alt|Meta)\+)*([A-Za-z0-9?]|Escape|Space|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Slash)$/, k);
    }
  }
});

test('dictado: mensajes distintos por código de error', () => {
  const permiso = L.mensajeDictado('not-allowed');
  assert.equal(permiso.urgente, true);
  assert.match(permiso.texto, /permiso/i);
  assert.deepEqual(L.mensajeDictado('service-not-allowed'), permiso);
  assert.equal(L.mensajeDictado('no-speech').urgente, true);
  assert.equal(L.mensajeDictado('aborted').urgente, false);
  assert.ok(L.mensajeDictado('otra-cosa').texto);
});

test('aplicarTemprano: pone clase y factor en <html> antes del primer pintado', () => {
  const clases = new Set();
  const estilos = {};
  const html = {
    classList: { toggle: (c, on) => (on ? clases.add(c) : clases.delete(c)) },
    style: { setProperty: (k, v) => { estilos[k] = v; } },
  };
  const almacen = { getItem: () => JSON.stringify({ texto: 28, contraste: true }) };
  L.aplicarTemprano(html, almacen);
  assert.ok(clases.has('high-contrast'));
  assert.ok(clases.has('texto-amplio'));
  assert.equal(estilos['--font-factor'], '1.75');

  // Storage que lanza: valores por defecto, sin error
  const clases2 = new Set();
  L.aplicarTemprano({ classList: { toggle: (c, on) => (on ? clases2.add(c) : clases2.delete(c)) }, style: { setProperty() {} } },
    { getItem() { throw new Error('bloqueado'); } });
  assert.equal(clases2.has('high-contrast'), false);
});
