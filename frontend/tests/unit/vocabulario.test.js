// Spec 005 (R15): sugerencias y aviso de valores parecidos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, parecido, valoresUnicos } from '../../src/lib/vocabulario.js';

test('normalizar ignora tildes, mayúsculas, espacios y plural', () => {
  assert.equal(normalizar('CUENTOS'), normalizar('cuento'));
  assert.equal(normalizar('Clásicos de la Literatura'), normalizar('CLASICO DE LA LITERATURA'));
  assert.equal(normalizar('  Leyes  '), normalizar('ley'));
  assert.notEqual(normalizar('POESÍA'), normalizar('PROSA'));
});

test('parecido devuelve el existente solo si es distinto al escrito', () => {
  const existentes = ['CUENTOS', 'NOVELA', 'CLÁSICOS DE LA LITERATURA'];
  assert.equal(parecido('cuento', existentes), 'CUENTOS');
  assert.equal(parecido('CUENTOS', existentes), null);
  assert.equal(parecido('clasico de la literatura', existentes), 'CLÁSICOS DE LA LITERATURA');
  assert.equal(parecido('ENSAYO', existentes), null);
  assert.equal(parecido('', existentes), null);
});

test('valoresUnicos ordena y descarta vacíos', () => {
  assert.deepEqual(valoresUnicos(['b', null, 'a', 'b', '  ', 'A']), ['a', 'A', 'b']);
});

test('parecidos devuelve todas las variantes existentes (el catálogo real las tiene)', async () => {
  const { parecidos } = await import('../../src/lib/vocabulario.js');
  const existentes = ['BIOGRAFIAS Y MEMORIAS', 'BIOGRAFÍAS Y MEMORIAS', 'NOVELA'];
  assert.deepEqual(parecidos('biografia y memoria', existentes), ['BIOGRAFIAS Y MEMORIAS', 'BIOGRAFÍAS Y MEMORIAS']);
  assert.deepEqual(parecidos('BIOGRAFÍAS Y MEMORIAS', existentes), []);
  assert.deepEqual(parecidos('ENSAYO', existentes), []);
});
