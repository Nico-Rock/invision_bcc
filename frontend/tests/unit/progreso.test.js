import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  segundosValidos, capituloValido, payloadProgreso, leerProgreso, hayProgreso,
  posicionInicial, textoPosicionHablada, avisoContinuar, nombreBotonContinuar,
  debeGuardar, listaContinuar, INTERVALO_GUARDADO_MS, MAX_CONTINUAR,
  debeRefrescarContinuar, INTERVALO_REFRESCO_CONTINUAR_MS as INT_REF,
} from '../../src/lib/progreso.js';
import { accionGlobal, aAriaGlobal, filasAyudaGlobales, resumenGlobales } from '../../src/lib/atajosGlobales.js';

test('posición: segundos y capítulo acotados', () => {
  assert.equal(segundosValidos(12.5), 12.5);
  [-3, NaN, Infinity, null, undefined, 'x'].forEach((v) => assert.equal(segundosValidos(v), 0));
  assert.equal(capituloValido(3), 3);
  assert.equal(capituloValido('2'), 2);
  [0, -1, NaN, null, 'x'].forEach((v) => assert.equal(capituloValido(v), 1));
});

test('payload de guardar-progreso: segundos con una décima, capítulo entero', () => {
  assert.deepEqual(payloadProgreso({ usuarioId: 7, libroId: 42, capitulo: 2, segundos: 845.678 }),
    { usuario_id: 7, audiolibro_id: 42, chapter_index: 2, progreso: 845.7 });
  assert.deepEqual(payloadProgreso({ usuarioId: 7, libroId: 42, capitulo: 0, segundos: -5 }),
    { usuario_id: 7, audiolibro_id: 42, chapter_index: 1, progreso: 0 });
  assert.equal(payloadProgreso({ usuarioId: null, libroId: 42 }), null);
  assert.equal(payloadProgreso({ usuarioId: 7, libroId: 0 }), null);
});

test('lectura del progreso de la API y si hay algo que continuar', () => {
  assert.deepEqual(leerProgreso({ chapter_index: 2, progreso: 840 }), { capitulo: 2, segundos: 840 });
  assert.deepEqual(leerProgreso(null), { capitulo: 1, segundos: 0 });
  assert.equal(hayProgreso({ capitulo: 1, segundos: 0 }), false);
  assert.equal(hayProgreso({ capitulo: 1, segundos: 0.4 }), false);
  assert.equal(hayProgreso({ capitulo: 1, segundos: 30 }), true);
  assert.equal(hayProgreso({ capitulo: 2, segundos: 0 }), true);
});

test('decisión de terminado y posición inicial', () => {
  assert.deepEqual(posicionInicial({ capitulo: 1, segundos: 0, totalCapitulos: 3 }),
    { capitulo: 1, segundos: 0, reanuda: false, terminado: false });
  assert.deepEqual(posicionInicial({ capitulo: 2, segundos: 840, totalCapitulos: 3, duracion: 1800 }),
    { capitulo: 2, segundos: 840, reanuda: true, terminado: false });
  // último capítulo al final: terminado, de nuevo desde el inicio
  assert.deepEqual(posicionInicial({ capitulo: 3, segundos: 1798, totalCapitulos: 3, duracion: 1800 }),
    { capitulo: 1, segundos: 0, reanuda: false, terminado: true });
  // capítulo inexistente: terminado
  assert.equal(posicionInicial({ capitulo: 5, segundos: 10, totalCapitulos: 3 }).terminado, true);
  // capítulo intermedio al final: el siguiente desde 0
  assert.deepEqual(posicionInicial({ capitulo: 1, segundos: 1799, totalCapitulos: 3, duracion: 1800 }),
    { capitulo: 2, segundos: 0, reanuda: true, terminado: false });
  // sin duración conocida no se decide terminado por segundos
  assert.equal(posicionInicial({ capitulo: 3, segundos: 9999, totalCapitulos: 3 }).terminado, false);
});

test('formato hablado: capítulo X, minuto Y', () => {
  assert.equal(textoPosicionHablada(2, 845), 'capítulo 2, minuto 14');
  assert.equal(textoPosicionHablada(1, 59), 'capítulo 1, minuto 0');
  assert.equal(avisoContinuar('Rayuela', 2, 845), 'Continuando «Rayuela», capítulo 2, minuto 14.');
  assert.equal(nombreBotonContinuar('Rayuela', 2, 845), 'Continuar «Rayuela», capítulo 2, minuto 14');
});

test('throttle de guardado cada 15 s', () => {
  assert.equal(INTERVALO_GUARDADO_MS, 15000);
  assert.equal(debeGuardar({ ahora: 1000, ultimo: null }), true);
  assert.equal(debeGuardar({ ahora: 15999, ultimo: 1000 }), false);
  assert.equal(debeGuardar({ ahora: 16000, ultimo: 1000 }), true);
  assert.equal(debeGuardar({ ahora: NaN, ultimo: 1000 }), false);
});

test('lista de continuar: hasta 5, más reciente primero', () => {
  const filas = Array.from({ length: 7 }, (_, i) => ({
    id: i + 1, nombre: `L${i + 1}`, autor: 'A', chapter_index: 1, progreso: 60 * i,
    ultima_reproduccion: `2026-10-${String(10 + i).padStart(2, '0')}T10:00:00`,
  }));
  const l = listaContinuar({ results: filas });
  assert.equal(l.length, MAX_CONTINUAR);
  assert.equal(l[0].id, 7);
  assert.equal(l[0].title, 'L7');
  assert.equal(l[0].segundos, 360);
  assert.deepEqual(listaContinuar(null), []);
  assert.deepEqual(listaContinuar({ results: [{ id: null }] }), []);
});

test('Alt+0: Continuar escuchando, con las mismas guardas', () => {
  const ev = (extra = {}) => ({ altKey: true, code: 'Digit0', ...extra });
  assert.deepEqual(accionGlobal(ev(), {}), { tipo: 'ir', id: 'continuar', nombre: 'Continuar escuchando' });
  assert.deepEqual(accionGlobal(ev(), { esAdmin: true, enAdmin: true }), { tipo: 'ir', id: 'continuar', nombre: 'Continuar escuchando' });
  assert.equal(accionGlobal(ev({ ctrlKey: true }), {}), null);
  assert.equal(accionGlobal(ev({ metaKey: true }), {}), null);
  assert.equal(accionGlobal(ev({ shiftKey: true }), { esAdmin: true, enAdmin: true }), null);
  assert.equal(accionGlobal(ev({ repeat: true }), {}), null);
  assert.equal(accionGlobal(ev({ getModifierState: (k) => k === 'AltGraph' }), {}), null);
  assert.equal(accionGlobal(ev(), { escribiendo: true }), null);
  assert.equal(accionGlobal(ev(), { dialogoAbierto: true }), null);
  assert.equal(accionGlobal({ altKey: true, key: '0', code: 'Numpad0' }, {}), null);
  assert.equal(aAriaGlobal('continuar'), 'Alt+0');
  assert.ok(filasAyudaGlobales(false).some((f) => f.teclas[0] === 'Alt+0'));
  assert.match(resumenGlobales(false), /Alt \+ 0 para Continuar escuchando/);
});


test('debeRefrescarContinuar: primer guardado de un libro refresca siempre', () => {
  assert.equal(debeRefrescarContinuar({ ahora: 1000, evento: { libroId: 7, capitulo: 1 } }), true);
  assert.equal(debeRefrescarContinuar({ ahora: 1000, ultimo: 999, previo: { libroId: 3, capitulo: 1 }, evento: { libroId: 7, capitulo: 1 } }), true);
});

test('debeRefrescarContinuar: guardados periódicos limitados a uno cada intervalo', () => {
  const previo = { libroId: 7, capitulo: 2 };
  const evento = { libroId: 7, capitulo: 2, motivo: 'ciclo' };
  assert.equal(INT_REF, 10000);
  assert.equal(debeRefrescarContinuar({ ahora: 15000, ultimo: 10000, previo, evento }), false);
  assert.equal(debeRefrescarContinuar({ ahora: 20000, ultimo: 10000, previo, evento }), true);
});

test('debeRefrescarContinuar: pausa y cambio de capítulo refrescan aunque no pase el intervalo', () => {
  const previo = { libroId: 7, capitulo: 2 };
  assert.equal(debeRefrescarContinuar({ ahora: 10001, ultimo: 10000, previo, evento: { libroId: 7, capitulo: 2, motivo: 'pausa' } }), true);
  assert.equal(debeRefrescarContinuar({ ahora: 10001, ultimo: 10000, previo, evento: { libroId: '7', capitulo: 3 } }), true);
});

test('debeRefrescarContinuar: entradas inválidas no refrescan', () => {
  assert.equal(debeRefrescarContinuar({ ahora: NaN, evento: { libroId: 7, capitulo: 1 } }), false);
  assert.equal(debeRefrescarContinuar({ ahora: 1000 }), false);
  assert.equal(debeRefrescarContinuar({ ahora: 1000, evento: { capitulo: 1 } }), false);
  assert.equal(debeRefrescarContinuar(), false);
});
