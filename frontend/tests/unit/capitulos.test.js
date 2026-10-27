// Spec 005 (R3, R5): mismas reglas que la API y el panel.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  numeroDeCapitulo, ordenarPistas, validarNombrePista,
  MAX_BYTES_PISTA, validarTamanoPista, validarPista, CAMPO_TAMANO,
  paramsPermiso, cuerpoConfirmacion, frasePistasSinNumero,
  etiquetaEscuchar, avisoEscuchaPrevia,
} from '../../src/lib/capitulos.js';

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

// T-f (brecha 14): el mismo control de tamaño que la API, antes de pedir el permiso
test('tamaño: rechaza pista vacía y la que supera 500 MB; acepta el límite', () => {
  assert.equal(MAX_BYTES_PISTA, 500 * 1024 * 1024);
  assert.match(validarTamanoPista(0), /vacío/);
  assert.match(validarTamanoPista(MAX_BYTES_PISTA + 1), /500 megabytes/);
  assert.equal(validarTamanoPista(1), null);
  assert.equal(validarTamanoPista(MAX_BYTES_PISTA), null);
});

test('tamaño: un valor que no es número se trata como vacío', () => {
  assert.ok(validarTamanoPista(undefined));
  assert.ok(validarTamanoPista(NaN));
  assert.ok(validarTamanoPista(-5));
});

test('validarPista junta nombre y tamaño, y nombra el archivo', () => {
  assert.equal(validarPista({ name: 'Pista 1.mp3', size: 10 }), null);
  assert.match(validarPista({ name: 'Pista 2.mp3', size: 0 }), /vacío/);
  assert.match(validarPista({ name: 'a.wav', size: 10 }), /MP3/);
});

test('el tamaño viaja en un solo punto: nombre de campo, permiso y confirmación', () => {
  const archivo = { name: 'Pista 1.mp3', size: 1234 };
  const q = paramsPermiso(archivo);
  assert.equal(q.get('filename'), 'Pista 1.mp3');
  assert.equal(q.get(CAMPO_TAMANO), '1234');
  assert.deepEqual(JSON.parse(cuerpoConfirmacion('Libro/Pista 1.mp3', archivo)), { blob_path: 'Libro/Pista 1.mp3', [CAMPO_TAMANO]: 1234 });
});

test('frase sobre pistas sin número: nada si todas tienen número', () => {
  assert.equal(frasePistasSinNumero([{ name: 'Pista 1.mp3' }, { name: 'Pista 2.mp3' }]), '');
  assert.match(frasePistasSinNumero([{ name: 'Pista 1.mp3' }, { name: 'Prólogo.mp3' }]), /sin número.*al final.*Prólogo\.mp3/);
  assert.match(frasePistasSinNumero([{ name: 'A.mp3' }, { name: 'B.mp3' }]), /2 pistas sin número/);
});

test('etiqueta del botón de escucha y aviso de borrador', () => {
  assert.equal(etiquetaEscuchar(2, 'Pista 2.mp3'), 'Escuchar capítulo 2: Pista 2.mp3');
  assert.equal(avisoEscuchaPrevia('borrador'), 'Escucha previa: los socios no ven este libro.');
  assert.equal(avisoEscuchaPrevia('publicado'), '');
  assert.equal(avisoEscuchaPrevia(undefined), '');
});
