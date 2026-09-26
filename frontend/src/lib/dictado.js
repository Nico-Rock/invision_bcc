/**
 * Dictado por voz que no se escucha a sí mismo (spec 002, R34, D15).
 * Misma lógica que el panel (admin-dashboard/static/dictado.js, probada con
 * node --test); acá como módulo ES para el sitio. Si cambia una, cambia la otra.
 */
const MENSAJES = {
  permiso: { texto: 'El navegador no tiene permiso para usar el micrófono. Habilitalo en el candado de la barra de direcciones y probá de nuevo.', urgente: true },
  'no-speech': { texto: 'No escuché ninguna palabra. Probá de nuevo más cerca del micrófono.', urgente: true },
  aborted: { texto: 'Dictado cancelado.', urgente: false },
  'audio-capture': { texto: 'No se encontró un micrófono conectado.', urgente: true },
  otro: { texto: 'No logré entender el dictado. Intentá de nuevo.', urgente: true },
};

export function mensajeDictado(codigo) {
  if (codigo === 'not-allowed' || codigo === 'service-not-allowed') return MENSAJES.permiso;
  return MENSAJES[codigo] || MENSAJES.otro;
}

export function crearDictado({
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
      const m = mensajeDictado(evento && evento.error);
      anunciar(m.texto, { urgente: m.urgente });
    };
    rec.onend = terminar;
    try {
      rec.start();
      cambiar('escuchando');
    } catch {
      const m = mensajeDictado('audio-capture');
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
      anunciar(mensajeDictado('aborted').texto);
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

