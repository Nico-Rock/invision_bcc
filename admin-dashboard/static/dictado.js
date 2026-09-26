/**
 * Dictado por voz que no se escucha a sí mismo (spec 002, R34, D15).
 *
 * El micrófono nunca está abierto mientras el panel habla: primero se avisa,
 * se espera a que termine la voz (o un margen para el lector de pantalla) y
 * recién entonces se escucha. Sin DOM: se prueba en Node con un reconocedor
 * falso (tests/js/dictado.test.js).
 */
(function (raiz, fabrica) {
  const modulo = fabrica(raiz);
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else raiz.Dictado = modulo;
})(typeof self !== 'undefined' ? self : this, function (raiz) {
  'use strict';

  const L = (typeof require === 'function') ? require('./a11y-logica.js') : raiz.A11yLogica;

  function crearDictado({
    Reconocimiento, vozActiva, anunciar, alEstado, alResultado,
    // Envueltos: en el navegador `temporizador.setTimeout(...)` con `this`
    // distinto de window lanza "Illegal invocation" (Detener dictado fallaba).
    temporizador = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id) },
    esperaSinVoz = 1500, resguardoMs = 1000,
  }) {
    let estado = 'inactivo';   // inactivo | preparando | escuchando
    let rec = null;
    let espera = null;
    let resguardo = null;

    function cambiar(nuevo) {
      estado = nuevo;
      alEstado(nuevo);
    }

    function terminar() {
      if (resguardo !== null) { temporizador.clearTimeout(resguardo); resguardo = null; }
      if (estado === 'inactivo') return;
      rec = null;
      cambiar('inactivo');
    }

    function empezar() {
      espera = null;
      if (estado !== 'preparando') return;  // se canceló mientras se avisaba
      rec = new Reconocimiento();
      rec.lang = 'es-ES';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (evento) => alResultado(evento.results[0][0].transcript);
      rec.onerror = (evento) => {
        const m = L.mensajeDictado(evento && evento.error);
        anunciar(m.texto, { urgente: m.urgente });
      };
      rec.onend = terminar;
      try {
        rec.start();
        cambiar('escuchando');
      } catch (e) {
        const m = L.mensajeDictado('audio-capture');
        rec = null;
        cambiar('inactivo');
        anunciar(m.texto, { urgente: true });
      }
    }

    function iniciar() {
      cambiar('preparando');
      const aviso = 'Dictá el título después del tono.';
      if (vozActiva()) {
        anunciar(aviso, { alTerminar: empezar });
      } else {
        anunciar(aviso);
        espera = temporizador.setTimeout(empezar, esperaSinVoz);
      }
    }

    function detener() {
      if (estado === 'preparando') {
        if (espera !== null) { temporizador.clearTimeout(espera); espera = null; }
        cambiar('inactivo');
        anunciar(L.mensajeDictado('aborted').texto);
        return;
      }
      if (estado === 'escuchando' && rec) {
        rec.abort();
        // Safari puede no disparar onend después de abort(): se cierra igual.
        resguardo = temporizador.setTimeout(terminar, resguardoMs);
      }
    }

    function alternar() {
      if (!Reconocimiento) {
        anunciar('El dictado por voz no está disponible en este navegador. Probá con Google Chrome o Microsoft Edge.', { urgente: true });
        return;
      }
      if (estado === 'inactivo') iniciar();
      else detener();
    }

    return { alternar, estado: () => estado };
  }

  return { crearDictado };
});
