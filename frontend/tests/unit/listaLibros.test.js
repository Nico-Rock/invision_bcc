import test from 'node:test';
import assert from 'node:assert/strict';
import { indiceDestino, textoPosicion } from '../../src/lib/listaLibros.js';

test('flechas mueven sin envolver', () => {
  assert.equal(indiceDestino('ArrowDown', 0, 8), 1);
  assert.equal(indiceDestino('ArrowRight', 3, 8), 4);
  assert.equal(indiceDestino('ArrowUp', 3, 8), 2);
  assert.equal(indiceDestino('ArrowLeft', 1, 8), 0);
  assert.equal(indiceDestino('ArrowUp', 0, 8), null);
  assert.equal(indiceDestino('ArrowDown', 7, 8), null);
});
test('Inicio y Fin', () => {
  assert.equal(indiceDestino('Home', 5, 8), 0);
  assert.equal(indiceDestino('End', 2, 8), 7);
  assert.equal(indiceDestino('Home', 0, 8), null);
  assert.equal(indiceDestino('End', 7, 8), null);
});
test('casos nulos', () => {
  assert.equal(indiceDestino('Enter', 0, 8), null);
  assert.equal(indiceDestino(' ', 0, 8), null);
  assert.equal(indiceDestino('ArrowDown', 0, 0), null);
  assert.equal(indiceDestino('ArrowDown', 9, 8), null);
  assert.equal(indiceDestino('ArrowDown', null, 8), null);
});
test('texto de posición', () => {
  assert.equal(textoPosicion(1, 15, 8, 120), 'Página 1 de 15 · 8 de 120 libros');
});
