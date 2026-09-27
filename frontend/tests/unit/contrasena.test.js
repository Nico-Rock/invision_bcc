// Spec 005 (R17): contraseñas fáciles de dictar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generarContrasena, deletrear } from '../../src/lib/contrasena.js';

test('genera palabra-palabra-número, de al menos 8 caracteres y sin caracteres difíciles', () => {
  for (let i = 0; i < 50; i++) {
    const c = generarContrasena();
    assert.match(c, /^[a-z]+-[a-z]+-\d{2}$/);
    assert.ok(c.length >= 8);
  }
});

test('deletrear lee los guiones y los dígitos de a uno', () => {
  assert.equal(deletrear('faro-luna-47'), 'faro, guion, luna, guion, 4, 7');
});
