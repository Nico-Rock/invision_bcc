// Dictado que no se escucha a sí mismo (spec 002, T9, R34). Portado de
// admin-dashboard/tests/js/dictado.test.js (brecha 9, T-h): lib/dictado.js no
// tenía pruebas propias. Mismos 8 casos, ahora contra el módulo del sitio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearDictado } from '../../src/lib/dictado.js';

function escenario({ voz = true } = {}) {
  const registro = { avisos: [], estados: [], resultados: [], instancias: [], timers: [] };
  class ReconocimientoFalso {
    constructor() { this.llamadas = []; registro.instancias.push(this); }
    start() { this.llamadas.push('start'); }
    abort() { this.llamadas.push('abort'); }
  }
  let pendienteDeVoz = null;
  const temporizador = {
    setTimeout: (fn, ms) => { registro.timers.push({ fn, ms, activo: true }); return registro.timers.length - 1; },
    clearTimeout: (id) => { if (registro.timers[id]) registro.timers[id].activo = false; },
  };
  const correrTimers = () => registro.timers.filter((t) => t.activo).forEach((t) => { t.activo = false; t.fn(); });
  const dictado = crearDictado({
    Reconocimiento: ReconocimientoFalso,
    vozActiva: () => voz,
    anunciar: (texto, op = {}) => {
      registro.avisos.push({ texto, urgente: !!op.urgente });
      if (op.alTerminar) pendienteDeVoz = op.alTerminar;
    },
    alEstado: (e) => registro.estados.push(e),
    alResultado: (t) => registro.resultados.push(t),
    temporizador,
  });
  return { dictado, registro, terminarVoz: () => pendienteDeVoz && pendienteDeVoz(), correrTimers };
}

test('con voz encendida, el micrófono arranca recién cuando termina de hablar el panel', () => {
  const { dictado, registro, terminarVoz } = escenario({ voz: true });
  dictado.alternar();
  assert.equal(registro.instancias.length, 0, 'no debe escuchar mientras habla');
  terminarVoz();
  assert.deepEqual(registro.instancias[0].llamadas, ['start']);
  assert.equal(dictado.estado(), 'escuchando');
});

test('con voz apagada, espera un margen para que termine el lector de pantalla', () => {
  const { dictado, registro, correrTimers } = escenario({ voz: false });
  dictado.alternar();
  assert.equal(registro.instancias.length, 0);
  correrTimers();
  assert.deepEqual(registro.instancias[0].llamadas, ['start']);
});

test('un segundo clic mientras escucha llama a abort() y hay resguardo si no llega onend', () => {
  const { dictado, registro, terminarVoz, correrTimers } = escenario();
  dictado.alternar();
  terminarVoz();
  dictado.alternar();
  assert.deepEqual(registro.instancias[0].llamadas, ['start', 'abort']);
  correrTimers(); // Safari puede no disparar onend después de abort()
  assert.equal(dictado.estado(), 'inactivo');
  assert.equal(registro.estados.at(-1), 'inactivo');
});

test('un segundo clic antes de empezar cancela sin abrir el micrófono', () => {
  const { dictado, registro, terminarVoz } = escenario();
  dictado.alternar();
  dictado.alternar();
  terminarVoz();
  assert.equal(registro.instancias.length, 0);
  assert.equal(dictado.estado(), 'inactivo');
});

test('permiso denegado: aviso urgente que menciona el permiso', () => {
  const { dictado, registro, terminarVoz } = escenario();
  dictado.alternar();
  terminarVoz();
  registro.instancias[0].onerror({ error: 'not-allowed' });
  const ultimo = registro.avisos.at(-1);
  assert.equal(ultimo.urgente, true);
  assert.match(ultimo.texto, /permiso/i);
});

test('el resultado llega al buscador y onend deja el botón en reposo', () => {
  const { dictado, registro, terminarVoz } = escenario();
  dictado.alternar();
  terminarVoz();
  const rec = registro.instancias[0];
  rec.onresult({ results: [[{ transcript: 'Don Quijote' }]] });
  rec.onend();
  assert.deepEqual(registro.resultados, ['Don Quijote']);
  assert.equal(dictado.estado(), 'inactivo');
});

test('sin API de reconocimiento: aviso urgente y nada más', () => {
  const avisos = [];
  const d = crearDictado({ Reconocimiento: null, vozActiva: () => false, anunciar: (t, o) => avisos.push(o && o.urgente), alEstado() {}, alResultado() {} });
  d.alternar();
  assert.deepEqual(avisos, [true]);
});

test('temporizador por defecto: funciona como en el navegador (setTimeout exige this global)', () => {
  // En el navegador, `obj.setTimeout(...)` lanza "Illegal invocation". Node no:
  // este doble reproduce la regla del navegador (defecto hallado el 26/09).
  const originalSet = global.setTimeout, originalClear = global.clearTimeout;
  const pendientes = [];
  global.setTimeout = function (fn) {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    pendientes.push(fn); return pendientes.length;
  };
  global.clearTimeout = function () {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
  };
  try {
    const crear = crearDictado;
    class Rec { start() {} abort() {} }
    const d = crear({ Reconocimiento: Rec, vozActiva: () => false, anunciar() {}, alEstado() {}, alResultado() {} });
    d.alternar();                 // programa la espera sin voz
    pendientes.shift()();         // empieza a escuchar
    assert.equal(d.estado(), 'escuchando');
    d.alternar();                 // abort + resguardo: no debe lanzar
    pendientes.shift()();
    assert.equal(d.estado(), 'inactivo');
  } finally {
    global.setTimeout = originalSet;
    global.clearTimeout = originalClear;
  }
});
