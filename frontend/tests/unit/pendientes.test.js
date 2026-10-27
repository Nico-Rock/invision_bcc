// T-g (brecha 1, 2, 5, 8b, 11): lo que el Inicio dice del índice de audio y de
// las carpetas sin ficha. Los campos de la API se nombran en lib/pendientes.js;
// aquí se simula la respuesta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatoGB, resumenIndice, carpetasSinFicha, REGLAS_OPERACION, notaAccesos, textoVerCarpetas,
} from '../../src/lib/pendientes.js';

test('GB con coma decimal y una cifra', () => {
  assert.equal(formatoGB(112.46), '112,5');
  assert.equal(formatoGB(0), '0,0');
});

test('índice listo: libros con audio, pistas y GB, en palabras', () => {
  const r = resumenIndice({ estado: 'listo', libros: 538, pistas: 6240, gb: 112.46, ultimo_ok: '2026-10-22T10:00:00' });
  assert.equal(r.tipo, 'cifras');
  assert.match(r.texto, /538 libros con audio/);
  assert.match(r.texto, /6\.240 pistas/);
  assert.match(r.texto, /112,5 GB/);
  assert.equal(r.urgente, false);
});

test('singular: 1 libro con audio, 1 pista', () => {
  const r = resumenIndice({ estado: 'listo', libros: 1, pistas: 1, gb: 0.05 });
  assert.match(r.texto, /1 libro con audio, 1 pista, 0,1 GB/);
});

test('índice en error: dice el error tal cual, no «calculando», y es urgente', () => {
  const r = resumenIndice({ estado: 'error', error: 'No se pudo leer el almacenamiento (timeout)', ultimo_ok: null });
  assert.equal(r.tipo, 'error');
  assert.match(r.texto, /No se pudo leer el almacenamiento \(timeout\)/);
  assert.doesNotMatch(r.texto, /alcul/);
  assert.equal(r.urgente, true);
});

test('índice en error con un índice anterior: conserva las cifras y avisa de su fecha', () => {
  const r = resumenIndice({ estado: 'error', error: 'timeout', libros: 10, pistas: 50, gb: 1, ultimo_ok: '2026-10-22T10:00:00' });
  assert.equal(r.tipo, 'error');
  assert.match(r.texto, /timeout/);
  assert.match(r.texto, /10 libros con audio/);
});

test('índice armándose o vacío: es un estado en curso, no urgente', () => {
  for (const estado of ['indexando', 'vacio']) {
    const r = resumenIndice({ estado });
    assert.equal(r.tipo, 'preparando');
    assert.equal(r.urgente, false);
  }
});

test('respuesta vieja de la API (sin campos nuevos): no inventa cifras', () => {
  assert.equal(resumenIndice(undefined).tipo, 'ausente');
  assert.equal(resumenIndice({ estado: 'listo', ultimo_ok: 'x' }).tipo, 'ausente');
});

test('carpetas sin ficha: cantidad, nombres y las que no caben en la lista', () => {
  assert.deepEqual(carpetasSinFicha({ audio_sin_ficha: { cantidad: 2, carpetas: ['A', 'B'] } }), { cantidad: 2, carpetas: ['A', 'B'], ocultas: 0 });
  assert.deepEqual(carpetasSinFicha({ audio_sin_ficha: { cantidad: 80, carpetas: ['A'] } }), { cantidad: 80, carpetas: ['A'], ocultas: 79 });
  assert.deepEqual(carpetasSinFicha({}), { cantidad: 0, carpetas: [], ocultas: 0 });
  assert.deepEqual(carpetasSinFicha({ audio_sin_ficha: null }), { cantidad: 0, carpetas: [], ocultas: 0 });
});

test('texto del botón de carpetas sin ficha', () => {
  assert.equal(textoVerCarpetas(1), 'Ver 1 carpeta sin ficha');
  assert.equal(textoVerCarpetas(3), 'Ver 3 carpetas sin ficha');
});

test('reglas de operación: los tres principios del panel', () => {
  assert.equal(REGLAS_OPERACION.length, 3);
  assert.match(REGLAS_OPERACION[2].texto, /validación formal previa/);
});

test('accesos: un 503 es una nota, no un error urgente', () => {
  const n = notaAccesos(503, 'Esta base no registra sesiones.');
  assert.equal(n.tipo, 'nota');
  assert.equal(n.texto, 'Esta base no registra sesiones.');
  assert.equal(notaAccesos(503, undefined).texto.length > 10, true);
  assert.equal(notaAccesos(500, 'x').tipo, 'error');
});
