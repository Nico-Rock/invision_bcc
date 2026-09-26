/**
 * Primitivas de accesibilidad del panel: voz, earcons y live region.
 * Portado de frontend/src/context/AudioContext.jsx (ver docs/specs/10-accesibilidad.md).
 */
const A11y = (() => {
  let ctx = null;

  // Preferencias visuales y auditivas, iguales a las del sitio público (R40):
  // texto de 12 a 28 px en pasos de 2, alto contraste y señales de audio.
  const CLAVE = 'invision-panel-a11y';
  const TEXTO_MIN = 12, TEXTO_MAX = 28, TEXTO_PASO = 2;
  const prefs = { texto: 16, contraste: false, senales: true };

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(prefs)); } catch (e) { /* sin storage: la sesión igual funciona */ }
  }

  function cargar() {
    try {
      const guardadas = JSON.parse(localStorage.getItem(CLAVE) || '{}');
      if (Number.isFinite(guardadas.texto)) {
        prefs.texto = Math.min(TEXTO_MAX, Math.max(TEXTO_MIN, guardadas.texto));
      }
      if (typeof guardadas.contraste === 'boolean') prefs.contraste = guardadas.contraste;
      if (typeof guardadas.senales === 'boolean') prefs.senales = guardadas.senales;
    } catch (e) { /* preferencias corruptas o sin storage: valores por defecto */ }
  }

  function aplicar() {
    document.documentElement.style.setProperty('--font-scale', `${prefs.texto}px`);
    document.body.classList.toggle('high-contrast', prefs.contraste);

    const contraste = document.getElementById('a11y-btn-contraste');
    if (contraste) {
      contraste.textContent = prefs.contraste ? 'Modo Estándar' : 'Alto Contraste';
      contraste.setAttribute('aria-label', prefs.contraste ? 'Desactivar contraste alto' : 'Activar contraste alto');
    }
    const senales = document.getElementById('a11y-btn-senales');
    if (senales) {
      senales.textContent = `Señales de Audio: ${prefs.senales ? 'ON' : 'OFF'}`;
      senales.setAttribute('aria-label', prefs.senales ? 'Desactivar señales de audio' : 'Activar señales de audio');
    }
  }

  function ajustarTexto(direccion) {
    const siguiente = Math.min(TEXTO_MAX, Math.max(TEXTO_MIN, prefs.texto + direccion * TEXTO_PASO));
    if (siguiente === prefs.texto) {
      anunciar(`El tamaño de letra ya está en el ${direccion > 0 ? 'máximo' : 'mínimo'}, ${prefs.texto} píxeles`);
      earcon('error');
      return;
    }
    prefs.texto = siguiente;
    aplicar(); guardar();
    anunciar(`Tamaño de letra ajustado a ${prefs.texto} píxeles`);
    earcon('accion');
  }

  function alternarContraste() {
    prefs.contraste = !prefs.contraste;
    aplicar(); guardar();
    earcon('exito');
    anunciar(prefs.contraste
      ? 'Alto contraste activado. Interfaz optimizada en color negro y amarillo.'
      : 'Alto contraste desactivado. Interfaz estándar en blanco y naranja.');
  }

  function alternarSenales() {
    prefs.senales = !prefs.senales;
    aplicar(); guardar();
    if (prefs.senales) {
      earcon('exito');
      anunciar('Señales de audio activadas.');
    } else {
      anunciar('Señales de audio desactivadas.');
    }
  }

  function iniciar() {
    cargar();
    aplicar();
  }

  // Frecuencias y formas de onda del spec de accesibilidad (seccion 2.3)
  const EARCONS = {
    exito:  { freqs: [440, 880], onda: 'triangle', dur: 0.18 },
    error:  { freqs: [180],      onda: 'sawtooth', dur: 0.30 },
    accion: { freqs: [659.25],   onda: 'sine',     dur: 0.10 },
  };

  function earcon(tipo) {
    const cfg = EARCONS[tipo];
    if (!cfg || !prefs.senales) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      // El navegador crea el contexto suspendido hasta que hay un gesto del
      // usuario. Sin este resume el primer earcon del panel no suena nunca.
      if (ctx.state === 'suspended') ctx.resume();
      cfg.freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = cfg.onda;
        osc.frequency.value = freq;
        const inicio = ctx.currentTime + i * cfg.dur;
        // Volumen bajo con decay exponencial: feedback, no interrupcion.
        // La envolvente arranca en `inicio`, no en currentTime: si no, la
        // segunda nota del earcon de exito suena cuando el gain ya decayo a 0.
        gain.gain.setValueAtTime(0.08, inicio);
        gain.gain.exponentialRampToValueAtTime(0.001, inicio + cfg.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(inicio);
        osc.stop(inicio + cfg.dur);
      });
    } catch (e) {
      // Sin Web Audio el flujo sigue: la voz y la live region son el canal principal
    }
  }

  function anunciar(texto) {
    // Live region primero: es el canal que siempre funciona, incluso sin TTS
    const region = document.getElementById('a11y-anuncios');
    if (region) {
      region.textContent = '';
      // El reset fuerza a los lectores de pantalla a releer un texto repetido
      setTimeout(() => { region.textContent = texto; }, 50);
    }
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();  // no encimar anuncios
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'es-ES';
      window.speechSynthesis.speak(u);
    } catch (e) {
      // Degradacion: queda la live region
    }
  }

  return { anunciar, earcon, iniciar, ajustarTexto, alternarContraste, alternarSenales };
})();
