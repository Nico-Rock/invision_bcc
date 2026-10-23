import test from 'node:test';
import assert from 'node:assert/strict';
import { VELOCIDADES, valorVelocidad } from '../../src/lib/velocidad.js';

test('valorVelocidad normaliza número y texto al mismo valor', () => {
  assert.equal(valorVelocidad(1), '1');
  assert.equal(valorVelocidad(1.0), '1');
  assert.equal(valorVelocidad('1.0'), '1');
  assert.equal(valorVelocidad(0.75), '0.75');
  assert.equal(valorVelocidad(1.25), '1.25');
  assert.equal(valorVelocidad(1.5), '1.5');
  assert.equal(valorVelocidad(2), '2');
  assert.equal(valorVelocidad('2.0'), '2');
  assert.equal(valorVelocidad('x'), '');
});

test('toda velocidad del estado coincide con exactamente una opción', () => {
  const opciones = VELOCIDADES.map((o) => valorVelocidad(o.valor));
  for (const o of VELOCIDADES) {
    assert.equal(opciones.filter((x) => x === valorVelocidad(o.valor)).length, 1);
  }
});
