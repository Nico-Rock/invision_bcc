// Teclas del reproductor (variante S3 de la simulación de 75 recorridos):
// actúan solo con el foco dentro del reproductor.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accionReproductor, describirFoco, debeRecargar, TECLAS_REPRODUCTOR, SELECTOR_REPRODUCTOR,
} from '../../src/lib/reproductor.js';

const ev = (key, extra = {}) => ({
  key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, repeat: false, defaultPrevented: false, ...extra,
});
const DENTRO = { dentro: true, escribiendo: false, sobreControl: false };
const FUERA = { dentro: false, escribiendo: false, sobreControl: false };
const TECLAS = [' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'n', 'p', 'm'];

test('con el foco fuera del reproductor, Espacio, flechas, N, P y M no devuelven acción', () => {
  for (const k of [...TECLAS, 'N', 'P', 'M']) {
    assert.equal(accionReproductor(ev(k), FUERA), null, k);
    assert.equal(accionReproductor(ev(k), { ...FUERA, sobreControl: true }), null, `${k} sobre un control`);
  }
});

test('con el foco dentro del reproductor, cada tecla devuelve su acción', () => {
  assert.deepEqual(accionReproductor(ev(' '), DENTRO), { id: 'alternar', valor: null });
  assert.deepEqual(accionReproductor(ev('ArrowLeft'), DENTRO), { id: 'saltar', valor: -15 });
  assert.deepEqual(accionReproductor(ev('ArrowRight'), DENTRO), { id: 'saltar', valor: 15 });
  assert.deepEqual(accionReproductor(ev('ArrowUp'), DENTRO), { id: 'volumen', valor: 1 });
  assert.deepEqual(accionReproductor(ev('ArrowDown'), DENTRO), { id: 'volumen', valor: -1 });
  assert.deepEqual(accionReproductor(ev('n'), DENTRO), { id: 'capitulo', valor: 1 });
  assert.deepEqual(accionReproductor(ev('p'), DENTRO), { id: 'capitulo', valor: -1 });
  assert.deepEqual(accionReproductor(ev('m'), DENTRO), { id: 'silencio', valor: null });
  // Bloq Mayús: la letra llega en mayúscula sin la tecla Mayúscula
  assert.deepEqual(accionReproductor(ev('N'), DENTRO), { id: 'capitulo', valor: 1 });
});

test('sobre un botón del reproductor, las flechas, N, P y M actúan', () => {
  const boton = { ...DENTRO, sobreControl: true };
  for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'n', 'p', 'm']) {
    assert.ok(accionReproductor(ev(k), boton), k);
  }
});

test('Espacio sobre un botón no devuelve acción: el botón se activa solo y no hay doble pausa', () => {
  assert.equal(accionReproductor(ev(' '), { ...DENTRO, sobreControl: true }), null);
});

test('con Ctrl, Alt, Meta, Mayúscula, repeat o un evento ya usado, ninguna acción', () => {
  for (const k of TECLAS) {
    for (const extra of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }, { repeat: true }, { defaultPrevented: true }]) {
      assert.equal(accionReproductor(ev(k, extra), DENTRO), null, `${JSON.stringify(k)} ${JSON.stringify(extra)}`);
    }
  }
});

test('mientras se escribe, o en un rango o un selector, ninguna acción (manejan sus propias teclas)', () => {
  const campo = { ...DENTRO, escribiendo: true };
  for (const k of TECLAS) assert.equal(accionReproductor(ev(k), campo), null, k);
});

test('las teclas retiradas y las ajenas al reproductor no hacen nada, ni dentro de él', () => {
  for (const k of ['s', 'S', 'g', 'h', 'H', '?', '1', '2', '3', '4', 'Enter', 'Escape', 'Tab', 'k']) {
    assert.equal(accionReproductor(ev(k), DENTRO), null, k);
  }
  assert.equal(accionReproductor(null, DENTRO), null);
  assert.equal(accionReproductor(ev(' '), null), null);
});

test('describirFoco: dentro del reproductor, campos y controles, a partir del elemento', () => {
  const el = (tagName, { dentro = false, role = null, isContentEditable = false } = {}) => ({
    tagName,
    isContentEditable,
    getAttribute: (n) => (n === 'role' ? role : null),
    closest: (s) => (dentro && s === SELECTOR_REPRODUCTOR ? {} : null),
  });
  const nada = { dentro: false, escribiendo: false, sobreControl: false };
  assert.deepEqual(describirFoco(null), nada);
  assert.deepEqual(describirFoco(el('BODY')), nada);
  assert.deepEqual(describirFoco(el('SECTION', { dentro: true })), { dentro: true, escribiendo: false, sobreControl: false });
  assert.deepEqual(describirFoco(el('BUTTON', { dentro: true })), { dentro: true, escribiendo: false, sobreControl: true });
  assert.deepEqual(describirFoco(el('INPUT', { dentro: true })), { dentro: true, escribiendo: true, sobreControl: false });
  assert.deepEqual(describirFoco(el('SELECT', { dentro: true })), { dentro: true, escribiendo: true, sobreControl: false });
  assert.equal(describirFoco(el('TEXTAREA')).escribiendo, true);
  assert.equal(describirFoco(el('DIV', { isContentEditable: true })).escribiendo, true);
  assert.equal(describirFoco(el('DIV', { role: 'button' })).sobreControl, true);
  assert.equal(describirFoco(el('A')).sobreControl, true);
});

test('la tabla es la fuente única: el contenedor es .player-dock y cada tecla de la tabla tiene su acción', () => {
  assert.equal(SELECTOR_REPRODUCTOR, '.player-dock');
  assert.deepEqual(TECLAS_REPRODUCTOR.map((f) => f.id), ['alternar', 'saltar', 'volumen', 'capitulo', 'silencio']);
  for (const fila of TECLAS_REPRODUCTOR) {
    assert.ok(fila.accion && fila.hablado && fila.teclas.length, fila.id);
    for (const clave of Object.keys(fila.claves)) {
      assert.equal(accionReproductor(ev(clave), DENTRO)?.id, fila.id, clave);
    }
  }
});

// Reintento tras un fallo de carga: se compara contra el libro cuya pista quedó
// asignada (libroCargadoId), no contra el libro elegido (currentBook).
test('debeRecargar: el mismo libro ya cargado no se recarga (Espacio sobre su tarjeta no lo reinicia)', () => {
  assert.equal(debeRecargar({ libroCargadoId: 7, libro: { id: 7 } }), false);
});

test('debeRecargar: el mismo libro tras un fallo de carga se vuelve a cargar', () => {
  // playChapter limpia libroCargadoId al comenzar y solo lo fija si la pista se asignó
  assert.equal(debeRecargar({ libroCargadoId: null, libro: { id: 7 } }), true);
});

test('debeRecargar: un libro distinto se carga', () => {
  assert.equal(debeRecargar({ libroCargadoId: 7, libro: { id: 8 } }), true);
});

test('debeRecargar: sin libro cargado todavía, se carga; sin libro elegido, nada', () => {
  assert.equal(debeRecargar({ libroCargadoId: undefined, libro: { id: 7 } }), true);
  assert.equal(debeRecargar({ libroCargadoId: 7, libro: null }), false);
  assert.equal(debeRecargar({}), false);
});

test('debeRecargar: el id del libro se compara igual si llega como número o como texto', () => {
  assert.equal(debeRecargar({ libroCargadoId: 7, libro: { id: '7' } }), false);
});
