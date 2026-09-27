// Spec 005 (R3, R5): mismas reglas que la API y el panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { numeroDeCapitulo, ordenarPistas, validarNombrePista } from '../../src/lib/capitulos.js';

test('número de capítulo: último número sin la extensión', () => {
  assert.equal(numeroDeCapitulo('Libro Pista 12.mp3'), 12);
  assert.equal(numeroDeCapitulo('Capitulo.mp3'), null);
  assert.equal(numeroDeCapitulo('Intro.mp3'), null);
});

test('orden de capítulo, no alfabético; sin número al final', () => {
  const nombres = ['Pista 10.mp3', 'Intro.mp3', 'Pista 2.mp3', 'Pista 1.mp3'];
  assert.deepEqual(ordenarPistas(nombres.map((name) => ({ name }))).map((f) => f.name),
    ['Pista 1.mp3', 'Pista 2.mp3', 'Pista 10.mp3', 'Intro.mp3']);
});

test('validación de nombres igual a la del servidor', () => {
  for (const malo of ['../x.mp3', 'a/b.mp3', 'a\\b.mp3', 'x.wav', '']) {
    assert.ok(validarNombrePista(malo), `debería rechazar ${malo}`);
  }
  assert.equal(validarNombrePista('Pista 01.mp3'), null);
});
